// ═══════════════════════════════════════════════════════════════
// Rigidbody.ts - 刚体组件
// 定义物理模拟属性
// ═══════════════════════════════════════════════════════════════

/**
 * 刚体类型
 */
export enum RigidbodyType {
  /** 静态（不动，如墙壁、地面） */
  Static = 'static',
  /** 动态（受力和碰撞影响） */
  Dynamic = 'dynamic',
  /** 运动学（通过代码控制位置，不受力影响） */
  Kinematic = 'kinematic',
}

/**
 * 刚体组件 - 启用物理模拟
 * 
 * 需要配合 Collider 和 Transform 使用
 */
export class Rigidbody {
  /**
   * 刚体类型
   * @default "dynamic"
   * @type enum
   * @options ["static", "dynamic", "kinematic"]
   */
  type: RigidbodyType = RigidbodyType.Dynamic;

  /**
   * 质量（千克，static 类型忽略）
   * @default 1
   * @range [0.1, 1000]
   * @step 0.1
   */
  mass = 1;

  /**
   * 线性阻尼（速度衰减）
   * @default 0
   * @range [0, 1]
   * @step 0.05
   */
  linearDamping = 0;

  /**
   * 角阻尼（旋转速度衰减）
   * @default 0
   * @range [0, 1]
   * @step 0.05
   */
  angularDamping = 0;

  /**
   * 是否受重力影响
   * @default true
   */
  useGravity = true;

  /**
   * 固定旋转（防止物体旋转）
   * @default false
   */
  fixedRotation = false;

  /**
   * 线性速度 X（运行时属性，通常不直接编辑）
   * @readonly
   */
  velocityX = 0;

  /**
   * 线性速度 Y（运行时属性，通常不直接编辑）
   * @readonly
   */
  velocityY = 0;
}

// 注册到 ComponentMap
declare module '../core/component' {
  interface ComponentMap {
    Rigidbody: Rigidbody;
  }
}
