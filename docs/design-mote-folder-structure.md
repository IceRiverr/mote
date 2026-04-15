# 微尘引擎 — 项目文件结构设计规范

版本：1.0.0 | 日期：2026-04-15

---

## 1. 概述

本文档定义了微尘（Mote）游戏引擎的项目文件组织结构、资源路径解析规则和命名约定。设计目标是提供一套简洁、统一、无特例的文件系统方案，适用于从 Game Jam 小项目到大型 2D 游戏的全场景。

### 1.1 设计原则

- **单一规则，零特例**：所有资源路径使用同一套解析逻辑，不存在任何资源类型享有特殊路径规则
- **引擎不关心目录结构**：引擎只认路径和扩展名，目录组织完全由用户自由决定
- **扩展名即类型**：资源类型由文件扩展名标识，不由所在目录决定
- **轻量优先**：参考 Godot 的轻量路径模型，不引入 GUID、.meta 文件等重型机制

### 1.2 与主流引擎对比

微尘的设计在主流引擎的光谱中偏轻量一侧，最接近 Godot 的资源系统：

| 维度 | UE | Unity | Godot | 微尘 |
|------|-----|-------|-------|------|
| 资源根目录 | Content/ | Assets/ | res:// | assets/ |
| 引用方式 | /Game/... 路径 | GUID | res://... 路径 | 裸相对路径 |
| 目录约束 | 无 | 有魔法目录 | 无 | 无 |
| 类型识别 | .uasset + 元数据 | .meta + 扩展名 | 扩展名 + .import | 扩展名 |
| 资源注册 | Asset Registry | GUID 映射 | .import 缓存 | 预留 manifest |

---

## 2. 项目目录结构

### 2.1 顶层结构（固定）

项目根目录包含三个固定元素：

```
games/{project-name}/
├── project.json          # 项目定义文件（必须）
├── assets/               # 资源目录（名称可配置）
└── src/                  # TypeScript 源码目录（名称可配置）
```

- **project.json**：项目入口，定义元信息和关键配置
- **assets/**：所有游戏资源的根目录，类似 UE 的 Content/
- **src/**：TypeScript 源码目录，编译后产物放入 dist/

### 2.2 assets/ 内部结构（自由）

引擎**不强制** assets/ 内的任何目录结构。以下均为合法项目：

**小型项目 — 全部平铺：**

```
assets/
├── hero.mote-sprite.json
├── hero.png
├── enemy.mote-sprite.json
├── enemy.png
├── main.mote-scene.json
└── player.mote-prefab.json
```

**中型项目 — 按资源类型分组：**

```
assets/
├── sprites/
├── prefabs/
├── scenes/
└── audio/
```

**大型项目 — 按功能模块分层：**

```
assets/
├── characters/
│   ├── sprites/
│   └── prefabs/
├── environment/
│   ├── sprites/
│   └── prefabs/
├── ui/
└── scenes/
```

引擎对以上三种组织方式的处理逻辑**完全一致**——均通过相对路径 + 扩展名解析。

### 2.3 src/ 目录结构（自由）

src/ 内部结构同样不做强制，推荐结构如下：

```
src/
├── main.ts              # 入口脚本
├── components/          # ECS 组件
└── systems/             # ECS 系统
```

---

## 3. 路径解析规则

### 3.1 核心规则

全引擎唯一的路径解析规则：

> **所有 JSON 资源文件中的路径引用，一律相对于 assets/ 目录解析。没有例外。**

引擎只需一个路径解析函数：

```typescript
function resolveAssetPath(ref: string): string {
  if (ref.startsWith('/') || ref.startsWith('..') || ref.includes('\\')) {
    throw new Error(`Invalid asset reference: "${ref}"`);
  }
  return posixJoin(assetsRoot, ref);
}
```

### 3.2 路径格式约束

所有资源路径必须满足以下条件：

| 约束 | 说明 | 正确示例 | 错误示例 |
|------|------|---------|---------|
| POSIX 正斜杠 | 统一使用 / 作为分隔符 | sprites/hero.png | sprites\hero.png |
| 禁止 ../ | 不允许跳出 assets 目录 | sprites/hero.png | ../other/hero.png |
| 禁止绝对路径 | 不允许以 / 开头 | sprites/hero.png | /sprites/hero.png |
| 禁止 assets/ 前缀 | 路径已经是相对于 assets/ 的 | sprites/hero.png | assets/sprites/hero.png |
| 禁止盘符前缀 | 不允许 Windows 盘符 | sprites/hero.png | C:/sprites/hero.png |

### 3.3 路径解析示例

加载一个 Prefab 的完整流程（假设 assetsRoot = "games/aa/assets"）：

```
步骤 1：加载 Prefab
  引用: "prefabs/ground-tile.mote-prefab.json"
  解析: resolveAssetPath("prefabs/ground-tile.mote-prefab.json")
  结果: games/aa/assets/prefabs/ground-tile.mote-prefab.json

步骤 2：加载 Sprite Atlas（从 Prefab 中读取 atlas 字段）
  引用: "sprites/tilemap.mote-sprite.json"
  解析: resolveAssetPath("sprites/tilemap.mote-sprite.json")
  结果: games/aa/assets/sprites/tilemap.mote-sprite.json

步骤 3：加载图片（从 Sprite Atlas 中读取 image 字段）
  引用: "sprites/tilemap.png"
  解析: resolveAssetPath("sprites/tilemap.png")
  结果: games/aa/assets/sprites/tilemap.png
```

> **注意**：步骤 3 中 image 字段**同样**相对 assets/ 解析，不做"相对于所在 JSON 文件"的特殊处理。所有步骤调用同一个函数。

---

## 4. 文件命名约定

### 4.1 引擎资源文件扩展名

引擎通过扩展名识别资源类型并选择对应的 Loader：

| 扩展名 | 资源类型 | 说明 |
|--------|---------|------|
| `.mote-sprite.json` | Sprite Atlas | 精灵图集定义 |
| `.mote-prefab.json` | Prefab | 预制体定义 |
| `.mote-scene.json` | Scene | 场景定义 |
| `.mote-tilemap.json` | Tilemap | 瓦片地图定义 |
| `.png` / `.webp` / `.jpg` | Image | 图片资源 |
| `.mp3` / `.ogg` / `.wav` | Audio | 音频资源 |

统一命名模式为 `.mote-{type}.json`，好处包括：

- `glob("**/*.mote-*.json")` 一条命令即可找出所有引擎资源
- 编辑器可根据扩展名自动选择打开方式
- 与普通 JSON 配置文件（tsconfig.json 等）天然区分

