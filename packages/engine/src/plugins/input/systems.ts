// engine/src/plugins/input/systems.ts
// 输入系统

import type { World } from '../../core/world.js';
import type { Commands } from '../../core/commands.js';
import { PlayerInput } from './components.js';
import { InputManager } from './plugin.js';

/** 输入系统 —— 每帧更新 PlayerInput 组件 */
export function inputSystem(world: World, _dt: number, _cmd: Commands): void {
  const inputManager = world.getResource<InputManager>('input');
  if (!inputManager) return;

  // 更新原始输入状态
  inputManager.update();

  // 处理所有带 PlayerInput 的实体
  for (const eid of world.query(PlayerInput)) {
    const input = world.get(eid, PlayerInput);
    const map = inputManager.map;

    // 计算移动向量
    let moveX = 0;
    let moveY = 0;

    if (inputManager.isAnyDown(map.up)) moveY -= 1;
    if (inputManager.isAnyDown(map.down)) moveY += 1;
    if (inputManager.isAnyDown(map.left)) moveX -= 1;
    if (inputManager.isAnyDown(map.right)) moveX += 1;

    // 归一化对角线移动
    if (moveX !== 0 && moveY !== 0) {
      const inv = 1 / Math.SQRT2;
      moveX *= inv;
      moveY *= inv;
    }

    input.moveX = moveX;
    input.moveY = moveY;

    // 攻击状态
    input.attackPressed = inputManager.isAnyPressed(map.attack);
    input.attack = inputManager.isAnyDown(map.attack);

    // 冲刺状态
    input.dashPressed = inputManager.isAnyPressed(map.dash);
    input.dash = inputManager.isAnyDown(map.dash);

    // 鼠标/瞄准位置
    input.aimX = inputManager.state.mouseX;
    input.aimY = inputManager.state.mouseY;
  }

  // 帧末清理
  inputManager.endFrame();
}
