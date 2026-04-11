// engine/src/plugins/physics.ts
// 物理插件 —— 基础运动学和简单碰撞

import type { World } from '../core/world';

// ═════════════════════════════════════════════════════════════════════════════
// 组件定义
// ═════════════════════════════════════════════════════════════════════════════

/** 变换组件 —— 位置、旋转、缩放 */
export class Transform {
  /** X 坐标（像素） @default 0 */
  x = 0;
  /** Y 坐标（像素） @default 0 */
  y = 0;
  /** 旋转角度（弧度） @default 0 */
  rotation = 0;
  /** X 缩放 @default 1 */
  scaleX = 1;
  /** Y 缩放 @default 1 */
  scaleY = 1;
}

/** 速度组件 —— 线性速度 */
export class Velocity {
  /** X 方向速度（像素/秒） @default 0 */
  vx = 0;
  /** Y 方向速度（像素/秒） @default 0 */
  vy = 0;
  /** 角速度（弧度/秒） @default 0 */
  angular = 0;
}

/** 加速度组件 —— 受持续力的影响 */
export class Acceleration {
  /** X 方向加速度（像素/秒²） @default 0 */
  ax = 0;
  /** Y 方向加速度（像素/秒²） @default 0 */
  ay = 0;
}

/** 摩擦力组件 —— 速度衰减 */
export class Friction {
  /** 线性摩擦系数 (0..1) @default 0 */
  linear = 0;
  /** 角摩擦系数 (0..1) @default 0 */
  angular = 0;
}

/** 刚体组件 —— 标记参与物理模拟（可选质量属性） */
export class RigidBody {
  /** 质量（kg） @default 1 */
  mass = 1;
  /** 是否受重力影响 @default true */
  useGravity = true;
  /** 是否静态（不受力影响） @default false */
  isStatic = false;
  /** 弹力系数 (0..1) @default 0 */
  restitution = 0;
}

/** 重力全局配置组件（单例，放在任意一个实体上） */
export class Gravity {
  /** X 方向重力加速度 @default 0 */
  x = 0;
  /** Y 方向重力加速度 @default 980 */
  y = 980;
}

/** 碰撞盒组件 —— AABB */
export class BoxCollider {
  /** 宽度（像素） @default 16 */
  width = 16;
  /** 高度（像素） @default 16 */
  height = 16;
  /** 相对于实体中心的偏移 X @default 0 */
  offsetX = 0;
  /** 相对于实体中心的偏移 Y @default 0 */
  offsetY = 0;
  /** 是否触发器（不阻挡，只检测） @default false */
  isTrigger = false;
  /** 碰撞层 */
  layer = 'default';
  /** 能碰撞的层 */
  mask: string[] = ['default'];
}

/** 圆形碰撞组件 */
export class CircleCollider {
  /** 半径（像素） @default 8 */
  radius = 8;
  /** 相对于实体中心的偏移 X @default 0 */
  offsetX = 0;
  /** 相对于实体中心的偏移 Y @default 0 */
  offsetY = 0;
  /** 是否触发器 @default false */
  isTrigger = false;
  /** 碰撞层 */
  layer = 'default';
  /** 能碰撞的层 */
  mask: string[] = ['default'];
}

/** 碰撞事件数据 */
export interface Collision {
  /** 碰撞实体A */
  entityA: number;
  /** 碰撞实体B */
  entityB: number;
  /** 穿透深度 */
  penetration: number;
  /** 碰撞法线（从A指向B） */
  normalX: number;
  /** 碰撞法线（从A指向B） */
  normalY: number;
  /** 碰撞点 X */
  contactX: number;
  /** 碰撞点 Y */
  contactY: number;
}

// ═════════════════════════════════════════════════════════════════════════════
// 系统
// ═════════════════════════════════════════════════════════════════════════════

