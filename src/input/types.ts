export const enum ActionType {
  Button,  // bool: Jump, Shoot, Pause
  Axis1D,  // float -1..1: Throttle
  Axis2D,  // vec2: Move, Look
}

export interface CompositeAxis2D {
  up:    string;
  down:  string;
  left:  string;
  right: string;
}

export interface ActionDef {
  type:        ActionType;
  /** Button / Axis1D: 键盘/鼠标/手柄按钮，任一触发即可 */
  bindings?:   string[];
  /** Axis2D: 键盘组合方向键，可多套 */
  composites?: CompositeAxis2D[];
  /** Axis2D: 手柄摇杆，格式 "Gamepad0_Stick0" */
  gamepadStick?: string;
}
