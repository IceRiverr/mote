// Startup: 生成墙壁实体（已移除 —— 开放大地图无墙壁）

import type { World, Commands } from '@mote/engine';

export function spawnWallsSystem(_world: World, _dt: number, _cmd: Commands): void {
  // 开放大地图：不生成任何墙壁
}
