---
name: bundle-game
description: 当用户说"打包游戏"、"生成单页"、"bundle"、"打包成html"时触发。将指定游戏打包成单个独立HTML文件，可直接发给朋友使用。
---

# Bundle Game

将游戏的构建产物打包成单个独立 HTML 文件，所有资源（JS、字体、图片）全部内联，可离线运行。

## 用法

```bash
# 打包指定游戏
/skill:bundle-game <game-name>

# 或简单说
打包游戏 breakout
生成单页 snake
bundle dungeon
打包成html tiny-town
```

## 输出

打包后的文件位于项目根目录：
```
{game-name}-standalone.html
```

## 示例

```bash
# 打包贪吃蛇游戏
打包游戏 snake
# 输出: snake-standalone.html (约 1.5MB)

# 打包打砖块游戏
打包游戏 breakout
# 输出: breakout-standalone.html
```

## 技术原理

1. **收集** - 扫描 `dist/games/{game}/` 下的所有 JS 模块
2. **内联** - 将字体、图片等资源转为 Base64 Data URL
3. **Blob URL** - 用 Blob URL 保持 ES Module 作用域隔离
4. **合并** - 生成单个可双击运行的 HTML 文件

## 手动打包

```bash
# 使用底层脚本
node scripts/bundle-html.mjs <game-name> [--out <path>]
```
