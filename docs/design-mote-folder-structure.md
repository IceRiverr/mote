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
- **不兼容旧格式**：本规范为当前最优设计，旧数据需一次性手动迁移到本规范，引擎和编辑器不维护任何向后兼容代码

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
├── snake.mote-project.json   # 项目定义文件（必须）
├── assets/                    # 资源目录（名称可配置）
└── src/                       # TypeScript 源码目录（名称可配置）
```

- **`.mote-project.json`**：项目入口，定义元信息和关键配置。一个目录内可以有多个项目文件
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
| `.mote-project.json` | Project | 项目定义文件 |
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
  if (path.endsWith('.mote-project.json')) return projectLoader;
  if (/\.(png|webp|jpg)$/.test(path))     return imageLoader;
  if (/\.(mp3|ogg|wav)$/.test(path))      return audioLoader;
  throw new Error(`Unknown asset type: "${path}"`);
}
```

---

## 5. 核心文件格式

### 5.1 `.mote-project.json`

项目定义文件，位于游戏根目录，是引擎加载项目的唯一入口。

```json
{
  "type": "mote-project",
  "version": "1.0.0",
  "id": "tiny-dungeon",
  "name": "Tiny Dungeon",
  "assetsDir": "assets",
  "srcDir": "src",
  "entryScene": "scenes/main.mote-scene.json",
  "entryScript": "main.ts"
}
```

字段说明：

| 字段 | 类型 | 说明 |
|------|------|------|
| type | string | 固定为 `"mote-project"` |
| version | string | 格式版本，当前为 `"1.0.0"` |
| id | string | 项目唯一标识 |
| name | string | 项目显示名称 |
| assetsDir | string | 资源目录名，相对于项目根 |
| srcDir | string | 源码目录名，相对于项目根 |
| entryScene | string | 入口场景，相对于 assetsDir |
| entryScript | string | 入口脚本（源码，如 `main.ts`），相对于 srcDir；由构建系统映射到运行产物 |

**关键设计**：
1. 文件名采用 `{project-name}.mote-project.json` 形式，如 `snake.mote-project.json`
2. 一个目录下**允许存在多个** `.mote-project.json` 文件。编辑器打开目录时会扫描所有项目文件，由用户选择具体打开哪一个
3. entryScene 相对 assetsDir 解析，entryScript 相对 srcDir 解析。如果将来重命名 assets/ 为 content/，只需修改 assetsDir 字段，所有资源引用不受影响
4. 构建系统负责将 `entryScript` 编译/打包为引擎可运行的模块。运行时加载的是构建产物，不是直接读取源码文件

### 5.2 通用格式约定

以下约定适用于所有 `.mote-*.json` 资源文件。

#### `id` 字段语义
- `id` 是**人类可读的标识符**，用于调试、日志和编辑器展示
- **禁止**用 `id` 做跨文件引用。所有跨资源引用必须使用相对 `assets/` 的文件路径
- `id` 允许包含字母、数字、下划线、连字符，建议采用 `kebab-case` 或 `snake_case`

#### 坐标与旋转
- **坐标系**：2D 像素坐标，原点在左上角，`+x` 向右，`+y` 向下（Web/Canvas 惯例）
- **旋转单位**：`rotation` 字段统一使用**度数（degrees）**，正值为顺时针。引擎内部可按需转换为弧度

#### 颜色格式
- 所有颜色字符串统一为 **Hex 格式**
- 支持 `#RRGGBB` 和 `#RRGGBBAA`
- 不支持 CSS 颜色名（如 `"red"`），保证解析结果唯一

---

### 5.3 Scene（.mote-scene.json）

```json
{
  "type": "mote-scene",
  "version": "1.0.0",
  "id": "main-scene",
  "name": "Main Scene",
  "entities": [
    {
      "id": "entity-001",
      "prefab": "prefabs/environment/ground-tile.mote-prefab.json",
      "parent": null,
      "overrides": {
        "Transform": { "x": 100, "y": 200, "rotation": 0, "scaleX": 1, "scaleY": 1 }
      }
    },
    {
      "id": "entity-002",
      "name": "Child Object",
      "prefab": "prefabs/ui/coin.mote-prefab.json",
      "parent": "entity-001",
      "visible": true,
      "overrides": {
        "Transform": { "x": 16, "y": 0 }
      }
    }
  ]
}
```

字段说明：

| 字段 | 类型 | 说明 |
|------|------|------|
| type | string | 固定为 `"mote-scene"` |
| version | string | 格式版本，当前为 `"1.0.0"` |
| id | string | 场景标识符 |
| name | string | 场景显示名称 |
| entities | array | 场景中的实体列表 |
| entities[].id | string | 实体唯一标识（在场景文件内唯一） |
| entities[].prefab | string | Prefab 文件路径，相对 `assets/` |
| entities[].name | string | 可选，覆盖显示名称 |
| entities[].parent | string \| null | 可选，父实体 `id`。`null` 表示根节点 |
| entities[].visible | boolean | 可选，是否可见 |
| entities[].overrides | object | 组件覆盖值，结构与 Prefab `components` 一致 |

