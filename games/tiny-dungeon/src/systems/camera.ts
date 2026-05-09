// games/tiny-dungeon/src/systems/camera.ts
// Update: 相机跟随

import type { World, Commands } from '@mote/engine';
import { Transform } from '@mote/engine';
import { Camera } from '@mote/engine';
import { PlayerTag } from '../components.js';

export function cameraFollowSystem(world: World, _dt: number, _cmd: Commands): void {
  let target: Transform | null = null;

  for (const eid of world.query(PlayerTag, Transform)) {
    target = world.get(eid, Transform);
    break;
  }

  if (!target) return;

  for (const eid of world.query(Camera, Transform)) {
    const camera = world.get(eid, Camera);
    const transform = world.get(eid, Transform);

    // 相机视口始终跟随窗口大小（强制偶数，避免 half-viewport 出现小数导致 sub-pixel 偏移）
    camera.width = Math.floor(window.innerWidth / 2) * 2;
    camera.height = Math.floor(window.innerHeight / 2) * 2;

    // 瞬间锁定：相机直接对齐玩家整数像素位置，消除所有 sub-pixel 缝隙
    transform.x = Math.round(target.x);
    transform.y = Math.round(target.y);
  }
}
