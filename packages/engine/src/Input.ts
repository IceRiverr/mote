// ═════════════════════════════════════════════════════════════════════════════
// Input System — Unified Module
// Contains: InputManager, ActionMap, ActionState, and all type definitions
//
// 帧调用顺序契约：
//   input.update()       // 轮询手柄
//   ... 游戏逻辑 ...      // 读取 action().pressed / .down / .vec2()
//   input.endFrame()     // 清 pressed/released + delta
// ═════════════════════════════════════════════════════════════════════════════

// ── Enums & Types ────────────────────────────────────────────────────────────

export enum ActionType {
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

export interface Axis1DDef {
  negative: string;  // e.g. "KeyA", "ArrowLeft"
  positive: string;  // e.g. "KeyD", "ArrowRight"
}

export interface ActionDef {
  type:        ActionType;
  /** Button / Axis1D: 键盘/鼠标/手柄按钮，任一触发即可 */
  bindings?:   string[];
  /** Axis2D: 键盘组合方向键，可多套 */
  composites?: CompositeAxis2D[];
  /** Axis1D: 显式正/负绑定（替代 bindings[0]/[1] 约定） */
  axis1d?:     Axis1DDef;
  /** Axis2D: 手柄摇杆，格式 "Gamepad0_Stick0" */
  gamepadStick?: string;
}

// ── ActionState ──────────────────────────────────────────────────────────────

export class ActionState {
  // 预解析的手柄摇杆索引（避免每帧 regex）
  private readonly _gpIndex:    number = -1;
  private readonly _stickIndex: number = -1;

  constructor(
    private readonly mgr: InputManager,
    private readonly def: ActionDef,
  ) {
    // 预解析 gamepadStick 字符串
    if (def.gamepadStick) {
      const m = def.gamepadStick.match(/^Gamepad(\d+)_Stick(\d+)$/);
      if (m) {
        this._gpIndex    = +m[1];
        this._stickIndex = +m[2];
      }
    }
  }

  // ── Button ────────────────────────────────────────────────────────────────

  get down(): boolean {
    if (!this.def.bindings) return false;
    for (const key of this.def.bindings)
      if (this.mgr.rawDown(key)) return true;
    return false;
  }

  get pressed(): boolean {
    if (!this.def.bindings) return false;
    for (const key of this.def.bindings)
      if (this.mgr.rawPressed(key)) return true;
    return false;
  }

  get released(): boolean {
    if (!this.def.bindings) return false;
    for (const key of this.def.bindings)
      if (this.mgr.rawReleased(key)) return true;
    return false;
  }

  // ── Axis2D ────────────────────────────────────────────────────────────────

  vec2(): { x: number; y: number } {
    // 1. 手柄摇杆优先（有输入时直接返回）
    if (this._gpIndex >= 0) {
      const s = this.mgr.rawStickByIndex(this._gpIndex, this._stickIndex);
      if (s.x !== 0 || s.y !== 0) return s;
    }

    // 2. 键盘 composite
    if (!this.def.composites) return { x: 0, y: 0 };

    let x = 0, y = 0;
    for (const c of this.def.composites) {
      // 每组 composite 独立计算，先到先得（不互相覆盖）
      if (x === 0) {
        const r = this.mgr.rawDown(c.right) ? 1 : 0;
        const l = this.mgr.rawDown(c.left)  ? 1 : 0;
        if (r || l) x = r - l;
      }
      if (y === 0) {
        const d = this.mgr.rawDown(c.down)  ? 1 : 0;
        const u = this.mgr.rawDown(c.up)    ? 1 : 0;
        if (d || u) y = u - d;
      }
    }

    // 对角线归一化（和 Unity Composite 一致）
    if (x !== 0 && y !== 0) {
      const inv = 1 / Math.SQRT2;
      return { x: x * inv, y: y * inv };
    }
    return { x, y };
  }

  // ── Axis1D ────────────────────────────────────────────────────────────────

  axis(): number {
    // 优先使用显式 axis1d 定义
    if (this.def.axis1d) {
      const pos = this.mgr.rawDown(this.def.axis1d.positive) ? 1 : 0;
      const neg = this.mgr.rawDown(this.def.axis1d.negative) ? 1 : 0;
      return pos - neg;
    }
    // 兼容 bindings[0]=negative, bindings[1]=positive 的旧写法
    if (!this.def.bindings || this.def.bindings.length < 2) return 0;
    const pos = this.mgr.rawDown(this.def.bindings[1]) ? 1 : 0;
    const neg = this.mgr.rawDown(this.def.bindings[0]) ? 1 : 0;
    return pos - neg;
  }
}

// ── ActionMap ────────────────────────────────────────────────────────────────

export class ActionMap {
  readonly name: string;
  enabled = false;
  private readonly actions = new Map<string, ActionState>();

  constructor(
    name: string,
    defs: Record<string, ActionDef>,
    mgr: InputManager,
  ) {
    this.name = name;
    for (const [k, def] of Object.entries(defs))
      this.actions.set(k, new ActionState(mgr, def));
  }

