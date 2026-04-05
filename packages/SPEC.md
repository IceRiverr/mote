# mote（微尘）— Web 2D 游戏编辑器 · 开发规格说明书

> **版本**: 2.0-draft
> **日期**: 2026-04-05
> **状态**: 架构重设计阶段

---

## 目录

- [1. 项目概述](#1-项目概述)
- [2. 设计原则](#2-设计原则)
- [3. 概念模型](#3-概念模型)
- [4. 数据格式规格](#4-数据格式规格)
- [5. 引擎架构](#5-引擎架构)
- [6. 编辑器架构](#6-编辑器架构)
- [7. 碰撞体系统](#7-碰撞体系统)
- [8. 脚本系统](#8-脚本系统)
- [9. 项目文件结构](#9-项目文件结构)
- [10. 编辑器面板规格](#10-编辑器面板规格)
- [11. 当前实现状态](#11-当前实现状态)
- [12. 迁移计划](#12-迁移计划)
- [附录 A: 碰撞体编辑调研](#附录-a-碰撞体编辑调研)
- [附录 B: Tile/Sprite 统一调研](#附录-b-tilesprite-统一调研)

---

## 1. 项目概述

### 1.1 定位

mote（微尘）是一个基于 Web 技术的 2D 游戏编辑器 + 引擎套件，目标是：

- **编辑器**：Blender 风格的自由分割布局，借鉴 Godot / LDtk / Tiled 的最佳实践
- **引擎**：轻量级 2D 引擎，支持 WebGPU（主）/ WebGL2（回退）双后端
- **开发体验**：所有资源格式为人类可读的 JSON，即使不依赖编辑器，在 VSCode 中直接编辑 JSON + TypeScript 也可以写游戏

### 1.2 技术栈

| 层 | 技术 |
|---|---|
| 渲染 | WebGPU（主）/ WebGL2（回退），`IGfxDevice` 抽象层 |
| 编辑器 UI | Preact + @preact/signals |
| 语言 | TypeScript（严格模式） |
| 构建 | Vite |
| 状态管理 | @preact/signals（多个独立 signal store） |
| 样式 | CSS Variables（暗色主题，Blender 风格） |

### 1.3 部署地址

- 编辑器：https://iceriver.cc

---

## 2. 设计原则

### 2.1 核心原则

| 原则 | 说明 |
|---|---|
| **JSON 即真相** | 所有资源格式为人类可读的 JSON，编辑器只是 JSON 的可视化编辑器 |
| **编辑器可选** | 不依赖编辑器也能开发完整游戏；编辑器提供效率提升但非必需 |
| **Asset 级元数据** | 碰撞体、标签、属性定义在资源（Frame）级别，一处定义全局生效 |
| **SpriteSheet 统一** | TileSet 和 SpriteAtlas 统一为 SpriteSheet，通过 `slicing.mode` 区分切分方式 |
| **EntityDef 模板化** | 游戏对象通过 JSON 模板定义，引用 Frame + Script + Fields |
| **引擎/编辑器解耦** | 引擎可独立使用，不依赖编辑器的任何代码 |

### 2.2 UI 设计原则

- 布局系统：Blender 风格的 AreaTree 自由分割/合并
- 面板设计：借鉴 Godot（Inspector / Scene Tree）、LDtk（IntGrid 涂刷）、Tiled（Tile Collision Editor）
- 交互：暗色主题，紧凑布局，右键上下文菜单，快捷键驱动

---

## 3. 概念模型

### 3.1 五层数据架构

```
┌─────────────────────────────────────────────────────────┐
│  Layer 5 ─ Scene（场景/关卡）                            │
│  TileLayer（网格放置 Frame）+ EntityLayer（自由放置实例）  │
├─────────────────────────────────────────────────────────┤
│  Layer 4 ─ EntityDef（实体模板）                         │
│  引用 Frame + Script + 自定义 Fields                     │
├─────────────────────────────────────────────────────────┤
│  Layer 3 ─ Script（行为脚本）                            │
│  TypeScript class，运行时由引擎实例化                     │
├─────────────────────────────────────────────────────────┤
│  Layer 2 ─ SpriteSheet（精灵表）                         │
│  一张图片 + 切分规则 → 多个 Frame（含碰撞/标签/属性）      │
├─────────────────────────────────────────────────────────┤
│  Layer 1 ─ Image（原始图片）                             │
│  .png / .jpg 文件，纯像素数据                            │
└─────────────────────────────────────────────────────────┘
```

数据流方向：`Image → SpriteSheet → Frame ← EntityDef ← Scene`，Script 侧挂在 EntityDef 上。

### 3.2 核心概念定义

| 概念 | 定义 | 文件格式 |
|---|---|---|
| **Image** | 原始图片文件（PNG/JPG），编辑器不修改 | `.png` / `.jpg` |
| **SpriteSheet** | 一张图片 + 切分配置 + Frame 列表 | `.sprite.json` |
| **Frame** | SpriteSheet 中的一个命名矩形区域，携带碰撞/标签/属性 | 嵌入 `.sprite.json` |
| **EntityDef** | 可放入场景的游戏对象模板 = Frame 引用 + Script + Fields | `.entity.json` |
| **EntityInstance** | EntityDef 在场景中的一个实例，可覆盖字段值 | 嵌入 `.map.json` |
| **Scene** | 一个关卡 = TileLayer[] + EntityLayer[] | `.map.json` |
| **Script** | TypeScript 行为类，实现游戏逻辑 | `.ts` |
| **Project** | 项目清单，列出所有资源和入口场景 | `project.mote.json` |

### 3.3 关键关系

```
Image (1) ←── (1) SpriteSheet (1) ──→ (N) Frame
                                           ↑
EntityDef (N) ─── 引用 ────────────────────┘
    │
    ├── 引用 Script (.ts)
    ├── 定义 Fields[]
    └── 可覆盖碰撞体
         │
Scene ───┤
    ├── TileLayer.data[] ── 引用 Frame ID
    └── EntityLayer.entities[] ── 引用 EntityDef + 覆盖 Fields
```

### 3.4 Tile 与 Sprite 的统一

**设计决策**：Tile 和 Sprite 在 mote 中是同一个东西 —— 都是 `Frame`。

| 过去 | 现在 |
|---|---|
| `TileSet` — 等距网格，整数 ID | `SpriteSheet (mode=grid)` — 等距网格，字符串 ID |
| `SpriteAtlas` — 打包图集，名称寻址 | `SpriteSheet (mode=packed/xml/manual)` — 同上 |
| `TileData` — 碰撞/标签在 TileSet 上 | `FrameData` — 碰撞/标签在 Frame 上 |
| TileLayer 按 GID 引用 | TileLayer 按 Frame ID 引用 |

区别仅在于**放置方式**：

- **网格放置**（TileLayer）：Frame 对齐到网格，用于地形/背景
- **自由放置**（EntityLayer）：EntityDef 引用 Frame，自由坐标放置

---

## 4. 数据格式规格

### 4.1 project.mote.json — 项目清单

```jsonc
{
  "name": "tiny-dungeon",
  "version": "0.1.0",
  "engine": "@mote/engine",
  "tileWidth": 16,
  "tileHeight": 16,
  "spriteSheets": [
    "assets/sprites/overworld.sprite.json",
    "assets/sprites/characters.sprite.json"
  ],
  "entities": [
    "assets/entities/chest.entity.json",
    "assets/entities/door.entity.json"
  ],
  "scenes": [
    "assets/maps/level1.map.json"
  ],
  "scripts": "scripts/",
  "startScene": "level1"
}
```

### 4.2 .sprite.json — 精灵表

#### 4.2.1 Grid 模式（原 TileSet）

```jsonc
{
  "id": "overworld",
  "name": "Overworld Tileset",
  "image": "../images/overworld.png",
  "slicing": {
    "mode": "grid",
    "tileWidth": 16,
    "tileHeight": 16,
    "margin": 0,
    "spacing": 0
  },
  "frames": {
    "grass": {
      "x": 0, "y": 0, "w": 16, "h": 16,
      "collider": [{ "type": "full" }],
      "tags": ["ground", "walkable"]
    },
    "water": {
      "x": 16, "y": 0, "w": 16, "h": 16,
      "collider": [{ "type": "full" }],
      "tags": ["water", "hazard"],
      "properties": { "damage": 5, "slowFactor": 0.5 }
    },
    "slope_ne": {
      "x": 32, "y": 0, "w": 16, "h": 16,
      "collider": [{ "type": "polygon", "points": [[0,16],[16,16],[16,0]] }]
    },
    "wall": {
      "x": 48, "y": 0, "w": 16, "h": 16,
      "collider": [{ "type": "full" }],
      "tags": ["solid", "wall"]
    }
  }
}
```

#### 4.2.2 Packed 模式（原 SpriteAtlas + TexturePacker）

```jsonc
{
  "id": "characters",
  "name": "Characters",
  "image": "../images/characters.png",
  "slicing": {
    "mode": "packed",
    "source": "../images/characters.json"
  },
  "frames": {
    "player_idle_0": {
      "x": 0, "y": 0, "w": 24, "h": 32,
      "trimmed": true,
      "sourceWidth": 32, "sourceHeight": 32,
      "offsetX": 4, "offsetY": 0,
      "collider": [{ "type": "rect", "x": 4, "y": 16, "w": 16, "h": 16 }],
      "tags": ["player", "idle"]
    },
    "player_idle_1": {
      "x": 24, "y": 0, "w": 24, "h": 32,
      "tags": ["player", "idle"]
    },
    "chest_closed": {
      "x": 0, "y": 64, "w": 16, "h": 16,
      "collider": [{ "type": "rect", "x": 1, "y": 4, "w": 14, "h": 12 }],
      "tags": ["interactive"]
    },
    "chest_open": {
      "x": 16, "y": 64, "w": 16, "h": 16,
      "tags": ["interactive"]
    }
  }
}
```

#### 4.2.3 XML 模式（Sparrow/Starling）

```jsonc
{
  "id": "ui-atlas",
  "name": "UI Elements",
  "image": "../images/ui.png",
  "slicing": {
    "mode": "xml",
    "source": "../images/ui.xml"
  },
  "frames": {
    "btn_normal": { "x": 0, "y": 0, "w": 48, "h": 16 },
    "btn_hover":  { "x": 48, "y": 0, "w": 48, "h": 16 },
    "btn_press":  { "x": 96, "y": 0, "w": 48, "h": 16 }
  }
}
```

#### 4.2.4 Manual 模式（散图打包 / 手动定义）

```jsonc
{
  "id": "items",
  "name": "Items",
  "image": "../images/items.png",
  "slicing": {
    "mode": "manual"
  },
  "frames": {
    "sword":  { "x": 0,  "y": 0, "w": 12, "h": 28, "tags": ["weapon"] },
    "shield": { "x": 12, "y": 0, "w": 14, "h": 16, "tags": ["armor"] },
    "potion": { "x": 26, "y": 0, "w": 10, "h": 14, "tags": ["consumable"] }
  }
}
```

### 4.3 .entity.json — 实体模板

```jsonc
{
  "id": "chest",
  "name": "Treasure Chest",
  "sprite": "characters:chest_closed",   // spriteSheetId:frameId
  "shape": "rect",
  "width": 16,
  "height": 16,
  "resizable": false,
  "color": "#f39c12",
  "icon": "📦",
  "script": "../scripts/Chest.ts",
  "collider": null,                      // null = 继承 Frame 碰撞体
  "fields": [
    { "id": "lootTable", "label": "Loot Table", "type": "string", "default": "common" },
    { "id": "locked",    "label": "Locked",     "type": "bool",   "default": false },
    { "id": "keyId",     "label": "Key ID",     "type": "string", "default": "" }
  ]
}
```

**碰撞体继承链**：

```
EntityInstance.colliderOverride ──(若非 null)──→ 使用实例覆盖
         ↓ (null/undefined)
EntityDef.collider ──(若非 null)──→ 使用模板定义
         ↓ (null)
Frame.collider ──(若非 undefined)──→ 使用 Frame 的碰撞体
         ↓ (undefined)
无碰撞
```

### 4.4 .map.json — 场景/关卡

```jsonc
{
  "id": "level1",
  "name": "Dungeon Floor 1",
  "width": 40,
  "height": 30,
  "tileWidth": 16,
  "tileHeight": 16,
  "spriteSheets": ["overworld", "characters"],
  "layers": [
    {
      "id": "bg",
      "name": "Background",
      "type": "tile",
      "visible": true,
      "opacity": 1.0,
      "locked": false,
      "spriteSheet": "overworld",
      "encoding": "names",
      "data": [
        "grass", "grass", "water", "grass", "slope_ne",
        "grass", "wall",  "wall",  "wall",  "grass"
      ]
    },
    {
      "id": "fg",
      "name": "Foreground",
      "type": "tile",
      "visible": true,
      "opacity": 1.0,
      "locked": false,
      "spriteSheet": "overworld",
      "encoding": "names",
      "data": [
        "", "", "", "wall_top", "",
        "", "", "", "", ""
      ]
    },
    {
      "id": "entities",
      "name": "Entities",
      "type": "entity",
      "visible": true,
      "opacity": 1.0,
      "locked": false,
      "entities": [
        {
          "id": "chest_01",
          "template": "chest",
          "name": "Treasure Chest 1",
          "x": 128,
          "y": 64,
          "width": 16,
          "height": 16,
          "fields": { "locked": true, "lootTable": "rare" }
        },
        {
          "id": "spawn_01",
          "template": "player_spawn",
          "name": "Player Start",
          "x": 32,
          "y": 32,
          "width": 16,
          "height": 16,
          "fields": { "direction": "down" }
        }
      ]
    }
  ]
}
```

#### TileLayer 双编码支持

为兼顾可读性和性能，TileLayer 支持两种编码：

| 编码 | `encoding` 值 | data 格式 | 适用场景 |
|---|---|---|---|
| 名称模式 | `"names"` | `["grass", "grass", "water", ...]` | 开发/手写/版本控制 |
| 索引模式 | `"indexed"` | `[0, 0, 1, 2, ...]` + `frameIndex: [...]` | 导出/大型地图 |

索引模式示例：
```jsonc
{
  "encoding": "indexed",
  "frameIndex": ["grass", "water", "slope_ne", "wall"],
  "data": [0, 0, 1, 0, 2, 0, 3, 3, 3, 0]
}
```

编辑器默认保存 `names` 模式。导出可选 `indexed` 模式。引擎两种都能加载。

---

## 5. 引擎架构

### 5.1 模块清单

| 模块 | 文件 | 状态 | 说明 |
|---|---|---|---|
| **渲染抽象** | `gfx/IGfxDevice.ts` | ✅ 已完成 | Buffer / Texture / Pipeline / BindGroup 接口 |
| **WebGPU 后端** | `gfx/WebGPUDevice.ts` | ✅ 已完成 | 主渲染后端 |
| **WebGL2 后端** | `gfx/WebGL2Device.ts` | ✅ 已完成 | 回退渲染后端 |
| **设备工厂** | `gfx/createGfxDevice.ts` | ✅ 已完成 | 自动检测 + 创建最佳后端 |
| **SpriteBatch** | `gfx/SpriteBatch.ts` | ✅ 已完成 | 10K quad/帧，自动 batch break |
| **文本渲染** | `gfx/Font.ts` + `gfx/TextRenderer.ts` | ✅ 已完成 | BMFont 解析 + SpriteBatch 集成 |
| **游戏循环** | `GameLoop.ts` | ✅ 已完成 | 半固定时间步长，防死亡螺旋 |
| **输入** | `Input.ts` | ✅ 已完成 | 键盘 + 鼠标 + 手柄，ActionMap |
| **相机** | `Camera2D.ts` | ✅ 已完成 | 正交投影，follow / shake / pixelSnap |
| **音频** | `audio.ts` | ✅ 已完成 | SFX/Music 总线，SoundPool，多格式回退 |
| **数学** | `Math.ts` | ✅ 已完成 | Vec2 / Mat4 / Color / Rect |
| **资源加载器** | — | ❌ 未实现 | 加载 project.mote.json → 构建运行时资源 |
| **场景管理** | — | ❌ 未实现 | 场景切换、TileMap 渲染、Entity 管理 |
| **碰撞系统** | — | ❌ 未实现 | 碰撞检测 + 响应（基于 Collider 数据） |
| **脚本运行时** | — | ❌ 未实现 | 动态加载 .ts 脚本并绑定到 Entity |

### 5.2 引擎资源加载流程

```
project.mote.json
    │
    ├── spriteSheets[] ──→ 加载 .sprite.json ──→ 加载 Image ──→ 创建 GPU Texture
    │                                        └──→ 解析 Frame 列表
    ├── entities[] ──→ 加载 .entity.json ──→ 解析 EntityDef
    │                                   └──→ 关联 Script (.ts)
    ├── scenes[] ──→ 加载 .map.json ──→ 构建 TileMap 渲染数据
    │                              └──→ 实例化 EntityInstance
    └── startScene ──→ 激活初始场景
```

### 5.3 引擎公开 API（目标）

```ts
import { Engine, Scene, Entity, Input, Camera2D } from '@mote/engine';

// 方式 1：从 project 文件启动（完整项目）
const engine = await Engine.load('./project.mote.json', canvas);
engine.start();

// 方式 2：纯代码启动（最小游戏，不需要编辑器或 JSON）
const engine = new Engine(canvas);
const batch = engine.spriteBatch;
const input = engine.input;
engine.onUpdate = (dt) => {
  if (input.isDown('ArrowRight')) player.x += 100 * dt;
};
engine.onDraw = () => {
  batch.drawRegion(texture, region, player.x, player.y);
};
engine.start();
```

---

## 6. 编辑器架构

### 6.1 整体布局

```
┌──────────────────────────────────────────────────────────────────┐
│  Global Header:  project name  │  File  Edit  View  Help        │
├─────────────┬────────────────────────────────┬───────────────────┤
│             │                                │                   │
│  Scene Tree │        Viewport                │    Inspector      │
│             │                                │                   │
│  图层树     │   2D 场景视图                   │  选中项属性编辑    │
│  + 实体列表  │   网格 + Tile + Entity          │                   │
│             │   碰撞叠加显示                  │                   │
│             │                                │                   │
├─────────────┴──────────────────┬─────────────┴───────────────────┤
│                                │                                 │
│  Sprite Editor                 │   Assets Browser                │
│  精灵表查看/编辑               │   资源文件浏览器                  │
│  碰撞体编辑                    │                                 │
└────────────────────────────────┴─────────────────────────────────┘
```

### 6.2 面板注册表

| 面板 ID | 名称 | 状态 | 功能 |
|---|---|---|---|
| `viewport` | 场景视口 | ✅ 已有 | 2D 场景渲染、Tile 绘制、Entity 放置/移动、碰撞可视化 |
| `sprite-editor` | 精灵编辑器 | ⚠️ 需合并重构 | SpriteSheet 查看/编辑，Frame 碰撞/标签编辑 |
| `inspector` | 属性检查器 | ✅ 已有，需扩展 | 选中内容的属性编辑（Frame / EntityDef / EntityInstance） |
| `assets` | 资源浏览器 | ❌ 新增 | 项目文件系统浏览，导入/删除/重命名 |
| `scene-tree` | 场景树 | ❌ 新增 | 图层列表、Entity 列表、可见性/锁定控制 |
| `console` | 控制台 | ❌ 新增 | 日志输出、错误信息 |

### 6.3 面板职责映射

| 面板 | 编辑什么 | 对应数据层 |
|---|---|---|
| **Assets Browser** | 浏览/导入/删除所有资源文件 | Layer 1-5 文件系统 |
| **Sprite Editor** | 切分配置、Frame 重命名/碰撞/标签 | Layer 2 SpriteSheet |
| **Inspector** | 选中内容的属性（Frame / EntityDef / Entity 实例） | Layer 2-5 |
| **Scene Tree** | 图层顺序、Entity 列表、可见性/锁定 | Layer 5 Scene |
| **Viewport** | Tile 绘制、Entity 放置/移动、碰撞可视化 | Layer 5 Scene |
| **Console** | 日志输出、错误信息 | 运行时 |

### 6.4 Sprite Editor 合并方案

当前 `tile-palette` 和 `sprite-panel` 合并为统一的 **Sprite Editor**：

| 模式 | 说明 | 触发条件 |
|---|---|---|
| **Grid View** | 等尺寸网格显示，tile 画笔选择 | `slicing.mode === "grid"` |
| **List View** | 名称列表 + 缩略图，帧选择 | `slicing.mode !== "grid"` |
| **Collision Mode** | 叠加碰撞编辑（右键菜单或工具栏切换） | 任何模式下均可激活 |

### 6.5 布局系统

沿用现有 AreaTree 二叉分割布局：

- **已实现**：AreaNode 类型定义、递归渲染、分割操作（SplitHandle）、编辑器类型切换
- **待实现**：合并操作（拖向外侧合并）、布局持久化到 IndexedDB、预设布局模板

### 6.6 状态管理

维持当前 @preact/signals 多 store 模式，但需要重组：

| Store | 职责 | 当前状态 |
|---|---|---|
| `project.ts` | 项目级数据（SpriteSheet 列表、EntityDef 列表、当前 Scene） | ⚠️ 需重构 |
| `selection.ts` | 当前选中（活跃面板、工具、选中 Frame / Entity） | ✅ 已有 |
| `history.ts` | Undo/Redo 命令栈 | ✅ 已有 |
| `layout.ts` | AreaTree 布局状态 | ✅ 已有 |
| `atlas.ts` → `spriteSheet.ts` | SpriteSheet + 图片缓存 | ⚠️ 需重命名/重构 |

---

## 7. 碰撞体系统

### 7.1 碰撞形状类型

```ts
// data/Collider.ts

/** 碰撞形状联合类型 */
export type ColliderShape =
  | { type: 'full' }                                          // 整格碰撞
  | { type: 'rect'; x: number; y: number; w: number; h: number }  // 自定义矩形
  | { type: 'circle'; cx: number; cy: number; r: number }    // 圆形
  | { type: 'polygon'; points: [number, number][] }           // 任意多边形
  | { type: 'slope'; direction: 'NE' | 'NW' | 'SE' | 'SW' } // 斜面快捷方式

/** 完整碰撞数据（附加在 Frame / EntityDef 上） */
export interface ColliderData {
  shapes: ColliderShape[];
  oneWay?: boolean;                    // 单向碰撞（平台跳跃）
  layer?: number;                      // 碰撞层
  mask?: number;                       // 碰撞掩码
  properties?: Record<string, unknown>; // 自定义属性（摩擦、材质等）
}
```

### 7.2 碰撞体在数据层中的位置

碰撞体可以定义在三个层级，按优先级从高到低继承：

| 层级 | 定义位置 | 适用场景 |
|---|---|---|
| **EntityInstance** | `colliderOverride` | 某个特定宝箱需要不同碰撞（罕见） |
| **EntityDef** | `collider` | 模板级定义（如 Trigger Zone 的碰撞区域） |
| **Frame** | `collider` | 资源级默认碰撞（如 wall tile 默认 full 碰撞） |

### 7.3 碰撞编辑 UI

#### Sprite Editor 右键菜单

```
┌─────────────────────┐
│ 瓦片 "grass" (0, 0) │
├─────────────────────┤
│ 碰撞体              │
│  ├ ■ Full Tile      │ ← 整格碰撞
│  ├ ▬ Half Top       │ ← 半格（上）
│  ├ ▬ Half Bottom    │ ← 半格（下）
│  ├ ╱ Slope NE       │ ← 斜面
│  ├ ╲ Slope NW       │
│  ├ ⬡ Custom...      │ ← 打开多边形编辑
│  └ ✕ Clear          │ ← 清除碰撞
├─────────────────────┤
│ ☐ One-Way Platform  │
├─────────────────────┤
│ 标签: ground        │
│ [点击编辑标签…]      │
└─────────────────────┘
```

#### 碰撞可视化

| 碰撞类型 | PaletteCanvas 渲染 | ViewportCanvas 渲染 |
|---|---|---|
| `full` | 半透明红色覆盖整格 | 红色轮廓线 |
| `rect` | 红色矩形框 | 红色矩形框 |
| `polygon` | 红色多边形轮廓 | 红色多边形轮廓 |
| `slope` | 红色三角形填充 | 红色三角形轮廓 |
| `circle` | 红色圆形轮廓 | 红色圆形轮廓 |
| `oneWay` | 黄色箭头线 | 黄色箭头线 |

#### 碰撞编辑模式（画笔式）

参考 Godot 4 的 Paint Tool，Sprite Editor 进入碰撞编辑模式后：

1. 工具栏展示碰撞模板（Full / Half / Slope / 自定义…）
2. 选中模板后，点击/拖拽批量刷碰撞到多个 Frame
3. 右键擦除碰撞

### 7.4 碰撞体调研总结

基于对 Tiled / LDtk / Godot / Cocos Creator / Unity 2D 五款编辑器的调研：

| 编辑器 | 碰撞定义层级 | 形状支持 | 亮点 |
|---|---|---|---|
| **Tiled** | Per-Tile (TileSet) | 矩形/椭圆/多边形/折线/胶囊 | 形状最丰富 + Custom Properties |
| **LDtk** | Per-Cell (IntGrid) | 整格标记 | 碰撞与渲染完全解耦 |
| **Godot 4** | Per-Tile (TileSet) | 多边形（多 Physics Layer） | Paint Tool 批量刷 + 多物理层 |
| **Cocos Creator** | 代码创建 | Box/Circle/Polygon | 脚本化灵活 |
| **Unity 2D** | Per-Sprite | 多边形（多轮廓） | Alpha 自动生成 + Composite 合并 |

**mote 的设计选择**：

- 碰撞定义层级：**Per-Frame**（参考 Tiled / Unity）
- 形状类型：**full / rect / circle / polygon / slope**（覆盖 95% 场景）
- 编辑方式：**右键菜单 + 画笔模式**（参考 Godot Paint Tool）
- 可视化：**叠加显示在 Palette 和 Viewport 中**（参考 Tiled 1.3+）
- 未来扩展：**碰撞体合并**（参考 Unity Composite Collider）

---

## 8. 脚本系统

### 8.1 设计原则

- 脚本是普通的 TypeScript class，不依赖编辑器
- 编辑器只需知道脚本文件路径，不解析 TypeScript
- 运行时引擎通过动态 import 加载脚本

### 8.2 脚本约定

```ts
// scripts/Chest.ts
import type { Entity, Engine } from '@mote/engine';

export default class Chest {
  private opened = false;

  constructor(
    private entity: Entity,
    private engine: Engine,
  ) {}

  /** 引擎每帧调用 */
  update(dt: number): void {
    // ...
  }

  /** 被玩家交互时调用 */
  onInteract(player: Entity): void {
    if (this.opened) return;
    this.opened = true;
    this.entity.setFrame('chest_open');
    this.entity.collider = null;
    const lootTable = this.entity.getField('lootTable');
    this.engine.emit('loot', { table: lootTable, position: this.entity.position });
  }

  /** 进入碰撞时调用 */
  onCollisionEnter(other: Entity): void {
    // ...
  }

  /** 实体销毁时调用 */
  onDestroy(): void {
    // ...
  }
}
```

### 8.3 脚本生命周期

```
实例化: new ScriptClass(entity, engine)
    │
    ├── 每帧: update(dt)
    ├── 碰撞: onCollisionEnter(other) / onCollisionExit(other)
    ├── 交互: onInteract(player)
    └── 销毁: onDestroy()
```

### 8.4 编辑器中的脚本绑定

- 编辑器扫描 `scripts/` 目录，列出所有 `.ts` 文件
- EntityDef 的 Inspector 面板中，`script` 字段显示为下拉列表
- 编辑器不执行脚本，只存储路径引用

---

## 9. 项目文件结构

### 9.1 标准目录约定

```
my-game/
├── project.mote.json              ← 项目清单（入口）
│
├── assets/
│   ├── images/                    ← Layer 1: 原始图片
│   │   ├── overworld.png
│   │   ├── characters.png
│   │   └── ui.png
│   │
│   ├── sprites/                   ← Layer 2: 精灵表定义
│   │   ├── overworld.sprite.json
│   │   ├── characters.sprite.json
│   │   └── ui.sprite.json
│   │
│   ├── entities/                  ← Layer 4: 实体模板
│   │   ├── player_spawn.entity.json
│   │   ├── chest.entity.json
│   │   ├── door.entity.json
│   │   └── trigger_zone.entity.json
│   │
│   └── maps/                     ← Layer 5: 场景/关卡
│       ├── level1.map.json
│       └── level2.map.json
│
├── scripts/                       ← Layer 3: 行为脚本
│   ├── Player.ts
│   ├── Chest.ts
│   ├── Door.ts
│   └── Weapon.ts
│
├── packages/
│   ├── engine/                    ← 引擎源码
│   │   └── src/
│   └── editor/                    ← 编辑器源码
│       └── src/
│
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### 9.2 纯 VSCode 开发流程（无编辑器）

1. 创建 `project.mote.json`，填写项目名和资源路径
2. 将 PNG 放入 `assets/images/`
3. 手写 `.sprite.json`，定义 Frame 名称和坐标（或用 TexturePacker 导出后转换）
4. 手写 `.entity.json`，定义游戏对象模板
5. 手写 `.map.json`，TileLayer data 用 Frame 名称（`["grass", "grass", "water", ...]`）
6. 编写 TypeScript 脚本实现游戏逻辑
7. `npx vite` 启动 → 引擎加载 JSON → 游戏运行

---

## 10. 编辑器面板规格

### 10.1 Assets Browser（资源浏览器）

**功能**：

- 树形目录浏览 `assets/` 下所有文件
- 文件类型图标区分（🖼 图片 / 🎨 精灵表 / 🧩 实体模板 / 🗺 地图 / 📜 脚本）
- 右键菜单：导入 / 重命名 / 删除 / 在 Sprite Editor 中打开
- 拖拽导入：从系统文件管理器拖入图片自动导入
- 搜索过滤：按文件名 / 类型筛选
- 双击：根据文件类型跳转到对应编辑面板

**与其他面板联动**：

| 操作 | 效果 |
|---|---|
| 双击 `.sprite.json` | Sprite Editor 切换到该精灵表 |
| 双击 `.entity.json` | Inspector 显示该 EntityDef 属性 |
| 双击 `.map.json` | Viewport 加载该场景 |
| 拖拽 `.entity.json` 到 Viewport | 在场景中放置该 Entity 实例 |

### 10.2 Scene Tree（场景树）

**功能**：

- 图层列表（支持拖拽排序）
- 每个图层：名称 / 可见性眼睛图标 / 锁定图标 / 类型标记
- Entity Layer 可展开，显示内部 Entity 实例列表
- 点击选中 → Inspector 显示属性
- 右键菜单：添加图层 / 删除 / 重命名 / 上移 / 下移
- 图层类型支持：Tile Layer / Entity Layer

### 10.3 Sprite Editor（精灵编辑器）

**功能**：

- Header：精灵表选择下拉 + 导入按钮 + 搜索框
- Canvas：Grid View（等距网格）或 List View（名称+缩略图）
- Footer：选中 Frame 信息
- 碰撞编辑模式：切换后在 Frame 上叠加碰撞形状，右键菜单编辑
- 支持多选 → 批量设置碰撞

**从当前代码合并**：

- `tile-palette/*` → Sprite Editor Grid View 模式
- `sprite-panel/*` → Sprite Editor List View 模式
- `TileContextMenu` → 统一的 Frame 右键菜单

### 10.4 Inspector（属性检查器）

**功能**（根据选中内容切换面板）：

| 选中内容 | Inspector 显示 |
|---|---|
| Scene (无选中) | MapPropsPanel（地图属性：尺寸 / tile 大小） |
| TileLayer | LayerPanel（图层名称 / 可见性 / 透明度） |
| EntityLayer | LayerPanel |
| EntityInstance | EntityPanel（模板 / 坐标 / 字段值 / 碰撞覆盖） |
| Frame (Sprite Editor 选中) | FramePanel（名称 / 碰撞编辑 / 标签 / 属性） |
| EntityDef (Assets 选中) | EntityDefPanel（模板编辑 / 字段定义 / 脚本绑定） |

### 10.5 Viewport（场景视口）

**已有功能**（保持）：

- 2D 场景渲染（多图层）
- Tile 绘制工具（画笔/矩形/填充/橡皮擦）
- Entity 放置/移动/选中
- 相机平移/缩放
- 网格显示

**新增功能**：

| 功能 | 说明 | 快捷键 |
|---|---|---|
| 碰撞叠加显示 | 在 Tile / Entity 上叠加碰撞形状轮廓 | `C` 切换显隐 |
| Entity 碰撞可视化 | 显示 Entity 的碰撞区域 | 同上 |
| Frame 名称悬停 | 鼠标悬停时显示 Frame ID | — |
| 场景树联动 | 选中 Entity 时在 Scene Tree 中高亮 | — |

### 10.6 Console（控制台）

**功能**：

- 日志输出（info / warn / error 级别）
- 导入/导出操作日志
- 错误信息（如图片加载失败、JSON 解析错误）
- 未来：引擎运行时日志（当编辑器内嵌预览时）

---

## 11. 当前实现状态

### 11.1 引擎（packages/engine）— 14 文件

| 模块 | 状态 | 说明 |
|---|---|---|
| WebGPU 渲染器 | ✅ 完成 | WebGPUDevice + IGfxDevice 抽象 |
| WebGL2 渲染器 | ✅ 完成 | WebGL2Device 回退后端 |
| SpriteBatch | ✅ 完成 | 10K quad/帧，旋转快路径 |
| 文本渲染 | ✅ 完成 | BMFont + TextRenderer |
| GameLoop | ✅ 完成 | 半固定时间步长 |
| Input | ✅ 完成 | 键盘/鼠标/手柄，ActionMap |
| Camera2D | ✅ 完成 | follow/shake/pixelSnap |
| Audio | ✅ 完成 | SFX/Music 总线，SoundPool |
| Math | ✅ 完成 | Vec2/Mat4/Color/Rect |
| 资源加载器 | ❌ 缺失 | 需实现 project.mote.json 加载 |
| 场景管理 | ❌ 缺失 | 场景切换/TileMap 渲染 |
| 碰撞系统 | ❌ 缺失 | AABB / 多边形碰撞检测 |
| 脚本运行时 | ❌ 缺失 | 动态 import + 生命周期调用 |

### 11.2 编辑器（packages/editor）— 51 文件

| 模块 | 状态 | 说明 |
|---|---|---|
| AreaTree 布局 | ✅ 基本完成 | 分割有，合并缺失 |
| Viewport | ✅ 基本完成 | Tile 绘制 + Entity 放置 |
| Tile Palette | ✅ 基本完成 | 需合并入 Sprite Editor |
| Sprite Panel | ✅ 基本完成 | 需合并入 Sprite Editor |
| Inspector | ✅ 基本完成 | 需扩展 EntityDef / Frame 面板 |
| Command History | ✅ 完成 | 5 个 Command 类 |
| 暗色主题 | ✅ 完成 | CSS Variables |
| 数据导入/导出 | ✅ 基本完成 | 需迁移到新 JSON 格式 |
| Assets Browser | ❌ 缺失 | 新增面板 |
| Scene Tree | ❌ 缺失 | 新增面板 |
| Console | ❌ 缺失 | 新增面板 |
| 碰撞编辑 UI | ❌ 缺失 | 需实现 |
| EntityDef 外置 | ❌ 未完成 | 当前硬编码在 TileMap.ts |
| SpriteSheet 统一 | ❌ 未完成 | TileSet + SpriteAtlas 需合并 |

---

## 12. 迁移计划

### Phase 1：数据模型统一（基础重构）

**目标**：TileSet + SpriteAtlas → SpriteSheet，统一碰撞类型

| 任务 | 涉及文件 | 说明 |
|---|---|---|
| 创建 `data/Collider.ts` | 新文件 | ColliderShape / ColliderData 类型 |
| 创建 `data/SpriteSheet.ts` | 新文件 | 统一的 SpriteSheet / Frame 类型 |
| TileSet.ts 标记为 deprecated | TileSet.ts | 保留但标注即将移除 |
| SpriteAtlas.ts 标记为 deprecated | SpriteAtlas.ts | 保留但标注即将移除 |
| 重构 store/atlas.ts → store/spriteSheet.ts | store/ | 统一 store |

### Phase 2：JSON 格式定义

**目标**：定义并实现所有 JSON 格式的读写

| 任务 | 涉及文件 | 说明 |
|---|---|---|
| 定义 `.sprite.json` 格式 | data/io.ts | 读写 SpriteSheet JSON |
| 定义 `.entity.json` 格式 | data/io.ts | 读写 EntityDef JSON |
| 定义 `.map.json` 新格式 | data/io.ts | Frame ID 字符串 data + 双编码 |
| 定义 `project.mote.json` | data/io.ts | 项目清单读写 |
| 向后兼容旧格式导入 | data/io.ts | 旧 GID 整数格式自动转换 |

### Phase 3：Sprite Editor 合并

**目标**：tile-palette + sprite-panel → 统一 Sprite Editor

| 任务 | 涉及文件 | 说明 |
|---|---|---|
| 创建 `editors/sprite-editor/` | 新目录 | 统一的 Sprite Editor |
| 实现 Grid View 模式 | SpriteEditorCanvas.tsx | 来自 PaletteCanvas |
| 实现 List View 模式 | SpriteEditorCanvas.tsx | 来自 SpritePanelCanvas |
| 统一右键菜单 | FrameContextMenu.tsx | 碰撞/标签/属性编辑 |
| 碰撞形状叠加渲染 | SpriteEditorCanvas.tsx | 在 Frame 上渲染碰撞轮廓 |
| 删除旧 tile-palette + sprite-panel | — | 迁移完成后移除 |

### Phase 4：新增面板

**目标**：Assets Browser + Scene Tree

| 任务 | 涉及文件 | 说明 |
|---|---|---|
| Assets Browser 面板 | `editors/assets/` | 文件树 + 搜索 + 右键菜单 |
| Scene Tree 面板 | `editors/scene-tree/` | 图层列表 + Entity 列表 |
| 注册到面板注册表 | editors/registry.ts | 注册新面板类型 |

### Phase 5：EntityDef 外置

**目标**：BUILTIN_ENTITY_DEFS → .entity.json 文件

| 任务 | 涉及文件 | 说明 |
|---|---|---|
| 导出内置 EntityDef 为 JSON | — | 生成初始 .entity.json 文件 |
| EntityDef 加载器 | data/io.ts | 扫描 entities/ 目录 |
| EntityDef 增加 script 字段 | TileMap.ts → EntityDef | 引用 .ts 文件路径 |
| Inspector EntityDef 面板 | inspector/panels/ | 可视化编辑 EntityDef |

### Phase 6：引擎资源加载器

**目标**：引擎可独立加载项目 JSON 并运行

| 任务 | 涉及文件 | 说明 |
|---|---|---|
| ProjectLoader | engine/src/ | 加载 project.mote.json |
| SpriteSheetLoader | engine/src/ | 加载 .sprite.json + Image |
| SceneLoader | engine/src/ | 加载 .map.json → 构建 TileMap |
| ScriptLoader | engine/src/ | 动态 import .ts 脚本 |
| TileMapRenderer | engine/src/ | 基于 SpriteBatch 渲染 TileMap |

### Phase 7：碰撞系统 + 视口叠加

**目标**：运行时碰撞 + 编辑器碰撞可视化

| 任务 | 涉及文件 | 说明 |
|---|---|---|
| AABB 碰撞检测 | engine/src/ | 基础碰撞检测 |
| 多边形碰撞检测 | engine/src/ | SAT 算法 |
| 碰撞体合并（运行时） | engine/src/ | 相邻 full tile 合并为大矩形 |
| Viewport 碰撞叠加 | ViewportCanvas.tsx | 可切换的碰撞形状显示层 |

### 优先级总览

```
Phase 1 ──→ Phase 2 ──→ Phase 3 ──→ Phase 4
  数据统一     JSON 格式    UI 合并      新面板
                 │
                 └──→ Phase 5 ──→ Phase 6 ──→ Phase 7
                       EntityDef   引擎加载    碰撞系统
```

Phase 1-3 是编辑器侧重构，Phase 5-7 是引擎侧建设，可以部分并行。

---

## 附录 A: 碰撞体编辑调研

### 五款编辑器横向对比

| 维度 | Tiled | LDtk | Godot 4 | Cocos Creator | Unity 2D |
|---|---|---|---|---|---|
| 碰撞定义层级 | Per-Tile | Per-Cell | Per-Tile | Per-Tile (代码) | Per-Sprite |
| 矩形 | ✅ | 整格 | ✅ | ✅ | ✅ |
| 多边形 | ✅ | ❌ | ✅ | ✅ (代码) | ✅ |
| 椭圆/圆 | ✅ | ❌ | ❌ | ✅ | ❌ |
| 碰撞自动生成 | ❌ | ❌ | 整 tile 矩形 | ❌ | Alpha 轮廓 |
| 碰撞体合并 | ❌ | 引擎侧 | ❌ | ❌ | Composite |
| 批量编辑 | 脚本 API | 画笔 | Paint Tool | 脚本 | Sprite Editor |
| 可视化叠加 | 地图叠加 | 颜色网格 | 蓝色轮廓 | Debug Draw | 绿色 Gizmos |

### 关键设计启发

1. **碰撞定义在资源级别**（Tiled / Unity）→ 一次定义全局生效
2. **画笔式批量刷碰撞**（Godot Paint Tool）→ 效率远超逐个右键
3. **碰撞体自动生成**（Unity Alpha-based）→ 未来可选实现
4. **碰撞体合并优化**（Unity Composite）→ 引擎侧实现
5. **多物理层**（Godot Physics Layer）→ 同一 tile 多种碰撞
6. **碰撞与渲染分离**（LDtk IntGrid）→ 概念上分层清晰

---

## 附录 B: Tile/Sprite 统一调研

### 各引擎 Tile vs Sprite 关系

| 引擎 | 策略 | Tile 本质 |
|---|---|---|
| **Unity** | Sprite 为底层，Tile 包装 Sprite | `TileBase.GetTileData()` 返回 Sprite |
| **Godot** | 两套并行，共享 Texture | TileSet 和 SpriteFrames 独立 |
| **LDtk** | 彻底分离 | Tile 纯视觉，Entity 纯逻辑 |
| **Tiled** | Tile 可穿越到 Object 层 | Tile Object = 自由放置的 Tile |

### mote 的选择

采用 **Unity 范式**：Frame 是底层原子，Tile 和 Sprite 都是 Frame 的不同使用方式。

理由：
- 当前 TileSet 还不够复杂（无地形自动贴图/导航），不需要独立类型
- 统一后碰撞/标签/属性只需定义一次
- 编辑 UI 可以复用（Sprite Editor 同时服务网格和自由放置）
- 未来若 TileSet 功能增长（地形/导航），可在 SpriteSheet 上增加 grid 专属配置

---

*文档结束*
