# Mote Map Editor 规划

## 定位

**引擎级工具**，位于 `packages/map-editor/`，与 `engine` 并列。

为所有使用 mote 引擎的游戏提供可视化地图编辑能力。

## 目标游戏

- `dungeon` - 地牢探索（Tile-based）
- `tiny-town` - 城镇建设（Tile-based）
- 未来其他 tile-based 游戏

## 核心架构

```
packages/
├── engine/              # 渲染引擎
└── map-editor/          # 地图编辑器工具
    ├── index.html       # 编辑器入口
    ├── src/
    │   ├── main.ts      # 编辑器主逻辑
    │   ├── Editor.ts    # 编辑器核心类
    │   ├── MapData.ts   # 地图数据管理
    │   ├── TilePalette.ts  # 瓦片面板
    │   ├── CanvasView.ts   # 画布视图
    │   ├── tools/       # 绘制工具
    │   │   ├── Tool.ts
    │   │   ├── BrushTool.ts
    │   │   ├── EraserTool.ts
    │   │   ├── FillTool.ts
    │   │   └── RectTool.ts
    │   └── export/      # 导出格式
    │       ├── TsExporter.ts
    │       └── JsonExporter.ts
    └── package.json
```

## 设计原则

### 1. 引擎复用
编辑器直接使用 `@mote/engine` 进行渲染，保证所见即所得。

### 2. 游戏无关
编辑器不依赖特定游戏逻辑，通过**配置文件**定义可用的瓦片类型。

### 3. 多格式导出
- **TypeScript** - 直接嵌入游戏代码
- **JSON** - 运行时加载
- **PNG** - 缩略图预览

## 配置文件格式

每个游戏提供 `map-config.json`：

```json
{
  "name": "dungeon",
  "tileSize": 64,
  "defaultWidth": 16,
  "defaultHeight": 12,
  "tiles": [
    { "id": 0, "name": "VOID", "color": "#000000", "solid": false },
    { "id": 1, "name": "FLOOR", "color": "#8B7355", "solid": false },
    { "id": 2, "name": "WALL", "color": "#4A4A4A", "solid": true },
    { "id": 3, "name": "WATER", "color": "#4A90D9", "solid": true }
  ],
  "assets": {
    "spriteSheet": "assets/tilemap.png",
    "spriteSize": 64
  }
}
```

## 功能规划

### Phase 1: 基础编辑器（MVP）

- [ ] 基础页面布局（三栏：工具 | 画布 | 属性）
- [ ] 读取游戏配置文件
- [ ] 网格显示 + 点击绘制
- [ ] 基础工具：画笔、橡皮
- [ ] 导出为 TypeScript 代码

### Phase 2: 增强编辑

- [ ] 工具：填充、矩形、直线
- [ ] 撤销/重做（Command 模式）
- [ ] 地图尺寸调整
- [ ] 图层系统（地面层 + 物体层）
- [ ] 玩家出生点设置

### Phase 3: 高级功能

- [ ] 嵌入游戏预览（iframe 或内联）
- [ ] 多地图管理
- [ ] 自动保存（localStorage）
- [ ] 导入现有地图

### Phase 4: 可视化增强

- [ ] 显示瓦片图片（而非纯色）
- [ ] 碰撞区域可视化
- [ ] 小地图预览
- [ ] 相机边界预览

## 使用方式

### 1. 启动编辑器
```bash
npm run editor          # 或
npm run dev:editor
```

### 2. 选择游戏配置
```
┌─────────────────────────────────────┐
│  Mote Map Editor                    │
├─────────────────────────────────────┤
│  选择游戏配置：                      │
│  ○ dungeon                          │
│  ● tiny-town                        │
│  ○ (新建配置...)                     │
└─────────────────────────────────────┘
```

### 3. 编辑地图
使用可视化界面绘制，实时预览。

### 4. 导出使用
导出文件自动保存到对应游戏的 `maps/` 目录：

```
games/dungeon/
├── main.ts
├── maps/
│   ├── level1.ts      # 编辑器生成
│   └── level2.ts      # 编辑器生成
└── editor-config.json # 编辑器配置文件
```

## 与游戏集成

### 方式一：静态导入（推荐）
```typescript
// games/dungeon/main.ts
import { LEVEL_1 } from './maps/level1.js';

const map = LEVEL_1;  // 编译时确定，无运行时开销
```

### 方式二：动态加载
```typescript
// 运行时加载 JSON
const map = await fetch('/games/dungeon/maps/level1.json')
  .then(r => r.json());
```

## 编辑器界面

