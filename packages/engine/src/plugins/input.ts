// engine/src/plugins/input.ts
// 输入插件 —— 键盘/鼠标/手柄输入管理

import type { World } from '../core/world';
import type { Entity } from '../core/entity';
import { ComponentRegistry } from '../core/component';

// ═════════════════════════════════════════════════════════════════════════════
// 组件定义
// ═════════════════════════════════════════════════════════════════════════════

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

/** 输入设备原始状态（内部使用） */
class InputState {
  /** 按键状态: key -> boolean */
  keys = new Map<string, boolean>();
  /** 本帧新按下的键 */
  pressed = new Set<string>();
  /** 本帧释放的键 */
  released = new Set<string>();
  /** 鼠标位置 */
  mouseX = 0;
  mouseY = 0;
  /** 鼠标移动增量 */
  mouseDeltaX = 0;
  mouseDeltaY = 0;
  /** 鼠标按钮状态 */
  mouseButtons = [false, false, false];
  /** 滚轮 */
  wheel = 0;
}

// ═════════════════════════════════════════════════════════════════════════════
// 输入配置
// ═════════════════════════════════════════════════════════════════════════════

export interface InputMap {
  /** 向上移动 */
  up: string[];
  /** 向下移动 */
  down: string[];
  /** 向左移动 */
  left: string[];
  /** 向右移动 */
  right: string[];
  /** 攻击 */
  attack: string[];
  /** 冲刺 */
  dash: string[];
}

export const DefaultInputMap: InputMap = {
  up: ['KeyW', 'ArrowUp'],
  down: ['KeyS', 'ArrowDown'],
  left: ['KeyA', 'ArrowLeft'],
  right: ['KeyD', 'ArrowRight'],
  attack: ['Space', 'Mouse0'],
  dash: ['ShiftLeft', 'ShiftRight'],
};

// ═════════════════════════════════════════════════════════════════════════════
// 系统
// ═════════════════════════════════════════════════════════════════════════════

