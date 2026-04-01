# Mote Editor - 架构文档

## 目录结构

```
packages/editor/
├── src/
│   ├── __tests__/               # 统一测试目录 (176 tests)
│   │   ├── README.md            # 测试规范说明
│   │   │
│   │   ├── # 核心模块测试 (116 tests)
│   │   ├── CommandHistory.test.ts
│   │   ├── EditorBridge.test.ts
│   │   ├── ProjectManager.test.ts
│   │   ├── SelectionManager.test.ts
│   │   ├── useEditor.test.tsx
│   │   ├── SetTileCommand.test.ts      # Phase 3
│   │   └── BrushToolNew.test.ts        # Phase 3
│   │   │
│   │   └── # UI 组件测试 (37 tests)
│   │       ├── EditorLayout.test.tsx
│   │       ├── BottomPanel.test.tsx
│   │       ├── InspectorPanel.test.tsx
│   │       ├── SceneTreePanel.test.tsx
│   │       └── ViewportPanel.test.tsx
│   │
│   ├── core/                    # 核心模块（纯逻辑，无UI）
│   │   ├── index.ts             # 核心模块导出
│   │   ├── CommandHistory.ts    # Undo/Redo 管理
│   │   ├── EditorBridge.ts      # 引擎桥接接口
│   │   ├── ProjectManager.ts    # 文件系统管理
│   │   └── SelectionManager.ts  # 选中状态管理
│   │
│   ├── context/                 # Preact Context
│   │   └── EditorContext.ts     # 全局状态 Context
│   │
│   ├── hooks/                   # React Hooks
│   │   └── useEditor.ts         # 核心 hooks
│   │
│   ├── types/                   # TypeScript 类型
│   │   └── editor.ts            # 核心类型定义
│   │
│   ├── commands/                # 命令模式
│   │   └── SetTileCommand.ts    # Tile 相关命令
│   │
│   ├── tools/                   # 工具系统
│   │   ├── TilemapTool.ts       # 工具基类
│   │   ├── BrushToolNew.ts      # 画笔工具
│   │   ├── EraserToolNew.ts     # 橡皮工具
│   │   └── RectToolNew.ts       # 矩形工具
│   │
│   ├── ui/                      # UI 组件
│   │   ├── components/          # 通用组件
│   │   │   └── EditorLayout.tsx # 主布局
│   │   ├── panels/              # 面板组件
│   │   │   ├── SceneTreePanel.tsx
│   │   │   ├── InspectorPanel.tsx
│   │   │   ├── ViewportPanel.tsx
│   │   │   ├── BottomPanel.tsx
│   │   │   └── TilemapEditor.tsx      # Phase 3
│   │   ├── styles/              # 样式文件
│   │   │   └── variables.css    # CSS 变量主题
│   │   └── index.ts             # UI 模块导出
│   │
│   ├── Editor.ts                # 旧编辑器（遗留，待完全移除）
│   ├── MapData.ts               # 地图数据类型（遗留，待移除）
│   └── main.ts                  # 入口文件
│
├── docs/                        # 文档
│   ├── ARCHITECTURE.md          # 本文件
│   ├── PHASE1_COMPLETE.md       # Phase 1 总结
│   ├── PHASE2_COMPLETE.md       # Phase 2 总结
│   └── PHASE3_COMPLETE.md       # Phase 3 总结
│
├── vite.config.ts               # Vite + Preact 配置
├── tsconfig.json                # TypeScript 配置
└── package.json                 # 依赖配置
```

## 架构层次

```
┌──────────────────────────────────────────────────────┐
│  UI Layer (Preact + Signals)                         │
│  - EditorLayout, SceneTreePanel, InspectorPanel      │
│  - ViewportPanel, BottomPanel, TilemapEditor         │
├──────────────────────────────────────────────────────┤
│  Tools Layer (Phase 3)                               │
│  - TilemapTool, BrushTool, EraserTool, RectTool      │
│  - Command Pattern (SetTileCommand, Batch...)        │
├──────────────────────────────────────────────────────┤
│  Hooks Layer                                         │
│  - useEditor, useSelection, useCommandHistory        │
│  - usePlayState                                      │
├──────────────────────────────────────────────────────┤
│  Context Layer                                       │
│  - EditorContext (全局状态容器)                       │
├──────────────────────────────────────────────────────┤
│  Core Layer                                          │
│  - CommandHistory, SelectionManager                  │
│  - EditorBridge, ProjectManager                      │
├──────────────────────────────────────────────────────┤
│  Engine Layer                                        │
│  - MockEditorBridge (开发/测试)                      │
│  - Real Engine Bridge (运行时)                       │
└──────────────────────────────────────────────────────┘
```

## 测试规范

### 目录结构

所有测试统一存放在 `src/__tests__/` 目录下。

### 文件命名

- 单元测试: `{ModuleName}.test.ts`
- 组件测试: `{ComponentName}.test.tsx`

### 导入路径

测试文件使用相对于 `src/` 的导入路径：

```typescript
// 正确
import { EditorLayout } from '../ui/components/EditorLayout.js';
import { BrushTool } from '../tools/BrushToolNew.js';

// 错误
import { EditorLayout } from '../EditorLayout.js';
```

## 核心模块职责

### CommandHistory
- 管理所有可撤销操作
- 提供 Undo/Redo 功能
- 限制历史记录数量

### SelectionManager
- 管理实体选中状态
- 使用 Preact Signals 实现响应式
- 支持单选/多选/范围选择

