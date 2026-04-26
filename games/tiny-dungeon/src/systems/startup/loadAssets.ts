// games/tiny-dungeon/src/systems/startup/loadAssets.ts
// Startup: 加载图集资源

import type { World } from '@mote/engine';

export async function loadAssetsSystem(world: World): Promise<void> {
  const renderer = world.getResource<any>('renderer');
  if (!renderer) return;

  await renderer.loadAtlas(
    'tiles',
    './assets/tiny-dungeon_tilemap_packed.png',
    './assets/tiny-dungeon_tilemap_packed.mote-sprite.json'
  );
}
