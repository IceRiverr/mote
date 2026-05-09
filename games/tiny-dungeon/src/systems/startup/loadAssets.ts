// games/tiny-dungeon/src/systems/startup/loadAssets.ts
// Startup: 加载图集资源

import type { World, Commands } from '@mote/engine';

export function loadAssetsSystem(world: World, _dt: number, _cmd: Commands): void {
  const renderer = world.getResource<any>('renderer');
  if (!renderer) return;

  renderer.loadAtlas(
    'tiles',
    './assets/tiny-dungeon_tilemap_packed.png',
    './assets/tiny-dungeon_tilemap_packed.mote-sprite.json'
  ).catch(console.error);
}
