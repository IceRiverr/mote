// Startup: 生成地形数据（已移除 —— 开放大地图不再需要 MapData）

import type { World } from '@mote/engine';

export function generateMapSystem(_world: World): void {
  // 开放大地图：无墙壁、无格子碰撞，地板由 spawnFloorSystem 直接生成
}
