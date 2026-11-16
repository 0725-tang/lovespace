# Markdown 回忆录

把 content/memories/ 里的一篇篇回忆，按时间顺序装订成一本 Markdown 回忆录。

## 生成

~~~bash
npm run memoir
~~~

默认输出：

~~~text
dist/MEMOIR.md
~~~

也可以指定位置：

~~~bash
npm run memoir -- --out 我们的故事.md
~~~

## 会自动生成什么

- 书名、作者、在一起的天数
- 回忆数量、照片数量、城市数量、字数
- 序言
- 带锚点链接的目录
- 按时间正序排列的每一篇回忆
- 日期、地点、天气、心情、金句、正文、标签
- 每篇回忆的封面图引用
- 后记和页脚

目录使用的是显式锚点：

~~~markdown
<a id="memory-2022-05-20-1"></a>

## 2022.05.20 · 在雨里第一次遇见你
~~~

这样在支持 HTML 锚点的 Markdown 阅读器里，点击目录就能跳转。

## 回忆从哪里来

原稿在：

~~~text
content/memories/
~~~

每篇是一个 Markdown 文件，头部是简单的 frontmatter：

~~~markdown
---
date: 2025-01-26
title: 初雪落在你睫毛上
place: 杭州
mood: 温柔
weather: 雪
tags: [初雪, 冬天]
cover: media/photos/first-snow.svg
quote: 你说雪落下来没有声音，可我听了一整晚。
---

正文……
~~~

生成器只读取这些字段；没有的字段会自动跳过。

## 图片路径

MEMOIR.md 里使用相对于项目根目录的图片路径，例如：

~~~markdown
![初雪落在你睫毛上](../content/media/photos/first-snow.svg)
~~~

在项目目录里用 Typora、Obsidian、VS Code 打开，图片就能显示。

如果你要把 MEMOIR.md 单独发给别人，记得把 content/media/ 也一起带上，或者先导出成 PDF。

## 转成 PDF 或 Word

常见方式：

- Typora：打开 MEMOIR.md，导出 PDF
- Obsidian：打开后打印为 PDF
- Pandoc：

~~~bash
pandoc dist/MEMOIR.md -o 我们的故事.pdf
~~~

如果图片路径不对，先在项目根目录运行 pandoc，或者把 MEMOIR.md 放到项目根目录再导出。

## 在网页里新建回忆

不需要打开编辑器写 Markdown。

1. 在项目目录运行 npm start
2. 电脑浏览器打开 http://localhost:4321
3. 滚到“恋爱时间线”
4. 点击“+ 新建回忆”
5. 填日期、标题、地点、心情、天气、标签、金句、正文
6. 选一张已有封面，或者上传一张新照片
7. 保存

保存后会自动生成：

~~~text
content/memories/YYYY-MM-DD-标题.md
~~~

如果上传了新照片，还会生成：

~~~text
content/media/photos/YYYY-MM-DD-标题-cover.jpg
~~~

并自动登记到 content/photos.json，所以照片墙里也会出现。浏览器会先把照片压缩到最长边 1600px，并去掉大部分 EXIF 信息。

页面会刷新，新回忆出现在时间线顶部。再运行 npm run memoir，它也会进入回忆录。

## 删除回忆和照片

### 删除回忆

时间线卡片右上角有一个 ×。确认后会删除对应的 content/memories/*.md。

它用过的封面照片**不会**一起删除，会留在照片墙；需要的话再去照片墙删。

### 管理照片墙

照片墙右上角有“+ 添加照片”。照片只进入照片墙，不会自动新建回忆。

照片右上角的 × 可以删除照片。如果这张照片还是某篇回忆的封面，删除会被拒绝，先换封面或删除那篇回忆。

删除没有回收站，确认框里点取消即可放弃。

这个入口只在电脑本机显示。通过 Cloudflare Tunnel 公网访问时，按钮隐藏，接口返回 403。

## 修改原则

- 想改内容：改 content/memories/ 里的原稿
- 想改书名/序言/后记：改 content/site.json 的 memoir 字段
- 想改排版：改 scripts/memoir.js
- 重新运行 npm run memoir 会覆盖 dist/MEMOIR.md

不要把生成后的 MEMOIR.md 当成唯一原稿；content/memories/ 才是。

## 隐私

回忆录只生成在你自己的项目目录里，不会上传到任何地方。

如果准备发给别人，先检查正文、地点、照片和留言里有没有不想公开的内容。
