# mote Editor — 网页端 2D 游戏编辑器技术规格书

> **目标读者**: AI Coding Agent (Codex)
> **项目**: mote（微尘）— 2D Web Game Engine
> **范围**: 本文档仅覆盖**编辑器 + 项目管理**部分，不涉及引擎渲染核心
> **技术栈**: TypeScript + Preact + File System Access API + IndexedDB + Vite

---

## 1. 编辑器定位

mote 编辑器是一个**浏览器内运行的 2D 游戏项目编辑器**，类似 Tiled / Unity / Godot 的网页版。

核心约束：

- **编辑器是可选的** — 所有游戏数据都是人类可读的 JSONC 文件，可以手写或 AI 生成，不依赖编辑器
- **编辑器是增强** — 提供可视化编辑、拖拽、Undo/Redo 等便利功能
- **纯前端** — 无后端服务器，所有数据存储在用户本地文件系统和浏览器 IndexedDB 中

---

## 2. UI 架构

### 2.1 框架选型

**Preact**（~3KB gzip），React 兼容的 Hooks/JSX 框架。

选择理由：
- 体积极小，嵌入游戏引擎零负担
- 完全兼容 React 生态（Hooks, JSX, Context）
- AI 代码生成质量最佳（与 React 代码等价）

依赖安装：

```bash
npm install preact
npm install -D @preact/preset-vite
```

Vite 配置：

```typescript
// vite.config.ts
import { defineConfig } from "vite";
import preact from "@preact/preset-vite";

export default defineConfig({
  plugins: [preact()],
  build: { target: "esnext" },
});
```

TSConfig 别名（使 `import React` 自动指向 Preact）：

```jsonc
// tsconfig.json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "preact",
    "paths": {
      "react": ["./node_modules/preact/compat/"],
      "react-dom": ["./node_modules/preact/compat/"]
    }
  }
}
```

并且开发每个功能后，都使用vitest 进行自动化测试。

### 2.2 面板布局

```
┌─────────────────────────────────────────────────────────┐
│  MenuBar  [File ▾] [Edit ▾] [View ▾] [Help ▾]          │
├───────────┬───────────────────────────┬─────────────────┤
│           │                           │                 │
│  Scene    │       Viewport            │   Inspector     │
│  Tree     │    (Canvas + Gizmos)      │  (Properties)   │
│           │                           │                 │
│  左侧面板 │    中央渲染区域             │   右侧属性面板   │
│  ~220px   │    flex: 1                │   ~280px        │
│           │                           │                 │
├───────────┴───────────────────────────┴─────────────────┤
│  BottomPanel  [Assets] [Console] [Tilemap]              │
│  底部面板 ~200px，可折叠，Tab 切换                          │
└─────────────────────────────────────────────────────────┘
```

实现要点：
- 使用 CSS Grid 实现主布局：`grid-template-columns: 220px 1fr 280px`
- 面板之间用可拖拽的分割条（Resizer）调整宽度
- 底部面板可折叠（点击 Tab 收起/展开），高度可拖拽
- Viewport 区域嵌入一个 `<canvas>` 元素，引擎在此渲染

### 2.3 组件结构

```
<EditorApp>                          -- 顶层容器，提供全局 Context
├── <MenuBar />                      -- 菜单栏
├── <EditorLayout>                   -- CSS Grid 主布局
│   ├── <SceneTreePanel />           -- 左：实体树
│   ├── <ViewportPanel>              -- 中：渲染视口
│   │   ├── <canvas ref={canvasRef}> -- 引擎渲染目标
│   │   └── <GizmoOverlay />         -- 叠加在 canvas 上的 SVG/DOM gizmo
│   └── <InspectorPanel />           -- 右：属性编辑
├── <BottomPanel>                    -- 底部 Tab 面板
│   ├── <AssetBrowser />             -- 资源浏览器
│   ├── <ConsolePanel />             -- 控制台/日志
│   └── <TilemapEditor />            -- Tilemap 编辑面板
└── <ModalManager />                 -- 模态对话框层
```

---

## 3. 核心模块

### 3.1 EditorBridge — 编辑器与引擎的唯一桥接口

编辑器 UI（Preact）不直接操作引擎内部，所有交互通过 Bridge 完成：