/** 运动学系统 —— 更新位置和速度 */
function kinematicSystem(world: World, dt: number): void {
  // 获取重力（如果有 Gravity 组件）
  let gravityX = 0;
  let gravityY = 980;

  for (const eid of world.query(Gravity)) {
    const g = world.get(eid, Gravity);
    gravityX = g.x;
    gravityY = g.y;
    break; // 只取第一个
  }

  for (const eid of world.query(Transform, Velocity)) {
    const t = world.get(eid, Transform);
    const v = world.get(eid, Velocity);

    // 应用加速度
    if (world.has(eid, Acceleration)) {
      const a = world.get(eid, Acceleration);
      v.vx += a.ax * dt;
      v.vy += a.ay * dt;
    }

    // 应用重力
    if (world.has(eid, RigidBody)) {
      const body = world.get(eid, RigidBody);
      if (body.useGravity && !body.isStatic) {
        v.vx += gravityX * dt;
        v.vy += gravityY * dt;
      }
    }

    // 应用摩擦力
    if (world.has(eid, Friction)) {
      const f = world.get(eid, Friction);
      v.vx *= 1 - f.linear * dt;
      v.vy *= 1 - f.linear * dt;
      v.angular *= 1 - f.angular * dt;
    }

    // 更新位置
    t.x += v.vx * dt;
    t.y += v.vy * dt;
    t.rotation += v.angular * dt;
  }
}

