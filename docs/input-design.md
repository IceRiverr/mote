1. 四大引擎输入系统架构对比
1.1 架构分层模型
┌──────────┬───────────────┬──────────────────┬──────────┬───────────────┐
│          │  Unity (New)  │  Unreal (EIS)    │ LittleJS │  Mote (v2)    │
├──────────┼───────────────┼──────────────────┼──────────┼───────────────┤
│ 抽象层   │ InputAction   │ InputAction DA   │    ─     │ InputAction   │
│ (逻辑)   │ "Jump"        │ IA_Jump          │          │ "Jump"        │
├──────────┼───────────────┼──────────────────┼──────────┼───────────────┤
│ 映射层   │ ActionMap     │ MappingContext   │    ─     │ ActionMap     │
│ (绑定)   │ + Binding     │ + Key Mapping    │          │ + Binding     │
├──────────┼───────────────┼──────────────────┼──────────┼───────────────┤
│ 处理层   │ Processor     │ Modifier         │    ─     │ (预留)        │
│ (修饰)   │ + Interaction │ + Trigger        │          │               │
├──────────┼───────────────┼──────────────────┼──────────┼───────────────┤
│ 硬件层   │ Device/Control│ Subsystem        │ DOM event│ DOM event     │
│ (原始)   │               │                  │ 直接处理  │ + 抽象封装    │
└──────────┴───────────────┴──────────────────┴──────────┴───────────────┘
Mote v2 取 Unity/UE 的抽象层和映射层（Action + ActionMap），但底层保留 LittleJS 的零 GC 位域核心，不引入 Processor/Modifier 管线——对轻量 2D 引擎而言那是过度工程。

---
1.2 Unity New Input System
核心概念：
概念
说明
InputAction
逻辑动作（如 "Jump"），与具体按键完全解耦
Binding
物理输入 → Action 的连接（如 <Keyboard>/space → Jump）
ActionMap
Action 集合（如 "Gameplay" / "UI"），可整体启停
Interaction
输入模式识别器（Hold、Tap、MultiTap、SlowTap）
Processor
值处理管线（Invert、DeadZone、Normalize、Scale）
ControlScheme
设备方案（"Keyboard+Mouse" / "Gamepad"），自动切换绑定子集
回调生命周期：
Disabled → Waiting → Started → Performed → Canceled
                         ↑                    │
                         └────────────────────┘
值类型：
- Button：离散触发，不做初始状态检查
- Value：持续输出，自动消歧（多设备只取最活跃的一个）
- PassThrough：所有绑定 Control 的变化都透传
代码示例：
// Action + Binding 分离
var moveAction = new InputAction("move", binding: "<Gamepad>/leftStick");
moveAction.AddCompositeBinding("Dpad")
    .With("Up", "<Keyboard>/w")
    .With("Down", "<Keyboard>/s")
    .With("Left", "<Keyboard>/a")
    .With("Right", "<Keyboard>/d");

// 回调模式
moveAction.performed += ctx => Move(ctx.ReadValue<Vector2>());

// 轮询模式
void Update() {
    var dir = moveAction.ReadValue<Vector2>();
    transform.position += dir * speed * Time.deltaTime;
}
核心优势在于 Composite Binding——WASD 四个键自动合成 Vector2 输出，游戏代码只看到方向向量[Actions | Input System].

---
1.3 Unreal Engine Enhanced Input System
核心概念：
概念
说明
InputAction (IA)
Data Asset，定义值类型（Bool/Axis1D/Axis2D/Axis3D）+ 默认 Trigger/Modifier
InputMappingContext (IMC)
Data Asset，将 IA 绑定到具体按键，可运行时增删
Trigger
激活条件（Down/Pressed/Released/Hold/HoldAndRelease/Tap/Pulse/Combo/Chorded）
Modifier
值变换管线（DeadZone/Negate/Swizzle/Scalar/FOVScaling/ResponseCurve）
EnhancedInputSubsystem
运行时管理器，控制 IMC 优先级堆栈
回调阶段：
Started → Triggered (每 tick) → Completed
    ↓ (条件不满足)
Canceled
- Started：输入刚开始（首次按下）
- Triggered：条件持续满足（每 tick 触发）
- Completed：输入完成（释放、或 Hold 时间达标）
- Canceled：中途取消（Hold 未达标就释放）
关键特性：IMC 可以运行时动态压栈/弹栈，高优先级 IMC 可以消费输入阻止低优先级[Enhanced Input: What you need to know].
// 绑定回调
void AMyCharacter::SetupInput(UEnhancedInputComponent* Input) {
    Input->BindAction(IA_Move, ETriggerEvent::Triggered, this, &AMyCharacter::OnMove);
    Input->BindAction(IA_Jump, ETriggerEvent::Started,   this, &AMyCharacter::OnJump);
}

