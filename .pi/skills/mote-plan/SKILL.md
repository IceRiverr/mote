---
name: mote-plan
description: 当用户说"plan"、"拆解任务"、"任务计划"、"execution plan"、"milestone"时触发。按用户可见功能增量拆解任务，每个功能可独立实现、立即测试。
---

# Mote 任务拆解与执行计划

> 把模糊需求变成可落地的功能清单。> 每个功能围绕一个**可见目标**——做完能打开编辑器验证。

---

## 何时使用本技能

- design 已明确大方向，需要拆解成可逐个实现的功能
- 用户说"怎么开始？""从哪下手？"
- design 中途推翻，需要调整计划

---

## 拆解原则

### 按"可见功能"拆，不按"技术阶段"拆

**❌ 不要这样拆：**
```
阶段 1：改类型定义
阶段 2：改序列化逻辑
阶段 3：改 UI 组件
```
做完阶段 1 和 2，打开编辑器**什么都看不到**。

**✅ 应该这样拆：**
```
功能 1：SceneTree 能显示 entity name
  - 改 SceneEntity 类型加 name 字段
  - 改 io.ts 序列化 name
  - SceneTree 组件显示 name
  → 验证：打开编辑器，能看到 name

功能 2：Inspector 能编辑 entity name
  - EntityInspector 加 name input
  - updateEntity 支持 name 字段
  → 验证：双击 entity，改 name，SceneTree 实时更新
```

每个功能包含它所需的数据+逻辑+UI，但**围绕一个用户可见目标**。

### 每个功能的标准格式

```
功能 N：[一句话描述可见目标]
  - [子任务 1：数据/类型]
  - [子任务 2：逻辑/Store]
  - [子任务 3：UI/接线]
  → 验证：[打开编辑器后做什么，期望看到什么]
  → 验证方式：[操作编辑器 / 文件检查 / 编译通过]
```

### 验证方式分类

| 方式 | 适用场景 | 例子 |
|---|---|---|
| **操作编辑器** | 有 UI 变更的功能 | "打开编辑器，SceneTree 显示 name" |
| **文件检查** | 序列化/格式变更 | "保存场景，检查 JSON 无 id 字段" |
| **编译通过** | 纯类型/重构 | "tsc --noEmit 零错误" |
| **命令测试** | undo/redo 功能 | "修改 → undo → redo，值正确" |

**默认优先"操作编辑器"验证。** 如果功能没有 UI，才用文件检查或编译。

---

## 计划流程

### Step 1：确认 design 边界

快速确认：
1. 这个功能最终用户在编辑器里看到什么？
2. 数据怎么存？（需要序列化吗？运行时-only 吗？）
3. 影响哪些现有文件？（新增文件？修改文件？）
4. 有没有"未决设计点"？（先标注，不阻塞拆解）

### Step 2：按可见功能拆

从用户的最终目标倒推，每个功能是一步可见的进展。

**示例："给 SceneEntity 加 name"**

❌ 旧拆法（按技术阶段）：
```
阶段 1：改 Scene 类型
阶段 2：改 io.ts
阶段 3：改 SceneTree
阶段 4：改 Inspector
```

✅ 新拆法（按可见功能）：
```
功能 1：SceneTree 显示 entity name
  - SceneEntity 类型加 name 字段
  - createSceneEntity 默认 name = prefabId
  - io.ts 序列化/反序列化 name
  - SceneTree 组件渲染 name
  → 验证：打开编辑器，放置 entity，SceneTree 能看到 "tiny-dungeon_frame_98_1"
  → 方式：操作编辑器

功能 2：Inspector 可编辑 entity name
  - EntityInspector 顶部加 name input
  - updateEntity 支持 name 字段
  - 失去焦点或回车时更新
  → 验证：选中 entity，Inspector 改 name 为 "wall_1"，SceneTree 实时更新
  → 方式：操作编辑器

功能 3：name 自动编号
  - 实现 getNextEntityName（最大编号+1）
  - spawnPrefab 用 getNextEntityName 生成 name
  - paintAt（笔刷）也用 getNextEntityName
  → 验证：连续放置 3 个同 prefab，name 为 _1, _2, _3；删除 _2 后再放，是 _3（不是 _2）
  → 方式：操作编辑器

功能 4：清理序列化冗余
  - sceneToJson 过滤掉 parent: null 和 visible: true
  - 统一 SceneFS.save 使用 sceneToJson
  → 验证：保存场景，检查 JSON 只有必要字段
  → 方式：文件检查
```

### Step 3：排优先级

标注每个功能的依赖：
```
功能 1 → 功能 2      (2 依赖 1 的 name 字段)
功能 1 → 功能 3      (3 依赖 1 的 name 字段)
功能 1 || 功能 4     (1 和 4 可并行，但建议先做 1)
```

