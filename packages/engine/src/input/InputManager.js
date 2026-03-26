const DEFAULT_PREVENT_KEYS = [
    'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
    'Space', 'Tab', 'Backspace',
];
// Gamepad deadzone: values below MIN are zeroed, then remapped to 0..1 up to MAX
const DEADZONE_MIN = 0.25;
const DEADZONE_MAX = 0.85;
function applyDeadzone(v) {
    const abs = Math.abs(v);
    if (abs < DEADZONE_MIN)
        return 0;
    const remapped = (abs - DEADZONE_MIN) / (DEADZONE_MAX - DEADZONE_MIN);
    return Math.sign(v) * Math.min(remapped, 1);
}
export class InputManager {
    // ── LittleJS 3-bit 位域核心 ──────────────────────────────────────────────
    // bit 0 = isDown, bit 1 = wasPressed, bit 2 = wasReleased
    state = {};
    // ── 手柄摇杆数据 ─────────────────────────────────────────────────────────
    // stickData[gamepadIndex][stickIndex] = { x, y }
    stickData = [];
    // ── 鼠标 ─────────────────────────────────────────────────────────────────
    screenX = 0;
    screenY = 0;
    deltaX = 0;
    deltaY = 0;
    wheelDelta = 0;
    inWindow = true;
    // ── ActionMap 注册表 ──────────────────────────────────────────────────────
    maps = new Map();
    canvas;
    cfg;
    handlers = [];
    constructor(canvas, config) {
        this.canvas = canvas;
        this.cfg = {
            preventDefault: config?.preventDefault ?? true,
            preventKeys: config?.preventDefaultKeys ?? DEFAULT_PREVENT_KEYS,
        };
        this._attachDOM();
    }
    // ── ActionMap 管理 ────────────────────────────────────────────────────────
    addMap(map) {
        this.maps.set(map.name, map);
        return this;
    }
    map(name) {
        const m = this.maps.get(name);
        if (!m)
            throw new Error(`ActionMap "${name}" not found`);
        return m;
    }
    /** 在所有已启用的 map 中查找 action */
    action(name) {
        for (const m of this.maps.values()) {
            if (!m.enabled)
                continue;
            try {
                return m.action(name);
            }
            catch { /* not in this map */ }
        }
        throw new Error(`Action "${name}" not found in any enabled ActionMap`);
    }
    // ── 原始位域查询（ActionState 内部使用）──────────────────────────────────
    rawDown(k) { return !!(this.state[k] & 1); }
    rawPressed(k) { return !!(this.state[k] & 2); }
    rawReleased(k) { return !!(this.state[k] & 4); }
    /**
     * 读取手柄摇杆，key 格式："Gamepad0_Stick0"
     * Stick0 = 左摇杆, Stick1 = 右摇杆
     */
    rawStick(key) {
        const m = key.match(/^Gamepad(\d+)_Stick(\d+)$/);
        if (!m)
            return { x: 0, y: 0 };
        return this.stickData[+m[1]]?.[+m[2]] ?? { x: 0, y: 0 };
    }
    // ── 帧生命周期 ────────────────────────────────────────────────────────────
    /**
     * 每帧开头调用：轮询手柄状态
     * （键盘/鼠标由 DOM 事件驱动，不需要在这里处理）
     */
    update() {
        this._pollGamepads();
    }
    /** 每帧结尾调用：清除 pressed/released 位，重置增量 */
    endFrame() {
        for (const k in this.state)
            this.state[k] &= 1;
        this.deltaX = this.deltaY = this.wheelDelta = 0;
    }
    /** 全清（blur / 场景切换时调用） */
    clear() {
        this.state = {};
        this.stickData = [];
        this.deltaX = this.deltaY = this.wheelDelta = 0;
    }
    destroy() {
        for (const [evt, fn, opts] of this.handlers)
            document.removeEventListener(evt, fn, opts);
        this.handlers.length = 0;
    }
    // ── Gamepad 轮询 ──────────────────────────────────────────────────────────
    _pollGamepads() {
        if (!navigator.getGamepads)
            return;
        const gamepads = navigator.getGamepads();
        for (let gi = 0; gi < gamepads.length; gi++) {
            const gp = gamepads[gi];
            if (!gp) {
                // 手柄断开：清除该手柄的所有状态
                if (this.stickData[gi]) {
                    this.stickData[gi] = [];
                    // 清掉该手柄的按钮位域
                    for (const k in this.state) {
                        if (k.startsWith(`Gamepad${gi}_`))
                            delete this.state[k];
                    }
                }
                continue;
            }
            // 摇杆（每对 axes 组成一个 stick）
            if (!this.stickData[gi])
                this.stickData[gi] = [];
            for (let si = 0; si < Math.floor(gp.axes.length / 2); si++) {
                this.stickData[gi][si] = {
                    x: applyDeadzone(gp.axes[si * 2]),
                    y: applyDeadzone(gp.axes[si * 2 + 1]),
                };
            }
            // 按钮 → 3-bit 位域，key = "Gamepad0_Button0"
            for (let bi = 0; bi < gp.buttons.length; bi++) {
                const key = `Gamepad${gi}_Button${bi}`;
                const pressed = gp.buttons[bi].pressed;
                const wasDown = !!(this.state[key] & 1);
                if (pressed && !wasDown)
                    this.state[key] = 3; // 新按下
                else if (pressed && wasDown)
                    this.state[key] = 1; // 持续按住
                else if (!pressed && wasDown)
                    this.state[key] = (this.state[key] & 2) | 4; // 释放
                // !pressed && !wasDown → 不写，保持 0
            }
        }
    }
    // ── DOM 事件绑定 ──────────────────────────────────────────────────────────
    _attachDOM() {
        const on = (evt, fn, opts) => {
            document.addEventListener(evt, fn, opts);
            this.handlers.push([evt, fn, opts]);
        };
        on('keydown', this._onKD.bind(this));
        on('keyup', this._onKU.bind(this));
        on('mousedown', this._onMD.bind(this));
        on('mouseup', this._onMU.bind(this));
        on('mousemove', this._onMM.bind(this));
        on('mouseleave', () => { this.inWindow = false; });
        on('wheel', this._onWh.bind(this), { passive: false });
        on('contextmenu', (e) => { if (this.cfg.preventDefault)
            e.preventDefault(); });
        on('blur', () => this.clear());
    }
    _onKD(e) {
        const k = e;
        if (k.repeat)
            return;
        this.state[k.code] = 3;
        this._preventKey(k);
    }
    _onKU(e) {
        const k = e;
        this.state[k.code] = (this.state[k.code] & 2) | 4;
    }
    _onMD(e) {
        const m = e;
        this.state[`Mouse${m.button}`] = 3;
        this._updateMousePos(m);
        if (this.cfg.preventDefault && m.cancelable)
            m.preventDefault();
    }
    _onMU(e) {
        const m = e;
        const k = `Mouse${m.button}`;
        this.state[k] = (this.state[k] & 2) | 4;
    }
    _onMM(e) {
        const m = e;
        this.inWindow = true;
        const px = this.screenX, py = this.screenY;
        this._updateMousePos(m);
        this.deltaX += this.screenX - px;
        this.deltaY += this.screenY - py;
    }
    _onWh(e) {
        const w = e;
        const d = Math.sign(w.deltaY);
        this.wheelDelta = w.ctrlKey ? 0 : d;
        if (d < 0)
            this.state['WheelUp'] = 3;
        if (d > 0)
            this.state['WheelDown'] = 3;
        if (this.cfg.preventDefault && w.cancelable)
            w.preventDefault();
    }
    _updateMousePos(e) {
        const r = this.canvas.getBoundingClientRect();
        this.screenX = ((e.clientX - r.left) / r.width) * this.canvas.width;
        this.screenY = ((e.clientY - r.top) / r.height) * this.canvas.height;
    }
    _preventKey(e) {
        if (!this.cfg.preventDefault || !e.cancelable)
            return;
        if (e.ctrlKey || e.metaKey || e.altKey)
            return;
        const el = e.target;
        if (el?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(el?.tagName ?? ''))
            return;
        const printable = typeof e.key === 'string' && e.key.length === 1;
        if (printable || this.cfg.preventKeys.includes(e.code))
            e.preventDefault();
    }
}
//# sourceMappingURL=InputManager.js.map