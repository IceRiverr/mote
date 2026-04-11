// games/tiny-dungeon/src/world-init.ts
// 游戏世界初始化 —— 所有东西都是实体

import { World, Transform, Camera, Sprite } from '@mote/engine';
import { FloorTag, WallTag } from './components.js';

/** 游戏世界配置 */
export const WORLD_CONFIG = {
  mapWidth: 40,    // 地图宽度（格子数）
  mapHeight: 30,   // 地图高度（格子数）
  tileSize: 16,    // 格子像素尺寸
  scale: 2,        // 渲染缩放
};

/** 精灵索引 */
const SPRITES = {
  floor_1: 48,     // 随机地面 1
  floor_2: 49,     // 随机地面 2
  floor_3: 42,     // 随机地面 3
  wall: 40,        // 墙壁
  player: 98,
  axe: 118,
  skeleton: 121,
  potion_red: 115,
  potion_blue: 116,
};

/** 获取随机地面精灵索引 */
function getRandomFloorSprite(): number {
  const floors = [SPRITES.floor_1, SPRITES.floor_2, SPRITES.floor_3];
  return floors[Math.floor(Math.random() * floors.length)];
}

export async function initGameWorld(world: World): Promise<void> {
  const { tileSize, mapWidth, mapHeight } = WORLD_CONFIG;
  const T = tileSize;  // 不使用 scale，渲染时处理缩放

  // 加载图集
  const renderer = world.getResource('renderer');
  if (renderer) {
    await renderer.loadAtlas(
      'tiles',
      './assets/tiny-dungeon_tilemap_packed.png',
      './assets/tiny-dungeon_tilemap_packed.mote-sprite.json'
    );
  }

  // 生成地图边界墙壁
  generateBorderWalls(world, T, mapWidth, mapHeight);

  // 生成地面（填充整个地图）
  generateFloor(world, T, mapWidth, mapHeight);

  // 随机生成房子
  const houses = generateRandomHouses(world, T, mapWidth, mapHeight);

  // 在房子外生成游戏实体
  spawnGameEntities(world, T, houses);

  // 创建相机
  world.spawn({
    Transform: { x: 320, y: 240 },
    Camera: { width: 640, height: 480 },
  });
}

/** 生成边界墙壁 */
function generateBorderWalls(
  world: World,
  T: number,
  mapW: number,
  mapH: number
): void {
  for (let col = 0; col < mapW; col++) {
    // 底部墙壁（Y-up 坐标系，底部是 y=0）
    spawnWall(world, col * T + T / 2, T / 2);
    // 顶部墙壁
    spawnWall(world, col * T + T / 2, (mapH - 1) * T + T / 2);
  }

  for (let row = 1; row < mapH - 1; row++) {
    // 左侧墙壁
    spawnWall(world, T / 2, row * T + T / 2);
    // 右侧墙壁
    spawnWall(world, (mapW - 1) * T + T / 2, row * T + T / 2);
  }
}

/** 生成地面 */
function generateFloor(
  world: World,
  T: number,
  mapW: number,
  mapH: number
): void {
  for (let row = 1; row < mapH - 1; row++) {
    for (let col = 1; col < mapW - 1; col++) {
      const x = col * T + T / 2;
      const y = row * T + T / 2;
      
      world.spawn({
        Transform: { x, y },
        Sprite: { 
          atlas: 'tiles', 
          region: `frame_${getRandomFloorSprite()}`,
          layer: -1,  // 地面在最底层
        },
        FloorTag: {},
      });
    }
  }
}

/** 房子配置 */
interface House {
  x: number;      // 左下角 X（格子坐标）
  y: number;      // 左下角 Y（格子坐标）
  width: number;  // 宽度（格子数）
  height: number; // 高度（格子数）
}

/** 随机生成房子 */
function generateRandomHouses(
  world: World,
  T: number,
  mapW: number,
  mapH: number
): House[] {
  const houses: House[] = [];
  const numHouses = 3 + Math.floor(Math.random() * 3); // 3-5 个房子

  for (let i = 0; i < numHouses; i++) {
    const width = 4 + Math.floor(Math.random() * 4);   // 4-7 格宽
    const height = 4 + Math.floor(Math.random() * 4);  // 4-7 格高
    
    // 随机位置（留出边界）
    const x = 2 + Math.floor(Math.random() * (mapW - width - 4));
    const y = 2 + Math.floor(Math.random() * (mapH - height - 4));

    const house: House = { x, y, width, height };
    
    // 检查是否与其他房子重叠
    if (!houses.some(h => housesOverlap(h, house))) {
      generateHouse(world, T, house);
      houses.push(house);
    }
  }

  return houses;
}