```typescript
// src/editor/EditorBridge.ts

interface EditorBridge {
  // === 场景实体操作 ===
  getEntities(): EntityInfo[];
  createEntity(name: string, components?: Record<string, unknown>): number;
  deleteEntity(id: number): void;
  duplicateEntity(id: number): number;
  reparentEntity(id: number, newParentId: number | null): void;

  // === 组件操作 ===
  getComponents(entityId: number): Record<string, unknown>;
  setComponentField(entityId: number, componentType: string, field: string, value: unknown): void;
  addComponent(entityId: number, componentType: string, data?: unknown): void;
  removeComponent(entityId: number, componentType: string): void;

  // === 资源 ===
  loadAsset<T>(path: string): Promise<T>;
  getAssetList(directory: string): Promise<AssetInfo[]>;

  // === 场景序列化 ===
  serializeScene(): string;       // 导出为 JSONC
  deserializeScene(json: string): void;  // 从 JSONC 加载

  // === 运行控制 ===
  play(): void;
  pause(): void;
  stop(): void;
  isPlaying(): boolean;

  // === Tilemap ===
  getTilemapData(): TilemapData | null;
  setTile(layerName: string, x: number, y: number, tileId: number): void;
  getTile(layerName: string, x: number, y: number): number;

  // === 事件 ===
  on(event: EditorEvent, callback: (...args: any[]) => void): () => void;
}

type EditorEvent =
  | "entity-created"
  | "entity-deleted"
  | "entity-changed"
  | "selection-changed"
  | "scene-loaded"
  | "play-state-changed";

interface EntityInfo {
  id: number;
  name: string;
  parentId: number | null;
  children: number[];
  components: string[];  // 组件类型名列表
}

interface AssetInfo {
  path: string;
  name: string;
  type: "image" | "audio" | "json" | "unknown";
  size: number;
}
```

### 3.2 CommandHistory — Undo/Redo

所有编辑器操作封装为 Command 对象，支持完整的撤销/重做：

```typescript
// src/editor/CommandHistory.ts

interface Command {
  /** 执行操作 */
  execute(): void;
  /** 撤销操作（必须完全还原 execute 的效果） */
  undo(): void;
  /** 用于显示在 Edit 菜单中的描述 */
  description: string;
}

class CommandHistory {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private maxHistory = 100;

  /** 执行命令并压入 undo 栈 */
  execute(cmd: Command): void {
    cmd.execute();
    this.undoStack.push(cmd);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack.length = 0;  // 新操作清空 redo
    this.onChange?.();
  }

  undo(): void {
    const cmd = this.undoStack.pop();
    if (!cmd) return;
    cmd.undo();
    this.redoStack.push(cmd);
    this.onChange?.();
  }

  redo(): void {
    const cmd = this.redoStack.pop();
    if (!cmd) return;
    cmd.execute();
    this.undoStack.push(cmd);
    this.onChange?.();
  }

  canUndo(): boolean { return this.undoStack.length > 0; }
  canRedo(): boolean { return this.redoStack.length > 0; }

  /** UI 订阅变化 */
  onChange: (() => void) | null = null;
}
```

常见 Command 实现：

```typescript
// 移动实体
class MoveEntityCommand implements Command {
  description: string;
  constructor(
    private bridge: EditorBridge,
    private entityId: number,
    private oldX: number, private oldY: number,
    private newX: number, private newY: number,
  ) {
    this.description = `Move entity ${entityId}`;
  }
  execute() {
    this.bridge.setComponentField(this.entityId, "Position", "x", this.newX);
    this.bridge.setComponentField(this.entityId, "Position", "y", this.newY);
  }
  undo() {
    this.bridge.setComponentField(this.entityId, "Position", "x", this.oldX);
    this.bridge.setComponentField(this.entityId, "Position", "y", this.oldY);
  }
}

// 设置 Tile
class SetTileCommand implements Command {
  description: string;
  constructor(
    private bridge: EditorBridge,
    private layer: string,
    private x: number, private y: number,
    private oldTileId: number,
    private newTileId: number,
  ) {
    this.description = `Set tile (${x},${y}) to ${newTileId}`;
  }
  execute() { this.bridge.setTile(this.layer, this.x, this.y, this.newTileId); }
  undo() { this.bridge.setTile(this.layer, this.x, this.y, this.oldTileId); }
}

// 批量操作（画笔涂多个 tile）
class BatchCommand implements Command {
  constructor(
    private commands: Command[],
    public description: string,
  ) {}
  execute() { this.commands.forEach(c => c.execute()); }
  undo() {
    // 逆序撤销
    for (let i = this.commands.length - 1; i >= 0; i--) {
      this.commands[i].undo();
    }
  }
}
```

