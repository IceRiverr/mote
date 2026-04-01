# Mote Editor - 架构文档

## 目录结构

```
packages/editor/
├── src/
│   ├── __tests__/               # 统一测试目录 (182 tests)
│   │   ├── README.md            # 测试规范说明
│   │   │
│   │   ├── # 核心模块测试 (130 tests)
│   │   ├── CommandHistory.test.ts
│   │   ├── EditorBridge.test.ts
│   │   ├── ProjectManager.test.ts
│   │   ├── SelectionManager.test.ts
│   │   ├── useEditor.test.tsx
│   │   ├── SetTileCommand.test.ts
│   │   └── BrushToolNew.test.ts
│   │   │
│   │   └── # UI 组件测试 (52 tests)
│   │       ├── EditorLayout.test.tsx
│   │       ├── SceneTreePanel.test.tsx
│   │       ├── InspectorPanel.test.tsx
│   │       ├── ViewportPanel.test.tsx
│   │       ├── BottomPanel.test.tsx
│   │       └── TilemapEditor.test.tsx
│   │
│   ├── core/                    # 核心模块
│   │   ├── index.ts
│   │   ├── CommandHistory.ts
│   │   ├── EditorBridge.ts
│   │   ├── ProjectManager.ts
│   │   └── SelectionManager.ts
│   │
│   ├── context/                 # Preact Context
│   │   └── EditorContext.ts
│   │
│   ├── hooks/                   # React Hooks
│   │   └── useEditor.ts
│   │
│   ├── types/                   # TypeScript 类型
│   │   └── editor.ts
│   │
│   ├── commands/                # 命令模式
│   │   └── SetTileCommand.ts
│   │
│   ├── tools/                   # 工具系统
│   │   ├── TilemapTool.ts
│   │   ├── BrushToolNew.ts
│   │   ├── EraserToolNew.ts
│   │   └── RectToolNew.ts
│   │
│   ├── ui/                      # UI 组件
│   │   ├── components/          # 通用组件
│   │   │   ├── EditorLayout.tsx
│   │   │   ├── FloatingPanel.tsx      # 浮动面板 (Phase 4)
│   │   │   ├── FloatingLayout.tsx     # 浮动布局管理器 (Phase 4)
│   │   │   └── DockedPanel.tsx        # 停靠面板 (Phase 4)
│   │   ├── panels/              # 面板组件
│   │   │   ├── SceneTreePanel.tsx     # 支持浮动
│   │   │   ├── InspectorPanel.tsx     # 支持浮动
│   │   │   ├── ViewportPanel.tsx
│   │   │   ├── BottomPanel.tsx
│   │   │   └── TilemapEditor.tsx      # Tile Sets (原 Tile Palette)
│   │   ├── styles/
│   │   │   └── variables.css
│   │   └── index.ts
│   │
│   ├── Editor.ts                # 旧编辑器（遗留）
│   ├── MapData.ts               # 旧类型（遗留）
│   └── main.ts                  # 入口文件
│
├── docs/
│   ├── ARCHITECTURE.md
│   ├── PHASE1_COMPLETE.md
│   ├── PHASE2_COMPLETE.md
│   └── PHASE3_COMPLETE.md
│
├── vite.config.ts
├── tsconfig.json
└── package.json
```

## 架构层次

```
┌──────────────────────────────────────────────────────┐
│  UI Layer (Preact + Signals)                         │
│  - SceneTreePanel, InspectorPanel (浮动支持)          │
│  - ViewportPanel, TilemapEditor (Tile Sets)          │
│  - FloatingPanel, FloatingLayout                     │
├──────────────────────────────────────────────────────┤
│  Tools Layer                                         │
│  - TilemapTool, BrushTool, EraserTool, RectTool      │
│  - Command Pattern                                   │
├──────────────────────────────────────────────────────┤
│  Hooks Layer                                         │
│  - useEditor, useSelection, useCommandHistory        │
├──────────────────────────────────────────────────────┤
│  Context Layer                                       │
│  - EditorContext                                     │
├──────────────────────────────────────────────────────┤
│  Core Layer                                          │
│  - CommandHistory, SelectionManager                  │
│  - EditorBridge, ProjectManager                      │
├──────────────────────────────────────────────────────┤
│  Engine Layer                                        │
│  - MockEditorBridge                                  │
└──────────────────────────────────────────────────────┘
```

## Phase 4 更新

### 浮动面板系统

所有面板现在支持浮动和停靠两种模式：

```tsx
// SceneTreePanel 支持浮动
<SceneTreePanel 
  isFloating={false}    // 停靠模式（默认）
  onFloat={() => {}}    // 点击浮动按钮
/>

// InspectorPanel 支持浮动
<InspectorPanel 
  isFloating={true}     // 浮动模式
  title="Inspector"
/>
```

### 浮动面板组件

```tsx
import { FloatingPanel, DockedPanel, FloatingLayout } from './ui/index.js';

// 单个浮动面板
<FloatingPanel
  id="hierarchy"
  title="Hierarchy"
  onClose={() => {}}
  onFocus={() => {}}
>
  <SceneTreePanel isFloating />
</FloatingPanel>

// 完整浮动布局管理
<FloatingLayout
  panelConfigs={{
    hierarchy: { defaultFloating: false, allowFloat: true },
    inspector: { defaultFloating: false, allowFloat: true },
    tilemap: { defaultFloating: true },  // 默认浮动
  }}
>
  {{
    hierarchy: <SceneTreePanel />,
    inspector: <InspectorPanel />,
    tilemap: <TilemapEditor />,
  }}
</FloatingLayout>
```

### Tile Sets

Tile Palette 已更名为 **Tile Sets**：

```tsx
// TilemapEditor 中的 Tile Sets 面板
<TilemapEditor />
// 显示 "Tile Sets" 标题而非 "Tile Palette"
```

## 使用方式

### 浮动面板模式

```tsx
// 停靠模式（默认）
<SceneTreePanel
  title="Hierarchy"
  onFloat={() => setFloating('hierarchy', true)}
/>

// 浮动模式
<FloatingPanel
  id="hierarchy"
  title="Hierarchy"
  onClose={() => setFloating('hierarchy', false)}
>
  <SceneTreePanel isFloating />
</FloatingPanel>
```

## 测试统计

- **总测试数**: 182
- **测试文件数**: 13
- **核心模块**: 130
- **UI 组件**: 52

### Phase 4 新增测试

| 测试文件 | 测试数 |
|---------|--------|
| TilemapEditor.test.ts | 6 |

## 开发进展

- ✅ Phase 1: 基础架构
- ✅ Phase 2: UI 布局
- ✅ Phase 3: Tilemap 编辑器
- ✅ Phase 4: 浮动面板系统 + Tile Sets
