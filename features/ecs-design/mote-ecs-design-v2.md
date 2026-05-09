
===

问：
bevy 的 ecs 设计中，如果 component 和 system 被分散到不同的子模块中，最终的游戏使用时，是怎么知道用哪个的

答：

在 Bevy 里这个问题的答案其实很"去中心化"——**没有一个全局注册表去"发现"散落在各模块里的 component 和 system**，一切都靠 `App` 这个构建器显式注册。下面把机制拆开说。

## 核心思路：Plugin 是模块的"自注册入口"

Bevy 的约定是：每个子模块对外暴露一个 `Plugin`，在 `build(&mut App)` 里**把自己拥有的 system、resource、event、schedule 全部注册到 `App` 上**。component 则不需要注册（见下一节）。

```rust
// physics/mod.rs
pub struct PhysicsPlugin;
impl Plugin for PhysicsPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(Update, (apply_gravity, integrate_velocity))
           .insert_resource(Gravity(9.8))
           .add_event::<CollisionEvent>();
    }
}

// enemy/mod.rs
pub struct EnemyPlugin;
impl Plugin for EnemyPlugin {
    fn build(&self, app: &mut App) {
        app.add_systems(Update, (spawn_enemy, enemy_ai))
           .add_systems(FixedUpdate, enemy_physics);
    }
}
```

到了 `main.rs`，你**显式把想用的 plugin 装上去**：

```rust
fn main() {
    App::new()
        .add_plugins(DefaultPlugins)
        .add_plugins((PhysicsPlugin, EnemyPlugin, PlayerPlugin))
        .run();
}
```

所以答案是：**"用哪个"是你在组装 `App` 时亲自决定的**，不是框架自动扫描出来的。没被 `add_plugins`/`add_systems` 的代码，哪怕写在仓库里也不会跑。

## Component 为什么不需要"注册"

ECS 的存储是**按类型**的。`World` 内部用 `TypeId` 作为键，第一次 `commands.spawn(Foo)` 或 `query<&Foo>` 时自动建立对应的 `ComponentId` 和 archetype。所以：

- 你在 A 模块里 `pub struct Health(f32);`
- B 模块 `use crate::a::Health;` 然后写 `Query<&Health>`
- 只要类型路径能被 Rust 编译器解析，ECS 运行时就能匹配上，**不存在"找不到 component"的问题**

需要显式 `app.register_type::<Foo>()` 的情况只有反射相关场景（编辑器、序列化、场景文件），不是运行时查询的必要条件。

## System 之间怎么"知道对方"

跨模块的 system 协作靠三个机制，都不依赖"发现"：

| 机制 | 作用 | 跨模块体现 |
|---|---|---|
| **Query 按类型匹配** | system 声明要什么 component 组合，调度器按类型筛 entity | A 模块 spawn 的 `Enemy`，B 模块 `Query<&Enemy>` 能直接查到 |
| **Event** | 解耦的消息总线 | A 模块 `EventWriter<Hit>`，B 模块 `EventReader<Hit>`，只要都 `add_event::<Hit>` 过一次 |
| **SystemSet / before / after** | 显式声明执行顺序 | `.add_systems(Update, ai.before(PhysicsSet::Step))` |

## 执行顺序的裁决者：Schedule

所有被注册的 system 会进入对应的 `Schedule`（`Startup` / `Update` / `FixedUpdate` / …）。Bevy 的调度器在运行时做两件事：

1. **根据 system 的参数签名**（`Query`、`Res`、`ResMut`、`Commands`…）推断读写集
2. **根据读写冲突 + 你声明的 ordering 约束**，算出一个可并行执行的 DAG

所以即便 `apply_gravity` 和 `enemy_ai` 来自两个互不知情的 crate，只要它们都访问 `&mut Transform`，调度器就会自动把它们串行化；不冲突就并行。**这是"协调"，不是"发现"。**

## 一个容易踩的坑

既然一切靠显式注册，那**忘记 `add_plugins` 的后果就是"代码在、功能没"**——编译通过、游戏里什么都不发生。调试时可以：

- 打开 `bevy::log` 把 `wgpu`/`bevy_ecs` 调到 debug
- 用 `bevy-inspector-egui` 看当前 `World` 里到底有哪些 entity / component / resource
- 或者干脆在 plugin 的 `build` 里 `info!("PhysicsPlugin loaded")` 做个烟雾测试

---

一句话总结：**Component 靠 Rust 类型系统自动对齐，System 靠 Plugin 在 `App` 构建阶段被你主动挂上去，运行顺序靠 Schedule 的调度器根据读写集和 ordering 约束算出来**。整个过程没有"自动发现"，只有"显式组装 + 按类型匹配"。

===

如果要用 typescript 来做一套类似的东西，应该怎么做呢？

TypeScript 做 ECS 和 Rust 有一个根本差异要先摊开说：**TS 运行时没有真正的类型系统**，`TypeId` 不存在，泛型在运行时被擦除。所以 Bevy 那套"按类型自动匹配"要自己造一个"类型身份"机制。下面给一套可落地的设计，兼顾你在 WebGPU / 微尘 项目里的使用场景。

## 1. 给每个 Component 一个运行时身份

最干净的做法是用 **class + 静态 id**，让 class 本身充当"类型标签":

```ts
// core/component.ts
let nextComponentId = 0;
export type ComponentId = number;

export abstract class Component {
  static readonly componentId: ComponentId;
}

export function defineComponent<T extends new (...a: any[]) => any>(ctor: T): T {
  (ctor as any).componentId = nextComponentId++;
  return ctor;
}

// gameplay/health.ts
export class Health {
  constructor(public value: number) {}
}
defineComponent(Health);
```

也可以用装饰器（`@component`）或 `Symbol` 做 id，本质都是**给构造函数挂一个全局唯一标识**。有了它，存储层就能按 id 建 archetype，和 Rust 的 `ComponentId` 等价。

> 小技巧：id 用连续整数而不是字符串，后面做 bitmask / SparseSet 时性能差一个数量级。微尘这种 WebGPU 项目对每帧 query 次数敏感，值得在这里抠。

## 2. Entity + 存储：Archetype 或 SparseSet 二选一

- **Archetype（Bevy / flecs 走这条）**：相同 component 组合的 entity 聚在一张表里，迭代是连续内存、cache 友好，但增删 component 要搬家。
- **SparseSet（EnTT 走这条）**：每个 component 一张稀疏表，增删 O(1)，迭代略慢但更简单。

TS 起步阶段推荐 **SparseSet**，实现量小、心智负担低：

```ts
export class ComponentStorage<T> {
  private dense: T[] = [];
  private entities: Entity[] = [];
  private sparse: Int32Array = new Int32Array(1024).fill(-1);

  insert(e: Entity, c: T) { /* ... */ }
  get(e: Entity): T | undefined { /* ... */ }
  remove(e: Entity): void { /* ... */ }
  iter(): Iterable<[Entity, T]> { /* ... */ }
}

export class World {
  private storages = new Map<ComponentId, ComponentStorage<any>>();
  spawn(): Entity { /* ... */ }
  insert<T>(e: Entity, ctor: new (...a: any[]) => T, value: T) { /* ... */ }
  query<Cs extends (new (...a:any[]) => any)[]>(...ctors: Cs): Query<Cs> { /* ... */ }
}
```

`query(Position, Velocity)` 内部：取两张 storage，以较小的那张为驱动，对每个 entity 检查另一张是否存在。

## 3. System：纯函数 + 声明式参数

Bevy 的 system 之所以能自动并行，是因为参数类型暴露了读写集。TS 做不到自动推断，但可以**让开发者显式声明**：

```ts
export interface SystemParams {
  query?: QueryDescriptor[];     // [{ components: [Position, Velocity], access: 'readwrite' }]
  res?: ResourceDescriptor[];    // [{ type: Time, access: 'read' }]
  commands?: boolean;
  events?: EventDescriptor[];
}

export interface System {
  name: string;
  params: SystemParams;
  run(ctx: SystemContext): void;
}

export const applyGravity: System = {
  name: 'applyGravity',
  params: { query: [{ components: [Velocity], access: 'readwrite' }],
            res: [{ type: Gravity, access: 'read' }] },
  run({ queries, res }) {
    const g = res.get(Gravity).value;
    for (const [_, vel] of queries[0]) vel.y -= g * 0.016;
  },
};
```

显式声明看起来啰嗦，但换来了两个关键能力：**调度器能算冲突**、**能在 dev 模式下 assert system 没偷偷访问未声明的资源**。

## 4. Schedule：DAG 调度器

参照 Bevy 的 `Update` / `FixedUpdate` / `Startup` 分层：

```ts
export enum ScheduleLabel { Startup, PreUpdate, Update, PostUpdate, Render }

class Schedule {
  private systems: System[] = [];
  private order: System[] = [];  // 拓扑排序结果

  add(sys: System, opts?: { before?: string[]; after?: string[]; set?: string }) {}

  build() {
    // 1. 根据 before/after/set 构造依赖图
    // 2. 根据读写集检测冲突（同一资源的 rw vs r，两个 rw…）
    // 3. 拓扑排序 → 分层 → 每层内部可并行
  }

  run(world: World) {
    for (const sys of this.order) sys.run(makeCtx(world, sys.params));
  }
}
```

浏览器里真正的并行要靠 Worker，代价很高，一般 ECS 游戏单线程就够了——**调度器的价值不在并行，而在"确定性的执行顺序"**。微尘这种 2D 引擎，先把"正确的顺序"保证好，并行留到 profiling 出瓶颈再说。

## 5. Plugin：子模块的自注册入口

这里和 Bevy 几乎可以一一对应：

```ts
export interface Plugin {
  name: string;
  build(app: App): void;
}

export const PhysicsPlugin: Plugin = {
  name: 'physics',
  build(app) {
    app.insertResource(new Gravity(9.8))
       .addEvent<CollisionEvent>('Collision')
       .addSystems(ScheduleLabel.Update, [applyGravity, integrateVelocity]);
  },
};

export const EnemyPlugin: Plugin = {
  name: 'enemy',
  build(app) {
    app.addSystems(ScheduleLabel.Update, [spawnEnemy, enemyAi]);
  },
};
```

`App` 是门面：

```ts
class App {
  world = new World();
  schedules = new Map<ScheduleLabel, Schedule>();

  addPlugin(p: Plugin) { p.build(this); return this; }
  addPlugins(ps: Plugin[]) { ps.forEach(p => this.addPlugin(this)); return this; }
  addSystems(label: ScheduleLabel, systems: System[]) { /* ... */ return this; }
  insertResource<T>(r: T) { /* ... */ return this; }
  run() { /* loop: tick each schedule */ }
}

// main.ts
new App()
  .addPlugins([CorePlugin, RenderPlugin, PhysicsPlugin, EnemyPlugin])
  .run();
```

回到你上一个问题的核心结论——**"用哪个" 还是在这里显式装配，没有自动发现**。TS 的 ESM 同样不会执行未被 import 的模块，所以行为和 Rust 一致：没 `addPlugin` 的代码就是死代码。

## 6. Event / Resource 的补齐

- **Resource**：全局单例，用 `Map<Ctor, instance>` 存，和 component 一样按类型取。
- **Event**：双缓冲队列，每帧 swap 一次；`EventWriter<T>` 写入 current，`EventReader<T>` 从 last 读，保证"上一帧写、这一帧读"的确定性。

