# ECS + Plugin 体系重构计划

> **日期**: 2026-04-26  
> **目标**: 将现有 ECS 从 `World`-centric 演进为 `App` + `Plugin` 的 Bevy 风格架构  
> **约束**: 存储层不动、编辑器非 ECS 部分不动、现有游戏项目逐步迁移

---

## 1. 现状诊断

### 1.1 已有基础（无需从零造）

| 模块 | 当前状态 | 评价 |
|------|---------|------|
| `ComponentRegistry` | 字符串名 ↔ class Map，支持 `createByName`/`createInstance` | 可用，但缺数字 id |
| `World` | `Map<EntityId, Map<string, any>>` 存储，含 spawn/query/add/get | 存储层不动 |
| `Entity` | 胖句柄 (`EntityId + World` 引用) | 可用 |
| `QueryResult` | 支持 `for...of` 和 `.each()` | 可用 |
| `PrefabStore` | 支持 Prefab 注册 + 声明式 spawn | 可用 |
| `ResourceStore` | 字符串 key 的 `Map<string, any>` | 可用，API 需调整 |
| `EventBus` | 支持 emit/enqueue/on/off | 可用 |
| `Plugin` | 纯函数 `(world, options?) => void \| Promise<void>` | **需改形态** |

### 1.2 核心差距

1. **无 App 门面**：`World` 既管存储又管装配（`use` / `registerComponent` / `addSystem`），职责混乱。
2. **Plugin 形态弱**：纯函数无法承载 `name`/`dependencies`/`teardown`，无法做 HMR 回滚。
3. **无 Schedule 分层**：所有 system 在一个线性数组里，无法区分 Update / Render / FixedUpdate。
4. **Resource 按字符串 key**：和 Component 的 class-key 不一致，编辑器无法自动识别 Resource 类型。
5. **编辑器与 ECS 完全隔离**：编辑器有自己的 `Scene`/`Prefab` 数据层，viewport 未接入 ECS World。
6. **游戏项目 ECS 化程度不一**：`tiny-dungeon` 已用 ECS，`breakout`/`snake` 是纯 OOP。

---

## 2. 设计原则

1. **存储层不动**：`World` 的内部 `entityComponents: Map<EntityId, Map<string, any>>` 本次完全不碰。
2. ** facade 先行**：先搭 `App` + `Plugin` 门面，内部暂时透传调用 `World` 旧 API。
3. **向后兼容**：`tiny-dungeon` 等已有项目不能炸，提供兼容层或同步迁移。
4. **渐进式**：一个 Plugin 一个 Plugin 地迁，不一次性改完。
5. **编辑器隔离**：只动 viewport 的 ECS 接入，editor 的 `Scene`/`Inspector`/`Prefab` 数据层不动。

---

## 3. 目标 API 设计

### 3.1 App —— 装配门面

```ts
// core/app.ts
export class App {
  readonly world: World;
  private _currentPlugin?: string;
  private _plugins = new Map<string, Plugin>();
  private _systems: Array<{ name: string; fn: SystemFn; label: ScheduleLabel }> = [];
  private _schedules = new Map<ScheduleLabel, SystemFn[]>();

  constructor() {
    this.world = new World();
    // 初始化默认 schedule
    for (const label of Object.values(ScheduleLabel)) {
      this._schedules.set(label, []);
    }
  }

  /** 注册一个 Plugin */
  addPlugin(p: Plugin): this;
  /** 批量注册 */
  addPlugins(ps: Plugin[]): this;

  /** 注册组件（代理到 ComponentRegistry） */
  registerComponent<T>(name: string, ctor: ComponentClass<T>): this;

  /** 注册 Prefab */
  registerPrefab(id: string, prefab: Prefab): this;

  /** 添加系统到指定 Schedule */
  addSystems(label: ScheduleLabel, systems: System[]): this;

  /** 插入全局资源 */
  insertResource<T>(value: T): this;

  /** 启动 rAF 循环 */
  run(): void;

  /** 单帧更新（供外部 GameLoop 调用） */
  update(dt: number): void;
}
```

### 3.2 Plugin —— 对象形态

```ts
// core/plugin.ts
export interface Plugin {
  /** 全局唯一标识，用于依赖解析和 HMR */
  name: string;
  /** 依赖的其它 Plugin（App 会先装它们） */
  dependencies?: Plugin[];
  /** 构建：注册组件、系统、资源 */
  build(app: App): void | Promise<void>;
  /** 可选：卸载时清理 */
  teardown?(app: App): void;
}
```