### 4.2 Loader 分发逻辑

```typescript
function getLoader(path: string): AssetLoader {
  if (path.endsWith('.mote-sprite.json'))  return spriteLoader;
  if (path.endsWith('.mote-prefab.json'))  return prefabLoader;
  if (path.endsWith('.mote-scene.json'))   return sceneLoader;
  if (path.endsWith('.mote-tilemap.json')) return tilemapLoader;
  if (/\.(png|webp|jpg)$/.test(path))     return imageLoader;
  if (/\.(mp3|ogg|wav)$/.test(path))      return audioLoader;
  throw new Error(`Unknown asset type: "${path}"`);
}
```

---

## 5. 核心文件格式

### 5.1 project.json

项目定义文件，位于游戏根目录，是引擎加载项目的唯一入口。

```json
{
  "id": "tiny-dungeon",
  "name": "Tiny Dungeon",
  "version": "1.0.0",
  "assetsDir": "assets",
  "srcDir": "src",
  "entryScene": "scenes/main.mote-scene.json",
  "entryScript": "main.ts"
}
```

字段说明：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | string | 项目唯一标识 |
| name | string | 项目显示名称 |
| version | string | 语义化版本号 |
| assetsDir | string | 资源目录名，相对于项目根 |
| srcDir | string | 源码目录名，相对于项目根 |
| entryScene | string | 入口场景，相对于 assetsDir |
| entryScript | string | 入口脚本，相对于 srcDir |

**关键设计**：entryScene 相对 assetsDir 解析，entryScript 相对 srcDir 解析。如果将来重命名 assets/ 为 content/，只需修改 assetsDir 字段，所有资源引用不受影响。

### 5.2 Scene（.mote-scene.json）

```json
{
  "id": "main-scene",
  "name": "Main Scene",
  "entities": [
    {
      "prefab": "prefabs/environment/ground-tile.mote-prefab.json",
      "overrides": {
        "Transform": { "x": 100, "y": 200 }
      }
    }
  ]
}
```

