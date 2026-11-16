'use strict';

const crypto = require('node:crypto');

const ITERATIONS = 120000;

function sealPayload(payload, code) {
  const salt = crypto.randomBytes(16);
  const iv = crypto.randomBytes(12);
  const key = crypto.pbkdf2Sync(String(code), salt, ITERATIONS, 32, 'sha256');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(payload), 'utf8'),
    cipher.final()
  ]);
  return {
    v: 1,
    alg: 'AES-256-GCM',
    kdf: 'PBKDF2-SHA256',
    iterations: ITERATIONS,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    data: encrypted.toString('base64'),
    tag: cipher.getAuthTag().toString('base64')
  };
}

/**
 * 给前端的数据不包含暗号和明文正文。
 * 密码只是恋爱里的小机关，不是银行级安全；但至少不会在源码里直接看到信。
 */
function publicLetter(letter) {
  if (!letter || typeof letter !== 'object') return letter;
  const out = { ...letter };
  const code = String(letter.code || letter.password || '').trim();
  const payload = {
    paragraphs: Array.isArray(letter.paragraphs) ? letter.paragraphs.map(String) : [],
    signature: String(letter.signature || ''),
    ps: String(letter.ps || '')
  };
  delete out.code;
  delete out.password;
  delete out.paragraphs;
  delete out.signature;
  delete out.ps;
  if (code) {
    out.encrypted = true;
    out.cipher = sealPayload(payload, code);
  } else {
    out.encrypted = false;
  }
  return out;
}

module.exports = { ITERATIONS, publicLetter, sealPayload };
