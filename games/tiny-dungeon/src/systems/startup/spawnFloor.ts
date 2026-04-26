// games/tiny-dungeon/src/systems/startup/spawnFloor.ts
// Startup: 为 MapData 中每个 Floor 生成地面实体

import type { World } from '@mote/engine';
import { Transform } from '@mote/engine';
import { FloorTag } from '../../components.js';
import { MapData } from '../../resources.js';

/** 精灵索引 */
const FLOOR_SPRITES = [48, 49, 42];

function getRandomFloorSprite(): number {
  return FLOOR_SPRITES[Math.floor(Math.random() * FLOOR_SPRITES.length)];
}

export function spawnFloorSystem(world: World): void {
  const map = world.getResource<MapData>('MapData');

  for (const { x, y } of map.floorTiles()) {
    world.spawn({
      Transform: { x, y },
      Sprite: {
        atlas: 'tiles',
        region: `frame_${getRandomFloorSprite()}`,
        layer: -1,
      },
      FloorTag: {},
    });
  }
}