### 5.3 Prefab（.mote-prefab.json）

```json
{
  "id": "ground_tile",
  "name": "Ground Tile",
  "components": {
    "Transform": { "x": 0, "y": 0, "rotation": 0, "scaleX": 1, "scaleY": 1 },
    "Sprite": {
      "atlas": "sprites/tiny-dungeon_tilemap_packed.mote-sprite.json",
      "frame": "frame_100",
      "layer": 0
    }
  }
}
```

### 5.4 Sprite Atlas（.mote-sprite.json）

```json
{
  "id": "sheet_tiny_dungeon",
  "image": "sprites/tiny-dungeon_tilemap_packed.png",
  "frameWidth": 16,
  "frameHeight": 16,
  "frames": {
    "frame_0":   { "x": 0,  "y": 0,  "w": 16, "h": 16 },
    "frame_100": { "x": 0,  "y": 96, "w": 16, "h": 16 }
  }
}
```

> **注意**：image 字段遵循统一路径规则，相对 assets/ 解析，不做 sibling-relative 特殊处理。这是"单一规则，零特例"原则的直接体现。

---

## 6. 未来扩展：Asset Manifest

当前设计预留了 Asset Manifest 的位置，用于未来支持依赖追踪、增量打包和并行加载。

### 6.1 预留位置

```
assets/
├── .manifest.json        # 自动生成，不手动编辑
├── sprites/
├── prefabs/
└── ...
```

### 6.2 预期格式

```json
{
  "version": 1,
  "assets": {
    "sprites/tilemap.mote-sprite.json": {
      "type": "sprite",
      "deps": ["sprites/tilemap.png"],
      "hash": "a3f2c1..."
    },
    "prefabs/ground-tile.mote-prefab.json": {
      "type": "prefab",
      "deps": ["sprites/tilemap.mote-sprite.json"]
    }
  }
}
```

### 6.3 Manifest 带来的能力

| 能力 | 说明 |
|------|------|
| 依赖图 | 知道删除或修改一个资源会影响哪些其他资源 |
| 增量打包 | 只打包 hash 变化的资源 |
| 并行预加载 | 加载场景前根据依赖树批量 fetch，避免瀑布式串行请求 |
| 缓存失效 | 用 hash 做 cache-busting，部署 CDN 无需手动清缓存 |
| 重命名检测 | 未来编辑器支持安全重命名/移动文件 |

### 6.4 加载流程优化对比

**无 manifest（当前）**：3 次串行 RTT

```
fetch prefab → 解析 → fetch sprite → 解析 → fetch png → 组装
```

**有 manifest（未来）**：1 次查表 + 1 次并行 RTT

```
查 manifest → 收集所有 deps → 并行 fetch [prefab, sprite, png] → 组装
```

---

## 7. 设计决策记录

| 编号 | 决策 | 理由 |
|------|------|------|
| D1 | 资源路径统一相对 assets/ 解析 | 一套规则、零特例，引擎代码最简 |
| D2 | Sprite image 字段不做 sibling-relative | 与 D1 一致，不为任何资源类型开特例 |
| D3 | 不强制 assets/ 内目录结构 | 适应不同规模项目，从平铺到深层嵌套均可 |
| D4 | 通过扩展名识别资源类型 | 目录结构自由后，扩展名是唯一可靠的类型标识 |
| D5 | 采用相对路径（非 UE 的 /Game/ 前缀） | 引擎只有一个资源根，无需前缀区分命名空间 |
| D6 | 不采用 Unity 的 GUID 机制 | 轻量引擎不需要 .meta 文件系统，保持人类可读 |
| D7 | project.json 中 entryScene 相对 assetsDir | 与引擎内部路径规则统一，改名 assets/ 只需改一处 |
| D8 | 预留 manifest 但不立即实现 | 当前设计不依赖 manifest，未来可无缝引入 |

---

## 8. 已知限制与后续规划

| 限制 | 影响 | 计划解决方案 |
|------|------|------------|
| 重命名/移动文件会断引用 | 需手动更新所有引用该资源的文件 | 未来编辑器提供安全重构工具 + manifest 依赖图 |
| 无全局资源索引 | 查找"谁引用了这个资源"需全文搜索 | 引入 manifest 后自动建立依赖图 |
| 串行加载链 | 首次加载场景需多次 RTT | 引入 manifest 后支持依赖预加载 |