  has(name: string): boolean {
    return this.actions.has(name);
  }

  action(name: string): ActionState {
    const a = this.actions.get(name);
    if (!a) throw new Error(`Action "${name}" not found in map "${this.name}"`);
    return a;
  }

  enable():  void { this.enabled = true; }
  disable(): void { this.enabled = false; }
}

// ── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_PREVENT_KEYS = [
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  'Space', 'Tab', 'Backspace',
];

// Gamepad deadzone: values below MIN are zeroed, then remapped to 0..1 up to MAX
const DEADZONE_MIN = 0.25;
const DEADZONE_MAX = 0.85;

const STICK_ZERO: Readonly<{ x: number; y: number }> = { x: 0, y: 0 };

function applyDeadzone(v: number): number {
  const abs = Math.abs(v);
  if (abs < DEADZONE_MIN) return 0;
  const remapped = (abs - DEADZONE_MIN) / (DEADZONE_MAX - DEADZONE_MIN);
  return Math.sign(v) * Math.min(remapped, 1);
}

// ── InputManager ─────────────────────────────────────────────────────────────

export class InputManager {
  // ── LittleJS 3-bit 位域核心 ──────────────────────────────────────────────
  // bit 0 = isDown, bit 1 = wasPressed, bit 2 = wasReleased
  private state: Record<string, number> = {};

  // ── 手柄摇杆数据 ─────────────────────────────────────────────────────────
  // stickData[gamepadIndex][stickIndex] = { x, y }
  private stickData: { x: number; y: number }[][] = [];

  // ── 鼠标 ─────────────────────────────────────────────────────────────────
  screenX    = 0;
  screenY    = 0;
  deltaX     = 0;
  deltaY     = 0;
  wheelDelta = 0;
  inWindow   = true;

  // ── ActionMap 注册表 ──────────────────────────────────────────────────────
  private readonly maps = new Map<string, ActionMap>();

  private readonly canvas: HTMLCanvasElement;
  private readonly cfg: { preventDefault: boolean; preventKeys: string[] };
  private readonly handlers: [string, EventListener, AddEventListenerOptions?][] = [];

  constructor(canvas: HTMLCanvasElement, config?: {
    preventDefault?:     boolean;
    preventDefaultKeys?: string[];
  }) {
    this.canvas = canvas;
    this.cfg = {
      preventDefault: config?.preventDefault ?? true,
      preventKeys:    config?.preventDefaultKeys ?? DEFAULT_PREVENT_KEYS,
    };
    this._attachDOM();
  }

  // ── ActionMap 管理 ────────────────────────────────────────────────────────

  addMap(map: ActionMap): this {
    this.maps.set(map.name, map);
    return this;
  }

  map(name: string): ActionMap {
    const m = this.maps.get(name);
    if (!m) throw new Error(`ActionMap "${name}" not found`);
    return m;
  }

  /** 在所有已启用的 map 中查找 action（无 try/catch，用 has 检查） */
  action(name: string): ActionState {
    for (const m of this.maps.values()) {
      if (m.enabled && m.has(name)) return m.action(name);
    }
    throw new Error(`Action "${name}" not found in any enabled ActionMap`);
  }

  // ── 原始位域查询（ActionState 内部使用）──────────────────────────────────

  rawDown    (k: string): boolean { return !!(this.state[k] & 1); }
  rawPressed (k: string): boolean { return !!(this.state[k] & 2); }
  rawReleased(k: string): boolean { return !!(this.state[k] & 4); }

  /** 通过预解析的索引直接读取手柄摇杆（无 regex） */
  rawStickByIndex(gpIndex: number, stickIndex: number): { x: number; y: number } {
    return this.stickData[gpIndex]?.[stickIndex] ?? STICK_ZERO;
  }

  /**
   * 读取手柄摇杆，key 格式："Gamepad0_Stick0"
   * 保留给外部直接查询使用；ActionState 内部走 rawStickByIndex
   */
  rawStick(key: string): { x: number; y: number } {
    const m = key.match(/^Gamepad(\d+)_Stick(\d+)$/);
    if (!m) return STICK_ZERO;
    return this.stickData[+m[1]]?.[+m[2]] ?? STICK_ZERO;
  }

  // ── 帧生命周期 ────────────────────────────────────────────────────────────

  /**
   * 每帧开头调用：轮询手柄状态
   * （键盘/鼠标由 DOM 事件驱动，不需要在这里处理）
   */
  update(): void {
    this._pollGamepads();
  }

  /** 每帧结尾调用：清除 pressed/released 位，重置增量 */
  endFrame(): void {
    for (const k in this.state) this.state[k] &= 1;
    // 滚轮没有 "up" 事件，isDown 位必须手动清零
    delete this.state['WheelUp'];
    delete this.state['WheelDown'];
    this.deltaX = this.deltaY = this.wheelDelta = 0;
  }

