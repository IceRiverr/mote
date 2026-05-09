# Prefab 工作流设计规范（修订版 v2）

版本：2.0.0 | 日期：2026-04-18 | 基于 review 后修订

---

## 1. 问题陈述

当前 Prefab 系统具备基础的创建、预览、放置能力，但核心的**编辑**环节缺失，且现有数据结构存在引用冗余（`id` 与文件名重复）、Transform override 语义混乱（`x !== 0` 哨兵值 bug）、以及深浅拷贝边界不清等问题。本文档重新定义 Prefab 的数据结构、标识体系和完整工作流，补全编辑循环，并为 Engine-Editor 边界建立清晰契约。

---

## 2. Phase 1：约束收集

| 问题 | 回答 |
|------|------|
| **1. 生命周期** | `Prefab` 是长期存在的资源定义（项目级）；`SceneEntity` 是会话级编辑数据；Engine World 中的 entity 是帧级运行时对象，且**不追踪 Prefab 来源**（一次性展开）。 |
| **2. 所有权** | Editor 拥有 `Prefab` JSON 和 `SceneEntity`；Engine 拥有 `World` + `Component`。Editor 通过外部映射（`Map<entityId, prefabPath>`）维护 Prefab 实例关系，Engine 对此一无所知。 |
| **3. 变更模式** | Prefab 定义：写极少、读极多；Scene 中 entity override：高频写（Inspector 编辑）。Prefab 保存后需 Editor 侧主动同步到 Engine，Engine 不自动刷新。 |
| **4. 跨边界** | 单向流：Prefab JSON → Engine `applyOverrides` → `World.spawn()`。Editor 保存 Prefab 后，通过外部映射找到 Engine entity 并手动更新组件数据。Engine → Editor 无反向依赖。 |
| **5. 序列化** | `.mote-prefab.json` 必须 survive save/load，属于资源格式；`Scene` 格式也须版本化。两者均使用纯 JSON，带 `version` 字段。 |
| **6. 现有模式** | ① `ComponentRegistry` + `component-schemas.json` 提供组件元数据，可驱动 Inspector UI 生成；② `scene-commands.ts` 已建立纯函数 Command 模式（execute/undo/redo），Prefab Editor 应复用。 |

---

## 3. Phase 2：架构决策

### AD1：Prefab 标识体系 — 文件路径推导 ID

**Decision：** 删除 Prefab 文件内部的 `id` 字段；`Prefab.id` 在运行时由**相对路径（不含扩展名）**推导，如 `assets/npcs/enemy` → `npcs/enemy`。`name` 保留为可选显示字段，默认使用文件名最后一段（不含扩展名）。

**Alternatives considered：**
- A1. 维持内部 `id` 字段，强制全局唯一
- A2. 仅文件名（不含路径）作为 ID

**Rationale：** 现有项目中 `id` 与文件名完全冗余（`player.mote-prefab.json` 内 `"id": "player"`）。由路径推导 ID 既避免了重复存储，又通过相对路径（含目录）保证了跨目录唯一性。文件系统天然保证同目录下无重名。

**Tradeoff accepted：** 文件重命名/移动会断裂所有场景引用。这是与 Godot/Unity 一致的行为，由用户承担重构成本。

---

### AD2：Transform 存储语义 — 独立固有字段

**Decision：** `SceneEntity` 增加 `transform: { x, y, rotation, scaleX, scaleY }` 作为**独立固有字段**，与 `overrides` 分离。`overrides` 仅存储非 Transform 组件的差异。

**Alternatives considered：**
- B1. 始终在 `overrides` 中存储完整 Transform（Unity 式）
- B2. 维持现状（`x !== 0` 才写 overrides）

**Rationale：** 位置是场景实例的**存在性属性**，不是"覆盖默认值"。现有代码 `x !== 0` 的哨兵值判断导致 x=0 时错误继承 Prefab 的默认值（如 Prefab 默认 x=100，实例放 x=0 会显示在 100）。Godot 也将 Transform 作为实例节点固有属性处理。

**Tradeoff accepted：** `Scene` 序列化格式变化，需要一次数据迁移（当前项目数据量极小，可手动处理或写一次性脚本）。

---

### AD3：Engine-Editor 边界 — Engine 零感知

**Decision：** Engine 运行时**不维护任何 Prefab 来源信息**。Prefab 实例化是一次性展开：Editor 读取 `.mote-prefab.json` → `applyOverrides(base, overrides)` → `World.add(entity, components)`。Engine 得到的是完整独立的 entity 和组件。Editor 通过独立的外部映射 `Map<entityId, prefabPath>` 追踪哪些 Engine entity 来自哪个 Prefab。

