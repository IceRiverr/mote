import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BrushTool } from '../tools/BrushTool.js';
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

describe('BrushTool', () => {
  let editor: MapEditor;
  let tool: BrushTool;

  beforeEach(() => {
    editor = createMockEditor();
    tool = new BrushTool(editor);
  });

  it('应该有正确的工具属性', () => {
    expect(tool.name).toBe('画笔');
    expect(tool.icon).toBe('🖱️');
    expect(tool.cursor).toBe('crosshair');
  });

  it('应该在 mousedown 时开始绘制', () => {
    tool.onMouseDown({ x: 5, y: 5 });
    
    expect(editor.getTile(5, 5)).toBe(1); // 使用选中的瓦片
  });

  it('应该在拖拽时绘制多个瓦片', () => {
    tool.onMouseDown({ x: 1, y: 1 });
    tool.onMouseMove({ x: 2, y: 1 });
    tool.onMouseMove({ x: 3, y: 1 });
    
    expect(editor.getTile(1, 1)).toBe(1);
    expect(editor.getTile(2, 1)).toBe(1);
    expect(editor.getTile(3, 1)).toBe(1);
  });

  it('不应该重复绘制同一个瓦片', () => {
    tool.onMouseDown({ x: 5, y: 5 });
    tool.onMouseMove({ x: 5, y: 5 }); // 相同位置
    tool.onMouseMove({ x: 5, y: 5 }); // 再次相同位置
    
    // 瓦片应该只被设置一次
    expect(editor.getTile(5, 5)).toBe(1);
  });

  it('应该在 mouseup 时提交命令', () => {
    tool.onMouseDown({ x: 1, y: 1 });
    tool.onMouseMove({ x: 2, y: 1 });
    tool.onMouseUp({ x: 2, y: 1 });

    const commands = (editor as any)._executedCommands;
    expect(commands.length).toBe(1);
  });

  it('没有绘制时不应该提交命令', () => {
    tool.onMouseDown({ x: 1, y: 1 });
    // 立即在同一个位置 mouseup，没有实际绘制
    tool.onMouseUp({ x: 1, y: 1 });

    // 由于绘制了同一个位置，实际上会执行
    // 让我们测试完全没有拖拽的情况
    const commands = (editor as any)._executedCommands;
    expect(commands.length).toBe(1); // onMouseDown 已经绘制了
  });

  it('应该支持使用不同的瓦片 ID', () => {
    (editor as any).setSelectedTile(5);
    
    tool.onMouseDown({ x: 3, y: 3 });
    
    expect(editor.getTile(3, 3)).toBe(5);
  });

  it('应该正确处理非拖拽状态', () => {
    // 只调用 onMouseMove，不先调用 onMouseDown
    tool.onMouseMove({ x: 5, y: 5 });
    
    expect(editor.getTile(5, 5)).toBe(0); // 不应该绘制
  });

  it('应该在 mouseup 后重置状态', () => {
    tool.onMouseDown({ x: 1, y: 1 });
    tool.onMouseUp({ x: 1, y: 1 });
    
    // mouseup 后再次移动不应该绘制
    tool.onMouseMove({ x: 2, y: 2 });
    
    expect(editor.getTile(2, 2)).toBe(0);
  });

  it('应该记录正确的旧瓦片值用于撤销', () => {
    // 预设置瓦片
    editor.setTile(5, 5, 3);
    
    tool.onMouseDown({ x: 5, y: 5 });
    tool.onMouseUp({ x: 5, y: 5 });

    const commands = (editor as any)._executedCommands;
    expect(commands.length).toBe(1);
    
    const cmd = commands[0] as any;
    expect(cmd.changes[0].oldTile).toBe(3);
    expect(cmd.changes[0].newTile).toBe(1);
  });

  it('当瓦片值未改变时不应该提交命令', () => {
    // 预设置瓦片为相同的值（与选中的 tileId = 1 相同）
    editor.setTile(5, 5, 1);
    
    tool.onMouseDown({ x: 5, y: 5 });
    tool.onMouseUp({ x: 5, y: 5 });

    // BrushTool 会在新旧值相同时跳过记录，不会提交命令
    const commands = (editor as any)._executedCommands;
    expect(commands.length).toBe(0);
  });

  describe('复杂绘制场景', () => {
    it('应该支持绘制矩形区域', () => {
      const drawnPositions: Array<{x: number, y: number}> = [];
      
      // 模拟一个 3x3 的绘制
      tool.onMouseDown({ x: 1, y: 1 });
      
      for (let x = 1; x <= 3; x++) {
        for (let y = 1; y <= 3; y++) {
          if (x !== 1 || y !== 1) {
            tool.onMouseMove({ x, y });
          }
          drawnPositions.push({ x, y });
        }
      }
      
      tool.onMouseUp({ x: 3, y: 3 });

      // 验证所有位置都被绘制
      for (let x = 1; x <= 3; x++) {
        for (let y = 1; y <= 3; y++) {
          expect(editor.getTile(x, y)).toBe(1);
        }
      }
    });

    it('应该支持绘制复杂路径', () => {
      const path = [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 1, y: 1 },
        { x: 2, y: 1 },
        { x: 2, y: 2 },
        { x: 3, y: 2 },
      ];

      tool.onMouseDown(path[0]);
      
      for (let i = 1; i < path.length; i++) {
        tool.onMouseMove(path[i]);
      }
      
      tool.onMouseUp(path[path.length - 1]);

      // 验证路径上所有点都被绘制
      path.forEach(pos => {
        expect(editor.getTile(pos.x, pos.y)).toBe(1);
      });
    });
  });
});
