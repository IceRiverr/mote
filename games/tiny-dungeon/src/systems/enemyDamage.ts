// Update: 敌人接触伤害 + 玩家无敌帧

import type { World, Commands } from '@mote/engine';
import { Transform, AudioManager } from '@mote/engine';
import { PlayerTag, EnemyAI, Health, HurtCooldown } from '../components.js';
import { GameState } from '../resources.js';

const CONTACT_DISTANCE = 14;
const PLAYER_INVINCIBLE_TIME = 0.5;

export function enemyDamageSystem(world: World, dt: number, cmd: Commands): void {
  const state = world.getResource<GameState>('GameState');
  if (state?.paused) return;

  let playerEid: number | null = null;
  let playerTransform: Transform | null = null;
  let playerHealth: Health | null = null;

  for (const eid of world.query(PlayerTag, Transform, Health)) {
    if (!world.isAlive(eid)) continue;
    playerEid = eid;
    playerTransform = world.get(eid, Transform);
    playerHealth = world.get(eid, Health);
    break;
  }

  if (!playerEid || !playerTransform || !playerHealth) {
    console.warn('[enemyDamage] no player found');
    return;
  }

  // 处理无敌冷却
  const hurtCooldown = world.get(playerEid, HurtCooldown);
  if (hurtCooldown) {
    hurtCooldown.timer -= dt;
    if (hurtCooldown.timer <= 0) {
      cmd.entity(playerEid).remove(HurtCooldown);
    }
  }

  // 无敌期间不再受伤
  if (world.get(playerEid, HurtCooldown)) {
    return;
  }

  for (const eid of world.query(EnemyAI, Transform)) {
    if (!world.isAlive(eid)) continue;

    const ai = world.get(eid, EnemyAI);
    const et = world.get(eid, Transform);

    if (ai.attackCooldown > 0) continue;

    const dx = playerTransform.x - et.x;
    const dy = playerTransform.y - et.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < CONTACT_DISTANCE) {
      playerHealth.current -= ai.damage;
      ai.attackCooldown = ai.attackInterval;

      cmd.entity(playerEid).add(HurtCooldown, { timer: PLAYER_INVINCIBLE_TIME });

      const audio = world.getResource<AudioManager>('audio');
      audio?.play('hurt', { volume: 0.5 });

      if (playerHealth.current <= 0) {
        playerHealth.current = 0;
        state.paused = true;
        world.emit('gameover');
      }
      break;
    }
  }
}
