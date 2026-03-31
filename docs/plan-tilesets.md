# Tileset 系统设计方案

## 概述

本文档描述 Mote 引擎的 tileset 系统设计，包括编辑器图集导入、地图导出和游戏渲染的完整流程。

## 目标流程

```
kenney_tiny-town_tilemap.png  ──→  编辑器导入图集（输入图片路径）
                                    ↓ 导出
                              tilesets.json
                              {
                                "image": "/games/.../tilemap.png",
                                "tileSize": 16,
                                "spacing": 1,
                                "tiles": [
                                  { "id": 0, "name": "TILE_0000",
                                    "x": 0, "y": 0, "width": 16, "height": 16 }
                                ]
                              }
                                    ↓
                              地图编辑器绘制
                                    ↓ 导出地图
                              map.json
                              {
                                "name": "level-01",
                                "tileset": "/games/.../tilesets.json",
                                "tiles": [0, 1, 2, ...]
                              }
                                    ↓
                              游戏加载 map.json
                                    ├── 读取 tileset 字段
                                    ├── fetch tilesets.json
                                    ├── 加载对应图片
                                    └── 渲染地图
```

## 支持的 Tileset 格式

### 1. Spritesheet 格式（单张大图）

适用于：tiny-town 等使用统一 tilemap 图片的游戏

```json
{
  "image": "/games/tiny-town/assets/kenney_tiny-town_tilemap.png",
  "tileSize": 16,
  "spacing": 1,
  "tiles": [
    { "id": 0, "name": "TILE_0000", "x": 0, "y": 0, "width": 16, "height": 16 },
    { "id": 1, "name": "TILE_0001", "x": 17, "y": 0, "width": 16, "height": 16 }
  ]
}
```

字段说明：
- `image`: tilemap 图片路径（相对于网站根目录）
- `tileSize`: 默认 tile 大小
- `spacing`: tile 之间的间距（像素）
- `tiles`: 每个 tile 的定义
  - `id`: tile 索引
  - `name`: tile 名称
  - `x`, `y`: 在图片中的位置（像素）
  - `width`, `height`: tile 尺寸（像素）

### 2. 独立图片格式（每个 tile 一张图）

适用于：dungeon 等每个 tile 有独立图片的游戏

```json
{
  "tileSize": 64,
  "tiles": [
    { "id": 0, "name": "VOID", "width": 64, "height": 64, "image": "" },
    { "id": 1, "name": "FLOOR", "width": 64, "height": 64, "image": "/games/dungeon/assets/floor.png" },
    { "id": 2, "name": "WALL", "width": 64, "height": 64, "image": "/games/dungeon/assets/wall.png" }
  ]
}
```

字段说明：
- 没有统一的 `image` 字段
- 每个 tile 有自己的 `image` 字段

## 地图 JSON 格式

```json
{
  "version": 1,
  "name": "level-01",
  "width": 20,
  "height": 15,
  "tileSize": 16,
  "tileset": "/games/tiny-town/assets/kenney_tiny-town_tilesets.json",
  "tiles": [
    0, 0, 1, 1, 2, ...
  ],
  "spawnPoint": { "x": 10, "y": 7 }
}
```

关键字段：
- `tileset`: 关联的 tileset JSON 文件路径
- `tiles`: 一维数组，值为 tile 索引（对应 tileset 中的 `id`）

## 编辑器功能

工具栏分为两组：**🖼 图集** 和 **🗺 地图**

### 🖼 图集操作组

#### 导入图集（Spritesheet 模式）
适用于单张大图包含多个 tile 的情况（如 tiny-town）。

1. 点击"导入图集"
2. 输入图片路径（如 `/games/tiny-town/assets/tilemap.png`）
3. 设置 tile 大小、间距、边距
4. 选择需要的 tiles
5. 确认后生成 tileset 配置

#### 导入精灵（独立图片模式）
适用于每个 tile 是独立图片文件的情况（如 dungeon 有 100+ 个独立 PNG）。

**需求场景**:
```
games/dungeon/assets/kenney_scribble-dungeons/Sprites/
├── arrow.png
├── barrel.png
├── bed.png
├── campfire.png
├── chair.png
├── chest.png
└── ... (共 136 个 PNG 文件)
```

