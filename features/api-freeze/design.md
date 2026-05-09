# mote 引擎 v1.0 API 冻结设计

## 问题

将 `packages/engine/src/index.ts` 暴露的公开 API 锁定为长期契约，让后端（World 存储从 Map 换 archetype、调度器从 for 循环换并行图、渲染加 WebGL2 fallback）可以自由重写，**不破坏任何用户系统代码**。

## 约束

- **生命周期**：API 契约长期锁定（v1.0 后 breaking change 需 deprecation 周期），后端实现短期迭代
- **数据归属**：引擎 `core/` 层公开 API，`plugins/` 层按需暴露；不涉及编辑器数据层
- **变更模式**：用户系统代码只通过 App facade + World 数据契约交互，**绝不依赖任何底层存储细节**
- **已有模式**：
  - Bevy：Commands 参数注入、Plugin 系统、SystemObj 形态
  - 现有 mote 代码：7 个系统全部是纯函数 `SystemFn`，`ComponentMap` declaration merging 是 `SpawnConfig` 类型基础设施

## 关键决策

### 1. System 形态：SystemObj 为主，SystemFn 兼容

- 公开导出 `SystemObj`（`name? + update`），不导出 `SystemFn` 类型
- `addSystems` 签名收 `SystemObj[]`，内部自动把函数包装成对象（保留函数名）
- 调度器不 `bind(sys)`，完整 `SystemObj` 保留到运行时，用于诊断和可视化
- 替代：强制全部改对象形态（B）——迁移成本太高，拒绝

### 2. Commands：参数注入 + Bevy 式预分配

- 系统签名锁定：`update(world: World, dt: number, cmd: Commands): void`
- `World` 内部新增 `reserveEntity(): EntityId`（预分配 id，alive 但无组件）
- `cmd.spawn(config)` 返回 `EntityCommands`（链式），`.id` 是**真实有效 id**，可立刻引用
- `EntityCommands` 接口：`add(cls, data?) / remove(cls)`，不暴露 `id` setter
- flush 时机：由调度器控制（v1.0 可在 `Last` 阶段自动 flush）
- 替代：World 挂载 `world.commands()`（B）——耦合存储实现，拒绝

### 3. Query：Builder 模式 + 泛型类型推导

- `world.query(...)` 统一返回 `QueryBuilder`（延迟构建），保留现有 `for...of` 和 `each` 语法
- `QueryBuilder.with(...).without(...)` 链式过滤
- 泛型累积推导：`world.query(Transform).with(Velocity).each((t, v, eid) => { ... })` 中参数类型自动推断
- 替代：分离入口 `world.query()` + `world.queryBuilder()`（B）——两套类型体系，拒绝

### 4. 父子关系：Plugin 提供，不进 core

- `World` 不原生提供 `setParent / getChildren / getParent`
- `TransformPlugin` 或独立 `HierarchyPlugin` 通过 `Parent` / `Children` 组件实现
- v1.0 文档明文写死边界
- Prefab.children 在 plugin 未加载时 flat spawn（无 parent 绑定）
- 替代：core 原生（A）——实验场网站不需要，core 膨胀，拒绝

### 5. Snapshot：只锁接口，实现先用简单版

- `Snapshot` 为不透明类型，用户不能 `new` 或解构
- `world.snapshot(): Snapshot` / `world.restore(snap): void`
- v1.0 内部先用 deep clone，资源不进 snapshot
- 替代：可扩展快照 + 自定义序列化器（B）——v1.0 做不完，拒绝

### 6. Plugin：循环检测 + teardown 反序

- `addPlugin` 调用栈追踪检测循环依赖，发现立即抛错
- `app.stop()` 反向遍历 `_plugins`（build 的逆序）调用 `teardown`
- `teardown` 可选，不实现的 skip

### 7. 诊断钩子：两个接口

- `app.onSystemError((name, error, label) => { ... })`
- `app.getSystemTimings(): Map<string, number>`
- 每个系统独立 try-catch，抛错回调但不中断帧

### 8. PrefabStore：update 删除，改为 replace

- `register(id, prefab)` + `replace(id, prefab)` 语义对称
- `replace` 语义明确为"覆盖已有定义，只影响后续 spawn"
- 替代：删除不留 replace（A）——"后悔药"有保留价值，拒绝

### 9. ComponentMap：保留 declaration merging

- 6 个插件全部在用，是 `SpawnConfig` 类型推导的基础设施
- 砍字符串查询入口——`World.get/add/remove/has` 只接受 `ComponentClass<T>`，无字符串重载
- 文档承诺"组件查询只接受 class"

### 10. ResourceStore：收敛命名

- `add` → `insert`，删 `replace`
- 统一为 `insert(value | key, value) / get / tryGet / has / remove`

