# Mote Editor Sprint 计划 — TileMap 最小工作流

基于现有代码（packages/editor/）继续开发，打通 TileSet + TileMap 的完整工作流。

---

## 当前状态

**已完成（无需重做）**:
```
packages/editor/
├── src/
│   ├── core/
│   │   ├── area-tree.ts      ✅ 完整区域树（含分割/合并）
│   │   └── layout-state.ts   ✅ Preact Signals 状态管理
│   ├── components/
│   │   ├── AreaTreeRenderer.tsx ✅ 递归渲染
│   │   ├── SplitPane.tsx     ✅ 拖拽分割
│   │   ├── AreaPanel.tsx     ✅ 区域面板
│   │   ├── AreaHeader.tsx    ✅ 26px 头栏
│   │   ├── CornerHandle.tsx  ✅ 角落分割/合并
│   │   ├── GlobalMenuBar.tsx ✅ 菜单栏壳
│   │   └── CollapsibleSection.tsx ✅ 折叠面板
│   ├── editors/              ✅ 基础编辑器框架
│   └── index.css             ✅ Blender 暗色主题
```

**待开发**：TileSet 面板 + TileMap 编辑器 + 笔刷系统

---

## Sprint 规划

### Sprint 1 — TileSet 系统（2-3 天）

目标：能导入 TileSet 图片，在编辑器中浏览和选择 Tile

```
┌─────────────────────────────────────────────────────────────┐
│ 🎮 mote    File  Edit  View                        [▶ Play] │
├─────────────────────────────────────────────────────────────┤
│ ┌─[🗺️ TileSet ▾]───────────────┬─[🎮 Viewport ▾]────────────┐
│ │  [+ Import TileSet]          │                           │
│ │                              │      Grid Background      │
│ │  ┌────────────────────┐      │                           │
│ │  │  TileSet Preview   │      │                           │
│ │  │  ┌──┬──┬──┬──┐     │      │                           │
│ │  │  │ 0│ 1│ 2│ 3│     │      │                           │
│ │  │  ├──┼──┼──┼──┤     │      │                           │
│ │  │  │ 4│ 5│ 6│ 7│     │      │                           │
│ │  │  └──┴──┴──┴──┘     │      │                           │
│ │  └────────────────────┘      │                           │
│ │                              │                           │
│ │  Tile: grass.png              │                           │
│ │  Size: 32×32, 4×2 tiles       │                           │
│ └──────────────────────────────┴───────────────────────────┘
```

**任务清单**：

| # | 任务 | 文件 | 预估 |
|---|------|------|------|
| 1.1 | TileSet 数据模型 | `src/tilemap/tileset.ts` | 1h |
| 1.2 | TileSet 导入对话框 | `src/components/ImportTileSetDialog.tsx` | 2h |
| 1.3 | TileSet 面板组件 | `src/editors/TileSetEditor.tsx` | 4h |
| 1.4 | TileSet 状态管理 | `src/tilemap/tileset-state.ts` | 1h |
| 1.5 | 将 TileSet 加入编辑器类型 | `src/core/area-tree.ts` | 30min |
| 1.6 | 多个 TileSet 切换支持 | `src/editors/TileSetEditor.tsx` | 2h |

**数据结构**：
```typescript
// src/tilemap/tileset.ts
export interface TileSet {
  id: string;
  name: string;
  image: ImageBitmap;
  tileSize: number;      // 假设正方形 tile
  columns: number;
  tileCount: number;
  // 预留：动画帧、碰撞数据等
}

export interface TileSetRef {
  tileSetId: string;
  tileId: number;        // 在 TileSet 中的索引
}
```

**交付标准**：
- [ ] 点击「+ Import」选择图片 → 弹出对话框输入 tileSize → 生成 TileSet
- [ ] TileSet 面板显示图集网格（每个 tile 画边框）
- [ ] 点击 tile 高亮选中（记录 currentTile）
- [ ] 支持导入多个 TileSet，顶部 tab 切换

