# 首次初始化

LoveSpace 不再附带演示情侣和演示回忆。第一次运行时，需要先创建你们的空间。

## 第一次打开

~~~bash
npm start
~~~

电脑浏览器打开：

~~~text
http://localhost:4321
~~~

会自动进入：

~~~text
http://localhost:4321/setup
~~~

填写：

- 你的名字
- 恋人的名字
- 你们相爱的日期
- 你的生日
- 恋人的生日

点“创建恋爱空间”。

## 创建后会发生什么

- 生成 content/site.json
- 首页标题、名字、相爱天数、页脚生日立刻变成你们的信息
- 照片墙为空
- 时间线为空
- 留言墙为空
- 情书为空
- 生成文件 content/photos.json（空数组）
- 清空 data/guestbook.json
- 清除旧回忆和 dist/MEMOIR.md

之后再次打开 http://localhost:4321，会直接进入已经创建好的页面，不会重复初始化。

再访问 /setup 会自动跳回首页；直接调用初始化接口会返回 409。

## 为什么只允许本机

初始化会写文件、清空内容，所以只接受电脑本机请求。

通过 Cloudflare Tunnel 公网访问时：

- 未初始化：首页会跳转到 /setup，但 /setup 返回 403
- 已初始化：正常浏览；没有管理密码时没有新建/删除/上传入口

先在本机创建好，再分享公网链接。

如果希望对象在手机公网链接上也能添加照片、回忆和删除留言，请在本机页面底部设置“公网管理密码”。

## 数据保存在哪里

~~~text
content/site.json          你们的名字、日期、生日和文案
content/photos.json        照片墙登记表
content/memories/*.md      回忆
content/media/photos/      照片文件
data/guestbook.json        留言
~~~

这些个人数据已经加入 .gitignore，不会误提交到公开仓库。

公网管理密码的哈希和会话密钥保存在 content/site.json，不会出现在公开数据里。

## 想重新初始化

页面底部有“注销恋爱空间”。点开后需要连续三次确认，才会真正注销。

注销会清空：

- content/site.json 里的名字、日期、生日和配置
- content/photos.json 和 content/media/ 里的照片
- content/memories/ 里的回忆
- data/guestbook.json 里的留言
- dist/MEMOIR.md

完成后回到 /setup，就像第一次打开一样。

注销没有回收站。确认前请自己备份。

如果只是想改名字或生日，不要注销，直接改 content/site.json 里的 couple 字段。

## 情书为什么是空的

初始化不会自动生成情书，所以情书区域显示“情书还没有写”，也不会出现拆信入口。

在电脑本机打开页面，情书区域会出现“写给 TA 的第一封信”。点开填写暗号、提示、正文、署名和 P.S.，保存后就会上锁。

暗号需要输入两次确认。之后本机会出现“编辑这封信”，可以改内容或换暗号。

通过公网访问时，普通访客只能输入暗号拆信；设置并输入管理密码后，也可以写和改。

暗号保存在本机 content/site.json；公开页面只收到加密后的内容。
