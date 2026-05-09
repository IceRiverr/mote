# Prefab 工作流设计规范

版本：1.0.0 | 日期：2026-04-18

---

## 1. 概述

本文档定义微尘编辑器 Prefab 系统的完整工作流设计，涵盖创建、编辑、使用、场景实例管理四个阶段的交互规范和实现方案。

### 1.1 背景

当前 Prefab 系统已具备基础的创建、预览、放置能力，但核心的**编辑**环节缺失——用户无法通过 UI 修改 Prefab 定义，只能手动编辑 JSON 文件。本文档的目标是补全这一缺口，并建立完整的 Prefab 编辑循环。

### 1.2 Prefab 的定位

微尘的 Prefab 采用**渐进式**定位：当前阶段保持单实体、多组件的简单模型，数据结构和编辑流程为未来的多实体、嵌套 Prefab 预留扩展空间。

| 阶段 | 能力 | 参考 |
|------|------|------|
| **当前** | 单实体、多组件、支持 Override | Tiled Tile + Unity 简单 Prefab |
| **中期** | 多实体（子实体层级） | Unity Prefab |
| **远期** | 嵌套 Prefab、Prefab Variant | Unity Nested Prefab / Prefab Variant |

---

## 2. 数据结构

### 2.1 Prefab 定义（.mote-prefab.json）

```typescript
interface Prefab {
  id: string;            // 唯一标识
  name: string;          // 显示名称
  tags: string[];        // 分类标签（用于 Shift+A 快捷面板分类）
  components: {          // 组件模板（默认值）
    Transform: {
      x: number;         // 默认偏移（通常为 0）
      y: number;
      rotation: number;
      scaleX: number;
      scaleY: number;
    };
    Sprite?: {
      atlas: string;     // Sprite Sheet 路径
      frame: string;     // 帧名称
      layer: number;
      tint: string;      // 默认色调
      flipX: boolean;
      flipY: boolean;
      alpha: number;
      visible: boolean;
    };
    Collider?: {
      shapes: Shape[];
      isTrigger: boolean;
      material: string;
      layer: number;
      mask: number;
    };
    [key: string]: ComponentData | undefined;
  };
}
```

### 2.2 场景实体（SceneEntity）

```typescript
interface SceneEntity {
  id: string;            // 实例唯一 ID
  prefab: string;        // 引用 Prefab 文件路径
  overrides?: {          // 仅存储与 Prefab 定义的差异
    [componentName: string]: Partial<ComponentData>;
  };
}
```

**关键设计**：场景实体通过 `prefab` 字段引用 Prefab 文件路径，通过 `overrides` 存储与 Prefab 定义的差异值。运行时属性 = Prefab 定义 + overrides 合并。

### 2.3 属性合并规则

```typescript
function resolveEntityProperty(
  entity: SceneEntity,
  prefab: Prefab,
  componentName: string,
  propertyName: string
): any {
  const override = entity.overrides?.[componentName]?.[propertyName];
  if (override !== undefined) {
    return override;  // 使用实例覆盖值
  }
  return prefab.components[componentName]?.[propertyName];  // 使用 Prefab 默认值
}
```

---

## 3. 现有能力盘点

### 3.1 能力矩阵

| 阶段 | 已有能力 | 缺失能力 | 状态 |
|------|---------|---------|------|
| **创建** | Content Browser → "+" → 新建空白 Prefab（仅 Transform） | ❌ 从 Sprite 帧快速创建 Prefab | 部分完成 |
| **创建** | — | ❌ 从场景实体保存为 Prefab | 缺失 |
| **编辑** | 只能手动编辑 JSON 文件 | ❌ Prefab Editor（UI 编辑） | **核心缺口** |
| **预览** | Prefab Preview 面板（只读，显示组件信息 + 缩略图） | ✅ | 已完成 |
| **放置** | 笔刷放置 / Shift+A 快捷选择 / 拖拽到 Viewport / 实例化按钮 | ✅ | 已完成 |
| **场景编辑** | Inspector 显示合并属性，修改写入 override | ❌ 不区分 base vs override 的可视化 | 数据层完成，UI 层缺失 |
| **场景编辑** | — | ❌ Apply to Prefab / Revert to Prefab | 缺失 |

### 3.2 核心发现

