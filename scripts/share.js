'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
const TOOLS = path.join(ROOT, '.tools');
const DOWNLOAD_BASE = 'https://github.com/cloudflare/cloudflared/releases/latest/download/';
const DOWNLOAD_SOURCES = [
  { name: 'GitHub', base: DOWNLOAD_BASE },
  { name: 'ghproxy 镜像', base: 'https://ghproxy.net/' + DOWNLOAD_BASE },
  { name: 'ghfast 镜像', base: 'https://ghfast.top/' + DOWNLOAD_BASE }
];
const URL_FILE = path.join(ROOT, '.share-url.txt');

function usage() {
  console.log('');
  console.log('  用法：npm run share -- [选项]');
  console.log('');
  console.log('  --port <端口>     本地端口，默认 4321');
  console.log('  --no-server       不自动启动本地服务（假设它已经在运行）');
  console.log('  --no-download     不自动下载 cloudflared，只使用系统里已有的');
  console.log('  --no-verify       跳过下载校验（不推荐）');
  console.log('  --protocol <模式>  auto / http2 / quic，默认 auto');
  console.log('  --verbose         显示 cloudflared 的完整输出');
  console.log('  --help            显示这段帮助');
  console.log('');
  console.log('  例：npm run share -- --port 4321');
  console.log('');
}

function parseArgs(argv) {
  const options = {
    port: Number(process.env.PORT) || 4321,
    download: true,
    verify: true,
    server: true,
    protocol: 'auto',
    verbose: false,
    help: false
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--port') {
      const value = Number(argv[++i]);
      if (!Number.isInteger(value) || value < 1 || value > 65535) throw new Error('端口不正确：' + argv[i]);
      options.port = value;
    } else if (arg === '--no-download') options.download = false;
    else if (arg === '--no-verify') options.verify = false;
    else if (arg === '--protocol') {
      const value = argv[++i];
      if (value !== 'auto' && value !== 'http2' && value !== 'quic') throw new Error('--protocol 只能是 auto、http2 或 quic');
      options.protocol = value;
    }
    else if (arg === '--no-server') options.server = false;
    else if (arg === '--verbose') options.verbose = true;
    else throw new Error('未知参数：' + arg);
  }
  return options;
}

function assetInfo() {
  const platform = process.platform;
  const arch = process.arch;
  if (platform === 'win32') {
    if (arch === 'x64') return { asset: 'cloudflared-windows-amd64.exe', binary: 'cloudflared.exe', archive: false };
    if (arch === 'ia32') return { asset: 'cloudflared-windows-386.exe', binary: 'cloudflared.exe', archive: false };
    return null;
  }
  if (platform === 'linux') {
    if (arch === 'x64') return { asset: 'cloudflared-linux-amd64', binary: 'cloudflared', archive: false };
    if (arch === 'arm64') return { asset: 'cloudflared-linux-arm64', binary: 'cloudflared', archive: false };
    if (arch === 'arm') return { asset: 'cloudflared-linux-arm', binary: 'cloudflared', archive: false };
    return null;
  }
  if (platform === 'darwin') {
    if (arch === 'x64') return { asset: 'cloudflared-darwin-amd64.tgz', binary: 'cloudflared', archive: true };
    if (arch === 'arm64') return { asset: 'cloudflared-darwin-arm64.tgz', binary: 'cloudflared', archive: true };
    return null;
  }
  return null;
}

function findOnPath() {
  const candidates = process.platform === 'win32' ? ['cloudflared.exe', 'cloudflared'] : ['cloudflared'];
  for (const name of candidates) {
    const result = spawnSync(name, ['--version'], { stdio: 'ignore' });
    if (result.status === 0) return name;
  }
  return null;
}

function sha256File(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

async function downloadFile(url, file) {
  const response = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error('下载失败 HTTP ' + response.status);
  const buffer = Buffer.from(await response.arrayBuffer());
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, buffer);
}

async function verifyChecksum(asset, file, enabled, checksumUrl) {
  if (!enabled) return;
  try {
    const response = await fetch(checksumUrl, { redirect: 'follow', signal: AbortSignal.timeout(20000) });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const text = await response.text();
    const line = text.split(/\r?\n/).find(function (item) { return item.indexOf(asset) !== -1; });
    if (!line) throw new Error('校验文件里没有找到 ' + asset);
    const expected = line.trim().split(/\s+/)[0].toLowerCase();
    const actual = sha256File(file);
    if (expected !== actual) throw new Error('SHA-256 不匹配');
    console.log('  cloudflared 校验通过。');
  } catch (error) {
    console.warn('  [提示] 暂时无法完成 cloudflared 校验：' + error.message);
    console.warn('  已从 GitHub 通过 HTTPS 下载；如不放心，请改用手动安装。');
  }
}

