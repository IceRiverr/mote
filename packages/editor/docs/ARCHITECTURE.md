# Mote Editor - 架构文档

## 目录结构

```
packages/editor/
├── src/
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
│   │   ├── useEditor.ts         # 核心 hooks
│   │   └── __tests__/           # hooks 测试
│   │
│   ├── types/                   # TypeScript 类型
│   │   └── editor.ts            # 核心类型定义
│   │
│   ├── ui/                      # UI 组件（Phase 2+）
│   │   └── panels/              # 面板组件
│   │
│   ├── commands/                # 命令实现（遗留）
│   ├── tools/                   # 工具实现（遗留）
│   ├── Editor.ts                # 旧编辑器（待迁移）
│   ├── MapData.ts               # 地图数据类型
│   └── main.ts                  # 入口文件
│
├── docs/                        # 文档
│   ├── PHASE1_COMPLETE.md       # Phase 1 总结
│   └── ARCHITECTURE.md          # 本文件
│
├── vite.config.ts               # Vite + Preact 配置
├── tsconfig.json                # TypeScript 配置
└── package.json                 # 依赖配置
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

```tsx
import { useEditor, useSelection } from './hooks/useEditor.js';

function MyComponent() {
  const { bridge, history } = useEditor();
  const { selected, select } = useSelection();
  
  // selected.value 是响应式的
  return <div>{selected.value.length} selected</div>;
}
```

## 测试

所有核心模块都有完整的单元测试：

```bash
npm test              # 运行全部测试
npm test:watch        # 监听模式
npm test:coverage     # 覆盖率
```

当前测试覆盖：
- CommandHistory: 14 个测试
- SelectionManager: 22 个测试
- EditorBridge: 35 个测试
- ProjectManager: 33 个测试
- Hooks: 12 个测试
- 遗留模块: 77 个测试
- **总计: 193 个测试**