**Alternatives considered：**
- C1. 增加 `PrefabRef` Component（Engine 侧标记来源）
- C2. 惰性重建（不实时同步，场景导出时重新 spawn）

**Rationale：** Engine 必须保持独立，Prefab 是 Editor/用户概念。用户应能仅通过 VS Code 编辑 `.mote-prefab.json` 并在代码中直接 spawn。Editor 只是 Engine 的可选包装。

**Tradeoff accepted：** Prefab 保存后，Editor 需要自行遍历外部映射找到受影响 entity 并手动更新 Engine World。若映射丢失或不同步，可能漏刷新。

---

### AD4：组件数据合并 — 全局深拷贝

**Decision：** 所有涉及 Prefab 组件数据合并的操作（`applyOverrides`、Inspector 合并显示、Apply to Prefab、从场景实体创建 Prefab）统一使用 `structuredClone` 进行**深拷贝**。

**Alternatives considered：**
- D1. 只在关键路径（Apply/Create）深拷贝，日常读取浅拷贝
- D2. `JSON.parse(JSON.stringify())` 实现深拷贝

**Rationale：** Prefab 组件数据量极小（通常 3-5 个组件，每个 5-10 个字段），性能开销可忽略。浅拷贝会导致数组/对象引用共享（如 `Collider.shapes`），修改一个实例意外影响其他实例，bug 极难调试。我们的数据是纯 JSON，无任何 `structuredClone` 不支持的类型。

**Tradeoff accepted：** 略微增加内存分配，但 GC 压力可忽略。

---

### AD5：Prefab Editor 实现路径 — 升级 Preview 面板 + 编辑状态隔离

**Decision：** 在现有 `PrefabPreviewEditor` 基础上升级为可编辑的 `PrefabEditor`，但引入独立的**编辑状态层**（`editingPrefab: Signal<{ path: string; draft: Prefab } | null>`）。所有编辑操作在 draft 上进行，保存时才写回 `prefabs` Signal 和 `PrefabFS`。属性编辑控件复用现有的 `ComponentPanel` + `PropertyField`。

**Alternatives considered：**
- E1. 新建独立面板
- E2. 直接在 `prefabs` Signal 上原地修改，无 draft 层

**Rationale：** 复用 Preview 的布局和缩略图是务实路径。引入 draft 层符合 `mote-design` 中"Editor state 与 engine state 分离"的要求，支持显式保存/重置，且为 Undo/Redo 预留命令接口。

**Tradeoff accepted：** `PrefabPreviewEditor` 的代码需要从纯展示态重构为编辑态，组件内引入状态管理复杂度。

---

### AD6：Override 可视化 — 属性级自动追踪

**Decision：** Inspector 中所有属性（包括继承自 Prefab 的）均可直接编辑。编辑后系统**自动比较**新值与 Prefab 默认值：若不同则写入 `overrides`，若相同则自动删除 `overrides` 中对应字段。Override 状态用**蓝色左边框** + 值用强调色标记。Hover 时 Tooltip 显示 Prefab 原始值。

**Alternatives considered：**
- F1. 需要先"解锁"继承属性才能编辑（Unity Legacy 式）
- F2. 整组件级 override（当前 `EntityInspector` 的组件级覆盖）

**Rationale：** 属性级自动追踪避免了"解锁"步骤的操作复杂度，用户体验更流畅。数据层只存差异，保持 overrides 最小化。

**Tradeoff accepted：** Inspector 的 `onChange` 处理器需要逐个属性深比较，而非整组件覆盖，实现比当前 `EntityInspector` 略复杂。

---

## 4. 提议 API

### 4.1 数据类型（TypeScript）

```typescript
// packages/editor/src/data/Prefab.ts

export interface Prefab {
  /** 文件格式版本 */
  version: number;

  /** 显示名称（可选，默认用文件名） */
  name?: string;

  /** 分类标签（用于 Shift+A 面板分组） */
  tags?: string[];

  /** 组件模板（默认值） */
  components: PrefabComponents;
}

export interface PrefabComponents {
  [componentName: string]: Record<string, any>;
}

// 运行时推导的 ID（不存储在文件中）
export type PrefabId = string; // 相对路径，不含扩展名，如 "npcs/enemy"
```

