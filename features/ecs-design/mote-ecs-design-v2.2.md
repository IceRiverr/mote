
component-registry.ts 和 world.ts 以及 app.ts 的关系是什么呢

这三者的关系是整个 ECS 架构最核心的一块。先用一句话把定位说清楚，再展开：

> **ComponentRegistry 管"类型"，World 管"数据"，App 管"装配和生命周期"**。

三者职责完全正交，一个字不能互换。下面详细讲。

## 一、三者的职责定义

### ComponentRegistry：类型层

**它只做一件事：给每个 component class 分配一个运行时可用的"身份"，并存储该类型的元信息。**

存的是**关于类型的事实**，不是实例：

```
Stats class  → { id: 0, name: 'Stats', ctor: Stats, schema: [...] }
Hitbox class → { id: 1, name: 'Hitbox', ctor: Hitbox, schema: [...] }
Time class   → { id: 2, name: 'Time', ctor: Time, kind: 'resource' }
```

一个 class 在整个应用生命周期里只会注册一次。Registry 不知道任何 entity 的存在、不知道任何 component 实例的值、不跑 system。

对应 Rust Bevy：`Components` 结构（存 `ComponentId` → `ComponentInfo`）。

### World：数据层

**它只做一件事：按 entity + component type 存取数据。**

存的是**具体的 entity 和 component 实例**：

```
Entity(0): Stats{hp:100} + Hitbox{radius:10}
Entity(1): Stats{hp:80}  + Velocity{x:5}
Entity(2): Transform{...} + Sprite{...}
Resources: Time{delta:0.016}, PlayerInfo{...}
```

World 内部有若干 `ComponentStorage`（每种 component 一张），加上一个 `ResourceStore`。它**依赖 Registry** 来把 class 翻译成 id，但不负责 class 的注册。

对应 Rust Bevy：`World` 结构（存 `Archetypes` / `Entities` / `Resources`）。

### App：装配层

**它只做两件事：把 Plugin 装配到一起，跑 Schedule 循环。**

存的是**本次应用运行的配置**：

```
registry: ComponentRegistry   ← 类型表
world:    World               ← 数据存储
schedules: Map<Label, Schedule>  ← 什么时候跑什么 system
plugins:  Map<name, Plugin>   ← 已加载的插件
```

App 是**门面（Facade）**，对外暴露 `addPlugin` / `registerComponent` / `addSystems` / `insertResource` / `run` 这些高层 API，内部把操作转发到 Registry、World、Schedule。

对应 Rust Bevy：`App` 结构。

## 二、三者的依赖方向

画出来是一张**严格分层**的图：

```
┌────────────────────────────────────────┐
│              App (门面)                │
│  ┌──────────────────────────────────┐  │
│  │  addPlugin / addSystems / run    │  │
│  └──────────────────────────────────┘  │
│            ↓ 持有并协调 ↓              │
│  ┌──────────┐  ┌───────┐  ┌────────┐   │
│  │ Registry │  │ World │  │Schedule│   │
│  └────┬─────┘  └───┬───┘  └────────┘   │
└───────┼────────────┼───────────────────┘
        │            │
        │            │ 依赖 Registry 把 class 翻译成 id
        │            ▼
        │       ┌─────────────────┐
        └──────→│ ComponentRegistry│
                └─────────────────┘
```

三条硬依赖规则：

1. **App 持有 Registry 和 World**（组合关系，不是继承）
2. **World 依赖 Registry**（需要用 Registry.idOf 查 id）
3. **Registry 不依赖任何人**（最底层，独立可测）

World 对 Registry 是**单向依赖**——Registry 不知道 World 的存在。这很关键，因为：

- Registry 可以被多个 World 共用（比如编辑器里开子窗口预览时）
- Registry 可以独立测试（给它注册几个 class，不用建 World）
- 编辑器里只用 Registry 画 Inspector 就行，不一定要 World

## 三、一次完整的调用链

最能说清关系的就是看一次"注册 component + 创建 entity + 查询"的完整过程。

### 步骤 1：App 创建时

```ts
class App {
  registry = new ComponentRegistry();          // ①
  world    = new World(this.registry);         // ② World 需要 Registry 引用
  schedules = new Map<ScheduleLabel, Schedule>();
}
```

App 构造函数里：

- 先创建 Registry（独立对象）
- 再创建 World，**把 Registry 的引用传进去**（World 构造函数接收 Registry）

这一步决定了 World 和 Registry 是**"共享类型表"的绑定关系**——你如果换一个 Registry，World 的存储索引就全乱了，所以一旦绑定不能变。

### 步骤 2：Plugin.build 里注册 component

