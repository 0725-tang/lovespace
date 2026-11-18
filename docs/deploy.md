# 部署指南

LoveSpace 是零依赖 Node.js 应用，需要 Node.js 20+ 和可写磁盘。

个人数据在 content/ 和 data/，部署时必须持久保存。

## 先理解管理权限

写入接口只接受电脑本机请求：新建/删除回忆、上传/删除照片、写情书、初始化、注销。

通过公网域名访问时，这些入口会自动隐藏，接口返回 403。

VPS 上初始化和管理要通过 SSH 隧道在本机完成。

## 方式一：自己的电脑 + Cloudflare Tunnel（推荐）

适合个人使用，不需要服务器，也不需要开路由器端口。

~~~bash
npm start
~~~

第一次打开 http://localhost:4321，完成初始化、照片和情书设置。

分享给对象时另开一个终端：

~~~bash
npm run share
~~~

它会自动下载 cloudflared，并生成临时公网链接。

保持 npm start 和 npm run share 两个窗口打开；关闭终端后链接失效。

管理和初始化都在本机完成，最符合当前权限模型。

## 方式二：VPS + Caddy + systemd

### 安装 Node.js 20

~~~bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
node -v
~~~

### 创建用户和目录

~~~bash
sudo useradd --system --create-home --home-dir /opt/lovespace lovespace
sudo -u lovespace git clone https://github.com/<your-account>/lovespace.git /opt/lovespace
~~~

### 手动测试

~~~bash
cd /opt/lovespace
sudo -u lovespace env HOST=127.0.0.1 PORT=4321 node server.js
~~~

另开终端确认：

~~~bash
curl http://127.0.0.1:4321/api/health
~~~

返回 ok 后按 Ctrl+C 停止。

### systemd

创建 /etc/systemd/system/lovespace.service：

~~~ini
[Unit]
Description=LoveSpace
After=network.target

[Service]
Type=simple
User=lovespace
WorkingDirectory=/opt/lovespace
ExecStart=/usr/bin/node server.js
Environment=HOST=127.0.0.1
Environment=PORT=4321
Restart=always
RestartSec=3
NoNewPrivileges=true
PrivateTmp=true

[Install]
WantedBy=multi-user.target
~~~

启用：

~~~bash
sudo systemctl daemon-reload
sudo systemctl enable --now lovespace
sudo systemctl status lovespace
~~~

### 用 SSH 隧道初始化

不要把 4321 暴露到公网。在自己电脑上运行：

~~~bash
ssh -L 4321:127.0.0.1:4321 deploy@your-server
~~~

保持 SSH 连接，浏览器打开 http://localhost:4321/setup。

请求从服务器回环地址进入，初始化和管理入口可见。完成后关闭隧道。

以后管理照片、回忆或情书，可以再开一次同样的隧道，也可以在本机设置公网管理密码后，通过公网链接登录管理。

### Caddy

编辑 /etc/caddy/Caddyfile：

~~~caddy
love.example.com {
    encode zstd gzip
    reverse_proxy 127.0.0.1:4321
}
~~~

~~~bash
sudo systemctl reload caddy
~~~

Caddy 会自动申请 HTTPS 证书。

没有设置公网管理密码时，通过域名访问的管理接口返回 403，管理需要走 SSH 隧道；设置密码后可以在公网登录管理模式。

防火墙只开放 22、80、443，不要开放 4321。

### 固定 Cloudflare Tunnel

也可以不用 Caddy，改用 Named Tunnel：

~~~bash
cloudflared tunnel login
cloudflared tunnel create lovespace
cloudflared tunnel route dns lovespace love.example.com
cloudflared tunnel run --url http://127.0.0.1:4321 lovespace
~~~

详见 [Cloudflare Tunnel 文档](cloudflare-tunnel.md)。

## 方式三：Render / Fly.io 等平台

可以运行，但不建议新手直接用免费实例：

- 免费实例文件系统可能是临时的
- 重新部署后照片、回忆和留言可能丢失
- 没有 SSH 隧道，初始化和管理的本机入口很难使用
- 必须把 content/ 和 data/ 挂载到持久磁盘

如果使用这类平台，先确认持久磁盘和 SSH/本机回环访问都已经解决。

## 备份

只需要备份：

~~~text
content/
data/
~~~

~~~bash
tar -czf lovespace-backup-$(date +%F).tar.gz content data
~~~

.tools/ 和 dist/ 不是必须备份的数据。

## 更新

~~~bash
cd /opt/lovespace
git pull
sudo systemctl restart lovespace
~~~

更新前先备份 content/ 和 data/。

## 安全边界

公网访客可以浏览页面、看照片和回忆、尝试拆信、留言。

公网访客不能新建/删除回忆、上传/删除照片、写情书、初始化或注销空间。

这是当前版本的安全模型。
