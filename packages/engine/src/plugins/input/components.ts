// engine/src/plugins/input/components.ts
// 输入组件

/** 玩家输入组件 —— 存储处理后的输入状态 */
export class PlayerInput {
  /** 移动方向 (-1..1) */
  moveX = 0;
  /** 移动方向 (-1..1) */
  moveY = 0;
  /** 是否攻击 */
  attack = false;
  /** 是否攻击（仅触发一帧） */
  attackPressed = false;
  /** 是否冲刺 */
  dash = false;
  /** 是否冲刺（仅触发一帧） */
  dashPressed = false;
  /** 鼠标/瞄准方向 X */
  aimX = 0;
  /** 鼠标/瞄准方向 Y */
  aimY = 0;
}

// 声明组件类型
declare module '../../core/componentRegistry' {
  interface ComponentMap {
    PlayerInput: PlayerInput;
  }
}
