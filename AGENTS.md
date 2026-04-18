# AGENTS.md — AI 编码上下文

> **必读前置**：项目整体介绍、技术栈、快速开始命令、完整文档索引见 [`README.md`](./README.md)。
> 本文档只保留 **AI 生成代码时必须遵守的架构约定与当前状态约束**。若本文档与源码冲突，以源码为准。
> **校验日期**: 2026-04-18

---

## 1. 项目状态摘要

mote 是轻量级 Web 2D 游戏引擎（ECS + WebGPU/WebGL2），配套 Preact 编辑器。
引擎源码在 `packages/engine/`，编辑器源码在 `packages/editor/`，游戏项目在 `games/<name>/`。
当前处于活跃开发期，API 仍可能微调。

---

## 2. 核心编码约定

以下规则若不看本文档，AI 极易按默认直觉写错，且违反即产生 bug。

### ECS

- ❌ Component 必须是纯数据，**`new ()` 无参构造函数**。不要写带参数的 constructor。
- ✅ Component 必须先注册到 `ComponentRegistry`，声明式 `spawn()` 才能识别。
- ✅ System 禁止直接修改 ECS 内部状态，只通过 `world.query()` / `world.get()` / `world.add()` / `world.remove()` 操作。

### 渲染

- ✅ 日常只写 WebGPU + WGSL。Shader 文件后缀用 `*.wgsl`。WebGL2 fallback 由 `createGfxDevice()` 自动处理。
- ❌ 不要写 Canvas 2D fallback。

### 编辑器（Preact）

- ❌ 编辑器 UI 禁止引入 React / Redux / MobX。仅允许 **Preact** + `@preact/signals`。
- ✅ Undo/Redo 必须走纯函数命令模式（`executeCommand(cmd)` / `undo()` / `redo()`），配合 `canUndo` / `canRedo` Signals。

### Sprite-Editor 专属风格

> ⚠️ 以下 Blender 风格约束**仅对 sprite-editor 强制**，其他编辑器面板暂不遵循。

- ✅ 三栏布局：工具栏（T-Panel）、画布（Viewport）、属性面板（N-Panel），`T`/`N` 快捷键开关。
- ✅ 模式化编辑：`Tab` 切换模式（选择/碰撞/标签），改变整个编辑器上下文。
- ✅ 最小化模态：优先非模态面板；仅文件操作（导入/导出/另存为）使用居中模态弹窗。

---

## 3. 重要约束

| 约束 | 说明 |
|------|------|
| **Secure Context** | WebGPU 和 File System Access API 需要 HTTPS 或 localhost，`file://` 不支持 WebGPU |
| **TypeScript strict** | 启用严格模式，类型即文档 |
| **像素风采样** | 纹理过滤用 `nearest`，避免模糊 |
| **dt 上限** | `GameLoop` 中 `if (dt > 200) dt = 200`（上限 **200ms**），防止标签页切换后螺旋死亡。不是 0.05s |
| **坐标系** | 左上角为原点，X 向右，Y 向下（与 Canvas 一致） |
| **TileMapRenderer.ts 是孤儿文件** | 引用了不存在的 `ProjectLoader.js` / `SceneManager.js`，**当前不可用，请勿直接使用** |

---

## 4. AI 高频参考文档

| 文档 | 查阅时机 |
|------|----------|
| `docs/mote-engine-spec.md` | 编写引擎 System、Component、Plugin 时 |
| `docs/mote-editor-spec.md` | 编写编辑器面板、命令、Viewport 交互时 |
| `docs/input-design.md` | 涉及输入映射、ActionMap 时 |

---

## 5. 编码决策边界

| 不做 | 对 AI 编码的影响 |
|------|------------------|
| 可视化 Shader 编辑器 | WGSL 直接写在 `*.wgsl` 文件中，不要生成节点编辑器代码 |
| Canvas 2D 回退 | 不需要写 2D Canvas fallback，专注 WebGPU + WebGL2 |
| React/Vue 编辑器 | 编辑器 UI 只能用 Preact，不要用 React/Vue API |
