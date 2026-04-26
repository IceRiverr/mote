// engine/src/plugins/input/plugin.ts
// 输入插件 —— 键盘/鼠标/手柄输入管理

import type { Plugin } from '../../core/plugin.js';
import type { App } from '../../core/app.js';
import { ScheduleLabel } from '../../core/schedule.js';
import { PlayerInput } from './components.js';
import { inputSystem } from './systems.js';

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
// 输入设备原始状态（内部使用）
// ═════════════════════════════════════════════════════════════════════════════

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

      const gpPrefix = `Gamepad${i}_`;
      const lx = gp.axes[0] ?? 0;
      const ly = gp.axes[1] ?? 0;
      const deadzone = 0.25;

      this.updateGamepadButton(`${gpPrefix}Left`, lx < -deadzone);
      this.updateGamepadButton(`${gpPrefix}Right`, lx > deadzone);
      this.updateGamepadButton(`${gpPrefix}Up`, ly < -deadzone);
      this.updateGamepadButton(`${gpPrefix}Down`, ly > deadzone);

      for (let b = 0; b < gp.buttons.length; b++) {
        this.updateGamepadButton(`${gpPrefix}Button${b}`, gp.buttons[b].pressed);
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
// InputPlugin
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
 * app.addPlugin(new InputPlugin({ canvas }));
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
export class InputPlugin implements Plugin {
  readonly name = 'input';

  constructor(private options: InputPluginOptions) {}

  build(app: App): void {
    const manager = new InputManager(this.options.canvas, {
      map: this.options.map,
      preventDefault: this.options.preventDefault,
    });

    app.insertResource('input', manager);
    app.registerComponent(PlayerInput);
    app.addSystems(ScheduleLabel.PreUpdate, [inputSystem]);
  }
}

export { PlayerInput } from './components.js';