### 3.3 ScheduleLabel —— 执行分层

```ts
// core/schedule.ts
export enum ScheduleLabel {
  Startup = 'Startup',       // 启动时跑一次
  First = 'First',           // 每帧最前
  PreUpdate = 'PreUpdate',   // 输入处理
  Update = 'Update',         // 游戏逻辑
  PostUpdate = 'PostUpdate', // 状态同步
  PreRender = 'PreRender',   // 相机更新
  Render = 'Render',         // 渲染提交
  Last = 'Last',             // 帧尾清理
}
```

### 3.4 System —— 声明式参数（本轮只做 API 形态）

```ts
// core/system.ts
export type SystemFn = (world: World, dt: number) => void;

export interface System {
  name: string;
  update: SystemFn;
}
```

本轮 **不实现** system 的读写集声明和自动并行调度——system 仍然直接拿到整个 `World`。这个留给后续升级。

### 3.5 Resource —— class-key（本轮只做 API 形态）

```ts
// core/resource.ts（App 层封装）
class App {
  insertResource<T>(value: T): this {
    this.world.resources.add(value.constructor.name, value);
    // 未来：改为按 class 做 key
    return this;
  }
}
```

本轮 Resource 内部仍用字符串 key，但对外暴露 `insertResource(value)` 的形态（按实例类型自动推断），为后续改 class-key 埋下兼容点。

---

## 4. 阶段拆解（4 个 Phase）

### Phase 1: 搭好 App + Plugin 门面（1-2 天）

**目标**：新建 `App` 类，让 `tiny-dungeon` 能用新 API 跑起来。

| # | 任务 | 文件 | 说明 |
|---|------|------|------|
| 1.1 | 新建 `ScheduleLabel` 枚举 | `core/schedule.ts` | 新建文件 |
| 1.2 | 新建 `Plugin` 接口 | `core/plugin.ts` | 新建文件 |
| 1.3 | 新建 `App` 类 | `core/app.ts` | 核心门面，内部调用 World 旧 API |
| 1.4 | `App` 实现 `addPlugin` / `addPlugins` | `core/app.ts` | 处理依赖展开 + `_currentPlugin` 记录 |
| 1.5 | `App` 实现 `registerComponent` | `core/app.ts` | 代理到 `world.registerComponent` |
| 1.6 | `App` 实现 `addSystems(label, systems)` | `core/app.ts` | 按 label 分组存到内部数组 |
| 1.7 | `App` 实现 `insertResource` | `core/app.ts` | 代理到 `world.addResource`（字符串 key） |
| 1.8 | `App` 实现 `update(dt)` | `core/app.ts` | 按 ScheduleLabel 顺序执行各 label 下的 system |
| 1.9 | `App` 实现 `run()` | `core/app.ts` | 内置 rAF 循环，或委托给 `GameLoop` |
| 1.10 | 导出更新 | `core/index.ts` | 导出 `App`, `Plugin`, `ScheduleLabel` |
| 1.11 | engine 总导出更新 | `engine/src/index.ts` | 确保外部能 `import { App, ScheduleLabel }` |

**Phase 1 完成标志**：
```ts
// 能用这套 API 跑通
const app = new App();
await app.addPlugins([RenderPlugin, PhysicsPlugin, GamePlugin]);
app.run();
```

### Phase 2: 逐个迁移现有 Engine Plugin（2-3 天）

**目标**：把 `packages/engine/src/plugins/` 下的所有 Plugin 从纯函数改写成 `Plugin` 对象。

#### 2.1 RenderPlugin

```ts
// 改写前
export async function RenderPlugin(world: World, options: RenderPluginOptions): Promise<void> { ... }

// 改写后
export const RenderPlugin: Plugin = {
  name: 'render',
  async build(app) {
    const options = app.getPluginOptions<RenderPluginOptions>('render');
    // ... 原逻辑，但把 world 换成 app.world
    app.registerComponent('Sprite', Sprite);
    app.registerComponent('Camera', Camera);
    app.registerComponent('SpriteAnimation', SpriteAnimation);
    app.addSystems(ScheduleLabel.PreRender, [spriteAnimationSystem]);
    app.addSystems(ScheduleLabel.Render, [spriteRenderSystem]);
    app.insertResource(renderer);
    app.insertResource(new Map<string, AnimationDef>()); // animations
  },
};
```

> **注意**：RenderPlugin 需要 canvas 等选项。方案：`App` 增加 `withOptions(pluginName, opts)` 方法，或在 `addPlugin` 时支持 `[Plugin, options]` 元组语法。

