# mote（微尘）— 2D Web Game Engine & Editor 技术规格书

> **目标读者**: AI Coding Agent (Codex)
> **项目部署地址**: https://iceriver.cc
> **核心技术栈**: WebGPU + WebGL 2 + TypeScript + Preact
> **定位**: 面向 2D 独立/小型游戏的网页端游戏引擎 + 可选编辑器

---

## 1. 设计原则

| 编号 | 原则 | 说明 |
|------|------|------|
| P1 | **极简 MVP** | 每个模块只做最小可用版本，后续增量演进 |
| P2 | **编辑器可选** | 整个游戏开发链路脱离编辑器也能完成（手写 JSON + AI 生成） |
| P3 | **三层约定** | bare（零结构）→ light（轻约定）→ full（完整项目），开发者自选 |
| P4 | **路径即身份** | 资源用相对路径引用，UUID 可选、编辑器管理 |
| P5 | **数据驱动** | 配置和内容用 JSONC 文件描述，支持 JSON Schema 校验 |

---

## 2. 引擎架构（分层）

```
Layer 4 ─ Editor（可选）
  EditorBridge / CommandHistory / SelectionManager / TransformGizmo / ProjectManager

Layer 3 ─ Game Framework
  GameLoop / InputManager / AssetManager / SceneManager / ECS / AudioManager

Layer 2 ─ 2D Rendering
  SpriteBatch / Camera2D / TilemapRenderer / TextRenderer / ParticleSystem

Layer 1 ─ Graphics Abstraction
  IGfxDevice / BufferPool / TextureManager / PipelineCache / ShaderLib
```

### 2.1 Layer 1 — 图形抽象

- **IGfxDevice**: WebGPU 和 WebGL 2 的统一抽象接口
- 运行时检测：优先 WebGPU，降级 WebGL 2
- 关键接口：

```typescript
interface IGfxDevice {
  createBuffer(desc: BufferDesc): GfxBuffer;
  createTexture(desc: TextureDesc): GfxTexture;
  createPipeline(desc: PipelineDesc): GfxPipeline;
  createShader(desc: ShaderDesc): GfxShader;
  beginRenderPass(desc: RenderPassDesc): void;
  draw(pipeline: GfxPipeline, bindings: Bindings, drawCall: DrawCall): void;
  endRenderPass(): void;
  submit(): void;
}
```

- **BufferPool**: 预分配 GPU Buffer，避免每帧创建
- **TextureManager**: 纹理加载/缓存/引用计数
- **PipelineCache**: 根据 shader + blend + depth 状态缓存 Pipeline
- **ShaderLib**: WGSL shader 管理（WebGL 后端需 GLSL 转译或预编写对应版本）

### 2.2 Layer 2 — 2D 渲染

#### SpriteBatch（GPU Instancing）

- 按纹理分批，相同纹理的 sprite 合并为一个 draw call
- 实例数据：position (vec2), scale (vec2), rotation (float), uv_rect (vec4), color (vec4)
- 使用 instanced drawing，一次 draw call 渲染数百 sprite

```typescript
class SpriteBatch {
  begin(camera: Camera2D): void;
  draw(texture: GfxTexture, x: number, y: number, w: number, h: number,
       u: number, v: number, uw: number, vh: number): void;
  end(): void; // flush all batched draw calls
}
```

#### Camera2D

```typescript
class Camera2D {
  position: Vec2;
  zoom: number;
  rotation: number;
  viewportWidth: number;
  viewportHeight: number;
  getViewProjectionMatrix(): Mat3;
}
```

#### TilemapRenderer

- 输入: TilemapData（解析后的地图数据）+ Camera2D
- 只渲染视口内可见的 tile（culling）
- 支持多 layer 叠加渲染

### 2.3 Layer 3 — 游戏框架

#### GameLoop

```typescript
class GameLoop {
  private running = false;
  private lastTime = 0;

  start(updateFn: (dt: number) => void, renderFn: () => void): void {
    this.running = true;
    const loop = (time: number) => {
      if (!this.running) return;
      const dt = Math.min((time - this.lastTime) / 1000, 0.05); // cap delta
      this.lastTime = time;
      updateFn(dt);
      renderFn();
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  stop(): void { this.running = false; }
}
```

#### InputManager

- 统一 keyboard + mouse/touch
- 支持 WASD + Arrow Keys + Space
- 提供 `isDown(key)`, `justPressed(key)`, `justReleased(key)`

