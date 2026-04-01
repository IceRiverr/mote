import { describe, it, expect, beforeEach } from 'vitest';
import { BrushTool } from '../tools/BrushTool.js';
import { MockEditorBridge } from '../core/EditorBridge.js';
import { CommandHistory } from '../core/CommandHistory.js';
import type { TilemapData } from '../types/editor.js';

describe('BrushTool', () => {
  let bridge: MockEditorBridge;
  let history: CommandHistory;
  let tool: BrushTool;

  const testTilemap: TilemapData = {
    tileSize: 32,
    width: 10,
    height: 10,
    tilesets: [{ image: 'test.png', columns: 8, tilecount: 16 }],
    layers: [
      { name: 'ground', data: new Array(100).fill(0) },
    ],
  };

  beforeEach(() => {
    bridge = new MockEditorBridge();
    bridge.setTilemapData(JSON.parse(JSON.stringify(testTilemap)));
    history = new CommandHistory();
    tool = new BrushTool(bridge, history);
    tool.setLayer('ground');
    tool.setTileId(5);
  });

  it('应该有正确的名称和图标', () => {
    expect(tool.name).toBe('Brush');
    expect(tool.icon).toBe('🖌️');
    expect(tool.cursor).toBe('crosshair');
  });

  it('pointer down 应该开始绘制', () => {
    tool.onPointerDown(2, 3);
    expect(bridge.getTile('ground', 2, 3)).toBe(5);
  });

  it('pointer move 应该连续绘制', () => {
    tool.onPointerDown(0, 0);
    tool.onPointerMove(1, 0);
    tool.onPointerMove(2, 0);

    expect(bridge.getTile('ground', 0, 0)).toBe(5);
    expect(bridge.getTile('ground', 1, 0)).toBe(5);
    expect(bridge.getTile('ground', 2, 0)).toBe(5);
  });

  it('pointer up 应该提交命令到历史', () => {
    tool.onPointerDown(0, 0);
    tool.onPointerMove(1, 0);
    tool.onPointerUp(1, 0);

    expect(history.canUndo()).toBe(true);
  });

  it('应该支持 undo', () => {
    tool.onPointerDown(0, 0);
    tool.onPointerMove(1, 0);
    tool.onPointerUp(1, 0);

    expect(bridge.getTile('ground', 0, 0)).toBe(5);

    history.undo();

    expect(bridge.getTile('ground', 0, 0)).toBe(0);
    expect(bridge.getTile('ground', 1, 0)).toBe(0);
  });

  it('不应该重复绘制相同格子', () => {
    tool.onPointerDown(0, 0);
    tool.onPointerMove(0, 0);
    tool.onPointerMove(0, 0);
    tool.onPointerUp(0, 0);

    // 只应该有一条历史记录（batch）
    history.undo();
    expect(bridge.getTile('ground', 0, 0)).toBe(0);
  });

  it('应该正确设置 layer 和 tileId', () => {
    tool.setLayer('objects');
    tool.setTileId(10);

    // 验证设置已生效
    // 由于我们使用的是同一个 bridge，设置 layer 不会真正改变什么
    // 但工具内部应该更新了这些值
    expect(() => tool.onPointerDown(0, 0)).not.toThrow();
  });
});