### 11. Headless：文档级契约，不新增 API

- `app.update(dt)` 不调用 `render()` 即等价 headless
- 渲染副作用仅限 `PreRender / Render` 阶段
- 不新增 `runHeadless()` 或构造器选项

### 12. 版本与弃用策略

- `ENGINE_VERSION` 遵循 SemVer，改完发 `0.1.0`
- `@deprecated` JSDoc + 至少一个 minor 版本过渡期
- `_xxx` 私有字段、`@internal` JSDoc 标注的导出符号不计入稳定 API

## 数据结构

```ts
// === System ===
export interface SystemObj {
  name?: string;
  update(world: World, dt: number, cmd: Commands): void;
}

// === Commands ===
export interface Commands {
  spawn(config?: SpawnConfig): EntityCommands;
  entity(eid: EntityId): EntityCommands;
  destroy(eid: EntityId): void;
}

export interface EntityCommands {
  readonly id: EntityId;
  add<T>(cls: ComponentClass<T>, data?: Partial<T>): this;
  remove<T>(cls: ComponentClass<T>): this;
}

// === Query ===
export class QueryBuilder<T extends ComponentClass[] = []> {
  with<U extends ComponentClass[]>(...components: U): QueryBuilder<[...T, ...U]>;
  without<U extends ComponentClass[]>(...components: U): QueryBuilder<T>;
  each(fn: (...args: [...InstanceTypes<T>, EntityId]) => void): void;
  [Symbol.iterator](): Iterator<EntityId>;
  get length(): number;
  get empty(): boolean;
  first(): EntityId | undefined;
  toArray(): EntityId[];
}

// === Snapshot ===
export class Snapshot {
  private constructor();
  // 用户不可 new、不可解构
}

// === Plugin ===
export interface Plugin {
  readonly name: string;
  readonly dependencies?: readonly Plugin[];
  build(app: App): void | Promise<void>;
  teardown?(app: App): void;
}

// === App 新增方法 ===
export class App {
  onSystemError(handler: (name: string, error: Error, label: ScheduleLabel) => void): this;
  getSystemTimings(): Map<string, number>;
}

// === ResourceStore 收敛 ===
export class ResourceStore {
  insert<T>(value: T): void;
  insert<T>(key: string | ComponentClass<T>, value: T): void;
  get<T>(key: string | ComponentClass<T>): T;
  tryGet<T>(key: string | ComponentClass<T>): T | undefined;
  has(key: string | ComponentClass<any>): boolean;
  remove(key: string | ComponentClass<any>): boolean;
}
```

## 文件结构

### 修改文件

| 文件 | 改动内容 |
|---|---|
| `packages/engine/src/core/system.ts` | 导出收敛为 `SystemObj`，不导出 `SystemFn`、`System` union |
| `packages/engine/src/core/app.ts` | 调度器保留 `SystemObj` 完整对象（不 bind）；新增 `onSystemError` / `getSystemTimings`；Plugin 循环检测 + teardown 反序；`insertResource` 走 `ResourceStore` 新接口 |
| `packages/engine/src/core/world.ts` | 新增 `reserveEntity()`；新增 `snapshot() / restore()`；资源接口收敛 |
| `packages/engine/src/core/query.ts` | `QueryResult` 改名为 `QueryBuilder`；加泛型参数；实现 `with / without`；`each` 类型推导 |
| `packages/engine/src/core/resource.ts` | `add` → `insert`，删 `replace` |
| `packages/engine/src/core/componentRegistry.ts` | `idOf / metaById / idOfName / nameOf` 标 `@internal`，不删除但降级为内部方法 |
| `packages/engine/src/core/prefab.ts` | 删 `mergeSpawnConfig`；`PrefabStore.update` → `replace` |
| `packages/engine/src/core/index.ts` | 移除 `mergeSpawnConfig`、SystemFn、ComponentRegistry 内部方法等导出 |
| `packages/engine/src/core/entity.ts` | 如有需要配合 `EntityCommands` 调整 |
| `packages/engine/src/plugins/*/systems.ts`（7 个） | 系统签名从 `(world, dt)` 改为 `(world, dt, cmd)` |
| `packages/engine/src/plugins/*/plugin.ts`（6 个） | `addSystems` 传入数组形态不变（内部自动包装） |

### 新增文件

| 文件 | 说明 |
|---|---|
| `packages/engine/src/core/commands.ts` | `Commands` + `EntityCommands` 接口与默认实现 |
| `packages/engine/src/core/snapshot.ts` | `Snapshot` 不透明类型定义 |

### 文档文件

| 文件 | 说明 |
|---|---|
| `packages/engine/API_STABILITY.md` | 稳定 API 列表、@internal 约定、SemVer 规则、unspecified behavior 列表 |

## 修订记录

（编码完成后追加）
