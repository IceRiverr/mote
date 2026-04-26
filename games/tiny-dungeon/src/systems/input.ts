// games/tiny-dungeon/src/systems/input.ts
// Update: 玩家输入移动（使用 MapData O(1) 碰撞）

import type { World } from '@mote/engine';
import { Transform } from '@mote/engine';
import { InputManager } from '@mote/engine';
import { PlayerTag } from '../components.js';
import { MapData } from '../resources.js';

const PLAYER_SPEED = 120;
const PLAYER_HALF_W = 6;
const PLAYER_HALF_H = 6;

export function inputSystem(world: World, dt: number): void {
  const input = world.getResource<InputManager>('input');
  if (!input) return;

  const map = world.getResource<MapData>('MapData');
  const speed = PLAYER_SPEED * dt;

  for (const eid of world.query(PlayerTag, Transform)) {
    const t = world.get(eid, Transform);

    let moveX = 0;
    let moveY = 0;
    if (input.isAnyDown(['KeyW', 'ArrowUp'])) moveY -= 1;
    if (input.isAnyDown(['KeyS', 'ArrowDown'])) moveY += 1;
    if (input.isAnyDown(['KeyA', 'ArrowLeft'])) moveX -= 1;
    if (input.isAnyDown(['KeyD', 'ArrowRight'])) moveX += 1;

    // 归一化对角线
    if (moveX !== 0 && moveY !== 0) {
      const inv = 1 / Math.SQRT2;
      moveX *= inv;
      moveY *= inv;
    }

    // 尝试 X 方向
    const newX = t.x + moveX * speed;
    if (!checkCollision(newX, t.y, map)) {
      t.x = newX;
    }

    // 尝试 Y 方向
    const newY = t.y + moveY * speed;
    if (!checkCollision(t.x, newY, map)) {
      t.y = newY;
    }
  }
}

/** O(1) 碰撞检测 —— 检查玩家四个角是否碰到墙 */
function checkCollision(x: number, y: number, map: MapData): boolean {
  const corners = [
    { x: x - PLAYER_HALF_W + 1, y: y - PLAYER_HALF_H + 1 },
    { x: x + PLAYER_HALF_W - 1, y: y - PLAYER_HALF_H + 1 },
    { x: x - PLAYER_HALF_W + 1, y: y + PLAYER_HALF_H - 1 },
    { x: x + PLAYER_HALF_W - 1, y: y + PLAYER_HALF_H - 1 },
  ];

  for (const c of corners) {
    const { col, row } = map.worldToTile(c.x, c.y);
    if (map.isWall(col, row)) return true;
  }
  return false;
}