```ts
// 用户代码
app.registerComponent('Stats', Stats);

// App 内部：
registerComponent(name, ctor, opts) {
  this.registry.register(name, ctor, opts);   // ← 只动 Registry
  return this;
}

// Registry 内部：
register(name, ctor, opts) {
  const meta = { id: this.nextId++, name, ctor, ... };
  this.byId[meta.id] = meta;
  this.byCtor.set(ctor, meta);
  this.byName.set(name, meta);
  return meta;
}
```

关键点：**注册 component 只改 Registry，World 毫不知情**。这是对的——Registry 存的是"世界上存在这种类型的 component"，和"哪个 entity 拥有它"无关。

### 步骤 3：运行时创建 entity + 插入 component

```ts
// 用户代码（比如在某个 spawn system 里）
const entity = world.spawn();
world.insert(entity, new Stats());

// World 内部：
spawn(): Entity {
  const e = this.nextEntity++;
  return e;
}

insert<T>(entity: Entity, value: T) {
  const ctor = value.constructor as ComponentCtor;
  const id = this.registry.idOf(ctor);   // ← 向 Registry 查 id
  let storage = this.storages[id];
  if (!storage) {
    storage = new ComponentStorage<T>();
    this.storages[id] = storage;
  }
  storage.insert(entity, value);
}
```

关键点：**插入实例时 World 需要问 Registry 拿 id**，然后按 id 找到对应的 `ComponentStorage`。Registry 是那个"翻译器"。

### 步骤 4：System 查询

```ts
// 用户代码
function damageSystem({ world }) {
  for (const [entity, stats] of world.query(Stats)) {
    if (stats.hp <= 0) { /* ... */ }
  }
}

// World 内部：
query<Cs extends ComponentCtor[]>(...ctors: Cs): Query<Cs> {
  const storages = ctors.map(c => {
    const id = this.registry.idOf(c);    // ← 再次向 Registry 查 id
    return this.storages[id];
  });
  return new Query(storages);
}
```

查询时也要经 Registry 翻译。**Registry.idOf 是整个 ECS 的热点函数**——每次 query 都会调，这就是为什么前面强调它必须 O(1)。

### 步骤 5：帧循环

```ts
app.run();

// App 内部：
run() {
  const loop = () => {
    for (const label of scheduleOrder) {
      const schedule = this.schedules.get(label);
      schedule.run(this.world);      // ← 把 World 传给 Schedule
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}
```

Schedule 拿到 World 后，依次调用每个 system，system 内部再通过 World 查询数据、通过 Registry 翻译类型。

## 四、一张对照表加深理解

| 操作 | 动了谁 | 原因 |
|---|---|---|
| `app.registerComponent('Stats', Stats)` | **Registry** | 给类型分配 id |
| `app.insertResource(new Time())` | **Registry** + World.resources | 注册 + 存单例 |
| `app.addSystems(Update, [s1, s2])` | **Schedule** | 编排执行顺序 |
| `app.addPlugin(p)` | 由 p.build(app) 决定 | 通常动上面三者 |
| `world.spawn()` | **World** | 分配 entity id |
| `world.insert(e, new Stats())` | **World**（需要问 Registry 翻译） | 存实例 |
| `world.query(Stats)` | **World**（需要问 Registry 翻译） | 取数据 |
| `app.run()` | **Schedule** 驱动 World | 帧循环 |
| 编辑器画 Inspector | **Registry**（读 schema） | 类型元信息 |
| Prefab 反序列化 | Registry（取 ctor） + World（插入） | 两步协作 |

## 五、一个类比帮你固化记忆

用图书馆做类比：

- **ComponentRegistry = 图书分类编目系统**
  维护一张表："Stats 类图书的编号是 0，Hitbox 类是 1……" 它不存书，只管分类。

- **World = 图书馆的书架和借阅记录**
  按编号把书放到对应货架，记录哪位读者（entity）借了哪些书（component）。找书时先问编目系统"Stats 是几号"，再去对应货架拿。

- **App = 图书馆本身**
  有开门时间（`run` 循环）、有运营规则（`Plugin` 装配）、对外提供借书还书服务（`registerComponent` / `addSystems`）。读者（用户代码）只跟图书馆打交道，不直接接触编目系统或货架。

这个类比里：

- 编目系统独立存在（能单独打印出来做目录）
- 货架和编目绑定（换了编号表，货架全乱）
- 图书馆协调两者，提供统一的对外服务

## 六、一段代码看完整关系

把三者的最小可用版本放一起，你可以直接看懂：

