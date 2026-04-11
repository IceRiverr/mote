// games/tiny-dungeon/src/GamePlugin.ts
// 游戏插件 —— 使用 Prefab 的 ECS 架构

import type { World } from '@mote/engine';
import { Transform, Velocity, Camera, Sprite, BoxCollider, RigidBody } from '@mote/engine';
import { initGameWorld, isSolidWorldPos } from './world-init.js';
import { createGameRenderSystem } from './GameRenderSystem.js';
import { PlayerTag, EnemyAI, Weapon, Health, Pickup } from './components.js';
import { ALL_PREFABS } from './prefabs.js';

// ═════════════════════════════════════════════════════════════════════════════
// 系统
// ═════════════════════════════════════════════════════════════════════════════

/** 输入系统 */
function inputSystem(world: World, dt: number): void {
  const input = world.getResource<InputManager>('input');
  if (!input) return;

  for (const eid of world.query(PlayerTag, Velocity)) {
    const vel = world.get(eid, Velocity);
    
    const move = input.action('Move')?.vec2() ?? { x: 0, y: 0 };
    vel.vx = move.x * 120;
    vel.vy = move.y * 120;
  }
}

/** 攻击系统 */
function attackSystem(world: World, dt: number): void {
  const input = world.getResource<InputManager>('input');
  if (!input) return;

  const pressed = input.action('Attack')?.pressed ?? false;

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

    // 检查与敌人碰撞（查询 EnemyAI 而不是 EntityDef）
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

/** 碰撞检测与瓦片地图 */
function tileCollisionSystem(world: World, dt: number): void {
  // 硬编码玩家碰撞尺寸
  const PLAYER_HALF_W = 6;
  const PLAYER_HALF_H = 6;

  for (const eid of world.query(PlayerTag, Transform, Velocity)) {
    const transform = world.get(eid, Transform);
    const vel = world.get(eid, Velocity);

    // 尝试 X 方向移动
    const newX = transform.x + vel.vx * dt;
    const testXMin = newX - PLAYER_HALF_W + 1;
    const testXMax = newX + PLAYER_HALF_W - 1;
    const testYMin = transform.y - PLAYER_HALF_H + 1;
    const testYMax = transform.y + PLAYER_HALF_H - 1;
    
    if (!isSolidWorldPos(testXMin, testYMin) &&
        !isSolidWorldPos(testXMin, testYMax) &&
        !isSolidWorldPos(testXMax, testYMin) &&
        !isSolidWorldPos(testXMax, testYMax)) {
      transform.x = newX;
    }

    // 尝试 Y 方向移动
    const newY = transform.y + vel.vy * dt;
    const testYMinNew = newY - PLAYER_HALF_H + 1;
    const testYMaxNew = newY + PLAYER_HALF_H - 1;
    
    if (!isSolidWorldPos(transform.x - PLAYER_HALF_W + 1, testYMinNew) &&
        !isSolidWorldPos(transform.x + PLAYER_HALF_W - 1, testYMinNew) &&
        !isSolidWorldPos(transform.x - PLAYER_HALF_W + 1, testYMaxNew) &&
        !isSolidWorldPos(transform.x + PLAYER_HALF_W - 1, testYMaxNew)) {
      transform.y = newY;
    }
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

  // 注册 Prefab
  for (const prefab of ALL_PREFABS) {
    world.registerPrefab(prefab);
  }

  // 注册系统
  world.addSystem(inputSystem);
  world.addSystem(attackSystem);
  world.addSystem(weaponCollisionSystem);
  world.addSystem(pickupSystem);
  world.addSystem(tileCollisionSystem);
  world.addSystem(weaponFollowSystem);
  world.addSystem(cameraFollowSystem);
  
  // 添加瓦片地图渲染系统
  world.addSystem(createGameRenderSystem());

  // 初始化世界
  initGameWorld(world);
}
