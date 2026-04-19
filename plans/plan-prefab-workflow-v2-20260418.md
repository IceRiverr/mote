# Prefab Workflow v2 开发计划

基于设计文档：`designs/design-prefab-workflow-v2-20260418.md`
日期：2026-04-18

---

## Overview

**Total tasks:** 18
**Estimated phases:** 4
**Critical path:** Foundation (Prefab/Scene types) → PrefabFS → Core Commands → PrefabEditor → Inspector override → Engine sync

**高亮约束：**
- 破坏性重构：不兼容 v1 格式，直接重写数据结构
- Engine 零改动原则：Engine 侧只修复 `applyOverrides` 深拷贝
- 复用现有基础设施：`ComponentPanel` / `PropertyField` / Command 模式

---

## Phase 1: Foundation（数据 & 类型）

**目标：** 所有核心数据结构更新完毕，TypeScript 编译通过，现有测试数据可丢弃。

**依赖图：**
```
Task 1 → Task 4 → Task 5
    ↘
     Task 2
    ↗
Task 3 (engine)
```

### 1. 重写 `data/Prefab.ts` 为 v2 格式
→ verify: `derivePrefabId("assets/npcs/enemy.mote-prefab.json")` 返回 `"npcs/enemy"`；`derivePrefabName` 返回 `"enemy"`；`createPrefab` 不再生成 `id`；`validatePrefab` 接受 `version: 2, kind: "prefab"`；TypeScript 编译零错误。

### 2. 重写 `data/Scene.ts` 为 v2 格式
→ verify: `createSceneEntity("player", {x: 100, y: 200})` 返回的 `entity.transform` 包含 `{x:100, y:200, rotation:0, scaleX:1, scaleY:1}` 且 `overrides` 为 `undefined`；`resolveEntityComponents(entity, prefab)` 返回深拷贝后的 merged 组件数据（`structuredClone` 验证引用隔离）；TypeScript 编译零错误。

### 3. 更新 `engine/src/core/prefab.ts` — `applyOverrides` 深拷贝
→ verify: `applyOverrides({Collider:{shapes:[{width:16}]}}, {Collider:{shapes:[{width:32}]}})` 返回的结果中 `result.Collider.shapes[0]` 与 `base.Collider.shapes[0]` 不是同一内存引用（`===` 为 `false`）。

### 4. 重写 `fs/PrefabFS.ts` — 删除 `idToPath`，以路径为键，自动填充 `name`
→ verify: `PrefabFS.scanPrefabs()` 后 `metaCache` 以文件路径为键；`idToPath` 字段不存在；加载无 `name` 的文件时 `prefab.name === derivePrefabName(path)`；删除/移动操作不依赖 `id`。TypeScript 编译零错误。

### 5. 更新 `store/prefabs.ts` — 以 `PrefabId` 为键
→ verify: `setPrefab("npcs/enemy", prefab)` 后 `getPrefab("npcs/enemy")` 返回正确值；`filteredPrefabs` / `prefabsByTag` 计算属性正常工作；`generateUniqueId` 基于推导 ID 工作。TypeScript 编译零错误。

---

## Phase 2: Core Logic（命令 & 工具函数）

**目标：** Prefab Editor 和 Inspector 所需的核心逻辑就绪，可独立于 UI 测试。

**依赖图：**
```
Task 1,4,5 → Task 6
Task 1,2   → Task 8
Task 5     → Task 7
```

### 6. 创建 `commands/prefab-commands.ts`
→ verify: `EditPrefabPropertyCommand` 修改 draft 的单个属性；`AddPrefabComponentCommand` 向 draft 添加新组件（默认值来自 `component-schemas.json`）；`RemovePrefabComponentCommand` 删除组件（Transform 不可删）；`SavePrefabCommand` 调用 `PrefabFS.save` 并更新 `prefabs` Signal。每个 Command 的 `undo()` 能恢复到执行前状态。

### 7. 实现 Prefab Editor 编辑状态层 — `store/prefabEditor.ts`（新增）
→ verify: `createDraft("npcs/enemy")` 从当前 `prefabs` Signal 复制出独立可编辑对象（`structuredClone`）；`discardDraft()` 清除 Signal；`getDraftChanges()` 返回与原始 Prefab 的差异列表（属性级）。TypeScript 编译零错误。

### 8. 实现 Inspector override 追踪工具 — `utils/override-utils.ts`（新增）
→ verify: `computeOverride(prefabValue, instanceValue)` 对相等的值（`deepEqual`）返回 `undefined`，对不同值返回 `instanceValue`；`resolveOverrideStatus(prefab, entity, "Sprite", "tint")` 返回 `{ value: "#ff0000", isOverride: true }` 或 `{ value: "#ffffff", isOverride: false }`。数组/对象深度比较正确。

---

## Phase 3: Integration（UI 重构 & 连线）