快捷键绑定：
- `Ctrl+Z` → undo
- `Ctrl+Shift+Z` 或 `Ctrl+Y` → redo

### 3.3 SelectionManager — 选中状态管理

```typescript
// src/editor/SelectionManager.ts
import { signal, Signal } from "@preact/signals";

class SelectionManager {
  /** 当前选中的实体 ID 列表（响应式） */
  readonly selected: Signal<number[]> = signal([]);

  /** 选中单个实体（替换已有选中） */
  select(entityId: number): void {
    this.selected.value = [entityId];
  }

  /** 追加选中（Ctrl+Click） */
  toggleSelect(entityId: number): void {
    const current = this.selected.value;
    if (current.includes(entityId)) {
      this.selected.value = current.filter(id => id !== entityId);
    } else {
      this.selected.value = [...current, entityId];
    }
  }

  /** 清空选中 */
  clear(): void {
    this.selected.value = [];
  }

  /** 获取主选中实体（第一个） */
  get primary(): number | null {
    return this.selected.value[0] ?? null;
  }

  /** 是否选中了指定实体 */
  isSelected(entityId: number): boolean {
    return this.selected.value.includes(entityId);
  }
}
```

使用 `@preact/signals` 实现响应式——当 `selected.value` 改变时，所有引用它的 Preact 组件自动重渲染。

### 3.4 TransformGizmo — 视口拖拽操作

```typescript
// src/editor/TransformGizmo.ts

type GizmoMode = "translate" | "scale";

class TransformGizmo {
  mode: GizmoMode = "translate";
  private dragging = false;
  private dragStartWorld: Vec2 = { x: 0, y: 0 };
  private entityStartPos: Vec2 = { x: 0, y: 0 };

  constructor(
    private selection: SelectionManager,
    private bridge: EditorBridge,
    private history: CommandHistory,
    private camera: Camera2D,
  ) {}

  /** 视口 canvas 的 pointerdown 事件 */
  onPointerDown(screenX: number, screenY: number): void {
    const entityId = this.selection.primary;
    if (entityId === null) return;

    const world = this.camera.screenToWorld(screenX, screenY);
    const pos = this.bridge.getComponents(entityId).Position as { x: number; y: number };
    if (!pos) return;

    this.dragging = true;
    this.dragStartWorld = world;
    this.entityStartPos = { x: pos.x, y: pos.y };
  }

  /** 视口 canvas 的 pointermove 事件 */
  onPointerMove(screenX: number, screenY: number): void {
    if (!this.dragging) return;
    const entityId = this.selection.primary;
    if (entityId === null) return;

    const world = this.camera.screenToWorld(screenX, screenY);
    const dx = world.x - this.dragStartWorld.x;
    const dy = world.y - this.dragStartWorld.y;

    // 实时预览（不入 history）
    this.bridge.setComponentField(entityId, "Position", "x", this.entityStartPos.x + dx);
    this.bridge.setComponentField(entityId, "Position", "y", this.entityStartPos.y + dy);
  }

  /** 视口 canvas 的 pointerup 事件 */
  onPointerUp(screenX: number, screenY: number): void {
    if (!this.dragging) return;
    this.dragging = false;

    const entityId = this.selection.primary;
    if (entityId === null) return;

    const world = this.camera.screenToWorld(screenX, screenY);
    const finalX = this.entityStartPos.x + (world.x - this.dragStartWorld.x);
    const finalY = this.entityStartPos.y + (world.y - this.dragStartWorld.y);

    // 只有实际移动了才入 history
    if (finalX !== this.entityStartPos.x || finalY !== this.entityStartPos.y) {
      // 先还原到起始位置（因为 execute 会设置到终点）
      this.bridge.setComponentField(entityId, "Position", "x", this.entityStartPos.x);
      this.bridge.setComponentField(entityId, "Position", "y", this.entityStartPos.y);
      // 通过 Command 执行，支持 Undo
      this.history.execute(new MoveEntityCommand(
        this.bridge, entityId,
        this.entityStartPos.x, this.entityStartPos.y,
        finalX, finalY,
      ));
    }
  }
}
```

