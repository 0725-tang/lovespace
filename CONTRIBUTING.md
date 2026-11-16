# 贡献说明

LoveSpace 是一个零依赖的 Node.js 项目，不需要安装依赖或构建。

## 本地运行

~~~bash
npm start
~~~

打开 http://localhost:4321。

## 测试

~~~bash
npm test
~~~

测试使用系统临时目录，不会修改真实内容。

## 提交前

- 不要提交 content/site.json、照片、回忆和留言
- 这些个人数据已经在 .gitignore 里
- 运行 npm test 并确认通过
- 保持零依赖；新功能优先用 Node 内置模块

## 代码结构

- server.js：HTTP 路由和静态文件
- lib/：内容解析、初始化、情书加密、照片和回忆写入
- web/：页面、样式和交互
- scripts/：分享和回忆录命令
- tests/：零依赖测试

## Pull Request

请说明改了什么、怎么验证，并附上截图（如果涉及页面）。