```typescript
// packages/editor/src/data/Scene.ts

export interface SceneEntity {
  /** 实体唯一 ID */
  id: string;

  /** 引用 Prefab 的推导 ID（相对路径） */
  prefab: PrefabId;

  /** 显示名称覆盖（可选） */
  name?: string;

  /** 父实体 ID（可选） */
  parent?: string | null;

  /** 实例固有 Transform（不是 override） */
  transform: {
    x: number;
    y: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
  };

  /** 组件属性覆盖（仅非 Transform 组件的差异） */
  overrides?: {
    [componentName: string]: Record<string, any>;
  };

  /** 是否可见 */
  visible?: boolean;
}

export interface Scene {
  /** 场景格式版本 */
  version: number;

  id: string;
  name: string;
  path?: string;
  width: number;
  height: number;
  grid: GridSettings;
  entities: SceneEntity[];
}
```

### 4.2 函数签名

```typescript
// packages/editor/src/fs/PrefabFS.ts

/** 从文件路径推导 Prefab ID */
export function derivePrefabId(relativePath: string): PrefabId;
// e.g. "assets/npcs/enemy.mote-prefab.json" → "npcs/enemy"

/** 从 Prefab ID 推导默认显示名 */
export function derivePrefabName(relativePath: string): string;
// e.g. "assets/npcs/enemy.mote-prefab.json" → "enemy"

/** 加载 Prefab（自动填充 name 默认值） */
async function loadFromPath(filePath: string): Promise<Prefab | null>;
```

```typescript
// packages/engine/src/core/prefab.ts

/** 深合并 Prefab 组件配置和 override */
export function applyOverrides(base: ComponentData, overrides: ComponentData): ComponentData;
// 内部统一使用 structuredClone，保证完全独立
```

```typescript
// packages/editor/src/data/Scene.ts

/** 创建场景实体（始终写入完整 transform） */
export function createSceneEntity(
  prefabId: PrefabId,
  transform: { x: number; y: number; rotation?: number; scaleX?: number; scaleY?: number },
  options?: {
    id?: string;
    name?: string;
    parent?: string | null;
    overrides?: Record<string, Record<string, any>>;
  }
): SceneEntity;

/** 计算实体的完整组件数据（Prefab 默认值 + overrides） */
export function resolveEntityComponents(
  entity: SceneEntity,
  prefab: Prefab
): Record<string, Record<string, any>>;
```

---

## 5. 数据结构

### 5.1 `.mote-prefab.json` 文件格式（v2）

```json
{
  "version": 2,
  "kind": "prefab",
  "name": "Goblin",
  "tags": ["enemies", "ground"],
  "components": {
    "Transform": {
      "x": 0,
      "y": 0,
      "rotation": 0,
      "scaleX": 1,
      "scaleY": 1
    },
    "Sprite": {
      "atlas": "enemies.png",
      "frame": "goblin_idle",
      "layer": 10,
      "tint": "#ffffff",
      "flipX": false,
      "flipY": false,
      "alpha": 1,
      "visible": true
    },
    "Collider": {
      "shapes": [
        { "type": "rect", "width": 16, "height": 16 }
      ],
      "isTrigger": false,
      "material": "default",
      "layer": 1,
      "mask": 4294967295
    }
  }
}
```

**变更点（对比 v1）：**
- 新增 `"version": 2`
- 新增 `"kind": "prefab"`（用于未来打包格式的自我识别，同时避免与 JS `type` 关键字冲突）
- 删除 `"id"` 字段
- `name` 变为可选，省略时由 Editor 推导为文件名

### 5.2 `.mote-scene.json` 文件格式（v2）

```json
{
  "version": 2,
  "kind": "scene",
  "id": "level1",
  "name": "Level 1",
  "path": "assets/level1.mote-scene.json",
  "width": 640,
  "height": 480,
  "grid": {
    "enabled": true,
    "size": 32,
    "snap": true,
    "color": "rgba(255,255,255,0.2)"
  },
  "entities": [
    {
      "id": "e_k7a2p9",
      "prefab": "player",
      "transform": {
        "x": 320,
        "y": 240,
        "rotation": 0,
        "scaleX": 1,
        "scaleY": 1
      },
      "overrides": {
        "Sprite": {
          "tint": "#ff0000"
        }
      }
    }
  ]
}
```

**变更点（对比 v1）：**
- 新增 `"version": 2`
- 新增 `"kind": "scene"`
- `prefab` 字段从完整路径改为推导 ID（相对路径不含扩展名）
- 新增独立 `"transform"` 字段，移出 `overrides`
- `overrides` 中不再包含 `Transform`

### 5.3 Engine 运行时 ComponentData

保持不变，因为 Engine 不感知 Prefab 结构，只接收合并后的组件配置：

```typescript
interface ComponentData {
  [componentName: string]: Record<string, any>;
}
```

---