快捷键：
- `W` → translate 模式
- `S` → scale 模式（注意避免和游戏 WASD 冲突，编辑器模式下拦截）

### 3.5 ProjectManager — 本地文件系统管理

```typescript
// src/editor/ProjectManager.ts
import { openDB, IDBPDatabase } from "idb";

class ProjectManager {
  private dirHandle: FileSystemDirectoryHandle | null = null;
  private db: IDBPDatabase | null = null;

  /** 初始化 IndexedDB */
  async init(): Promise<void> {
    this.db = await openDB("mote-editor", 1, {
      upgrade(db) {
        db.createObjectStore("state", { keyPath: "id" });
      },
    });
  }

  /** 打开项目文件夹（首次使用） */
  async openProject(): Promise<boolean> {
    try {
      this.dirHandle = await window.showDirectoryPicker({ mode: "readwrite" });
      // 持久化句柄到 IndexedDB
      await this.db!.put("state", { id: "project-dir", handle: this.dirHandle });
      return true;
    } catch {
      return false; // 用户取消
    }
  }

  /** 恢复上次打开的项目（下次启动时调用） */
  async restoreProject(): Promise<boolean> {
    const record = await this.db!.get("state", "project-dir");
    if (!record?.handle) return false;

    // 请求权限（浏览器安全策略要求每次会话重新授权）
    const perm = await record.handle.requestPermission({ mode: "readwrite" });
    if (perm !== "granted") return false;

    this.dirHandle = record.handle;
    return true;
  }

  /** 读取文本文件 */
  async readFile(relativePath: string): Promise<string> {
    const handle = await this.resolveFile(relativePath);
    const file = await handle.getFile();
    return file.text();
  }

  /** 读取 JSONC 文件（去注释后解析） */
  async readJsonc<T = unknown>(relativePath: string): Promise<T> {
    const text = await this.readFile(relativePath);
    return JSON.parse(stripJsonComments(text)) as T;
  }

  /** 写入文本文件（不存在则创建） */
  async writeFile(relativePath: string, content: string): Promise<void> {
    const handle = await this.resolveFile(relativePath, true);
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  /** 写入 JSON 文件（自动格式化） */
  async writeJson(relativePath: string, data: unknown): Promise<void> {
    await this.writeFile(relativePath, JSON.stringify(data, null, 2));
  }

  /** 列出目录内容 */
  async listDir(relativePath: string): Promise<FileEntry[]> {
    const dir = relativePath
      ? await this.resolveDir(relativePath)
      : this.dirHandle!;

    const entries: FileEntry[] = [];
    for await (const [name, handle] of dir) {
      entries.push({
        name,
        kind: handle.kind,   // "file" | "directory"
        path: relativePath ? `${relativePath}/${name}` : name,
      });
    }
    return entries.sort((a, b) => {
      // 目录排前面
      if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  /** 删除文件 */
  async deleteFile(relativePath: string): Promise<void> {
    const parts = relativePath.split("/");
    const fileName = parts.pop()!;
    const dir = parts.length > 0
      ? await this.resolveDir(parts.join("/"))
      : this.dirHandle!;
    await dir.removeEntry(fileName);
  }

  /** 检查文件是否存在 */
  async exists(relativePath: string): Promise<boolean> {
    try {
      await this.resolveFile(relativePath);
      return true;
    } catch {
      return false;
    }
  }

  // === 内部方法 ===

  private async resolveFile(
    path: string,
    create = false,
  ): Promise<FileSystemFileHandle> {
    const parts = path.split("/");
    const fileName = parts.pop()!;
    let dir = this.dirHandle!;
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create });
    }
    return dir.getFileHandle(fileName, { create });
  }

  private async resolveDir(path: string): Promise<FileSystemDirectoryHandle> {
    const parts = path.split("/");
    let dir = this.dirHandle!;
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part);
    }
    return dir;
  }
}

interface FileEntry {
  name: string;
  kind: "file" | "directory";
  path: string;
}

/** 去除 JSONC 注释 */
function stripJsonComments(text: string): string {
  return text
    .replace(/\/\/.*$/gm, "")             // 行注释
    .replace(/\/\*[\s\S]*?\*\//g, "");     // 块注释
}
```

**浏览器兼容性**: File System Access API 仅 Chromium 内核（Chrome, Edge, Opera）支持。

---

## 4. 数据格式规范

