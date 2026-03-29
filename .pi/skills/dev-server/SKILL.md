---
name: dev-server
description: 当用户说"本地测试"、"打开测试"、"启动开发"、"dev"时触发。启动 Vite 开发服务器并自动打开浏览器。
---

# Dev Server

启动本地开发服务器并自动打开浏览器。

## 用法

```bash
# 启动开发服务器
/skill:dev-server

# 或简单说
本地测试
打开测试
dev
```

## 功能

1. **启动服务器** - 执行 `npm run dev` 启动 Vite 开发服务器
2. **自动打开浏览器** - 自动访问 http://localhost:5173
3. **后台运行** - 服务器在后台持续运行

## 手动操作

```bash
# 启动开发服务器
npm run dev

# 然后手动打开浏览器访问
http://localhost:5173
```

## 端口

- 默认端口: `5173`
- 如果端口被占用，Vite 会自动递增到 `5174`、`5175` 等
