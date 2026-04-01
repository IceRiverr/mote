import { describe, it, expect, beforeEach } from 'vitest';
import { EraserTool } from '../tools/EraserTool.js';
import type { MapEditor } from '../Editor.js';

// 创建模拟的 MapEditor
function createMockEditor(): MapEditor {
  const tiles = new Map<string, number>();
  let selectedTile = 1;
  const executedCommands: unknown[] = [];

  return {
    getTile: (x: number, y: number) => tiles.get(`${x},${y}`) ?? 0,
    setTile: (x: number, y: number, tileId: number) => {
      tiles.set(`${x},${y}`, tileId);
    },
    getSelectedTile: () => selectedTile,
    setSelectedTile: (id: number) => { selectedTile = id; },
    executeCommand: (cmd: unknown) => executedCommands.push(cmd),
    _tiles: tiles,
    _executedCommands: executedCommands,
  } as unknown as MapEditor;
}

describe('EraserTool', () => {
  let editor: MapEditor;
  let tool: EraserTool;

  beforeEach(() => {
    editor = createMockEditor();
    tool = new EraserTool(editor);
  });

  it('应该有正确的工具属性', () => {
    expect(tool.name).toBe('橡皮');
    expect(tool.icon).toBe('⌫');
    expect(tool.cursor).toBe('not-allowed');
  });

  it('应该在 mousedown 时擦除瓦片', () => {
    // 预设一个瓦片
    editor.setTile(5, 5, 3);
    expect(editor.getTile(5, 5)).toBe(3);

    tool.onMouseDown({ x: 5, y: 5 });

    expect(editor.getTile(5, 5)).toBe(0);
  });

  it('应该在拖拽时擦除多个瓦片', () => {
    // 预设一行瓦片
    editor.setTile(1, 2, 1);
    editor.setTile(2, 2, 2);
    editor.setTile(3, 2, 3);

    tool.onMouseDown({ x: 1, y: 2 });
    tool.onMouseMove({ x: 2, y: 2 });
    tool.onMouseMove({ x: 3, y: 2 });

    expect(editor.getTile(1, 2)).toBe(0);
    expect(editor.getTile(2, 2)).toBe(0);
    expect(editor.getTile(3, 2)).toBe(0);
  });

  it('不应该重复擦除同一个瓦片', () => {
    editor.setTile(5, 5, 3);

    tool.onMouseDown({ x: 5, y: 5 });
    tool.onMouseMove({ x: 5, y: 5 }); // 相同位置
    tool.onMouseMove({ x: 5, y: 5 }); // 再次相同位置

    // 瓦片应该被擦除
    expect(editor.getTile(5, 5)).toBe(0);
  });

  it('擦除 VOID 瓦片时不应该记录', () => {
    // 位置 (5,5) 已经是 VOID (0)
    expect(editor.getTile(5, 5)).toBe(0);

    tool.onMouseDown({ x: 5, y: 5 });
    tool.onMouseUp({ x: 5, y: 5 });

    // 不应该提交命令，因为没有实际擦除任何内容
    const commands = (editor as any)._executedCommands;
    expect(commands.length).toBe(0);
  });

  it('应该在 mouseup 时提交命令', () => {
    editor.setTile(1, 1, 1);
    editor.setTile(2, 1, 2);

    tool.onMouseDown({ x: 1, y: 1 });
    tool.onMouseMove({ x: 2, y: 1 });
    tool.onMouseUp({ x: 2, y: 1 });

    const commands = (editor as any)._executedCommands;
    expect(commands.length).toBe(1);
  });

  it('应该记录正确的旧瓦片值用于撤销', () => {
    editor.setTile(5, 5, 7);

    tool.onMouseDown({ x: 5, y: 5 });
    tool.onMouseUp({ x: 5, y: 5 });

    const commands = (editor as any)._executedCommands;
    const cmd = commands[0] as any;

    expect(cmd.changes[0].oldTile).toBe(7);
    expect(cmd.changes[0].newTile).toBe(0);
  });

  it('应该在 mouseup 后重置状态', () => {
    editor.setTile(1, 1, 1);

    tool.onMouseDown({ x: 1, y: 1 });
    tool.onMouseUp({ x: 1, y: 1 });

    // mouseup 后再次移动不应该擦除
    tool.onMouseMove({ x: 2, y: 2 });

    // (2,2) 位置的瓦片应该不受影响
    expect(editor.getTile(2, 2)).toBe(0); // 本来就是 0
  });

  it('应该正确处理非拖拽状态', () => {
    editor.setTile(5, 5, 3);

    // 只调用 onMouseMove，不先调用 onMouseDown
    tool.onMouseMove({ x: 5, y: 5 });

    // 不应该擦除
    expect(editor.getTile(5, 5)).toBe(3);
  });

  describe('复杂擦除场景', () => {
    it('应该支持擦除矩形区域', () => {
      // 预设 3x3 区域
      for (let x = 1; x <= 3; x++) {
        for (let y = 1; y <= 3; y++) {
          editor.setTile(x, y, x * y);
        }
      }

      tool.onMouseDown({ x: 1, y: 1 });
      for (let x = 1; x <= 3; x++) {
        for (let y = 1; y <= 3; y++) {
          if (x !== 1 || y !== 1) {
            tool.onMouseMove({ x, y });
          }
        }
      }
      tool.onMouseUp({ x: 3, y: 3 });

      // 验证所有位置都被擦除
      for (let x = 1; x <= 3; x++) {
        for (let y = 1; y <= 3; y++) {
          expect(editor.getTile(x, y)).toBe(0);
        }
      }
    });

    it('应该支持选择性擦除（跳过已经是 VOID 的位置）', () => {
      // 设置一些瓦片，留一些 VOID
      editor.setTile(1, 1, 1);
      // (2,1) 保持 VOID
      editor.setTile(3, 1, 3);

      tool.onMouseDown({ x: 1, y: 1 });
      tool.onMouseMove({ x: 2, y: 1 }); // VOID，不应该记录
      tool.onMouseMove({ x: 3, y: 1 }); // 有瓦片，应该记录
      tool.onMouseUp({ x: 3, y: 1 });

      const commands = (editor as any)._executedCommands;
      const cmd = commands[0] as any;

      // 只记录了两个变化（1,1 和 3,1），跳过了 (2,1)
      expect(cmd.changes.length).toBe(2);
      expect(cmd.changes[0].x).toBe(1);
      expect(cmd.changes[1].x).toBe(3);
    });
  });
});
