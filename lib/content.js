'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createDefaultSite } = require('./defaults');
const { publicLetter } = require('./letter');

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function mergeDeep(base, extra) {
  if (!isPlainObject(base) || !isPlainObject(extra)) return extra === undefined ? base : extra;
  const out = { ...base };
  for (const [key, value] of Object.entries(extra)) {
    out[key] = isPlainObject(value) && isPlainObject(base[key]) ? mergeDeep(base[key], value) : value;
  }
  return out;
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    if (error.code === 'ENOENT') return fallback;
    throw new Error('无法读取 ' + file + '：' + error.message);
  }
}

function unquote(value) {
  const text = String(value).trim();
  if ((text.startsWith('"') && text.endsWith('"')) || (text.startsWith("'") && text.endsWith("'"))) {
    return text.slice(1, -1).replace(/\\n/g, '\n').replace(/\\"/g, '"');
  }
  return text;
}

function splitList(raw) {
  const value = raw.trim();
  if (!value.startsWith('[') || !value.endsWith(']')) return null;
  const inner = value.slice(1, -1).trim();
  if (!inner) return [];
  const items = [];
  let current = '';
  let quote = '';
  for (const char of inner) {
    if (quote) {
      if (char === quote) quote = '';
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") { quote = char; continue; }
    if (char === ',' || char === '，') { items.push(current.trim()); current = ''; continue; }
    current += char;
  }
  if (current.trim()) items.push(current.trim());
  return items.map((item) => unquote(item)).filter(Boolean);
}

function parseValue(raw) {
  const list = splitList(raw);
  if (list) return list;
  const text = unquote(raw);
  if (text === 'true') return true;
  if (text === 'false') return false;
  if (text === 'null' || text === '~') return null;
  if (/^-?\d+(\.\d+)?$/.test(text)) return Number(text);
  return text;
}

/**
 * 只实现恋爱手账真正需要的 YAML 子集：
 * key: value、[a, b]、引号、布尔值、数字。
 * 复杂 YAML 不值得在这个项目里引入依赖。
 */
function parseFrontmatter(input) {
  const text = String(input || '').replace(/\r\n/g, '\n').replace(/^\uFEFF/, '');
  if (!text.startsWith('---\n')) return { data: {}, body: text.trim() };
  const end = text.indexOf('\n---', 4);
  if (end === -1) return { data: {}, body: text.trim() };
  const head = text.slice(4, end);
  const body = text.slice(end + 4).replace(/^\n+/, '').trim();
  const data = {};
  for (const line of head.split('\n')) {
    if (!line.trim() || line.trim().startsWith('#') || /^\s/.test(line)) continue;
    const colon = line.indexOf(':');
    if (colon === -1) continue;
    const key = line.slice(0, colon).trim();
    if (!key) continue;
    data[key] = parseValue(line.slice(colon + 1));
  }
  return { data, body };
}

function stripMarkdown(text) {
  return String(text || '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncate(text, length) {
  const chars = Array.from(String(text || ''));
  return chars.length > length ? chars.slice(0, length).join('') + '…' : chars.join('');
}

function toUrlPath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '').replace(/^\//, '');
}

function existsOrRemote(root, src) {
  if (/^https?:\/\//i.test(src)) return true;
  if (!src) return false;
  return fs.existsSync(path.join(root, src)) || fs.existsSync(path.join(root, 'content', src));
}

function loadSite(root) {
  const raw = readJson(path.join(root, 'content', 'site.json'), {});
  return mergeDeep(createDefaultSite(), raw);
}

function loadPhotos(root) {
  const raw = readJson(path.join(root, 'content', 'photos.json'), []);
  if (!Array.isArray(raw)) throw new Error('content/photos.json 必须是数组');
  const photos = raw.map((item, index) => {
    const entry = typeof item === 'string' ? { file: item } : item;
    const src = toUrlPath(entry.src || entry.file || '');
    return {
      id: String(entry.id || 'photo-' + (index + 1)),
      src,
      caption: String(entry.caption || ''),
      date: String(entry.date || ''),
      place: String(entry.place || ''),
      alt: String(entry.alt || entry.caption || '我们的照片'),
      memory: String(entry.memory || ''),
      year: String(entry.date || '').slice(0, 4)
    };
  }).filter((photo) => {
    if (!photo.src) return false;
    if (!existsOrRemote(root, photo.src)) {
      console.warn('[lovespace] 跳过不存在的照片：' + photo.src);
      return false;
    }
    return true;
  });
  return photos.sort((a, b) => String(b.date).localeCompare(String(a.date)));
}

function listMemories(root, photos = []) {
  const dir = path.join(root, 'content', 'memories');
  if (!fs.existsSync(dir)) return [];
  const files = fs.readdirSync(dir).filter((name) => name.endsWith('.md') && !name.startsWith('_') && name.toLowerCase() !== 'readme.md');
  const memories = files.map((name) => {
    const full = path.join(dir, name);
    const parsed = parseFrontmatter(fs.readFileSync(full, 'utf8'));
    const data = parsed.data;
    const slug = name.replace(/\.md$/i, '');
    const heading = parsed.body.match(/^#\s+(.+)$/m);
    const body = parsed.body.replace(/^#\s+.+\n?/m, '').trim();
    const date = String(data.date || (slug.match(/\d{4}-\d{2}-\d{2}/) || [''])[0] || '');
    const title = String(data.title || (heading && heading[1]) || slug);
    const paragraphs = body.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean);
    const tags = Array.isArray(data.tags) ? data.tags : (data.tags ? String(data.tags).split(/[,，]/).map((tag) => tag.trim()).filter(Boolean) : []);
    const photoList = Array.isArray(data.photos) ? data.photos.map(toUrlPath) : [];
    const cover = toUrlPath(data.cover || photoList[0] || (photos.find((photo) => photo.memory === title) || {}).src || '');
    return {
      slug,
      date,
      title,
      place: String(data.place || ''),
      mood: String(data.mood || ''),
      weather: String(data.weather || ''),
      tags,
      quote: String(data.quote || ''),
      cover: existsOrRemote(root, cover) ? cover : '',
      photos: photoList,
      body,
      paragraphs,
      excerpt: truncate(stripMarkdown(paragraphs[0] || ''), 92),
      wordCount: Array.from(stripMarkdown(body)).length
    };
  });
  return memories.sort((a, b) => {
    const diff = String(b.date).localeCompare(String(a.date));
    return diff || a.slug.localeCompare(b.slug);
  });
}

function buildStats(memories, photos) {
  const cities = new Set();
  for (const memory of memories) {
    const city = String(memory.place || '').split(/[·,，/|]/)[0].trim();
    if (city) cities.add(city);
  }
  const years = new Set(memories.map((memory) => memory.date.slice(0, 4)).filter(Boolean));
  const words = memories.reduce((total, memory) => total + memory.wordCount, 0);
  return {
    photos: photos.length,
    memories: memories.length,
    cities: cities.size,
    words,
    years: years.size
  };
}

function buildSiteData(root, options = {}) {
  const site = loadSite(root);
  const publicSite = { ...site, letter: publicLetter(site.letter) };
  const photos = loadPhotos(root);
  const memories = listMemories(root, photos);
  return {
    version: 1,
    mode: options.mode || 'live',
    generatedAt: new Date().toISOString(),
    site: publicSite,
    photos,
    memories,
    stats: buildStats(memories, photos),
    guestbook: Array.isArray(options.guestbook) ? options.guestbook : []
  };
}

function writeDataJs(file, data) {
  const json = JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, 'window.LOVESPACE_DATA = ' + json + ';\n', 'utf8');
}

module.exports = {
  buildSiteData,
  buildStats,
  listMemories,
  loadPhotos,
  loadSite,
  mergeDeep,
  parseFrontmatter,
  parseValue,
  stripMarkdown,
  toUrlPath,
  truncate,
  writeDataJs
};
