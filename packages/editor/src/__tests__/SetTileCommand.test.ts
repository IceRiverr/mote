import { describe, it, expect, beforeEach } from 'vitest';
import { 
  SetTileCommand, 
  BatchSetTileCommand,
  ClearLayerCommand,
  FillRegionCommand 
} from '../commands/SetTileCommand.js';
import { MockEditorBridge } from '../core/EditorBridge.js';
import type { TilemapData } from '../types/editor.js';

describe('SetTileCommand', () => {
  let bridge: MockEditorBridge;
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
  });

  it('应该正确执行单个 tile 设置', () => {
    const cmd = new SetTileCommand(bridge, 'ground', 5, 5, 0, 5);
    cmd.execute();
    expect(bridge.getTile('ground', 5, 5)).toBe(5);
  });

  it('应该正确撤销单个 tile 设置', () => {
    const cmd = new SetTileCommand(bridge, 'ground', 5, 5, 0, 5);
    cmd.execute();
    cmd.undo();
    expect(bridge.getTile('ground', 5, 5)).toBe(0);
  });

  it('应该有正确的描述', () => {
    const cmd = new SetTileCommand(bridge, 'ground', 5, 5, 0, 10);
    expect(cmd.description).toBe('Set tile (5,5) to 10');
  });
});

describe('BatchSetTileCommand', () => {
  let bridge: MockEditorBridge;
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
  });

  it('应该正确执行批量设置', () => {
    const changes = [
      { x: 0, y: 0, oldTileId: 0, newTileId: 1 },
      { x: 1, y: 0, oldTileId: 0, newTileId: 2 },
      { x: 2, y: 0, oldTileId: 0, newTileId: 3 },
    ];
    const cmd = new BatchSetTileCommand(bridge, 'ground', changes);
    cmd.execute();

    expect(bridge.getTile('ground', 0, 0)).toBe(1);
    expect(bridge.getTile('ground', 1, 0)).toBe(2);
    expect(bridge.getTile('ground', 2, 0)).toBe(3);
  });

  it('应该正确撤销批量设置', () => {
    const changes = [
      { x: 0, y: 0, oldTileId: 0, newTileId: 1 },
      { x: 1, y: 0, oldTileId: 0, newTileId: 2 },
    ];
    const cmd = new BatchSetTileCommand(bridge, 'ground', changes);
    cmd.execute();
    cmd.undo();

    expect(bridge.getTile('ground', 0, 0)).toBe(0);
    expect(bridge.getTile('ground', 1, 0)).toBe(0);
  });

  it('单 tile 时应该有单数描述', () => {
    const changes = [{ x: 0, y: 0, oldTileId: 0, newTileId: 1 }];
    const cmd = new BatchSetTileCommand(bridge, 'ground', changes);
    expect(cmd.description).toBe('Set tile (0,0)');
  });

  it('多 tile 时应该有数量描述', () => {
    const changes = [
      { x: 0, y: 0, oldTileId: 0, newTileId: 1 },
      { x: 1, y: 0, oldTileId: 0, newTileId: 2 },
    ];
    const cmd = new BatchSetTileCommand(bridge, 'ground', changes);
    expect(cmd.description).toBe('Paint 2 tiles');
  });

  it('应该返回受影响的 tile 数量', () => {
    const changes = [
      { x: 0, y: 0, oldTileId: 0, newTileId: 1 },
      { x: 1, y: 0, oldTileId: 0, newTileId: 2 },
    ];
    const cmd = new BatchSetTileCommand(bridge, 'ground', changes);
    expect(cmd.getAffectedCount()).toBe(2);
  });
});

describe('ClearLayerCommand', () => {
  let bridge: MockEditorBridge;
  const testTilemap: TilemapData = {
    tileSize: 32,
    width: 5,
    height: 5,
    tilesets: [{ image: 'test.png', columns: 8, tilecount: 16 }],
    layers: [
      { name: 'ground', data: [1, 2, 3, 4, 5, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0] },
    ],
  };

  beforeEach(() => {
    bridge = new MockEditorBridge();
    bridge.setTilemapData(JSON.parse(JSON.stringify(testTilemap)));
  });

  it('应该清空图层', () => {
    const cmd = new ClearLayerCommand(bridge, 'ground', 5, 5);
    cmd.execute();
    
    const tilemap = bridge.getTilemapData();
    expect(tilemap?.layers[0].data.every(t => t === 0)).toBe(true);
  });

  it('应该恢复清空前的数据', () => {
    const cmd = new ClearLayerCommand(bridge, 'ground', 5, 5);
    cmd.execute();
    cmd.undo();
    
    expect(bridge.getTile('ground', 0, 0)).toBe(1);
    expect(bridge.getTile('ground', 1, 0)).toBe(2);
    expect(bridge.getTile('ground', 2, 0)).toBe(3);
  });

  it('应该有正确的描述', () => {
    const cmd = new ClearLayerCommand(bridge, 'ground', 5, 5);
    expect(cmd.description).toBe('Clear layer "ground"');
  });
});

describe('FillRegionCommand', () => {
  let bridge: MockEditorBridge;
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
  });

  it('应该填充指定区域', () => {
    const cmd = new FillRegionCommand(bridge, 'ground', 2, 2, 3, 3, 5);
    cmd.execute();

    expect(bridge.getTile('ground', 2, 2)).toBe(5);
    expect(bridge.getTile('ground', 4, 4)).toBe(5);
    expect(bridge.getTile('ground', 1, 1)).toBe(0); // 区域外
  });

  it('应该撤销填充', () => {
    const cmd = new FillRegionCommand(bridge, 'ground', 2, 2, 3, 3, 5);
    cmd.execute();
    cmd.undo();

    expect(bridge.getTile('ground', 2, 2)).toBe(0);
    expect(bridge.getTile('ground', 4, 4)).toBe(0);
  });

  it('应该有正确的描述', () => {
    const cmd = new FillRegionCommand(bridge, 'ground', 0, 0, 5, 5, 10);
    expect(cmd.description).toBe('Fill region (0,0,5x5) with tile 10');
  });
});