1. **Override 机制在数据层已经存在**（SceneEntity.overrides 字段），缺的只是 UI 层的可视化和操作入口
2. **Prefab Editor 是唯一的结构性阻塞项**——没有它，用户创建 Prefab 后无法修改
3. **从 Sprite 帧创建 Prefab** 的路径需要完善——这是最高频的创建场景

---

## 4. 完整工作流设计

### 4.1 工作流全景图

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
                     修改组件属性 / 增删组件 / 保存
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
                    修改属性 → 自动记录 override
                    Apply to Prefab ← 同步回定义
                    Revert to Prefab ← 恢复默认
                    Open Prefab ← 跳转编辑器
```

### 4.2 创建 Prefab

#### 路径 A：从空白创建

```
Content Browser → "+" → 新建 Prefab → 输入名称
→ 自动生成 { Transform } 的空白 Prefab
→ 自动打开 Prefab Editor
```

已有能力，无需改动。建议新增"创建后自动打开 Prefab Editor"。

#### 路径 B：从 Sprite 帧创建

```
Sprite Editor → 选中帧 → "生成 Prefab" 按钮
→ 自动创建 { Transform, Sprite(atlas+frame) } 的 Prefab
→ 可选：自动添加 Collider（如果帧有碰撞数据）
```

需要完善的创建路径。支持批量操作：多选帧 → "批量生成 Prefab" → 每帧一个 Prefab，自动命名。

#### 路径 C：从场景实体创建

```
场景中选中 Entity → Inspector → "保存为 Prefab" 按钮
→ 将当前 Entity 的完整属性（base + override 合并后的值）打包为新 Prefab
→ 弹出保存对话框，选择路径和名称
→ 原实例的 prefab 字段更新为新 Prefab 路径，overrides 清空
```

新增的创建路径。

#### 路径 D：从已有的 Prefab 直接复制一个，然后在此基础上继续修改

---

## 5. Prefab Editor 设计

### 5.1 设计原则

- **升级而非新建**：在现有 Prefab Preview 面板基础上添加编辑能力，不新建面板
- **单列表单**：与右侧 Properties 面板风格一致，不引入左右分栏
- **显式保存**：底部提供保存/重置按钮，不自动保存（防止误操作）

### 5.2 面板布局

```
┌─────────────────────────────────────────┐
│ Prefab Editor                      [×]  │
├─────────────────────────────────────────┤
│  [🎨缩略图]  Name: [Player        ]     │
│              ID:   player               │
│              Tags: [characters ▼]       │
│              Path: assets/prefabs/...   │
├─────────────────────────────────────────┤
│ 组件                                     │
│ ┌─ ● Transform ─────────────── ✕ ──┐   │
│ │  x        [0    ]                  │   │
│ │  y        [0    ]                  │   │
│ │  rotation [0    ]                  │   │
│ │  scaleX   [1    ]                  │   │
│ │  scaleY   [1    ]                  │   │
│ └────────────────────────────────────┘   │
│ ┌─ ● Sprite ───────────────── ✕ ───┐   │
│ │  atlas    [assets/player.png]  [📁]│   │
│ │  frame    [frame_0         ]  [🔍]│   │
│ │  layer    [30   ]                  │   │
│ │  tint     [■ #ffffff]              │   │
│ │  flipX    [☐]                      │   │
│ │  alpha    [1.0  ]                  │   │
│ └────────────────────────────────────┘   │
│ ┌─ ● Collider ─────────────── ✕ ───┐   │
│ │  ...                               │   │
│ └────────────────────────────────────┘   │
│                                          │
│ [+ 添加组件]                              │
├─────────────────────────────────────────┤
│  💾 保存    🔄 重置                      │
└─────────────────────────────────────────┘
```

### 5.3 功能说明

| 区域 | 功能 | 说明 |
|------|------|------|
| **缩略图** | Prefab 的视觉预览 | 实时反映 Sprite 组件的当前帧 |
| **元信息** | Name / Tags 可编辑，ID / Path 只读 | Tags 支持下拉选择 + 自定义输入，用于 Shift+A 面板分类 |
| **组件列表** | 显示 Prefab 包含的所有组件 | 每个组件可折叠/展开 |
| **组件属性** | 所有字段均可编辑 | 修改的是 Prefab 定义的默认值 |
| **✕ 按钮** | 移除组件 | Transform 组件不可删除（保护） |
| **+ 添加组件** | 弹出组件选择下拉 | 列出所有已注册的组件类型，已添加的组件灰显 |
| **💾 保存** | 写回 .mote-prefab.json | 保存后触发场景中所有引用该 Prefab 的实例刷新 |
| **🔄 重置** | 恢复到上次保存状态 | 丢弃当前未保存的修改 |

### 5.4 打开方式

| 入口 | 操作 | 说明 |
|------|------|------|
| Content Browser | 双击 Prefab | Reuse-or-Split 打开 Prefab Editor（对齐资源交互设计 v2.0） |
| 场景 Inspector | 点击 "Open Prefab" 按钮 | 跳转到 Prefab Editor，加载该实例引用的 Prefab |
| 创建后自动打开 | 新建 Prefab | 创建完成后自动打开 Prefab Editor |

### 5.5 保存后实例同步

Prefab Editor 保存后，需要同步更新场景中的所有引用实例：

```typescript
function onPrefabSaved(prefabPath: string, newPrefab: Prefab) {
  // 遍历场景中所有实体
  for (const entity of scene.entities) {
    if (entity.prefab !== prefabPath) continue;

    // 重新计算合并属性：新的 Prefab 默认值 + 实例 override
    const resolved = mergeProperties(newPrefab, entity.overrides);

    // 更新实体的运行时属性
    updateEntityRuntime(entity.id, resolved);

    // 刷新 Viewport 中的渲染
    refreshEntityInViewport(entity.id);
  }

  // 如果 Inspector 正在显示该 Prefab 的实例，刷新 Inspector
  refreshInspectorIfNeeded(prefabPath);
}
```

---

## 6. 场景中的实例编辑

### 6.1 Inspector 中的 Prefab 实例显示

选中场景中的 Prefab 实例时，Inspector 显示：

```
┌─ Player (Entity) ──────────────────────┐
│ Prefab: assets/prefabs/player.mote-... │
│                                         │
│ ┌─────────────┬──────────────┐         │
│ │ Apply All   │ Revert All   │         │
│ └─────────────┴──────────────┘         │
│ ┌─────────────┐                        │
│ │ Open Prefab │ ← 跳转到 Editor       │
│ └─────────────┘                        │
│                                         │
│ ▸ Transform                             │
│  ┃ x: 320        ◀── 蓝色左边框 = override │
│  ┃ y: 240        ◀── 蓝色左边框 = override │
│    rotation: 0                          │
│    scaleX: 1                            │
│    scaleY: 1                            │
│                                         │
│ ▸ Sprite                                │
│    atlas: assets/player.png             │
│    frame: frame_0                       │
│  ┃ tint: #ff0000  ◀── 蓝色边框 + 强调色  │
│    layer: 30                            │
│    alpha: 1.0                           │
│                                         │
└─────────────────────────────────────────┘
```

### 6.2 属性状态的视觉区分

| 状态 | 视觉表现 | 说明 |
|------|---------|------|
| **继承属性**（和 Prefab 一致） | 普通颜色，无边框，可编辑 | 值等于 Prefab 默认值 |
| **Override 属性**（和 Prefab 不同） | 蓝色左边框 + 值用强调色 | 值存在于 entity.overrides 中 |
| **Hover Override 属性** | Tooltip 显示 Prefab 原始值 | 帮助用户对比差异 |

### 6.3 属性编辑行为

所有属性（无论继承还是 override）均**可编辑**，修改后系统自动追踪 override 状态：

```typescript
function onEntityPropertyChanged(
  entity: SceneEntity,
  prefab: Prefab,
  componentName: string,
  propertyName: string,
  newValue: any
) {
  const prefabDefault = prefab.components[componentName]?.[propertyName];

  if (deepEqual(newValue, prefabDefault)) {
    // 值等于 Prefab 默认值 → 删除 override（恢复为继承）
    delete entity.overrides?.[componentName]?.[propertyName];
    // 清理空对象
    if (isEmpty(entity.overrides?.[componentName])) {
      delete entity.overrides?.[componentName];
    }
  } else {
    // 值不等于 Prefab 默认值 → 记录为 override
    entity.overrides ??= {};
    entity.overrides[componentName] ??= {};
    entity.overrides[componentName][propertyName] = newValue;
  }
}
```

**核心设计**：用户不需要"解锁"继承属性才能编辑——直接改就行，系统自动判断是否产生 override。如果改回和 Prefab 默认值一样，override 自动消失。

### 6.4 操作按钮

| 操作 | 位置 | 行为 |
|------|------|------|
| **Apply All** | Inspector 顶部 | 将当前实例的所有 overrides 合并回 Prefab 定义 → 保存 Prefab 文件 → 清空该实例的 overrides → 触发其他实例同步 |
| **Revert All** | Inspector 顶部 | 清空当前实例的所有 overrides，恢复为 Prefab 默认值 |
| **单属性 Revert** | 右键 Override 属性 → "重置为 Prefab 值" | 删除该属性的 override |
| **组件级 Revert** | 组件标题栏 🔄 按钮（仅当该组件有 override 时显示） | 删除该组件所有 override |
| **Open Prefab** | Inspector 顶部 | Reuse-or-Split 打开 Prefab Editor，加载该实例引用的 Prefab |

### 6.5 Apply to Prefab 的完整流程

```typescript
function applyToPrefab(entity: SceneEntity) {
  // 1. 读取 Prefab 定义
  const prefab = loadPrefab(entity.prefab);

  // 2. 将 override 合并到 Prefab 定义
  for (const [compName, overrideProps] of Object.entries(entity.overrides ?? {})) {
    prefab.components[compName] ??= {};
    Object.assign(prefab.components[compName], overrideProps);
  }

  // 3. 保存 Prefab 文件
  savePrefab(entity.prefab, prefab);

  // 4. 清空当前实例的 override
  entity.overrides = undefined;

  // 5. 触发所有引用该 Prefab 的实例同步（和 Prefab Editor 保存逻辑复用）
  onPrefabSaved(entity.prefab, prefab);
}
```

---

## 7. 创建路径补全

### 7.1 从 Sprite 帧创建 Prefab

这个已经存在。

```
Sprite Editor → 选中一个或多个帧 → "生成 Prefab" 按钮
```

**单帧创建**：

```typescript
function createPrefabFromFrame(atlas: string, frame: string): Prefab {
  return {
    id: generateId(),
    name: frame,       // 默认用帧名作为 Prefab 名
    tags: [],
    components: {
      Transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      Sprite: {
        atlas,
        frame,
        layer: 0,
        tint: '#ffffff',
        flipX: false,
        flipY: false,
        alpha: 1,
        visible: true,
      },
    },
  };
}
```

**批量创建**：多选帧 → 每帧一个 Prefab，自动命名为帧名，保存到同一目录。

**可选增强**：如果帧有碰撞数据（Sprite Editor 中定义的碰撞形状），自动添加 Collider 组件。

### 7.2 从场景实体创建 Prefab

```
场景中选中 Entity → Inspector → "保存为 Prefab" 按钮
→ 弹出保存对话框（路径 + 名称）
→ 将当前 base + override 合并后的值打包为新 Prefab
→ 原实例的 prefab 字段更新为新 Prefab 路径
→ 原实例的 overrides 清空
```

```typescript
function createPrefabFromEntity(entity: SceneEntity, savePath: string, name: string) {
  const currentPrefab = loadPrefab(entity.prefab);

  // 合并当前实例的完整属性
  const mergedComponents: Record<string, ComponentData> = {};
  for (const [compName, compData] of Object.entries(currentPrefab.components)) {
    mergedComponents[compName] = {
      ...compData,
      ...entity.overrides?.[compName],
    };
  }

  // 创建新 Prefab
  const newPrefab: Prefab = {
    id: generateId(),
    name,
    tags: [],
    components: mergedComponents,
  };

  // 保存
  savePrefab(savePath, newPrefab);

  // 更新实例引用
  entity.prefab = savePath;
  entity.overrides = undefined;
}
```

---

## 8. 设计决策记录

| 编号 | 决策 | 理由 |
|------|------|------|
| D1 | Prefab Editor 通过升级 Prefab Preview 实现，而非新建面板 | Preview 已有缩略图和组件列表，升级为可编辑是自然演进 |
| D2 | Prefab Editor 采用单列表单布局 | 与现有 Properties 面板风格一致；单实体 Prefab 不需要层级面板 |
| D3 | 显式保存（💾 按钮），不自动保存 | 防止误操作；保存触发全实例同步，需要用户主动确认 |
| D4 | Transform 组件不可删除 | Transform 是所有实体的基础组件，删除会导致实例无法定位 |
| D5 | 场景中所有属性均可编辑（包括继承属性） | 避免"解锁"步骤增加操作复杂度；修改后自动追踪 override |
| D6 | Override 用蓝色左边框标记，值用强调色 | 比粗体更醒目，不依赖字体变化 |
| D7 | 编辑值等于 Prefab 默认值时自动删除 override | 保持 overrides 最小化，避免冗余数据 |
| D8 | Apply to Prefab 后清空当前实例 overrides | Apply 的语义是"我的修改应该成为新的默认值"，之后该实例不再有差异 |
| D9 | 从场景实体创建 Prefab 后更新实例引用 | 实例自动关联新 Prefab，保持数据一致性 |
| D10 | Hover Override 属性时 Tooltip 显示 Prefab 原始值 | 帮助用户对比差异，决定是否 Revert |

---

## 9. 实施计划

### Step 1：Prefab Editor 基础编辑器（最高优先级）

**目标**：让用户可以通过 UI 编辑 Prefab 定义，不再需要手动改 JSON。

| 任务 | 说明 | 工作量 |
|------|------|--------|
| 升级 Prefab Preview → Prefab Editor | 在现有 Preview 面板基础上添加编辑能力 | 中 |
| 元信息编辑 | Name / Tags 可编辑（Tags 支持下拉 + 自定义） | 小 |
| 组件属性编辑 | 所有组件的所有字段可编辑，复用现有 Inspector 属性编辑控件 | 中 |
| 添加组件 | "+" 按钮 → 组件选择下拉，列出所有已注册组件类型 | 小 |
| 移除组件 | 组件标题栏 ✕ 按钮（Transform 不可删除） | 小 |
| 保存 / 重置 | 底部按钮，保存写回 .mote-prefab.json；重置恢复上次保存 | 小 |
| 保存后实例同步 | 遍历场景实体，刷新非 override 属性 | 中 |
| 双击打开 | Content Browser 双击 → Reuse-or-Split 打开 Prefab Editor | 小 |

**总工作量**：大

### Step 2：Override 可视化 + Apply / Revert

**目标**：场景中的实例编辑能清晰区分"继承自 Prefab"和"本实例覆盖"。

| 任务 | 说明 | 工作量 |
|------|------|--------|
| Override 视觉标记 | 蓝色左边框 + 值用强调色，利用已有 overrides 数据驱动 | 中 |
| Hover 原始值 | Tooltip 显示 Prefab 默认值 | 小 |
| 编辑自动追踪 | 修改继承属性自动写入 overrides；值等于默认则自动删除 | 中 |
| 单属性 Revert | 右键属性 → "重置为 Prefab 值" | 小 |
| 组件级 Revert | 组件标题栏 🔄 按钮 | 小 |
| Revert All | Inspector 顶部按钮 | 小 |
| Apply to Prefab | Inspector 顶部按钮，合并 overrides 回 Prefab → 保存 → 清空 → 同步 | 中 |
| Open Prefab | Inspector 中按钮，跳转到 Prefab Editor | 小 |

**总工作量**：中

### Step 3：创建路径补全

**目标**：补全从 Sprite 帧和场景实体创建 Prefab 的快捷路径。

| 任务 | 说明 | 工作量 |
|------|------|--------|
| 从 Sprite 帧创建 | Sprite Editor 选中帧 → "生成 Prefab"，自动填充 Transform + Sprite | 小 |
| 批量从 Sprite 帧创建 | 多选帧 → "批量生成 Prefab"，每帧一个 | 小 |
| 从场景实体创建 | Inspector → "保存为 Prefab"，合并 base + override 为新 Prefab | 中 |
| 创建后自动打开 | 新建 Prefab 后自动打开 Prefab Editor | 小 |

**总工作量**：小

---

## 10. 后续扩展

| 功能 | 说明 | 阶段 |
|------|------|------|
| **多实体 Prefab** | 一个 Prefab 包含多个子实体，Prefab Editor 加入实体层级面板 | 中期 |
| **嵌套 Prefab** | Prefab 中引用其他 Prefab 作为子实体 | 远期 |
| **Prefab Variant** | 基于一个 Prefab 创建变体，继承基础 Prefab 并覆盖部分属性 | 远期 |
| **Undo / Redo** | Prefab Editor 和场景 Inspector 中的编辑操作支持撤销/重做 | 中期 |
| **Diff 视图** | 对比 Prefab 定义和实例 override 的完整差异列表 | 中期 |
| **批量 Apply / Revert** | 选中多个实例，批量操作 | 中期 |
| **Prefab 引用查找** | 右键 Prefab → "查找引用" → 列出所有使用该 Prefab 的场景/位置 | 中期 |