  /** 全清（blur / 场景切换时调用） */
  clear(): void {
    this.state     = {};
    this.stickData = [];
    this.deltaX    = this.deltaY = this.wheelDelta = 0;
  }

  destroy(): void {
    for (const [evt, fn, opts] of this.handlers)
      document.removeEventListener(evt, fn, opts);
    this.handlers.length = 0;
  }

  // ── Gamepad 轮询 ──────────────────────────────────────────────────────────

  private _pollGamepads(): void {
    if (!navigator.getGamepads) return;

    const gamepads = navigator.getGamepads();
    for (let gi = 0; gi < gamepads.length; gi++) {
      const gp = gamepads[gi];
      if (!gp) {
        // 手柄断开：清除该手柄的所有状态
        if (this.stickData[gi]) {
          this.stickData[gi] = [];
          const prefix = `Gamepad${gi}_`;
          for (const k in this.state) {
            if (k.startsWith(prefix)) delete this.state[k];
          }
        }
        continue;
      }

      // 摇杆（每对 axes 组成一个 stick）
      if (!this.stickData[gi]) this.stickData[gi] = [];
      for (let si = 0; si < Math.floor(gp.axes.length / 2); si++) {
        this.stickData[gi][si] = {
          x: applyDeadzone(gp.axes[si * 2]),
          y: -applyDeadzone(gp.axes[si * 2 + 1]),
        };
      }

      // 按钮 → 3-bit 位域，key = "Gamepad0_Button0"
      for (let bi = 0; bi < gp.buttons.length; bi++) {
        const key     = `Gamepad${gi}_Button${bi}`;
        const pressed = gp.buttons[bi].pressed;
        const wasDown = !!(this.state[key] & 1);

        if (pressed && !wasDown)       this.state[key] = 3; // 新按下
        else if (pressed && wasDown)   this.state[key] = 1; // 持续按住
        else if (!pressed && wasDown)  this.state[key] = (this.state[key] & 2) | 4; // 释放
        // !pressed && !wasDown → 不写，保持 0/undefined
      }
    }
  }

  // ── DOM 事件绑定 ──────────────────────────────────────────────────────────

  private _attachDOM(): void {
    const on = (
      evt: string,
      fn: EventListener,
      opts?: AddEventListenerOptions,
    ) => {
      document.addEventListener(evt, fn, opts);
      this.handlers.push([evt, fn, opts]);
    };

    on('keydown',     this._onKD.bind(this));
    on('keyup',       this._onKU.bind(this));
    on('mousedown',   this._onMD.bind(this));
    on('mouseup',     this._onMU.bind(this));
    on('mousemove',   this._onMM.bind(this));
    on('mouseleave',  () => { this.inWindow = false; });
    on('wheel',       this._onWh.bind(this), { passive: false });
    on('contextmenu', (e) => { if (this.cfg.preventDefault) e.preventDefault(); });
    on('blur',        () => this.clear());
  }

  private _onKD(e: Event): void {
    const k = e as KeyboardEvent;
    if (k.repeat) return;
    this.state[k.code] = 3;
    this._preventKey(k);
  }

  private _onKU(e: Event): void {
    const k = e as KeyboardEvent;
    this.state[k.code] = (this.state[k.code] & 2) | 4;
  }

  private _onMD(e: Event): void {
    const m = e as MouseEvent;
    this.state[`Mouse${m.button}`] = 3;
    this._updateMousePos(m);
    if (this.cfg.preventDefault && m.cancelable) m.preventDefault();
  }

  private _onMU(e: Event): void {
    const m = e as MouseEvent;
    const k = `Mouse${m.button}`;
    this.state[k] = (this.state[k] & 2) | 4;
  }

  private _onMM(e: Event): void {
    const m = e as MouseEvent;
    this.inWindow = true;
    const px = this.screenX, py = this.screenY;
    this._updateMousePos(m);
    this.deltaX += this.screenX - px;
    this.deltaY += this.screenY - py;
  }

  private _onWh(e: Event): void {
    const w = e as WheelEvent;
    const d = Math.sign(w.deltaY);
    this.wheelDelta = w.ctrlKey ? 0 : d;
    if (d < 0) this.state['WheelUp']   = 3;
    if (d > 0) this.state['WheelDown'] = 3;
    if (this.cfg.preventDefault && w.cancelable) w.preventDefault();
  }

  private _updateMousePos(e: MouseEvent): void {
    const r = this.canvas.getBoundingClientRect();
    this.screenX = ((e.clientX - r.left) / r.width)  * this.canvas.width;
    this.screenY = ((e.clientY - r.top)  / r.height) * this.canvas.height;
  }

  private _preventKey(e: KeyboardEvent): void {
    if (!this.cfg.preventDefault || !e.cancelable) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const el = e.target as HTMLElement | null;
    if (el?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el?.tagName ?? '')) return;
    const printable = typeof e.key === 'string' && e.key.length === 1;
    if (printable || this.cfg.preventKeys.includes(e.code)) e.preventDefault();
  }
}
