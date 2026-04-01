# Editor 测试套件

这个目录包含 mote Editor 的自动化测试。

## 测试结构

```
src/__tests__/
├── Command.test.ts         # CommandHistory Undo/Redo 测试
├── TileCommands.test.ts    # PaintTilesCommand, ResizeMapCommand 测试
├── MapData.test.ts         # 数据类型和工具函数测试
├── BrushTool.test.ts       # 画笔工具测试
├── EraserTool.test.ts      # 橡皮工具测试
└── RectTool.test.ts        # 矩形工具测试
```

## 运行测试

```bash
# 在项目根目录
npm test              # 运行所有 editor 测试
npm run test:watch    # 监听模式（开发时使用）
npm run test:coverage # 生成覆盖率报告

# 在 editor 包目录
cd packages/editor
npm test              # 运行测试
npm run test:watch    # 监听模式
```

## 测试覆盖范围

### Command.test.ts (15 tests)
- `CommandHistory.execute()` - 命令执行和历史管理
- `CommandHistory.undo()` - 撤销操作
- `CommandHistory.redo()` - 重做操作
- `CommandHistory.clear()` - 清空历史
- 边界条件：空历史、最大历史限制、重做历史截断

### TileCommands.test.ts (8 tests)
- `PaintTilesCommand` - 单/多瓦片绘制、撤销恢复、命令名称
- `ResizeMapCommand` - 地图尺寸调整

### MapData.test.ts (16 tests)
- `MapData` 结构验证
- `TileDef` 属性验证
- `GameConfig` 结构验证
- 坐标转换工具函数
- 边界检查

### BrushTool.test.ts (13 tests)
- 工具属性验证
- 鼠标事件处理（down/move/up）
- 拖拽绘制
- 命令提交
- 边界条件

### EraserTool.test.ts (11 tests)
- 擦除功能
- VOID 瓦片处理
- 命令记录
- 复杂场景

### RectTool.test.ts (14 tests)
- 矩形预览
- 正/反向拖拽
- 矩形填充
- 预览清除

## 添加新测试

创建新的测试文件：`src/__tests__/YourFeature.test.ts`

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { YourClass } from '../YourClass.js';

describe('YourClass', () => {
  it('应该...', () => {
    // 测试代码
  });
});
```

## Mock 策略

由于 Editor 依赖 DOM，测试中使用模拟对象：

```typescript
function createMockEditor(): MapEditor {
  const tiles = new Map<string, number>();
  return {
    getTile: (x, y) => tiles.get(`${x},${y}`) ?? 0,
    setTile: (x, y, id) => tiles.set(`${x},${y}`, id),
    getSelectedTile: () => 1,
    executeCommand: (cmd) => { /* ... */ },
  } as unknown as MapEditor;
}
```
