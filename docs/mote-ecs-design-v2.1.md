
现在从 engine，editor，plugin，game，以及 component 和 system 的关系，来画一个系统图，包含 ecs 的各个部分。

engine 和 plugin 和 game 中都可能会添加新的 component 和 system。

先分析一下这个需求和我的问题，先用语言来给出这些模块的定义，以及他们之间的练习。最后再给出系统图。

=

先把需求翻译清楚，再给定义，再给关系，最后落到系统图。这个顺序很重要，因为你提的问题里藏了一个**很容易踩的架构陷阱**——"engine / plugin / game 都能注册 component 和 system"——如果不先把层次讲清楚，图画出来会是一团糨糊。

## 一、需求分析：你真正在问什么

拆成三个子问题：

1. **纵向分层**：engine / plugin / game 是什么关系？谁依赖谁？谁能调用谁？
2. **editor 的位置**：它是和 engine 平级、还是 engine 的子系统、还是独立应用？
3. **扩展点**：三层都能添加 component 和 system，那 ECS 内核（Registry / World / Schedule）到底归谁管？

这里有一个隐含的关键判断——**ECS 内核必须是"所有人都依赖、但不属于任何一层业务"的独立模块**。如果把它塞进 engine，会导致 plugin 想用 ECS 就必须依赖整个 engine（包括渲染、输入等），耦合爆炸。Bevy 把 `bevy_ecs` 作为独立 crate 就是这个道理。

所以我给出的分层会比你问题里的三层多一层——把 ECS 内核单独拎出来，叫 **core**。engine / plugin / game 都是 core 的消费者。

## 二、模块定义

### 1. core（ECS 内核）

**定义**：不包含任何业务语义的 ECS 数据结构和调度机制。

**内容**：

- `ComponentRegistry`：类型身份管理
- `World` / `Storage`：实体与组件存储
- `Query`：类型匹配查询
- `Schedule` / `ScheduleLabel`：执行顺序调度
- `System` 接口：系统的形状定义
- `Plugin` 接口：模块自注册入口的形状定义
- `App`：门面，串联以上所有
- `Resource` / `Event`：全局状态和消息

**特点**：

- **零业务依赖**。不知道什么是 Transform、什么是 Sprite、什么是 WebGPU
- **所有上层模块的唯一共同依赖**
- 对应 Bevy 的 `bevy_ecs` + `bevy_app` crate

**类比**：C++ STL 里的 `<vector>`——提供容器和算法，不关心你存什么业务对象。

### 2. engine（引擎层）

**定义**：基于 core 构建的、**通用**的游戏能力集合。不针对任何具体游戏。

**内容**（每个子域都是一个内置 Plugin）：

- `CorePlugin`：Transform、Parent、Name 等基础 component
- `TimePlugin`：Time 资源、FixedUpdate 调度
- `InputPlugin`：键鼠/触摸输入
- `RenderPlugin`：WebGPU 渲染管线、Camera、Sprite
- `AssetPlugin`：资源加载
- `PhysicsPlugin`（可选）：通用物理
- `AudioPlugin`（可选）：音频

**特点**：

- **消费 core 的扩展点来注册自己的 component 和 system**
- 对 plugin / game 透明：它们不知道 engine 内部怎么实现，只知道"用了 `RenderPlugin` 后就有 `Sprite` 可用"
- 通用、可复用（对微尘来说，同一套 engine 可以跑多个不同玩法的原型）

**类比**：Unreal 的 Engine 模块、Unity 的内置组件。

### 3. plugin（第三方/可选扩展层）

**定义**：**独立于具体游戏**但**不属于 engine 核心**的功能模块。

**内容举例**：

- 粒子系统 Plugin
- 状态机 Plugin
- 行为树 Plugin
- 网络同步 Plugin
- Debug 工具 Plugin（FPS 计数、gizmo 绘制）

**特点**：

- 依赖 core，**可能依赖 engine 的某些 Plugin**（比如粒子插件依赖 RenderPlugin）
- 独立于 game 的具体业务
- 可以按需启用/禁用
- **这一层是 engine 和 game 之间的可插拔缓冲带**

**和 engine 的区别**：engine 是"几乎所有 2D 游戏都要的"，plugin 是"有些游戏要、有些不要"。界限有主观性，但有一个硬判据——**是否跨项目复用**。会被多个项目复用的、但又不够通用到进 engine 的，放 plugin。

**类比**：npm 生态里的第三方库。

### 4. game（具体游戏层）

**定义**：一个具体游戏项目的所有业务逻辑。

**内容**：

- 玩法相关的 component（Player、Enemy、DashState、SkillCooldown）
- 玩法相关的 system（PlayerInputSystem、EnemyAI、CombatResolve）
- 关卡数据、Prefab 资源
- 最终的 `main.ts` —— **这里是唯一装配整个 App 的地方**

