// engine/src/plugins/physics/systems.ts
// 物理系统

import type { World } from '../../core/world.js';
import type { Commands } from '../../core/commands.js';
import { Transform } from '../transform/plugin.js';
import {
  Velocity, Acceleration, Friction, RigidBody, Gravity,
  BoxCollider, CircleCollider,
  type Collision,
} from './components.js';

/** 运动学系统 —— 更新位置和速度 */
export function kinematicSystem(world: World, dt: number, _cmd: Commands): void {
  let gravityX = 0;
  let gravityY = 980;

  for (const eid of world.query(Gravity)) {
    const g = world.get(eid, Gravity);
    gravityX = g.x;
    gravityY = g.y;
    break;
  }

  for (const eid of world.query(Transform, Velocity)) {
    const t = world.get(eid, Transform);
    const v = world.get(eid, Velocity);

    if (world.has(eid, Acceleration)) {
      const a = world.get(eid, Acceleration);
      v.vx += a.ax * dt;
      v.vy += a.ay * dt;
    }

    if (world.has(eid, RigidBody)) {
      const body = world.get(eid, RigidBody);
      if (body.useGravity && !body.isStatic) {
        v.vx += gravityX * dt;
        v.vy += gravityY * dt;
      }
    }

    if (world.has(eid, Friction)) {
      const f = world.get(eid, Friction);
      v.vx *= 1 - f.linear * dt;
      v.vy *= 1 - f.linear * dt;
      v.angular *= 1 - f.angular * dt;
    }

    t.x += v.vx * dt;
    t.y += v.vy * dt;
    t.rotation += v.angular * dt;
  }
}

/** 简单碰撞检测系统 —— AABB vs AABB 和 Circle vs Circle */
export function collisionDetectionSystem(world: World, _dt: number, _cmd: Commands): void {
  const collisions: Collision[] = [];

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

  for (let i = 0; i < bodies.length; i++) {
    for (let j = i + 1; j < bodies.length; j++) {
      const a = bodies[i];
      const b = bodies[j];

      const layerA = a.box?.layer ?? a.circle?.layer ?? 'default';
      const maskA = a.box?.mask ?? a.circle?.mask ?? ['default'];
      const layerB = b.box?.layer ?? b.circle?.layer ?? 'default';
      const maskB = b.box?.mask ?? b.circle?.mask ?? ['default'];

      if (!maskA.includes(layerB) && !maskB.includes(layerA)) continue;

      const collision = testCollision(a, b);
      if (collision) {
        collisions.push(collision);
      }
    }
  }

  for (const col of collisions) {
    world.emit('collision', col);

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
  if (a.box && b.box) return testBoxBox(a.eid, a.t, a.box, b.eid, b.t, b.box);
  if (a.circle && b.circle) return testCircleCircle(a.eid, a.t, a.circle, b.eid, b.t, b.circle);
  if (a.box && b.circle) return testBoxCircle(a.eid, a.t, a.box, b.eid, b.t, b.circle);
  if (a.circle && b.box) {
    const col = testBoxCircle(b.eid, b.t, b.box, a.eid, a.t, a.circle);
    if (col) {
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

  let normalX = 0, normalY = 0, penetration = 0;
  if (overlapX < overlapY) {
    penetration = overlapX;
    normalX = tA.x < tB.x ? -1 : 1;
  } else {
    penetration = overlapY;
    normalY = tA.y < tB.y ? -1 : 1;
  }

  return {
    entityA: eidA, entityB: eidB,
    penetration, normalX, normalY,
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
  let normalX = 1, normalY = 0;

  if (dist > 0.001) {
    normalX = dx / dist;
    normalY = dy / dist;
  }

  return {
    entityA: eidA, entityB: eidB,
    penetration, normalX, normalY,
    contactX: tA.x + normalX * cirA.radius,
    contactY: tA.y + normalY * cirA.radius,
  };
}

function testBoxCircle(
  eidBox: number, tBox: Transform, box: BoxCollider,
  eidCir: number, tCir: Transform, cir: CircleCollider,
): Collision | null {
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
  let normalX = 1, normalY = 0;

  if (dist > 0.001) {
    normalX = dx / dist;
    normalY = dy / dist;
  } else {
    const toBoxX = tBox.x - cx;
    const toBoxY = tBox.y - cy;
    const len = Math.sqrt(toBoxX * toBoxX + toBoxY * toBoxY);
    if (len > 0.001) {
      normalX = toBoxX / len;
      normalY = toBoxY / len;
    }
  }

  return {
    entityA: eidBox, entityB: eidCir,
    penetration, normalX, normalY,
    contactX: closestX, contactY: closestY,
  };
}

function resolveCollision(world: World, col: Collision): void {
  const { entityA, entityB, penetration, normalX, normalY } = col;

  let massA = 1, massB = 1;
  let staticA = false, staticB = false;

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

  const totalMass = (staticA ? 0 : massA) + (staticB ? 0 : massB);
  const ratioA = staticA ? 0 : massA / totalMass;
  const ratioB = staticB ? 0 : massB / totalMass;

  tA.x -= normalX * penetration * ratioA;
  tA.y -= normalY * penetration * ratioA;
  tB.x += normalX * penetration * ratioB;
  tB.y += normalY * penetration * ratioB;

  if (world.has(entityA, Velocity) && !staticA) {
    const vA = world.get(entityA, Velocity);
    const restitutionA = world.has(entityA, RigidBody)
      ? world.get(entityA, RigidBody).restitution : 0;
    const dot = vA.vx * normalX + vA.vy * normalY;
    vA.vx -= (1 + restitutionA) * dot * normalX;
    vA.vy -= (1 + restitutionA) * dot * normalY;
  }

  if (world.has(entityB, Velocity) && !staticB) {
    const vB = world.get(entityB, Velocity);
    const restitutionB = world.has(entityB, RigidBody)
      ? world.get(entityB, RigidBody).restitution : 0;
    const dot = vB.vx * normalX + vB.vy * normalY;
    vB.vx += (1 + restitutionB) * dot * normalX;
    vB.vy += (1 + restitutionB) * dot * normalY;
  }
}
