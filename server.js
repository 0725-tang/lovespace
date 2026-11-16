'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { URL } = require('node:url');
const { aiConfig, generateReply } = require('./lib/assistant');
const { buildSiteData } = require('./lib/content');
const { addMessage, readGuestbook } = require('./lib/guestbook');
const { createMemory, createPhoto, deleteMemory, deletePhoto } = require('./lib/memory-writer');
const { deleteSpace, isSetupComplete, saveSetup } = require('./lib/setup');
const { readLetter, saveLetter } = require('./lib/letter-writer');

const ROOT = __dirname;
const WEB_ROOT = path.join(ROOT, 'web');
const MEDIA_ROOT = path.join(ROOT, 'content', 'media');
const DEFAULT_PORT = Number(process.env.PORT || 4321);
const DEFAULT_HOST = process.env.HOST || '127.0.0.1';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/markdown; charset=utf-8'
};

function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
}

function send(res, status, body, headers = {}) {
  const payload = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  securityHeaders(res);
  res.writeHead(status, {
    'Content-Type': 'text/plain; charset=utf-8',
    'Content-Length': payload.length,
    ...headers
  });
  if (res.req && res.req.method === 'HEAD') res.end();
  else res.end(payload);
}

function sendJson(res, status, payload) {
  send(res, status, JSON.stringify(payload), { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
}

function redirect(res, location) {
  res.writeHead(302, { Location: location, 'Cache-Control': 'no-store' });
  res.end();
}

function safeJoin(base, relative) {
  const normalized = String(relative || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const root = path.resolve(base);
  const target = path.resolve(root, normalized);
  if (target !== root && !target.startsWith(root + path.sep)) return null;
  return target;
}

function serveFile(req, res, file, options = {}) {
  let stat;
  try {
    stat = fs.statSync(file);
  } catch (error) {
    return sendJson(res, 404, { error: 'not_found', message: '找不到这个文件' });
  }
  if (!stat.isFile()) return sendJson(res, 404, { error: 'not_found', message: '找不到这个文件' });
  const ext = path.extname(file).toLowerCase();
  securityHeaders(res);
  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': options.cache || 'no-cache',
    'Last-Modified': stat.mtime.toUTCString()
  });
  if (req.method === 'HEAD') return res.end();
  const stream = fs.createReadStream(file);
  stream.on('error', () => {
    if (!res.headersSent) sendJson(res, 500, { error: 'read_failed' });
    else res.destroy();
  });
  stream.pipe(res);
}

function readBody(req, limit = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error('请求体太大'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function createRateLimiter(limit, windowMs) {
  const buckets = new Map();
  return function allow(key) {
    const now = Date.now();
    const recent = (buckets.get(key) || []).filter((time) => now - time < windowMs);
    if (recent.length >= limit) {
      buckets.set(key, recent);
      return false;
    }
    recent.push(now);
    buckets.set(key, recent);
    if (buckets.size > 2000) {
      for (const [bucketKey, times] of buckets) {
        if (!times.some((time) => now - time < windowMs)) buckets.delete(bucketKey);
      }
    }
    return true;
  };
}

function isLocalEditor(req) {
  if (req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for']) return false;
  const address = String(req.socket.remoteAddress || '').replace(/^::ffff:/, '');
  return address === '127.0.0.1' || address === '::1';
}

function clientIp(req) {
  const forwarded = req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'];
  return String(forwarded || req.socket.remoteAddress || 'unknown').split(',')[0].trim();
}

function createHandler(root = ROOT) {
  const webRoot = path.join(root, 'web');
  const mediaRoot = path.join(root, 'content', 'media');
  const guestbookLimit = createRateLimiter(5, 60 * 1000);
  const assistantLimit = createRateLimiter(20, 60 * 1000);

  return async function handler(req, res) {
    let pathname;
    let requestUrl;
    try {
      requestUrl = new URL(req.url, 'http://localhost');
      pathname = decodeURIComponent(requestUrl.pathname);
    } catch (error) {
      return sendJson(res, 400, { error: 'bad_url', message: '链接格式不正确' });
    }

    if (req.method === 'GET' && pathname === '/') {
      if (!isSetupComplete(root)) return redirect(res, '/setup');
      return serveFile(req, res, path.join(webRoot, 'index.html'), { cache: 'no-cache' });
    }

    if (req.method === 'GET' && (pathname === '/setup' || pathname === '/setup.html')) {
      if (!isLocalEditor(req)) return send(res, 403, '初始化只能在电脑本机完成。');
      if (isSetupComplete(root)) return redirect(res, '/');
      return serveFile(req, res, path.join(webRoot, 'setup.html'), { cache: 'no-cache' });
    }

    if (pathname === '/api/setup' && req.method === 'POST') {
      if (!isLocalEditor(req)) return sendJson(res, 403, { error: 'local_only', message: '初始化只能在电脑本机完成。' });
      if (isSetupComplete(root)) return sendJson(res, 409, { error: 'already_setup', message: '恋爱空间已经创建过了。' });
      let body;
      try {
        body = JSON.parse((await readBody(req, 64 * 1024)) || '{}');
      } catch (error) {
        return sendJson(res, error.status || 400, { error: 'bad_json', message: '初始化信息格式不正确' });
      }
      try {
        const site = saveSetup(root, body);
        return sendJson(res, 201, { ok: true, redirect: '/', couple: site.couple });
      } catch (error) {
        return sendJson(res, error.status || 400, { error: 'setup_failed', message: error.message });
      }
    }

    if (pathname === '/api/setup' && req.method === 'DELETE') {
      if (!isLocalEditor(req)) return sendJson(res, 403, { error: 'local_only', message: '注销只能在电脑本机完成。' });
      try {
        deleteSpace(root);
        return sendJson(res, 200, { ok: true, redirect: '/setup' });
      } catch (error) {
        return sendJson(res, error.status || 400, { error: 'delete_space_failed', message: error.message });
      }
    }

    if (pathname === '/api/setup') {
      return sendJson(res, 405, { error: 'method_not_allowed' });
    }

    if (req.method === 'GET' && pathname === '/data.js') {
      try {
        const data = buildSiteData(root, { mode: 'live', guestbook: readGuestbook(root).slice(0, 20) });
        data.canEdit = isLocalEditor(req);
        return send(res, 200, 'window.LOVESPACE_DATA = ' + JSON.stringify(data).replace(/</g, '\\u003c') + ';\n', {
          'Content-Type': 'text/javascript; charset=utf-8',
          'Cache-Control': 'no-store'
        });
      } catch (error) {
        return send(res, 500, 'window.LOVESPACE_ERROR = ' + JSON.stringify({ message: error.message }) + ';\n', {
          'Content-Type': 'text/javascript; charset=utf-8',
          'Cache-Control': 'no-store'
        });
      }
    }

    if (pathname === '/api/health' && req.method === 'GET') {
      try {
        const data = buildSiteData(root);
        const config = aiConfig();
        return sendJson(res, 200, {
          ok: true,
          name: data.site.siteName,
          photos: data.stats.photos,
          memories: data.stats.memories,
          assistant: { enabled: data.site.assistant.enabled, remote: Boolean(config.endpoint && config.apiKey) }
        });
      } catch (error) {
        return sendJson(res, 500, { ok: false, error: 'content_error', message: error.message });
      }
    }

    if (pathname === '/api/memories' && req.method === 'POST') {
      if (!isLocalEditor(req)) {
        return sendJson(res, 403, { error: 'local_only', message: '为了安全，新建回忆只能在电脑本机打开时使用。' });
      }
      let body;
      try {
        body = JSON.parse((await readBody(req, 16 * 1024 * 1024)) || '{}');
      } catch (error) {
        return sendJson(res, error.status || 400, { error: 'bad_json', message: '回忆格式不正确' });
      }
      try {
        const created = createMemory(root, body);
        return sendJson(res, 201, { ok: true, memory: created });
      } catch (error) {
        return sendJson(res, error.status || 400, { error: 'invalid_memory', message: error.message });
      }
    }

    if (pathname === '/api/memories' && req.method === 'DELETE') {
      if (!isLocalEditor(req)) {
        return sendJson(res, 403, { error: 'local_only', message: '删除回忆只能在电脑本机操作。' });
      }
      try {
        const removed = deleteMemory(root, requestUrl.searchParams.get('slug'));
        return sendJson(res, 200, { ok: true, removed: removed });
      } catch (error) {
        return sendJson(res, error.status || 400, { error: 'delete_failed', message: error.message });
      }
    }

    if (pathname === '/api/memories') {
      return sendJson(res, 405, { error: 'method_not_allowed' });
    }

    if (pathname === '/api/photos' && req.method === 'POST') {
      if (!isLocalEditor(req)) {
        return sendJson(res, 403, { error: 'local_only', message: '上传照片只能在电脑本机操作。' });
      }
      let body;
      try {
        body = JSON.parse((await readBody(req, 16 * 1024 * 1024)) || '{}');
      } catch (error) {
        return sendJson(res, error.status || 400, { error: 'bad_json', message: '照片信息格式不正确' });
      }
      try {
        const photo = createPhoto(root, body);
        return sendJson(res, 201, { ok: true, photo: photo });
      } catch (error) {
        return sendJson(res, error.status || 400, { error: 'invalid_photo', message: error.message });
      }
    }

    if (pathname === '/api/photos' && req.method === 'DELETE') {
      if (!isLocalEditor(req)) {
        return sendJson(res, 403, { error: 'local_only', message: '删除照片只能在电脑本机操作。' });
      }
      try {
        const removed = deletePhoto(root, requestUrl.searchParams.get('file'));
        return sendJson(res, 200, { ok: true, removed: removed });
      } catch (error) {
        return sendJson(res, error.status || 400, { error: 'delete_failed', message: error.message });
      }
    }

    if (pathname === '/api/photos') {
      return sendJson(res, 405, { error: 'method_not_allowed' });
    }

    if (pathname === '/api/letter' && req.method === 'GET') {
      if (!isLocalEditor(req)) {
        return sendJson(res, 403, { error: 'local_only', message: '写信和改信只能在电脑本机操作。' });
      }
      try {
        return sendJson(res, 200, { ok: true, letter: readLetter(root) });
      } catch (error) {
        return sendJson(res, error.status || 500, { error: 'letter_error', message: error.message });
      }
    }

    if (pathname === '/api/letter' && req.method === 'POST') {
      if (!isLocalEditor(req)) {
        return sendJson(res, 403, { error: 'local_only', message: '写信和改信只能在电脑本机操作。' });
      }
      let body;
      try {
        body = JSON.parse((await readBody(req, 64 * 1024)) || '{}');
      } catch (error) {
        return sendJson(res, error.status || 400, { error: 'bad_json', message: '情书格式不正确' });
      }
      try {
        const letter = saveLetter(root, body);
        return sendJson(res, 201, { ok: true, letter: letter });
      } catch (error) {
        return sendJson(res, error.status || 400, { error: 'letter_failed', message: error.message });
      }
    }

    if (pathname === '/api/letter') {
      return sendJson(res, 405, { error: 'method_not_allowed' });
    }

    if (pathname === '/api/guestbook') {
      if (!buildSiteData(root).site.guestbook.enabled) {
        return sendJson(res, 403, { error: 'guestbook_disabled', message: '留言簿已关闭' });
      }
      if (req.method === 'GET') {
        return sendJson(res, 200, { messages: readGuestbook(root).slice(0, 50) });
      }
      if (req.method === 'POST') {
        if (!guestbookLimit(clientIp(req))) return sendJson(res, 429, { error: 'rate_limited', message: '慢一点，星星也要喘口气' });
        let body;
        try {
          body = JSON.parse((await readBody(req, 16 * 1024)) || '{}');
        } catch (error) {
          return sendJson(res, error.status || 400, { error: 'bad_json', message: '留言格式不正确' });
        }
        try {
          const message = addMessage(root, body);
          return sendJson(res, 201, { ok: true, message });
        } catch (error) {
          return sendJson(res, 400, { error: 'invalid_message', message: error.message });
        }
      }
      return sendJson(res, 405, { error: 'method_not_allowed' });
    }

    if (pathname === '/api/assistant' && req.method === 'POST') {
      if (!assistantLimit(clientIp(req))) return sendJson(res, 429, { error: 'rate_limited', message: '小星需要休息一下，晚点再聊' });
      let body;
      try {
        body = JSON.parse((await readBody(req, 64 * 1024)) || '{}');
      } catch (error) {
        return sendJson(res, error.status || 400, { error: 'bad_json', message: '消息格式不正确' });
      }
      try {
        const data = buildSiteData(root);
        if (!data.site.assistant.enabled) return sendJson(res, 403, { error: 'assistant_disabled', message: '小助手已关闭' });
        const result = await generateReply(body.messages, data);
        return sendJson(res, 200, result);
      } catch (error) {
        return sendJson(res, 500, { error: 'assistant_error', message: error.message });
      }
    }

    if (pathname.startsWith('/media/') && (req.method === 'GET' || req.method === 'HEAD')) {
      const file = safeJoin(mediaRoot, pathname.slice('/media/'.length));
      if (!file) return sendJson(res, 400, { error: 'bad_path' });
      return serveFile(req, res, file, { cache: 'public, max-age=86400' });
    }

    if ((req.method === 'GET' || req.method === 'HEAD') && pathname !== '/') {
      const file = safeJoin(webRoot, pathname);
      if (file && fs.existsSync(file)) return serveFile(req, res, file, { cache: 'no-cache' });
    }

    return sendJson(res, 404, { error: 'not_found', message: '这里的宇宙还没有被点亮' });
  };
}

async function startServer(options = {}) {
  const port = options.port === undefined ? DEFAULT_PORT : options.port;
  const host = options.host || DEFAULT_HOST;
  const root = options.root || ROOT;
  const server = http.createServer((req, res) => {
    createHandler(root)(req, res).catch((error) => {
      if (!res.headersSent) sendJson(res, 500, { error: 'internal_error', message: error.message });
      else res.destroy();
    });
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.removeListener('error', reject);
      resolve();
    });
  });
  return server;
}

if (require.main === module) {
  startServer()
    .then((server) => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : DEFAULT_PORT;
      let data = null;
      try {
        data = buildSiteData(ROOT);
      } catch (error) {
        console.error('[lovespace] 内容读取失败：' + error.message);
      }
      console.log('');
      console.log('  LoveSpace  ·  你们的恋爱宇宙');
      console.log('  本地地址   http://localhost:' + port);
      console.log('  照片 / 回忆  ' + (data ? data.stats.photos + ' / ' + data.stats.memories : '内容待检查'));
      console.log('  公网惊喜   npm run share');
      console.log('');
      console.log('  按 Ctrl+C 停止。');
    })
    .catch((error) => {
      if (error.code === 'EADDRINUSE') {
        console.error('[lovespace] 端口 ' + DEFAULT_PORT + ' 已被占用，可以运行 PORT=4322 npm start');
      } else {
        console.error('[lovespace] 启动失败：' + error.message);
      }
      process.exitCode = 1;
    });
}

module.exports = { createHandler, safeJoin, startServer };