---

### Sprint 2 — TileMap 数据 + 基础渲染（2 天）

目标：创建 TileMap，在 Viewport 中渲染网格和已有的 tile

```
┌─────────────────────────────────────────────────────────────┐
│ File  Edit  View                              [Grid] [Play] │
├─────────────────────────────────────────────────────────────┤
│ ┌─[🗺️ TileSet ▾]───────────────┬─[🎮 Viewport ▾]────────────┤
│ │  [grass] [terrain] [+]       │  15×10 map, 32px tile       │
│ │                              │                             │
│ │  ┌────────────────────┐      │  ┌─────────────────────┐    │
│ │  │  ░░▓▓░░▓▓░░▓▓░░   │      │  │ ░░▓▓░░▓▓░░▓▓░░▓▓░ │    │
│ │  │  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓   │      │  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░ │    │
│ │  │  ░░▓▓░░▓▓░░▓▓░░   │      │  │ ░░▓▓░░▓▓░░▓▓░░▓▓░ │    │
│ │  └────────────────────┘      │  │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░ │    │
│ │                              │  └─────────────────────┘    │
│ │  Selected: tile #5            │                             │
│ └──────────────────────────────┴─────────────────────────────┘
```

**任务清单**：

| # | 任务 | 文件 | 预估 |
|---|------|------|------|
| 2.1 | TileMap 数据模型 | `src/tilemap/tilemap.ts` | 1h |
| 2.2 | TileMap 状态管理 | `src/tilemap/tilemap-state.ts` | 1h |
| 2.3 | New Map 对话框 | `src/components/NewMapDialog.tsx` | 2h |
| 2.4 | Viewport 集成 TileMap 渲染 | `src/editors/ViewportEditor.tsx` | 4h |
| 2.5 | 网格线叠加（可开关） | `src/editors/ViewportEditor.tsx` | 1h |

**数据结构**：
```typescript
// src/tilemap/tilemap.ts
export interface TileMap {
  id: string;
  name: string;
  width: number;         // tile 列数
  height: number;        // tile 行数
  tileSize: number;
  data: (TileSetRef | null)[];  // 一维数组，length = width * height
}

// 坐标转换
function getTileAt(map: TileMap, x: number, y: number): TileSetRef | null {
  if (x < 0 || x >= map.width || y < 0 || y >= map.height) return null;
  return map.data[y * map.width + x];
}

function setTileAt(map: TileMap, x: number, y: number, tile: TileSetRef | null): void {
  if (x < 0 || x >= map.width || y < 0 || y >= map.height) return;
  map.data[y * map.width + x] = tile;
}
```

**交付标准**：
- [ ] File → New Map 弹出对话框设置 width/height/tileSize
- [ ] Viewport 渲染 TileMap（遍历 data，从对应 TileSet 取图绘制）
- [ ] 显示网格线（可开关）
- [ ] Camera pan（Space+拖拽 或 中键拖拽）+ zoom（滚轮）

---

### Sprint 3 — 笔刷系统（2-3 天）

目标：在 Viewport 中点击/拖拽绘制 Tile

**任务清单**：

| # | 任务 | 文件 | 预估 |
|---|------|------|------|
| 3.1 | 屏幕坐标 → 世界坐标 → Tile 坐标 | `src/tilemap/camera.ts` | 2h |
| 3.2 | 笔刷工具状态管理 | `src/tilemap/brush-state.ts` | 1h |
| 3.3 | 单格点击绘制 | `src/editors/ViewportEditor.tsx` | 2h |
| 3.4 | 拖拽连续绘制 | `src/editors/ViewportEditor.tsx` | 2h |
| 3.5 | 光标预览（半透明显示即将绘制的 tile） | `src/editors/ViewportEditor.tsx` | 2h |
| 3.6 | 橡皮擦工具（右键或工具栏切换） | `src/editors/ViewportEditor.tsx` | 1h |
| 3.7 | 工具栏按钮（Pen/Eraser） | `src/editors/ViewportEditor.tsx` | 1h |

