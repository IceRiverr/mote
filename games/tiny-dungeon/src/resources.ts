// games/tiny-dungeon/src/resources.ts
// 游戏资源 —— MapData 和配置

/** 格子类型 */
export enum TileType {
  Empty = 0,
  Floor = 1,
  Wall = 2,
}

/** 地图数据 —— O(1) 碰撞查询 */
export class MapData {
  readonly width: number;
  readonly height: number;
  readonly tileSize: number;
  readonly grid: TileType[][];

  constructor(width: number, height: number, tileSize: number) {
    this.width = width;
    this.height = height;
    this.tileSize = tileSize;
    this.grid = Array.from({ length: height }, () =>
      Array(width).fill(TileType.Empty)
    );
  }

  /** 获取格子类型 */
  get(col: number, row: number): TileType {
    if (col < 0 || col >= this.width || row < 0 || row >= this.height) {
      return TileType.Wall;
    }
    return this.grid[row][col];
  }

  /** 设置格子类型 */
  set(col: number, row: number, type: TileType): void {
    if (col < 0 || col >= this.width || row < 0 || row >= this.height) return;
    this.grid[row][col] = type;
  }

  /** O(1) 碰撞查询 */
  isWall(col: number, row: number): boolean {
    return this.get(col, row) === TileType.Wall;
  }

  /** 世界坐标 → 格子坐标 */
  worldToTile(x: number, y: number): { col: number; row: number } {
    return {
      col: Math.floor(x / this.tileSize),
      row: Math.floor(y / this.tileSize),
    };
  }

  /** 获取所有 Floor 格子的坐标列表 */
  *floorTiles(): Generator<{ col: number; row: number; x: number; y: number }> {
    for (let row = 0; row < this.height; row++) {
      for (let col = 0; col < this.width; col++) {
        if (this.grid[row][col] === TileType.Floor) {
          yield {
            col, row,
            x: col * this.tileSize + this.tileSize / 2,
            y: row * this.tileSize + this.tileSize / 2,
          };
        }
      }
    }
  }

  /** 获取所有 Wall 格子的坐标列表 */
  *wallTiles(): Generator<{ col: number; row: number; x: number; y: number }> {
    for (let row = 0; row < this.height; row++) {
      for (let col = 0; col < this.width; col++) {
        if (this.grid[row][col] === TileType.Wall) {
          yield {
            col, row,
            x: col * this.tileSize + this.tileSize / 2,
            y: row * this.tileSize + this.tileSize / 2,
          };
        }
      }
    }
  }
}

/** 游戏配置 */
export interface GameConfig {
  mapWidth: number;
  mapHeight: number;
  tileSize: number;
  enemyCount: number;
  potionCount: number;
  houseCount: number;
}

export const DEFAULT_CONFIG: GameConfig = {
  mapWidth: 40,
  mapHeight: 30,
  tileSize: 16,
  enemyCount: 5,
  potionCount: 4,
  houseCount: 4,
};
