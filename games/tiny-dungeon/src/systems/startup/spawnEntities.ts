// games/tiny-dungeon/src/systems/startup/spawnEntities.ts
// Startup: 在 Floor 格子上生成游戏实体

import type { World } from '@mote/engine';
import { MapData, TileType, type GameConfig } from '../../resources.js';

/** 精灵索引 */
const SPRITES = {
  player: 98,
  skeleton: 121,
  potion_red: 115,
  potion_blue: 116,
};

export function spawnEntitiesSystem(world: World): void {
  const map = world.getResource<MapData>('MapData');
  const config = world.getResource<GameConfig>('GameConfig');

  // 收集所有可用 Floor 位置
  const positions: { x: number; y: number; col: number; row: number }[] = [];
  for (const tile of map.floorTiles()) {
    positions.push({ x: tile.x, y: tile.y, col: tile.col, row: tile.row });
  }

  shuffleArray(positions);

  let idx = 0;

  // 玩家
  if (idx < positions.length) {
    const p = positions[idx++];
    world.spawn('player', {
      Transform: { x: p.x, y: p.y },
      Sprite: { atlas: 'tiles', region: `frame_${SPRITES.player}` },
    });
  }

  // 武器
  if (idx < positions.length) {
    const p = positions[idx++];
    world.spawn('axe', { Transform: { x: p.x, y: p.y } });
  }

  // 敌人
  for (let i = 0; i < config.enemyCount && idx < positions.length; i++) {
    const p = positions[idx++];
    world.spawn('skeleton', {
      Transform: { x: p.x, y: p.y },
      Sprite: { atlas: 'tiles', region: `frame_${SPRITES.skeleton}` },
    });
  }

  // 药水
  for (let i = 0; i < config.potionCount && idx < positions.length; i++) {
    const p = positions[idx++];
    const isRed = i % 2 === 0;
    const sprite = isRed ? SPRITES.potion_red : SPRITES.potion_blue;
    const prefab = isRed ? 'potion_red' : 'potion_blue';
    world.spawn(prefab, {
      Transform: { x: p.x, y: p.y },
      Sprite: { atlas: 'tiles', region: `frame_${sprite}` },
    });
  }
}

function shuffleArray<T>(array: T[]): void {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}