所有数据文件使用 **JSONC**（JSON with Comments），支持 `//` 行注释和 `/* */` 块注释。

### 4.1 game.json — 项目入口

```jsonc
{
  "name": "My Adventure",
  "entry": "data/scenes/title.scene.json",  // 启动场景
  "resolution": { "width": 960, "height": 540 },
  "pixelPerfect": true,
  "sceneBindings": {           // 场景名 → 代码类名映射
    "title": "TitleScene",
    "level1": "GameScene"
  }
}
```

### 4.2 Tilemap — 单 Tileset（极简游戏）

```jsonc
{
  "tileSize": 32,
  "width": 15,           // 横向 tile 数
  "height": 9,           // 纵向 tile 数
  "tileset": "assets/tilesets/grass.png",   // 单个 tileset 图片
  "columns": 8,          // tileset 图片中每行有几列 tile
  "data": [
    0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    0, 0, 1, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,
    5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5
  ]
  // data 长度 = width × height
  // 0 = 空气（不渲染）
  // UV 计算: col = id % columns, row = floor(id / columns)
  //          u = col * tileSize, v = row * tileSize
}
```

### 4.3 Tilemap — 多 Tileset（小型游戏）

```jsonc
{
  "tileSize": 32,
  "width": 15,
  "height": 9,
  "tilesets": [
    // firstgid 不写在文件中！引擎按声明顺序自动计算
    // tileset[0]: firstgid = 1, 占用 GID 1~8
    // tileset[1]: firstgid = 9, 占用 GID 9~14
    { "image": "assets/tilesets/grass.png", "columns": 8, "tilecount": 8  },
    { "image": "assets/tilesets/cave.png",  "columns": 6, "tilecount": 6  }
  ],
  "layers": [
    { "name": "terrain",    "data": [1, 2, 2, 2, 3, 0, 0, 9, 10, ...] },
    { "name": "interactive", "data": [0, 0, 0, 0, 0, 0, 15, 0, 0, ...] }
  ]
}
```

**firstgid 规则**:
- 第一个 tileset 的 firstgid = 1
- 后续 tileset 的 firstgid = 前一个 firstgid + 前一个 tilecount
- GID 0 = 空气
- 解析 GID：从 tilesets 末尾向前找第一个 `firstgid <= gid` 的 tileset

**Tileset 图片规则**:
- tile 必须等大，严格网格排列
- 增加 tile 只能追加在图片末尾（增加行），不改已有 tile 的 localId
- `margin` 和 `spacing` 字段可选，默认 0，MVP 不实现

### 4.4 Sprite Atlas — 非等尺寸精灵

```jsonc
// player.atlas.json
{
  "image": "assets/sprites/characters.png",
  "frames": {
    "player-idle-0":  { "x": 0,   "y": 0,  "w": 32, "h": 48 },
    "player-idle-1":  { "x": 32,  "y": 0,  "w": 32, "h": 48 },
    "player-run-0":   { "x": 64,  "y": 0,  "w": 32, "h": 48 },
    "coin-0":         { "x": 0,   "y": 48, "w": 16, "h": 16 }
  }
}
```

**Tileset vs Sprite Atlas**:
- Tileset = 等大网格，用于 tilemap 渲染
- Sprite Atlas = 任意尺寸，用于角色/道具/UI

### 4.5 Scene 文件

```jsonc
// title.scene.json
{
  "name": "Title",
  "entities": [
    {
      "name": "background",
      "components": {
        "Position": { "x": 0, "y": 0 },
        "Sprite": { "atlas": "assets/sprites/ui.atlas.json", "frame": "title-bg" }
      }
    },
    {
      "name": "player",
      "components": {
        "Position": { "x": 100, "y": 200 },
        "Velocity": { "dx": 0, "dy": 0 },
        "Sprite": { "atlas": "assets/sprites/characters.atlas.json", "frame": "player-idle-0" },
        "PlayerController": {}
      }
    }
  ],
  "tilemap": "data/levels/level1.tilemap.json"  // 可选，关联 tilemap
}
```

### 4.6 存档格式

```jsonc
// save.json — 只存运行时差异，不修改原始数据文件
{
  "scene": "data/scenes/game.scene.json",
  "map": "data/levels/farm.tilemap.json",
  "interactiveOverride": {   // key = tile 数组 index，value = 新 tile ID
    "15": 4,
    "16": 7
  },
  "tileMeta": {              // 附加状态（生长、浇水等）
    "16": { "growthDay": 7, "watered": false, "quality": 2 }
  },
  "day": 12,
  "inventory": { "crop": 5, "seed": 3 }
}
```