#### 2.2 InputPlugin

```ts
export const InputPlugin: Plugin = {
  name: 'input',
  build(app) {
    const canvas = /* 从 options 取 */;
    const input = new InputManager(canvas);
    app.insertResource(input);
    app.addSystems(ScheduleLabel.First, [inputUpdateSystem]);
  },
};
```

#### 2.3 PhysicsPlugin

```ts
export const PhysicsPlugin: Plugin = {
  name: 'physics',
  dependencies: [], // 不依赖 render
  build(app) {
    app.registerComponent('Transform', Transform);
    app.registerComponent('Velocity', Velocity);
    // ... 注册所有物理组件
    app.addSystems(ScheduleLabel.Update, [kinematicSystem, collisionDetectionSystem]);
  },
};
```

#### 2.4 AudioPlugin / TilemapPlugin

同理改写。

**兼容性策略**：
- 旧纯函数 Plugin 不删除，在 `plugins/index.ts` 里标记 `@deprecated`。
- 提供 `legacyPlugin(fn): Plugin` 适配器，让旧函数包装成新 `Plugin` 接口。
- `tiny-dungeon` 在 Phase 2 同步迁移。

### Phase 3: 编辑器 Viewport 接入 ECS（2-3 天）

**目标**：编辑器 viewport 能显示 ECS World 里的 entity（Sprite + Transform）。

#### 3.1 核心问题

编辑器当前 viewport 是 Canvas 2D + 自建数据层。要接入 ECS，需要：
1. 编辑器侧也 `new App()`（或共享一个 World 实例）
2. 用 **Canvas2D 后端**渲染 ECS component
3. 编辑器元数据（选中、层级）仍走现有数据层，viewport 只负责"预览"

#### 3.2 方案：EditorECSBridge

```ts
// editor/viewport/ecs-bridge.ts
export class EditorECSBridge {
  readonly app: App;
  private canvas: HTMLCanvasElement;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.app = new App();
    
    // 编辑器 viewport 只加载 core + 渲染（Canvas2D 后端）
    // 注意：这里用 Canvas2DRenderPlugin，不是 WebGPU
    this.app.addPlugins([
      CorePlugin,           // Transform, Name
      Canvas2DRenderPlugin, // 新写的 Canvas2D 后端
    ]);
  }

  /** 从 editor 的 Scene 数据同步到 ECS World */
  syncFromScene(scene: Scene): void {
    // 清空旧 world
    // 遍历 scene.entities，对每个 entity spawn + add component
  }

  /** 运行一帧渲染 */
  render(): void {
    this.app.update(0); // dt = 0 或固定值，编辑器不跑游戏逻辑
  }
}
```

#### 3.3 Canvas2DRenderPlugin

```ts
// engine/plugins/render-canvas2d/
// 这是一个简化版的渲染后端，只画 Sprite + Transform
export const Canvas2DRenderPlugin: Plugin = {
  name: 'render-canvas2d',
  dependencies: [/* 依赖 asset 加载 */],
  build(app) {
    app.addSystems(ScheduleLabel.Render, [canvas2DRenderSystem]);
  },
};
```

> **关键**：这个 Plugin 定义在 `engine` 包里，但**游戏 bundle 不引用它**（tree-shaking 剔除）。编辑器单独 import。

#### 3.4 与现有编辑器的集成点

在 `editor/editors/viewport/register.ts` 里：

```ts
// 现有 viewport 初始化逻辑中，增加 ECS 预览模式
const bridge = new EditorECSBridge(canvas);

// 当 editor 的 Scene 变化时，同步到 ECS
scene.subscribe(() => {
  bridge.syncFromScene(scene);
});

// viewport 的 rAF 循环
function tick() {
  bridge.render();
  requestAnimationFrame(tick);
}
```

#### 3.5 渐进策略

- **第一步**：viewport 只显示 Sprite + Transform（对应 editor 的 sprite 放置）
- **第二步**：支持 Tilemap 预览
- **第三步**：支持选中框 / gizmo（用 EditorPlugin 注册额外的 component + system）

### Phase 4: 游戏项目 ECS 化（持续进行，非阻塞）

#### 4.1 tiny-dungeon（已用 ECS）

在 Phase 2 同步迁移：

```ts
// tiny-dungeon/main.ts（目标形态）
const app = new App();
await app.addPlugins([
  [RenderPlugin, { canvas, width: 640, height: 480 }],
  [InputPlugin, { canvas }],
  PhysicsPlugin,
  GamePlugin,
]);
app.run();
```