**特点**：

- 同时依赖 core、engine、（可选的）plugin
- 是消费者，不被任何人依赖
- **只有 game 层有权决定"装哪些 Plugin"**

**类比**：用 Unity 做的某个具体游戏项目。

### 5. editor（编辑器）

**定义**：一个**并行于 game 的独立应用**，用来可视化编辑 game 的数据（prefab、场景）。

**内容**：

- Inspector UI
- 场景编辑器、层级面板
- Prefab 序列化/反序列化
- Schema 解析器（从 TS AST 读 JSDoc）
- Vite 插件（构建时生成 schema.json）
- **自己也是一个 App**，装配和 game 几乎一样的 Plugin 列表

**关键特点 —— 这是最容易误解的一点**：

- editor **不是 engine 的一部分**，也**不是 game 的一部分**
- editor 和 game **都是 core + engine 的消费者**，两个并列的应用
- editor 需要"能识别 game 里定义的 component"来画 Inspector，所以 editor 会 import game 的 Plugin 列表（但只读 schema，不执行业务 system）

**两种 editor 部署形态**（决定架构差异）：

- **嵌入式**（Unity 风格）：editor 和 game 在同一进程，运行时切换。优点是状态实时同步，缺点是 bundle 变大
- **分离式**（独立网页）：editor 是独立 web 应用，产出 prefab JSON，game 运行时加载。对微尘这种部署到 iceriver.cc 的项目，**分离式更合适**——game bundle 保持极简，editor 单独部署

下面的图按分离式画。

## 三、关系梳理

先说清楚几种关系的类型，然后逐一分析：

| 关系类型 | 含义 |
|---|---|
| **依赖**（import） | 谁 import 谁 |
| **扩展**（register） | 谁向 core 的 Registry 注册自己的 component/system |
| **装配**（addPlugin） | 谁最终决定使用哪些模块 |
| **消费**（query/schema） | 谁读 core 里的数据 |

### 依赖关系（谁 import 谁）

```
core     ← 无依赖
engine   ← core
plugin   ← core, engine (可选)
game     ← core, engine, plugin
editor   ← core, engine, plugin, game (只读 schema)
```

**单向依赖链**，底层不知道上层存在。

### 扩展关系（谁注册 component / system）

这正是你问题的核心——三层都会扩展，但**扩展方式完全一致**：通过实现一个 Plugin，在 `build(app)` 里调 `app.registerComponent(...)` 和 `app.addSystems(...)`。

```
engine 层：CorePlugin 注册 Transform
           RenderPlugin 注册 Sprite、Camera
           InputPlugin 注册 InputState

plugin 层：ParticlePlugin 注册 ParticleEmitter
           StateMachinePlugin 注册 StateMachine

game 层：  CombatPlugin 注册 Stats, Hitbox
           MovementPlugin 注册 DashState
```

**三层的 Plugin 对 core 来说没有身份差异**，core 只认 Plugin 接口。这个对称性是架构清晰的关键——任何人想扩展 ECS，都用同一种语法，没有特权接口。

### 装配关系（谁决定启用哪些 Plugin）

**只有 game 层的 main.ts 有这个权力**：

```ts
// game/main.ts
new App()
  .addPlugins([
    // engine
    CorePlugin, TimePlugin, InputPlugin, RenderPlugin, AssetPlugin,
    // plugin
    ParticlePlugin, StateMachinePlugin,
    // game
    PlayerPlugin, CombatPlugin, MovementPlugin, EnemyPlugin,
  ])
  .run();
```

engine 和 plugin 层**不允许自己装配自己**——它们只提供 Plugin 定义，启用权在 game。这保证了：

- 一个 engine 模块可以服务多个 game
- game 可以替换掉 engine 的某个默认 Plugin（比如用自己的 RenderPlugin）

editor 也有自己的装配，通常和 game 的 Plugin 列表**相同**（保证编辑所见即所得），但多加一个 `EditorPlugin` 提供 Inspector / Gizmo。

### 消费关系（谁读 core 里的什么）

```
game 的 system     →  读/写 World 里的 component 实例（运行时热路径）
editor 的 UI       →  读 Registry 里的 schema（画 Inspector）
editor 的序列化    →  读 Registry 里的 schema + World 里的实例（导出 prefab）
game 的加载逻辑    →  读 prefab JSON + Registry 的 ctor（反序列化）
```

schema 和 ctor 挂在**同一个 Registry**上，用 class 做 key 对齐——这就是为什么上一轮强调 `ComponentRegistry` 要同时承载这两种元信息。

### 一个完整的时序（game 启动）