---

## 5. 项目目录结构

### 三层约定（开发者自选）

**Bare** — 极简，零结构约束：

```
my-game/
├── index.html
├── main.ts
└── assets/
    └── tileset.png
```

**Light** — 轻约定，手写 + AI 生成：

```
my-game/
├── game.json
├── index.html
├── src/
│   └── main.ts
├── data/                    # JSONC 数据文件（可手写/AI 生成）
│   ├── levels/
│   │   └── level1.tilemap.json
│   └── scenes/
│       └── title.scene.json
└── assets/                  # 二进制资源（图片/音频/字体）
    ├── tilesets/
    └── sprites/
```

**Full** — 完整项目，编辑器管理：

```
my-game/
├── game.json
├── mote.lock
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
│   ├── scenes/
│   ├── prefabs/
│   └── dialogs/
└── assets/
    ├── tilesets/
    ├── sprites/
    ├── audio/
    └── fonts/
```

**职责分离原则**:

| 目录 | 内容 | 可手写？ |
|------|------|:--------:|
| `src/` | TypeScript 代码 | ✓ |
| `data/` | JSONC 数据文件 | ✓（核心卖点） |
| `assets/` | 二进制资源 | ✗（需工具生成） |

---

## 6. IndexedDB 存储方案

编辑器使用 IndexedDB 存储持久化状态，推荐使用 `idb` 库：

```bash
npm install idb
```

### 数据库 Schema

```typescript
// src/editor/storage.ts
import { openDB } from "idb";

const DB_NAME = "mote-editor";
const DB_VERSION = 1;

export async function initEditorDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // 编辑器状态（目录句柄、窗口布局等）
      db.createObjectStore("editor-state", { keyPath: "id" });

      // 游戏存档
      db.createObjectStore("saves", { keyPath: "id" });

      // 资源缓存（图片 Blob 等）
      db.createObjectStore("asset-cache", { keyPath: "path" });

      // 最近打开的项目列表
      db.createObjectStore("recent-projects", { keyPath: "path" });
    },
  });
}
```

### 存储项

| Object Store | Key | 用途 |
|-------------|-----|------|
| `editor-state` | `"project-dir"` | 持久化 `FileSystemDirectoryHandle` |
| `editor-state` | `"layout"` | 面板布局（宽度、折叠状态） |
| `editor-state` | `"preferences"` | 编辑器偏好（网格显示、吸附等） |
| `saves` | `"slot-1"` ~ `"slot-N"` | 游戏存档（运行时差异数据） |
| `asset-cache` | 资源路径 | 加载过的图片/音频 Blob 缓存 |
| `recent-projects` | 项目路径 | 最近打开的项目记录 |

---

## 7. 编辑器全局状态管理

使用 Preact Context + Signals 管理全局状态：

```typescript
// src/editor/EditorContext.ts
import { createContext } from "preact";
import { signal } from "@preact/signals";

interface EditorStore {
  bridge: EditorBridge;
  history: CommandHistory;
  selection: SelectionManager;
  project: ProjectManager;
  gizmo: TransformGizmo;

  // 全局 UI 状态
  activeBottomTab: Signal<"assets" | "console" | "tilemap">;
  isPlaying: Signal<boolean>;
  currentTool: Signal<"select" | "tile-paint" | "tile-erase" | "entity-place">;
}

export const EditorContext = createContext<EditorStore>(null!);
```

组件中使用：

```typescript
import { useContext } from "preact/hooks";
import { EditorContext } from "../EditorContext";

function InspectorPanel() {
  const { selection, bridge } = useContext(EditorContext);
  const entityId = selection.selected.value[0];

  if (entityId == null) {
    return <div class="inspector-empty">No entity selected</div>;
  }

  const components = bridge.getComponents(entityId);

  return (
    <div class="inspector">
      {Object.entries(components).map(([type, data]) => (
        <ComponentEditor key={type} entityId={entityId} type={type} data={data} />
      ))}
    </div>
  );
}
```

---

## 8. 快捷键映射

