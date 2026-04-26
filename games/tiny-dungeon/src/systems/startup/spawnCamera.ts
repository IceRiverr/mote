// games/tiny-dungeon/src/systems/startup/spawnCamera.ts
// Startup: 生成相机实体

import type { World } from '@mote/engine';

export function spawnCameraSystem(world: World): void {
  world.spawn({
    Transform: { x: 320, y: 240 },
    Camera: { width: 640, height: 480 },
  });
}