#### AssetManager

- 异步加载资源：`await assets.load<GfxTexture>("assets/player.png")`
- 路径即 key，自动去重
- 支持的类型：图片（png/jpg/webp）、音频（mp3/ogg）、JSON、JSONC

#### SceneManager

- 场景切换：`scenes.goto("level1")`
- 场景生命周期：`enter()` → `update(dt)` → `render()` → `exit()`

#### ECS（Entity Component System）

- Entity = number（纯 ID）
- Component = 纯数据对象
- System = 纯函数，遍历具有特定 Component 组合的 Entity

```typescript
// 组件定义 — 纯数据
interface Position { x: number; y: number; }
interface Velocity { dx: number; dy: number; }
interface Sprite { texture: GfxTexture; u: number; v: number; w: number; h: number; }

// 系统定义 — 纯函数
function movementSystem(world: World, dt: number): void {
  for (const [entity, pos, vel] of world.query<[Position, Velocity]>()) {
    pos.x += vel.dx * dt;
    pos.y += vel.dy * dt;
  }
}
```

#### AudioManager

- Web Audio API 封装
- 支持 BGM（循环）+ SFX（单次）
- 音量控制、淡入淡出

### 2.4 Layer 4 — 编辑器（可选模块）

详见下方第 8 节。

---

## 3. 项目目录结构

### 3.1 三层约定

#### Bare（极简，单文件即可）

```
my-game/
├── index.html
├── main.ts
└── assets/
    └── tileset.png
```

#### Light（轻量项目）

```
my-game/
├── game.json              # 项目配置入口
├── index.html
├── src/
│   └── main.ts
├── data/
│   ├── levels/
│   │   └── level1.tilemap.json
│   └── scenes/
│       └── title.scene.json
└── assets/
    ├── tilesets/
    │   └── grass.png
    ├── sprites/
    │   └── player.atlas.json
    └── audio/
        └── bgm.mp3
```

#### Full（完整项目，编辑器管理）

```
my-game/
├── game.json
├── mote.lock              # 编辑器生成的锁文件
├── index.html
├── src/
│   ├── main.ts
│   ├── scenes/
│   │   ├── TitleScene.ts
│   │   └── GameScene.ts
│   ├── systems/
│   │   ├── MovementSystem.ts
│   │   └── CollisionSystem.ts
│   └── components/
│       └── index.ts
├── data/
│   ├── levels/
│   │   └── level1.tilemap.json
│   ├── scenes/
│   │   └── title.scene.json
│   ├── prefabs/
│   │   └── player.prefab.json
│   └── dialogs/
│       └── intro.dialog.json
└── assets/
    ├── tilesets/
    ├── sprites/
    ├── audio/
    └── fonts/
```

### 3.2 目录职责分离

| 目录 | 内容 | 说明 |
|------|------|------|
| `src/` | TypeScript 源码 | 游戏逻辑、场景类、系统、组件定义 |
| `data/` | JSONC 数据文件 | 关卡、场景配置、预制体、对话——**可手写/AI 生成** |
| `assets/` | 二进制资源 | 图片、音频、字体——**不可手写** |

---

## 4. 核心数据格式

### 4.1 game.json（项目入口）

```jsonc
{
  "name": "My Adventure",
  "entry": "data/scenes/title.scene.json",
  "resolution": { "width": 960, "height": 540 },
  "pixelPerfect": true,
  "sceneBindings": {
    "title": "TitleScene",
    "level1": "GameScene"
  }
}
```

### 4.2 Tilemap 格式

#### 单 Tileset（极简游戏推荐）

```jsonc
{
  "tileSize": 32,
  "width": 15,
  "height": 9,
  "tileset": "assets/tilesets/grass.png",
  "columns": 8,
  // margin 和 spacing 默认为 0，可省略
  // "margin": 0,
  // "spacing": 0,
  "data": [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 8, 8, 8, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 8, 8, 0, 0,
    0, 0, 1, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 4, 5, 6, 0, 0, 0, 7, 0, 7, 0, 0, 0, 0,
    2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,
    5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5
  ],
  "playerSpawn": { "x": 32, "y": 160 },
  "coins": [
    { "x": 176, "y": 128 },
    { "x": 352, "y": 64 }
  ]
}
```

