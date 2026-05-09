// games/tiny-dungeon/src/systems/startup/spawnFloor.ts
// Startup: 生成开放大地图地板

import type { World, Commands } from '@mote/engine';
import { GameConfig } from '../../resources.js';

/** 精灵索引 */
const FLOOR_SPRITES = [48, 49, 42];

function getRandomFloorSprite(): number {
  return FLOOR_SPRITES[Math.floor(Math.random() * FLOOR_SPRITES.length)];
}

export function spawnFloorSystem(world: World, _dt: number, _cmd: Commands): void {
  const config = world.getResource<GameConfig>('GameConfig');
  const { mapWidth, mapHeight, tileSize } = config;

  for (let row = 0; row < mapHeight; row++) {
    for (let col = 0; col < mapWidth; col++) {
      world.spawn({
        Transform: {
          x: col * tileSize + tileSize / 2,
          y: row * tileSize + tileSize / 2,
          scaleX: 2,
          scaleY: 2,
        },
        Sprite: {
          atlas: 'tiles',
          region: `frame_${getRandomFloorSprite()}`,
          layer: -1,
        },
      });
    }
  }
}
