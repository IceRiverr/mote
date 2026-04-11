// games/tiny-dungeon/src/systems.ts
// 游戏插件 -- 使用 Prefab 的 ECS 架构

import type { World } from '@mote/engine';
import { Transform, Velocity, Camera, Sprite, BoxCollider, RigidBody } from '@mote/engine';
import { initGameWorld, isSolidWorldPos } from './world-init.js';
import { PlayerTag, EnemyAI, Weapon, Health, Pickup, WallTag, FloorTag } from './components.js';
import { ALL_PREFABS } from './prefabs.js';

// ═════════════════════════════════════════════════════════════════════════════
// 系统
// ═════════════════════════════════════════════════════════════════════════════

/** 输入系统 - 直接移动玩家，绕过 Velocity */
function inputSystem(world: World, dt: number): void {
  const input = world.getResource<InputManager>('input');
  if (!input) return;

  const speed = 120 * dt;

  for (const eid of world.query(PlayerTag, Transform)) {
    const transform = world.get(eid, Transform);

    // 计算移动向量（Y-up 坐标系：W/Up = Y 增加，S/Down = Y 减少）
    let moveX = 0;
    let moveY = 0;
    
    if (input.isAnyDown(['KeyW', 'ArrowUp'])) moveY += 1;
    if (input.isAnyDown(['KeyS', 'ArrowDown'])) moveY -= 1;
    if (input.isAnyDown(['KeyA', 'ArrowLeft'])) moveX -= 1;
    if (input.isAnyDown(['KeyD', 'ArrowRight'])) moveX += 1;

    // 归一化对角线移动
    if (moveX !== 0 && moveY !== 0) {
      const inv = 1 / Math.SQRT2;
      moveX *= inv;
      moveY *= inv;
    }

    // 硬编码玩家碰撞尺寸
    const PLAYER_HALF_W = 6;
    const PLAYER_HALF_H = 6;

    // 尝试 X 方向移动
    const newX = transform.x + moveX * speed;
    if (!isSolidWorldPos(newX - PLAYER_HALF_W + 1, transform.y - PLAYER_HALF_H + 1, world) &&
        !isSolidWorldPos(newX + PLAYER_HALF_W - 1, transform.y - PLAYER_HALF_H + 1, world) &&
        !isSolidWorldPos(newX - PLAYER_HALF_W + 1, transform.y + PLAYER_HALF_H - 1, world) &&
        !isSolidWorldPos(newX + PLAYER_HALF_W - 1, transform.y + PLAYER_HALF_H - 1, world)) {
      transform.x = newX;
    }

    // 尝试 Y 方向移动
    const newY = transform.y + moveY * speed;
    if (!isSolidWorldPos(transform.x - PLAYER_HALF_W + 1, newY - PLAYER_HALF_H + 1, world) &&
        !isSolidWorldPos(transform.x + PLAYER_HALF_W - 1, newY - PLAYER_HALF_H + 1, world) &&
        !isSolidWorldPos(transform.x - PLAYER_HALF_W + 1, newY + PLAYER_HALF_H - 1, world) &&
        !isSolidWorldPos(transform.x + PLAYER_HALF_W - 1, newY + PLAYER_HALF_H - 1, world)) {
      transform.y = newY;
    }
  }
}

/** 攻击系统 */
function attackSystem(world: World, dt: number): void {
  const input = world.getResource<InputManager>('input');
  if (!input) return;

  const pressed = input.isAnyPressed(['Space']);

  for (const eid of world.query(Weapon, Transform)) {
    const weapon = world.get(eid, Weapon);

    if (pressed && !weapon.attacking) {
      weapon.attacking = true;
      weapon.angle = 0;
      weapon.spinTotal = 0;
      weapon.hitThisSwing.clear();
    }

    if (weapon.attacking) {
      weapon.angle += weapon.spinSpeed * dt;
      weapon.spinTotal += weapon.spinSpeed * dt;

      if (weapon.spinTotal >= Math.PI * 2) {
        weapon.attacking = false;
        weapon.angle = 0;
        weapon.spinTotal = 0;
      }
    }
  }
}

