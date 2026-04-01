# Mote Editor Tests

所有测试文件统一存放在此目录。

## 目录结构

```
src/__tests__/
├── README.md                      # 本文件
│
├── # 核心模块测试 (116 tests)
├── CommandHistory.test.ts         # Undo/Redo 管理 (14)
├── EditorBridge.test.ts           # 引擎桥接接口 (35)
├── ProjectManager.test.ts         # 文件系统管理 (33)
├── SelectionManager.test.ts       # 选中状态管理 (22)
├── useEditor.test.tsx             # React Hooks (12)
├── SetTileCommand.test.ts         # Tile 命令 (14)
├── BrushToolNew.test.ts           # Tilemap 工具 (16)
│
├── # UI 组件测试 (37 tests)
├── EditorLayout.test.tsx          # 主布局 (7)
├── SceneTreePanel.test.tsx        # 实体树面板 (7)
├── InspectorPanel.test.tsx        # 属性面板 (6)
├── ViewportPanel.test.tsx         # 视口面板 (6)
├── BottomPanel.test.tsx           # 底部面板 (4)
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
```

## 当前测试统计

- **总测试数**: 176
- **测试文件数**: 12
- **核心模块**: 116
- **UI 组件**: 37

### Phase 3 测试

| 测试文件 | 测试数 | 说明 |
|---------|--------|------|
| SetTileCommand.test.ts | 14 | Tile 设置/批量/清空/填充命令 |
| BrushToolNew.test.ts | 16 | 画笔/橡皮/矩形工具 (新架构) |