/** 检查两个房子是否重叠 */
function housesOverlap(a: House, b: House): boolean {
  return !(
    a.x + a.width < b.x ||
    b.x + b.width < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

/** 生成单个房子 */
function generateHouse(world: World, T: number, house: House): void {
  const { x, y, width, height } = house;

  for (let row = 0; row < height; row++) {
    for (let col = 0; col < width; col++) {
      const worldX = (x + col) * T + T / 2;
      const worldY = (y + row) * T + T / 2;
      
      // 四周是墙壁
      if (row === 0 || row === height - 1 || col === 0 || col === width - 1) {
        spawnWall(world, worldX, worldY);
      }
      // 中间是地面（覆盖之前的随机地面）
      else {
        // 已经在 generateFloor 中生成了，不需要再生成
        // 但我们可以选择性地生成不同的内部地面
      }
    }
  }
}

/** 生成墙壁实体 */
function spawnWall(world: World, x: number, y: number): void {
  world.spawn({
    Transform: { x, y },
    Sprite: { 
      atlas: 'tiles', 
      region: `frame_${SPRITES.wall}`,
      layer: 0,
    },
    WallTag: {},
  });
}

/** 生成游戏实体（玩家、敌人、拾取物） */
function spawnGameEntities(world: World, T: number, houses: House[]): void {
  // 找到安全位置（不在房子内）
  const safePositions: { x: number; y: number }[] = [];
  
  for (let row = 2; row < WORLD_CONFIG.mapHeight - 2; row++) {
    for (let col = 2; col < WORLD_CONFIG.mapWidth - 2; col++) {
      const x = col * T + T / 2;
      const y = row * T + T / 2;
      
      // 检查是否在房子内
      if (!isInsideHouse(col, row, houses)) {
        safePositions.push({ x, y });
      }
    }
  }

  // 随机打乱位置
  shuffleArray(safePositions);

  let posIndex = 0;

  // 生成玩家
  if (posIndex < safePositions.length) {
    const pos = safePositions[posIndex++];
    spawnPlayer(world, pos.x, pos.y);
  }

  // 生成武器（位置不重要，会跟随玩家）
  if (posIndex < safePositions.length) {
    const pos = safePositions[posIndex++];
    spawnWeapon(world, pos.x, pos.y);
  }

  // 生成敌人
  for (let i = 0; i < 5 && posIndex < safePositions.length; i++) {
    const pos = safePositions[posIndex++];
    spawnEnemy(world, pos.x, pos.y);
  }

  // 生成药水
  for (let i = 0; i < 4 && posIndex < safePositions.length; i++) {
    const pos = safePositions[posIndex++];
    const isRed = i % 2 === 0;
    spawnPickup(world, pos.x, pos.y, isRed);
  }
}

/** 检查位置是否在房子内 */
function isInsideHouse(col: number, row: number, houses: House[]): boolean {
  return houses.some(h => 
    col >= h.x && col < h.x + h.width &&
    row >= h.y && row < h.y + h.height
  );
}

/** 打乱数组 */
function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

/** 生成玩家 */
function spawnPlayer(world: World, x: number, y: number): void {
  world.spawn('player', {
    Transform: { x, y },
    Sprite: { atlas: 'tiles', region: `frame_${SPRITES.player}` },
  });
}

/** 生成武器 */
function spawnWeapon(world: World, x: number, y: number): void {
  world.spawn('axe', {
    Transform: { x, y },
    Sprite: { atlas: 'tiles', region: `frame_${SPRITES.axe}` },
  });
}

/** 生成敌人 */
function spawnEnemy(world: World, x: number, y: number): void {
  world.spawn('skeleton', {
    Transform: { x, y },
    Sprite: { atlas: 'tiles', region: `frame_${SPRITES.skeleton}` },
  });
}

/** 生成拾取物 */
function spawnPickup(world: World, x: number, y: number, isRed: boolean): void {
  const prefabId = isRed ? 'potion_red' : 'potion_blue';
  const spriteIndex = isRed ? SPRITES.potion_red : SPRITES.potion_blue;
  
  world.spawn(prefabId, {
    Transform: { x, y },
    Sprite: { atlas: 'tiles', region: `frame_${spriteIndex}` },
  });
}

/** 检查世界坐标是否为墙壁（用于碰撞检测） */
export function isSolidWorldPos(x: number, y: number, world: World): boolean {
  // 检查是否有墙壁实体在这个位置
  const T = WORLD_CONFIG.tileSize;  // 不使用 scale
  const col = Math.floor(x / T);
  const row = Math.floor(y / T);
  
  // 检查边界
  if (col < 0 || col >= WORLD_CONFIG.mapWidth || 
      row < 0 || row >= WORLD_CONFIG.mapHeight) {
    return true;
  }

  // 查询该位置的墙壁实体
  for (const eid of world.query(WallTag, Transform)) {
    const transform = world.get(eid, Transform);
    const wallCol = Math.floor(transform.x / T);
    const wallRow = Math.floor(transform.y / T);
    
    if (wallCol === col && wallRow === row) {
      return true;
    }
  }

  return false;
}
