---
name: mote-design
description: 当用户说"design"、"architecture"、"API design"、"data structure design"、"module design"时触发。为 mote 游戏引擎和编辑器设计新功能、API、数据结构或模块边界。
---

# Mote 软件架构与 API 设计指南

> 为 mote 游戏引擎（ECS + WebGPU/WebGL2）和 Preact 编辑器设计新功能、API、数据结构或模块边界。

---

## 何时使用本技能

- 设计新引擎系统、Component 或渲染器功能
- 设计新编辑器面板、工具或工作流
- 重构模块边界或公共 API
- 创建跨系统边界的新数据结构
- 添加新引擎 Plugin

---

## 歧义处理协议

遇到高风险的歧义时（两套可能的架构、与现有模式冲突、破坏性操作、关键上下文缺失）：

**STOP。** 用一句话命名歧义。列出 2-3 个选项及利弊。问用户。不要在架构或数据模型决策上猜测。

不适用于：常规编码、小功能、显而易见的变更。

---

## 设计流程

### 阶段 1：约束收集（必须先做）

做任何设计决策前，先回答：

1. **生命周期**：短期（每帧）还是长期（会话级）？
2. **所有权**：哪个系统/模块拥有数据？哪个拥有行为？
3. **变更模式**：读多写少？写多读少？谁写谁读？
4. **跨边界**：数据流向是 引擎→编辑器、编辑器→引擎，还是只在单边界内？
5. **序列化**：需要保存/加载吗？如果是，属于 Scene 格式还是编辑器状态？
6. **现有模式**：找到 2 个最相似的功能。它们怎么解决的？

如果任何答案是"我不确定"，停下来。陈述不确定性。问用户。

### 阶段 2：架构决策

每个重大决策记录：

```
决策：<你决定了什么>
考虑的替代方案：<列出 1-2 个替代>
理由：<为什么选这个>
接受的代价：<你放弃了什么>
```

---

## ECS 设计规则

### Component

- **Component 是纯数据。** 除了简单 getter/setter 外无方法。无业务逻辑。
- **构造函数必须是 `new()`（无参数）。** 所有初始化通过字段赋值完成，或用类外的工厂函数。
- **优先扁平标量字段，而非嵌套对象。** ECS 查询最适合扁平结构。
- **使用 `Entity` 引用（数字）而非对象引用。** 防止内存泄漏和序列化问题。

```typescript
// ✅ 好的
class Transform extends Component {
  x = 0;
  y = 0;
  rotation = 0;
  scaleX = 1;
  scaleY = 1;
}

// ❌ 坏的
class Transform extends Component {
  constructor(x: number, y: number) {} // 必须无参
  position: Vec2 = new Vec2();         // 嵌套对象，查询困难
  parent: Transform | null = null;     // 对象引用，改用 parentId: number
}
```

### System

- **一个 System 只做一件事。**
- **System 通过 `world.query()` 读取，通过 `world.add()`/`world.remove()`/`world.set()` 变更。**
- **不要跨帧缓存 query 结果，除非有性能理由。** 每帧重新 query 或用变更检测。
- **System 执行顺序很重要。** 如果依赖另一个 System 的输出，显式记录依赖。

### Query

- **优先用具体的组件组合，而非宽泛查询。** `world.query(Transform, Sprite)` 优于手动过滤。
- **如果需要"没有 X 的 entity"，** 用 query 排除或专用 tag component。

---

## API 设计规则

### 公共 API（跨模块或面向用户）

- **从最小开始。** 公共 API 是轻易不能破坏的契约。只加，不减。
- **参数超过 2 个用 options 对象。**

```typescript
// ✅ 好的
interface CreateSpriteOptions {
  texture: string;
  x?: number;
  y?: number;
  layer?: number;
}
function createSprite(world: World, options: CreateSpriteOptions): Entity {}

// ❌ 坏的
function createSprite(world: World, texture: string, x: number, y: number, layer: number): Entity {}
```

- **返回值必须明确。** 优先用 `Entity`（数字）或 `Result<T, E>`，而非需要副作用检查的 boolean。
- **异步 API 必须明显标注。** 如果操作是异步的，函数名或返回类型要体现。

### 内部 API（模块内）

- **默认私有。** 只导出其他模块需要的东西。
- **相关函数放一起。** 如果两个函数总是一起改，放在同一个文件。

---

## 编辑器数据架构（新增）

编辑器开发占本项目 70% 以上的工作量，数据层设计比 ECS 运行时更容易出错。

### 运行时 vs 持久化

**核心原则：区分"内存中才需要"和"写入文件的"：**

| 数据 | 例子 | 处理方式 |
|------|------|----------|
| 运行时-only | entity 运行时 `id`、选中状态、undo 栈 | 不序列化 |
| 持久化 | entity `name`、transform、overrides | 序列化到文件 |
| 运行时推导 | entity 编号（`_1`, `_2`）| 加载时重新计算 |

### 序列化一致性

- **所有保存入口必须复用统一的序列化函数。**（如 `io.ts` 的 `sceneToJson`）
- **禁止在多个地方各自实现序列化。**（本次 bug：`SceneFS.serializeScene` 和 `io.sceneToJson` 不一致，导致 `parent: null` 和 `visible: true` 被冗余输出）
- **默认值不在 JSON 中显式出现。** `parent: null`、`visible: true` 应被过滤。

### 命名生成策略

当需要为同类对象生成唯一显示名称时：

