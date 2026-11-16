'use strict';

const fs = require('node:fs');
const path = require('node:path');

const MAX_MESSAGES = 200;

function fileFor(root) {
  return path.join(root, 'data', 'guestbook.json');
}

function readGuestbook(root) {
  try {
    const parsed = JSON.parse(fs.readFileSync(fileFor(root), 'utf8'));
    const items = Array.isArray(parsed) ? parsed : parsed.messages;
    if (!Array.isArray(items)) return [];
    return items.filter((item) => item && typeof item.message === 'string').slice(0, MAX_MESSAGES);
  } catch (error) {
    if (error.code !== 'ENOENT') console.warn('[lovespace] 留言簿读取失败：' + error.message);
    return [];
  }
}

function clean(value, max) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function addMessage(root, input) {
  const name = clean(input && input.name, 24) || '匿名星尘';
  const message = clean(input && input.message, 240);
  if (message.length < 1) throw new Error('留言不能为空');
  const item = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    name,
    message,
    createdAt: new Date().toISOString()
  };
  const messages = [item, ...readGuestbook(root)].slice(0, MAX_MESSAGES);
  const file = fileFor(root);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = file + '.tmp';
  fs.writeFileSync(temp, JSON.stringify({ messages }, null, 2) + '\n', 'utf8');
  fs.renameSync(temp, file);
  return item;
}

module.exports = { MAX_MESSAGES, addMessage, readGuestbook, clean };
