// Update: 经验宝石拾取 + 升级检测

import type { World } from '@mote/engine';
import { Transform } from '@mote/engine';
import { PlayerTag, XPOrb, PlayerLevel, Weapon } from '../components.js';
import { GameState } from '../resources.js';

const MAGNET_RANGE = 120;   // 磁力吸引范围
const PICKUP_RANGE = 16;    // 拾取范围
const MOVE_SPEED = 300;     // 宝石飞向玩家的速度（玩家约 120/s）

export function xpPickupSystem(world: World, dt: number): void {
  const state = world.getResource<GameState>('GameState');
  if (!state || state.paused) return;

  let playerEid: number | null = null;
  let playerTransform: Transform | null = null;
  let playerLevel: PlayerLevel | null = null;

  for (const eid of world.query(PlayerTag, Transform, PlayerLevel)) {
    if (!world.isAlive(eid)) continue;
    playerEid = eid;
    playerTransform = world.get(eid, Transform);
    playerLevel = world.get(eid, PlayerLevel);
    break;
  }

  if (!playerEid || !playerTransform || !playerLevel) return;

  // 收集所有要销毁的宝石 eid（避免在遍历中修改）
  const toDestroy: number[] = [];

  for (const eid of world.query(XPOrb, Transform)) {
    if (!world.isAlive(eid)) continue;

    const orb = world.get(eid, XPOrb);
    const ot = world.get(eid, Transform);

    const dx = playerTransform.x - ot.x;
    const dy = playerTransform.y - ot.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // 磁力吸引：进入范围后飞向玩家
    if (dist < MAGNET_RANGE && dist > 0.001) {
      ot.x += (dx / dist) * MOVE_SPEED * dt;
      ot.y += (dy / dist) * MOVE_SPEED * dt;
    }

    // 拾取
    if (dist < PICKUP_RANGE) {
      playerLevel.xp += orb.amount;
      toDestroy.push(eid);
    }
  }

  // 销毁已拾取的宝石
  for (const eid of toDestroy) {
    world.destroy(eid);
  }

  // 检查升级
  if (playerLevel.xp >= playerLevel.xpToNext) {
    playerLevel.xp -= playerLevel.xpToNext;
    playerLevel.level++;
    playerLevel.xpToNext = Math.floor(playerLevel.xpToNext * 1.3);

    world.emit('levelup');
  }
}
