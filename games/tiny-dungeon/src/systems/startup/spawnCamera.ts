// games/tiny-dungeon/src/systems/startup/spawnCamera.ts
// Startup: 生成相机实体

import type { World, Commands } from '@mote/engine';

export function spawnCameraSystem(world: World, _dt: number, _cmd: Commands): void {
  world.spawn({
    Transform: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
    Camera: { width: window.innerWidth, height: window.innerHeight },
  });
}