// 运行时上下文切换
void AMyController::EnterVehicle() {
    Subsystem->RemoveMappingContext(IMC_OnFoot);
    Subsystem->AddMappingContext(IMC_Vehicle, /*Priority=*/ 1);
}

---
1.4 LittleJS
极简主义——没有 Action 抽象层，直接查硬件状态：
DOM keydown/keyup → 位域写入 inputData[device][key]
                     ↓
游戏代码直接查询 → keyIsDown("ArrowUp")
                     ↓
帧结束 → state &= 1（清 pressed/released）
特点
说明
零抽象层
没有 "Action" 概念，代码直接引用 "KeyW"
3-bit 位域
isDown(1) + wasPressed(2) + wasReleased(4)
WASD 映射
keydown 时同步写 ArrowUp
统一设备数组
键盘/鼠标/手柄共享查询 API

---
2. 九维对比矩阵
维度
Unity New Input
UE Enhanced Input
LittleJS
Mote v1
Mote v2
Action 抽象
✅ InputAction
✅ InputAction DA
❌ 无
❌ 无
✅
绑定映射
✅ Binding + Composite
✅ IMC Data Asset
❌ 硬编码
❌ 硬编码
✅
上下文切换
✅ ActionMap 启停
✅ IMC 压栈弹栈
❌
❌
✅
Axis2D 组合
✅ CompositeBinding
✅ Swizzle+Negate
❌
❌
✅
值处理管线
✅ Processor
✅ Modifier
❌
❌
❌ (不需要)
触发模式
✅ Interaction
✅ Trigger
❌
❌
❌ (不需要)
回调模型
回调为主
回调为主
轮询
轮询
轮询 (最适合游戏循环)
多设备
✅ ControlScheme
✅ IMC per platform
✅
❌
Phase 2
零 GC
❌ 有分配
❌ UObject 体系
✅
✅
✅

---
3. 设计决策：借鉴什么，不引入什么
从 Unity/UE 借鉴
概念
做法
Mote 应用
Action 解耦
游戏代码只引用 "Jump"，不引用 "Space"
引入 InputAction
ActionMap
"Gameplay"/"UI" 独立启停
引入 ActionMap
CompositeBinding
WASD 四键自动合成 Vector2
支持多套 composite
值类型
Action 声明输出 bool/vec2
ActionType enum
运行时切换
UE 的 IMC 压栈/弹栈
map.enable()/disable()
从 LittleJS 保留
概念
理由
3-bit 位域
零 GC、极简，Web 环境最优解
帧同步清理
endFrame() 的 &= 1 保证时序正确
智能 preventDefault
不破坏浏览器快捷键和表单输入
blur 全清
防止切标签后按键粘住
不引入
概念
理由
Interaction/Trigger 管线
Hold/Tap/Combo 上层游戏逻辑自己做
Processor/Modifier 管线
DeadZone 在手柄层处理即可
设备自动消歧
Web 2D 游戏不需要
Data Asset 序列化
Web 用 JSON/代码配置

---
4. 优化后的完整实现
4.1 类型定义
// src/input/types.ts

export const enum ActionType {
    Button,   // 布尔（按下/未按下）: Jump, Shoot
    Axis1D,   // 1D 浮点 (-1..1): Throttle
    Axis2D,   // 2D 向量: Move, Look
}

export interface CompositeAxis2D {
    up:    string;  // "KeyW" | "ArrowUp"
    down:  string;  // "KeyS" | "ArrowDown"
    left:  string;  // "KeyA" | "ArrowLeft"
    right: string;  // "KeyD" | "ArrowRight"
}

export interface ActionDef {
    type: ActionType;
    /** Button/Axis1D: 绑定列表，任一触发即可 */
    bindings?: string[];
    /** Axis2D: 组合绑定，可多套 (WASD + Arrows) */
    composites?: CompositeAxis2D[];
}
4.2 ActionState —— 查询对象
// src/input/ActionState.ts

export class ActionState {
    constructor(
        private mgr: InputManager,
        private def: ActionDef,
    ) {}

    // ── Button 查询 ──

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

    // ── Axis2D 查询 ──

