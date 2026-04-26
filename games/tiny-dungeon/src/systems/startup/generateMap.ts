// games/tiny-dungeon/src/systems/startup/generateMap.ts
// Startup: 生成地形数据，填充 MapData

import type { World } from '@mote/engine';
import { MapData, TileType, type GameConfig } from '../../resources.js';

export function generateMapSystem(world: World): void {
  const config = world.getResource<GameConfig>('GameConfig');
  const { mapWidth, mapHeight, tileSize } = config;

  const map = new MapData(mapWidth, mapHeight, tileSize);

  // 1. 边界墙
  generateBorder(map);

  // 2. 内部地面（默认全部铺 Floor）
  for (let row = 1; row < mapHeight - 1; row++) {
    for (let col = 1; col < mapWidth - 1; col++) {
      map.set(col, row, TileType.Floor);
    }
  }

  // 3. 随机生成房子
  generateHouses(map, config);

  // 插入 Resource
  world.addResource('MapData', map);
}

/** 生成边界墙 */
function generateBorder(map: MapData): void {
  const { width, height } = map;
  for (let col = 0; col < width; col++) {
    map.set(col, 0, TileType.Wall);
    map.set(col, height - 1, TileType.Wall);
  }
  for (let row = 0; row < height; row++) {
    map.set(0, row, TileType.Wall);
    map.set(width - 1, row, TileType.Wall);
  }
}

/** 房子数据 */
interface House {
  col: number;
  row: number;
  width: number;
  height: number;
}

/** 生成随机房子 */
function generateHouses(map: MapData, config: GameConfig): void {
  const houses: House[] = [];
  const count = config.houseCount;

  for (let i = 0; i < count; i++) {
    const width = 4 + Math.floor(Math.random() * 4);
    const height = 4 + Math.floor(Math.random() * 4);
    const col = 2 + Math.floor(Math.random() * (config.mapWidth - width - 4));
    const row = 2 + Math.floor(Math.random() * (config.mapHeight - height - 4));

    const house: House = { col, row, width, height };

    if (!housesOverlap(houses, house)) {
      carveHouse(map, house);
      houses.push(house);
    }
  }
}

function housesOverlap(existing: House[], candidate: House): boolean {
  for (const h of existing) {
    if (
      candidate.col < h.col + h.width &&
      candidate.col + candidate.width > h.col &&
      candidate.row < h.row + h.height &&
      candidate.row + candidate.height > h.row
    ) {
      return true;
    }
  }
  return false;
}

function carveHouse(map: MapData, house: House): void {
  for (let r = house.row; r < house.row + house.height; r++) {
    for (let c = house.col; c < house.col + house.width; c++) {
      // 四周是墙，中间保持 Floor
      const isEdge =
        r === house.row ||
        r === house.row + house.height - 1 ||
        c === house.col ||
        c === house.col + house.width - 1;

      map.set(c, r, isEdge ? TileType.Wall : TileType.Floor);
    }
  }
}