### EditorBridge
- 编辑器与引擎的唯一接口
- 定义实体/组件/场景操作
- Mock 实现用于测试

### ProjectManager
- File System Access API 封装
- IndexedDB 持久化
- 文件读写/目录管理

## 工具系统 (Phase 3)

### 工具基类

```typescript
abstract class BaseTilemapTool implements TilemapTool {
  abstract readonly name: string;
  abstract readonly icon: string;
  
  setLayer(layerName: string): void;
  setTileId(tileId: number): void;
  
  abstract onPointerDown(x: number, y: number): void;
  abstract onPointerMove(x: number, y: number): void;
  abstract onPointerUp(x: number, y: number): void;
  
  getPreview?(): TilePreview | null;
}
```

### 命令模式

所有工具操作通过 Command 模式支持 Undo/Redo：

```typescript
// 单个设置
new SetTileCommand(bridge, layer, x, y, oldId, newId)

// 批量设置（画笔、矩形）
new BatchSetTileCommand(bridge, layer, changes)

// 清空图层
new ClearLayerCommand(bridge, layer, width, height)

// 区域填充
new FillRegionCommand(bridge, layer, x, y, w, h, tileId)
```

## 状态管理

```
EditorContext (Preact Context)
    │
    ├── bridge: EditorBridge      # 引擎接口
    ├── history: CommandHistory   # Undo/Redo
    ├── selection: SelectionManager  # 选中状态
    ├── project: ProjectManager   # 文件系统
    │
    ├── tool: Signal<EditorTool>        # 当前工具
    ├── bottomTab: Signal<BottomTab>    # 底部面板 Tab
    ├── isBottomPanelOpen: Signal<boolean>
    ├── showGrid: Signal<boolean>
    ├── zoom: Signal<number>
    ├── playState: Signal<PlayState>
    └── gizmoMode: Signal<GizmoMode>
```

## 使用方式

### 基础 Hook

```tsx
import { useEditor, useSelection } from './hooks/useEditor.js';

function MyComponent() {
  const { bridge, history } = useEditor();
  const { selected, select } = useSelection();
  
  return <div>{selected.value.length} selected</div>;
}
```

### 工具使用

```typescript
import { BrushTool } from './tools/BrushToolNew.js';

const brush = new BrushTool(bridge, history);
brush.setLayer('ground');
brush.setTileId(5);

brush.onPointerDown(0, 0);
brush.onPointerMove(1, 0);
brush.onPointerUp(1, 0);  // 自动提交命令

history.undo();
```

### UI 布局

```tsx
import { 
  EditorLayout, 
  SceneTreePanel, 
  InspectorPanel, 
  ViewportPanel, 
  BottomPanel,
  TilemapEditor 
} from './ui/index.js';

function EditorApp() {
  return (
    <EditorLayout
      menuBar={<MenuBar />}
      leftPanel={<SceneTreePanel />}
      viewport={<ViewportPanel />}
      rightPanel={<InspectorPanel />}
      bottomPanel={
        <BottomPanel activeTab="tilemap" onTabChange={...}>
          {{
            tilemap: <TilemapEditor />,
            assets: <AssetBrowser />,
            console: <Console />,
          }}
        </BottomPanel>
      }
    />
  );
}
```

## 测试

```bash
npm test              # 运行全部测试
npm test:watch        # 监听模式
npm test:coverage     # 覆盖率
```

### 当前测试统计

| 类别 | 测试数 | 文件数 |
|------|--------|--------|
| 核心模块 | 116 | 6 |
| UI 组件 | 37 | 5 |
| **总计** | **176** | **12** |

### 测试文件列表

- `CommandHistory.test.ts` (14)
- `EditorBridge.test.ts` (35)
- `ProjectManager.test.ts` (33)
- `SelectionManager.test.ts` (22)
- `useEditor.test.tsx` (12)
- `SetTileCommand.test.ts` (14)
- `BrushToolNew.test.ts` (16)
- `EditorLayout.test.tsx` (7)
- `SceneTreePanel.test.tsx` (7)
- `InspectorPanel.test.tsx` (6)
- `ViewportPanel.test.tsx` (6)
- `BottomPanel.test.tsx` (4)

## 开发进展

- ✅ Phase 1: 基础架构 (116 tests)
- ✅ Phase 2: UI 布局 (153 tests)
- ✅ Phase 3: Tilemap 编辑器 (176 tests)
- ⏳ Phase 4: 集成与增强功能

## 已移除的旧代码

以下文件已从项目中移除：

### 旧工具文件
- ~~`src/tools/Tool.ts`~~
- ~~`src/tools/BrushTool.ts`~~
- ~~`src/tools/EraserTool.ts`~~
- ~~`src/tools/RectTool.ts`~~

### 旧命令文件
- ~~`src/commands/Command.ts`~~
- ~~`src/commands/TileCommands.ts`~~

### 旧测试文件
- ~~`src/__tests__/BrushTool.test.ts`~~
- ~~`src/__tests__/EraserTool.test.ts`~~
- ~~`src/__tests__/RectTool.test.ts`~~
- ~~`src/__tests__/Command.test.ts`~~
- ~~`src/__tests__/TileCommands.test.ts`~~
- ~~`src/__tests__/MapData.test.ts`~~

### 遗留文件（待移除）
- `src/Editor.ts` - 旧的单体编辑器类
- `src/MapData.ts` - 旧的 MapData 类型定义
