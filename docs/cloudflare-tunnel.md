# Cloudflare Tunnel 一键分享

把本地的恋爱网站变成一个临时公网链接，发给她，她点开就能看。

不需要买服务器，不需要域名，也不需要 Cloudflare 账号（临时隧道模式）。

## 一键运行

在项目目录执行：

~~~bash
npm run share
~~~

它会做这些事：

1. 检查 http://127.0.0.1:4321 上的网站是否已经运行；没运行就自动启动。
2. 检查 cloudflared；没有就尝试从 GitHub 下载到 .tools/。
3. 建立 Cloudflare 临时隧道。
4. 解析出 https://xxxx.trycloudflare.com 链接。
5. 打印链接，写入 .share-url.txt，并尝试复制到剪贴板。

保持终端窗口打开，链接才会有效。按 Ctrl+C 停止分享。

## 第一次运行需要下载

cloudflared 大约 30 MB，只会下载一次，缓存在 .tools/。

如果网络无法访问 GitHub，脚本会提示手动安装：

- Windows：winget install --id Cloudflare.cloudflared
- macOS：brew install cloudflared
- Linux：https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/downloads/

也可以手动指定：

~~~bash
CLOUDFLARED_BIN=/path/to/cloudflared npm run share
~~~

## 常用参数

~~~bash
npm run share -- --port 4321
npm run share -- --no-download
npm run share -- --no-server
npm run share -- --verbose
~~~

| 参数 | 作用 |
|---|---|
| --port 4321 | 指定本地端口 |
| --no-server | 不自动启动本地服务，假设它已经在运行 |
| --no-download | 不自动下载 cloudflared |
| --protocol http2 | 强制走 HTTP/2，QUIC 被拦时使用 |
| --verbose | 显示 cloudflared 完整日志 |
| --help | 查看帮助 |

## 安全提醒

临时隧道是公网可访问的，而且没有登录密码。

- 发链接之前，先检查页面上有没有不想公开的照片、文字和留言。
- 留言簿是开放的，拿到链接的人都能留言；服务端只做了频率限制。
- 加密情书的暗号只有四位数字，它防的是“顺手翻源码”，不是专业攻击。
- 分享结束后按 Ctrl+C，或者直接关掉终端。
- 每次重新运行，临时链接都会变；不要把旧链接当成永久地址。

如果只是想自己看，不要运行 npm run share，直接用 npm start。

## 临时链接和固定域名

npm run share 使用的是 Cloudflare Quick Tunnel：

- 免费
- 不需要账号
- 链接随机
- 进程停止就失效
- 不保证长期可用

如果以后想要固定域名，需要 Cloudflare 账号和自定义域名，使用 Named Tunnel。大致流程：

~~~bash
cloudflared tunnel login
cloudflared tunnel create lovespace
cloudflared tunnel route dns lovespace love.example.com
cloudflared tunnel run --url http://127.0.0.1:4321 lovespace
~~~

这一步不在当前一键脚本里，属于进阶配置。

## 常见问题

### 手机显示 Error 1033

Error 1033 的意思是 Cloudflare 找不到一个已经连上的隧道，不是你的网页 404。

- 先确认运行 npm run share 的终端还开着；关掉终端链接就失效。
- 刚生成链接时等 30 到 60 秒，再刷新一次。
- 如果终端没有出现 Registered tunnel connection，通常是网络拦截了 QUIC。
- 用 HTTP/2 重试：

~~~bash
npm run share -- --port 4322 --protocol http2
~~~

脚本在链接生成 15 秒后仍没看到注册连接，会打印提示。

如果命令打印链接后**直接回到命令行提示符**，说明 cloudflared 已经退出，链接必然 1033。新版脚本会在退出时打印最后十几行日志；也可以加 --verbose 重新运行。

### 一直等不到链接

加 --verbose 看 cloudflared 日志：

~~~bash
npm run share -- --verbose
~~~

常见原因是网络无法访问 Cloudflare、公司代理拦截，或者安全软件阻止了 cloudflared。

### 提示 spawn EPERM / 无法启动

通常是 Windows 安全软件、公司策略或终端权限限制。可以：

- 换一个普通终端重试
- 把 cloudflared 加入白名单
- 手动安装后运行 CLOUDFLARED_BIN=... npm run share

### 端口被占用

~~~bash
npm run share -- --port 4322
~~~

### 链接能打开但页面显示旧内容

本项目的 data.js 是实时读取的；刷新页面即可。确认本地 http://127.0.0.1:4321 是最新的。

### 想停止分享

在运行 npm run share 的终端按 Ctrl+C。隧道和它启动的本地服务会一起停止。
