'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { buildStats, listMemories, loadPhotos, loadSite } = require('../lib/content');

const ROOT = path.resolve(__dirname, '..');
const DAY = 24 * 60 * 60 * 1000;

function usage() {
  console.log('');
  console.log('  用法：npm run memoir -- [--out 文件路径]');
  console.log('');
  console.log('  默认输出：dist/MEMOIR.md');
  console.log('  修改回忆请编辑 content/memories/ 里的 Markdown。');
  console.log('');
}

function parseArgs(argv) {
  let out = path.join(ROOT, 'dist', 'MEMOIR.md');
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    }
    if (arg === '--out') {
      const value = argv[++i];
      if (!value) throw new Error('--out 需要一个文件路径');
      out = path.resolve(ROOT, value);
    } else {
      throw new Error('未知参数：' + arg);
    }
  }
  return { out };
}

function pad(value) {
  return String(value).padStart(2, '0');
}

function dateParts(value) {
  if (!value) return null;
  const raw = String(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const bits = raw.split('-');
    return { year: bits[0], month: bits[1], day: bits[2] };
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return { year: String(date.getFullYear()), month: pad(date.getMonth() + 1), day: pad(date.getDate()) };
}

function formatDate(value, separator) {
  const parts = dateParts(value);
  if (!parts) return String(value || '');
  return parts.year + separator + parts.month + separator + parts.day;
}

function daysSince(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 0;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / DAY));
}

function imageLink(cover, outFile) {
  if (!cover) return '';
  if (/^https?:\/\//i.test(cover)) return cover;
  const file = path.join(ROOT, 'content', cover);
  if (!fs.existsSync(file)) return '';
  const relative = path.relative(path.dirname(outFile), file).split(path.sep).join('/');
  return relative.split('/').map(encodeURIComponent).join('/');
}

function quoteBlock(text) {
  return String(text || '').split(/\r?\n/).map(function (line) { return '> ' + line; }).join('\n');
}

function escapeLinkText(text) {
  return String(text || '').replace(/\[/g, '\\[').replace(/\]/g, '\\]');
}

function memoryMeta(memory) {
  const bits = [];
  if (memory.place) bits.push('**' + memory.place + '**');
  if (memory.weather) bits.push(memory.weather);
  if (memory.mood) bits.push(memory.mood);
  return bits.join(' · ');
}

function buildMemoir(site, photos, memories, outFile) {
  const couple = site.couple || {};
  const memoir = site.memoir || {};
  const stats = buildStats(memories, photos);
  const ordered = memories.slice().sort(function (a, b) {
    return String(a.date).localeCompare(String(b.date)) || String(a.title).localeCompare(String(b.title));
  });
  const start = couple.anniversary ? formatDate(couple.anniversary, '.') : '';
  const today = formatDate(new Date(), '.');
  const days = daysSince(couple.anniversary);
  const title = memoir.title || '我们的故事';
  const author = [couple.me, couple.her].filter(Boolean).join(' × ');
  const lines = [];

  lines.push('<!-- 由 npm run memoir 从 content/memories 生成；修改请直接改原 Markdown。 -->');
  lines.push('');
  lines.push('# ' + title);
  lines.push('');
  if (author) lines.push('> ' + author);
  if (start) lines.push('> ' + start + ' — ' + today);
  lines.push('');
  if (memoir.subtitle) {
    lines.push('*' + memoir.subtitle + '*');
    lines.push('');
  }
  lines.push('---');
  lines.push('');
  lines.push('## 关于这本回忆录');
  lines.push('');
  lines.push('- 在一起：' + days + ' 天');
  lines.push('- 回忆：' + stats.memories + ' 篇');
  lines.push('- 照片：' + stats.photos + ' 张');
  lines.push('- 一起走过的城市：' + stats.cities + ' 座');
  lines.push('- 正文：约 ' + stats.words + ' 字');
  lines.push('');
  if (memoir.prologue) {
    lines.push('## 序');
    lines.push('');
    lines.push(memoir.prologue);
    lines.push('');
  }
  lines.push('## 目录');
  lines.push('');
  ordered.forEach(function (memory, index) {
    const date = formatDate(memory.date, '.');
    const anchor = 'memory-' + (memory.date || 'undated') + '-' + (index + 1);
    lines.push('- [' + (date ? date + ' · ' : '') + escapeLinkText(memory.title) + '](#' + anchor + ')');
  });
  lines.push('');
  lines.push('---');
  lines.push('');

  ordered.forEach(function (memory, index) {
    const date = formatDate(memory.date, '.');
    const anchor = 'memory-' + (memory.date || 'undated') + '-' + (index + 1);
    const meta = memoryMeta(memory);
    const photo = imageLink(memory.cover, outFile);
    lines.push('<a id="' + anchor + '"></a>');
    lines.push('');
    lines.push('## ' + (date ? date + ' · ' : '') + memory.title);
    lines.push('');
    if (meta) {
      lines.push(meta);
      lines.push('');
    }
    if (memory.quote) {
      lines.push(quoteBlock(memory.quote));
      lines.push('');
    }
    if (memory.body) {
      lines.push(memory.body);
      lines.push('');
    }
    if (photo) {
      lines.push('![' + escapeLinkText(memory.title) + '](' + photo + ')');
      lines.push('');
    }
    if (memory.tags && memory.tags.length) {
      lines.push('**标签：** ' + memory.tags.join(' / '));
      lines.push('');
    }
    lines.push('---');
    lines.push('');
  });

  if (memoir.epilogue) {
    lines.push('## 后记');
    lines.push('');
    lines.push(memoir.epilogue);
    lines.push('');
  }
  if (site.footer && site.footer.line) {
    lines.push('> ' + site.footer.line);
    lines.push('');
  }
  lines.push('*生成于 ' + today + ' · LoveSpace*');
  lines.push('');
  return { markdown: lines.join('\n'), ordered, stats, days, start, title };
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  const site = loadSite(ROOT);
  const photos = loadPhotos(ROOT);
  const memories = listMemories(ROOT, photos);
  const result = buildMemoir(site, photos, memories, options.out);
  fs.mkdirSync(path.dirname(options.out), { recursive: true });
  fs.writeFileSync(options.out, result.markdown, 'utf8');
  console.log('');
  console.log('  回忆录已生成：' + path.relative(ROOT, options.out));
  console.log('  ' + result.ordered.length + ' 篇回忆 · ' + result.stats.words + ' 字 · ' + result.days + ' 天');
  console.log('');
  console.log('  原稿仍在 content/memories/；重新运行会覆盖这个文件。');
  console.log('');
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error('  ' + error.message);
    process.exitCode = 1;
  }
}

module.exports = { buildMemoir, formatDate, imageLink };