```
┌──────────────────────────────────────────────────────────────┐
│  🗂️ File  🛠️ Tools  👁️ View  🎮 Preview          [dungeon ▼] │
├──────────┬───────────────────────────────┬───────────────────┤
│          │                               │                   │
│ 工具箱    │                               │  地图属性          │
│          │                               │                   │
│ [🖱️] 画笔 │      画布区域                 │  尺寸: 16 x 12    │
│ [⌫] 橡皮 │    (WebGPU 渲染)              │  瓦片: 64px       │
│ [🪣] 填充 │                               │                   │
│ [▭] 矩形 │                               │  [调整尺寸]       │
│          │                               │                   │
├──────────┤                               │  当前工具: 画笔    │
│          │                               │  坐标: (7, 5)     │
│ 瓦片面板  │                               │                   │
│          │                               │  ─────────────    │
│ ⬛ VOID  │                               │  出生点设置        │
│ 🟫 FLOOR │                               │  [设置位置]       │
│ 🟥 WALL  │                               │                   │
│ 🔵 WATER │                               │  ─────────────    │
│          │                               │  导出             │
│          │                               │  [📄 TypeScript]  │
│          │                               │  [📋 JSON]        │
├──────────┴───────────────────────────────┴───────────────────┤
│  状态: 就绪 | 最后保存: 14:32 | 地图: level1 (未导出)          │
└──────────────────────────────────────────────────────────────┘
```

## 数据结构

```typescript
// packages/map-editor/src/MapData.ts

interface MapLayer {
  name: string;
  tiles: number[];  // 与地图同长的一维数组
  visible: boolean;
}

interface MapData {
  version: 1;
  name: string;
  width: number;
  height: number;
  tileSize: number;
  layers: MapLayer[];      // 支持多图层
  spawnPoint: { x: number; y: number };
  cameraBounds?: Rect;     // 可选的相机限制
}

// 导出格式
type ExportFormat = 'ts' | 'json' | 'png';

interface ExportOptions {
  format: ExportFormat;
  includeComments?: boolean;
  optimize?: boolean;      // 压缩 JSON
}
```

## 快捷键

| 快捷键 | 功能 |
|--------|------|
| `B` | 画笔工具 |
| `E` | 橡皮工具 |
| `F` | 填充工具 |
| `R` | 矩形工具 |
| `1-9` | 快速选择瓦片类型 |
| `Ctrl+Z` | 撤销 |
| `Ctrl+Y` | 重做 |
| `Ctrl+S` | 导出 |
| `空格+拖拽` | 平移视角 |
| `滚轮` | 缩放 |
| `G` | 切换网格显示 |
| `Tab` | 切换图层 |

## 开发计划

### Step 1: 包结构搭建
- [ ] 创建 `packages/map-editor/` 目录结构
- [ ] 添加 `package.json`
- [ ] 更新根目录 `vite.config.ts` 添加编辑器入口
- [ ] 更新根目录 `index.html` 添加编辑器链接

### Step 2: 基础框架
- [ ] 实现 `Editor.ts` 核心类
- [ ] 实现 `MapData.ts` 数据管理
- [ ] 实现基础 UI 布局
- [ ] 集成 `@mote/engine` 渲染

### Step 3: 绘制功能
- [ ] 实现 `BrushTool`
- [ ] 实现 `EraserTool`
- [ ] 鼠标事件处理
- [ ] 网格渲染

### Step 4: 导入导出
- [ ] 实现 `TsExporter`
- [ ] 实现 `JsonExporter`
- [ ] 文件下载功能

### Step 5: 游戏集成
- [ ] 为 `dungeon` 创建 `editor-config.json`
- [ ] 测试导出文件在游戏中的使用
- [ ] 验证渲染一致性

## 技术要点

### 1. 编辑器使用 engine 的方式
```typescript
// 编辑器直接使用 engine 渲染
import { GfxDevice, SpriteBatch, Camera2D } from '@mote/engine';

class EditorCanvas {
  private gfx: GfxDevice;
  private batch: SpriteBatch;
  private camera: Camera2D;
  
  // 渲染地图网格和瓦片
  render(mapData: MapData): void {
    // 与游戏相同的渲染逻辑
  }
}
```

### 2. 工具模式（Strategy Pattern）
```typescript
abstract class Tool {
  abstract onMouseDown(pos: Vec2): void;
  abstract onMouseMove(pos: Vec2): void;
  abstract onMouseUp(pos: Vec2): void;
  abstract get cursor(): string;
}

class BrushTool extends Tool {
  // 实现绘制逻辑
}
```

### 3. 命令模式（用于撤销重做）
```typescript
interface Command {
  execute(): void;
  undo(): void;
}

class PaintTileCommand implements Command {
  constructor(
    private layer: MapLayer,
    private index: number,
    private oldTile: number,
    private newTile: number
  ) {}
  
  execute() { this.layer.tiles[this.index] = this.newTile; }
  undo() { this.layer.tiles[this.index] = this.oldTile; }
}
```

## 未来扩展

- **地形自动生成** - 随机洞穴、房间布局
- **路径工具** - 可视化的路径编辑
- **区域标记** - 触发区域、光照区域
- **多用户协作** - WebSocket 实时同步
- **插件系统** - 自定义工具和导出格式
