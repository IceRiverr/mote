// games/tiny-dungeon/src/systems/startup/spawnWalls.ts
// Startup: 为 MapData 中每个 Wall 生成实体

import type { World } from '@mote/engine';
import { Transform } from '@mote/engine';
import { WallTag } from '../../components.js';
import { MapData } from '../../resources.js';

/** 精灵索引 */
const WALL_SPRITE = 40;

export function spawnWallsSystem(world: World): void {
  const map = world.getResource<MapData>('MapData');

  for (const { x, y } of map.wallTiles()) {
    world.spawn({
      Transform: { x, y },
      Sprite: {
        atlas: 'tiles',
        region: `frame_${WALL_SPRITE}`,
        layer: 0,
      },
      WallTag: {},
    });
  }
}
