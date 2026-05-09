// Update: 自动武器 + 投射物飞行

import type { World, Commands } from '@mote/engine';
import { Transform } from '@mote/engine';
import { AudioManager } from '@mote/engine';
import { PlayerTag, EnemyAI, Weapon, Health, Projectile, XPOrb } from '../components.js';
import { GameState } from '../resources.js';

const HIT_DISTANCE = 16;
const AXE_SPRITE = 118;

// ═════════════════════════════════════════════════════════════════════════════
// 自动攻击系统
// ═════════════════════════════════════════════════════════════════════════════

export function autoAttackSystem(world: World, dt: number, cmd: Commands): void {
  const state = world.getResource<GameState>('GameState');
  if (state?.paused) return;

  for (const eid of world.query(PlayerTag, Weapon, Transform)) {
    const weapon = world.get(eid, Weapon);
    weapon.timer -= dt;
    if (weapon.timer > 0) continue;

    const pt = world.get(eid, Transform);
    const target = findNearestEnemy(world, pt, weapon.range);

    let dirX = 0;
    let dirY = 0;
    if (target) {
      const dx = target.x - pt.x;
      const dy = target.y - pt.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist > 0.001) {
        dirX = dx / dist;
        dirY = dy / dist;
      }
    } else {
      const angle = Math.random() * Math.PI * 2;
      dirX = Math.cos(angle);
      dirY = Math.sin(angle);
    }

    const audio = world.getResource<AudioManager>('audio');

    for (let i = 0; i < weapon.projectileCount; i++) {
      let sx = dirX;
      let sy = dirY;
      if (weapon.projectileCount > 1) {
        const spread = (i - (weapon.projectileCount - 1) / 2) * 0.15;
        const cos = Math.cos(spread);
        const sin = Math.sin(spread);
        sx = dirX * cos - dirY * sin;
        sy = dirX * sin + dirY * cos;
      }

      cmd.spawn({
        Transform: { x: pt.x, y: pt.y, rotation: Math.atan2(sy, sx), scaleX: 2, scaleY: 2 },
        Sprite: { atlas: 'tiles', region: `frame_${AXE_SPRITE}` },
        Projectile: {
          vx: sx * weapon.speed,
          vy: sy * weapon.speed,
          damage: weapon.damage,
          speed: weapon.speed,
          pierce: weapon.pierce,
          hitTargets: new Set<number>(),
          distanceFlown: 0,
          maxDistance: weapon.range,
        },
      });
    }

    audio?.play('shoot', { volume: 0.4 });
    weapon.timer = weapon.cooldown;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 投射物飞行系统
// ═════════════════════════════════════════════════════════════════════════════

export function projectileSystem(world: World, dt: number, cmd: Commands): void {
  const state = world.getResource<GameState>('GameState');
  if (state?.paused) return;

  for (const eid of world.query(Projectile, Transform)) {
    if (!world.isAlive(eid)) continue;

    const proj = world.get(eid, Projectile);
    const t = world.get(eid, Transform);

    const moveX = proj.vx * dt;
    const moveY = proj.vy * dt;
    t.x += moveX;
    t.y += moveY;
    proj.distanceFlown += Math.sqrt(moveX * moveX + moveY * moveY);

    if (proj.distanceFlown >= proj.maxDistance) {
      cmd.destroy(eid);
      continue;
    }

    for (const enemyEid of world.query(EnemyAI, Transform, Health)) {
      if (!world.isAlive(enemyEid)) continue;
      if (proj.hitTargets.has(enemyEid)) continue;

      const et = world.get(enemyEid, Transform);
      const dx = t.x - et.x;
      const dy = t.y - et.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < HIT_DISTANCE) {
        const health = world.get(enemyEid, Health);
        health.current -= proj.damage;
        proj.hitTargets.add(enemyEid);

        const audio = world.getResource<AudioManager>('audio');
        audio?.play('hit', { volume: 0.35 });

        if (health.current <= 0) {
          spawnXP(cmd, et.x, et.y);
          cmd.destroy(enemyEid);
          audio?.play('enemyDie', { volume: 0.4 });
        }

        if (proj.pierce <= 0) {
          cmd.destroy(eid);
          break;
        } else {
          proj.pierce--;
        }
      }
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 内部辅助
// ═════════════════════════════════════════════════════════════════════════════

/** 敌人死亡掉落经验宝石 */
function spawnXP(cmd: Commands, x: number, y: number): void {
  cmd.spawn({
    Transform: { x, y, scaleX: 2, scaleY: 2 },
    Sprite: { atlas: 'tiles', region: 'frame_117' }, // 绿色宝石
    XPOrb: { amount: 10 },
  });
}

function findNearestEnemy(
  world: World,
  playerPos: Transform,
  maxDist: number,
): Transform | null {
  let nearest: Transform | null = null;
  let nearestDist = Infinity;

  for (const eid of world.query(EnemyAI, Transform)) {
    if (!world.isAlive(eid)) continue;
    const et = world.get(eid, Transform);
    const dx = et.x - playerPos.x;
    const dy = et.y - playerPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist <= maxDist && dist < nearestDist) {
      nearestDist = dist;
      nearest = et;
    }
  }

  return nearest;
}