`GamePlugin` 从纯函数改写成对象：

```ts
export const GamePlugin: Plugin = {
  name: 'game-tiny-dungeon',
  dependencies: [PhysicsPlugin],
  build(app) {
    app.registerComponent('PlayerTag', PlayerTag);
    app.registerComponent('EnemyAI', EnemyAI);
    // ...
    app.addSystems(ScheduleLabel.Update, [
      inputSystem,
      throwAttackSystem,
      weaponFlySystem,
      pickupSystem,
      cameraFollowSystem,
    ]);
    initGameWorld(app.world);
  },
};
```

#### 4.2 breakout / snake（纯 OOP）

**不强制迁移**。但提供迁移示例和文档，供未来参考。如果用户要求，可以逐个重构。

#### 4.3 gg02 / tiny-town

观察其当前架构，决定是否需要 ECS 化。

---

## 5. 文件变更映射

### 5.1 新增文件

```
packages/engine/src/core/
  ├── app.ts           ← App 门面（NEW）
  ├── plugin.ts        ← Plugin 接口（NEW）
  ├── schedule.ts      ← ScheduleLabel 枚举（NEW）
  └── system.ts        ← System 类型定义（NEW，从 types.ts 抽离）

packages/engine/src/plugins/render-canvas2d/
  ├── plugin.ts        ← Canvas2DRenderPlugin（NEW）
  ├── renderer.ts      ← Canvas2D 渲染实现（NEW）
  └── systems.ts       ← canvas2DRenderSystem（NEW）

packages/editor/src/viewport/
  ├── ecs-bridge.ts    ← EditorECSBridge（NEW）
```

### 5.2 修改文件

```
packages/engine/src/core/
  ├── index.ts         ← 导出 App, Plugin, ScheduleLabel
  ├── types.ts         ← 删除/迁移 System/Plugin 相关类型到独立文件
  └── world.ts         ← 保持不动（存储层不动）

packages/engine/src/plugins/
  ├── render/plugin.ts     ← 改写成 Plugin 对象
  ├── input.ts             ← 改写成 Plugin 对象
  ├── physics.ts           ← 改写成 Plugin 对象
  ├── audio.ts             ← 改写成 Plugin 对象
  ├── tilemap.ts           ← 改写成 Plugin 对象
  └── index.ts             ← 更新导出

packages/engine/src/index.ts    ← 更新导出

packages/editor/src/editors/viewport/register.ts  ← 接入 ECS Bridge

games/tiny-dungeon/main.ts      ← 改用 App API
games/tiny-dungeon/src/systems.ts  ← GamePlugin 改对象
```

### 5.3 保留不动（核心约束）

```
packages/engine/src/core/
  ├── component.ts     ← ComponentRegistry 不动（后续可考虑加数字 id）
  ├── world.ts         ← 存储层完全不动
  ├── query.ts         ← QueryResult 不动
  ├── entity.ts        ← Entity 不动
  ├── resource.ts      ← ResourceStore 不动
  ├── prefab.ts        ← PrefabStore 不动
  ├── event.ts         ← EventBus 不动
  └── GameLoop.ts      ← 可选：App.run() 内部使用

packages/editor/src/   ← 除 viewport 外全部不动
  ├── data/
  ├── editors/inspector/
  ├── editors/scene-tree/
  └── ...
```

---

## 6. 兼容性策略

### 6.1 旧纯函数 Plugin 的兼容层

```ts
// core/plugin.ts
export function legacyPlugin(
  name: string,
  fn: (world: World, options?: any) => void | Promise<void>,
): Plugin {
  return {
    name,
    async build(app) {
      await fn(app.world, /* options 从哪来？需设计 */);
    },
  };
}
```

> 问题：旧函数需要 `options`（如 RenderPlugin 的 canvas）。方案：`App` 的 `addPlugin` 支持 `[Plugin, options]` 元组，但旧函数不是 Plugin 对象。解决办法：Phase 1 暂时保留 `world.use(fn, opts)` 的调用方式在 `App` 上，标记为 deprecated。

### 6.2 更务实的兼容方案

不在 `App` 上兼容旧函数。而是：
1. 新建 `App` 体系
2. 把旧纯函数在原地**原地改写**成 `Plugin` 对象（同一文件，改写法）
3. 同时提供 `legacy/` 目录保留旧版（一周内删除）
4. `tiny-dungeon` 同步改

这样最干净，没有兼容债。

---

## 7. 关键设计决策记录

### 7.1 为什么 App.update(dt) 而不是 App.run() 内置 rAF

