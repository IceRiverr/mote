// games/tiny-dungeon/src/systems/camera.ts
// Update: 相机跟随

import type { World } from '@mote/engine';
import { Transform } from '@mote/engine';
import { Camera } from '@mote/engine';
import { PlayerTag } from '../components.js';
import { MapData } from '../resources.js';

export function cameraFollowSystem(world: World, _dt: number): void {
  let target: Transform | null = null;

  for (const eid of world.query(PlayerTag, Transform)) {
    target = world.get(eid, Transform);
    break;
  }

  if (!target) return;

  const map = world.getResource<MapData>('MapData');
  const mapW = map.width * map.tileSize;
  const mapH = map.height * map.tileSize;

  for (const eid of world.query(Camera, Transform)) {
    const camera = world.get(eid, Camera);
    const transform = world.get(eid, Transform);

    transform.x += (target.x - transform.x) * 0.08;
    transform.y += (target.y - transform.y) * 0.08;

    const halfW = camera.width / 2;
    const halfH = camera.height / 2;

    transform.x = Math.max(halfW, Math.min(mapW - halfW, transform.x));
    transform.y = Math.max(halfH, Math.min(mapH - halfH, transform.y));
  }
}
