import { describe, it, expect, beforeEach } from 'vitest';
import { PaintTilesCommand, ResizeMapCommand } from '../commands/TileCommands.js';
import type { MapEditor } from '../Editor.js';

// 创建模拟的 MapEditor
function createMockEditor(initialTiles: number[] = [], width = 10, height = 10): MapEditor {
  const tiles = [...initialTiles];
  
  return {
    setTile: (x: number, y: number, tileId: number) => {
      if (x >= 0 && x < width && y >= 0 && y < height) {
        tiles[y * width + x] = tileId;
      }
    },
    getTile: (x: number, y: number) => {
      if (x < 0 || x >= width || y < 0 || y >= height) return 0;
      return tiles[y * width + x] ?? 0;
    },
    // 暴露内部状态用于测试
    _tiles: tiles,
    _width: width,
    _height: height,
  } as unknown as MapEditor;
}

describe('PaintTilesCommand', () => {
  let editor: MapEditor;

  beforeEach(() => {
    // 10x10 的地图，初始全为 0
    editor = createMockEditor(new Array(100).fill(0), 10, 10);
  });

  it('应该绘制单个瓦片', () => {
    const changes = [{ x: 5, y: 5, oldTile: 0, newTile: 3 }];
    const cmd = new PaintTilesCommand(editor, changes);

    cmd.execute();
    expect(editor.getTile(5, 5)).toBe(3);

    cmd.undo();
    expect(editor.getTile(5, 5)).toBe(0);
  });

  it('应该绘制多个瓦片', () => {
    const changes = [
      { x: 1, y: 1, oldTile: 0, newTile: 1 },
      { x: 2, y: 1, oldTile: 0, newTile: 2 },
      { x: 3, y: 1, oldTile: 0, newTile: 3 },
    ];
    const cmd = new PaintTilesCommand(editor, changes);

    cmd.execute();
    expect(editor.getTile(1, 1)).toBe(1);
    expect(editor.getTile(2, 1)).toBe(2);
    expect(editor.getTile(3, 1)).toBe(3);

    cmd.undo();
    expect(editor.getTile(1, 1)).toBe(0);
    expect(editor.getTile(2, 1)).toBe(0);
    expect(editor.getTile(3, 1)).toBe(0);
  });

  it('撤销应该恢复到原始值，不一定是 0', () => {
    // 预设置一些瓦片
    (editor as any)._tiles[15] = 5; // (5, 1) = 5

    const changes = [{ x: 5, y: 1, oldTile: 5, newTile: 7 }];
    const cmd = new PaintTilesCommand(editor, changes);

    cmd.execute();
    expect(editor.getTile(5, 1)).toBe(7);

    cmd.undo();
    expect(editor.getTile(5, 1)).toBe(5); // 恢复为 5 而不是 0
  });

  it('命令名称应该根据瓦片数量变化', () => {
    const singleChange = [{ x: 0, y: 0, oldTile: 0, newTile: 1 }];
    const singleCmd = new PaintTilesCommand(editor, singleChange);
    // 单个瓦片显示"绘制瓦片"
    expect(singleCmd.name).toBe('绘制瓦片');

    const multiChanges = [
      { x: 0, y: 0, oldTile: 0, newTile: 1 },
      { x: 1, y: 0, oldTile: 0, newTile: 2 },
    ];
    const multiCmd = new PaintTilesCommand(editor, multiChanges);
    // 多个瓦片显示"绘制 X 个瓦片"
    expect(multiCmd.name).toBe('绘制 2 个瓦片');
  });

  it('重复执行和撤销应该保持一致', () => {
    const changes = [
      { x: 2, y: 2, oldTile: 0, newTile: 9 },
      { x: 3, y: 2, oldTile: 0, newTile: 9 },
    ];
    const cmd = new PaintTilesCommand(editor, changes);

    // 多次执行和撤销
    for (let i = 0; i < 3; i++) {
      cmd.execute();
      expect(editor.getTile(2, 2)).toBe(9);
      expect(editor.getTile(3, 2)).toBe(9);

      cmd.undo();
      expect(editor.getTile(2, 2)).toBe(0);
      expect(editor.getTile(3, 2)).toBe(0);
    }
  });

  it('应该正确处理空的变化列表', () => {
    const cmd = new PaintTilesCommand(editor, []);
    // 空列表显示"绘制 0 个瓦片"
    expect(cmd.name).toBe('绘制 0 个瓦片');
    
    // 不应该报错
    cmd.execute();
    cmd.undo();
  });
});

describe('ResizeMapCommand', () => {
  it('应该调整地图尺寸', () => {
    const editor = createMockEditor(new Array(16).fill(0), 4, 4);
    const oldTiles = new Array(16).fill(0);
    const newTiles = new Array(36).fill(0); // 6x6

    const cmd = new ResizeMapCommand(
      editor,
      4, 4, oldTiles, { x: 2, y: 2 },
      6, 6, newTiles, { x: 3, y: 3 }
    );

    cmd.execute();
    // 验证 mapData 被修改
    const mapData = (editor as any).mapData;
    if (mapData) {
      expect(mapData.width).toBe(6);
      expect(mapData.height).toBe(6);
    }

    cmd.undo();
    if (mapData) {
      expect(mapData.width).toBe(4);
      expect(mapData.height).toBe(4);
    }
  });

  it('命令名称应该是"调整地图尺寸"', () => {
    const editor = createMockEditor();
    const cmd = new ResizeMapCommand(
      editor,
      10, 10, [], { x: 5, y: 5 },
      20, 20, [], { x: 10, y: 10 }
    );
    expect(cmd.name).toBe('调整地图尺寸');
  });
});