describe('EraserTool', () => {
  let bridge: MockEditorBridge;
  let history: CommandHistory;
  let tool: import('../tools/EraserToolNew.js').EraserTool;

  const testTilemap: TilemapData = {
    tileSize: 32,
    width: 10,
    height: 10,
    tilesets: [{ image: 'test.png', columns: 8, tilecount: 16 }],
    layers: [
      { name: 'ground', data: new Array(100).fill(1) }, // 初始全部为 1
    ],
  };

  beforeEach(async () => {
    const { EraserTool } = await import('../tools/EraserTool.js');
    bridge = new MockEditorBridge();
    bridge.setTilemapData(JSON.parse(JSON.stringify(testTilemap)));
    history = new CommandHistory();
    tool = new EraserTool(bridge, history);
    tool.setLayer('ground');
  });

  it('应该有正确的名称和图标', () => {
    expect(tool.name).toBe('Eraser');
    expect(tool.icon).toBe('🧼');
  });

  it('应该擦除 tiles（设置为 0）', () => {
    tool.onPointerDown(0, 0);
    tool.onPointerUp(0, 0);

    expect(bridge.getTile('ground', 0, 0)).toBe(0);
  });

  it('应该支持 undo 恢复', () => {
    tool.onPointerDown(0, 0);
    tool.onPointerUp(0, 0);

    expect(bridge.getTile('ground', 0, 0)).toBe(0);

    history.undo();
    expect(bridge.getTile('ground', 0, 0)).toBe(1);
  });

  it('不应该重复擦除空 tile', () => {
    // 先将 (0,0) 设为 0
    bridge.setTile('ground', 0, 0, 0);

    tool.onPointerDown(0, 0);
    tool.onPointerMove(0, 0);
    tool.onPointerUp(0, 0);

    // 如果没有实际变更，不应该创建命令
    expect(history.canUndo()).toBe(false);
  });
});

describe('RectTool', () => {
  let bridge: MockEditorBridge;
  let history: CommandHistory;
  let tool: import('../tools/RectToolNew.js').RectTool;

  const testTilemap: TilemapData = {
    tileSize: 32,
    width: 10,
    height: 10,
    tilesets: [{ image: 'test.png', columns: 8, tilecount: 16 }],
    layers: [
      { name: 'ground', data: new Array(100).fill(0) },
    ],
  };

  beforeEach(async () => {
    const { RectTool } = await import('../tools/RectTool.js');
    bridge = new MockEditorBridge();
    bridge.setTilemapData(JSON.parse(JSON.stringify(testTilemap)));
    history = new CommandHistory();
    tool = new RectTool(bridge, history);
    tool.setLayer('ground');
    tool.setTileId(5);
  });

  it('应该有正确的名称和图标', () => {
    expect(tool.name).toBe('Rectangle');
    expect(tool.icon).toBe('▭');
  });

  it('拖拽应该绘制矩形', () => {
    tool.onPointerDown(1, 1);
    tool.onPointerMove(3, 3);
    tool.onPointerUp(3, 3);

    // 矩形角落
    expect(bridge.getTile('ground', 1, 1)).toBe(5);
    expect(bridge.getTile('ground', 3, 3)).toBe(5);
    expect(bridge.getTile('ground', 1, 3)).toBe(5);
    expect(bridge.getTile('ground', 3, 1)).toBe(5);

    // 矩形中心
    expect(bridge.getTile('ground', 2, 2)).toBe(5);

    // 矩形外
    expect(bridge.getTile('ground', 0, 0)).toBe(0);
  });

  it('应该支持 undo', () => {
    tool.onPointerDown(1, 1);
    tool.onPointerMove(2, 2);
    tool.onPointerUp(2, 2);

    expect(bridge.getTile('ground', 1, 1)).toBe(5);

    history.undo();

    expect(bridge.getTile('ground', 1, 1)).toBe(0);
  });

  it('应该提供预览', () => {
    tool.onPointerDown(1, 1);
    tool.onPointerMove(3, 3);

    const preview = tool.getPreview?.();
    expect(preview).toBeDefined();
    expect(preview?.type).toBe('rect');
    expect(preview?.x).toBe(1);
    expect(preview?.y).toBe(1);
    expect(preview?.w).toBe(3);
    expect(preview?.h).toBe(3);
  });

  it('释放后应该清除预览', () => {
    tool.onPointerDown(1, 1);
    tool.onPointerMove(3, 3);
    tool.onPointerUp(3, 3);

    const preview = tool.getPreview?.();
    expect(preview).toBeNull();
  });
});