```typescript
// ✅ 好的：基于已有名称的最大编号 + 1
function getNextEntityName(prefabId: string, entities: SceneEntity[]): string {
  let maxNum = 0;
  const regex = new RegExp(`^${prefabId}_(\\d+)$`);
  for (const e of entities) {
    if (e.prefab !== prefabId) continue;
    const match = e.name.match(regex);
    if (match) maxNum = Math.max(maxNum, parseInt(match[1], 10));
  }
  return `${prefabId}_${maxNum + 1}`;
}
// prefab_1, prefab_9 → prefab_10 ✅

// ❌ 坏的：基于实体数量
const count = entities.filter(e => e.prefab === pid).length;
return `${pid}_${count + 1}`;
// prefab_1, prefab_9 → filter 长度是 2 → prefab_3 ❌
```

### 文件格式版本

- 所有可保存文件必须有 `version` 字段。
- 破坏性变更时：要么保留兼容代码（旧格式加载），要么明确拒绝加载旧格式（`validateScene` 失败）。
- **不要在同一代码库中维护多套序列化逻辑。**

---

## 数据结构

### 引擎数据（运行时）

- **大量数据遍历时优先 SoA（Structure of Arrays）。** ECS 天然 SoA 友好。
- **GPU 数据用 typed arrays。**（`Float32Array`、`Uint32Array`）
- **频繁分配的对象要池化。**（向量、矩阵、临时数组）减少 GC 压力。

### 编辑器数据（UI 状态）

- **用 `@preact/signals` 做响应式 UI 状态。**
- **编辑器状态和引擎状态分离。** 编辑器操作引擎世界，但维护自己的选中、undo 栈、UI 偏好。
- **选中状态是 Entity ID 的 Set/Map，不是 entity 引用。**

### 序列化数据

- **用纯 JSON 可序列化对象。** 无类实例、无函数、无循环引用。
- **版本化格式。** 保存文件包含 `version` 字段。
- **变更格式时记录迁移路径。** 旧版本如何升级到新版本。

---

## 模块设计规则

### 引擎模块（`packages/engine/`）

- **Core（ecs, gfx, math）：** 不依赖其他引擎模块。基础层。
- **Systems（rendering, physics, audio）：** 只依赖 core。System 间不交叉依赖，除非通过 ECS 事件。
- **Plugins：** 可选扩展，自行注册到引擎。Core 不能依赖 Plugin。

### 编辑器模块（`packages/editor/`）

- **Viewport：** 渲染引擎世界。依赖引擎。
- **Panels：** UI 组件，观察和变更引擎/编辑器状态。依赖引擎和 shared UI。
- **Commands：** 纯函数（execute/undo/redo），封装变更。副作用只限于文档化的状态变更。
- **Shared UI：** 可复用 Preact 组件。不依赖引擎。

### 依赖方向

```
shared-ui ← editor-panels ← editor-viewport ← engine
                    ↑
              editor-commands
```

**禁止：** Editor core 直接 → Engine internals（必须通过公共 API）。Engine → Editor（引擎必须不知道编辑器存在）。

---

## 渲染器设计规则

- **新渲染功能从 WebGPU + WGSL 开始。** WebGL2 fallback 由 `createGfxDevice()` 自动生成。
- **Shader 文件用 `*.wgsl` 扩展名。**
- **Uniform/binding layout 必须在 TS 和 WGSL 之间匹配。** 在注释块中记录 binding schema。
- **纹理过滤默认 `nearest`（像素风）。** 只有明确设计为平滑图形时才覆盖。
- **Render pass 必须显式。** 不要把 render target 切换藏在 helper 函数里。

---

## 设计推翻处理（新增）

用户可能在编码中途推翻设计决策（如"entity id 不要持久化""编辑器只是预览器"）。

当设计被推翻时：

1. **列出已按旧设计实现的文件**
2. **评估影响范围**：
   - 类型定义（接口、schema）
   - 序列化逻辑（导出/导入）
   - 验证函数（`validateXxx`）
   - UI 组件（显示/编辑旧字段）
   - Store 操作（读写旧字段）
3. **明确清理策略**：
   - 软废弃（保留兼容）还是硬废弃（拒绝加载）？
   - 是否需要在本次会话中清理旧文件？
4. **验证新旧一致性**：新格式保存 → 新格式加载 → 行为正确

---

## 设计检查清单

最终确定设计前验证：

- [ ] 所有 Component 有无参构造函数
- [ ] 无跨模块依赖违反依赖方向图
- [ ] 公共 API 表面积最小且有文档
- [ ] 需要序列化的数据用纯对象 + version 字段
- [ ] 运行时-only 数据明确标记，不写入文件
- [ ] 所有保存入口使用统一的序列化函数
- [ ] System 执行顺序和依赖已记录
- [ ] GPU 资源布局与 shader binding 匹配
- [ ] 编辑器状态与引擎状态分离
- [ ] 编辑器功能可实现为纯命令（execute/undo/redo）
- [ ] 破坏性变更时，有明确的废弃/迁移策略

---

## 输出格式

被要求设计时，产出：

1. **问题陈述**（1-2 句话）
2. **收集的约束**（阶段 1 问题的答案）
3. **架构决策**（每个决策的 决策/替代/理由/代价）
4. **提议的 API**（TypeScript 接口 / 函数签名）
5. **数据结构**（Component 定义、状态形状）
6. **模块位置**（每个 piece 放在哪个文件/包）
7. **开放问题**（还需要用户输入什么）

保存到项目根目录 `designs/`：

### 文件命名

```
design-{关键词}-{YYYYMMDD}.md
```

- `关键词`：2-4 个描述需求的关键词，小写，短横线分隔
- `YYYYMMDD`：当前日期

示例：
- `design-health-damage-system-20260418.md`
- `design-sprite-editor-blender-layout-20260418.md`