## 6. 模块放置

### 6.1 Engine 侧（`packages/engine/`）

| 文件 | 职责 |
|------|------|
| `src/core/prefab.ts` | `definePrefab`、`PrefabStore`、`applyOverrides`（改为深拷贝） |

**Engine 不做任何改动来支持 Prefab 工作流。** `applyOverrides` 的深拷贝变化是数据安全修复，不改变 API 签名。

### 6.2 Editor 侧（`packages/editor/`）

| 文件 | 职责 | 变更 |
|------|------|------|
| `src/data/Prefab.ts` | `Prefab` / `PrefabComponents` 接口、工厂函数 | 删除 `id` 字段；`createPrefab` 不再生成 `id`；新增 `derivePrefabId` |
| `src/data/Scene.ts` | `Scene` / `SceneEntity` 接口、工厂函数、工具函数 | `transform` 变为独立字段；`createSceneEntity` 签名变更；新增 `resolveEntityComponents` |
| `src/fs/PrefabFS.ts` | Prefab 文件读写、扫描、缓存 | `loadFromPath` 自动推导并填充默认 `name`；删除 `idToPath` 映射 |
| `src/store/prefabs.ts` | Prefab Signal 状态管理 | 以 `PrefabId`（推导路径）为键，而非文件路径 |
| `src/store/scene.ts` | Scene Signal 状态管理 | 适配新 `SceneEntity` 结构 |
| `src/editors/prefab-preview/PrefabPreviewEditor.tsx` | 升级为 Prefab Editor | 增加编辑态（draft Signal）、保存/重置按钮、组件增删 |
| `src/components/inspector/EntityInspector.tsx` | 场景中实例的属性面板 | 适配独立 `transform` 字段；实现属性级 override 追踪和可视化 |
| `src/components/inspector/ComponentPanel.tsx` | 组件折叠面板 | 新增 `isOverride` prop，支持蓝色边框样式 |
| `src/commands/prefab-commands.ts` | **新增** Prefab Editor 的 Command | `EditPrefabPropertyCommand`、`AddPrefabComponentCommand`、`RemovePrefabComponentCommand`、`SavePrefabCommand` |

### 6.3 依赖方向

```
PrefabFS / Prefab (data) → prefabs (store)
                                    ↓
PrefabPreviewEditor (editor) ← ComponentPanel / PropertyField (shared-ui)
                                    ↓
scene (store) → EntityInspector (inspector)
                    ↑
            SceneFS / Scene (data)
```

Engine 不依赖任何 Editor 模块。Editor 通过 `applyOverrides` + `World.add()` 单向操作 Engine。

---

## 7. 工作流全景（v2）

```
                    ┌──────────────────┐
                    │   创建 Prefab    │
                    └────────┬─────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
     路径 A：空白创建   路径 B：Sprite 帧   路径 C：场景实体
     Content Browser    Sprite Editor      选中 Entity
     → "+" 新建        → "生成 Prefab"    → "保存为 Prefab"
              │              │              │
              └──────────────┼──────────────┘
                             ▼
                    ┌──────────────────┐
                    │  编辑 Prefab     │
                    │  (Prefab Editor) │
                    └────────┬─────────┘
                             │
                     双击打开 / 从 Inspector "Open Prefab"
                     在 draft 上修改 → 💾 保存 / 🔄 重置
                     保存时 structuredClone 写回文件
                             │
                             ▼
                    ┌──────────────────┐
                    │  Editor 同步到   │
                    │  Engine World    │
                    └────────┬─────────┘
                             │
              通过外部映射 Map<entityId, prefabId>
              找到受影响实体 → world.set() 更新组件
                             │
                             ▼
                    ┌──────────────────┐
                    │  使用 Prefab     │
                    └────────┬─────────┘
                             │
              ┌──────────┬───┼───┬──────────┐
              ▼          ▼   ▼   ▼          ▼
           笔刷放置  Shift+A  拖拽  实例化按钮  快捷键
              │          │   │   │          │
              └──────────┴───┼───┴──────────┘
                             ▼
                    ┌──────────────────┐
                    │  场景中编辑实例   │
                    │  (Inspector)     │
                    └────────┬─────────┘
                             │
              transform 直接修改实体位置
              其他属性 → 自动比较 Prefab 默认值 → 写入/删除 override
              Apply to Prefab → merge overrides 回 Prefab → 保存 → 触发同步
              Revert to Prefab → 删除 overrides → 恢复默认值
```

---

## 8. 实施计划（v2）

### Step 1：数据结构重构（阻塞项）