- Tile ID 0 = 空气（不渲染）
- `data` 数组长度 = width × height
- UV 计算：`col = id % columns`, `row = floor(id / columns)`, `u = col * tileSize`, `v = row * tileSize`

#### 多 Tileset（小型游戏，Tiled 兼容）

```jsonc
{
  "tileSize": 32,
  "width": 15,
  "height": 9,
  "tilesets": [
    { "image": "assets/tilesets/grass.png", "columns": 8, "tilecount": 8  },
    { "image": "assets/tilesets/cave.png",  "columns": 6, "tilecount": 6  },
    { "image": "assets/tilesets/deco.png",  "columns": 4, "tilecount": 4  }
  ],
  "layers": [
    { "name": "ground",     "data": [1, 2, 2, 2, 3, 0, 0, 9, 10, 0, 0, 0, 0, 0, 0] },
    { "name": "decoration", "data": [0, 0, 0, 0, 0, 0, 15, 0, 0, 0, 0, 0, 0, 0, 0] }
  ]
}
```

- **firstgid 不在文件中存储**，引擎加载时按 tilesets 声明顺序自动计算
- firstgid 计算规则：第一个 tileset 的 firstgid = 1，后续 = 前一个 firstgid + 前一个 tilecount
- GID 0 = 空气
- GID 解析：从 tilesets 数组末尾向前找第一个 `firstgid <= gid` 的 tileset，`localId = gid - firstgid`

```typescript
function buildTilesetIndex(tilesets: TilesetDef[]): TilesetRef[] {
  let nextGid = 1;
  return tilesets.map(ts => {
    const ref = { ...ts, firstgid: nextGid };
    nextGid += ts.tilecount;
    return ref;
  });
}

function resolveTile(gid: number, tilesets: TilesetRef[], tileSize: number) {
  if (gid === 0) return null;
  let ts: TilesetRef | null = null;
  for (let i = tilesets.length - 1; i >= 0; i--) {
    if (gid >= tilesets[i].firstgid) { ts = tilesets[i]; break; }
  }
  if (!ts) return null;
  const localId = gid - ts.firstgid;
  const col = localId % ts.columns;
  const row = Math.floor(localId / ts.columns);
  return { texture: ts.texture, u: col * tileSize, v: row * tileSize };
}
```

#### Tileset 规则

- Tileset 中的 tile **必须等大**，必须网格排列
- 增加 tile 时只能**追加在图片末尾**（增加行），不改变已有 tile 的 localId
- `margin`（边缘留白）和 `spacing`（tile 间距）字段可选，默认 0，MVP 阶段不需要实现

### 4.3 Sprite Atlas 格式（用于角色/道具等非 tile 精灵）

```jsonc
// player.atlas.json
{
  "image": "assets/sprites/characters.png",
  "frames": {
    "player-idle-0":  { "x": 0,   "y": 0,  "w": 32, "h": 48 },
    "player-idle-1":  { "x": 32,  "y": 0,  "w": 32, "h": 48 },
    "player-run-0":   { "x": 64,  "y": 0,  "w": 32, "h": 48 },
    "player-run-1":   { "x": 96,  "y": 0,  "w": 32, "h": 48 },
    "coin-0":         { "x": 0,   "y": 48, "w": 16, "h": 16 },
    "coin-1":         { "x": 16,  "y": 48, "w": 16, "h": 16 }
  }
}
```

- Tileset（等尺寸网格）vs Sprite Atlas（任意尺寸精灵）是两个不同概念
- Tileset 用于 tilemap 渲染，Sprite Atlas 用于实体/角色/UI

### 4.4 可破坏/可交互 Tile

地图分两层：不可变的 `terrain` 层 + 可变的 `interactive` 层：

```jsonc
{
  "tileSize": 32,
  "width": 10,
  "height": 8,
  "tileset": "assets/farm.png",
  "columns": 8,
  "layers": {
    "terrain": [1, 1, 1, 2, 2, 2, 1, 1, 1, 1, ...],
    "interactive": [0, 0, 3, 3, 0, 0, 0, 0, 0, 0, ...]
  }
}
```

运行时修改 `interactive` 层的 tile ID 即可实现破坏/替换/种地：

```typescript
// 破坏石头 → 翻土
if (interactive[index] === STONE) interactive[index] = TILLED;
// 播种
if (interactive[index] === TILLED) interactive[index] = SEED;
```

附加状态（生长天数、浇水等）用平行的 metadata 数组管理，不存在 tilemap 文件中。