async function installCloudflared(options) {
  const info = assetInfo();
  if (!info) throw new Error('当前平台暂不支持自动下载，请手动安装 cloudflared。');
  fs.mkdirSync(TOOLS, { recursive: true });
  const binaryPath = path.join(TOOLS, info.binary);
  const archivePath = path.join(TOOLS, info.asset);
  const target = info.archive ? archivePath : binaryPath;
  console.log('  没有找到 cloudflared，正在下载（约 30 MB，只需一次）…');
  const failures = [];
  for (const source of DOWNLOAD_SOURCES) {
    try {
      console.log('  尝试从 ' + source.name + ' 下载…');
      await downloadFile(source.base + info.asset, target);
      await verifyChecksum(info.asset, target, options.verify, source.base + 'cloudflared-checksums.txt');
      if (info.archive) {
        const result = spawnSync('tar', ['-xzf', archivePath, '-C', TOOLS], { stdio: 'inherit' });
        if (result.status !== 0) throw new Error('解压失败');
        fs.rmSync(archivePath, { force: true });
      }
      if (!fs.existsSync(binaryPath)) throw new Error('没有找到可执行文件');
      if (process.platform !== 'win32') fs.chmodSync(binaryPath, 0o755);
      const version = spawnSync(binaryPath, ['--version'], { stdio: 'ignore' });
      if (version.status !== 0) throw new Error('无法运行');
      console.log('  cloudflared 已准备好：' + binaryPath);
      return binaryPath;
    } catch (error) {
      fs.rmSync(target, { force: true });
      fs.rmSync(archivePath, { force: true });
      fs.rmSync(binaryPath, { force: true });
      failures.push(source.name + '：' + error.message);
      console.warn('  ' + source.name + ' 下载失败：' + error.message);
    }
  }
  throw new Error('cloudflared 下载失败。' + failures.join('；'));
}

async function ensureCloudflared(options) {
  if (process.env.CLOUDFLARED_BIN) {
    const configured = path.resolve(process.env.CLOUDFLARED_BIN);
    if (fs.existsSync(configured)) return configured;
    throw new Error('CLOUDFLARED_BIN 指向的文件不存在：' + configured);
  }
  const localName = process.platform === 'win32' ? 'cloudflared.exe' : 'cloudflared';
  const localPath = path.join(TOOLS, localName);
  if (fs.existsSync(localPath)) {
    const localCheck = spawnSync(localPath, ['--version'], { stdio: 'ignore' });
    if (localCheck.status === 0) return localPath;
    fs.rmSync(localPath, { force: true });
  }
  const onPath = findOnPath();
  if (onPath) return onPath;
  if (!options.download) throw new Error('没有找到 cloudflared，而且使用了 --no-download。');
  try {
    return await installCloudflared(options);
  } catch (error) {
    throw new Error('cloudflared 自动安装失败：' + error.message);
  }
}

function commandFor(binary) {
  if (/\.(js|cjs|mjs)$/i.test(binary)) {
    return { command: process.execPath, prefix: [binary] };
  }
  return { command: binary, prefix: [] };
}

async function serverIsUp(port) {
  try {
    const response = await fetch('http://127.0.0.1:' + port + '/api/health', {
      signal: AbortSignal.timeout(1500)
    });
    if (!response.ok) return false;
    const payload = await response.json();
    return Boolean(payload && payload.ok === true);
  } catch (error) {
    return false;
  }
}

async function waitForServer(port, child) {
  const started = Date.now();
  while (Date.now() - started < 15000) {
    if (child && child.exitCode !== null) throw new Error('本地服务启动失败。');
    if (await serverIsUp(port)) return true;
    await new Promise(function (resolve) { setTimeout(resolve, 250); });
  }
  throw new Error('等待本地服务超时。');
}

