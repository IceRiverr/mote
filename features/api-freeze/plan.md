## 目标

按可见增量完成 mote 引擎 v1.0 API 冻结（10 条 design 决策落地），改完发 `0.1.0`。每个功能完成后引擎必须编译通过、现有系统行为不变。

## 前置检查

| 检查项 | 状态 | 说明 |
|--------|------|------|
| store 数据 | ✅ 无依赖 | 纯引擎重构，不碰编辑器数据层 |
| 标识符一致 | ✅ | `ComponentClass` 作 key 已统一 |
| 数据格式兼容 | ✅ | 不涉及磁盘格式变更 |
| 外部依赖 | ✅ | 无新增外部依赖 |

## 功能清单

### 功能 1：清理废弃 API + ResourceStore 命名收敛
- 从 `prefab.ts` 删除 `mergeSpawnConfig`（含别名和 `@deprecated`）
- 从 `core/index.ts` 移除 `mergeSpawnConfig` 导出
- `ResourceStore`：`add` → `insert`，删除 `replace` 方法
- `App.insertResource` 内部调用改为 `ResourceStore.insert`
- `World.addResource` 内部调用改为 `ResourceStore.insert`
→ 验证：
  1. `tsc --noEmit` 编译通过
  2. `grep -r "mergeSpawnConfig" packages/engine/src/` 返回空
  3. `grep -r "\.add\(" packages/engine/src/core/resource.ts` 只剩 `insert`
  4. Console 无 `[Resource] "xx" already exists` 类警告（插入语义正确）

### 功能 2：ComponentRegistry 内部方法降级
- `idOf / metaById / idOfName / nameOf` 方法添加 `@internal` JSDoc
- 从 `core/index.ts` 移除这 4 个方法的导出（`ComponentMeta` 类型保留导出）
- `core/index.ts` 中 `ComponentRegistry` 类本身仍导出
→ 验证：
  1. `tsc --noEmit` 编译通过
  2. 外部无法 `import { idOf } from '@mote/engine'`（TS 报错）
  3. 引擎内部调用 `registry.idOf(...)` 仍然工作

### 功能 3：System 形态收敛（SystemObj 为主，函数兼容）
- `system.ts`：只导出 `SystemObj`，不导出 `SystemFn`、`System` union
- `app.ts`：
  - `addSystems` 签名改为 `systems: readonly SystemObj[]`
  - 内部不再 `bind(sys)`，完整保留 `SystemObj`
  - `_schedules` 存储类型改为 `SystemObj[]`
  - 调度循环取 `sys.name` 和 `sys.update(world, dt, cmd)`
- `core/index.ts`：移除 `SystemFn`、`System` 导出
→ 验证：
  1. `tsc --noEmit` 编译通过
  2. `App.addSystems` 可以接受 `{ name: 'Foo', update: fn }` 和纯函数（后者自动包装）
  3. 调度器内部 `sys.name` 非 undefined（可用 console.assert 检查）

### 功能 4：Query 类型推导 + Builder 改造
- 新建 `packages/engine/src/core/query.ts`：
  - `QueryResult` 改名为 `QueryBuilder<T extends ComponentClass[]>`
  - 添加泛型参数 `T`
  - `each` 签名改为 `each(fn: (...args: [...InstanceTypes<T>, EntityId]) => void)`
  - 新增 `with<U>(...components: U): QueryBuilder<[...T, ...U]>`
  - 新增 `without<U>(...components: U): QueryBuilder<T>`
  - 保留 `[Symbol.iterator]`、`length`、`empty`、`first`、`toArray`
- `world.ts`：`query()` 返回类型改为 `QueryBuilder`
- `core/index.ts`：`QueryResult` 改名为 `QueryBuilder` 导出
→ 验证：
  1. `tsc --noEmit` 编译通过
  2. VS Code hover 验证：`world.query(Transform, Velocity).each((t, v, eid) => {})` 中 `t` 推断为 `Transform`
  3. `for (const eid of world.query(Transform))` 仍然工作
  4. `world.query(Transform).with(Velocity).without(Frozen).each(...)` 编译通过

### 功能 5：Commands 接口 + World.reserveEntity
- 新建 `packages/engine/src/core/commands.ts`：
  - `Commands` 类/接口
  - `EntityCommands` 类（`readonly id: EntityId; add(); remove()`）
- `world.ts`：新增 `reserveEntity(): EntityId`（分配 id，alive=true，空组件 Map）
- `app.ts`：
  - 调度循环创建 `Commands` 实例
  - 调用 `sys.update(world, dt, cmd)`
  - `Last` 阶段或每阶段末尾 `cmd.flush()`
