# mote 引擎 API 稳定性契约

> 本文档描述 `mote-engine` 公开 API 的稳定性边界。
> **当前版本：0.1.0**（遵循 SemVer）

---

## 1. 稳定核心（Stable Core）

以下符号构成 v1.0 长期契约。重命名、改签名、改语义 = breaking change，必须走 deprecation 流程。

### 1.1 入口门面

| 符号 | 形态 | 说明 |
|---|---|---|
| `ENGINE_VERSION` | `string` | SemVer 版本常量 |
| `App` | class | 唯一装配门面，见下方锁定方法 |
| `Time` | class | 时间管理资源（`dt / fixedDt / elapsed / frame`） |

**App 锁定方法：**
- `addPlugin(plugin)` / `addPlugins(plugins[])`
- `addSystems(label: ScheduleLabel, systems: SystemObj[])`
- `registerComponent(ctor)` / `registerPrefab(id, prefab)`
- `insertResource(value)` / `insertResource(key, value)` / `getResource<T>(key)`
- `onSystemError(handler)` / `getSystemTimings()`
- `run()` / `stop()` / `update(dt)` / `render()`

### 1.2 调度与系统

| 符号 | 形态 | 说明 |
|---|---|---|
| `ScheduleLabel` | enum | 9 个阶段：Startup / First / PreUpdate / FixedUpdate / Update / PostUpdate / PreRender / Render / Last |
| `SystemObj` | interface | `{ name?: string; update(world, dt, cmd): void }` |
| `Plugin` | interface | `{ name; dependencies?; build(app); teardown?(app) }` |

### 1.3 ECS 数据层

| 符号 | 形态 | 说明 |
|---|---|---|
| `World` | class | `spawn/destroy/isAlive/ref/add/remove/get/has/query` |
| `Entity` | class | `id` + `add/remove/get/has/destroy`（World 的便捷封装） |
| `EntityId` | type | `number`，**不会**改为 branded type |
| `QueryBuilder` | class | `with/without/each/[Symbol.iterator]/length/empty/first/toArray` |
| `Snapshot` | class | 不透明类型，`snapshot()` / `restore(snap)` |

### 1.4 命令缓冲区

| 符号 | 形态 | 说明 |
|---|---|---|
| `Commands` | class | `spawn(config?) / entity(eid) / destroy(eid) / flush()` |
| `EntityCommands` | class | `readonly id / add(cls, data?) / remove(cls)` |

### 1.5 注册表与资源

| 符号 | 形态 | 说明 |
|---|---|---|
| `ComponentRegistry` | class | `register / has / names / count / get / getOrThrow / schemas / attachSchemas` |
| `ComponentMeta` | interface | 元信息类型 |
| `ResourceStore` | class | `insert / get / tryGet / has / remove` |

### 1.6 预制与事件

| 符号 | 形态 | 说明 |
|---|---|---|
| `definePrefab` | function | 辅助函数，类型检查 |
| `PrefabStore` | class | `register / replace / get / getOrThrow / has / ids / clear` |
| `EventBus` | class | `on / off / emit / enqueue / clear` |

### 1.7 类型层

| 符号 | 形态 | 说明 |
|---|---|---|
| `ComponentClass<T>` | type | `new () => T`，无参构造函数约束 |
| `ComponentMap` | interface | 通过 `declare module` 扩展，供 `SpawnConfig` 类型推导 |
| `SpawnConfig` | type | 基于 `ComponentMap` 的声明式配置 |
| `Prefab` | interface | `id? / name? / components / children?` |
| `InstanceTypes<T>` | type | 从 `ComponentClass[]` 提取实例类型元组 |
| `ComponentSchema` / `PropertySchema` / `PropType` | type | 编辑器 schema 类型 |

### 1.8 插件层（Plugins）

插件层组件、系统和工具函数在 **v0.2.0 前** 可能微调，但不涉及 breaking change：
- `TransformPlugin`、`InputPlugin`、`AudioPlugin`、`PhysicsPlugin`、`TilemapPlugin`
- `GfxPlugin`、`SpritePlugin`
- 各插件暴露的 Component class（`Transform`、`Velocity`、`Sprite` 等）
- 图形设备抽象接口（`IGfxDevice` 系列）

---

## 2. @internal 约定

以下符号**不计入稳定 API**。虽然可能在运行时可见，但后端重构时可自由变更：

- `ComponentRegistry` 上的 `idOf / metaById / idOfName / nameOf`（运行时数字 id 不稳定）
- `World` 上的 `_internalQuery`（供 QueryBuilder 内部使用）
- `Snapshot` 上的 `_data` 字段（内部快照数据结构）
- `EntityCommands` 和 `Commands` 的 `flush()` 调用时机（由调度器内部控制）

引擎内部约定：
- 私有字段以 `_` 开头
- `@internal` JSDoc 标注的方法/属性不对外承诺

---

## 3. SemVer 与弃用策略

| 版本变化 | 允许操作 |
|---|---|
| **patch** (0.1.1) | bug 修复、性能优化、文档更新 |
| **minor** (0.2.0) | 新增 API、新增 `ScheduleLabel`（仅追加）、新增组件 |
| **major** (1.0.0) | 删除 API、改签名、改语义 |

**弃用流程：**
1. 标记 `@deprecated` JSDoc + 说明替代方案
2. 至少保留 **一个 minor 版本** 的过渡期
3. 下一个 major 版本移除

---

## 4. Unspecified Behavior（未指定行为）

用户代码**不得依赖**以下行为，后端重构时可能变更：

- **遍历顺序**：`QueryBuilder` 的迭代顺序、`EntityId` 的分配顺序
- **迭代中增删**：`each()` 回调或 `for...of` 遍历中直接 `world.add/remove/destroy` 是未定义行为，请使用 `cmd`
- **组件存储实现**：当前是 `Map`，未来可能换 archetype / sparse set
- **数字 id 稳定性**：`ComponentRegistry` 分配的数字 id 仅在当前会话内有效
- **QueryBuilder 延迟执行**：`_entities` 在首次读取时计算，builder 链上 `.with/.without` 的顺序影响结果但不影响性能特征

---

## 5. Headless 模式

**文档级契约：**
- `app.update(dt)` 不调用 `render()` 即等价 headless
- 所有渲染相关副作用必须放在 `PreRender` / `Render` 阶段
- 渲染系统（如 `spriteRenderSystem`）应检查资源存在性后安全返回
- headless 模式下不创建 `GfxPlugin`，不初始化 WebGPU / WebGL2

---

## 6. 版本历史

| 版本 | 日期 | 变更 |
|---|---|---|
| 0.1.0 | 2026-05-09 | API 冻结：Commands、QueryBuilder、Snapshot、SystemObj、诊断钩子、Plugin 循环检测 |
| 0.0.2 | — | 初始版本 |