    vec2(): { x: number; y: number } {
        if (!this.def.composites) return { x: 0, y: 0 };
        let x = 0, y = 0;
        for (const c of this.def.composites) {
            if (this.mgr.rawDown(c.right)) x =  1;
            if (this.mgr.rawDown(c.left))  x = -1;
            if (this.mgr.rawDown(c.up))    y =  1;
            if (this.mgr.rawDown(c.down))  y = -1;
        }
        // 对角线归一化 (Unity Composite 也这么做)
        if (x !== 0 && y !== 0) {
            const inv = 1 / Math.SQRT2;
            return { x: x * inv, y: y * inv };
        }
        return { x, y };
    }
}
4.3 ActionMap —— 上下文容器
// src/input/ActionMap.ts

export class ActionMap {
    readonly name: string;
    enabled = false;
    private actions = new Map<string, ActionState>();

    constructor(
        name: string,
        defs: Record<string, ActionDef>,
        mgr: InputManager,
    ) {
        this.name = name;
        for (const [k, def] of Object.entries(defs))
            this.actions.set(k, new ActionState(mgr, def));
    }

    action(name: string): ActionState {
        const a = this.actions.get(name);
        if (!a) throw new Error(
            `Action "${name}" not found in map "${this.name}"`);
        return a;
    }

    enable(): void  { this.enabled = true; }
    disable(): void { this.enabled = false; }
}
4.4 InputManager —— 核心
// src/input/InputManager.ts

export class InputManager {

    // ── LittleJS 3-bit 位域核心 ──
    private state: Record<string, number> = {};

    // ── 鼠标 ──
    screenX = 0;  screenY = 0;
    deltaX  = 0;  deltaY  = 0;
    wheelDelta = 0;
    inWindow = true;

    // ── ActionMap 注册表 ──
    private maps = new Map<string, ActionMap>();

    private config: { preventDefault: boolean; preventKeys: string[] };
    private canvas: HTMLCanvasElement;
    private handlers: [string, EventListener][] = [];

    constructor(canvas: HTMLCanvasElement, config?: {
        preventDefault?: boolean;
        preventDefaultKeys?: string[];
    }) {
        this.canvas = canvas;
        this.config = {
            preventDefault: config?.preventDefault ?? true,
            preventKeys: config?.preventDefaultKeys ?? [
                'ArrowUp','ArrowDown','ArrowLeft','ArrowRight',
                'Space','Tab','Backspace',
            ],
        };
        this.attachDOM();
    }

    // ── ActionMap 管理 ──

    addMap(map: ActionMap): void {
        this.maps.set(map.name, map);
    }

    map(name: string): ActionMap {
        const m = this.maps.get(name);
        if (!m) throw new Error(`ActionMap "${name}" not found`);
        return m;
    }

    /** 在所有已启用的 map 中查找 action */
    action(name: string): ActionState {
        for (const m of this.maps.values()) {
            if (!m.enabled) continue;
            try { return m.action(name); } catch {}
        }
        throw new Error(`Action "${name}" not in any enabled map`);
    }

    // ── 原始查询 (ActionState 内部调用) ──

    rawDown    (k: string): boolean { return !!(this.state[k] & 1); }
    rawPressed (k: string): boolean { return !!(this.state[k] & 2); }
    rawReleased(k: string): boolean { return !!(this.state[k] & 4); }

    // ── 帧生命周期 ──

    endFrame(): void {
        for (const k in this.state) this.state[k] &= 1;
        this.deltaX = this.deltaY = this.wheelDelta = 0;
    }

    clear(): void {
        this.state = {};
        this.deltaX = this.deltaY = this.wheelDelta = 0;
    }

    destroy(): void {
        for (const [e, fn] of this.handlers)
            document.removeEventListener(e, fn);
        this.handlers.length = 0;
    }

    // ── DOM 事件 ──

    private attachDOM(): void {
        const on = (e: string, fn: EventListener,
                    o?: AddEventListenerOptions) => {
            document.addEventListener(e, fn, o);
            this.handlers.push([e, fn]);
        };
        on('keydown',     this.onKD.bind(this));
        on('keyup',       this.onKU.bind(this));
        on('mousedown',   this.onMD.bind(this));
        on('mouseup',     this.onMU.bind(this));
        on('mousemove',   this.onMM.bind(this));
        on('mouseleave',  () => { this.inWindow = false; });
        on('wheel',       this.onWh.bind(this), { passive: false });
        on('contextmenu', e => {
            if (this.config.preventDefault) e.preventDefault(); });
        on('blur',        () => this.clear());
    }

    private onKD(e: Event): void {
        const k = e as KeyboardEvent;
        if (k.repeat) return;
        this.state[k.code] = 3;
        this.prevent(k);
    }

    private onKU(e: Event): void {
        const k = e as KeyboardEvent;
        this.state[k.code] = (this.state[k.code] & 2) | 4;
    }

