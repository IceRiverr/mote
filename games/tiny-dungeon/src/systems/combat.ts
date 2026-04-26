// games/tiny-dungeon/src/systems/combat.ts
// Update: 投掷攻击 + 武器飞行

import type { World } from '@mote/engine';
import { Transform } from '@mote/engine';
import { InputManager } from '@mote/engine';
import { PlayerTag, EnemyAI, Weapon, Health } from '../components.js';

const HIT_DISTANCE = 12;

/** 投掷攻击系统 */
export function throwAttackSystem(world: World, _dt: number): void {
  const input = world.getResource<InputManager>('input');
  if (!input) return;

  const spaceHeld = input.isAnyDown(['Space']);
  if (!spaceHeld) return;

  const playerPos = getPlayerPos(world);
  if (!playerPos) return;

  for (const weaponEid of world.query(Weapon, Transform)) {
    const weapon = world.get(weaponEid, Weapon);
    if (weapon.state !== 'idle') continue;

    weapon.startX = playerPos.x;
    weapon.startY = playerPos.y;
    weapon.hitTargets.clear();

    const target = findNearestEnemy(world, playerPos, weapon.maxDistance);
    if (target) {
      weapon.targetX = target.x;
      weapon.targetY = target.y;
    } else {
      const angle = Math.random() * Math.PI * 2;
      weapon.targetX = playerPos.x + Math.cos(angle) * weapon.maxDistance;
      weapon.targetY = playerPos.y + Math.sin(angle) * weapon.maxDistance;
    }

    const wt = world.get(weaponEid, Transform);
    wt.x = playerPos.x;
    wt.y = playerPos.y;
    wt.rotation = Math.atan2(weapon.targetY - playerPos.y, weapon.targetX - playerPos.x);

    weapon.state = 'flying';
  }
}

/** 武器飞行系统 */
export function weaponFlySystem(world: World, dt: number): void {
  const playerPos = getPlayerPos(world);

  for (const weaponEid of world.query(Weapon, Transform)) {
    const weapon = world.get(weaponEid, Weapon);
    const transform = world.get(weaponEid, Transform);

    switch (weapon.state) {
      case 'idle': {
        if (playerPos) {
          transform.x = playerPos.x + 16;
          transform.y = playerPos.y;
          transform.rotation = 0;
        }
        break;
      }
      case 'flying': {
        updateFlying(world, weaponEid, weapon, transform, dt);
        break;
      }
      case 'returning': {
        updateReturning(weapon, transform, playerPos, dt);
        break;
      }
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 内部辅助
// ═════════════════════════════════════════════════════════════════════════════

function getPlayerPos(world: World): Transform | null {
  for (const eid of world.query(PlayerTag, Transform)) {
    return world.get(eid, Transform);
  }
  return null;
}

function findNearestEnemy(
  world: World,
  playerPos: Transform,
  maxDist: number,
): Transform | null {
  let nearest: Transform | null = null;
  let nearestDist = Infinity;

  for (const eid of world.query(EnemyAI, Transform)) {
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

function updateFlying(
  world: World,
  weaponEid: number,
  weapon: Weapon,
  transform: Transform,
  dt: number,
): void {
  const dx = weapon.targetX - transform.x;
  const dy = weapon.targetY - transform.y;
  const distToTarget = Math.sqrt(dx * dx + dy * dy);

  const flownDist = Math.sqrt(
    (transform.x - weapon.startX) ** 2 + (transform.y - weapon.startY) ** 2
  );

  if (!isFinite(distToTarget) || !isFinite(flownDist)) {
    weapon.state = 'returning';
    return;
  }

  if (distToTarget < 5 || flownDist >= weapon.maxDistance) {
    weapon.state = 'returning';
    return;
  }

  if (distToTarget < 0.001) {
    weapon.state = 'returning';
    return;
  }

  const ratio = Math.min((weapon.flySpeed * dt) / distToTarget, 1);
  transform.x += dx * ratio;
  transform.y += dy * ratio;
  transform.rotation = Math.atan2(dy, dx);

  // 碰撞检测敌人
  for (const enemyEid of world.query(EnemyAI, Transform, Health)) {
    if (weapon.hitTargets.has(enemyEid)) continue;

    const et = world.get(enemyEid, Transform);
    const edx = transform.x - et.x;
    const edy = transform.y - et.y;
    const edist = Math.sqrt(edx * edx + edy * edy);

    if (edist < HIT_DISTANCE) {
      const health = world.get(enemyEid, Health);
      health.current -= weapon.damage;
      weapon.hitTargets.add(enemyEid);

      if (health.current <= 0) {
        world.destroy(enemyEid);
      }

      weapon.state = 'returning';
      break;
    }
  }
}

function updateReturning(
  weapon: Weapon,
  transform: Transform,
  playerPos: Transform | null,
  dt: number,
): void {
  if (!playerPos) {
    weapon.state = 'idle';
    return;
  }

  const dx = playerPos.x - transform.x;
  const dy = playerPos.y - transform.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (!isFinite(dist)) {
    weapon.state = 'idle';
    transform.x = playerPos.x;
    transform.y = playerPos.y;
    return;
  }

  if (dist < 5) {
    weapon.state = 'idle';
    transform.x = playerPos.x;
    transform.y = playerPos.y;
    transform.rotation = 0;
    return;
  }

  const moveDist = weapon.flySpeed * 2 * dt;
  const ratio = Math.min(moveDist / dist, 1);
  transform.x += dx * ratio;
  transform.y += dy * ratio;
  transform.rotation = Math.atan2(dy, dx);
}