**使用流程**:
1. 点击"导入精灵"
2. 选择模式：
   - **服务器路径模式**：输入文件夹路径（如 `/games/dungeon/assets/kenney_scribble-dungeons/Sprites`）
   - **本地文件夹模式**：选择本地包含 PNG 的文件夹
3. 编辑器自动：
   - 扫描文件夹下所有 PNG 文件
   - 按文件名排序
   - 为每个图片创建一个 tile
   - 自动检测图片尺寸作为 tile 大小
4. 用户可：
   - 预览所有待导入的精灵
   - 勾选/取消选择部分精灵
   - 双击编辑每个 tile 的名称
5. 确认后生成独立图片格式的 tileset 配置

**生成的 tilesets.json**:
```json
{
  "tileSize": 64,
  "tiles": [
    { "id": 0, "name": "arrow", "image": "/games/dungeon/assets/kenney_scribble-dungeons/Sprites/arrow.png", "width": 64, "height": 64 },
    { "id": 1, "name": "barrel", "image": "/games/dungeon/assets/kenney_scribble-dungeons/Sprites/barrel.png", "width": 64, "height": 64 },
    { "id": 2, "name": "bed", "image": "/games/dungeon/assets/kenney_scribble-dungeons/Sprites/bed.png", "width": 64, "height": 64 }
  ]
}
```

#### 导出图集
将当前 tileset 配置导出为 `tilesets.json` 文件，支持两种格式：
- **Spritesheet 格式**：包含统一图片路径和 tiles 坐标
- **独立图片格式**：每个 tile 包含各自的图片路径

### 🗺 地图操作组

#### 新建
创建空白地图，使用当前 tileset 配置。

#### 导入地图
1. 选择 JSON 地图文件
2. 如果地图包含 `tileset` 字段，自动加载对应的 tileset
3. 自动创建 tile 面板，可以直接编辑

#### 导出地图
- **格式**: 只支持 JSON 格式
- 自动包含 `tileset` 字段（从当前 config 读取）
- 支持自定义地图名称

## 导入精灵技术实现

### 方案一：服务器目录索引（推荐用于开发环境）

如果开发服务器支持目录索引，可以通过 API 获取文件夹内容：

```typescript
// 获取文件夹下的所有图片
async function listFolderImages(folderPath: string): Promise<string[]> {
  const response = await fetch(folderPath);
  const html = await response.text();
  // 解析 HTML 中的文件列表
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const links = Array.from(doc.querySelectorAll('a'));
  return links
    .map(a => a.href)
    .filter(href => href.endsWith('.png') || href.endsWith('.jpg'));
}

// 批量创建 tiles
async function importFolderAsTiles(folderPath: string): Promise<TileDef[]> {
  const imageUrls = await listFolderImages(folderPath);
  const tiles: TileDef[] = [];
  
  for (let i = 0; i < imageUrls.length; i++) {
    const url = imageUrls[i];
    const name = url.split('/').pop()?.replace('.png', '') || `tile_${i}`;
    
    // 加载图片获取尺寸
    const img = await loadImage(url);
    
    tiles.push({
      id: i,
      name: name,
      color: '#888888',
      solid: false,
      tilesetImage: url,
      srcX: 0,
      srcY: 0,
      srcW: img.width,
      srcH: img.height,
    });
  }
  
  return tiles;
}
```

### 方案二：本地文件夹选择（用户上传）

使用 File System Access API 或 `webkitdirectory` 属性：

```typescript
// 打开文件夹选择器
async function selectFolder(): Promise<File[]> {
  const input = document.createElement('input');
  input.type = 'file';
  input.webkitdirectory = true; // 允许选择文件夹
  input.directory = true;
  
  return new Promise((resolve) => {
    input.onchange = () => {
      const files = Array.from(input.files || []).filter(f => 
        f.name.endsWith('.png') || f.name.endsWith('.jpg')
      );
      resolve(files);
    };
    input.click();
  });
}

// 处理选中的文件
async function processFolderFiles(files: File[]): Promise<TileDef[]> {
  return files.map((file, i) => {
    const name = file.name.replace('.png', '');
    const url = URL.createObjectURL(file);
    
    return {
      id: i,
      name: name,
      color: '#888888',
      solid: false,
      tilesetImage: url, // 临时 blob URL
      srcX: 0,
      srcY: 0,
      srcW: 64, // 需要实际加载图片获取
      srcH: 64,
    };
  });
}
```