因为现有 `GameLoop` 已经处理了 rAF + dt 计算 + 上下限截断。`App.run()` 可以简单地：

```ts
run(): void {
  const loop = new GameLoop(60);
  loop.onUpdate = (dt) => this.update(dt);
  loop.start();
}
```

但外部也可以直接调 `app.update(dt)`，保持灵活性。

### 7.2 为什么 Schedule 本轮不实现 DAG 调度

- 当前 system 数量少（< 20 个），线性执行足够
- DAG 调度需要 system 声明读写集，改动能动面太大
- 先分层（Update / Render）就能解决 90% 的顺序问题

### 7.3 为什么 Canvas2DRenderPlugin 放在 engine 包而不是 editor 包

- 它是一个"渲染后端"，和 WebGPU/WebGL2 后端属于同一抽象层
- 未来其他工具（关卡编辑器、预览器）也可能需要它
- editor 包只负责"怎么调用"（ECS Bridge），不负责"怎么渲染"

### 7.4 ComponentRegistry 的数字 id

本轮**不强制加**。但建议 Phase 1 时给 `ComponentRegistry` 预埋：

```ts
// component.ts（最小改动）
let nextId = 0;

register<T>(cls: ComponentClass<T>, name?: string): void {
  // ...
  (cls as any).__componentId = nextId++;
  // ...
}
```

这样以后换存储层时，component 已经有 id 可用，无需再改注册逻辑。

---

## 8. 风险与回滚策略

| 风险 | 概率 | 影响 | 缓解措施 |
|------|------|------|---------|
| App 门面设计不当，后续改 API | 中 | 中 | Phase 1 保持内部简单，API 表面尽量贴近 Bevy 约定 |
| tiny-dungeon 迁移后 bug | 中 | 高 | 迁移后完整跑一遍 gameplay，保留旧代码分支一周 |
| Canvas2DRenderPlugin 实现复杂 | 低 | 中 | 先只支持 Sprite + Transform，不碰 shader/effect |
| editor viewport 双数据源冲突 | 中 | 高 | EditorECSBridge 明确只读预览，不写回 editor 数据层 |
| breakout/snake 用户要求 ECS 化 | 低 | 低 | 提供文档和示例，不强推 |

**回滚**：每个 Phase 都是一个独立 commit。如果 Phase 2 出问题，可回滚到 Phase 1，`App` 门面仍可用，只是 Plugin 暂时用旧写法。

---

## 9. 附录：迁移代码对照

### 9.1 Plugin 定义对照

```ts
// ========== 旧写法 ==========
export function PhysicsPlugin(world: World): void {
  world.registerComponent(Transform, 'Transform');
  world.registerComponent(Velocity, 'Velocity');
  world.addSystem(kinematicSystem);
  world.addSystem(collisionDetectionSystem);
}

// ========== 新写法 ==========
export const PhysicsPlugin: Plugin = {
  name: 'physics',
  build(app) {
    app.registerComponent('Transform', Transform);
    app.registerComponent('Velocity', Velocity);
    app.addSystems(ScheduleLabel.Update, [
      kinematicSystem,
      collisionDetectionSystem,
    ]);
  },
};
```

### 9.2 main.ts 对照

```ts
// ========== 旧写法 ==========
const world = new World();
await world.use(
  [RenderPlugin, { canvas, width: 640, height: 480 }],
  PhysicsPlugin,
  GamePlugin,
);
const loop = new GameLoop(60);
loop.onUpdate = (dt) => world.update(dt);
loop.start();

// ========== 新写法 ==========
const app = new App();
await app.addPlugins([
  [RenderPlugin, { canvas, width: 640, height: 480 }],
  PhysicsPlugin,
  GamePlugin,
]);
app.run(); // 或 app.update(dt) 由外部驱动
```

### 9.3 System 调用对照（不变）

```ts
// System 函数签名不变
function kinematicSystem(world: World, dt: number): void {
  for (const eid of world.query(Transform, Velocity)) {
    const t = world.get(eid, Transform);
    const v = world.get(eid, Velocity);
    t.x += v.vx * dt;
    t.y += v.vy * dt;
  }
}
```

---

## 10. 下一步行动

1. **确认本计划**：用户 review 后确认或调整
2. **Phase 1 启动**：新建 `app.ts` / `plugin.ts` / `schedule.ts`
3. **验证**：用 `tiny-dungeon` 作为首个迁移目标，验证 App 门面可用
4. **Phase 2-4**：按计划逐个推进
