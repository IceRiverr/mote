# Mote Editor Tests

所有测试文件统一存放在此目录。

## 目录结构

```
src/__tests__/
├── README.md                      # 本文件
│
├── # 核心模块测试 (130 tests)
├── CommandHistory.test.ts         # Undo/Redo 管理 (14)
├── EditorBridge.test.ts           # 引擎桥接接口 (35)
├── ProjectManager.test.ts         # 文件系统管理 (33)
├── SelectionManager.test.ts       # 选中状态管理 (22)
├── useEditor.test.tsx             # React Hooks (12)
├── SetTileCommand.test.ts         # Tile 命令 (14)
├── BrushToolNew.test.ts           # Tilemap 工具 (16)
│
├── # UI 组件测试 (72 tests)
├── EditorLayout.test.tsx          # 主布局 (7)
├── SceneTreePanel.test.tsx        # 实体树面板 (7)
├── InspectorPanel.test.tsx        # 属性面板 (6)
├── ViewportPanel.test.tsx         # 视口面板 (6)
├── BottomPanel.test.tsx           # 底部面板 (4)
├── TilemapEditor.test.tsx         # Tilemap 编辑器 (6)
├── FloatingPanel.test.tsx         # 浮动面板 (12)
├── FloatingPanelDrag.test.tsx     # 浮动面板拖拽 (10)
│
└── # (已移除旧的工具测试)
```

## 测试规范

### 文件命名

- 单元测试: `{ModuleName}.test.ts`
- 组件测试: `{ComponentName}.test.tsx`

### 导入路径

测试文件使用相对于 `src/` 的导入路径：

```typescript
// 正确 - 从 src/ 开始
import { EditorLayout } from '../ui/components/EditorLayout.js';
import { useEditor } from '../hooks/useEditor.js';
import { BrushTool } from '../tools/BrushToolNew.js';

// 错误 - 不要使用相对路径回到原模块位置
import { EditorLayout } from '../EditorLayout.js';
```

### 测试结构

```typescript
import { describe, it, expect } from 'vitest';

describe('ModuleName', () => {
  describe('功能分组', () => {
    it('应该正确描述测试行为', () => {
      // Arrange
      const input = ...;
      
      // Act
      const result = functionUnderTest(input);
      
      // Assert
      expect(result).toBe(expected);
    });
  });
});
```

## 运行测试

```bash
# 运行所有测试
npm test

# 监视模式
npm run test:watch

# 覆盖率报告
npm run test:coverage

# 运行特定测试文件
npm test -- SetTileCommand
npm test -- BrushToolNew
npm test -- TilemapEditor
npm test -- FloatingPanel
```

## 当前测试统计

- **总测试数**: 206
- **测试文件数**: 16
- **核心模块**: 130
- **UI 组件**: 72

### Phase 4 新增测试

| 测试文件 | 测试数 | 说明 |
|---------|--------|------|
| TilemapEditor.test.ts | 6 | Tilemap 编辑器（Tile Sets） |
| FloatingPanel.test.tsx | 12 | 浮动面板组件 |
| FloatingPanelDrag.test.tsx | 10 | 浮动面板拖拽功能 + pointerEvents 回归测试 |
| build.test.ts | 2 | 构建测试（tsc + vite） |

### 修复的关键 Bug

#### 1. 浮动面板容器遮挡点击（严重）

**问题**：浮动面板层 `<div>` 设置了全屏 `position: fixed`，但没有设置 `pointer-events: 'none'`，导致遮挡了下方所有界面元素，整个编辑器无法点击。

**修复**：
- 浮动面板容器：`pointerEvents: 'none'`（允许点击穿透）
- 浮动面板本身：`pointerEvents: 'auto'`（恢复面板内点击）

**自动化测试**：新增测试验证 `panel.style.pointerEvents === 'auto'`

#### 2. 浮动面板拖拽问题

**问题**：浮动面板容器设置了 `pointer-events: 'none'`，导致无法拖拽。

**修复**：移除了 `pointer-events: 'none'` 设置。

**自动化测试**：`FloatingPanelDrag.test.tsx` 包含 10 个测试用例。

#### 3. Tilemap 浮动面板不显示问题

**问题**：Tilemap 面板使用了 `window.innerWidth/Height` 计算位置，在 SSR/初始渲染时可能计算出屏幕外坐标。

**修复**：
- 使用固定的初始位置 (100, 100)
- 添加 `typeof window !== 'undefined'` 检查
