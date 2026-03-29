---
name: bundle-game
description: 当用户说"打包游戏"、"生成单页"、"bundle"、"打包成html"时触发。将游戏打包成单个独立HTML文件，双击即可运行，无需服务器，可直接发给朋友使用。
---

# Bundle Game

将游戏打包成**单个独立的 HTML 文件**，双击即可运行，无需服务器，方便直接发给朋友。

## 前置条件

确保已构建游戏：
```bash
npm run build
# 或构建单个游戏
npm run build:snake
```

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

打包后的文件位于对应游戏目录下：
```
games/{game-name}/{game-name}-standalone.html
```

## 示例

```bash
# 打包到游戏目录（默认）
打包游戏 snake
# 输出: games/snake/snake-standalone.html

# 打包到指定路径
node scripts/bundle-html.mjs breakout --out ./breakout-standalone.html
```

## 使用

生成后双击 HTML 文件即可在浏览器中离线运行，也可直接发送给朋友。
