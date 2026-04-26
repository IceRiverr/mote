// engine/src/plugins/physics/plugin.ts
// 物理插件 —— 基础运动学和简单碰撞

import type { Plugin } from '../../core/plugin.js';
import type { App } from '../../core/app.js';
import { ScheduleLabel } from '../../core/schedule.js';
import { TransformPlugin } from '../transform/plugin.js';
import {
  Velocity, Acceleration, Friction, RigidBody, Gravity,
  BoxCollider, CircleCollider,
} from './components.js';
import { kinematicSystem, collisionDetectionSystem } from './systems.js';

export {
  Velocity, Acceleration, Friction, RigidBody, Gravity,
  BoxCollider, CircleCollider,
  type Collision,
} from './components.js';

// ═════════════════════════════════════════════════════════════════════════════
// PhysicsPlugin
// ═════════════════════════════════════════════════════════════════════════════

/**
 * 物理插件 —— 提供基础运动学和简单碰撞
 *
 * ```ts
 * app.addPlugin(PhysicsPlugin);
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
export const PhysicsPlugin: Plugin = {
  name: 'physics',
  dependencies: [TransformPlugin],

  build(app: App) {
    app.registerComponent(Velocity);
    app.registerComponent(Acceleration);
    app.registerComponent(Friction);
    app.registerComponent(RigidBody);
    app.registerComponent(Gravity);
    app.registerComponent(BoxCollider);
    app.registerComponent(CircleCollider);

    app.addSystems(ScheduleLabel.FixedUpdate, [
      kinematicSystem,
      collisionDetectionSystem,
    ]);
  },
};
