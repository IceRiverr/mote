// engine/src/plugins/tilemap/systems.ts
// 瓦片地图系统

import type { World } from '../../core/world.js';
import type { Commands } from '../../core/commands.js';
import { Tilemap, TileAnimation } from './components.js';

/** 瓦片动画系统 —— 更新动画帧 */
export function tileAnimationSystem(world: World, dt: number, _cmd: Commands): void {
  for (const eid of world.query(Tilemap, TileAnimation)) {
    const tilemap = world.get(eid, Tilemap);
    const anim = world.get(eid, TileAnimation);

    anim.accumulatedTime += dt * 1000;

    for (const layer of tilemap.layers) {
      if (!layer.visible) continue;

      for (let i = 0; i < layer.data.length; i++) {
        const tileId = layer.data[i];
        if (tileId === null) continue;

        const frames = anim.animations.get(tileId);
        if (!frames || frames.length <= 1) continue;

        const key = `${layer.name}:${i}`;
        let frameIdx = anim.currentFrames.get(key) ?? 0;

        const currentFrame = frames[frameIdx];
        if (anim.accumulatedTime >= currentFrame.duration) {
          anim.accumulatedTime = 0;
          frameIdx = (frameIdx + 1) % frames.length;
          anim.currentFrames.set(key, frameIdx);
          layer.data[i] = frames[frameIdx].tileId;
        }
      }
    }
  }
}