**目标：** 所有用户交互路径打通，end-to-end 可运行。

**依赖图：**
```
Task 6,7 → Task 9
Task 2,5,8 → Task 10
Task 10 → Task 12
Task 11 || Task 12
Task 12,6 → Task 13
Task 2,4 → Task 14
Task 5,9 → Task 15
```

### 9. 升级 `PrefabPreviewEditor` → 可编辑 `PrefabEditor`
→ verify: 面板显示 `name` 输入框和 `tags` 多选输入；组件列表通过 `ComponentPanel` 渲染且可编辑；"+ 添加组件"下拉列出 `component-schemas.json` 中未添加的组件；底部 💾 保存按钮触发 `SavePrefabCommand`；🔄 重置按钮触发 `discardDraft()`；保存后 `PrefabFS` 文件内容包含 `version:2, kind:"prefab"`。

### 10. 重构 `EntityInspector` 适配 v2 `SceneEntity`
→ verify: 选中实体后 Transform 直接显示 `entity.transform` 的值（x/y/rotation/scaleX/scaleY）且编辑时更新 `entity.transform` 而非 `overrides`；其他组件通过 `resolveEntityComponents` 合并显示；如果 Prefab 找不到（文件被删），显示错误提示而非崩溃。

### 11. 重构 `ComponentPanel` 支持 override 视觉标记
→ verify: 新增 `isOverride?: boolean` prop；`isOverride === true` 时属性值左侧有 2px 蓝色边框且文字颜色为强调色；不影响现有无 override 场景的渲染。Transform 组件在 Inspector 中始终显示为 `isOverride: false`（因为 transform 不再是 override）。

### 12. 实现 Inspector 属性级 override 编辑逻辑
→ verify: 修改一个继承属性（如 Sprite.tint）→ `entity.overrides.Sprite.tint` 被写入；将该属性改回 Prefab 默认值 → `entity.overrides.Sprite.tint` 被自动删除（若该组件无其他 override 则整个 `overrides.Sprite` 被删除）；`ComponentPanel` 正确根据计算出的 `isOverride` 切换视觉样式。使用 `deepEqual` 比较，数组/对象不误判。

### 13. 实现 Apply to Prefab / Revert to Prefab 命令和 UI
→ verify: Inspector 顶部显示 "Apply All" 和 "Revert All" 按钮；**Apply All** → 将当前实例的所有 overrides 合并回 Prefab（`structuredClone`）、保存 Prefab 文件、清空该实例的 overrides、触发 Engine 同步；**Revert All** → 清空当前实例的所有 overrides，属性立即恢复为 Prefab 默认值；单属性右键菜单显示 "重置为 Prefab 值" 并工作。

### 14. 实现从场景实体保存为 Prefab
→ verify: Inspector 顶部显示 "保存为 Prefab" 按钮；点击后弹出路径输入（模态框）；将 `entity.transform` + `entity.overrides` 合并为完整组件数据，创建新 Prefab 并保存；原实例的 `prefab` 字段更新为新推导 ID；`overrides` 清空；`transform` 保持不变。保存后自动打开 Prefab Editor。

### 15. 实现 Prefab 保存后的 Engine 同步
→ verify: Editor 维护 `Map<entityId, prefabId>`（在 `spawnPrefab` 时写入，删除 entity 时清理）；Prefab 保存后遍历该 Map，找到引用相同 `prefabId` 的 Engine entity；通过 `world.set(entityId, Component, data)` 更新非 override 的组件数据；Viewport 下一帧渲染反映新状态。

---

## Phase 4: Polish（入口 & 端到端测试）

**目标：** 所有创建/编辑/使用路径可完整走通，旧代码清理干净。

**依赖图：**
```
Task 9 → Task 16
Task 1 → Task 17
Task 9,13,15 → Task 18
Task 9,10,12 → Task 19
```

### 16. 更新 Content Browser 双击打开 Prefab Editor
→ verify: Content Browser 双击 Prefab 文件 → Reuse-or-Split 打开 Prefab Editor；Tab 标签显示 Prefab 名称；关闭 Editor 后重新双击同一文件能复用标签。

### 17. 更新 Sprite Editor 生成 Prefab 确认 v2 格式
→ verify: Sprite Editor "生成 Prefab" 产出的 `.mote-prefab.json` 包含 `"version": 2, "kind": "prefab"`；无 `"id"` 字段；`name` 默认为帧名；`Transform` 组件使用默认值。批量生成时每帧一个独立 Prefab，推导 ID 不冲突。

### 18. End-to-end 走通测试
→ verify: 完整走通以下路径且无报错：
1. Content Browser 新建空白 Prefab → 自动打开 Editor
2. 添加 Sprite 组件，设置 atlas/frame → 缩略图实时更新
3. 💾 保存 → 文件系统出现 `.mote-prefab.json`
4. 场景中 Shift+A 选择该 Prefab → 放置实例
5. Inspector 修改 Sprite.tint → 显示蓝色 override 边框
6. Apply to Prefab → 文件更新，场景中其他同 Prefab 实例同步变色
7. Revert → override 消失，恢复白色
8. 保存场景 → `.mote-scene.json` 包含 `"version": 2, "kind": "scene"` 和独立 `"transform"`

