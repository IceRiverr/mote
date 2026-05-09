# Plan: 引擎坐标系决策（待决策项）

**日期：** 2026-04-19
**状态：** 🟡 待决策 — 当前保留现状

---

## 现状

当前 mote 引擎和编辑器使用以下坐标系：

| 属性 | 当前值 |
|------|--------|
| 原点 | 左上角 `(0, 0)` |
| Y 轴方向 | **向下**（正 Y = 向下） |
| 存储格式 | `entity.transform.y` 表示"距场景顶部的像素距离" |
| 兼容引擎 | Godot 2D、Phaser、Tiled、Aseprite、GameMaker |

**AGENTS.md 约束：**「坐标系：左上角为原点，X 向右，Y 向下（与 Canvas 一致）」

---

## 调研结果

### 主流引擎对比

| 引擎 | 原点 | Y轴 | 设计原因 |
|------|------|-----|---------|
| Godot 2D | 左上角 | 向下 | 2D 原生设计，与屏幕像素一致 |
| Phaser | 左上角 | 向下 | HTML5 Canvas 原生坐标 |
| Tiled | 左上角 | 向下 | 瓦片行号从上到下阅读自然 |
| Aseprite | 左上角 | 向下 | 图像处理行业标准 |
| GameMaker | 左上角 | 向下 | 与显示缓冲区 row-major 一致 |
| Unity 2D | 中心/任意 | **向上** | 从 3D 继承，Transform 是笛卡尔坐标 |
| Bevy | 左下角 | **向上** | 现代 ECS 引擎，与图形 API 裁剪空间一致 |

### 关键发现

1. **2D 像素/瓦片工具压倒性使用 Y 向下**：与 GPU 纹理 row-major、瓦片地图行号阅读习惯一致
2. **Y 向上的引擎（Unity/Bevy）**都是从 3D 或现代图形 API 出发，2D 是上层抽象
3. 改坐标系是**破坏性变更**：影响渲染、物理、编辑、场景文件、碰撞检测全链路

---

## 需求来源

用户希望：
- 原点在**左下角**
- Y 轴**向上**（数学直觉：重力 = -Y，向上为正）
- 与 Blender 的 2D 视图操作习惯一致

---

## 备选方案

### 方案 A：视觉翻转（推荐 — 保留现状）

**核心思路**：底层数据继续 Y 向下，编辑器做视觉层翻转

| 层面 | 处理方式 |
|------|---------|
| **数据存储** | 不变，`transform.y` 仍是距顶距离 |
| **场景文件** | 零迁移，向后兼容 |
| **编辑器视口** | `worldToScreen` 中翻转 Y：`screenY = sceneHeight - worldY` |
| **Inspector** | 显示翻转值：`displayY = sceneHeight - storedY` |
| **页脚坐标** | 显示翻转后的世界坐标 |
| **引擎运行时** | 不变，继续使用 Y 向下 |

**优点**：
- 改动最小（只改编辑器渲染层）
- 现有场景文件零迁移
- 与 Tiled/Aseprite/Godot 生态兼容
- 后续物理系统不需要特殊处理

**缺点**：
- 代码中需要标注「视觉坐标」vs「存储坐标」
- 引擎内部和编辑器显示不一致
- 自定义 Shader 需要额外翻转逻辑

---

### 方案 B：真正重构（长期正确，但工作量大）

**核心思路**：从存储到渲染全链路改为 Y 向上 + 左下角原点

**需要修改的模块清单**：

| 优先级 | 模块 | 变更内容 | 预估工时 |
|--------|------|---------|---------|
| P0 | `data/Scene.ts` | `transform.y` 语义反转 | 2h |
| P0 | `store/scene.ts` | `moveEntity`、`spawnPrefab`、碰撞检测 Y 逻辑 | 4h |
| P0 | `ViewportCanvas.tsx` | `draw()` 全局 Y 翻转、文字不翻转处理 | 4h |
| P0 | `store/viewport.ts` | `screenToWorld` / `worldToScreen` Y 公式反转 | 2h |
| P0 | `commands/*` | MoveCommand、BrushCommand、EraseCommand Y 增量 | 3h |
| P1 | 场景文件迁移脚本 | `newY = sceneHeight - oldY` 批量转换 | 4h |
| P1 | `data/GridSettings` | `snapToGrid` Y 逻辑 | 1h |
| P1 | `editors/inspector` | Transform 面板 Y 值显示/编辑适配 | 2h |
| P1 | 测试回归 | 拖拽、笔刷、框选、Undo、Redo 全量验证 | 4h |
| P2 | 引擎 `RenderPlugin` | WebGPU SpriteBatch 投影矩阵 Y 翻转移除 | 3h |
| P2 | 文档更新 | AGENTS.md、引擎 spec、API 文档 | 2h |

**总预估**：~30h + 全量回归测试

**优点**：
- 与数学/物理直觉一致（重力 = -Y）
- 与 Blender 操作习惯一致
- 与 WebGPU 裁剪空间 Y 向上天然匹配

**缺点**：
- 现有所有场景文件失效（需迁移）
- 改动量大（10+ 文件，数百行）
- 与 Tiled/Aseprite 生态坐标不一致
- 引入大量回归风险

---

## 当前决策

**保留现状（方案 A 的前置准备）**

当前视口重构 plan 继续按 Y 向下推进，不做坐标系变更。

在编辑器层面预留「视觉坐标翻转」的接口，方便后续切换：
- `store/viewport.ts` 中的 `worldToScreen` / `screenToWorld` 已独立提取
- 后续只需在转换函数中插入 Y 翻转即可

---

## 未来触发条件

以下情况出现时应重新评估此决策：

1. **物理系统接入时**：如果 PhysX/Box2D 等物理引擎要求 Y 向上，需立即决策
2. **Tiled 导入/导出需求**：如果与 Tiled 深度集成，Y 向下更自然
3. **Blender 风格工作流**：如果编辑器团队大量来自 Blender 背景，视觉翻转可能不够
4. **预发布前 2 周**：必须在发布前锁定坐标系，届时必须做出最终选择

---

## 修订记录

| 日期 | 变更 |
|------|------|
| 2026-04-19 | 创建计划，标记为待决策，当前保留现状 |