### 4.5 存档格式

```jsonc
// save.json — 只存运行时变化，不改原始地图文件
{
  "map": "data/levels/farm.tilemap.json",
  "interactiveOverride": {
    "15": 4,
    "16": 7
  },
  "tileMeta": {
    "16": { "growthDay": 7, "watered": false, "quality": 2 }
  },
  "day": 12,
  "inventory": { "crop": 5, "seed": 3 }
}
```

加载流程：读原始地图 → 覆盖 interactiveOverride → 恢复 tileMeta。

---

## 5. 碰撞系统

### AABB 碰撞检测

```typescript
function moveAndCollide(
  entity: { x: number; y: number; w: number; h: number },
  dx: number, dy: number,
  isSolid: (tileX: number, tileY: number) => boolean,
  isPlatform: (tileX: number, tileY: number) => boolean,
  tileSize: number
): void {
  // 先水平移动
  entity.x += dx;
  // 检测水平碰撞，推出重叠
  resolveHorizontal(entity, isSolid, tileSize);

  // 再垂直移动
  entity.y += dy;
  // 检测垂直碰撞，推出重叠
  resolveVertical(entity, isSolid, isPlatform, tileSize);
}
```

- 水平和垂直分开处理，避免对角卡墙
- `isSolid(tx, ty)`: 检查 tile 是否为实心（地面、墙壁）
- `isPlatform(tx, ty)`: 单向平台，只从上方碰撞（`vy > 0` 且脚部刚进入 tile 时才阻挡）

---

## 6. 输入系统

```typescript
class InputManager {
  private keys = new Set<string>();
  private justPressedKeys = new Set<string>();
  private justReleasedKeys = new Set<string>();

  constructor() {
    window.addEventListener("keydown", e => {
      if (!this.keys.has(e.code)) this.justPressedKeys.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener("keyup", e => {
      this.keys.delete(e.code);
      this.justReleasedKeys.add(e.code);
    });
  }

  isDown(code: string): boolean { return this.keys.has(code); }
  justPressed(code: string): boolean { return this.justPressedKeys.has(code); }
  justReleased(code: string): boolean { return this.justReleasedKeys.has(code); }

  // 每帧末尾调用
  endFrame(): void {
    this.justPressedKeys.clear();
    this.justReleasedKeys.clear();
  }
}
```

默认按键映射：WASD + Arrow Keys 移动，Space 跳跃。

---

## 7. 分发策略

### 7.1 PWA（推荐，首选方案）

- `manifest.json`: name, short_name, start_url, display: "standalone", icons
- `sw.js`: Service Worker，cache-first 策略
- 用户可"安装"到桌面，双击打开，体验接近原生应用
- **必须 HTTPS 或 localhost**（Secure Context 要求）

### 7.2 单页 HTML 导出

- 使用 `vite-plugin-singlefile` 将所有 JS/CSS 内联到一个 HTML
- 需要额外的本地启动方案（因 file:// 不满足 Secure Context）：
  - BAT + PowerShell 脚本启动本地 HTTP 服务器
  - 或 Python `http.server`

### 7.3 Tauri（未来方向）

- Rust + 系统 WebView，打包体积 ~3-5MB（vs Electron ~80-150MB）
- 原生文件系统访问，不受浏览器安全限制
- 适合需要桌面发行版的场景

---

## 8. 编辑器架构（Layer 4，可选模块）

### 8.1 UI 框架

- **Preact**（~3KB gzip），React 兼容的 Hooks/JSX
- 选择理由：体积极小、AI 代码生成质量最佳（React 生态兼容）、Hooks 模式适合编辑器状态管理

### 8.2 核心模块

#### EditorBridge

编辑器 UI 与引擎运行时之间的唯一接口层：

```typescript
interface EditorBridge {
  // 场景操作
  getEntities(): Entity[];
  createEntity(components: ComponentMap): Entity;
  deleteEntity(id: Entity): void;

  // 组件操作
  getComponent<T>(entity: Entity, type: ComponentType<T>): T | null;
  setComponent<T>(entity: Entity, type: ComponentType<T>, data: T): void;

  // 资源
  loadAsset(path: string): Promise<unknown>;

  // 运行控制
  play(): void;
  pause(): void;
  stop(): void;
}
```

#### CommandHistory（Undo/Redo）