### 19. 清理旧 v1 兼容代码
→ verify: 删除 `data/Prefab.ts` 中的 `id` 相关参数和函数；删除 `fs/PrefabFS.ts` 中的 `idToPath` 及其所有引用；删除 `data/Scene.ts` 中的 `setEntityTransform`（已不需要哨兵值判断）；删除 `EntityInspector` 中旧版的整组件覆盖逻辑。TypeScript 编译零错误；运行时无残留 v1 字段。

---

## Risk Areas

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| **ComponentPanel/PropertyField 的复用深度** | Prefab Editor 和 Inspector 都需要属性编辑，但两者的 onChange 语义不同（Prefab 直接修改 draft，Inspector 需计算 override）。可能需要为 `PropertyField` 增加更灵活的 onChange 接口。 | 先复用现有接口，如果语义冲突过大，再抽象一个 `PropertyFieldBase` 共享底层渲染逻辑。 |
| **外部映射 `Map<entityId, prefabId>` 的同步泄漏** | Engine entity 被非 Editor 逻辑（如游戏运行时 System）销毁时，Editor 的 Map 不会自动清理，导致漏刷新或报错。 | 在 `removeEntity` 命令和 `world.entityRemoved` 事件（如有）中同步清理 Map。若 Engine 无 entity 销毁事件，则仅在 Editor 的删除路径清理，并添加定期校验。 |
| **ComponentPanel 样式改造的范围** | 当前 `ComponentPanel` 使用内联 style 对象，增加 `isOverride` 需要调整 props 接口，可能影响其他使用方。 | 检查 `ComponentPanel` 的现有引用（当前只有 `EntityInspector`），确认影响范围后再改。 |
| **深拷贝对特殊类型的影响** | `structuredClone` 不支持 function、Symbol、DOM 节点等。Prefab 数据是纯 JSON，但未来如果组件中有运行时状态字段（如 `velocityX`），深拷贝会丢失 prototype 方法。 | 当前Prefab数据限定为纯JSON可序列化对象。若未来需要特殊类型，提前在`component-schemas.json`中标记`serializable: false`字段，这些字段不参与clone。 |
| **Command 的 Undo 在 Prefab Editor 中的状态管理** | `SavePrefabCommand` 的 undo 需要回滚文件系统状态，但 `FileSystem` API 可能没有原子性的"恢复上次内容"操作。 | `SavePrefabCommand` 的 undo 实现为：保存前读取旧内容存入 Command 内部，undo 时写回旧内容。 |

---

## Open Questions

| # | 问题 | 可能触发阶段 | 建议处理 |
|---|------|-------------|---------|
| Q1 | `PropertyField` 当前是否支持所有 component-schemas.json 中的类型（color、asset reference 等）？ | Phase 3 Task 9 | 实施前检查 `PropertyField.tsx` 的实现，缺失类型先 mock 或补全。 |
| Q2 | Engine 是否有 `world.set(entityId, ComponentClass, data)` 这样的公共 API 供 Editor 更新已有 entity？ | Phase 3 Task 15 | ✅ **已确认**：没有 `world.set()`。同步逻辑通过 `world.get(eid, cls)` 拿到组件引用后直接修改字段。这是合法操作，不需要新增 Engine API。 |
| Q2.5 | Engine `Prefab` 接口有 `id: string`，但 v2 删除了文件内 `id`，如何对齐？ | Phase 1 Task 3 | ✅ **已决策（选项 C）**：Engine `Prefab` 接口删除 `id` 字段；`PrefabStore.register(id, prefab)` 改为双参数；`Prefab` 本身只存 `name`/`components`/`children`。 |
| Q3 | `component-schemas.json` 中的 `default` 值是字符串形式（如 `"[{ type: 'rect', width: 16, height: 16 }]"`），如何正确解析为实际默认值？ | Phase 2 Task 6 | 当前格式是字符串表达式，需要 `eval` 或手动解析。考虑改为纯 JSON 格式，但这超出本 plan 范围，可先 hardcode 常用组件的默认值。 |
| Q4 | Reuse-or-Split 的 Tab 管理机制是否已存在于编辑器框架中？ | Phase 3 Task 16 | 检查 `registerEditor` 和 Content Browser 的现有双击行为，确认 Reuse-or-Split 是否已有基础设施。 |

---

> **执行顺序原则**：按 Phase 1 → Phase 2 → Phase 3 → Phase 4 顺序实施。**不跨 Phase 并行**。每完成一个 Phase，做一次端到端冒烟测试，确认无回归后再进入下一 Phase。
