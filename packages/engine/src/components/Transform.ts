// ═══════════════════════════════════════════════════════════════
// Transform.ts - 变换组件
// 定义实体在 2D 空间中的位置、旋转和缩放
// ═══════════════════════════════════════════════════════════════

/**
 * 变换组件 - 所有可见实体都必须拥有的基础组件
 * 
 * 坐标系：
 * - X 轴向右为正
 * - Y 轴向下为正（屏幕坐标系）
 * - 旋转以度为单位，顺时针为正
 */
export class Transform {
  /**
   * X 坐标（像素）
   * @default 0
   * @step 1
   */
  x = 0;

  /**
   * Y 坐标（像素）
   * @default 0
   * @step 1
   */
  y = 0;

  /**
   * 旋转角度（度）
   * @default 0
   * @range [-360, 360]
   * @step 15
   */
  rotation = 0;

  /**
   * X 轴缩放
   * @default 1
   * @range [0.1, 10]
   * @step 0.1
   */
  scaleX = 1;

  /**
   * Y 轴缩放
   * @default 1
   * @range [0.1, 10]
   * @step 0.1
   */
  scaleY = 1;
}

// 注册到 ComponentMap
declare module '../core/component' {
  interface ComponentMap {
    Transform: Transform;
  }
}
