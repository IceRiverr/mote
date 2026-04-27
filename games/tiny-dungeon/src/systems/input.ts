// games/tiny-dungeon/src/systems/input.ts
// Update: 玩家输入移动（开放大地图，无碰撞）

import type { World } from '@mote/engine';
import { Transform } from '@mote/engine';
import { InputManager } from '@mote/engine';
import { PlayerTag } from '../components.js';
import { GameState } from '../resources.js';

const MOVE_PER_TICK = 2;

export function inputSystem(world: World, _dt: number): void {
  const state = world.getResource<GameState>('GameState');
  if (state?.paused) return;

  const input = world.getResource<InputManager>('input');
  if (!input) return;

  for (const eid of world.query(PlayerTag, Transform)) {
    const t = world.get(eid, Transform);

    let moveX = 0;
    let moveY = 0;
    if (input.isAnyDown(['KeyW', 'ArrowUp'])) moveY -= 1;
    if (input.isAnyDown(['KeyS', 'ArrowDown'])) moveY += 1;
    if (input.isAnyDown(['KeyA', 'ArrowLeft'])) moveX -= 1;
    if (input.isAnyDown(['KeyD', 'ArrowRight'])) moveX += 1;

    // 固定 60Hz，每次 tick 移动整数像素
    // 对角线不做归一化（moveX/moveY 只会是 -1/0/1，结果必为整数）
    t.x += moveX * MOVE_PER_TICK;
    t.y += moveY * MOVE_PER_TICK;
  }
}