```
1. main.ts 执行
2. new App() —— core 创建 Registry / World / Schedules
3. app.addPlugins([...]) —— 按顺序执行每个 Plugin.build(app)
4. Plugin.build 内部调用 app.registerComponent(...) 写入 Registry
5. Plugin.build 内部调用 app.addSystems(...) 写入 Schedule
6. app.run() —— 启动 requestAnimationFrame 循环
7. 每帧：Schedule 按顺序执行 System，System 通过 World.query 读写 Component
```

## 四、系统图

用三张图从不同视角看，比一张巨图更清楚。

### 图 1：分层架构（依赖方向）

```
┌──────────────────────────────────────────────────────────────────┐
│                          DEPLOYMENT                              │
│                                                                  │
│   ┌─────────────────────┐      ┌─────────────────────┐           │
│   │   GAME (iceriver.cc)│      │   EDITOR (独立应用)  │           │
│   │   main.ts + App     │      │   main.ts + App      │          │
│   │   + prefab.json ────┼──加载─┼─ 产出 ─ prefab.json │           │
│   └──────────┬──────────┘      └──────────┬──────────┘           │
└──────────────┼────────────────────────────┼─────────────────────┘
               │ imports                    │ imports (含 schema)
               ▼                            ▼
┌──────────────────────────────────────────────────────────────────┐
│                      GAME LAYER (业务)                           │
│   PlayerPlugin  CombatPlugin  MovementPlugin  EnemyPlugin        │
│   ├─ Components: Stats, Hitbox, DashState, Enemy, ...            │
│   └─ Systems:    playerInput, damage, applyDash, enemyAI, ...    │
└──────────────┬───────────────────────────────────────────────────┘
               │ imports
               ▼
┌──────────────────────────────────────────────────────────────────┐
│                  PLUGIN LAYER (可选扩展)                         │
│   ParticlePlugin  StateMachinePlugin  DebugPlugin  NetworkPlugin │
└──────────────┬───────────────────────────────────────────────────┘
               │ imports
               ▼
┌──────────────────────────────────────────────────────────────────┐
│                     ENGINE LAYER (通用能力)                      │
│   CorePlugin  TimePlugin  InputPlugin  RenderPlugin  AssetPlugin │
│   ├─ Components: Transform, Parent, Sprite, Camera, ...          │
│   └─ Systems:    updateTransforms, renderSprites, ...            │
└──────────────┬───────────────────────────────────────────────────┘
               │ imports
               ▼
┌──────────────────────────────────────────────────────────────────┐
│                       CORE LAYER (ECS 内核)                      │
│   App   World   ComponentRegistry   Schedule   Query             │
│   Plugin 接口   System 接口   Resource   Event                   │
└──────────────────────────────────────────────────────────────────┘
```

**读法**：箭头方向 = import 方向。上层可以 import 下层，下层不知道上层存在。engine / plugin / game 三层都向 core 的 Registry / Schedule 注册东西，但 core 本身不知道它们。

### 图 2：Plugin 扩展机制（横向对称性）

```
                        ┌─────────────────────────┐
                        │    game/main.ts         │
                        │  app.addPlugins([...])  │
                        └────────────┬────────────┘
                                     │ 装配（唯一决策点）
                                     ▼
            ┌────────────────────────────────────────────────┐
            │               App (core)                       │
            │   ┌──────────────────────────────────────┐     │
            │   │  ComponentRegistry                   │     │
            │   │    Stats → {id:0, ctor, schema?}     │     │
            │   │    Sprite → {id:1, ctor, schema?}    │     │
            │   │    ParticleEmitter → {...}           │     │
            │   └──────────────────────────────────────┘     │
            │   ┌──────────────────────────────────────┐     │
            │   │  Schedule[Update]                    │     │
            │   │    [renderSprites, applyDash, ...]   │     │
            │   └──────────────────────────────────────┘     │
            └────────▲─────────▲─────────▲─────────▲─────────┘
                     │         │         │         │
         build(app)──┘         │         │         │
                               │         │         │
         ┌─────────────────────┘         │         │
         │                               │         │
         │            ┌──────────────────┘         │
         │            │                            │
         │            │              ┌─────────────┘
         │            │              │
  ┌──────┴─────┐ ┌────┴─────┐ ┌──────┴──────┐ ┌──────────────┐
  │ RenderPlugin│ │ParticlePlug│ │CombatPlugin │ │EditorPlugin │
  │  (engine)   │ │  (plugin) │ │   (game)    │ │  (editor)   │
  │             │ │           │ │             │ │             │
  │ register:   │ │ register: │ │ register:   │ │ register:   │
  │  Sprite     │ │  Particle │ │  Stats      │ │  GizmoTag   │
  │  Camera     │ │  Emitter  │ │  Hitbox     │ │             │
  │ addSystems: │ │addSystems:│ │ addSystems: │ │ addSystems: │
  │  render     │ │  emit     │ │  damage     │ │  drawGizmos │
  └─────────────┘ └───────────┘ └─────────────┘ └─────────────┘

           ↑ 对 core 来说，这四个 Plugin 没有任何身份差别 ↑
           ↑ 它们都通过同一个 Plugin 接口扩展 App         ↑
```

