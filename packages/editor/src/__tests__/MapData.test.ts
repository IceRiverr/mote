import { describe, it, expect } from 'vitest';
import type { MapData, GameConfig, TileDef, ExportOptions } from '../MapData.js';

describe('MapData Types', () => {
  describe('MapData', () => {
    it('应该符合 MapData 结构', () => {
      const mapData: MapData = {
        version: 1,
        name: 'test-map',
        width: 20,
        height: 15,
        tileSize: 32,
        tiles: new Array(300).fill(0),
        spawnPoint: { x: 10, y: 7 },
      };

      expect(mapData.version).toBe(1);
      expect(mapData.width).toBe(20);
      expect(mapData.height).toBe(15);
      expect(mapData.tiles.length).toBe(300);
      expect(mapData.spawnPoint).toEqual({ x: 10, y: 7 });
    });

    it('瓦片数组长度应该等于 width * height', () => {
      const width = 10;
      const height = 8;
      const tiles = new Array(width * height).fill(0).map((_, i) => i);

      const mapData: MapData = {
        version: 1,
        name: 'dimension-test',
        width,
        height,
        tileSize: 64,
        tiles,
        spawnPoint: { x: 5, y: 4 },
      };

      expect(mapData.tiles.length).toBe(width * height);
    });

    it('应该支持坐标到索引的转换', () => {
      const width = 10;
      const height = 10;
      const tiles: number[] = [];
      
      // 填充有规律的值用于测试
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          tiles.push(y * width + x);
        }
      }

      const mapData: MapData = {
        version: 1,
        name: 'index-test',
        width,
        height,
        tileSize: 32,
        tiles,
        spawnPoint: { x: 0, y: 0 },
      };

      // 测试坐标转换公式: index = y * width + x
      expect(mapData.tiles[0]).toBe(0);   // (0, 0)
      expect(mapData.tiles[9]).toBe(9);   // (9, 0)
      expect(mapData.tiles[10]).toBe(10); // (0, 1)
      expect(mapData.tiles[55]).toBe(55); // (5, 5)
    });
  });

  describe('TileDef', () => {
    it('应该支持基本属性', () => {
      const tile: TileDef = {
        id: 1,
        name: 'grass',
        color: '#228b22',
        solid: false,
      };

      expect(tile.id).toBe(1);
      expect(tile.name).toBe('grass');
      expect(tile.color).toBe('#228b22');
      expect(tile.solid).toBe(false);
    });

    it('应该支持可选的 tileset 属性', () => {
      const tile: TileDef = {
        id: 2,
        name: 'wall',
        color: '#808080',
        solid: true,
        category: 'walls',
        tilesetImage: '/assets/tileset.png',
        srcX: 64,
        srcY: 0,
        srcW: 32,
        srcH: 32,
      };

      expect(tile.tilesetImage).toBe('/assets/tileset.png');
      expect(tile.srcX).toBe(64);
      expect(tile.srcY).toBe(0);
      expect(tile.srcW).toBe(32);
      expect(tile.srcH).toBe(32);
      expect(tile.category).toBe('walls');
    });

    it('应该支持分类属性', () => {
      const groundTile: TileDef = {
        id: 1,
        name: 'ground',
        color: '#8b4513',
        solid: false,
        category: 'ground',
      };

      const wallTile: TileDef = {
        id: 2,
        name: 'wall',
        color: '#696969',
        solid: true,
        category: 'walls',
      };

      expect(groundTile.category).toBe('ground');
      expect(wallTile.category).toBe('walls');
    });
  });

  describe('GameConfig', () => {
    it('应该符合 GameConfig 结构', () => {
      const config: GameConfig = {
        id: 'dungeon',
        name: 'Dungeon Game',
        tileSize: 64,
        defaultWidth: 20,
        defaultHeight: 15,
        tiles: [
          { id: 0, name: 'VOID', color: '#000000', solid: false },
          { id: 1, name: 'WALL', color: '#808080', solid: true },
          { id: 2, name: 'FLOOR', color: '#8b4513', solid: false },
        ],
      };

      expect(config.id).toBe('dungeon');
      expect(config.tileSize).toBe(64);
      expect(config.tiles.length).toBe(3);
    });

    it('应该支持 enum 导出模式', () => {
      const config: GameConfig = {
        id: 'my-game',
        name: 'My Game',
        tileSize: 32,
        defaultWidth: 10,
        defaultHeight: 10,
        exportMode: 'enum',
        tiles: [
          { id: 0, name: 'T.VOID', color: '#000000', solid: false },
          { id: 1, name: 'T.GRASS', color: '#00ff00', solid: false },
        ],
      };

      expect(config.exportMode).toBe('enum');
    });

    it('应该支持 index 导出模式', () => {
      const config: GameConfig = {
        id: 'tileset-game',
        name: 'Tileset Game',
        tileSize: 16,
        defaultWidth: 20,
        defaultHeight: 20,
        exportMode: 'index',
        tileset: '/assets/tileset.json',
        tiles: [],
      };

      expect(config.exportMode).toBe('index');
      expect(config.tileset).toBe('/assets/tileset.json');
    });
  });

  describe('ExportOptions', () => {
    it('应该支持 TypeScript 导出', () => {
      const options: ExportOptions = {
        format: 'ts',
        includeComments: true,
        optimize: false,
      };

      expect(options.format).toBe('ts');
    });

    it('应该支持 JSON 导出', () => {
      const options: ExportOptions = {
        format: 'json',
      };

      expect(options.format).toBe('json');
    });

    it('应该支持 PNG 导出', () => {
      const options: ExportOptions = {
        format: 'png',
        optimize: true,
      };

      expect(options.format).toBe('png');
    });
  });
});

describe('MapData 工具函数', () => {
  describe('坐标转换', () => {
    it('应该正确计算 tile 索引', () => {
      const width = 15;
      const x = 7;
      const y = 5;
      const expectedIndex = y * width + x; // 5 * 15 + 7 = 82

      expect(expectedIndex).toBe(82);
    });

    it('应该正确从索引反推坐标', () => {
      const width = 15;
      const index = 82;
      const x = index % width;  // 82 % 15 = 7
      const y = Math.floor(index / width); // Math.floor(82 / 15) = 5

      expect(x).toBe(7);
      expect(y).toBe(5);
    });
  });

  describe('边界检查', () => {
    it('应该识别有效坐标', () => {
      const width = 10;
      const height = 8;

      const isValid = (x: number, y: number) => 
        x >= 0 && x < width && y >= 0 && y < height;

      expect(isValid(0, 0)).toBe(true);
      expect(isValid(9, 7)).toBe(true);
      expect(isValid(5, 5)).toBe(true);
    });

    it('应该识别无效坐标', () => {
      const width = 10;
      const height = 8;

      const isValid = (x: number, y: number) => 
        x >= 0 && x < width && y >= 0 && y < height;

      expect(isValid(-1, 0)).toBe(false);
      expect(isValid(0, -1)).toBe(false);
      expect(isValid(10, 0)).toBe(false);
      expect(isValid(0, 8)).toBe(false);
    });
  });
});