**交互细节**：
```
鼠标状态：
- 左键点击/拖拽：绘制当前选中的 tile
- 右键点击/拖拽：擦除（设为 null）
- Space + 拖拽：平移 camera
- 滚轮：缩放 camera

光标预览：
- 鼠标移动时，高亮显示当前指向的网格单元
- 如果是 pen 模式：半透明显示选中的 tile
- 如果是 eraser 模式：显示红色边框
```

**Camera 类设计**：
```typescript
// src/tilemap/camera.ts
export class Camera {
  x: number = 0;
  y: number = 0;
  zoom: number = 1;
  
  // 屏幕坐标 → 世界坐标
  screenToWorld(screenX: number, screenY: number): { x: number; y: number };
  
  // 世界坐标 → 屏幕坐标
  worldToScreen(worldX: number, worldY: number): { x: number; y: number };
  
  // 屏幕坐标 → Tile 坐标
  screenToTile(screenX: number, screenY: number, tileSize: number): { x: number; y: number };
  
  pan(dx: number, dy: number): void;
  zoomAt(screenX: number, screenY: number, delta: number): void;
}
```

**交付标准**：
- [ ] 在 Viewport 上点击/拖拽可以绘制 tile
- [ ] 滚轮缩放，Space+拖拽平移
- [ ] 鼠标移动时显示光标预览
- [ ] 可以切换到橡皮擦模式擦除 tile

---

### Sprint 4 — 导入导出 + Undo（2 天）

目标：工作流闭环——保存、加载、撤销

**任务清单**：

| # | 任务 | 文件 | 预估 |
|---|------|------|------|
| 4.1 | TileMap 导出 JSON | `src/tilemap/export.ts` | 2h |
| 4.2 | TileMap 导入 JSON | `src/tilemap/import.ts` | 3h |
| 4.3 | TileSet 导出/导入配置 | `src/tilemap/tileset-io.ts` | 2h |
| 4.4 | Command 系统 | `src/tilemap/commands.ts` | 2h |
| 4.5 | Undo/Redo 管理器 | `src/tilemap/history.ts` | 2h |
| 4.6 | Ctrl+Z / Ctrl+Y 快捷键 | `src/app.tsx` 或全局监听 | 1h |
| 4.7 | 菜单栏功能化 | `src/components/GlobalMenuBar.tsx` | 2h |

**导出格式**：
```json
{
  "version": "1.0",
  "tileMap": {
    "name": "level1",
    "width": 15,
    "height": 10,
    "tileSize": 32,
    "data": [
      { "tileSetId": "grass", "tileId": 0 },
      null,
      { "tileSetId": "grass", "tileId": 1 },
      ...
    ]
  },
  "tileSets": [
    {
      "id": "grass",
      "name": "grass.png",
      "tileSize": 32,
      "columns": 4,
      "tileCount": 8,
      "imageData": "data:image/png;base64,..."
    }
  ]
}
```

**Command 设计**：
```typescript
// src/tilemap/commands.ts
export interface Command {
  execute(): void;
  undo(): void;
  merge(other: Command): Command | null;  // 返回合并后的 command，不合并返回 null
}

export class SetTileCommand implements Command {
  constructor(
    private map: TileMap,
    private x: number,
    private y: number,
    private oldTile: TileSetRef | null,
    private newTile: TileSetRef | null
  ) {}
  
  execute() { setTileAt(this.map, this.x, this.y, this.newTile); }
  undo() { setTileAt(this.map, this.x, this.y, this.oldTile); }
  
  // 拖拽时合并相邻操作
  merge(other: Command): Command | null {
    if (other instanceof SetTileCommand && 
        other.map === this.map && 
        other.x === this.x && 
        other.y === this.y) {
      // 同一格，保留旧的 oldTile，使用新的 newTile
      return new SetTileCommand(this.map, this.x, this.y, this.oldTile, other.newTile);
    }
    return null;
  }
}
```

