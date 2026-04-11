// games/tiny-dungeon/src/systems.ts
// 游戏插件 -- 使用 Prefab 的 ECS 架构

import type { World } from '@mote/engine';
import { Transform, Camera, Sprite } from '@mote/engine';
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

/** 投掷攻击系统 */
function throwAttackSystem(world: World, dt: number): void {
  const input = world.getResource<InputManager>('input');
  if (!input) return;

  // 使用 isAnyDown 代替 isAnyPressed（因为 InputPlugin 的 endFrame 会提前清空 pressed）
  const spaceHeld = input.isAnyDown(['Space']);
  if (!spaceHeld) return;

  // 找到玩家位置
  let playerPos: Transform | null = null;
  for (const eid of world.query(PlayerTag, Transform)) {
    playerPos = world.get(eid, Transform);
    break;
  }
  if (!playerPos) return;

  // 处理每个武器
  for (const weaponEid of world.query(Weapon, Transform)) {
    const weapon = world.get(weaponEid, Weapon);
    const weaponTransform = world.get(weaponEid, Transform);

    // 只有在 idle 状态且空格键按下才能投掷
    if (weapon.state !== 'idle') continue;

    // 查找 60 像素范围内的敌人
    const MAX_RANGE = weapon.maxDistance;
    let nearestEnemy: { eid: number; x: number; y: number; dist: number } | null = null;

    for (const enemyEid of world.query(EnemyAI, Transform)) {
      const enemyTransform = world.get(enemyEid, Transform);
      const dx = enemyTransform.x - playerPos.x;
      const dy = enemyTransform.y - playerPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= MAX_RANGE) {
        if (!nearestEnemy || dist < nearestEnemy.dist) {
          nearestEnemy = { eid: enemyEid, x: enemyTransform.x, y: enemyTransform.y, dist };
        }
      }
    }

    // 记录起点
    weapon.startX = playerPos.x;
    weapon.startY = playerPos.y;
    weapon.hitTargets.clear();

    if (nearestEnemy) {
      // 向最近的敌人投掷
      weapon.targetX = nearestEnemy.x;
      weapon.targetY = nearestEnemy.y;
    } else {
      // 随机方向投掷 - 使用玩家面向的方向或随机
      const angle = Math.random() * Math.PI * 2;
      weapon.targetX = playerPos.x + Math.cos(angle) * MAX_RANGE;
      weapon.targetY = playerPos.y + Math.sin(angle) * MAX_RANGE;
    }

    // 设置武器初始位置为玩家位置
    weaponTransform.x = playerPos.x;
    weaponTransform.y = playerPos.y;
    
    // 设置旋转朝向目标
    const dx = weapon.targetX - playerPos.x;
    const dy = weapon.targetY - playerPos.y;
    weaponTransform.rotation = Math.atan2(dy, dx);

    // 切换到飞行状态
    weapon.state = 'flying';
  }
}

/** 武器飞行系统 */
function weaponFlySystem(world: World, dt: number): void {
  // 找到玩家位置
  let playerPos: Transform | null = null;
  for (const eid of world.query(PlayerTag, Transform)) {
    playerPos = world.get(eid, Transform);
    break;
  }

  for (const weaponEid of world.query(Weapon, Transform)) {
    const weapon = world.get(weaponEid, Weapon);
    const transform = world.get(weaponEid, Transform);

    // 安全检查：确保必要字段有有效值
    if (!weapon || !transform) continue;

    if (weapon.state === 'idle') {
      // 空闲状态：武器在玩家身前16像素
      if (playerPos) {
        transform.x = playerPos.x + 16;
        transform.y = playerPos.y;
        transform.rotation = 0;
      }
    } else if (weapon.state === 'flying') {
      // 飞行状态：向目标移动
      const dx = weapon.targetX - transform.x;
      const dy = weapon.targetY - transform.y;
      const distToTarget = Math.sqrt(dx * dx + dy * dy);

      // 计算已飞行距离
      const flownDist = Math.sqrt(
        (transform.x - weapon.startX) ** 2 + 
        (transform.y - weapon.startY) ** 2
      );

      // 安全检查：避免无效数值
      if (!isFinite(distToTarget) || !isFinite(flownDist)) {
        weapon.state = 'returning';
        continue;
      }

      // 检查是否到达目标或最大距离
      if (distToTarget < 5 || flownDist >= weapon.maxDistance) {
        // 到达目标，开始返回
        weapon.state = 'returning';
      } else {
        // 继续向目标飞行
        const moveDist = weapon.flySpeed * dt;
        
        // 安全检查：避免除以0
        if (distToTarget < 0.001) {
          weapon.state = 'returning';
          continue;
        }
        
        const ratio = Math.min(moveDist / distToTarget, 1);
        
        transform.x += dx * ratio;
        transform.y += dy * ratio;
        transform.rotation = Math.atan2(dy, dx);

        // 检测碰撞敌人
        for (const enemyEid of world.query(EnemyAI, Transform, Health)) {
          if (weapon.hitTargets.has(enemyEid)) continue;

          const enemyTransform = world.get(enemyEid, Transform);
          const edx = transform.x - enemyTransform.x;
          const edy = transform.y - enemyTransform.y;
          const edist = Math.sqrt(edx * edx + edy * edy);

          if (edist < 12) {
            const health = world.get(enemyEid, Health);
            health.current -= weapon.damage;
            weapon.hitTargets.add(enemyEid);

            if (health.current <= 0) {
              world.destroy(enemyEid);
            }
            
            // 击中敌人后立即返回
            weapon.state = 'returning';
            break;
          }
        }
      }
    } else if (weapon.state === 'returning') {
      // 返回状态：飞回玩家
      if (!playerPos) {
        weapon.state = 'idle';
        continue;
      }

      const dx = playerPos.x - transform.x;
      const dy = playerPos.y - transform.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // 安全检查
      if (!isFinite(dist)) {
        weapon.state = 'idle';
        transform.x = playerPos.x;
        transform.y = playerPos.y;
        continue;
      }

      if (dist < 5) {
        // 回到玩家手中
        weapon.state = 'idle';
        transform.x = playerPos.x;
        transform.y = playerPos.y;
        transform.rotation = 0;
      } else {
        // 继续返回（速度更快）
        const moveDist = weapon.flySpeed * 2 * dt;
        const ratio = Math.min(moveDist / dist, 1);
        transform.x += dx * ratio;
        transform.y += dy * ratio;
        transform.rotation = Math.atan2(dy, dx);
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
  world.addSystem(throwAttackSystem);
  world.addSystem(weaponFlySystem);
  world.addSystem(pickupSystem);
  world.addSystem(cameraFollowSystem);

  // 初始化世界
  initGameWorld(world);
}