function parseTunnelUrl(text) {
  const clean = String(text).replace(/\x1b\[[0-9;]*m/g, '');
  const match = clean.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
  return match ? match[0] : null;
}

function copyToClipboard(text) {
  try {
    let command = null;
    let args = [];
    if (process.platform === 'win32') command = 'clip';
    else if (process.platform === 'darwin') command = 'pbcopy';
    else {
      const xclip = spawnSync('xclip', ['-version'], { stdio: 'ignore' });
      if (xclip.status === 0) {
        command = 'xclip';
        args = ['-selection', 'clipboard'];
      }
    }
    if (!command) return;
    const child = spawn(command, args, { stdio: ['pipe', 'ignore', 'ignore'] });
    child.on('error', function () {});
    child.stdin.end(text);
  } catch (error) {
    /* 剪贴板只是锦上添花 */
  }
}

function installHint() {
  console.error('');
  console.error('  npm run share 会自动下载 cloudflared；如果网络拦截了 GitHub 和镜像，请手动安装：');
  console.error('  Windows: winget install --id Cloudflare.cloudflared');
  console.error('  macOS:   brew install cloudflared');
  console.error('  Linux:   https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/');
  console.error('  也可以设置 CLOUDFLARED_BIN 指向已有的 cloudflared。');
  console.error('');
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    usage();
    return;
  }

  let serverChild = null;
  let tunnelChild = null;
  let announced = false;
  let stopping = false;
  let connectedSeen = false;
  let connectionTimer = null;
  let outputTail = '';
  let timer = null;

  const port = options.port;
  const localUrl = 'http://127.0.0.1:' + port;

  function stop(code) {
    if (stopping) return;
    stopping = true;
    if (timer) clearTimeout(timer);
    if (connectionTimer) clearTimeout(connectionTimer);
    if (tunnelChild) tunnelChild.kill('SIGTERM');
    if (serverChild) serverChild.kill('SIGTERM');
    setTimeout(function () { process.exit(code); }, 350);
  }

  function announce(url) {
    if (announced) return;
    announced = true;
    if (timer) clearTimeout(timer);
    fs.writeFileSync(URL_FILE, url + '\n', 'utf8');
    copyToClipboard(url);
    console.log('');
    console.log('  ✦ 公网链接已生成');
    console.log('  ' + url);
    console.log('');
    console.log('  发给她，她点开就能看到。');
    console.log('  保持这个窗口打开，链接才会有效；按 Ctrl+C 停止分享。');
    console.log('');
    console.log('  链接也写入了 .share-url.txt');
    if (connectedSeen) console.log('  隧道已注册连接。');
    console.log('');
    connectionTimer = setTimeout(function () {
      if (!connectedSeen && !stopping) {
        console.warn('  [提示] 链接已经生成，但还没有看到隧道注册连接。');
        console.warn('  如果手机显示 Error 1033，请保持终端打开，并试试：');
        console.warn('  npm run share -- --port 4322 --protocol http2');
        console.warn('');
      }
    }, 15000);
  }

  process.on('SIGINT', function () { stop(0); });
  process.on('SIGTERM', function () { stop(0); });

  try {
    if (!options.server) {
      console.log('  跳过本地服务启动。');
    } else if (await serverIsUp(port)) {
      console.log('  复用已经在运行的本地服务：' + localUrl);
    } else {
      console.log('  正在启动本地服务：' + localUrl);
      serverChild = spawn(process.execPath, [path.join(ROOT, 'server.js')], {
        env: Object.assign({}, process.env, { PORT: String(port) }),
        stdio: 'inherit'
      });
      await waitForServer(port, serverChild);
    }

    const cloudflared = await ensureCloudflared(options);
    const command = commandFor(cloudflared);
    const args = command.prefix.concat(['tunnel', '--url', localUrl, '--no-autoupdate']);
    if (options.protocol !== 'auto') args.push('--protocol', options.protocol);
    console.log('  正在建立 Cloudflare 临时隧道…' + (options.protocol === 'auto' ? '' : '（协议：' + options.protocol + '）'));
    tunnelChild = spawn(command.command, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true
    });

    function onOutput(chunk) {
      const text = chunk.toString();
      const clean = text.replace(/\x1b\[[0-9;]*m/g, '');
      outputTail = (outputTail + text).slice(-16000);
      if (options.verbose) process.stdout.write(text);
      if (/Registered tunnel connection/i.test(clean)) {
        connectedSeen = true;
        if (connectionTimer) clearTimeout(connectionTimer);
        if (announced) console.log('  隧道已注册连接。');
      }
      if (!options.verbose) {
        clean.split(/\r?\n/).forEach(function (line) {
          if (/\bERR\b|failed to|unable to|error/i.test(line)) console.error('  [cloudflared] ' + line.trim());
        });
      }
      const url = parseTunnelUrl(text) || parseTunnelUrl(outputTail);
      if (url) announce(url);
    }

    tunnelChild.stdout.on('data', onOutput);
    tunnelChild.stderr.on('data', onOutput);
    tunnelChild.on('error', function (error) {
      console.error('  cloudflared 启动失败：' + error.message);
      if (error.code === 'ENOENT') installHint();
      stop(1);
    });
    tunnelChild.on('exit', function (code, signal) {
      if (stopping) return;
      console.error('');
      console.error('  cloudflared 已退出（code ' + code + '，signal ' + signal + '）。');
      if (outputTail) {
        console.error('  最后输出：');
        console.error(outputTail.split(/\r?\n/).filter(Boolean).slice(-14).join('\n'));
      }
      console.error('  如果看不出原因，请加 --verbose 重新运行。');
      stop(code || 1);
    });

    timer = setTimeout(function () {
      if (announced) return;
      console.error('  等待公网链接超时。');
      if (outputTail) console.error(outputTail.split(/\r?\n/).slice(-8).join('\n'));
      stop(1);
    }, 90000);
  } catch (error) {
    console.error('  ' + error.message);
    if (/cloudflared|自动安装|--no-download/.test(error.message)) installHint();
    stop(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = { assetInfo, parseArgs, parseTunnelUrl };