**关键洞察**：engine / plugin / game / editor 四层的 Plugin 在 core 眼里是**完全对称**的。这种对称性让架构可以无限扩展——新来的贡献者想加功能，只需要知道"写一个 Plugin"，不用分辨自己该写在哪一层。

### 图 3：运行时数据流（每一帧发生了什么）

```
    ┌────────────────── rAF 循环 ──────────────────┐
    │                                              │
    ▼                                              │
  App.run()                                        │
    │                                              │
    │ 对每个 Schedule 按 label 顺序跑              │
    ▼                                              │
  Schedule[Update]                                 │
    │                                              │
    │ 按拓扑排序好的 system 列表                   │
    ▼                                              │
  ┌───────────────────────────────────────┐        │
  │  for (sys of ordered_systems) {       │        │
  │    sys.run({ world, res, events });   │        │
  │  }                                    │        │
  └───────────────────────────────────────┘        │
    │                                              │
    │ system 内部：                                │
    ▼                                              │
  world.query(DashState, Velocity)                 │
    │                                              │
    │ 1. Registry.idOf(DashState) → 3              │
    │ 2. Registry.idOf(Velocity)  → 7              │
    │ 3. 从 storages[3] 和 storages[7] 取数据      │
    ▼                                              │
  ┌───────────────────────────────────────┐        │
  │  for ([entity, dash, vel] of query) { │        │
  │    if (dash.isDashing) vel.x *= 2;    │        │
  │  }                                    │        │
  └───────────────────────────────────────┘        │
    │                                              │
    └──────────────────────────────────────────────┘

                  ↓ 编辑器场景 ↓

  Editor Inspector 渲染流程（非运行时）:
  ┌──────────────────────────────────────────┐
  │ 1. 选中 entity                           │
  │ 2. 遍历 world 找到该 entity 的所有 comp  │
  │ 3. 对每个 comp 实例：                    │
  │    meta = Registry.getByCtor(inst.ctor)  │
  │    for (prop of meta.schema) {           │
  │      画一个输入框 (类型/min/max 来自 schema) │
  │      onChange → inst[prop.name] = value  │
  │    }                                     │
  └──────────────────────────────────────────┘
```

## 五、几个容易踩的边界问题

### Q1：plugin 层的 Plugin 依赖 engine 的 Plugin，怎么办？

举例：`ParticlePlugin` 需要 `RenderPlugin` 提供的渲染上下文。

处理：在 `Plugin.dependencies` 里声明：

```ts
export const ParticlePlugin: Plugin = {
  name: 'particle',
  dependencies: [RenderPlugin],   // App 会先装 Render
  build(app) { ... },
};
```

App 的 `addPlugin` 递归展开依赖并去重。

### Q2：game 想替换 engine 的默认 RenderPlugin，怎么办？

不添加默认的 RenderPlugin，自己写一个同名的 Plugin，在 main.ts 里用它。engine 不强制装配，装配权在 game。

### Q3：editor 怎么"知道" game 的 component？

editor 的 main.ts **import game 的 Plugin 列表**，像 game 一样 `addPlugins`，但：

- 用一个特殊的 `HeadlessRenderPlugin` 替换真正的 Render
- schema.json 在构建时生成（Vite 插件扫描所有 game + engine 的 component class）
- editor 启动时 `attachSchema` 灌入 Registry

### Q4：第三方 plugin 想提供自己的 component，但 editor 不认识？

如果 plugin 走标准 JSDoc 格式，Vite 插件扫描时会自动包进 schema.json，editor 自动支持。不需要 plugin 做任何 editor 集成——**JSDoc 是 plugin 和 editor 的契约**。

---

## 总结

最核心的几条原则回收一下：

1. **四层结构（core / engine / plugin / game）比你原本的三层更清晰**，因为 core 必须独立
2. **editor 是和 game 并列的消费者**，不是某一层的子系统
3. **三层的扩展方式完全对称**——都通过 Plugin.build 调同一套 App API，core 不区分谁是谁
4. **装配权收束在 game.main.ts**，上游模块只声明能力、不决定使用
5. **ComponentRegistry 是连接"运行时存储"和"编辑器元信息"的枢纽**，用 class 当 key 把两边对齐
6. **JSDoc → schema.json 是构建时契约**，保证 editor 能识别任意层定义的 component，零运行时开销
