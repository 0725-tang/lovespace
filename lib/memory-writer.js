'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { listMemories, loadPhotos, toUrlPath } = require('./content');

const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

function clean(value, max) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function cleanBody(value) {
  return String(value || '')
    .replace(/\r\n/g, '\n')
    .replace(/\u0000/g, '')
    .trim()
    .slice(0, 20000);
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T12:00:00');
  if (Number.isNaN(date.getTime())) return false;
  const bits = value.split('-');
  return String(date.getFullYear()) === bits[0] && String(date.getMonth() + 1) === String(Number(bits[1])) && String(date.getDate()) === String(Number(bits[2]));
}

function slugify(title) {
  return String(title || '')
    .toLowerCase()
    .replace(/[\\/:*?"<>|\s，。！？、；：（）()《》【】]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 36);
}

function parseTags(value) {
  const raw = Array.isArray(value) ? value : String(value || '').split(/[,，]/);
  const tags = [];
  for (const item of raw) {
    const tag = clean(item, 20);
    if (tag && tags.indexOf(tag) === -1) tags.push(tag);
    if (tags.length >= 8) break;
  }
  return tags;
}

function readPhotoList(root) {
  try {
    const parsed = JSON.parse(fs.readFileSync(path.join(root, 'content', 'photos.json'), 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw new Error('无法读取 content/photos.json：' + error.message);
  }
}

function writeAtomic(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + '.tmp';
  fs.writeFileSync(temp, content, 'utf8');
  fs.renameSync(temp, file);
}

function detectImage(buffer) {
  if (!buffer || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return { ext: 'jpg', type: 'image/jpeg' };
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) return { ext: 'png', type: 'image/png' };
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) return { ext: 'gif', type: 'image/gif' };
  if (buffer.slice(0, 4).toString('ascii') === 'RIFF' && buffer.slice(8, 12).toString('ascii') === 'WEBP') return { ext: 'webp', type: 'image/webp' };
  return null;
}

function decodePhoto(photo) {
  if (!photo || typeof photo !== 'object') throw new Error('照片格式不正确。');
  const raw = String(photo.data || '');
  if (!raw) throw new Error('照片内容是空的。');
  let base64 = raw;
  const match = raw.match(/^data:image\/(?:jpeg|jpg|png|webp|gif);base64,([A-Za-z0-9+/=\s]+)$/i);
  if (match) base64 = match[1];
  base64 = base64.replace(/\s+/g, '');
  if (!/^[A-Za-z0-9+/]+=*$/.test(base64)) throw new Error('照片编码不正确。');
  const buffer = Buffer.from(base64, 'base64');
  if (buffer.length < 12) throw new Error('照片太小了。');
  if (buffer.length > MAX_PHOTO_BYTES) throw new Error('照片太大了，请选择 8MB 以内的图片。');
  const type = detectImage(buffer);
  if (!type) throw new Error('只支持 JPG、PNG、WebP 或 GIF 图片。');
  return { buffer: buffer, ext: type.ext, type: type.type };
}

function uniqueName(dir, base, ext, skip) {
  let filename = base + '.' + ext;
  let full = path.join(dir, filename);
  let index = 2;
  while (fs.existsSync(full) && full !== skip) {
    filename = base + '-' + index + '.' + ext;
    full = path.join(dir, filename);
    index += 1;
  }
  return { filename: filename, full: full };
}

function writePhoto(root, photo, date, slug, meta) {
  const image = decodePhoto(photo);
  const dir = path.join(root, 'content', 'media', 'photos');
  fs.mkdirSync(dir, { recursive: true });
  const suffix = meta && meta.suffix ? meta.suffix : 'cover';
  const base = date + '-' + slug + '-' + suffix;
  const target = uniqueName(dir, base, image.ext);
  fs.writeFileSync(target.full, image.buffer);
  const src = 'media/photos/' + target.filename;

  const previous = readPhotoList(root);
  const entry = {
    file: src,
    caption: (meta && meta.caption) || '未命名照片',
    date: date,
    place: (meta && meta.place) || '',
    alt: (meta && meta.alt) || (meta && meta.caption) || '照片',
    memory: (meta && meta.memory) || ''
  };
  writeAtomic(path.join(root, 'content', 'photos.json'), JSON.stringify(previous.concat(entry), null, 2) + '\n');

  return {
    src: src,
    file: target.full,
    previousPhotos: previous
  };
}

function rollbackPhoto(root, uploaded) {
  if (!uploaded) return;
  try { fs.rmSync(uploaded.file, { force: true }); } catch (error) { /* 忽略 */ }
  try {
    writeAtomic(path.join(root, 'content', 'photos.json'), JSON.stringify(uploaded.previousPhotos, null, 2) + '\n');
  } catch (error) { /* 忽略 */ }
}

function createMemory(root, input) {
  const date = clean(input && input.date, 10);
  if (!validDate(date)) throw new Error('日期格式不正确，请使用 YYYY-MM-DD。');
  const title = clean(input && input.title, 80);
  if (!title) throw new Error('标题不能为空。');
  const body = cleanBody(input && input.body);
  if (!body) throw new Error('正文不能为空。');

  const place = clean(input && input.place, 80);
  const mood = clean(input && input.mood, 40);
  const weather = clean(input && input.weather, 40);
  const quote = clean(input && input.quote, 300);
  const tags = parseTags(input && input.tags);
  const slug = slugify(title) || 'memory';

  const photos = loadPhotos(root);
  const requestedCover = toUrlPath((input && input.cover) || '');
  let cover = '';
  if (requestedCover) {
    const found = photos.find(function (photo) { return photo.src === requestedCover; });
    if (!found) throw new Error('选择的封面照片不存在。');
    cover = found.src;
  }

  let uploaded = null;
  if (input && input.photo && input.photo.data) {
    uploaded = writePhoto(root, input.photo, date, slug, {
      caption: title,
      place: place,
      alt: title,
      memory: title,
      suffix: 'cover'
    });
    cover = uploaded.src;
  }

  const dir = path.join(root, 'content', 'memories');
  fs.mkdirSync(dir, { recursive: true });
  const base = date + '-' + slug;
  const target = uniqueName(dir, base, 'md');
  const full = target.full;

  const frontmatter = ['---', 'date: ' + date, 'title: ' + JSON.stringify(title)];
  if (place) frontmatter.push('place: ' + JSON.stringify(place));
  if (mood) frontmatter.push('mood: ' + JSON.stringify(mood));
  if (weather) frontmatter.push('weather: ' + JSON.stringify(weather));
  if (tags.length) frontmatter.push('tags: ' + JSON.stringify(tags));
  if (cover) frontmatter.push('cover: ' + JSON.stringify(cover));
  if (quote) frontmatter.push('quote: ' + JSON.stringify(quote));
  frontmatter.push('---');
  frontmatter.push('');
  frontmatter.push(body);
  frontmatter.push('');

  try {
    writeAtomic(full, frontmatter.join('\n'));
  } catch (error) {
    rollbackPhoto(root, uploaded);
    throw error;
  }

  return {
    file: path.relative(root, full).replace(/\\/g, '/'),
    filename: target.filename,
    slug: target.filename.replace(/\.md$/i, ''),
    date: date,
    title: title,
    cover: cover
  };
}

function createPhoto(root, input) {
  const caption = clean(input && input.caption, 80) || '未命名照片';
  const date = clean(input && input.date, 10) || new Date().toISOString().slice(0, 10);
  if (!validDate(date)) throw new Error('日期格式不正确，请使用 YYYY-MM-DD。');
  const place = clean(input && input.place, 80);
  const alt = clean(input && input.alt, 120) || caption;
  if (!input || !input.photo || !input.photo.data) throw new Error('先选择一张照片。');
  const slug = slugify(caption) || 'photo';
  const uploaded = writePhoto(root, input.photo, date, slug, {
    caption: caption,
    place: place,
    alt: alt,
    memory: '',
    suffix: 'photo'
  });
  return {
    file: uploaded.src,
    caption: caption,
    date: date,
    place: place,
    alt: alt
  };
}

function deleteMemory(root, slugValue) {
  const slug = clean(slugValue, 120);
  if (!slug || slug.indexOf('..') !== -1 || /[\\/]/.test(slug)) throw new Error('回忆标识不正确。');
  const dir = path.join(root, 'content', 'memories');
  const full = path.join(dir, slug + '.md');
  if (path.dirname(full) !== dir) throw new Error('回忆标识不正确。');
  if (!fs.existsSync(full)) {
    const error = new Error('这篇回忆已经不存在了。');
    error.status = 404;
    throw error;
  }
  fs.unlinkSync(full);
  return { file: path.relative(root, full).replace(/\\/g, '/') };
}

function deletePhoto(root, fileValue) {
  const src = toUrlPath(fileValue);
  if (!/^media\/photos\/[^/]+$/.test(src)) throw new Error('照片路径不正确。');
  const photosDir = path.join(root, 'content', 'media', 'photos');
  const full = path.join(root, 'content', src);
  if (path.dirname(full) !== photosDir) throw new Error('照片路径不正确。');

  const usedBy = listMemories(root, loadPhotos(root)).find(function (memory) {
    return memory.cover === src || (memory.photos || []).indexOf(src) !== -1;
  });
  if (usedBy) {
    const error = new Error('这张照片还是《' + usedBy.title + '》的封面。请先换封面或删掉那篇回忆。');
    error.status = 409;
    throw error;
  }

  const list = readPhotoList(root);
  const entry = list.find(function (photo) { return photo.file === src || photo.src === src; });
  if (!entry) {
    const error = new Error('这张照片不在照片墙里。');
    error.status = 404;
    throw error;
  }
  if (fs.existsSync(full)) fs.unlinkSync(full);
  writeAtomic(path.join(root, 'content', 'photos.json'), JSON.stringify(list.filter(function (photo) { return photo !== entry; }), null, 2) + '\n');
  return { file: src };
}

module.exports = { createMemory, createPhoto, deleteMemory, deletePhoto, detectImage, parseTags, slugify, validDate };
