// engine/src/plugins/physics/components.ts
// 物理组件

/** 速度组件 —— 线性速度 */
export class Velocity {
  /** X 方向速度（像素/秒） */
  vx = 0;
  /** Y 方向速度（像素/秒） */
  vy = 0;
  /** 角速度（弧度/秒） */
  angular = 0;
}

/** 加速度组件 —— 受持续力的影响 */
export class Acceleration {
  /** X 方向加速度（像素/秒²） */
  ax = 0;
  /** Y 方向加速度（像素/秒²） */
  ay = 0;
}

/** 摩擦力组件 —— 速度衰减 */
export class Friction {
  /** 线性摩擦系数 (0..1) */
  linear = 0;
  /** 角摩擦系数 (0..1) */
  angular = 0;
}

/** 刚体组件 —— 标记参与物理模拟（可选质量属性） */
export class RigidBody {
  /** 质量（kg） */
  mass = 1;
  /** 是否受重力影响 */
  useGravity = true;
  /** 是否静态（不受力影响） */
  isStatic = false;
  /** 弹力系数 (0..1) */
  restitution = 0;
}

/** 重力全局配置组件（单例，放在任意一个实体上） */
export class Gravity {
  /** X 方向重力加速度 */
  x = 0;
  /** Y 方向重力加速度 */
  y = 980;
}

/** 碰撞盒组件 —— AABB */
export class BoxCollider {
  /** 宽度（像素） */
  width = 16;
  /** 高度（像素） */
  height = 16;
  /** 相对于实体中心的偏移 X */
  offsetX = 0;
  /** 相对于实体中心的偏移 Y */
  offsetY = 0;
  /** 是否触发器（不阻挡，只检测） */
  isTrigger = false;
  /** 碰撞层 */
  layer = 'default';
  /** 能碰撞的层 */
  mask: string[] = ['default'];
}

/** 圆形碰撞组件 */
export class CircleCollider {
  /** 半径（像素） */
  radius = 8;
  /** 相对于实体中心的偏移 X */
  offsetX = 0;
  /** 相对于实体中心的偏移 Y */
  offsetY = 0;
  /** 是否触发器 */
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

// 声明组件类型
declare module '../../core/componentRegistry' {
  interface ComponentMap {
    Velocity: Velocity;
    Acceleration: Acceleration;
    Friction: Friction;
    RigidBody: RigidBody;
    Gravity: Gravity;
    BoxCollider: BoxCollider;
    CircleCollider: CircleCollider;
  }
}