```typescript
interface Command {
  execute(): void;
  undo(): void;
  description: string;
}

class CommandHistory {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];

  execute(cmd: Command): void {
    cmd.execute();
    this.undoStack.push(cmd);
    this.redoStack.length = 0; // 清空 redo
  }

  undo(): void {
    const cmd = this.undoStack.pop();
    if (cmd) { cmd.undo(); this.redoStack.push(cmd); }
  }

  redo(): void {
    const cmd = this.redoStack.pop();
    if (cmd) { cmd.execute(); this.undoStack.push(cmd); }
  }
}
```

#### SelectionManager

- 当前选中的 Entity 列表
- 使用 Signal/EventEmitter 通知 UI 更新
- 支持多选（Ctrl+Click）、框选

#### TransformGizmo

- Viewport 内的拖拽手柄
- 移动（平移）、缩放模式
- 操作产生 Command，支持 Undo

#### ProjectManager

- 封装 File System Access API
- `showDirectoryPicker()` 打开项目文件夹
- `FileSystemDirectoryHandle` 持久化到 IndexedDB（下次打开不用重新选择）
- 提供 `readFile(path)` / `writeFile(path, content)` / `listDir(path)` 等高级 API

### 8.3 编辑器面板布局

```
┌─────────────────────────────────────────────────────┐
│  Menu Bar (File / Edit / View / Help)                │
├──────────┬──────────────────────────┬───────────────┤
│          │                          │               │
│ Scene    │      Viewport            │  Inspector    │
│ Tree     │   (Canvas + Gizmos)      │  (Properties) │
│          │                          │               │
│          │                          │               │
├──────────┴──────────────────────────┴───────────────┤
│  Asset Browser / Console / Timeline                  │
└─────────────────────────────────────────────────────┘
```

---

## 9. 文件系统访问

### File System Access API

```typescript
// 打开目录
const dirHandle = await window.showDirectoryPicker();

// 读文件
const fileHandle = await dirHandle.getFileHandle("game.json");
const file = await fileHandle.getFile();
const text = await file.text();

// 写文件
const writable = await fileHandle.createWritable();
await writable.write(newContent);
await writable.close();

// 遍历目录
for await (const [name, handle] of dirHandle) {
  console.log(name, handle.kind); // "file" | "directory"
}
```

- **仅限 Chromium 内核浏览器**（Chrome, Edge, Opera）
- 需要 Secure Context（HTTPS 或 localhost）
- 首次打开需要用户授权，句柄可存入 IndexedDB 持久化

### IndexedDB 存储

- 用于存档、编辑器状态持久化、资源缓存、目录句柄持久化
- 推荐使用 `idb` 库（~1KB）封装 Promise API
- 容量：Chrome 可用磁盘空间的 60%，足够游戏使用

```typescript
import { openDB } from "idb";

const db = await openDB("mote-editor", 1, {
  upgrade(db) {
    db.createObjectStore("saves", { keyPath: "id" });
    db.createObjectStore("editor-state", { keyPath: "id" });
    db.createObjectStore("asset-cache", { keyPath: "path" });
  },
});

// 持久化目录句柄
await db.put("editor-state", { id: "project-dir", handle: dirHandle });

// 恢复
const record = await db.get("editor-state", "project-dir");
await record.handle.requestPermission({ mode: "readwrite" });
```

---

## 10. 构建工具链

### 开发环境

- **Vite** 作为开发服务器和打包工具
- TypeScript → ESBuild 转译（Vite 内置）
- 热更新（HMR）支持

### 构建输出

```bash
# 开发
npx vite dev

# 生产构建
npx vite build

# 单 HTML 导出
npx vite build  # 配合 vite-plugin-singlefile
```

### vite.config.ts 参考

```typescript
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";
// import { viteSingleFile } from "vite-plugin-singlefile"; // 单 HTML 时启用

export default defineConfig({
  plugins: [
    preact(),
    // viteSingleFile(),
  ],
  build: {
    target: "esnext",
    outDir: "dist",
  },
});
```

---

## 11. ADR（架构决策记录）