    private onMD(e: Event): void {
        const m = e as MouseEvent;
        this.state['Mouse' + m.button] = 3;
        this.mouse(m);
        if (this.config.preventDefault && m.cancelable) m.preventDefault();
    }

    private onMU(e: Event): void {
        const m = e as MouseEvent;
        const k = 'Mouse' + m.button;
        this.state[k] = (this.state[k] & 2) | 4;
    }

    private onMM(e: Event): void {
        const m = e as MouseEvent;
        this.inWindow = true;
        const px = this.screenX, py = this.screenY;
        this.mouse(m);
        this.deltaX += this.screenX - px;
        this.deltaY += this.screenY - py;
    }

    private onWh(e: Event): void {
        const w = e as WheelEvent;
        const d = Math.sign(w.deltaY);
        this.wheelDelta = w.ctrlKey ? 0 : d;
        if (d < 0) this.state['WheelUp']   = 3;
        if (d > 0) this.state['WheelDown'] = 3;
        if (this.config.preventDefault && w.cancelable) w.preventDefault();
    }

    private mouse(e: MouseEvent): void {
        const r = this.canvas.getBoundingClientRect();
        this.screenX = ((e.clientX - r.left) / r.width)  * this.canvas.width;
        this.screenY = ((e.clientY - r.top)  / r.height) * this.canvas.height;
    }

    private prevent(e: KeyboardEvent): void {
        if (!this.config.preventDefault || !e.cancelable) return;
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const el = e.target as HTMLElement;
        if (el?.isContentEditable
            || 'INPUT TEXTAREA SELECT'.includes(el?.tagName)) return;
        const printable = typeof e.key === 'string' && e.key.length === 1;
        if (printable || this.config.preventKeys.includes(e.code))
            e.preventDefault();
    }
}

---
5. 使用示例
import { InputManager, ActionMap, ActionType } from './input';

const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const input = new InputManager(canvas);

// ── 定义 Gameplay ActionMap ──
const gameplay = new ActionMap('Gameplay', {
    Move: {
        type: ActionType.Axis2D,
        composites: [
            { up:'KeyW',    down:'KeyS',     left:'KeyA',     right:'KeyD'      },
            { up:'ArrowUp', down:'ArrowDown', left:'ArrowLeft', right:'ArrowRight' },
        ],
    },
    Jump:    { type: ActionType.Button, bindings: ['Space'] },
    Shoot:   { type: ActionType.Button, bindings: ['Mouse0', 'KeyJ'] },
    Pause:   { type: ActionType.Button, bindings: ['Escape'] },
    ZoomIn:  { type: ActionType.Button, bindings: ['WheelUp'] },
    ZoomOut: { type: ActionType.Button, bindings: ['WheelDown'] },
}, input);
gameplay.enable();

// ── 定义 UI ActionMap（打开菜单时启用）──
const ui = new ActionMap('UI', {
    Confirm:  { type: ActionType.Button, bindings: ['Enter', 'Space'] },
    Back:     { type: ActionType.Button, bindings: ['Escape'] },
    Navigate: {
        type: ActionType.Axis2D,
        composites: [
            { up:'ArrowUp', down:'ArrowDown', left:'ArrowLeft', right:'ArrowRight' },
        ],
    },
}, input);
// ui 默认 disabled

input.addMap(gameplay);
input.addMap(ui);

// ── 游戏循环 ──
function frame(): void {
    const move = input.action('Move').vec2();
    playerX += move.x * speed * dt;
    playerY += move.y * speed * dt;

    if (input.action('Jump').pressed)  player.jump();
    if (input.action('Shoot').pressed) player.shoot();

    if (input.action('Pause').pressed) {
        gameplay.disable();
        ui.enable();
        showPauseMenu();
    }

    // ... 渲染 ...
    input.endFrame();
    requestAnimationFrame(frame);
}

---
6. 优化前后总结
维度
v1 (LittleJS 直译)
v2 (Unity+UE 融合)
游戏代码写法
input.keyDown('Space')
input.action('Jump').pressed
改键影响范围
全局搜索替换
只改 ActionMap 定义
场景切换
无法处理
gameplay.disable(); ui.enable()
WASD + 方向键
内部魔法映射
显式 composite，清晰可读
鼠标/滚轮绑定
单独 API
统一 "Mouse0"/"WheelUp" 可绑 Action
底层性能
零 GC 位域
完全保留，零 GC 位域
代码量
~120 行
~250 行（值得的复杂度）
运行时开销
~0
~0（Map 查找忽略不计）
核心理念：Unity/UE 级的 Action 抽象 + LittleJS 级的零开销底层 = 最适合 Web 2D 游戏的输入系统。