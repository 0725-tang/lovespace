'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { loadSite } = require('./content');

const ITERATIONS = 120000;
const COOKIE = 'lovespace_editor';
const MAX_AGE = 7 * 24 * 60 * 60;

function cleanPassword(value) {
  return String(value || '').slice(0, 64);
}

function hashPassword(password, salt) {
  return crypto.pbkdf2Sync(String(password), Buffer.from(salt, 'base64'), ITERATIONS, 32, 'sha256').toString('base64');
}

function writeSite(root, site) {
  const file = path.join(root, 'content', 'site.json');
  const temp = file + '.tmp';
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(temp, JSON.stringify(site, null, 2) + '\n', 'utf8');
  fs.renameSync(temp, file);
}

function setEditorPassword(root, password) {
  const text = cleanPassword(password);
  if (text.length < 4) throw new Error('管理密码至少 4 个字符。');
  const site = loadSite(root);
  if (!site.setupComplete) {
    const error = new Error('请先创建恋爱空间。');
    error.status = 409;
    throw error;
  }
  const salt = crypto.randomBytes(16).toString('base64');
  site.editor = {
    v: 1,
    salt: salt,
    hash: hashPassword(text, salt),
    iterations: ITERATIONS,
    secret: crypto.randomBytes(32).toString('base64')
  };
  writeSite(root, site);
  return { enabled: true };
}

function hasPassword(site) {
  return Boolean(site && site.editor && site.editor.hash && site.editor.salt && site.editor.secret);
}

function verifyPassword(site, password) {
  if (!hasPassword(site)) return false;
  const actual = Buffer.from(hashPassword(cleanPassword(password), site.editor.salt), 'base64');
  const expected = Buffer.from(site.editor.hash, 'base64');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function sessionValue(site) {
  return crypto.createHmac('sha256', Buffer.from(site.editor.secret, 'base64'))
    .update('lovespace-editor')
    .digest('base64url');
}

function parseCookies(header) {
  const out = {};
  for (const part of String(header || '').split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const key = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

function isEditorSession(req, site) {
  if (!hasPassword(site)) return false;
  const cookie = parseCookies(req.headers.cookie)[COOKIE];
  if (!cookie) return false;
  const actual = Buffer.from(cookie);
  const expected = Buffer.from(sessionValue(site));
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function sessionCookie(req, site) {
  const secure = req.headers['x-forwarded-proto'] === 'https' || Boolean(req.socket.encrypted);
  return COOKIE + '=' + encodeURIComponent(sessionValue(site)) + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=' + MAX_AGE + (secure ? '; Secure' : '');
}

function clearCookie() {
  return COOKIE + '=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0';
}

module.exports = {
  clearCookie,
  hasPassword,
  isEditorSession,
  sessionCookie,
  setEditorPassword,
  verifyPassword
};