### 方案三：手动输入路径列表

如果服务器不支持目录索引，可以：
1. 用户在终端执行 `ls -1 *.png > files.txt` 生成列表
2. 复制文件列表粘贴到编辑器
3. 编辑器根据基础路径 + 文件名构建完整 URL

```typescript
// 用户粘贴的文件列表
const fileNames = `
  arrow.png
  barrel.png
  bed.png
  ...
`;

// 解析并生成 tiles
function parseFileList(fileNames: string, basePath: string): TileDef[] {
  return fileNames
    .split('\n')
    .map(f => f.trim())
    .filter(f => f.endsWith('.png'))
    .map((name, i) => ({
      id: i,
      name: name.replace('.png', ''),
      color: '#888888',
      solid: false,
      tilesetImage: `${basePath}/${name}`,
      srcX: 0,
      srcY: 0,
      srcW: 64,
      srcH: 64,
    }));
}
```

## 游戏渲染流程

```typescript
// 1. 加载地图
const mapData = await fetch('/games/tiny-town/maps/level-01.json').then(r => r.json());

// 2. 加载 tileset
const tilesetData = await fetch(mapData.tileset).then(r => r.json());

// 3. 判断格式并加载图片
const isSpritesheet = !!tilesetData.image;

if (isSpritesheet) {
  // Spritesheet 格式：一张图 + x/y 坐标
  const atlas = await TextureAtlas.load(gfx, layout, tilesetData.image);
  const regions = tilesetData.tiles.map(tile => ({
    u0: tile.x / imgWidth,
    v0: tile.y / imgHeight,
    u1: (tile.x + tile.width) / imgWidth,
    v1: (tile.y + tile.height) / imgHeight,
    pixelWidth: tile.width,
    pixelHeight: tile.height,
  }));
} else {
  // 独立图片格式：分别加载每个图片并合并
  // ...
}

// 4. 渲染
for (let row = 0; row < mapData.height; row++) {
  for (let col = 0; col < mapData.width; col++) {
    const tileIndex = mapData.tiles[row * mapData.width + col];
    const region = regions[tileIndex];
    batch.drawQuad(x, y, size, size, 0, region, atlas, color);
  }
}
```

## 目录结构示例

### Spritesheet 格式（tiny-town）

```
games/tiny-town/
├── assets/
│   ├── kenney_tiny-town_tilemap.png    # tileset 大图
│   └── kenney_tiny-town_tilesets.json  # tileset 描述（含 x/y 坐标）
├── maps/
│   └── level-01.json                   # 地图文件（引用 tileset）
└── main.ts
```

### 独立图片格式（dungeon）

```
games/dungeon/
├── assets/
│   └── kenney_scribble-dungeons/
│       └── Sprites/                    # 独立精灵文件夹
│           ├── arrow.png
│           ├── barrel.png
│           ├── bed.png
│           ├── campfire.png
│           ├── chair.png
│           ├── chest.png
│           └── ... (共 100+ 个 PNG)
│       └── tilesets.json               # 导入精灵后生成的 tileset 描述
├── maps/
│   └── room-01.json                    # 地图文件
└── main.ts
```

## 实现状态

- [x] 编辑器支持两种 tileset 格式导出
- [x] 编辑器导入图集时输入图片路径（非 base64）
- [x] 地图导出 JSON 格式，包含 tileset 引用
- [x] 编辑器导入地图时自动加载对应 tileset
- [x] 游戏代码支持从 JSON 加载 tileset 并渲染
- [x] 移除 TypeScript 地图导出，只保留 JSON 格式
- [x] 导入精灵功能（独立图片模式）- 适用于 dungeon 等大量独立 PNG 的情况
- [x] 开发服务器支持目录索引，便于扫描文件夹

"tileset": "/games/dungeon/assets/dungeon_tilesets.json", 这个名字有问题。