## 7. 针对 WebGPU / 微尘 的几个落地建议

既然你的技术栈是 WebGPU + TS，有几个和 Bevy 不完全一样的权衡点：

- **Transform / 渲染数据对齐 GPU buffer**：component 里别乱放 `class` 包装，热数据用 `Float32Array` 视图存在一块大 buffer 里，archetype 直接映射到 storage buffer，省一次 CPU→GPU 拷贝。
- **Change detection**：Bevy 的 `Changed<T>` 在 GPU 场景很有用，比如 Transform 改了才重算 world matrix。实现上给每个 storage 加一个 `tick: u32` 数组，system 记录自己上次跑的 tick。
- **Schedule 和渲染帧的耦合**：`PreRender` / `Render` / `PostRender` 这几个 label 最好独立出来，和 `requestAnimationFrame` 对齐；`FixedUpdate` 用 accumulator 跑物理。
- **热重载**：TS 的优势是可以用 Vite HMR。Plugin 设计时让每个 plugin 可 `teardown`（移除自己注册的 system / resource），HMR 时重新 `build`，开发体验会比 Rust 好很多。

## 现成方案作参考

如果你不想完全从零造，可以先看两个 TS ECS 的源码，吸收它们的存储实现再按自己需求改：

- [bitecs](https://github.com/NateTheGreatt/bitECS)：极端性能向，TypedArray + bitmask，API 偏函数式，和 Bevy 风格差异较大但跑得快
- [Miniplex](https://github.com/hmans/miniplex)：偏"对象友好"，API 舒适，适合快速原型

我个人的建议是：**存储层借鉴 bitecs 的 TypedArray 思路（为了 WebGPU 对齐），API 层借鉴 Bevy 的 Plugin / Schedule / Query（为了架构清晰）**，两边各取所长。

---

一句话总结：TS 版 Bevy 的关键是**手动补上 Rust 编译器白送的三样东西**——运行时类型身份（component id）、读写集声明（system 参数元数据）、模块装配入口（Plugin + App），剩下的架构思想几乎可以原样搬过来。

===

推荐方案：JSDoc 解析 + 轻量注册（PlayCanvas 思路改良）
// ============ Component 定义（唯一真相）============

class Stats {
  /** 最大生命值 @min 1 @max 9999 @category Combat */
  maxHp: number = 100;

  /** 当前生命值 @min 0 */
  hp: number = 100;

  /** 移动速度 (像素/秒) @min 0 @step 10 @category Movement */
  moveSpeed: number = 200;

  /** 元素亲和 @enum fire,ice,lightning,earth,wind,water */
  elementalAffinity: string = 'fire';
}

class DashState {
  /** 冲刺速度 @min 0 @group Dash */
  dashSpeed: number = 600;

  /** 冲刺时长(秒) @step 0.01 @group Dash */
  dashDuration: number = 0.18;

  /** 启用无敌帧 @group IFrame */
  iFrames: boolean = true;

  /** 无敌帧时长(秒) @step 0.01 @group IFrame @visibleWhen iFrames */
  iFrameDuration: number = 0.15;

  // —— 无 JSDoc 的字段 = 运行时字段，编辑器/序列化自动忽略 ——
  isDashing = false;
  dashElapsed = 0;
  dashCooldownRemaining = 0;
}
// ============ 组件注册（一行代码）============

// 手动注册，但极其轻量
ComponentRegistry
  .register('Stats', Stats, { icon: '❤️', category: 'Combat' })
  .register('DashState', DashState, { icon: '💨', category: 'Movement' })
  .register('Hitbox', Hitbox, { icon: '⚔️', category: 'Combat' });
// ============ 编辑器侧：解析 JSDoc 提取元信息 ============

import ts from 'typescript';  // 编辑器构建时依赖，不打入运行时

class ComponentSchemaParser {
  /** 解析一个 Component 类文件，提取所有字段的元信息 */
  parse(sourceFile: ts.SourceFile, className: string): PropMeta[] {
    const classDecl = this.findClass(sourceFile, className);
    const props: PropMeta[] = [];

    for (const member of classDecl.members) {
      if (!ts.isPropertyDeclaration(member)) continue;

      const name = member.name.getText();
      const jsDoc = this.getJSDoc(member);

      // 没有 JSDoc → 运行时字段，跳过
      if (!jsDoc) continue;

      props.push({
        name,
        label: jsDoc.description,        // JSDoc 正文 = 显示名
        type: this.inferType(member),     // 从 TS 类型推断
        default: this.evalInitializer(member),
        ...this.parseJSDocTags(jsDoc),    // @min, @max, @step, @enum, @group...
      });
    }
    return props;
  }

  /** 解析 JSDoc 自定义 tag */
  private parseJSDocTags(jsDoc: JSDocComment): Partial<PropMeta> {
    const meta: any = {};
    for (const tag of jsDoc.tags) {
      switch (tag.name) {
        case 'min':   meta.min = parseFloat(tag.value); break;
        case 'max':   meta.max = parseFloat(tag.value); break;
        case 'step':  meta.step = parseFloat(tag.value); break;
        case 'enum':  meta.options = tag.value.split(','); meta.type = 'enum'; break;
        case 'group': meta.group = tag.value; break;
        case 'category': meta.category = tag.value; break;
        case 'asset': meta.type = 'asset'; meta.assetType = tag.value; break;
        case 'visibleWhen': meta.visibleWhen = tag.value; break;
        // ...
      }
    }
    return meta;
  }
}
为什么这个方案更适合你
考量	装饰器方案	JSDoc 方案
装饰器依赖	依赖 experimentalDecorators 或 TC39 Stage 3	零依赖
运行时开销	有（reflect-metadata、装饰器执行）	零（JSDoc 编译后消失）
打包体积	增大（装饰器代码打入 bundle）	不影响（元信息只在编辑器侧解析）
编辑器能力	完整	完整（AST 解析同样强大）
IDE 支持	好（装饰器有高亮）	好（JSDoc 有 tooltip 显示）
迁移风险	高（装饰器标准还在变）	无（JSDoc 是稳定标准）
TS 类型安全	强	强（类型直接从类定义推断）
序列化规则	有 @Prop 的字段	有 JSDoc 的字段
WebGPU 场景	打包体积敏感	更友好
序列化保持不变
class PrefabSerializer {
  /** 只序列化有 JSDoc 的字段（=编辑器可见字段） */
  static serialize(compInstance: any, schema: PropMeta[]): Record<string, any> {
    const json: Record<string, any> = {};
    for (const prop of schema) {
      const value = compInstance[prop.name];
      if (value !== prop.default) {  // 差异化存储
        json[prop.name] = value;
      }
    }
    return json;
  }

  static deserialize(compName: string, json: Record<string, any>): any {
    const CompClass = ComponentRegistry.getClass(compName);
    const instance = new CompClass();     // 默认值自动填充
    const schema = SchemaCache.get(compName);

    for (const prop of schema) {
      if (prop.name in json) {
        (instance as any)[prop.name] = json[prop.name];
      }
    }
    return instance;
  }
}

这是旧的一个设计，怎么将这些融合呢，我希望 component 是一个 class

==

把旧方案和 Bevy-style ECS 融合的关键是想清楚：**JSDoc 方案解决的是"编辑器元信息 + 序列化"，Bevy 方案解决的是"运行时存储 + 调度"，两者作用在同一个 class 上但几乎不冲突**。下面给一个能把两套东西焊在一起的设计。

## 1. 认清两套元信息的边界

| 维度 | 由谁生成 | 何时生成 | 运行时是否存在 |
|---|---|---|---|
| `componentId`（类型身份） | 运行时 `register()` 调用 | 启动时 | ✅ 必须 |
| `schema`（字段元信息） | 编辑器侧 TS AST 解析 | 构建时 / 编辑器加载时 | ⚠️ 可选 |
| 存储结构（SparseSet / Archetype） | 运行时 `World` | 首次 insert 时 | ✅ 必须 |
| 序列化规则 | 来自 schema | 保存 prefab 时 | ⚠️ 看部署形态 |

**结论**：class 保持纯净，`ComponentRegistry` 挂运行时身份，`SchemaCache` 挂编辑器元信息，两者用**同一个 class 作为 key** 就能对齐，互不污染。

## 2. Component class 本身不变

你现有的写法已经是"唯一真相源"，不需要改：

```ts
export class Stats {
  /** 最大生命值 @min 1 @max 9999 @category Combat */
  maxHp: number = 100;

  /** 当前生命值 @min 0 */
  hp: number = 100;

  /** 移动速度 @min 0 @step 10 @category Movement */
  moveSpeed: number = 200;
}

export class DashState {
  /** 冲刺速度 @min 0 @group Dash */
  dashSpeed: number = 600;

  // 无 JSDoc → 运行时字段
  isDashing = false;
  dashElapsed = 0;
}
```

关键原则：**不加装饰器、不继承基类**。这是旧方案最珍贵的性质，融合时要保住。

## 3. 把 ComponentRegistry 升级为"身份 + schema"双索引

旧 registry 只存 `name → class`，新版加一个 `componentId` 和 schema 槽：

```ts
// core/component-registry.ts
export type ComponentId = number;
export type ComponentCtor<T = any> = new (...a: any[]) => T;

interface ComponentMeta {
  id: ComponentId;
  name: string;
  ctor: ComponentCtor;
  icon?: string;
  category?: string;
  schema?: PropMeta[];   // 编辑器侧填充，运行时可为 undefined
}

class ComponentRegistryImpl {
  private byId: ComponentMeta[] = [];
  private byCtor = new Map<ComponentCtor, ComponentMeta>();
  private byName = new Map<string, ComponentMeta>();
  private nextId = 0;

  register<T>(name: string, ctor: ComponentCtor<T>, opts: { icon?: string; category?: string } = {}) {
    if (this.byCtor.has(ctor)) return this;   // 幂等，便于 HMR
    const meta: ComponentMeta = { id: this.nextId++, name, ctor, ...opts };
    this.byId[meta.id] = meta;
    this.byCtor.set(ctor, meta);
    this.byName.set(name, meta);
    return this;
  }

  idOf(ctor: ComponentCtor): ComponentId {
    const m = this.byCtor.get(ctor);
    if (!m) throw new Error(`Component not registered: ${ctor.name}`);
    return m.id;
  }

  getByName(name: string) { return this.byName.get(name); }
  getById(id: ComponentId) { return this.byId[id]; }

  /** 编辑器侧在构建时把 AST 解析结果灌进来 */
  attachSchema(name: string, schema: PropMeta[]) {
    const m = this.byName.get(name);
    if (m) m.schema = schema;
  }
}

export const ComponentRegistry = new ComponentRegistryImpl();
```

注册方式和你原来的 API 一模一样：

```ts
ComponentRegistry
  .register('Stats', Stats, { icon: '❤️', category: 'Combat' })
  .register('DashState', DashState, { icon: '💨', category: 'Movement' });
```

## 4. World / Storage 只认 `componentId`

ECS 存储层完全不需要知道 schema 的存在，只吃 class 和 id：

```ts
export class World {
  private storages: ComponentStorage<any>[] = [];

  private storage<T>(ctor: ComponentCtor<T>): ComponentStorage<T> {
    const id = ComponentRegistry.idOf(ctor);
    return this.storages[id] ??= new ComponentStorage<T>();
  }

  spawn(): Entity { /* ... */ }

  insert<T>(e: Entity, value: T) {
    // 用实例的 constructor 反查 id —— 无需传 ctor
    this.storage(value.constructor as ComponentCtor<T>).insert(e, value);
  }

  get<T>(e: Entity, ctor: ComponentCtor<T>): T | undefined {
    return this.storage(ctor).get(e);
  }

  query<Cs extends ComponentCtor[]>(...ctors: Cs): Query<Cs> {
    return new Query(ctors.map(c => this.storage(c)));
  }
}
```

这里有一条微妙但重要的约束：**insert 必须传"已注册 class 的实例"**，否则 `idOf` 会抛错。这正好替你把"忘记注册"的 bug 在第一时间炸出来，比 Bevy 还严格（Rust 编译器会放行未注册但类型存在的 component，TS 这里反而更安全）。

## 5. Schema 的"构建时生成 + 运行时懒加载"

编辑器方案的 AST 解析放在 **Vite 插件 / 构建脚本**里跑一次，产物是一份 JSON，运行时按需加载：

```ts
// build-time: vite-plugin-component-schema.ts
export default function schemaPlugin(): Plugin {
  return {
    name: 'component-schema',
    buildStart() {
      const parser = new ComponentSchemaParser();
      const allSchemas: Record<string, PropMeta[]> = {};
      for (const file of globComponentFiles()) {
        const sf = ts.createSourceFile(...);
        for (const cls of findExportedClasses(sf)) {
          allSchemas[cls.name] = parser.parse(sf, cls.name);
        }
      }
      fs.writeFileSync('dist/component-schemas.json', JSON.stringify(allSchemas));
    },
  };
}
```

运行时分两种形态：

- **游戏运行时**：根本不 import schema，零开销，和 Bevy 一致
- **编辑器运行时**：启动时加载 JSON 并 `ComponentRegistry.attachSchema(name, schema)`，检视器读 `registry.getByName(x).schema` 画 UI

这样旧方案"JSDoc 编译后消失、不影响 bundle"的优点**完全保留**。

## 6. 序列化：用 schema 决定可见字段，没 schema 时退化

你原来的 `PrefabSerializer` 只需要改一行——把 schema 来源换成 registry：

```ts
export class PrefabSerializer {
  static serialize(inst: any): { type: string; data: Record<string, any> } | null {
    const meta = ComponentRegistry.byCtor.get(inst.constructor);
    if (!meta) return null;

    const schema = meta.schema;
    const data: Record<string, any> = {};

    if (schema) {
      // 编辑器 / 保存流程：按 schema 做差异化存储
      const defaults = new meta.ctor();
      for (const prop of schema) {
        if (inst[prop.name] !== defaults[prop.name]) data[prop.name] = inst[prop.name];
      }
    } else {
      // 纯运行时场景（例如网络同步）：退化为全量浅拷贝 or 抛错
      Object.assign(data, inst);
    }
    return { type: meta.name, data };
  }

  static deserialize(json: { type: string; data: Record<string, any> }) {
    const meta = ComponentRegistry.getByName(json.type);
    if (!meta) throw new Error(`Unknown component: ${json.type}`);
    const inst = new meta.ctor();        // class 的默认值先就位
    Object.assign(inst, json.data);      // 再覆盖 prefab 里的差异字段
    return inst;
  }
}
```

注意 `new meta.ctor()` 这一步——**这是为什么要坚持 class、不用 interface/plain object 的核心理由**：class 的字段默认值是"可执行的初始化逻辑"，反序列化时零成本地给你补齐所有运行时字段（`isDashing = false` 这种无 JSDoc 的字段会自动回到默认值，不用在 JSON 里存）。

## 7. System 端：Query 按 class 拿，和 Bevy 风格对齐

Component 是纯 class 带来一个好处——system 的 query 语法非常接近 Bevy：

```ts
export const applyDash: System = {
  name: 'applyDash',
  params: {
    query: [{ components: [DashState, Velocity], access: 'readwrite' }],
    res: [{ type: Time, access: 'read' }],
  },
  run({ world, res }) {
    const dt = res.get(Time).delta;
    for (const [_, dash, vel] of world.query(DashState, Velocity)) {
      if (!dash.isDashing) continue;
      dash.dashElapsed += dt;
      // ...
    }
  },
};
```

`world.query(DashState, Velocity)` 内部靠 `ComponentRegistry.idOf` 把 class 映射成 id，再去 storage 层取数据。**system 代码里完全看不到 id 的存在**，写起来和 Bevy 的 `Query<(&mut DashState, &mut Velocity)>` 几乎等价。

## 8. Plugin 层把注册动作收束进来

为了避免"class 写了但忘了注册"这种 bug，把 component 注册也放进 Plugin：

```ts
export const CombatPlugin: Plugin = {
  name: 'combat',
  build(app) {
    app.registerComponent('Stats', Stats, { icon: '❤️', category: 'Combat' })
       .registerComponent('Hitbox', Hitbox, { icon: '⚔️', category: 'Combat' })
       .addSystems(ScheduleLabel.Update, [damageSystem, deathSystem]);
  },
};

export const MovementPlugin: Plugin = {
  name: 'movement',
  build(app) {
    app.registerComponent('DashState', DashState, { icon: '💨', category: 'Movement' })
       .addSystems(ScheduleLabel.Update, [applyDash, integrateVelocity]);
  },
};
```

这样你上一轮问题的结论继续成立：**"用哪个组件、用哪个 system" 完全由 `main.ts` 里 `addPlugins` 的列表决定**，没挂上的模块自动消失，对微尘这种需要多套玩法原型并存的项目非常友好。

## 9. 融合后的整体分层

```
┌─────────────────────────────────────────────────────┐
│ main.ts                                             │
│   App.addPlugins([CombatPlugin, MovementPlugin...]) │
└──────────────────────┬──────────────────────────────┘
                       │
         ┌─────────────┴──────────────┐
         ▼                            ▼
┌────────────────┐          ┌────────────────────┐
│ Plugin.build() │          │ Editor Bootstrap   │
│  - register    │          │  - load schema.json│
│    Component   │          │  - attachSchema()  │
│  - addSystems  │          └────────────────────┘
└────────┬───────┘                    │
         │                            │
         ▼                            ▼
┌──────────────────────────────────────────────┐
│          ComponentRegistry (单例)             │
│   name / id / ctor / schema?                 │
└────────┬──────────────────────────┬──────────┘
         │                          │
         ▼                          ▼
┌──────────────────┐        ┌───────────────────┐
│ World / Storage  │        │ PrefabSerializer  │
│ (运行时，按 id)   │        │ Inspector UI      │
└──────────────────┘        └───────────────────┘
```

## 10. 要不要完全抛弃装饰器

建议**彻底不用**。你旧方案选 JSDoc 的理由（零运行时开销、标准稳定、bundle 友好）在这套融合设计里依然全部成立。装饰器唯一的诱惑是"能自动调用 `ComponentRegistry.register`"，但 Plugin.build 里手写 `registerComponent` 只多一行，换来的是：

- 注册时机完全可控（HMR 时可以 teardown 再 register）
- 能加运行时元数据（icon、category）而不污染 class
- 一眼看得出哪些 component 属于哪个 plugin

对一个架构敏感的引擎项目，这点代价完全值得。

---

一句话总结融合原则：**class 本体保持 JSDoc 方案的纯净度；`ComponentRegistry` 同时承载运行时 id 和编辑器 schema，用 class 当 key 把两边对齐；World 只消费 id、编辑器只消费 schema，互不干扰；注册动作收进 Plugin，和 system 装配用同一套装配语义**。这样旧方案的编辑器体验 + Bevy 的架构清晰度就焊在一起了。

===

ComponentRegistry 位于哪里呢，具体是怎么设计的，以及如果用 plugin 体系，怎么结合

这个问题分三层回答：**ComponentRegistry 物理上放在哪（代码位置 + 生命周期归属）**、**具体怎么设计（数据结构 + API）**、**和 Plugin 如何编织在一起**。

## 一、ComponentRegistry 放在哪

这里有一个架构决策点，直接影响后面能不能跑多实例、能不能 HMR。两种方案：

### 方案 A：全局单例（简单，推荐起步用）

```
src/core/
├── component-registry.ts   ← 导出一个模块级单例
├── world.ts
├── schedule.ts
├── plugin.ts
└── app.ts
```

```ts
// core/component-registry.ts
export const ComponentRegistry = new ComponentRegistryImpl();
```

优点是调用方不用传参，`world.insert(new Stats())` 内部直接 `ComponentRegistry.idOf(...)`。

缺点是**一个进程只能有一个 registry**——如果你想在同一页面跑两个独立的 `App`（比如编辑器预览窗口 + 游戏主窗口），会互相污染。

### 方案 B：挂在 App 实例上（干净，适合正式架构）

```
src/core/
├── component-registry.ts   ← 只导出 class，不导出实例
├── world.ts                ← World 持有 registry 引用
├── app.ts                  ← App 创建并持有 registry
```

```ts
class App {
  readonly registry = new ComponentRegistry();
  readonly world = new World(this.registry);
  readonly schedules = new Map<ScheduleLabel, Schedule>();
  // ...
}
```

优点是**每个 App 独立的 component 命名空间**，多实例、沙盒、测试都友好。

缺点是 `World` / `Storage` / `Serializer` 都要拿到 registry 引用，API 稍啰嗦。

### 我的建议

**从方案 A 起步，但 `ComponentRegistryImpl` 这个 class 必须先拆干净**——把实例和定义分开，等将来有多实例需求时，把 `export const ComponentRegistry` 换成 `app.registry` 即可，业务代码（Plugin、System）几乎不用改。

微尘作为 2D 引擎单页应用，方案 A 够用。编辑器如果是独立页面/独立 iframe 也不冲突。真遇到"一个页面跑两套世界"才升级方案 B。

---

## 二、ComponentRegistry 的具体设计

按职责拆成四件事：**身份分配**、**双向索引**、**schema 存储**、**生命周期钩子**。

```ts
// core/component-registry.ts
import type { PropMeta } from './schema-types';

export type ComponentId = number;
export type ComponentCtor<T = any> = new (...args: any[]) => T;

export interface ComponentRegisterOptions {
  icon?: string;
  category?: string;
  /** 来自哪个 plugin，用于 HMR / 卸载 */
  owner?: string;
}

export interface ComponentMeta<T = any> {
  id: ComponentId;
  name: string;
  ctor: ComponentCtor<T>;
  icon?: string;
  category?: string;
  owner?: string;
  schema?: PropMeta[];   // 编辑器侧填充；运行时可 undefined
}

export class ComponentRegistry {
  private _byId: ComponentMeta[] = [];
  private _byCtor = new Map<ComponentCtor, ComponentMeta>();
  private _byName = new Map<string, ComponentMeta>();
  private _nextId = 0;

  /** 监听：某个 component 被注册后，storage 可以提前建表 */
  private _onRegister = new Set<(m: ComponentMeta) => void>();

  register<T>(
    name: string,
    ctor: ComponentCtor<T>,
    opts: ComponentRegisterOptions = {},
  ): ComponentMeta<T> {
    // 幂等：同一 ctor 重复注册直接返回已有 meta（HMR 场景重要）
    const existed = this._byCtor.get(ctor);
    if (existed) return existed as ComponentMeta<T>;

    // 防名字冲突：不同 ctor 但同名 → 明确报错
    if (this._byName.has(name)) {
      throw new Error(
        `Component name conflict: "${name}" already registered by another class. ` +
        `Check if two modules define the same component name.`,
      );
    }

    const meta: ComponentMeta<T> = {
      id: this._nextId++,
      name,
      ctor,
      icon: opts.icon,
      category: opts.category,
      owner: opts.owner,
    };
    this._byId[meta.id] = meta;
    this._byCtor.set(ctor, meta);
    this._byName.set(name, meta);

    for (const cb of this._onRegister) cb(meta);
    return meta;
  }

  /** 运行时热点路径：按 ctor 拿 id。必须 O(1) */
  idOf(ctor: ComponentCtor): ComponentId {
    const m = this._byCtor.get(ctor);
    if (!m) {
      throw new Error(
        `Component not registered: ${ctor.name}. ` +
        `Did you forget to register it in a Plugin.build()?`,
      );
    }
    return m.id;
  }

  /** 同上，但不抛错 —— 给 storage 的冷路径用 */
  tryIdOf(ctor: ComponentCtor): ComponentId | undefined {
    return this._byCtor.get(ctor)?.id;
  }

  getById(id: ComponentId): ComponentMeta | undefined { return this._byId[id]; }
  getByName(name: string): ComponentMeta | undefined { return this._byName.get(name); }
  getByCtor(ctor: ComponentCtor): ComponentMeta | undefined { return this._byCtor.get(ctor); }

  /** 编辑器构建产物灌入 */
  attachSchema(name: string, schema: PropMeta[]): void {
    const m = this._byName.get(name);
    if (m) m.schema = schema;
  }

  /** 遍历：编辑器画 component 菜单时用 */
  all(): readonly ComponentMeta[] {
    return this._byId.filter(Boolean);
  }

  onRegister(cb: (m: ComponentMeta) => void): () => void {
    this._onRegister.add(cb);
    return () => this._onRegister.delete(cb);
  }

  /** HMR / Plugin 卸载：按 owner 批量移除 */
  unregisterByOwner(owner: string): void {
    for (const m of [...this._byId]) {
      if (m && m.owner === owner) {
        this._byCtor.delete(m.ctor);
        this._byName.delete(m.name);
        delete this._byId[m.id];
        // 注意：id 不回收（回收会破坏已有 storage 的索引）
      }
    }
  }
}

// 方案 A：模块级单例
export const componentRegistry = new ComponentRegistry();
```

几个设计要点单独拎出来说：

### 1. `id` 只增不减

`unregisterByOwner` 删除 meta 但不回收 id。因为 storage 以 id 为数组下标，回收 id 会让旧 storage 命中错误数据。代价是 id 会有空洞，但 u32 的空间够你挥霍。

### 2. `idOf` 是整个引擎的**热点函数**

每次 query、每次 insert 都会调用。用 `Map` 而不是 `Record<string, ...>` 是因为 class 可以直接做 key，避免字符串化；V8 对 `Map` 的 class 键有特化优化。

如果将来 profiling 发现这里是瓶颈，可以做一个更激进的方案——**在 `register` 时往 ctor 上偷偷挂一个非枚举属性**：

```ts
Object.defineProperty(ctor, '__cid', { value: meta.id, enumerable: false });
// 取 id:  (ctor as any).__cid
```

这会把 `Map.get` 变成属性查找，快 3-5 倍。但代价是污染了用户的 class，起步阶段不建议，留作优化项。

### 3. `onRegister` 钩子

这个是给 `World` / `Storage` 订阅的。比如 SparseSet 存储可以"注册即建表"，避免第一次 insert 时的冷启动抖动：

```ts
class World {
  constructor(private registry: ComponentRegistry) {
    registry.onRegister(m => {
      this.storages[m.id] = new ComponentStorage();
    });
  }
}
```

### 4. 名字冲突要显式报错

JS 生态里跨 npm 包极容易出现同名 component（两个库都叫 `Transform`）。registry 必须在注册时就把这种冲突拦下来，不然 prefab 反序列化会随机坏掉。

---

## 三、和 Plugin 体系的编织

Plugin 承担两个责任：**声明我有哪些 component/system** 和 **把它们注册到 App 上**。这里的关键是让 Plugin 成为"唯一的注册入口"，避免 component class 文件里到处散落 `register` 调用。

### 1. App 层提供语义化注册 API

```ts
// core/app.ts
export class App {
  readonly registry = componentRegistry;   // 方案 A 时共用全局单例
  readonly world = new World(this.registry);
  private schedules = new Map<ScheduleLabel, Schedule>();
  private plugins = new Map<string, Plugin>();
  private resources = new Map<ComponentCtor, any>();

  addPlugin(p: Plugin): this {
    if (this.plugins.has(p.name)) return this;  // 幂等
    this.plugins.set(p.name, p);
    p.build(this);
    return this;
  }

  addPlugins(ps: Plugin[]): this {
    for (const p of ps) this.addPlugin(p);
    return this;
  }

  registerComponent<T>(
    name: string,
    ctor: ComponentCtor<T>,
    opts: Omit<ComponentRegisterOptions, 'owner'> = {},
  ): this {
    // owner 由当前正在 build 的 plugin 自动填充
    const owner = this._currentPluginName;
    this.registry.register(name, ctor, { ...opts, owner });
    return this;
  }

  addSystems(label: ScheduleLabel, systems: System[]): this { /* ... */ return this; }
  insertResource<T>(ctor: ComponentCtor<T>, value: T): this { /* ... */ return this; }
  addEvent<T>(name: string): this { /* ... */ return this; }

  private _currentPluginName?: string;
}
```

为了让 `registerComponent` 自动知道 owner，在 `addPlugin` 里包一层：

```ts
addPlugin(p: Plugin): this {
  if (this.plugins.has(p.name)) return this;
  this.plugins.set(p.name, p);
  this._currentPluginName = p.name;
  try { p.build(this); } finally { this._currentPluginName = undefined; }
  return this;
}
```

### 2. Plugin 定义成纯数据 + build 函数

```ts
// core/plugin.ts
export interface Plugin {
  name: string;
  /** 可选依赖，App 会先装它们 */
  dependencies?: Plugin[];
  build(app: App): void;
  /** 可选：HMR 时回滚 */
  teardown?(app: App): void;
}
```

### 3. 业务侧 Plugin 写起来是什么样

```ts
// gameplay/combat/combat-plugin.ts
import { Plugin, ScheduleLabel } from '@/core';
import { Stats } from './stats';
import { Hitbox } from './hitbox';
import { damageSystem, deathSystem } from './systems';

export const CombatPlugin: Plugin = {
  name: 'combat',
  build(app) {
    app
      .registerComponent('Stats', Stats,  { icon: '❤️', category: 'Combat' })
      .registerComponent('Hitbox', Hitbox, { icon: '⚔️', category: 'Combat' })
      .addSystems(ScheduleLabel.Update, [damageSystem, deathSystem]);
  },
};

// gameplay/movement/movement-plugin.ts
export const MovementPlugin: Plugin = {
  name: 'movement',
  dependencies: [CorePlugin],     // 依赖核心的 Transform / Velocity
  build(app) {
    app
      .registerComponent('DashState', DashState, { icon: '💨', category: 'Movement' })
      .addSystems(ScheduleLabel.Update, [applyDash, integrateVelocity]);
  },
};

// main.ts
new App()
  .addPlugins([CorePlugin, RenderPlugin, CombatPlugin, MovementPlugin])
  .run();
```

这就回到了你上一轮的核心结论：**"用哪个"完全由 main.ts 的 addPlugins 列表决定**。

### 4. 依赖处理

简单版按顺序 `addPlugin` 即可。稍微健壮一点的做法是递归展开依赖并去重：

```ts
addPlugin(p: Plugin): this {
  if (this.plugins.has(p.name)) return this;
  if (p.dependencies) for (const d of p.dependencies) this.addPlugin(d);
  // ... 正常注册逻辑
}
```

Bevy 的 PluginGroup 更复杂（有 disable/swap），前期不用抄这么细。

### 5. HMR 场景

Vite HMR 时 plugin 文件会重新求值，导出的 `CombatPlugin` 是一个新对象。要让 teardown 正确工作：

```ts
// main.ts
if (import.meta.hot) {
  import.meta.hot.accept('./gameplay/combat/combat-plugin', (newMod) => {
    app.reloadPlugin(newMod.CombatPlugin);
  });
}

// app.ts
reloadPlugin(p: Plugin): void {
  const old = this.plugins.get(p.name);
  if (old) {
    old.teardown?.(this);
    this.registry.unregisterByOwner(p.name);
    this.removeSystemsByOwner(p.name);    // schedule 也要支持按 owner 移除
  }
  this.plugins.delete(p.name);
  this.addPlugin(p);
}
```

这是 TS 方案相对 Bevy 的一个**真香优势**——Rust 那边改 component 字段基本只能重启游戏，TS + Vite HMR 能做到改字段不丢状态，迭代速度完全不是一个量级。

### 6. 编辑器侧怎么接入

编辑器启动时做两件事：

```ts
// editor/bootstrap.ts
import schemas from '@build/component-schemas.json';

// 1. 正常装配 App（和游戏共用同一套 Plugin 列表）
const app = new App();
app.addPlugins([CorePlugin, CombatPlugin, MovementPlugin, ...]);

// 2. 灌入编辑器元信息
for (const [name, schema] of Object.entries(schemas)) {
  app.registry.attachSchema(name, schema as PropMeta[]);
}

// 3. 检视器遍历
for (const meta of app.registry.all()) {
  if (meta.schema) inspectorUI.addComponentType(meta);
}
```

游戏 runtime 的 bundle 里没有 `schemas` import，tree-shaking 会把 schema JSON 完全扔掉，零开销承诺兑现。

---

## 最终文件结构建议

```
src/
├── core/                          # ECS 内核，无业务依赖
│   ├── component-registry.ts
│   ├── world.ts
│   ├── storage.ts
│   ├── query.ts
│   ├── schedule.ts
│   ├── system.ts
│   ├── plugin.ts
│   ├── app.ts
│   ├── schema-types.ts            # PropMeta 等类型定义（纯 type）
│   └── index.ts                   # 桶文件
│
├── editor/                        # 编辑器专用（不进游戏 bundle）
│   ├── schema-parser.ts           # TS AST 解析
│   ├── vite-plugin-schema.ts
│   ├── prefab-serializer.ts
│   └── inspector/
│
├── gameplay/
│   ├── combat/
│   │   ├── stats.ts               # 纯 class + JSDoc
│   │   ├── hitbox.ts
│   │   ├── systems.ts
│   │   └── combat-plugin.ts       # 唯一注册入口
│   ├── movement/
│   │   └── ...
│   └── ...
│
└── main.ts                        # App + addPlugins
```

一条硬性约定：**component class 文件里不出现 `ComponentRegistry.register` 调用**，全部收束到同目录的 `*-plugin.ts`。这样扫一眼 plugin 文件就知道这个模块对外暴露了什么，和 Bevy 的 `impl Plugin for X` 语义完全一致。

---

一句话收束：**ComponentRegistry 起步用模块级单例放在 `core/`，但 class 本体和实例分离以便将来挂到 App 上；注册动作统一由 Plugin.build 通过 `app.registerComponent` 调用，registry 借 `_currentPluginName` 自动记录 owner，换来 HMR 卸载和依赖追踪能力；业务 component class 本身保持 JSDoc 纯净，不 import registry，不写装饰器**——这样旧方案的零运行时开销和 Bevy 的显式装配模型就真正缝合到一起了。

===

export type ComponentCtor<T = any> = new (...args: any[]) => T;
register<T>(
    name: string,
    ctor: ComponentCtor<T>,
    opts: ComponentRegisterOptions = {},
  ): ComponentMeta<T> {

export const CombatPlugin: Plugin = {
  name: 'combat',
  build(app) {
    app
      .registerComponent('Stats', Stats,  { icon: '❤️', category: 'Combat' })
      .registerComponent('Hitbox', Hitbox, { icon: '⚔️', category: 'Combat' })
      .addSystems(ScheduleLabel.Update, [damageSystem, deathSystem]);
  },
};

我没有太理解 ComponentCtor 这个类的定义，以及 ctor 参数。我有 C++ 的基础，但是我对 typescript 不熟悉，帮我详细解释一下

==

这是 TS 里非常特别的一个写法，对 C++ 背景的人有两个"反直觉"点需要先破除，然后看具体语法就通了。

## 破除直觉：两个前置认知

### 认知 1：TS 的 class 在运行时**就是一个函数**

C++ 里 class 是编译期概念，运行时只剩 vtable 和内存布局。TS/JS 里完全不一样：

```ts
class Stats {
  hp = 100;
}

console.log(typeof Stats);       // "function"
console.log(Stats);               // [class Stats]
console.log(Stats === Stats);     // true，可以当值传递、比较、存进 Map
```

**class 名字本身是一个运行时值**，等价于它的构造函数。你可以把 `Stats` 塞进变量、数组、Map：

```ts
const ctors = [Stats, Hitbox, DashState];   // 一个"class 列表"
new ctors[0]();                              // 合法，等价于 new Stats()
```

这对应 C++ 里**没有**直接对应物——最接近的类比是"函数指针 + placement new"，但 C++ 里 class 本身不是一等公民，你没法写 `auto x = Stats;`。

### 认知 2：`new` 是一种函数调用，可以被类型系统单独描述

C++ 里函数有函数签名，class 有构造函数签名，这俩是分开的概念。TS 里**构造器签名也是一种函数类型**，用一个特殊的 `new (...) => T` 语法表示——读作"一个可以 new 的函数，new 出来得到 T"。

---

## 拆解 `ComponentCtor` 的定义

```ts
export type ComponentCtor<T = any> = new (...args: any[]) => T;
```

一块一块看：

### `export type ComponentCtor<T = any>`

`type` = 类型别名（C++ 里的 `using`）。`<T = any>` 是泛型参数，默认值 `any`（相当于 C++ `template<typename T = void*>`）。

等价 C++ 伪代码：

```cpp
template<typename T = any>
using ComponentCtor = /* 某个类型 */;
```

### `new (...args: any[]) => T`

这就是那个特殊的"构造器类型"语法。三个部分：

| 片段 | 含义 | C++ 类比 |
|---|---|---|
| `new` | 声明这是个**可以用 `new` 调用**的类型 | 构造函数 |
| `(...args: any[])` | 构造器接受任意个、任意类型的参数 | `(Args&&...)` 可变模板参数 |
| `=> T` | 返回类型是 `T`（即 new 出来的实例类型） | 构造完返回 `T` 实例 |

整句意思：**"任何一个可以用 `new SomeClass(参数随意)` 来构造出 T 实例的 class 本身"**。

对照一下：

```ts
// 普通函数类型
type Fn = (x: number) => string;
const f: Fn = (x) => x.toString();
f(1);          // 像函数那样调用

// 构造器类型
type Ctor = new (x: number) => string;
const C: Ctor = class { constructor(x: number) { return "" as any; } };
new C(1);      // 用 new 调用
```

**多出来的 `new` 关键字就是全部区别**——告诉 TS："这个值必须支持 `new xxx()`"。

### 为什么 `...args: any[]`？

因为不同 component 的构造函数签名不一样：

```ts
class Stats {
  constructor() {}                         // 无参
}
class Health {
  constructor(public max: number) {}        // 一个 number
}
class Buff {
  constructor(name: string, dur: number) {} // 两个参数
}
```

`ComponentCtor` 要能**装下所有这些 class**，所以把参数声明成"任意个、任意类型"。这等价于 C++ 里的：

```cpp
template<typename T>
concept AnyConstructible = requires { T(/* 任意参数 */); };
```

代价是调用方（比如 `new meta.ctor()`）TS 不会检查参数是否正确——但 registry 场景里我们通常就是无参构造（`new meta.ctor()` 后再 `Object.assign`），所以这个妥协是值得的。

---

## `Stats` 作为值怎么就满足 `ComponentCtor<Stats>` 了

这是最关键的一跳。看代码：

```ts
class Stats {
  maxHp = 100;
  hp = 100;
}

app.registerComponent('Stats', Stats, { ... });
//                              ^^^^^
//                              这里传的是 class 本身，不是实例
```

`Stats` 这个值（因为 class 是运行时函数）：

- **可以 new**：`new Stats()` 合法
- **new 出来的东西类型是 `Stats`**（class 的名字既是值也是类型，双重身份）

所以 TS 推断出 `Stats` 这个值的类型是 `new () => Stats`，恰好匹配 `ComponentCtor<Stats>`（因为 `ComponentCtor<T>` 接受任意参数，`() => Stats` 是 `(...args: any[]) => Stats` 的子集）。

C++ 的对照（只是为了帮你建立直觉，语法其实不太对）：

```cpp
// 伪代码
void registerComponent(const char* name, ClassTemplate<Stats> ctor);

registerComponent("Stats", Stats);   // 把 Stats "这个类" 作为参数传进去
// 然后运行时可以：auto instance = ctor();   // 等价 new Stats()
```

C++ 里做不到这么直接。你要么传 `std::function<Stats*()>`（lambda 包一层 `new Stats()`），要么传模板参数。TS 这里因为 class 是一等公民，直接传 class 名字就行。

---

## `ctor` 参数的实际用途

看 registry 里怎么用它：

```ts
register<T>(name: string, ctor: ComponentCtor<T>, opts: ...) {
  // 1. 把 ctor 当 Map key —— class 是稳定的对象引用
  this._byCtor.set(ctor, meta);

  // 2. 反序列化时用它创建实例
  //    (这行不在 register 里，在 deserialize 里)
  //    const instance = new ctor();
}
```

两个典型消费场景：

### 场景 1：用 class 当 Map 的 key

```ts
const map = new Map<ComponentCtor, ComponentMeta>();
map.set(Stats, { id: 0, ... });
map.set(Health, { id: 1, ... });

// 查询：
map.get(Stats);       // { id: 0, ... }
map.get(new Stats()); // undefined！实例 ≠ class 本身
```

**class 引用在整个程序生命周期内稳定**（除非 HMR），用它当 key 比用字符串名字快、比用 Symbol 直观。

### 场景 2：反序列化

```ts
static deserialize(json: { type: string; data: any }) {
  const meta = registry.getByName(json.type);
  const instance = new meta.ctor();    // ← 这里
  Object.assign(instance, json.data);
  return instance;
}
```

`meta.ctor` 是我们当初存进去的 `Stats` class 本身，`new meta.ctor()` 就是 `new Stats()`，得到一个带所有默认值的实例。**这是整个设计要求 component 必须是 class（而不是 interface / plain object）的根本原因**——class 自带 "无参构造 + 字段默认值" 的能力。

---

## 泛型 `<T>` 在这里起什么作用

`ComponentCtor<T>` 带个 `T` 参数是为了**保留类型信息，让后续调用链有类型安全**：

```ts
register<T>(name: string, ctor: ComponentCtor<T>, opts: ...): ComponentMeta<T> {
  // ...
  return meta;   // ComponentMeta<T>
}

// 调用方：
const statsMeta = registry.register('Stats', Stats);
// TS 推断出 statsMeta: ComponentMeta<Stats>

const instance = new statsMeta.ctor();
// TS 知道 instance: Stats，.hp .maxHp 都有补全
```

如果不写泛型，只写 `ctor: ComponentCtor`（= `ComponentCtor<any>`），返回的 meta 里 `ctor` 就是 `new () => any`，`new ctor()` 出来是 `any`，失去类型检查。

C++ 类比：

```cpp
template<typename T>
ComponentMeta<T> register_component(const char* name, /* Ctor of T */);
// 推断出 T 后，后续返回值、实例类型都带上了 T
```

---

## 完整心智模型

把前面所有东西串起来：

```ts
class Stats { hp = 100; }       // ① class 是一等公民，运行时就是个函数

type ComponentCtor<T = any>     // ② 描述"可以 new 的东西"这个类型概念
  = new (...args: any[]) => T;  //    new 关键字表明要能 new
                                //    ...args 表明参数随意
                                //    => T 表明 new 出来得到 T

function register<T>(
  ctor: ComponentCtor<T>        // ③ 接受一个"可以 new 出 T 的 class"
) {
  const inst = new ctor();      // ④ 运行时用它来 new 实例
}

register(Stats);                // ⑤ 直接传 class 名字
                                //    TS 推断 T = Stats
                                //    编译期和运行时都成立
```

TS 相对 C++ 最大的范式差异：**type 和 value 有交叉——class 名字同时是类型和值**。`Stats` 在类型位置表示"Stats 实例的类型"，在值位置表示"Stats 的构造函数"。一旦接受这一点，`ComponentCtor` 这种写法就不再诡异，它只是把"值位置的 class"这个运行时对象的类型形状描述出来。

---

## 一个判断题帮你巩固

下面哪些是合法的 `ComponentCtor<Stats>`？

```ts
class Stats { hp = 100; }

const a: ComponentCtor<Stats> = Stats;                           // ?
const b: ComponentCtor<Stats> = new Stats();                     // ?
const c: ComponentCtor<Stats> = class extends Stats {};          // ?
const d: ComponentCtor<Stats> = () => new Stats();               // ?
const e: ComponentCtor<Stats> = function() { return new Stats(); }; // ?
```

答案：

- `a` ✅ class 本身就是 ctor
- `b` ❌ 实例不是 ctor，`new (instance)()` 不合法
- `c` ✅ 派生 class 也可以 new 出一个"至少是 Stats"的东西
- `d` ❌ 箭头函数**不能被 new**（TS 明确禁止），虽然返回值类型对
- `e` ⚠️ 普通 function 理论上可以 new，但 TS 严格模式下可能拒绝；不推荐

关键判据就一条：**能不能 `new xxx()`** —— 这正是 `ComponentCtor` 类型签名里 `new` 关键字的含义。

===

class Stats { hp = 100; }       // ① class 是一等公民，运行时就是个函数

这语句我没有太明白，什么叫运行时就是一个函数

=

这句话其实在说一件 C++ 和 JS/TS 根本不同的事。先给你两个世界的对比图，再挖进去看为什么。

## C++ 世界 vs JS 世界

### C++：class 是编译期概念

你写：

```cpp
class Stats {
public:
    int hp = 100;
};
```

编译器拿到这段代码后会做两件事：

1. **编译期**：生成一份"布局表"——Stats 对象占多少字节、hp 在哪个偏移、vtable 长啥样
2. **运行时**：二进制里**根本找不到"Stats"这个东西**，只剩机器码和内存布局。`sizeof(Stats)`、`typeid(Stats).name()` 这些是编译器帮你查表塞进来的字面量，不是运行时真存在一个叫 Stats 的对象

换句话说：**Stats 这个名字在运行时被擦除了**。你没法写：

```cpp
auto x = Stats;          // 编译错误
std::map<???, int> m;    // 没法把 Stats 当 key 存进容器
m[Stats] = 1;            // 编译错误
```

class 是"蓝图"，蓝图只在编译期存在，运行时只剩按蓝图盖出来的实例。

### JS/TS：class 是运行时值

同样的代码：

```ts
class Stats {
  hp = 100;
}
```

JS 引擎在运行时做的事是：

1. **执行 `class Stats { ... }` 这条语句**时，在内存里**真的创建一个对象**
2. 这个对象是**一个函数**（带一些额外属性，比如 `prototype`）
3. 把这个函数对象**绑定到变量名 `Stats` 上**

所以 `Stats` 在运行时是一个实实在在存在于内存里的值，你可以随便操作它：

```ts
console.log(typeof Stats);         // "function"
console.log(Stats.name);           // "Stats"（就是一个字符串属性）
console.log(Stats.toString());
// 输出：class Stats { hp = 100; }   ← 它自己知道自己的源码

const alias = Stats;                // 把这个值赋给另一个变量
new alias();                        // 合法！等价于 new Stats()

const arr = [Stats, Number, String]; // 塞进数组
new arr[0]();                        // 合法！

const map = new Map();
map.set(Stats, "hello");             // 当作 Map 的 key
map.get(Stats);                      // "hello"
```

**这在 C++ 里完全做不到**。最接近的类比是"Stats 这个类在运行时变成了一个普通的 JS 对象，只不过这个对象恰好支持用 `new` 来调用它生成实例"。

## 为什么说"就是一个函数"

这一点最反直觉。看下面这段代码：

```ts
class Stats {
  hp = 100;
  constructor(initialHp: number) {
    this.hp = initialHp;
  }
}
```

JS 引擎内部会**把它解糖成大致这样的普通函数**：

```js
function Stats(initialHp) {
  this.hp = 100;              // 字段初始化
  this.hp = initialHp;        // 构造函数体
}
Stats.prototype = { /* 方法挂这里 */ };
```

也就是说，**`class` 关键字只是语法糖**，底下是一个普通函数 + `prototype` 对象。这就是为什么：

```ts
typeof Stats === "function"    // true，它本质就是函数
typeof (new Stats(100)) === "object"   // 实例才是对象
```

`new Stats(100)` 发生的事其实是：

1. 创建一个空对象 `{}`
2. 把这个空对象当作 `this`，调用 `Stats` 这个函数
3. 函数执行完，返回这个对象

和调普通函数的唯一区别是**多了一个 `new` 关键字，它负责第 1 步和第 3 步**。这也是为什么前面 `ComponentCtor` 的类型签名里要写 `new (...args) => T`——那个 `new` 关键字就在告诉 TS："这个函数要用 new 的方式调用"。

## 一个能直接跑的演示

你可以把下面代码粘到浏览器 Console 里：

```ts
class Stats {
  hp = 100;
}

// 1. class 本身是值
console.log(Stats);                  // [class Stats]
console.log(typeof Stats);           // "function"

// 2. 可以当普通变量传递
const X = Stats;
const instance = new X();            // 用别名 new
console.log(instance.hp);            // 100
console.log(instance instanceof Stats); // true

// 3. 可以放进数据结构
const registry = new Map();
registry.set(Stats, "这是 Stats");
console.log(registry.get(Stats));    // "这是 Stats"

// 4. 甚至可以当普通函数调用（不推荐，但能说明本质）
//    不过 ES6 class 禁止了非 new 调用，会报错
try {
  Stats();
} catch (e) {
  console.log("class 禁止非 new 调用:", e.message);
}

// 但普通 function 没这个限制，证明"class 本质是 function + 一些约束"
function OldStyle() { this.hp = 100; }
const a = new OldStyle();            // ✅ new 调用
const b = OldStyle.call({});         // ✅ 非 new 调用也能给 this 挂字段
```

## 和 C++ 的心智差异总结

| 维度 | C++ class | JS/TS class |
|---|---|---|
| 存在阶段 | 仅编译期 | 编译期 + 运行时 |
| 运行时形态 | 不存在，只剩内存布局 | 一个函数对象 |
| 能否赋值给变量 | ❌ `auto x = Stats` 非法 | ✅ `const x = Stats` |
| 能否当容器 key | ❌ | ✅ `Map.set(Stats, ...)` |
| 能否动态传递给函数 | ❌（要用模板或函数指针绕） | ✅ 直接传 |
| `new` 的含义 | 分配内存 + 调构造函数（编译期解析） | 调用那个函数对象，但以"构造模式"（运行时动态） |

## 回到 ComponentRegistry 为什么要这么设计

现在再看：

```ts
this._byCtor.set(ctor, meta);  // 把 class 当 Map 的 key
new meta.ctor();                // 从 Map 拿出 class，直接 new
```

这两行在 C++ 里**根本写不出来**——C++ 里 `Stats` 不是值，没法塞进 map；就算用模板特化硬搞，也没法"运行时根据某个字符串查出 class 然后实例化"（那是反射的活，C++ 没标准反射）。

TS 能这么写的唯一原因就是：**class 在运行时是一个可以赋值、传递、存储的普通值，恰好这个值支持 `new` 操作**。这是整个 registry 设计的地基。

---

一句话收束：**"运行时就是一个函数"意思是——在 C++ 世界里纯属编译期蓝图的 class，到了 JS/TS 世界变成了一个内存里实实在在存在的函数对象，可以被赋值、传参、当 Map key，只不过调用它时要加个 `new` 关键字让它进入"构造模式"**。这是 JS 把函数和类型都当一等公民的结果，也是 TS ECS 设计能如此灵活的根源。

===

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

===

我想要把 app 改成 game，是否有这个必要？

与一些 component 只有一个 entity 有，比如玩家的信息。比如时间信息等，怎么处理呢

=

两个问题都是很值得深入聊的架构决策，分开说。

## 一、`App` 该不该改成 `Game`

先说结论：**不推荐改**。但你直觉上想改是有道理的，这个纠结本身说明你在认真思考分层。下面把两边的理由摊开。

### 为什么 Bevy 叫 `App` 而不是 `Game`

Bevy 这个命名是刻意的，理由有三：

**1. "App" 是一个比 "Game" 更大的概念**

同一套 ECS 架构不一定只跑游戏：

- 关卡编辑器本身是一个 App（它装配的 Plugin 不同）
- 资产处理工具、服务器端逻辑、benchmark 都可以是 App
- 甚至一些 Bevy 项目做的是 CAD、数据可视化、非游戏应用

如果叫 `Game`，编辑器里 `new Game()` 就很别扭——它不是游戏，但它要用同一套 App 框架。

**2. "App" 强调的是"一次进程的生命周期 + 一套配置"，和业务语义无关**

`new App()` 的含义是"我创建了一个 ECS 应用实例，它有自己的 World、Schedule、Plugin 列表"。这个抽象和具体跑什么业务解耦。

**3. 和生态约定一致**

如果你以后读 Bevy 源码、参考其他 ECS 框架（flecs、EnTT、specs）、看社区教程，**所有人都用 App 这个词**。改成 Game 会在你和社区之间制造一层翻译成本。对微尘这种长期项目，这个成本会慢慢累积。

### 你想改成 Game 背后的合理诉求

但你的直觉也没错——"Game" 听起来**确实更贴合业务**。这个诉求其实可以用另一种方式满足：

```ts
// core/app.ts
export class App { /* 通用 ECS 应用 */ }

// game/game.ts  ← 业务层包一层
export class Game extends App {
  constructor() {
    super();
    this.addPlugins(DefaultGamePlugins);   // 预装默认 Plugin
  }

  start() { /* 业务语义的启动逻辑 */ }
  pause() { /* 暂停 */ }
  resume() { /* 恢复 */ }
}

// main.ts
new Game()
  .addPlugins([CombatPlugin, MovementPlugin])
  .start();
```

**底层保持 App 通用性，上层用 Game 承载业务语义**。同理 editor 可以有自己的 `class Editor extends App`。这样：

- core 不被污染，依然是通用框架
- game 层有自己的业务门面，代码读起来很自然
- editor 可以独立演进

这是 Unity 那种"GameObject 是底层，MonoBehaviour 是业务外壳"的思路——分层抽象，而不是改名。

### 什么时候真的该改

只有一种情况应该改：**你 100% 确定这个引擎只服务于游戏、且永远不会被用来做编辑器或工具**。对微尘显然不是这样——你已经规划了编辑器，那就别改。

## 二、单例 Component（Resource）的处理

这是 ECS 里非常经典的一个设计问题。你说的"只有一个 entity 有"的数据，在 Bevy 和大部分 ECS 里有一个专门的概念：**Resource**。

### 先看两种错误做法，理解为什么需要 Resource

**错误做法 1：当成普通 component，spawn 一个特殊 entity**

```ts
// ❌ 不推荐
const timeEntity = world.spawn();
world.insert(timeEntity, new Time());

// 使用：
for (const [_, time] of world.query(Time)) { /* 只有一个 entity 进来 */ }
```

问题：

- 每次访问都要跑一遍 query，即使只有一条数据
- 没有强约束，别人可能不小心 spawn 两个 Time entity
- 语义模糊：读代码的人不知道这到底是单例还是集合
- 需要到处 `for ... of`，单例场景下很啰嗦

**错误做法 2：全局变量 / 单例类**

```ts
// ❌ 不推荐
export const globalTime = { delta: 0, elapsed: 0 };

// system 里：
function updateMovement() {
  pos.x += vel.x * globalTime.delta;
}
```

问题：

- 绕过了 ECS 的调度器，**破坏并行安全**（调度器不知道谁在读 globalTime）
- 无法被编辑器可视化（编辑器只认 Registry 里的东西）
- 无法反序列化（prefab 里没法存全局变量）
- 测试难（多个测试共享状态）

### 正确做法：Resource

Bevy 为这种数据设计了专门的容器——`Resource`。它和 Component 的区别就一句话：

> **Component 是挂在 entity 上的数据（多份），Resource 是挂在 World 上的数据（一份）**

核心 API 长这样：

```ts
// 定义：纯 class，和 component 一样
export class Time {
  /** 帧间隔（秒） */
  delta: number = 0;
  /** 自启动以来的总时间 */
  elapsed: number = 0;
}

export class PlayerInfo {
  /** 玩家名字 */
  name: string = '';
  /** 等级 */
  level: number = 1;
  /** 当前关卡 */
  stage: number = 1;
}

// 注册 + 插入（通常在 Plugin.build 里）
export const TimePlugin: Plugin = {
  name: 'time',
  build(app) {
    app.insertResource(new Time());        // 注册并插入单例
    app.addSystems(ScheduleLabel.First, [updateTime]);
  },
};

// system 里读写
function updateTime({ res }: SystemContext) {
  const time = res.get(Time);
  time.delta = /* ... */;
  time.elapsed += time.delta;
}

function movePlayer({ world, res }: SystemContext) {
  const time = res.get(Time);                     // ← 直接拿，无需 query
  for (const [_, pos, vel] of world.query(Position, Velocity)) {
    pos.x += vel.x * time.delta;
  }
}
```

### Resource 在 core 里怎么实现

实现比 component 简单多了——就是一个 `Map<Ctor, instance>`：

```ts
// core/resource.ts
export class ResourceStore {
  private resources = new Map<ComponentCtor, any>();

  insert<T>(value: T): void {
    this.resources.set(value.constructor as ComponentCtor, value);
  }

  get<T>(ctor: new () => T): T {
    const r = this.resources.get(ctor);
    if (!r) throw new Error(`Resource not found: ${ctor.name}`);
    return r as T;
  }

  tryGet<T>(ctor: new () => T): T | undefined {
    return this.resources.get(ctor);
  }

  remove<T>(ctor: new () => T): void {
    this.resources.delete(ctor);
  }

  has(ctor: ComponentCtor): boolean {
    return this.resources.has(ctor);
  }
}

// World 里持有一份
export class World {
  readonly resources = new ResourceStore();
  // ... 其他 component 存储
}
```

然后 App 层暴露语义化 API：

```ts
class App {
  insertResource<T>(value: T): this {
    this.world.resources.insert(value);
    return this;
  }
}
```

### Resource 怎么和 Registry / Schema 打通

这是你这套架构的一个细节——Resource 要不要走 ComponentRegistry？

**推荐：共用同一个 Registry**，但给 meta 加一个标记：

```ts
interface ComponentMeta<T = any> {
  id: ComponentId;
  name: string;
  ctor: ComponentCtor<T>;
  kind: 'component' | 'resource';   // ← 新增
  icon?: string;
  category?: string;
  schema?: PropMeta[];
}

// App 层
registerResource<T>(name: string, ctor: new () => T, opts = {}): this {
  this.registry.register(name, ctor, { ...opts, kind: 'resource' });
  return this;
}

insertResource<T>(value: T): this {
  // 如果没注册过，自动注册一次
  const ctor = value.constructor as ComponentCtor;
  if (!this.registry.getByCtor(ctor)) {
    this.registry.register(ctor.name, ctor, { kind: 'resource' });
  }
  this.world.resources.insert(value);
  return this;
}
```

好处：

- **编辑器可以直接复用 Inspector**——Resource 也有 JSDoc schema，检视器照样能画
- Time、PlayerInfo 这类数据可以在编辑器里可视化调试（改个数值立刻生效）
- Prefab 序列化器只需判断 `kind`，决定从 World 哪里拿数据

### 哪些数据该做成 Resource

给你一个判断清单：

| 数据类型 | 是 Component 还是 Resource | 理由 |
|---|---|---|
| Time（帧时间） | ✅ Resource | 全局唯一 |
| Input（当前帧键盘/鼠标状态） | ✅ Resource | 全局唯一 |
| Camera 的当前激活引用 | ✅ Resource（`ActiveCamera`） | 只关心哪个 camera 是主的，camera 本身是 component |
| AssetServer（资源加载器） | ✅ Resource | 单例服务 |
| GameState（菜单/游戏中/暂停） | ✅ Resource | 全局状态机 |
| Score（当前分数） | ✅ Resource | 全局唯一 |
| PlayerInfo（玩家属性） | ⚠️ 看情况 | 单人游戏用 Resource；多人/有 AI 玩家用 Component（Player 是 entity） |
| 所有 Camera 实例 | ❌ Component | 可以有多个（UI Camera、主相机、小地图） |
| 所有 Enemy | ❌ Component | 多个实例 |
| Transform / Sprite | ❌ Component | 每个 entity 独立 |

**灰色地带的判断原则**：如果未来可能变成多个，就用 Component；确定永远只有一个，才用 Resource。**降级（Component → Resource）很容易，升级（Resource → Component）很痛**——因为查询方式完全不同，所有使用点都要改。

### 针对你提到的"玩家信息"

单人游戏很简单：

```ts
export class PlayerInfo {
  /** 玩家名 */
  name: string = '';
  /** 金币 */
  coins: number = 0;
  /** 当前 HP */
  hp: number = 100;
}

// PlayerPlugin.build
app.insertResource(new PlayerInfo());
```

但微尘作为 2D 游戏，玩家**角色**（Transform、Sprite、Velocity）还是要作为 entity 存在。所以会出现一种常见模式——**数据分两处**：

```ts
// Resource：全局玩家状态（菜单、UI、存档）
class PlayerInfo {
  name: string = '';
  coins: number = 0;
  totalKills: number = 0;
}

// Component：玩家实体的实时游戏状态（血量、buff、位置）
class PlayerStats {
  hp: number = 100;
  shield: number = 0;
}
class Player {}   // 标记组件，标识"这个 entity 是玩家"

// 查询玩家实体：
for (const [entity, _, stats] of world.query(Player, PlayerStats)) {
  /* 通常只有一条结果 */
}
```

这种"元数据在 Resource，实时状态在 Component"的分法非常常见，既保留了 ECS 的灵活性（你可以生成第二个玩家角色），又让全局信息有单例约束。

### Bevy 的进阶概念（未来参考）

Bevy 还有两个相关概念，起步不用实现，但了解下以防将来踩坑：

- **NonSendResource**：不能跨线程传递的资源（比如 wgpu 的某些句柄）。TS 单线程，不需要
- **States**：把"游戏是否暂停"这种状态做成专门的 Resource 子概念，支持 OnEnter / OnExit / run_if 等调度条件。你的 Schedule 设计如果想支持"只在 gameplay state 下跑某个 system"，可以引入

起步阶段就用普通 Resource 够了。

---

## 总结

**App 命名**：别改。底层保持 App 通用性，业务层用 `class Game extends App` 承载语义，这样 editor 也能用同一套底层。

**单例 Component**：用 Resource。它是 ECS 的标准概念，Bevy / flecs / EnTT 都有。实现是一个 `Map<Ctor, instance>`，API 用 `insertResource` / `res.get(Time)`。Resource 可以共用 ComponentRegistry 做元信息管理，编辑器零成本支持。

**判断原则**：可能出现多份 → Component；确定永远单份 → Resource。玩家数据常见的拆分是"全局档案信息用 Resource，实时战斗状态用 Component"。

===

我现在的编辑器是以canvas，preact为后端，没有接入任何webgpu，但是游戏我是用webgpu，我的编辑器设计应该怎么设计呢？

=

这是一个非常典型也非常重要的架构分叉点——**编辑器和游戏共享多少、分离多少**。你现在的现状（编辑器 canvas 2D + preact，游戏 WebGPU）其实是一个很健康的起点，别急着统一到 WebGPU，我们先分析清楚为什么可以这样分，再给出具体设计。

## 一、先对齐一个关键认知：编辑器不需要和游戏用同一个渲染后端

很多人会下意识觉得"编辑器要所见即所得，必须用 WebGPU 渲染和游戏一样的画面"。这是一个**昂贵的误区**。看几个成熟工具怎么做的：

| 工具 | 游戏渲染 | 编辑器视口渲染 |
|---|---|---|
| Tiled | 业务自定义 | Canvas 2D |
| LDtk | 业务自定义 | Canvas 2D |
| Aseprite | - | 自己的软件渲染 |
| Figma | - | WebGL（为了性能） |
| Spine 编辑器 | 各种引擎 | 独立渲染实现 |

**编辑器的视觉目标 ≠ 游戏的视觉目标**。编辑器追求的是"清晰、交互响应快、UI 集成好"，游戏追求的是"视觉效果、帧率、特效"。强行用同一个渲染后端反而会互相拖累。

这对你特别重要——微尘要部署到 iceriver.cc，**游戏 bundle 必须极小**。如果编辑器代码和游戏共用 WebGPU 管线，要么游戏 bundle 被编辑器污染（体积爆炸），要么你要做复杂的 tree-shaking 边界管理。分离才是真正的省力路线。

## 二、分析你的现状

重新梳理一下你手头的资源：

- **编辑器**：独立应用，Canvas 2D 渲染视口，Preact 画 UI（Inspector、层级、资源面板）
- **游戏**：部署到 iceriver.cc，WebGPU 渲染
- **想要的 ECS 架构**：core / engine / plugin / game / editor 五层（上一轮梳理过）

这里有个现实问题要先面对——**编辑器现在没接入 ECS**。所以真正的问题不是"编辑器怎么接入 WebGPU"，而是**"编辑器怎么接入 ECS 又不被 WebGPU 绑架"**。这两件事常常被混为一谈。

## 三、核心设计思路：Headless World + 渲染适配器

关键洞察是把 ECS 内核和渲染彻底解耦。具体分三件事：

### 1. World 本身是 headless 的（已经是了）

core 层的 `World` / `Registry` / `Schedule` **本来就不依赖任何渲染 API**。它只是一堆数据结构和调度器。这意味着编辑器可以**直接**用 core 和 engine 的大部分能力，不需要改一行。

### 2. RenderPlugin 有两个实现

这是整个方案的核心——**Component 定义共享，渲染后端可替换**。

```
engine/render/
├── components.ts          ← Sprite, Camera, Tilemap (纯数据，零后端)
├── render-plugin.ts       ← Plugin 接口，不含实现
├── backends/
│   ├── webgpu/            ← 游戏用
│   │   └── webgpu-renderer.ts
│   └── canvas2d/          ← 编辑器用
│       └── canvas2d-renderer.ts
```

`Sprite` component 只存数据（texture id、color、size），**没有任何 WebGPU 句柄**。然后：

```ts
// 游戏 main.ts
new Game()
  .addPlugins([..., WebGPURenderPlugin])
  .run();

// 编辑器 main.ts
new Editor()
  .addPlugins([..., Canvas2DRenderPlugin])
  .run();
```

两个 RenderPlugin 注册**同一套 Sprite / Camera component**，但注册不同的渲染 system。WebGPU 的 system 把 sprite 提交到 GPU，Canvas2D 的 system 用 `ctx.drawImage` 画出来。**Component 数据完全一致**，所以 prefab 能无损跨环境加载——这才是"所见即所得"的真正含义（不是像素级一致，而是数据一致）。

### 3. 游戏不打包 Canvas2D 后端，编辑器不打包 WebGPU 后端

通过 ESM 的 tree-shaking 自然实现。游戏 main.ts 只 import `WebGPURenderPlugin`，编辑器 main.ts 只 import `Canvas2DRenderPlugin`，bundler 自动把另一个剔除。游戏 bundle 不会变大一个字节。

## 四、具体分层设计

给一个详细的文件结构，对应你当前的技术栈：

```
packages/
├── core/                          # ECS 内核（headless）
│   ├── component-registry.ts
│   ├── world.ts
│   ├── schedule.ts
│   ├── plugin.ts
│   └── app.ts
│
├── engine/                        # 通用能力（大部分 headless）
│   ├── core-plugin/               # Transform, Parent, Name
│   ├── time-plugin/               # Time resource
│   ├── input-plugin/              # 抽象输入（键鼠/触摸）
│   ├── asset-plugin/              # 资源加载（URL/DataURI）
│   ├── render/                    # 渲染层（抽象 + 多后端）
│   │   ├── components.ts          # Sprite, Camera, Tint, Layer
│   │   ├── plugin-abstract.ts     # AbstractRenderPlugin 基类
│   │   ├── backends/
│   │   │   ├── webgpu/            # 游戏后端
│   │   │   │   ├── webgpu-renderer.ts
│   │   │   │   ├── pipeline.ts
│   │   │   │   └── plugin.ts      # WebGPURenderPlugin
│   │   │   └── canvas2d/          # 编辑器后端
│   │   │       ├── canvas2d-renderer.ts
│   │   │       └── plugin.ts      # Canvas2DRenderPlugin
│   └── physics-plugin/            # 物理
│
├── game/                          # 游戏业务
│   ├── components/                # Stats, DashState, ...
│   ├── systems/                   # 玩法 systems
│   ├── plugins/                   # CombatPlugin, MovementPlugin
│   └── main.ts                    # 装配 + WebGPU
│
└── editor/                        # 编辑器业务
    ├── ui/                        # Preact 组件
    │   ├── inspector/
    │   ├── hierarchy/
    │   ├── asset-browser/
    │   └── viewport/
    ├── viewport/                  # Canvas 2D 视口实现
    │   ├── viewport-renderer.ts   # 调用 Canvas2DRenderPlugin
    │   ├── camera-controller.ts   # 编辑器相机（拖拽/缩放）
    │   ├── selection.ts           # 框选、点选
    │   └── gizmo.ts               # 移动/旋转/缩放手柄
    ├── bridge/                    # ECS ↔ Preact 桥接
    │   ├── world-signals.ts       # Signal 化 World
    │   └── inspector-adapter.ts
    ├── serialization/             # prefab 读写
    ├── editor-plugin.ts           # 编辑器专属 Plugin
    └── main.tsx                   # 装配 + Canvas2D + Preact
```

几个关键点单独展开说。

## 五、Canvas2D 视口和 Preact UI 的集成

这是你当前技术栈最直接的问题：**Preact 负责 UI，Canvas 2D 负责视口，两者怎么和 ECS World 对话？**

### 1. 视口：纯 ECS 驱动

视口不是 Preact 组件的内部状态，而是一个挂载 `<canvas>` 元素、由 ECS system 每帧绘制的独立区域：

```tsx
// editor/ui/viewport/Viewport.tsx
import { useEffect, useRef } from 'preact/hooks';
import { editorApp } from '@/editor/main';

export function Viewport() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;

    // 把 canvas 交给 ECS 的 Canvas2D 渲染后端
    editorApp.world.resources.insert(
      new RenderTarget({ canvas: canvasRef.current })
    );

    return () => {
      editorApp.world.resources.remove(RenderTarget);
    };
  }, []);

  return <canvas ref={canvasRef} class="viewport-canvas" />;
}
```

视口内部的所有交互（选中、拖拽、缩放）都是 **ECS system**，不是 Preact 事件处理器。这样保持了架构的对称性——视口就是"一个特殊的 Canvas2D 渲染目标"。

### 2. UI 面板：读 ECS 数据，写回 ECS

Preact 的 Inspector、层级面板需要**响应 World 的变化**。两种做法：

**做法 A：粗粒度订阅 + useSyncExternalStore（推荐起步）**

```tsx
// editor/bridge/use-world.ts
import { useSyncExternalStore } from 'preact/compat';

export function useComponent<T>(entity: Entity, ctor: new () => T): T | undefined {
  return useSyncExternalStore(
    (onChange) => editorApp.world.subscribe(entity, ctor, onChange),
    () => editorApp.world.get(entity, ctor),
  );
}

// Inspector.tsx
function StatsInspector({ entity }: { entity: Entity }) {
  const stats = useComponent(entity, Stats);
  if (!stats) return null;

  return (
    <div>
      <label>HP</label>
      <input
        type="number"
        value={stats.hp}
        onChange={(e) => {
          stats.hp = Number((e.target as HTMLInputElement).value);
          editorApp.world.markChanged(entity, Stats);  // 通知订阅者
        }}
      />
    </div>
  );
}
```

**做法 B：Signals（Preact 官方推崇，但需要改 World API）**

```ts
// 每个 component 实例包装成 signal
const stats = world.getSignal(entity, Stats);
// Preact 组件里直接用 stats.value.hp，自动响应
```

Signal 性能好、心智负担低，但需要在 core 里内建响应式（或者在编辑器层做 proxy 包装）。我建议**起步用做法 A**，上手快，等瓶颈出现再迁 Signal。

### 3. 编辑器的 change detection 钩子

给 World 加一个简单的订阅机制：

```ts
// core/world.ts (扩展)
export class World {
  private listeners = new Map<string, Set<() => void>>();

  subscribe(entity: Entity, ctor: ComponentCtor, cb: () => void): () => void {
    const key = `${entity}:${this.registry.idOf(ctor)}`;
    (this.listeners.get(key) ?? this.listeners.set(key, new Set()).get(key)!).add(cb);
    return () => this.listeners.get(key)?.delete(cb);
  }

  markChanged(entity: Entity, ctor: ComponentCtor): void {
    const key = `${entity}:${this.registry.idOf(ctor)}`;
    this.listeners.get(key)?.forEach(cb => cb());
  }
}
```

这个 API 只在**开发时/编辑器里**真正有用。游戏 runtime 可以通过 tree-shaking 或 build flag 关掉。

## 六、编辑器的两种渲染路径

你当前"Canvas 2D"可以再细分一下，因为编辑器里有两种东西要画：

### 路径 1：游戏内容（Sprite、Tilemap、粒子等）

由 `Canvas2DRenderPlugin` 负责，画 ECS World 里的 component。这套和游戏的 WebGPU 路径**数据同源、实现不同**。

### 路径 2：编辑器专属元素（选中框、gizmo、网格、辅助线）

由 `EditorPlugin` 注册额外的 component 和 system：

```ts
// editor/editor-plugin.ts
export const EditorPlugin: Plugin = {
  name: 'editor',
  build(app) {
    app
      .registerComponent('Selected', Selected,    { kind: 'marker' })
      .registerComponent('Gizmo', Gizmo)
      .addSystems(ScheduleLabel.Render, [
        drawGrid,
        drawSelectionOutline,
        drawTransformGizmo,
      ]);
  },
};
```

这些 system 用同一个 Canvas 2D context 画在游戏内容上层。关键是**它们只在编辑器里启用**——游戏的 main.ts 不 addPlugin 它们，自然就不存在。

## 七、prefab 和 schema 的跨环境流转

这是你的编辑器最终产出物。流程应该是：

```
编辑器侧                               游戏侧
─────────                              ─────────
1. 用户拖拽操作
   ↓
2. 修改 ECS World 实例
   ↓
3. 保存 → PrefabSerializer.serialize()
   读 Registry.schema 过滤字段
   读 World 实例拿当前值
   ↓
4. 产出 prefab.json  ────────────────→  5. 游戏加载 prefab.json
                                          PrefabSerializer.deserialize()
                                          new Stats() 拿默认值
                                          Object.assign 覆盖差异字段
                                          ↓
                                       6. world.insert(entity, stats)
```

**schema.json** 通过 Vite 插件在构建时生成，两边的 Registry 启动时 attach。这样：

- 编辑器能画 Inspector（用 schema）
- 游戏完全不需要 schema（反序列化只看字段名和默认值）
- 两边对 Component class 的理解完全一致（因为 class 源码共享）

## 八、针对你现状的迁移步骤

按优先级给你一个渐进式路线，不要一次性重构所有东西：

**第一阶段：把 ECS 内核跑起来（不动编辑器现有代码）**

1. 实现 core 层：`ComponentRegistry` / `World` / `Schedule` / `App` / `Plugin`
2. 实现 engine 层：`CorePlugin`（Transform）/ `TimePlugin` / `InputPlugin`
3. 游戏端实现 `WebGPURenderPlugin`，把现有 WebGPU 代码搬进去
4. 验证：游戏能跑起来，有 Transform + Sprite

**第二阶段：把编辑器视口接到 ECS**

1. 实现 `Canvas2DRenderPlugin`，只画 Sprite（先不管 Tilemap / 粒子）
2. 编辑器 main 创建 App，addPlugin Canvas2DRenderPlugin
3. Viewport.tsx 挂载 canvas 并注入 RenderTarget
4. 验证：编辑器视口能显示和游戏一样的 sprite

**第三阶段：Inspector 接 ECS Registry**

1. 实现构建时 schema.json 生成（Vite 插件）
2. Preact Inspector 读 Registry.schema 画 UI
3. 实现 world.subscribe 订阅
4. 验证：改 Inspector 的数值，视口立即更新

**第四阶段：prefab 序列化**

1. 实现 PrefabSerializer
2. 编辑器"保存"按钮产出 prefab.json
3. 游戏端加载 prefab.json 恢复场景
4. 验证：编辑器保存 → 游戏加载，场景一致

**第五阶段：编辑器专属功能**

1. EditorPlugin（选中框、gizmo、网格）
2. 层级面板、资源浏览器
3. Undo/Redo（这是另一个大话题）

## 九、几个你可能会纠结的小问题

**Q：编辑器视口要不要也用 WebGPU 以保证"所见即所得"？**
不需要。数据同源就是真的同源。像素级差异用户不在意（shader 特效除外，见下条）。

**Q：如果游戏有 WebGPU shader 特效，编辑器怎么办？**
三种方案递进：
- 编辑器直接不渲染特效，用占位图标表示"这里有个粒子发射器"
- 编辑器用 Canvas 2D 实现简化版
- 真的需要的话，编辑器视口可以**局部开一个 WebGPU canvas** 专门渲染特效预览。但这是最后的手段

**Q：Preact 和 ECS 的生命周期怎么协调？**
编辑器的 rAF 循环由 ECS 驱动（`App.run()`），Preact 只是在数据变化时重新渲染 UI 组件。两者不冲突，因为 Preact 的 reconciliation 和 ECS 的 schedule 跑在不同的时机。

**Q：编辑器需要 Event 系统吗？**
需要。选中变化、资源加载完成这些都走 ECS Event，Preact 通过订阅 Event 更新 UI。不要让 Preact 和 ECS 各走一套事件机制。

**Q：多场景/多 World？**
一个 Editor App 里通常只开一个 World（当前打开的场景）。切换场景时销毁旧 World、新建 World 并反序列化。多场景同时编辑（像 Unity Additive Scene）是高级需求，起步不做。

---

## 总结

核心原则一句话：**ECS 数据 headless + 渲染后端可插拔 + Preact 只做 UI 外壳**。

对你的具体建议：

1. **保留 Canvas 2D 编辑器**。不要为了"统一后端"强行把编辑器迁到 WebGPU，这是性价比极低的重构
2. **渲染层必须有双后端设计**（WebGPU + Canvas2D），Component 数据共享，Plugin 分离
3. **编辑器视口是 ECS 驱动的 canvas**，不是 Preact 组件状态
4. **Preact 只负责 UI（Inspector、面板），通过 `useSyncExternalStore` + `world.subscribe` 响应 ECS 变化**
5. **prefab.json + schema.json 是编辑器和游戏之间的唯一契约**，两边的 Component class 源码共享保证语义一致
6. **按五阶段渐进迁移**，先让内核跑起来，再逐步接入编辑器，避免一次性重写

微尘这种规模的项目，按这套架构走，编辑器和游戏可以长期并行演进、互不阻塞。

