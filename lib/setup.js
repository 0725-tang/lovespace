'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { createDefaultSite } = require('./defaults');
const { loadSite } = require('./content');

function clean(value, max) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function dateOnly(value) {
  const text = clean(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return '';
  const date = new Date(text + 'T00:00:00');
  if (Number.isNaN(date.getTime())) return '';
  const bits = text.split('-');
  if (String(date.getFullYear()) !== bits[0]) return '';
  if (String(date.getMonth() + 1) !== String(Number(bits[1]))) return '';
  if (String(date.getDate()) !== String(Number(bits[2]))) return '';
  return text;
}

function today() {
  const date = new Date();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return date.getFullYear() + '-' + month + '-' + day;
}

function writeAtomic(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + '.tmp';
  fs.writeFileSync(temp, content, 'utf8');
  fs.renameSync(temp, file);
}

function isSetupComplete(root) {
  try {
    const site = loadSite(root);
    const couple = site.couple || {};
    const birthdays = couple.birthdays || {};
    return site.setupComplete === true
      && Boolean(couple.me)
      && Boolean(couple.her)
      && Boolean(dateOnly(couple.anniversary))
      && Boolean(dateOnly(birthdays.me))
      && Boolean(dateOnly(birthdays.her));
  } catch (error) {
    return false;
  }
}

function clearSpace(root) {
  writeAtomic(path.join(root, 'content', 'photos.json'), '[]\n');

  const memoriesDir = path.join(root, 'content', 'memories');
  fs.mkdirSync(memoriesDir, { recursive: true });
  for (const name of fs.readdirSync(memoriesDir)) {
    if (!name.endsWith('.md')) continue;
    fs.rmSync(path.join(memoriesDir, name), { force: true });
  }

  writeAtomic(path.join(root, 'data', 'guestbook.json'), JSON.stringify({ messages: [] }, null, 2) + '\n');
  fs.rmSync(path.join(root, 'dist', 'MEMOIR.md'), { force: true });
}

function saveSetup(root, input) {
  const me = clean(input && input.me, 24);
  const her = clean(input && input.her, 24);
  if (!me) throw new Error('请填写你的名字。');
  if (!her) throw new Error('请填写恋人的名字。');

  const anniversary = dateOnly(input && input.anniversary);
  if (!anniversary) throw new Error('请选择你们相爱的日期。');
  if (anniversary > today()) throw new Error('相爱日期不能在未来。');

  const birthdayMe = dateOnly(input && input.birthdayMe);
  const birthdayHer = dateOnly(input && input.birthdayHer);
  if (!birthdayMe) throw new Error('请选择你的生日。');
  if (!birthdayHer) throw new Error('请选择恋人的生日。');
  if (birthdayMe > today()) throw new Error('你的生日不能在未来。');
  if (birthdayHer > today()) throw new Error('恋人的生日不能在未来。');
  if (birthdayMe < '1900-01-01' || birthdayHer < '1900-01-01') throw new Error('生日年份看起来不太对。');

  const site = createDefaultSite();
  site.setupComplete = true;
  site.couple.me = me;
  site.couple.her = her;
  site.couple.anniversary = anniversary + 'T00:00:00';
  site.couple.birthdays = { me: birthdayMe, her: birthdayHer };
  site.counter.note = '从 ' + anniversary.replace(/-/g, '.') + ' 开始，时间有了温柔的方向。';

  clearSpace(root);
  writeAtomic(path.join(root, 'content', 'site.json'), JSON.stringify(site, null, 2) + '\n');
  return site;
}

function deleteSpace(root) {
  clearSpace(root);
  fs.rmSync(path.join(root, 'content', 'site.json'), { force: true });
  const media = path.join(root, 'content', 'media');
  fs.rmSync(media, { recursive: true, force: true });
  fs.mkdirSync(media, { recursive: true });
  return { deleted: true };
}

module.exports = { clearSpace, dateOnly, deleteSpace, isSetupComplete, saveSetup };