| ADR | 决策 | 原因 |
|-----|------|------|
| ADR-001 | WebGPU 优先，WebGL 2 降级 | WebGPU 是未来标准，WebGL 2 保证兼容性 |
| ADR-002 | Preact 作为编辑器 UI 框架 | 3KB 体积、React 兼容、AI 生成质量最佳 |
| ADR-003 | 路径优先引用，UUID 可选 | 编辑器可选场景下 UUID 增加管理成本 |
| ADR-004 | JSONC 作为数据格式 | 支持注释，手写友好，JSON Schema 可校验 |
| ADR-005 | Command 模式实现 Undo/Redo | 编辑器操作可逆，历史栈管理 |
| ADR-006 | File System Access API + IndexedDB | 浏览器端文件读写 + 句柄持久化 |
| ADR-007 | PWA 作为首选分发方案 | 免安装、双击打开、满足 Secure Context |
| ADR-008 | ECS 架构（Entity=number, Component=data, System=function） | 数据驱动、组合优于继承、性能友好 |
| ADR-009 | Tilemap firstgid 自动计算 | 文件不存 firstgid，按声明顺序运行时算，手写友好 |
| ADR-010 | Tileset 只追加不插入 | 避免 firstgid 级联偏移，无需迁移工具 |
| ADR-011 | Tileset vs Sprite Atlas 分离 | Tileset 等大网格用于地图，Atlas 任意尺寸用于实体 |
| ADR-012 | 地图分 terrain + interactive 层 | 不可变地形 + 可变交互层，支持破坏/种地玩法 |
| ADR-013 | 存档只存 diff（override） | 原始地图文件不修改，所有运行时变化存在 save.json |

---

## 12. 实现优先级

### Phase 1 — 引擎核心（MVP）

1. IGfxDevice（WebGL 2 后端优先，覆盖面最广）
2. TextureManager（加载 PNG/JPG）
3. SpriteBatch（GPU instancing 批量渲染）
4. Camera2D（视口 + 缩放）
5. TilemapRenderer（单 tileset 格式）
6. GameLoop + InputManager
7. AABB 碰撞系统
8. AssetManager（异步加载 + 缓存）

### Phase 2 — 游戏框架

9. SceneManager（场景切换 + 生命周期）
10. ECS（World, Entity, Component, System, Query）
11. AudioManager（Web Audio API）
12. 多 tileset 支持（firstgid 自动计算）
13. Sprite Atlas 支持
14. 存档系统（IndexedDB）

### Phase 3 — 编辑器

15. ProjectManager（File System Access API）
16. EditorBridge（引擎 ↔ UI 桥接）
17. CommandHistory（Undo/Redo）
18. Viewport（Canvas 嵌入 Preact 布局）
19. Scene Tree 面板
20. Inspector 面板
21. Tilemap Editor
22. Asset Browser

### Phase 4 — 分发

23. PWA（manifest.json + Service Worker）
24. 单 HTML 导出（vite-plugin-singlefile）
25. 离线启动脚本（BAT + PowerShell）
26. Tauri 集成（可选）

---

## 13. 已有参考代码

### main.ts 核心游戏循环（已验证可运行）

功能包含：
- 8 种 tile 的 tileset 渲染（grass-top-left, grass-top, grass-top-right, dirt-left, dirt-fill, dirt-right, stone, wood-platform）
- AABB 碰撞检测 + 单向平台
- 玩家移动（WASD/方向键 + 空格跳跃）
- 面朝方向 + 帧动画
- 金币收集 + 计分

关键函数签名：

```typescript
function tileUV(id: number): { u: number; v: number };
function getTile(tx: number, ty: number): number;
function isSolid(tx: number, ty: number): boolean;
function isPlatform(tx: number, ty: number): boolean;
function moveAndCollide(
  e: { x: number; y: number; w: number; h: number; vx: number; vy: number; onGround: boolean },
  dt: number
): void;
```

---

## 14. 约束与注意事项

1. **Secure Context**: WebGPU 和 File System Access API 都需要 HTTPS 或 localhost
2. **浏览器兼容性**: File System Access API 仅 Chromium 内核；WebGPU 需 Chrome 113+ / Edge 113+ / Firefox Nightly
3. **像素游戏采样**: 使用 `nearest` 过滤（非 `linear`），避免纹理模糊
4. **Delta Time 上限**: `dt = Math.min(realDt, 0.05)` 防止跳帧穿墙
5. **tileset 图片格式**: 仅支持 PNG（推荐，无损）和 JPG，不支持内嵌压缩纹理
6. **JSONC 解析**: 需要在 AssetManager 中集成 JSONC 解析器（去除 `//` 和 `/* */` 注释后 JSON.parse）
7. **坐标系**: 左上角为原点，X 向右，Y 向下（与 Canvas/DOM 一致）
