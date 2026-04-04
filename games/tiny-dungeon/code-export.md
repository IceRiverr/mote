<!--
================================================================================
CODE EXPORT - Markdown Format
================================================================================
Generated: 2026-04-04T17:10:53.024Z
Total Files: 6
Source Directory: games/tiny-dungeon
================================================================================
-->

# 📦 Code Export

> 导出时间: `2026-04-04T17:10:53.024Z`
> 文件数量: `6` 个
> 源目录: `games/tiny-dungeon`

---

## 📁 文件清单

```
games/tiny-dungeon/
├── assets/
│   ├── level_01.mote.json
│   └── tiny-dungeon_tilemap_packed.mote-tileset.json
├── index.html
├── main.ts
├── package.json
└── vite.config.ts
```

---

## 📋 文件详情

### 快速导航

- [assets/level_01.mote.json](#assets-level-01-mote-json)
- [assets/tiny-dungeon_tilemap_packed.mote-tileset.json](#assets-tiny-dungeon-tilemap-packed-mote-tileset-json)
- [index.html](#index-html)
- [main.ts](#main-ts)
- [package.json](#package-json)
- [vite.config.ts](#vite-config-ts)

---

## 📄 assets/level_01.mote.json

```json
{
  "version": "1.0",
  "type": "mote-tilemap",
  "id": "map_1",
  "name": "level_01",
  "width": 40,
  "height": 30,
  "tileWidth": 16,
  "tileHeight": 16,
  "tilesets": [
    {
      "source": "tiny-dungeon_tilemap_packed.mote-tileset.json",
      "firstGid": 1
    }
  ],
  "layers": [
    {
      "id": "layer_bg",
      "name": "background",
      "type": "tilelayer",
      "visible": true,
      "opacity": 1,
      "locked": false,
      "data": [
        49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49,
        49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49,
        49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49,
        49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49,
        49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49,
        49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 43, 49, 49, 49, 49, 49, 50, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49,
        49, 49, 49, 49, 49, 49, 49, 49, 43, 49, 49, 43, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49,
        49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49,  5,  6, 49, 49, 49, 49,  1,  2,  3,  4, 49, 49, 49, 49, 49, 50, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49,
        49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 17, 18, 49, 49, 49, 49, 13, 14, 15, 16, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49,
        49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 29, 30, 49, 49, 43, 49, 25, 26, 27, 28, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49,
        49, 49, 49, 49, 49, 49, 49, 49, 49, 43, 49, 49, 41, 41, 49, 49, 49, 49, 37, 38, 39, 40, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49,
        49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49,
        49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 61, 49, 49, 49, 42, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49,
        49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49,
        49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49,
        49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49,
        49, 49, 49, 49, 49, 49, 49, 49, 49,  5, 27, 27, 27, 27, 27, 27, 27, 27, 27,  6, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49,
        49, 49, 49, 49, 49, 49, 49, 49, 49, 16,  1,  1,  1,  1,  1,  1,  1, 13,  1, 14, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49,
        49, 49, 49, 49, 49, 49, 49, 49, 49, 16,  1,  1,  1,  1,  1,  1,  1,  1,  1, 14, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49,
        49, 49, 49, 49, 49, 49, 49, 49, 49, 16, 25,  1,  1,  1,  1,  1,  1,  1,  1, 14, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49,
        49, 49, 49, 49, 49, 49, 49, 49, 49, 17,  3,  3,  3,  3,  3,  3,  3,  1,  3, 18, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49,
        49, 49, 49, 49, 49, 49, 49, 49, 49, 15, 15, 15, 15, 15, 15, 15, 15, 40, 15, 15, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49,
        49, 49, 49, 49, 49, 49, 49, 49, 49, 15, 15, 15, 15, 15, 10, 15, 15, 40, 15, 15, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49,
        49, 49, 49, 49, 49, 49, 49, 49, 49, 51, 51, 51, 51, 51, 51, 51, 51, 51, 51, 51, 54, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49,
        49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49,
        49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49,
        49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49,
        49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49,
        49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49,
        49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49, 49
      ]
    },
    {
      "id": "layer_fg",
      "name": "foreground",
      "type": "tilelayer",
      "visible": true,
      "opacity": 1,
      "locked": false,
      "data": [
         0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
         0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
         0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  5, 27, 27, 27, 27, 27,  6,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
         0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, 16,  1,  1,  1,  1,  1, 14,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
         0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, 16,  1,  1,  1, 13,  1, 14,  0,  0,  0,  0, 62,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
         0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, 16,  1,  1,  1,  1,  1, 14,  0,  0,  0, 62, 88, 62,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
         0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, 50,  0,  0,  0,  0, 17,  3,  4,  1,  1,  1, 14,  0,  0,  0,  0, 62,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
         0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, 27,  6,  0, 41, 41, 16,  1,  1,  1, 14,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
         0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  3, 18,  0,  0,  0, 16,  1,  1,  1, 14,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
         0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, 29,  0,  0,  0, 17,  3,  3,  1, 18,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
         0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, 29, 41,  0,  0,  0, 41, 41, 41, 40, 41,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
         0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, 41, 46, 41,  0,  0,  0, 51, 51, 51, 52, 51, 54,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
         0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, 51, 52, 51,  0, 50,  0,  0,  0, 50,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
         0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, 49,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, 74, 43, 73,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
         0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, 43,  0, 74,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
         0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
         0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
         0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, 75,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
         0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0, 50,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
         0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
         0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
         0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
         0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
         0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
         0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
         0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
         0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
         0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
         0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
         0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0
      ]
    }
  ]
}
```

## 📄 assets/tiny-dungeon_tilemap_packed.mote-tileset.json

```json
{
  "version": "1.0",
  "type": "mote-tileset",
  "id": "ts_1",
  "name": "tiny-dungeon_tilemap_packed",
  "image": "tiny-dungeon_tilemap_packed.png",
  "imageWidth": 192,
  "imageHeight": 176,
  "tileWidth": 16,
  "tileHeight": 16,
  "margin": 0,
  "spacing": 0,
  "columns": 12,
  "rows": 11,
  "tileCount": 132
}
```

## 📄 index.html

```html
<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Tiny Dungeon — mote</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    background: #0a0a0f;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    font-family: 'Segoe UI', system-ui, sans-serif;
    color: #e0e0e0;
  }
  canvas {
    border-radius: 8px;
    box-shadow: 0 0 40px rgba(100, 180, 255, 0.15);
    image-rendering: pixelated;
  }
  #status { margin-top: 12px; font-size: 0.8rem; color: #666; }
  #fallback {
    display: none; margin-top: 20px; padding: 20px;
    background: #1a1a2e; border-radius: 8px; border: 1px solid #333;
    max-width: 500px; text-align: center; line-height: 1.6;
  }
</style>
</head>
<body>
  <canvas id="canvas" width="640" height="480"></canvas>
  <div id="status">Initializing WebGPU...</div>
  <div id="fallback">
    <p>⚠️ WebGPU is not available on this device/browser.</p>
    <p style="margin-top:8px; font-size:0.8rem; color:#666;">
      Requires: Chrome 113+ / Edge 113+ / Safari 26+
    </p>
  </div>
  <script type="module" src="./main.ts"></script>
</body>
</html>
```

## 📄 main.ts

```typescript
import { createGfxDevice, SpriteBatch, TextureAtlas, Camera2D, GameLoop, InputManager, ActionMap, ActionType, Vec2, Color } from '@mote/engine';
import type { AtlasRegion } from '@mote/engine';

// ── Tileset Types ─────────────────────────────────────────────────────────────
interface TilesetRef {
  source: string;
  firstGid: number;
}

interface TilesetData {
  version: string;
  type: string;
  id: string;
  name: string;
  image: string;
  imageWidth: number;
  imageHeight: number;
  tileWidth: number;
  tileHeight: number;
  margin: number;
  spacing: number;
  columns: number;
  rows: number;
  tileCount: number;
}

// ── Map Types ─────────────────────────────────────────────────────────────────
interface MapLayer {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  opacity: number;
  locked: boolean;
  data: number[];
}

interface MapData {
  version: string;
  type: string;
  id: string;
  name: string;
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  tilesets: TilesetRef[];
  layers: MapLayer[];
}

interface TileRegion {
  region: AtlasRegion;
  atlas: TextureAtlas;
}

const canvas   = document.getElementById('canvas') as HTMLCanvasElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const fallback = document.getElementById('fallback') as HTMLDivElement;

async function init(): Promise<void> {
  if (!navigator.gpu) {
    statusEl.textContent = 'WebGPU not supported';
    fallback.style.display = 'block';
    return;
  }

  const gfx    = await createGfxDevice(canvas);
  const batch  = new SpriteBatch(gfx);
  const camera = new Camera2D(canvas.width, canvas.height);
  const loop   = new GameLoop(60);

  const input    = new InputManager(canvas);
  const gameplay = new ActionMap('Gameplay', {
    Pan: {
      type: ActionType.Axis2D,
      composites: [
        { up: 'KeyW',    down: 'KeyS',     left: 'KeyA',     right: 'KeyD'        },
        { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
      ],
      gamepadStick: 'Gamepad0_Stick0',
    },
  }, input);
  gameplay.enable();
  input.addMap(gameplay);

  // ── Load map data ────────────────────────────────────────────────────────────
  const mapData = await loadMap('./assets/level_01.mote.json');
  
  // ── Load tileset ─────────────────────────────────────────────────────────────
  const tilesetRef = mapData.tilesets[0];
  const tilesetData = await loadTileset(`./assets/${tilesetRef.source}`);
  
  // Calculate tileset image path (relative to tileset file)
  const tilesetDir = './assets/';
  const tilesetImagePath = tilesetDir + tilesetData.image;
  
  const tileAtlas = await TextureAtlas.load(gfx, batch.getAtlasBindGroupLayout(), tilesetImagePath);
  const regions = createRegionsFromTileset(tilesetData, tileAtlas);

  const TILE_WIDTH = mapData.tileWidth;
  const TILE_HEIGHT = mapData.tileHeight;
  const SCALE = 2; // Scale up for better visibility
  
  // Center camera on map
  camera.position = new Vec2(
    (mapData.width * TILE_WIDTH * SCALE) / 2,
    (mapData.height * TILE_HEIGHT * SCALE) / 2
  );

  const CAM_SPEED = 300;
  statusEl.textContent = 'WebGPU ✓ — Tiny Dungeon — WASD / 方向键 / 左摇杆 平移';

  loop.onUpdate = (dt) => {
    input.update();
    const pan = input.action('Pan').vec2();
    camera.position.x += pan.x * CAM_SPEED * dt;
    camera.position.y += pan.y * CAM_SPEED * dt;
    camera.update(dt);
    input.endFrame();
  };

  loop.onRender = (_alpha) => {
    batch.begin(camera);
    
    // Render all layers
    for (const layer of mapData.layers) {
      if (!layer.visible) continue;
      
      for (let row = 0; row < mapData.height; row++) {
        for (let col = 0; col < mapData.width; col++) {
          const tileGid = layer.data[row * mapData.width + col];
          
          // 0 means empty tile
          if (tileGid === 0) continue;
          
          // Convert GID to local tile index (subtract firstGid)
          const tileIndex = tileGid - tilesetRef.firstGid;
          
          if (tileIndex >= 0 && tileIndex < regions.length) {
            const wx = col * TILE_WIDTH * SCALE + (TILE_WIDTH * SCALE) / 2;
            const wy = row * TILE_HEIGHT * SCALE + (TILE_HEIGHT * SCALE) / 2;
            batch.drawQuad(wx, wy, TILE_WIDTH * SCALE, TILE_HEIGHT * SCALE, 0, regions[tileIndex], tileAtlas, Color.white());
          }
        }
      }
    }
    
    batch.end();
  };

  loop.start();
}

async function loadMap(path: string): Promise<MapData> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load map: ${response.status} ${response.statusText}`);
  }
  return await response.json();
}

async function loadTileset(path: string): Promise<TilesetData> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load tileset: ${response.status} ${response.statusText}`);
  }
  return await response.json();
}

function createRegionsFromTileset(tileset: TilesetData, atlas: TextureAtlas): AtlasRegion[] {
  const imgWidth = atlas.texture.width;
  const imgHeight = atlas.texture.height;

  const regions: AtlasRegion[] = [];

  for (let i = 0; i < tileset.tileCount; i++) {
    const col = i % tileset.columns;
    const row = Math.floor(i / tileset.columns);

    const x = tileset.margin + col * (tileset.tileWidth + tileset.spacing);
    const y = tileset.margin + row * (tileset.tileHeight + tileset.spacing);

    const u0 = x / imgWidth;
    const u1 = (x + tileset.tileWidth) / imgWidth;
    const v0 = (y + tileset.tileHeight) / imgHeight;
    const v1 = y / imgHeight;

    regions.push({
      u0,
      v0,
      u1,
      v1,
      pixelWidth: tileset.tileWidth,
      pixelHeight: tileset.tileHeight,
    });
  }

  return regions;
}

init().catch(err => {
  statusEl.textContent = `Error: ${err.message}`;
  console.error(err);
});
```

## 📄 package.json

```json
{
  "name": "tiny-dungeon",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@mote/engine": "file:../../packages/engine"
  },
  "devDependencies": {
    "vite": "^6.0.0"
  }
}
```

## 📄 vite.config.ts

```typescript
import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@mote/engine': path.resolve(__dirname, '../../packages/engine/src/index.ts'),
    },
  },
  server: {
    port: 5175,
    open: true,
  },
});

```

---

*文件由 export-code skill 自动生成*