/** 输入系统 —— 每帧更新 PlayerInput 组件 */
function inputSystem(world: World, dt: number): void {
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

// ═════════════════════════════════════════════════════════════════════════════
// 输入管理器
// ═════════════════════════════════════════════════════════════════════════════

export class InputManager {
  readonly state = new InputState();
  readonly map: InputMap;

  private canvas: HTMLCanvasElement;
  private preventDefault: boolean;
  private handlers: [string, EventListener, AddEventListenerOptions?][] = [];

  constructor(canvas: HTMLCanvasElement, options?: { 
    map?: InputMap;
    preventDefault?: boolean;
  }) {
    this.canvas = canvas;
    this.map = options?.map ?? DefaultInputMap;
    this.preventDefault = options?.preventDefault ?? true;
    this.attachEvents();
  }

  /** 检查任一按键是否按下 */
  isAnyDown(keys: string[]): boolean {
    for (const key of keys) {
      if (this.state.keys.get(key)) return true;
    }
    return false;
  }

  /** 检查任一按键是否本帧刚按下 */
  isAnyPressed(keys: string[]): boolean {
    for (const key of keys) {
      if (this.state.pressed.has(key)) return true;
    }
    return false;
  }

  /** 检查任一按键是否本帧刚释放 */
  isAnyReleased(keys: string[]): boolean {
    for (const key of keys) {
      if (this.state.released.has(key)) return true;
    }
    return false;
  }

  /** 获取鼠标在 canvas 内的坐标 */
  getMousePos(): { x: number; y: number } {
    return { x: this.state.mouseX, y: this.state.mouseY };
  }

  /** 帧更新（处理手柄等需要轮询的设备） */
  update(): void {
    this.pollGamepads();
  }

  /** 帧末清理 */
  endFrame(): void {
    this.state.pressed.clear();
    this.state.released.clear();
    this.state.mouseDeltaX = 0;
    this.state.mouseDeltaY = 0;
    this.state.wheel = 0;
  }

  /** 清理所有事件监听 */
  destroy(): void {
    for (const [evt, fn, opts] of this.handlers) {
      document.removeEventListener(evt, fn, opts);
    }
    this.handlers.length = 0;
  }

  private attachEvents(): void {
    const add = (evt: string, fn: EventListener, opts?: AddEventListenerOptions) => {
      document.addEventListener(evt, fn, opts);
      this.handlers.push([evt, fn, opts]);
    };

    // 键盘
    add('keydown', (e) => {
      const ke = e as KeyboardEvent;
      if (ke.repeat) return;
      this.state.keys.set(ke.code, true);
      this.state.pressed.add(ke.code);
      if (this.preventDefault) this.preventKey(ke);
    });

    add('keyup', (e) => {
      const ke = e as KeyboardEvent;
      this.state.keys.set(ke.code, false);
      this.state.released.add(ke.code);
    });

    // 鼠标
    add('mousedown', (e) => {
      const me = e as MouseEvent;
      const key = `Mouse${me.button}`;
      this.state.keys.set(key, true);
      this.state.pressed.add(key);
      this.updateMousePos(me);
      if (this.preventDefault && me.cancelable) me.preventDefault();
    });

    add('mouseup', (e) => {
      const me = e as MouseEvent;
      const key = `Mouse${me.button}`;
      this.state.keys.set(key, false);
      this.state.released.add(key);
    });

    add('mousemove', (e) => {
      const me = e as MouseEvent;
      const prevX = this.state.mouseX;
      const prevY = this.state.mouseY;
      this.updateMousePos(me);
      this.state.mouseDeltaX += this.state.mouseX - prevX;
      this.state.mouseDeltaY += this.state.mouseY - prevY;
    });

    add('wheel', (e) => {
      const we = e as WheelEvent;
      this.state.wheel = Math.sign(we.deltaY);
      if (this.preventDefault && we.cancelable) we.preventDefault();
    }, { passive: false });

    // 失去焦点时清空
    add('blur', () => this.clear());
  }

  private updateMousePos(e: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    this.state.mouseX = (e.clientX - rect.left) * scaleX;
    this.state.mouseY = (e.clientY - rect.top) * scaleY;
  }

  private preventKey(e: KeyboardEvent): void {
    if (!e.cancelable) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const el = e.target as HTMLElement | null;
    if (el?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el?.tagName ?? '')) return;
    
    const preventKeys = [
      'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
      'Space', 'Tab', 'Backspace',
    ];
    if (preventKeys.includes(e.code) || e.key.length === 1) {
      e.preventDefault();
    }
  }

  private pollGamepads(): void {
    if (!navigator.getGamepads) return;
    const gamepads = navigator.getGamepads();
    
    for (let i = 0; i < gamepads.length; i++) {
      const gp = gamepads[i];
      if (!gp) continue;

      // 映射手柄按钮（简单映射，后续可扩展）
      const gpPrefix = `Gamepad${i}_`;
      
      // 左摇杆模拟方向键
      const lx = gp.axes[0] ?? 0;
      const ly = gp.axes[1] ?? 0;
      const deadzone = 0.25;

      // 更新虚拟方向键状态
      this.updateGamepadButton(`${gpPrefix}Left`, lx < -deadzone);
      this.updateGamepadButton(`${gpPrefix}Right`, lx > deadzone);
      this.updateGamepadButton(`${gpPrefix}Up`, ly < -deadzone);
      this.updateGamepadButton(`${gpPrefix}Down`, ly > deadzone);

      // 手柄按钮
      for (let b = 0; b < gp.buttons.length; b++) {
        const pressed = gp.buttons[b].pressed;
        this.updateGamepadButton(`${gpPrefix}Button${b}`, pressed);
      }
    }
  }

  private updateGamepadButton(key: string, pressed: boolean): void {
    const wasDown = this.state.keys.get(key) ?? false;
    if (pressed && !wasDown) {
      this.state.keys.set(key, true);
      this.state.pressed.add(key);
    } else if (!pressed && wasDown) {
      this.state.keys.set(key, false);
      this.state.released.add(key);
    }
  }

  private clear(): void {
    this.state.keys.clear();
    this.state.pressed.clear();
    this.state.released.clear();
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 插件导出
// ═════════════════════════════════════════════════════════════════════════════

export interface InputPluginOptions {
  canvas: HTMLCanvasElement;
  map?: InputMap;
  preventDefault?: boolean;
}

/**
 * 输入插件
 * 
 * ```ts
 * world.use(InputPlugin, { canvas });
 * 
 * // 在实体上添加输入组件
 * player.add(PlayerInput);
 * 
 * // 在系统中读取
 * world.query(PlayerInput).each((input) => {
 *   if (input.attackPressed) spawnBullet();
 * });
 * ```
 */
export function InputPlugin(world: World, options: InputPluginOptions): void {
  const manager = new InputManager(options.canvas, {
    map: options.map,
    preventDefault: options.preventDefault,
  });

  world.addResource('input', manager);
  world.registerComponent(PlayerInput, 'PlayerInput');
  world.addSystem(inputSystem);

  // 清理
  world.on('destroy', () => manager.destroy());
}

// 声明组件类型
declare module '../core/component' {
  interface ComponentMap {
    PlayerInput: PlayerInput;
  }
}