/** 武器跟随系统 */
function weaponFollowSystem(world: World, dt: number): void {
  let playerPos: Transform | null = null;

  for (const eid of world.query(PlayerTag, Transform)) {
    playerPos = world.get(eid, Transform);
    break;
  }

  if (!playerPos) return;

  for (const eid of world.query(Weapon, Transform)) {
    const weapon = world.get(eid, Weapon);
    const transform = world.get(eid, Transform);

    transform.x = playerPos.x + Math.cos(weapon.angle) * weapon.orbitRadius;
    transform.y = playerPos.y + Math.sin(weapon.angle) * weapon.orbitRadius;
    transform.rotation = weapon.angle;
  }
}

/** 武器碰撞系统 */
function weaponCollisionSystem(world: World, dt: number): void {
  let playerPos: Transform | null = null;
  for (const eid of world.query(PlayerTag, Transform)) {
    playerPos = world.get(eid, Transform);
    break;
  }
  if (!playerPos) return;

  for (const weaponEid of world.query(Weapon, Transform)) {
    const weapon = world.get(weaponEid, Weapon);
    if (!weapon.attacking) continue;

    const wx = playerPos.x + Math.cos(weapon.angle) * weapon.orbitRadius;
    const wy = playerPos.y + Math.sin(weapon.angle) * weapon.orbitRadius;

    // 检查与敌人碰撞(查询 EnemyAI 而不是 EntityDef)
    for (const enemyEid of world.query(EnemyAI, Transform, Health)) {
      if (weapon.hitThisSwing.has(enemyEid)) continue;

      const enemyTransform = world.get(enemyEid, Transform);

      // 简单的距离检测
      const dx = wx - enemyTransform.x;
      const dy = wy - enemyTransform.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 12) {
        const health = world.get(enemyEid, Health);
        health.current -= weapon.damage;
        weapon.hitThisSwing.add(enemyEid);

        if (health.current <= 0) {
          world.destroy(enemyEid);
        }
      }
    }
  }
}

/** 拾取系统 */
function pickupSystem(world: World, dt: number): void {
  let playerEid: number | null = null;
  let playerTransform: Transform | null = null;
  let playerHealth: Health | null = null;

  for (const eid of world.query(PlayerTag, Transform, Health)) {
    playerEid = eid;
    playerTransform = world.get(eid, Transform);
    playerHealth = world.get(eid, Health);
    break;
  }

  if (!playerEid || !playerTransform || !playerHealth) return;

  for (const eid of world.query(Pickup, Transform)) {
    const pickup = world.get(eid, Pickup);
    const transform = world.get(eid, Transform);

    const dx = playerTransform.x - transform.x;
    const dy = playerTransform.y - transform.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 12) {
      if (pickup.kind === 'heal') {
        playerHealth.current = Math.min(playerHealth.max, playerHealth.current + pickup.amount);
      }
      world.destroy(eid);
    }
  }
}

/** 相机跟随系统 */
function cameraFollowSystem(world: World, dt: number): void {
  let target: Transform | null = null;

  for (const eid of world.query(PlayerTag, Transform)) {
    target = world.get(eid, Transform);
    break;
  }

  if (!target) return;

  for (const eid of world.query(Camera, Transform)) {
    const camera = world.get(eid, Camera);
    const transform = world.get(eid, Transform);

    transform.x += (target.x - transform.x) * 0.08;
    transform.y += (target.y - transform.y) * 0.08;

    // 限制在地图内
    const mapW = 40 * 32;
    const mapH = 30 * 32;
    const halfW = camera.width / 2;
    const halfH = camera.height / 2;

    transform.x = Math.max(halfW, Math.min(mapW - halfW, transform.x));
    transform.y = Math.max(halfH, Math.min(mapH - halfH, transform.y));
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 插件
// ═════════════════════════════════════════════════════════════════════════════

import { InputManager } from '@mote/engine';

export function GamePlugin(world: World): void {
  // 注册组件
  world.registerComponent(PlayerTag);
  world.registerComponent(EnemyAI);
  world.registerComponent(Weapon);
  world.registerComponent(Health);
  world.registerComponent(Pickup);
  world.registerComponent(WallTag);
  world.registerComponent(FloorTag);

  // 注册 Prefab
  for (const prefab of ALL_PREFABS) {
    world.registerPrefab(prefab);
  }

  // 注册系统
  world.addSystem(inputSystem);
  world.addSystem(attackSystem);
  world.addSystem(weaponCollisionSystem);
  world.addSystem(pickupSystem);
  world.addSystem(weaponFollowSystem);
  world.addSystem(cameraFollowSystem);

  // 初始化世界
  initGameWorld(world);
}