- `core/index.ts`：导出 `Commands`、`EntityCommands`
→ 验证：
  1. `tsc --noEmit` 编译通过
  2. `cmd.spawn().id` 是真实有效 id（console.log 确认 > 0）
  3. `cmd.spawn().add(Transform).add(Velocity)` 链式编译通过
  4. flush 后实体实际存在：`world.isAlive(id) === true`

### 功能 6：所有系统签名改 `(world, dt, cmd)`
- 修改 7 个插件系统文件：
  - `transform/systems.ts`
  - `input/systems.ts`
  - `audio/systems.ts`
  - `physics/systems.ts`
  - `tilemap/systems.ts`
  - `sprite/systems.ts`（`spriteAnimationSystem`、`spriteRenderSystem`）
- 每个系统签名从 `(world: World, dt: number)` 改为 `(world: World, dt: number, cmd: Commands)`
- 系统内部如有 `world.spawn/destroy/add/remove` 直接调用，改为 `cmd.xxx`
→ 验证：
  1. `tsc --noEmit` 编译通过
  2. 运行现有 demo（如 sprite-demo），行为与之前一致
  3. Console 无 `[Commands] flush after frame` 类异常

### 功能 7：Snapshot 接口定义
- 新建 `packages/engine/src/core/snapshot.ts`：
  - `export class Snapshot { private constructor(); }`（不透明类型）
- `world.ts`：
  - 新增 `snapshot(): Snapshot`
  - 新增 `restore(snap: Snapshot): void`
  - v1.0 实现：deep clone `entityComponents` + `alive` Set
- `core/index.ts`：导出 `Snapshot`
→ 验证：
  1. `tsc --noEmit` 编译通过
  2. `const snap = world.snapshot()` 编译通过，无法 `new Snapshot()`
  3. `world.restore(snap)` 后查询结果与 snapshot 前一致

### 功能 8：诊断钩子（onSystemError + getSystemTimings）
- `app.ts`：
  - 新增 `onSystemError(handler)` 注册回调
  - 新增 `getSystemTimings(): Map<string, number>`
  - 调度循环每个系统独立 try-catch，抛错时调用所有 handler，不中断帧
  - dev mode 下每个系统前后 `performance.now()` 记录耗时
→ 验证：
  1. `tsc --noEmit` 编译通过
  2. 手动在系统中 `throw new Error('boom')`，确认 `onSystemError` 回调被触发，参数为 `(name, error, label)`
  3. 确认抛错后同帧后续系统仍然执行
  4. `app.getSystemTimings()` 返回非空 Map，key 为系统名

### 功能 9：Plugin 增强（循环检测 + teardown + PrefabStore.replace）
- `app.ts`：
  - `addPlugin` 加调用栈追踪循环检测
  - `stop()` 反向遍历 `_plugins` 调用 `teardown`
- `prefab.ts`：
  - 删除 `update` 方法
  - 新增 `replace(id, prefab)`
- `core/index.ts`：确认 `PrefabStore` 导出不变
→ 验证：
  1. `tsc --noEmit` 编译通过
  2. 构造循环依赖插件（A depends on B, B depends on A），确认 `addPlugin` 抛错
  3. `app.stop()` 时带 `teardown` 的插件被调用（console.log 验证）
  4. `prefabStore.replace('foo', newPrefab)` 后 `prefabStore.get('foo') === newPrefab`

### 功能 10：API_STABILITY.md 文档
- 新建 `packages/engine/API_STABILITY.md`：
  - 稳定 API 清单（11 条决策对应的公开符号）
  - `@internal` 约定说明
  - SemVer 规则 + deprecation 周期
  - unspecified behavior 列表（遍历顺序、迭代时增删等）
  - headless 模式文档承诺
→ 验证：
  1. 文档 markdown 渲染正常
  2. 清单与 `core/index.ts` 实际导出一致（手动对比）

## 依赖

```
功能 1 || 功能 2 || 功能 3 || 功能 9  (互相独立，可任意顺序)
功能 3 → 功能 4  (QueryBuilder 类型推导依赖 SystemObj 已定)
功能 3 → 功能 5  (Commands 系统签名和 SystemObj 相关)
功能 5 → 功能 6  (系统签名改 cmd)
功能 7 || 功能 8  (互相独立)
功能 3 → 功能 8  (诊断钩子依赖调度器结构)
功能 10 最后完成  (依赖所有前置功能定稿)
```

**推荐执行顺序**：1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9 → 10

## 执行中修订

（编码过程中追加）