**先做什么？** 用户能最早看到效果的功能优先。

---

## 设计中道变更（常态）

设计不是一锤子买卖。实际模式：

```
design → plan → 实现功能 1 → 发现 design 有问题 → 调整 plan → 继续
```

**处理流程：**

1. **评估影响**：哪些功能已按旧设计完成？哪些还未开始？
2. **标记废弃**：旧代码、旧字段、旧文件
3. **增量调整**：
   - 已完成的功能 → 新增"回滚/迁移"子任务
   - 未开始的功能 → 直接按新设计拆解
4. **不重新生成整个计划**——在现有 plan 上打补丁
5. **不实时更新 design 文档**——以代码为准，文档事后补修订记录

**示例：**
```
原计划：
  功能 1：SceneEntity 有持久化 id → 已完成 ❌
  功能 2：SceneTree 用 id 作为 key → 已完成 ❌
  功能 3：Inspector 显示 id → 未开始

用户推翻："id 不要持久化"

调整后：
  功能 1：[回滚] 移除持久化 id，改为运行时生成
    - SceneEntityJson 去掉 id
    - entityFromJson 生成运行时 id
    - 验证：旧文件仍能加载
  功能 2：[回滚] SceneTree 改用运行时 id
    - 确认 loadScene 重新生成 id 后 SceneTree 正常工作
  功能 3：Inspector 不显示 id（本来就未开始，直接取消）
```

---

## 输出格式

保存到项目根目录 `plans/`：

```
plan-{关键词}-{YYYYMMDD}.md
```

内容格式：

```
## 目标
1-2 句话描述最终效果。

## 未决设计点
- [如果有不确定的，列出来，不阻塞拆解]

## 功能清单

### 功能 1：[可见目标]
- [子任务 1]
- [子任务 2]
- [子任务 3]
→ 验证：[打开编辑器后做什么，期望看到什么]
→ 方式：操作编辑器 / 文件检查 / 编译通过 / 命令测试

### 功能 2：[可见目标]
...

## 依赖关系
功能 1 → 功能 2
功能 1 || 功能 3

## 建议执行顺序
1. 功能 1（最早能看到效果）
2. 功能 2
3. ...

## 风险
- [可能出错的地方]
```

---

## 执行指南

- **一次实现一个功能。** 功能 1 验证通过前不开始功能 2。
- **验证失败就停下来。** 不要跳过。
- **编码中发现设计缺陷，暂停。** 在当前功能范围内修复，或标记为"需要 design 调整"。
- **功能完成后提交。**（如果用版本控制。）
- **范围蔓延防御：** "顺便我也应该..." → 记下来，当前 plan 完成后再提。

---

## 示例

### 需求：给 SceneEntity 加 name，可编辑，自动编号

```
## 目标
SceneTree 显示 entity 名字，Inspector 可编辑，放置时自动编号。

## 未决设计点
- 编号策略：最大编号+1（已确认）

## 功能清单

### 功能 1：SceneTree 显示 entity name
- SceneEntity 类型 name 改为 required
- createSceneEntity 默认 name = prefabId
- io.ts 序列化/反序列化 name
- SceneTree 组件渲染 name
→ 验证：打开编辑器，放置 entity，SceneTree 看到 "tiny-dungeon_frame_98_1"
→ 方式：操作编辑器

### 功能 2：Inspector 可编辑 name
- EntityInspector 顶部加 name input（可编辑）
- updateEntity 支持 name 字段
→ 验证：选中 entity，Inspector 改 name，SceneTree 实时更新
→ 方式：操作编辑器

### 功能 3：name 自动编号
- 实现 getNextEntityName（最大编号+1，非 count+1）
- spawnPrefab 用 getNextEntityName
- paintAt（笔刷）也用 getNextEntityName
→ 验证：放置 _1, _2, 删除 _2, 再放置 → 得到 _3（不是 _2）
→ 方式：操作编辑器

### 功能 4：序列化去冗余
- sceneToJson 过滤 parent: null 和 visible: true
- SceneFS.save 复用 sceneToJson（删除 serializeScene）
→ 验证：保存场景，JSON 无冗余字段
→ 方式：文件检查

## 依赖关系
功能 1 → 功能 2
功能 1 → 功能 3
功能 1 || 功能 4

## 建议执行顺序
1. 功能 1（最早看到效果）
2. 功能 4（可与 2 并行，但建议先做 2）
3. 功能 2
4. 功能 3

## 风险
- 旧场景文件可能无 name 字段，加载时需要 fallback
- 统一序列化入口时，检查所有保存路径是否都走 sceneToJson
```
