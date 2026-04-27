// Update: 敌人追踪 AI（直直朝玩家冲来）

import type { World } from '@mote/engine';
import { Transform } from '@mote/engine';
import { PlayerTag, EnemyAI } from '../components.js';
import { GameState } from '../resources.js';

export function enemyChaseSystem(world: World, dt: number): void {
  const state = world.getResource<GameState>('GameState');
  if (state?.paused) return;

  let playerTransform: Transform | null = null;

  for (const eid of world.query(PlayerTag, Transform)) {
    if (!world.isAlive(eid)) continue;
    playerTransform = world.get(eid, Transform);
    break;
  }

  if (!playerTransform) return;

  for (const eid of world.query(EnemyAI, Transform)) {
    if (!world.isAlive(eid)) continue;

    const ai = world.get(eid, EnemyAI);
    const t = world.get(eid, Transform);

    ai.attackCooldown -= dt;

    const dx = playerTransform.x - t.x;
    const dy = playerTransform.y - t.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist > 0.001) {
      t.x += (dx / dist) * ai.speed * dt;
      t.y += (dy / dist) * ai.speed * dt;
    }
  }
}
