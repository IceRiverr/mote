import { describe, it, expect, beforeEach } from 'vitest';
import { RectTool } from '../tools/RectTool.js';
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

describe('RectTool', () => {
  let editor: MapEditor;
  let tool: RectTool;

  beforeEach(() => {
    editor = createMockEditor();
    tool = new RectTool(editor);
  });

  it('应该有正确的工具属性', () => {
    expect(tool.name).toBe('矩形');
    expect(tool.icon).toBe('▭');
    expect(tool.cursor).toBe('crosshair');
  });

  it('应该在 mousedown 时记录起始位置', () => {
    tool.onMouseDown({ x: 3, y: 4 });
    
    // 通过预览矩形验证
    const preview = tool.getPreviewRect();
    expect(preview).not.toBeNull();
    expect(preview!.x).toBe(3);
    expect(preview!.y).toBe(4);
  });

  it('应该在拖拽时更新预览矩形', () => {
    tool.onMouseDown({ x: 1, y: 1 });
    tool.onMouseMove({ x: 3, y: 4 });

    const preview = tool.getPreviewRect();
    expect(preview).toEqual({
      x: 1,
      y: 1,
      w: 3, // 3 - 1 + 1 = 3
      h: 4, // 4 - 1 + 1 = 4
    });
  });

  it('应该支持反向拖拽（从右下到左上）', () => {
    tool.onMouseDown({ x: 5, y: 5 });
    tool.onMouseMove({ x: 2, y: 3 });

    const preview = tool.getPreviewRect();
    expect(preview).toEqual({
      x: 2,
      y: 3,
      w: 4, // 5 - 2 + 1 = 4
      h: 3, // 5 - 3 + 1 = 3
    });
  });

  it('应该在 mouseup 时填充矩形', () => {
    tool.onMouseDown({ x: 1, y: 1 });
    tool.onMouseMove({ x: 3, y: 3 });
    tool.onMouseUp({ x: 3, y: 3 });

    // 验证 3x3 区域被填充
    for (let x = 1; x <= 3; x++) {
      for (let y = 1; y <= 3; y++) {
        expect(editor.getTile(x, y)).toBe(1);
      }
    }
  });

  it('应该在 mouseup 时提交命令', () => {
    tool.onMouseDown({ x: 1, y: 1 });
    tool.onMouseMove({ x: 2, y: 2 });
    tool.onMouseUp({ x: 2, y: 2 });

    const commands = (editor as any)._executedCommands;
    expect(commands.length).toBe(1);
  });

  it('释放鼠标后应该清除预览', () => {
    tool.onMouseDown({ x: 1, y: 1 });
    tool.onMouseMove({ x: 3, y: 3 });
    expect(tool.getPreviewRect()).not.toBeNull();

    tool.onMouseUp({ x: 3, y: 3 });
    expect(tool.getPreviewRect()).toBeNull();
  });

  it('拖拽后 mousemove 不应该更新预览', () => {
    tool.onMouseDown({ x: 1, y: 1 });
    tool.onMouseMove({ x: 3, y: 3 });
    tool.onMouseUp({ x: 3, y: 3 });

    // 释放后再移动
    tool.onMouseMove({ x: 5, y: 5 });
    expect(tool.getPreviewRect()).toBeNull();
  });

  it('使用不同的 tile ID 填充', () => {
    // 修改 mock 的 selectedTile，需要在创建新工具前修改
    (editor as any).getSelectedTile = () => 5;
    tool = new RectTool(editor); // 重新创建工具

    tool.onMouseDown({ x: 0, y: 0 });
    tool.onMouseMove({ x: 1, y: 1 }); // 需要调用 mouseMove 设置 endPos
    tool.onMouseUp({ x: 1, y: 1 });

    expect(editor.getTile(0, 0)).toBe(5);
    expect(editor.getTile(1, 0)).toBe(5);
    expect(editor.getTile(0, 1)).toBe(5);
    expect(editor.getTile(1, 1)).toBe(5);
  });

  it('不应该重复填充相同的瓦片', () => {
    // 预填充一些瓦片
    editor.setTile(1, 1, 1);
    editor.setTile(2, 2, 1);

    tool.onMouseDown({ x: 1, y: 1 });
    tool.onMouseMove({ x: 2, y: 2 });
    tool.onMouseUp({ x: 2, y: 2 });

    const commands = (editor as any)._executedCommands;
    const cmd = commands[0] as any;

    // 只有 (1,2) 和 (2,1) 是真正的新变化
    // (1,1) 和 (2,2) 已经是相同的值，不应该包含在 changes 中
    expect(cmd.changes.length).toBe(2);
    expect(cmd.changes.map((c: any) => ({ x: c.x, y: c.y }))).toContainEqual({ x: 1, y: 2 });
    expect(cmd.changes.map((c: any) => ({ x: c.x, y: c.y }))).toContainEqual({ x: 2, y: 1 });
  });

  it('单点点击应该绘制 1x1 矩形', () => {
    tool.onMouseDown({ x: 5, y: 5 });
    tool.onMouseUp({ x: 5, y: 5 });

    expect(editor.getTile(5, 5)).toBe(1);
    expect((editor as any)._executedCommands.length).toBe(1);
  });

  describe('getStartPos / getEndPos', () => {
    it('应该返回起始位置', () => {
      tool.onMouseDown({ x: 2, y: 3 });
      
      const startPos = tool.getStartPos();
      expect(startPos).toEqual({ x: 2, y: 3 });
    });

    it('应该返回结束位置', () => {
      tool.onMouseDown({ x: 1, y: 1 });
      tool.onMouseMove({ x: 4, y: 5 });

      const endPos = tool.getEndPos();
      expect(endPos).toEqual({ x: 4, y: 5 });
    });

    it('释放后位置应该被清除', () => {
      tool.onMouseDown({ x: 1, y: 1 });
      tool.onMouseUp({ x: 3, y: 3 });

      expect(tool.getStartPos()).toBeNull();
      expect(tool.getEndPos()).toBeNull();
    });
  });
});
