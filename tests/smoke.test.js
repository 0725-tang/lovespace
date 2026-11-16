'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const { createDefaultSite } = require('../lib/defaults');
const { dateOnly, deleteSpace, isSetupComplete, saveSetup } = require('../lib/setup');
const { buildSiteData, listMemories, loadPhotos, loadSite, parseFrontmatter } = require('../lib/content');
const { createMemory } = require('../lib/memory-writer');
const { readLetter, saveLetter } = require('../lib/letter-writer');
const { publicLetter } = require('../lib/letter');

function tempRoot(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lovespace-test-'));
  fs.mkdirSync(path.join(root, 'content', 'memories'), { recursive: true });
  fs.mkdirSync(path.join(root, 'content', 'media', 'photos'), { recursive: true });
  fs.mkdirSync(path.join(root, 'data'), { recursive: true });
  fs.writeFileSync(path.join(root, 'content', 'photos.json'), '[]\n');
  fs.writeFileSync(path.join(root, 'data', 'guestbook.json'), JSON.stringify({ messages: [] }) + '\n');
  t.after(function () { fs.rmSync(root, { recursive: true, force: true }); });
  return root;
}

const profile = {
  me: '林深',
  her: '晚晚',
  anniversary: '2023-05-20',
  birthdayMe: '1998-08-12',
  birthdayHer: '1999-02-14'
};

test('date validation accepts leap day and rejects impossible dates', function () {
  assert.equal(dateOnly('2024-02-29'), '2024-02-29');
  assert.equal(dateOnly('2024-02-30'), '');
  assert.equal(dateOnly('2024-13-01'), '');
});

test('first-run setup saves identity and starts with empty content', function (t) {
  const root = tempRoot(t);
  assert.equal(isSetupComplete(root), false);

  const site = saveSetup(root, profile);
  assert.equal(site.setupComplete, true);
  assert.equal(isSetupComplete(root), true);
  assert.equal(loadSite(root).couple.me, profile.me);
  assert.equal(loadSite(root).couple.birthdays.her, profile.birthdayHer);
  assert.equal(loadPhotos(root).length, 0);
  assert.equal(listMemories(root, []).length, 0);
});

test('memory writer creates a Markdown memory and parseable frontmatter', function (t) {
  const root = tempRoot(t);
  saveSetup(root, profile);

  const created = createMemory(root, {
    date: '2024-01-02',
    title: '第一次一起看雪',
    place: '杭州',
    mood: '开心',
    body: '那天的雪很轻。\n\n我们站在路灯下面。'
  });
  assert.equal(created.title, '第一次一起看雪');
  assert.ok(fs.existsSync(path.join(root, created.file)));

  const memories = listMemories(root, []);
  assert.equal(memories.length, 1);
  assert.equal(memories[0].title, '第一次一起看雪');
  assert.equal(memories[0].paragraphs.length, 2);
});

test('letter writer encrypts public data and keeps the code local', function (t) {
  const root = tempRoot(t);
  saveSetup(root, profile);

  saveLetter(root, {
    code: '1314',
    hint: '我们第一次见面的日子',
    body: '第一段。\n\n第二段。',
    signature: '爱你的我',
    ps: 'P.S. 晚安。'
  });

  const data = buildSiteData(root);
  assert.equal(data.site.letter.encrypted, true);
  assert.equal(data.site.letter.code, undefined);
  assert.equal(data.site.letter.paragraphs, undefined);
  assert.equal(JSON.stringify(data.site.letter).includes('1314'), false);
  assert.equal(JSON.stringify(data.site.letter).includes('第一段'), false);
  assert.equal(readLetter(root).code, '1314');
  assert.equal(readLetter(root).paragraphs.length, 2);
});

test('deleting the space removes config and returns to setup state', function (t) {
  const root = tempRoot(t);
  saveSetup(root, profile);
  createMemory(root, { date: '2024-01-02', title: '要被注销的回忆', body: '正文。' });
  saveLetter(root, { code: '5200', body: '一封信。' });

  deleteSpace(root);
  assert.equal(isSetupComplete(root), false);
  assert.equal(fs.existsSync(path.join(root, 'content', 'site.json')), false);
  assert.equal(listMemories(root, []).length, 0);
  assert.equal(loadPhotos(root).length, 0);
});

test('default site has no demo couple and no default letter', function () {
  const site = createDefaultSite();
  assert.equal(site.setupComplete, false);
  assert.equal(site.couple.me, '');
  assert.equal(site.couple.her, '');
  assert.equal(site.letter.code, '');
  assert.equal(site.letter.paragraphs.length, 0);
  assert.equal(publicLetter(site.letter).encrypted, false);
});

test('frontmatter parser handles quoted strings, lists, and body', function () {
  const parsed = parseFrontmatter('---\ndate: 2024-01-02\ntitle: "看雪"\ntags: ["雪", "冬天"]\n---\n\n正文。');
  assert.equal(parsed.data.title, '看雪');
  assert.deepEqual(parsed.data.tags, ['雪', '冬天']);
  assert.equal(parsed.body, '正文。');
});
