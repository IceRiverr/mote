// ═══════════════════════════════════════════════════════════════
// Collider.ts - 碰撞体组件
// 定义实体的物理碰撞区域
// ═══════════════════════════════════════════════════════════════

/**
 * 碰撞体形状类型
 */
export type ColliderShape = 
  | { type: 'rect'; width: number; height: number; offsetX?: number; offsetY?: number }
  | { type: 'circle'; radius: number; offsetX?: number; offsetY?: number }
  | { type: 'point' }
  | { type: 'full' };  // 占据整个 Transform 区域

/**
 * 碰撞体组件 - 定义物理碰撞区域
 * 
 * 支持多种形状，可组合使用（复合碰撞体）
 */
export class Collider {
  /**
   * 形状列表（支持复合碰撞体）
   * @default [{ type: 'rect', width: 16, height: 16 }]
   */
  shapes: ColliderShape[] = [{ type: 'rect', width: 16, height: 16 }];

  /**
   * 是否为触发器（触发器不产生物理碰撞响应，仅触发事件）
   * @default false
   */
  isTrigger = false;

  /**
   * 物理材质 ID（影响摩擦力和弹性）
   * @default "default"
   */
  material = 'default';

  /**
   * 碰撞层级（用于碰撞过滤）
   * @default 1
   * @range [0, 32]
   * @step 1
   */
  layer = 1;

  /**
   * 碰撞遮罩（与哪些层级的物体碰撞，位掩码）
   * @default 0xFFFFFFFF
   */
  mask = 0xFFFFFFFF;
}

// 注册到 ComponentMap
declare module '../core/component' {
  interface ComponentMap {
    Collider: Collider;
  }
}