| 任务 | 文件 | 说明 |
|------|------|------|
| 更新 `Prefab` 接口 | `data/Prefab.ts` | 删除 `id`，新增 `version: 2`；`derivePrefabId` / `derivePrefabName` |
| 更新 `SceneEntity` 接口 | `data/Scene.ts` | `transform` 独立字段；`createSceneEntity` 签名变更；`resolveEntityComponents` |
| 更新 `Scene` 接口 | `data/Scene.ts` | 新增 `version: 2` |
| 更新 `PrefabFS` | `fs/PrefabFS.ts` | 删除 `idToPath`；以路径为键；自动填充默认 `name` |
| 深拷贝 `applyOverrides` | `engine/src/core/prefab.ts` | 改用 `structuredClone` |
| 数据迁移脚本 | 一次性 | 遍历现有 `.mote-prefab.json` 删除 `id`、添加 `version: 2`；遍历 `.mote-scene.json` 提取 transform、转换 `prefab` 为推导 ID |

### Step 2：Prefab Editor

| 任务 | 说明 |
|------|------|
| 升级 `PrefabPreviewEditor` → `PrefabEditor` | 引入 `editingPrefab` draft Signal；元信息编辑（name/tags）；组件属性编辑（复用 `ComponentPanel`） |
| 组件增删 | "+ 添加组件"下拉（基于 `component-schemas.json`）；组件标题栏 ✕ 删除（Transform 保护） |
| 保存/重置 | `SavePrefabCommand` 写回 `PrefabFS`；`ResetCommand` 恢复 draft；保存后通过外部映射触发 Engine 同步 |
| 双击打开 | Content Browser 双击 → Reuse-or-Split 打开 Prefab Editor |
| Prefab Command 实现 | `EditPrefabPropertyCommand`、`AddPrefabComponentCommand`、`RemovePrefabComponentCommand` |

### Step 3：Inspector Override 可视化

| 任务 | 说明 |
|------|------|
| `resolveEntityComponents` 集成 | Inspector 用该函数计算 merged 属性 |
| 属性级 override 追踪 | `onChange` 逐属性深比较 Prefab 默认值；自动写入/删除 override |
| 视觉标记 | `ComponentPanel` 接收 `isOverride` prop；蓝色左边框 + 强调色值 |
| Hover Tooltip | 显示 Prefab 原始值 |
| Apply / Revert | `ApplyToPrefabCommand`（合并 overrides 回 Prefab → 保存 → 清空 overrides → 触发同步）；`RevertAllCommand`；单属性 Revert；组件级 Revert |
| "Open Prefab" 按钮 | Inspector 顶部跳转 |

### Step 4：创建路径补全

| 任务 | 说明 |
|------|------|
| Sprite 帧生成 Prefab | 已有，确认 `version: 2` 格式 |
| 批量生成 | 多选帧 → 每帧一个 Prefab |
| 场景实体保存为 Prefab | Inspector 按钮；合并 `transform` + `overrides` 为新 Prefab；更新实例引用 |
| 创建后自动打开 | 新建/生成 Prefab 后自动打开 Editor |

---

## 9. 开放问题（Open Questions）

| # | 问题 | 当前处理 | 建议时机 |
|---|------|---------|---------|
| Q1 | 文件重命名/移动后的场景引用修复 | 当前断裂，无自动修复 | 中期：实现"查找缺失引用"工具 |
| Q2 | Prefab 删除时场景中的实例如何处理 | 未定义（当前会显示 Missing Prefab） | 中期：提供"断开连接"或"保留占位符"选项 |
| Q3 | Tags 预设分类体系 | 完全自由输入 | 中期：引擎侧预设常用标签枚举 + 自定义 |
| Q4 | Undo/Redo 在 Prefab Editor 中的完整支持 | Step 2 预埋 Command 接口，但未接入全局 history stack | Step 2 完成后接入 `editor-commands` history |
| Q5 | 多实体 Prefab / 嵌套 Prefab | 明确列为远期扩展 | 远期 |
| Q6 | 运行时（无 Editor）加载 `.mote-prefab.json` | 未定义公共 API；用户需要手动 `fetch` + `JSON.parse` + `applyOverrides` + `World.add()` | 中期：提供 `loadPrefabFromURL()` 辅助函数 |

---

> **破坏性重构声明**：本设计为 v2 格式，不保留对 v1 格式的兼容逻辑。实施时直接重写现有数据文件，不编写迁移脚本。

---

*文档结束。本设计基于 `mote-design` skill 规范（Phase 1 约束收集 + Phase 2 显式决策记录），所有 API 和数据结构均已定位到具体文件路径。*
