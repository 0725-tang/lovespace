'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { loadSite } = require('./content');
const { publicLetter } = require('./letter');

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

function splitParagraphs(body) {
  return cleanBody(body).split(/\n\s*\n/).map(function (part) { return part.trim(); }).filter(Boolean).slice(0, 40);
}

function readSite(root) {
  return loadSite(root);
}

function readLetter(root) {
  const site = readSite(root);
  const letter = site.letter || {};
  if (!letter.code) return null;
  return {
    code: String(letter.code || ''),
    hint: String(letter.hint || ''),
    paragraphs: Array.isArray(letter.paragraphs) ? letter.paragraphs.map(String) : [],
    signature: String(letter.signature || ''),
    ps: String(letter.ps || '')
  };
}

function saveLetter(root, input) {
  const site = readSite(root);
  if (!site.setupComplete) {
    const error = new Error('请先创建恋爱空间。');
    error.status = 409;
    throw error;
  }

  const code = clean(input && input.code, 12);
  if (!code) throw new Error('请设置一个拆信暗号。');
  if (code.length < 2) throw new Error('暗号至少 2 个字符。');
  const paragraphs = splitParagraphs(input && input.body);
  if (!paragraphs.length) throw new Error('情书正文不能为空。');

  const signature = clean(input && input.signature, 40);
  const ps = clean(input && input.ps, 300);
  const hint = clean(input && input.hint, 160) || '只有你们知道的暗号。';

  site.letter = {
    ...(site.letter || {}),
    code: code,
    hint: hint,
    paragraphs: paragraphs,
    signature: signature,
    ps: ps
  };
  delete site.letter.encrypted;
  delete site.letter.cipher;

  const file = path.join(root, 'content', 'site.json');
  const temp = file + '.tmp';
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(temp, JSON.stringify(site, null, 2) + '\n', 'utf8');
  fs.renameSync(temp, file);
  return publicLetter(site.letter);
}

module.exports = { readLetter, saveLetter, splitParagraphs };