**交付标准**：
- [ ] File → Export Map 下载 .json 文件（含 TileSet 图片 base64）
- [ ] File → Import Map 加载 .json 文件
- [ ] Ctrl+Z 撤销，Ctrl+Y 重做
- [ ] 连续拖拽绘制合并为一个 undo 步骤

---

## 总览

```
Week 1                           Week 2
Mon/Tue   Wed/Thu   Fri         Mon/Tue   Wed/Thu
  │         │       │             │         │
  ▼         ▼       ▼             ▼         ▼
 Sprint 1  Sprint 2  Sprint 3    Sprint 3  Sprint 4
 TileSet   TileMap   笔刷系统     笔刷收尾   导入导出+Undo
 ~2天       ~2天      ~2天         ~1天      ~2天
                                              │
                                              ▼
                                        ✅ MVP 可用
                                        总计 7-9 天
```

---

## 文件结构预期

```
packages/editor/src/
├── core/                           # 已有
│   ├── area-tree.ts
│   └── layout-state.ts
├── components/                     # 已有 + 新增
│   ├── AreaTreeRenderer.tsx
│   ├── SplitPane.tsx
│   ├── AreaPanel.tsx
│   ├── AreaHeader.tsx
│   ├── CornerHandle.tsx
│   ├── GlobalMenuBar.tsx          # 需要增强菜单功能
│   ├── CollapsibleSection.tsx
│   ├── ImportTileSetDialog.tsx    # 新增
│   └── NewMapDialog.tsx           # 新增
├── editors/                        # 已有 + 修改
│   ├── index.ts
│   ├── ViewportEditor.tsx         # 需要大幅修改，集成 TileMap 渲染和笔刷
│   └── TileSetEditor.tsx          # 新增
├── tilemap/                        # 新增模块
│   ├── index.ts
│   ├── tileset.ts                  # TileSet 数据模型
│   ├── tileset-state.ts            # TileSet Signals 状态
│   ├── tileset-io.ts               # TileSet 导入导出
│   ├── tilemap.ts                  # TileMap 数据模型
│   ├── tilemap-state.ts            # TileMap Signals 状态
│   ├── camera.ts                   # Camera 变换
│   ├── commands.ts                 # Command 接口 + SetTileCommand
│   ├── history.ts                  # Undo/Redo 管理器
│   ├── export.ts                   # TileMap 导出
│   └── import.ts                   # TileMap 导入
├── app.tsx
├── index.css
├── index.ts
└── main.tsx
```

---

## 暂缓清单（MVP 后）

| 功能 | 原因 |
|------|------|
| 多层 TileMap | 单 layer 够用，多层增加复杂度 |
| 矩形选区笔刷 | 单格笔刷 MVP 够用 |
| 填充工具 (Flood Fill) | MVP 不需要 |
| 动画 Tile 预览 | 基础版先不做动画 |
| Tile 碰撞数据编辑 | Phase 2 |
| 实体系统 (ECS) | 纯 TileMap 编辑器不涉及 |
| File System Access API | 先用 download/upload，后期再升级 |

---

## 技术决策

1. **Canvas 2D vs WebGPU**：
   - 选择 Canvas 2D，足够绘制 tilemap，后期可替换

2. **TileSet 图片存储**：
   - 导出时 base64 内嵌，避免路径丢失问题
   - 后期支持导出为 zip（图片+json 分离）

3. **Camera 变换**：
   - 简单的 pan + zoom，没有旋转
   - 坐标转换：screen → world → tile

4. **Undo 策略**：
   - Command 模式
   - 拖拽期间收集操作，pointerup 时批量合并