### 5.4 Prefab（.mote-prefab.json）

```json
{
  "type": "mote-prefab",
  "version": "1.0.0",
  "id": "ground_tile",
  "name": "Ground Tile",
  "tags": ["environment", "dungeon"],
  "components": {
    "Transform": { "x": 0, "y": 0, "rotation": 0, "scaleX": 1, "scaleY": 1 },
    "Sprite": {
      "atlas": "sprites/tiny-dungeon_tilemap_packed.mote-sprite.json",
      "frame": "frame_100",
      "layer": 0,
      "tint": "#FFFFFF",
      "alpha": 1.0,
      "visible": true
    }
  }
}
```

字段说明：

| 字段 | 类型 | 说明 |
|------|------|------|
| type | string | 固定为 `"mote-prefab"` |
| version | string | 格式版本，当前为 `"1.0.0"` |
| id | string | Prefab 标识符 |
| name | string | 显示名称 |
| tags | string[] | 可选，分类标签 |
| components | object | 组件数据 |
| components.Transform | object | 位置、旋转、缩放 |
| components.Sprite | object | Sprite 渲染数据 |
| components.Sprite.atlas | string | Sprite Atlas 文件路径，相对 `assets/` |
| components.Sprite.frame | string | 帧名称 |
| components.Sprite.layer | number | 渲染层级 |
| components.Sprite.tint | string | 可选，染色（Hex 格式） |
| components.Sprite.alpha | number | 可选，透明度 `0.0` ~ `1.0` |
| components.Sprite.visible | boolean | 可选，是否可见 |

### 5.5 Sprite Atlas（.mote-sprite.json）

```json
{
  "type": "mote-sprite",
  "version": "1.0.0",
  "id": "sheet_tiny_dungeon",
  "name": "tiny-dungeon_tilemap_packed",
  "image": "sprites/tiny-dungeon_tilemap_packed.png",
  "slicing": {
    "mode": "grid",
    "tileWidth": 16,
    "tileHeight": 16
  },
  "frames": [
    { "name": "frame_0",   "x": 0,  "y": 0,  "w": 16, "h": 16 },
    { "name": "frame_14",  "x": 32, "y": 16, "w": 16, "h": 16, "collider": { "shapes": [{ "type": "full" }] } },
    { "name": "frame_100", "x": 0,  "y": 96, "w": 16, "h": 16 }
  ]
}
```

字段说明：

| 字段 | 类型 | 说明 |
|------|------|------|
| type | string | 固定为 `"mote-sprite"` |
| version | string | 格式版本，当前为 `"1.0.0"` |
| id | string | 图集标识符（用于调试和编辑器展示） |
| name | string | 图集显示名称 |
| image | string | 图片文件路径，**相对 `assets/` 解析** |
| slicing | object | 切片模式及参数 |
| slicing.mode | string | `"grid" \| "packed" \| "xml" \| "manual"` |
| slicing.tileWidth | number | grid 模式下单元宽度 |
| slicing.tileHeight | number | grid 模式下单元高度 |
| slicing.margin | number | grid 模式下边距 |
| slicing.spacing | number | grid 模式下间距 |
| slicing.source | string | packed/xml 模式下源文件路径 |
| frames | array | 帧列表，**顺序有意义** |
| frames[].name | string | 帧的字符串引用键（跨资源引用时使用） |
| frames[].x / y / w / h | number | 帧在图集中的像素坐标和尺寸 |
| frames[].collider | object | 可选，碰撞体数据。格式为 `{ shapes: ColliderShape[] }` |
| frames[].tags | string[] | 可选，帧标签 |

> **注意**：
> 1. `image` 字段遵循统一路径规则，相对 `assets/` 解析，不做 sibling-relative 特殊处理。
> 2. `frames` 为数组格式，顺序保留。数组索引可作为 tilemap 的整数 tile ID，但**跨资源引用必须使用 `name`**。
> 3. `id` 字段仅用于调试展示，禁止作为跨文件引用键。

---

## 6. 未来扩展：Asset Manifest

当前设计预留了 Asset Manifest 的位置，用于未来支持依赖追踪、增量打包和并行加载。

### 6.1 预留位置

```
assets/
├── manifest.json         # 自动生成，不手动编辑
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
| D9 | 不维护向后兼容代码 | 团队规模小，维护兼容层的成本高于一次性迁移数据；保证代码库极简 |

---

## 8. 已知限制与后续规划

| 限制 | 影响 | 计划解决方案 |
|------|------|------------|
| 重命名/移动文件会断引用 | 需手动更新所有引用该资源的文件 | 未来编辑器提供安全重构工具 + manifest 依赖图 |
| 无全局资源索引 | 查找"谁引用了这个资源"需全文搜索 | 引入 manifest 后自动建立依赖图 |
| 串行加载链 | 首次加载场景需多次 RTT | 引入 manifest 后支持依赖预加载 |
| 旧项目需手动迁移 | 旧格式数据无法直接打开 | 提供一次性迁移脚本或文档说明 |