| 快捷键 | 功能 | 上下文 |
|--------|------|--------|
| `Ctrl+Z` | Undo | 全局 |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Redo | 全局 |
| `Ctrl+S` | 保存场景 | 全局 |
| `Ctrl+O` | 打开项目 | 全局 |
| `Delete` / `Backspace` | 删除选中实体 | 选中实体时 |
| `Ctrl+D` | 复制选中实体 | 选中实体时 |
| `W` | 切换 translate 模式 | 编辑模式 |
| `E` | 切换 scale 模式 | 编辑模式 |
| `F5` / `Ctrl+P` | Play / Pause | 全局 |
| `F6` / `Ctrl+Shift+P` | Stop | 全局 |
| `Space` | 拖拽视口（按住） | 编辑模式 |
| `Scroll` | 缩放视口 | 编辑模式 |

实现：在 `<EditorApp>` 顶层监听 `keydown`，根据当前 focus 状态分发。Play 模式下快捷键不拦截（透传给游戏）。

---

## 9. 分发方式

### 9.1 PWA（首选）

```jsonc
// public/manifest.json
{
  "name": "mote Editor",
  "short_name": "mote",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#1e1e2e",
  "theme_color": "#89b4fa",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

```javascript
// public/sw.js — Service Worker (cache-first)
const CACHE_NAME = "mote-v1";
const PRECACHE = ["/", "/index.html", "/assets/icon-192.png"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(PRECACHE)));
});

self.addEventListener("fetch", e => {
  e.respondWith(
    caches.match(e.request).then(r => r || fetch(e.request))
  );
});
```

```html
<!-- index.html -->
<link rel="manifest" href="/manifest.json">
<script>
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js");
  }
</script>
```

### 9.2 单 HTML 导出

```bash
npm install -D vite-plugin-singlefile
```

```typescript
// vite.config.ts（单 HTML 模式）
import { viteSingleFile } from "vite-plugin-singlefile";
export default defineConfig({
  plugins: [preact(), viteSingleFile()],
});
```

### 9.3 Tauri（未来）

- Rust + 系统 WebView，打包 ~3-5MB
- 原生文件系统访问，不受浏览器限制
- 适合桌面发行版

---

## 10. 实现优先级

以下是编辑器相关模块的开发顺序：

| 优先级 | 模块 | 说明 |
|:------:|------|------|
| **P0** | ProjectManager | File System Access API 封装 + IndexedDB 句柄持久化 |
| **P0** | EditorBridge | 引擎 ↔ UI 桥接，定义接口即可，实现可 mock |
| **P1** | EditorLayout + Viewport | CSS Grid 布局 + Canvas 嵌入 |
| **P1** | CommandHistory | Undo/Redo 栈 |
| **P1** | SelectionManager | 实体选中 + Signals 响应式 |
| **P2** | SceneTreePanel | 实体树形展示 + 点选/拖拽排序 |
| **P2** | InspectorPanel | 组件属性编辑（自动根据组件类型生成表单） |
| **P2** | TilemapEditor | Tile 画笔/橡皮/填充 + 图集选择器 |
| **P3** | TransformGizmo | 视口内拖拽移动/缩放实体 |
| **P3** | AssetBrowser | 文件树 + 缩略图 + 拖拽到场景 |
| **P3** | MenuBar + 快捷键 | 菜单操作 + 全局键盘监听 |
| **P4** | PWA 配置 | manifest.json + Service Worker |
| **P4** | 单 HTML 导出 | vite-plugin-singlefile 集成 |

---

## 11. 约束与注意事项

1. **Secure Context**: File System Access API + WebGPU 均要求 HTTPS 或 localhost
2. **仅 Chromium**: File System Access API 不支持 Firefox/Safari，编辑器启动时应检测并提示
3. **权限重授权**: IndexedDB 存储的 `FileSystemDirectoryHandle` 每次新会话需调用 `requestPermission()` 重新授权
4. **JSONC 解析**: 所有 `.json` 文件加载时先 strip 注释再 `JSON.parse`
5. **坐标系**: 左上角原点，X 右，Y 下（与 Canvas/DOM 一致）
6. **像素渲染**: 使用 `nearest` 采样，`image-rendering: pixelated`
7. **编辑 vs 游玩**: 编辑器模式下快捷键由编辑器处理；Play 模式下快捷键透传给游戏运行时
8. **数据不可变原则**: 编辑器修改通过 Command 执行，原始文件只在显式 Save 时写入磁盘