```ts
// ========== ComponentRegistry ==========
export class ComponentRegistry {
  private _nextId = 0;
  private _byCtor = new Map<ComponentCtor, ComponentMeta>();
  private _byId: ComponentMeta[] = [];

  register(name: string, ctor: ComponentCtor): ComponentMeta {
    if (this._byCtor.has(ctor)) return this._byCtor.get(ctor)!;
    const meta = { id: this._nextId++, name, ctor };
    this._byCtor.set(ctor, meta);
    this._byId[meta.id] = meta;
    return meta;
  }

  idOf(ctor: ComponentCtor): number {
    const m = this._byCtor.get(ctor);
    if (!m) throw new Error(`Not registered: ${ctor.name}`);
    return m.id;
  }
}

// ========== World ==========
export class World {
  private storages: ComponentStorage<any>[] = [];
  private nextEntity = 0;

  constructor(private registry: ComponentRegistry) {}   // ← 依赖注入

  spawn(): Entity { return this.nextEntity++; }

  insert<T extends object>(entity: Entity, value: T): void {
    const id = this.registry.idOf(value.constructor as ComponentCtor);
    (this.storages[id] ??= new ComponentStorage()).insert(entity, value);
  }

  query<T>(ctor: new () => T): Iterable<[Entity, T]> {
    const id = this.registry.idOf(ctor);
    return this.storages[id]?.iter() ?? [];
  }
}

// ========== App ==========
export class App {
  readonly registry = new ComponentRegistry();
  readonly world = new World(this.registry);            // ← 绑定
  private schedules = new Map<ScheduleLabel, Schedule>();

  registerComponent(name: string, ctor: ComponentCtor): this {
    this.registry.register(name, ctor);
    return this;
  }

  addSystems(label: ScheduleLabel, systems: System[]): this {
    (this.schedules.get(label) ?? this.schedules.set(label, new Schedule()).get(label)!)
      .add(systems);
    return this;
  }

  addPlugin(p: Plugin): this {
    p.build(this);
    return this;
  }

  run(): void {
    const loop = () => {
      for (const s of this.schedules.values()) s.run(this.world);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }
}
```

看这段代码几个要点：

- **App 持有 Registry 和 World**（`readonly` 字段）
- **World 的构造函数接收 Registry**（依赖注入）
- **Registry 完全不知道 World 和 App 的存在**（最底层，零依赖）
- **App 的 registerComponent 是 registry.register 的语义化包装**（门面模式）
- **run 循环把 World 传给 Schedule**（数据流向）

## 七、几个容易混淆的点

**Q：为什么不把 Registry 合并进 World？**
因为"类型元信息"和"实例数据"的生命周期不同。Registry 在 Plugin.build 阶段一次性填好就几乎不变；World 每帧都在增删改。放一起会让 World 类膨胀、难测。另外编辑器可能只用 Registry 不要 World。

**Q：为什么不把 Schedule 放进 World？**
Schedule 不存数据，只存执行顺序。World 是"数据"，Schedule 是"行为"，分开符合 ECS "数据和行为分离" 的核心理念。

**Q：App 是不是多余的？直接用 World 不行吗？**
不行。App 承担的是"装配"和"驱动"职责——Plugin 系统、Schedule 编排、rAF 循环这些都和数据存取无关。没有 App，用户就要自己写一大堆胶水代码。

**Q：能有多个 World 吗？**
可以。高级场景比如"主场景 + 小地图独立 World"、编辑器的"运行时预览子 World"都会用到。但一个 App 通常只有一个主 World，多 World 是进阶话题，起步不用管。

**Q：能有多个 Registry 吗？**
技术上可以（每个 World 配一个 Registry），但通常**一个 App 共享一个 Registry**。因为 component class 是全局概念（`Stats` 这个 class 在哪个 World 里都是同一个 class），拆多个 Registry 会导致 id 不一致、prefab 跨 World 失效。

---

## 总结

**三者的职责可以用这样一句话记住**：

> Registry 是"有哪些类型"的目录，World 是"现在有哪些实例"的仓库，App 是"把一切串起来"的司令部。

**依赖方向**：App → {Registry, World, Schedule}，World → Registry，Registry → nobody。

**协作模式**：
- 装配期（Plugin.build）：App 调用 Registry 注册类型、调用 Schedule 编排 system
- 运行期（每帧）：App 驱动 Schedule 跑 system，system 通过 World 读写数据，World 通过 Registry 翻译类型

**对你的项目**：这三个文件放在 `packages/core/` 下，是整个架构的基石。写对了，上面的 engine / plugin / game / editor 全都水到渠成；写错了，后面每一层都要打补丁。值得花时间把这三者的边界想透再动键盘。