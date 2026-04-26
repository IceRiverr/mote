// engine/src/plugins/transform/components.ts
// 变换与实体标识组件

/** 变换组件 —— 位置、旋转、缩放（所有可见/物理实体的基础） */
export class Transform {
  /** X 坐标（像素） */
  x = 0;
  /** Y 坐标（像素） */
  y = 0;
  /** 旋转角度（弧度） */
  rotation = 0;
  /** X 缩放 */
  scaleX = 1;
  /** Y 缩放 */
  scaleY = 1;
}

/** 名称组件 —— 用于调试和编辑器识别 */
export class Name {
  /** 实体显示名称 */
  value = '';
}

// 声明组件类型
declare module '../../core/componentRegistry' {
  interface ComponentMap {
    Transform: Transform;
    Name: Name;
  }
}