/** 简单碰撞检测系统 —— AABB vs AABB 和 Circle vs Circle */
function collisionDetectionSystem(world: World, dt: number): void {
  const collisions: Collision[] = [];

  // 收集所有碰撞体
  const bodies: Array<{
    eid: number;
    t: Transform;
    box?: BoxCollider;
    circle?: CircleCollider;
  }> = [];

  for (const eid of world.query(Transform)) {
    const t = world.get(eid, Transform);
    const hasBox = world.has(eid, BoxCollider);
    const hasCircle = world.has(eid, CircleCollider);

    if (hasBox || hasCircle) {
      bodies.push({
        eid,
        t,
        box: hasBox ? world.get(eid, BoxCollider) : undefined,
        circle: hasCircle ? world.get(eid, CircleCollider) : undefined,
      });
    }
  }

  // 两两检测
  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];

      // 层检测
      const layerA = a.box?.layer ?? a.circle?.layer ?? 'default';
      const maskA = a.box?.mask ?? a.circle?.mask ?? ['default'];
      const layerB = b.box?.layer ?? b.circle?.layer ?? 'default';
      const maskB = b.box?.mask ?? b.circle?.mask ?? ['default'];

      if (!maskA.includes(layerB) && !maskB.includes(layerA)) continue;

      // 碰撞检测
      const collision = testCollision(a, b);
      if (collision) {
        collisions.push(collision);
      }
    }
  }

  // 发送碰撞事件
  for (const col of collisions) {
    world.emit('collision', col);

    // 如果是触发器，不处理物理响应
    const isTriggerA = bodies.find(b => b.eid === col.entityA)?.box?.isTrigger
      ?? bodies.find(b => b.eid === col.entityA)?.circle?.isTrigger
      ?? false;
    const isTriggerB = bodies.find(b => b.eid === col.entityB)?.box?.isTrigger
      ?? bodies.find(b => b.eid === col.entityB)?.circle?.isTrigger
      ?? false;

    if (!isTriggerA && !isTriggerB) {
      resolveCollision(world, col);
    }
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 碰撞检测辅助函数
// ═════════════════════════════════════════════════════════════════════════════

function testCollision(
  a: { eid: number; t: Transform; box?: BoxCollider; circle?: CircleCollider },
  b: { eid: number; t: Transform; box?: BoxCollider; circle?: CircleCollider },
): Collision | null {
  // Box vs Box
  if (a.box && b.box) {
    return testBoxBox(a.eid, a.t, a.box, b.eid, b.t, b.box);
  }
  // Circle vs Circle
  if (a.circle && b.circle) {
    return testCircleCircle(a.eid, a.t, a.circle, b.eid, b.t, b.circle);
  }
  // Box vs Circle
  if (a.box && b.circle) {
    return testBoxCircle(a.eid, a.t, a.box, b.eid, b.t, b.circle);
  }
  if (a.circle && b.box) {
    const col = testBoxCircle(b.eid, b.t, b.box, a.eid, a.t, a.circle);
    if (col) {
      // 反转法线方向
      col.normalX = -col.normalX;
      col.normalY = -col.normalY;
      const temp = col.entityA;
      col.entityA = col.entityB;
      col.entityB = temp;
    }
    return col;
  }
  return null;
}

function testBoxBox(
  eidA: number, tA: Transform, boxA: BoxCollider,
  eidB: number, tB: Transform, boxB: BoxCollider,
): Collision | null {
  const ax = tA.x + boxA.offsetX - boxA.width / 2;
  const ay = tA.y + boxA.offsetY - boxA.height / 2;
  const bx = tB.x + boxB.offsetX - boxB.width / 2;
  const by = tB.y + boxB.offsetY - boxB.height / 2;

  const overlapX = Math.min(ax + boxA.width, bx + boxB.width) - Math.max(ax, bx);
  const overlapY = Math.min(ay + boxA.height, by + boxB.height) - Math.max(ay, by);

  if (overlapX <= 0 || overlapY <= 0) return null;

  // 选择穿透深度最小的轴作为法线
  let normalX = 0;
  let normalY = 0;
  let penetration = 0;

  if (overlapX < overlapY) {
    penetration = overlapX;
    normalX = tA.x < tB.x ? -1 : 1;
  } else {
    penetration = overlapY;
    normalY = tA.y < tB.y ? -1 : 1;
  }

  return {
    entityA: eidA,
    entityB: eidB,
    penetration,
    normalX,
    normalY,
    contactX: (tA.x + tB.x) / 2,
    contactY: (tA.y + tB.y) / 2,
  };
}

function testCircleCircle(
  eidA: number, tA: Transform, cirA: CircleCollider,
  eidB: number, tB: Transform, cirB: CircleCollider,
): Collision | null {
  const dx = (tB.x + cirB.offsetX) - (tA.x + cirA.offsetX);
  const dy = (tB.y + cirB.offsetY) - (tA.y + cirA.offsetY);
  const distSq = dx * dx + dy * dy;
  const r = cirA.radius + cirB.radius;

  if (distSq > r * r) return null;

  const dist = Math.sqrt(distSq);
  const penetration = r - dist;

  let normalX = 1;
  let normalY = 0;

  if (dist > 0.001) {
    normalX = dx / dist;
    normalY = dy / dist;
  }

  return {
    entityA: eidA,
    entityB: eidB,
    penetration,
    normalX,
    normalY,
    contactX: tA.x + normalX * cirA.radius,
    contactY: tA.y + normalY * cirA.radius,
  };
}

function testBoxCircle(
  eidBox: number, tBox: Transform, box: BoxCollider,
  eidCir: number, tCir: Transform, cir: CircleCollider,
): Collision | null {
  // 找到圆心到 AABB 最近的点
  const boxL = tBox.x + box.offsetX - box.width / 2;
  const boxR = tBox.x + box.offsetX + box.width / 2;
  const boxT = tBox.y + box.offsetY - box.height / 2;
  const boxB = tBox.y + box.offsetY + box.height / 2;

  const cx = tCir.x + cir.offsetX;
  const cy = tCir.y + cir.offsetY;

  const closestX = Math.max(boxL, Math.min(cx, boxR));
  const closestY = Math.max(boxT, Math.min(cy, boxB));

  const dx = cx - closestX;
  const dy = cy - closestY;
  const distSq = dx * dx + dy * dy;

  if (distSq > cir.radius * cir.radius) return null;

  const dist = Math.sqrt(distSq);
  const penetration = cir.radius - dist;

  let normalX = 1;
  let normalY = 0;

  if (dist > 0.001) {
    normalX = dx / dist;
    normalY = dy / dist;
  } else {
    // 圆心在矩形内，从中心向外推
    const toBoxX = tBox.x - cx;
    const toBoxY = tBox.y - cy;
    const len = Math.sqrt(toBoxX * toBoxX + toBoxY * toBoxY);
    if (len > 0.001) {
      normalX = toBoxX / len;
      normalY = toBoxY / len;
    }
  }

  return {
    entityA: eidBox,
    entityB: eidCir,
    penetration,
    normalX,
    normalY,
    contactX: closestX,
    contactY: closestY,
  };
}

/** 简单的碰撞响应 —— 位置分离和速度反射 */
function resolveCollision(world: World, col: Collision): void {
  const { entityA, entityB, penetration, normalX, normalY } = col;

  // 获取质量和静态属性
  let massA = 1;
  let massB = 1;
  let staticA = false;
  let staticB = false;

  if (world.has(entityA, RigidBody)) {
    const body = world.get(entityA, RigidBody);
    massA = body.mass;
    staticA = body.isStatic;
  }
  if (world.has(entityB, RigidBody)) {
    const body = world.get(entityB, RigidBody);
    massB = body.mass;
    staticB = body.isStatic;
  }

  if (staticA && staticB) return;

  const tA = world.get(entityA, Transform);
  const tB = world.get(entityB, Transform);

  // 位置分离
  const totalMass = (staticA ? 0 : massA) + (staticB ? 0 : massB);
  const ratioA = staticA ? 0 : massA / totalMass;
  const ratioB = staticB ? 0 : massB / totalMass;

  tA.x -= normalX * penetration * ratioA;
  tA.y -= normalY * penetration * ratioA;
  tB.x += normalX * penetration * ratioB;
  tB.y += normalY * penetration * ratioB;

  // 速度反射（简化处理）
  if (world.has(entityA, Velocity) && !staticA) {
    const vA = world.get(entityA, Velocity);
    const restitutionA = world.has(entityA, RigidBody)
      ? world.get(entityA, RigidBody).restitution
      : 0;
    const dot = vA.vx * normalX + vA.vy * normalY;
    vA.vx -= (1 + restitutionA) * dot * normalX;
    vA.vy -= (1 + restitutionA) * dot * normalY;
  }

  if (world.has(entityB, Velocity) && !staticB) {
    const vB = world.get(entityB, Velocity);
    const restitutionB = world.has(entityB, RigidBody)
      ? world.get(entityB, RigidBody).restitution
      : 0;
    const dot = vB.vx * normalX + vB.vy * normalY;
    vB.vx += (1 + restitutionB) * dot * normalX;
    vB.vy += (1 + restitutionB) * dot * normalY;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 插件导出
// ═════════════════════════════════════════════════════════════════════════════

/**
 * 物理插件 —— 提供基础运动学和简单碰撞
 * 
 * ```ts
 * world.use(PhysicsPlugin);
 * 
 * // 创建带物理的实体
 * const player = world.spawn({
 *   Transform: { x: 100, y: 100 },
 *   Velocity: {},
 *   BoxCollider: { width: 16, height: 16 },
 *   RigidBody: { useGravity: true },
 * });
 * 
 * // 监听碰撞
 * world.on('collision', (col: Collision) => {
 *   console.log('Collision!', col);
 * });
 * ```
 */
export function PhysicsPlugin(world: World): void {
  world.addSystem(kinematicSystem);
  world.addSystem(collisionDetectionSystem);
}

// 声明组件类型
declare module '../core/component' {
  interface ComponentMap {
    Transform: Transform;
    Velocity: Velocity;
    Acceleration: Acceleration;
    Friction: Friction;
    RigidBody: RigidBody;
    Gravity: Gravity;
    BoxCollider: BoxCollider;
    CircleCollider: CircleCollider;
  }
}
