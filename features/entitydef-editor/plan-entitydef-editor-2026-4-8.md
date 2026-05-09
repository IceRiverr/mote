# Phase 5: Entity/Prefab 编辑器开发计划（已重构）

> **日期**: 2026-04-19（更新）
> **状态**: EntityDef 架构已废弃，替换为 Prefab + SceneEntity 架构
> **当前进度**: Prefab Workflow v2 已完成并提交

---

## 1. 架构变更说明

### 旧架构（已废弃）
```
EntityDef ──► EntityInstance (template + fields)
```
- `EntityDef` 是运行时模板定义
- `EntityInstance` 引用模板 + 字段覆盖
- 独立的 `.entity.json` 文件格式

### 新架构（当前）
```
Prefab ──► SceneEntity (prefab + transform + overrides)
```
- `Prefab` 是独立的 `.mote-prefab.json` 资源文件
- `SceneEntity` 引用 Prefab + Transform + Overrides
- Prefab 本身就是完整定义，无需额外模板层

**废弃原因**：
- EntityDef 和 Prefab 职责重叠，维护两套系统成本高
- Prefab 作为独立文件更直观（可复用、可版本控制）
- SceneEntity 的 overrides 机制比 EntityInstance 的 fields 更灵活（组件级覆盖）

---

## 2. 当前已完成工作（Prefab Workflow v2）

### 数据层 ✅
- [x] `Prefab` 类型：`.mote-prefab.json` 文件格式
- [x] `SceneEntity` 类型：运行时实例（无持久化 id，有 name）
- [x] `Scene` 类型：v2 格式（entity id 不序列化，name 序列化）
- [x] `ENGINE_VERSION = "0.0.2"` 统一版本
- [x] `io.ts`：Scene/Prefab 导入导出（`sceneToJson` / `sceneFromJson` / `prefabToJson` / `prefabFromJson`）
- [x] `SceneFS` / `PrefabFS`：文件系统操作

### 核心逻辑 ✅
- [x] `prefab-commands.ts`：Apply Overrides to Prefab、Revert to Prefab、Save as New Prefab
- [x] `scene-commands.ts`：Add/Remove/Move/Update Entity
- [x] `override-utils.ts`：属性级 override 追踪与重建
- [x] `prefabEditor.ts`：Draft 编辑状态管理

### UI 层 ✅
- [x] **PrefabPreviewEditor**：可编辑的 Prefab 预览面板（双击打开 Draft 编辑）
- [x] **EntityInspector**：选中 SceneEntity 显示属性 + override 指示器
  - Transform 独立编辑（非 override）
  - 组件属性级 override（蓝色边框 + badge）
  - Apply All / Revert All 按钮
  - "保存为 Prefab" 按钮
- [x] **SceneTreeEditor**：实时 entity 列表（name + 坐标 + tag icon）
- [x] **ViewportCanvas**：
  - 拖放 Prefab 到场景
  - SpawnMenu (Shift+A) 放置 Prefab
  - 笔刷绘制（带自动编号 name）
  - 框选 / 多选 / 移动
- [x] **ExportPanel**：保存场景到 `assets/` + 下载 fallback
- [x] **MenuBar**：File → Export Scene（弹路径输入框）

### 基础设施 ✅
- [x] `engineSync.ts`：`prefabInstanceMap`（PrefabId → SceneEntityId 映射）
- [x] `FileSystem.ts`：懒加载目录选择（内存项目首次保存时弹目录选择器）
- [x] `contentBrowser.ts`：正确加载 Scene（走 `sceneFromJson` 生成运行时 id）

### Bug 修复 ✅
- [x] 编辑器双击 Prefab 卡死（路径格式 mismatch）
- [x] Prefab 拖放到场景（`derivePrefabId` 转换）
- [x] 导出场景返回 undefined（MenuBar void return）
- [x] SceneTree 笔刷绘制不更新（未订阅 `sceneVersion`）
- [x] ContentBrowser 加载场景选中所有 entity（运行时 id 未生成）
- [x] 场景保存路径不写入文件（`path` 从序列化中移除）

---

## 3. 下一步计划

### 3.1 Prefab 编辑器增强（高优先级）

**PrefabPreviewEditor 当前是 Draft 编辑模式**，但缺少一些功能：

| 功能 | 状态 | 说明 |
|------|------|------|
| 组件添加/删除 | ❌ | 目前只能编辑已有组件的属性 |
| 组件重排序 | ❌ | 无顺序概念 |
| Tag 编辑 | ❌ | 无法添加/删除 tags |
| Thumbnail 生成 | ❌ | 需要截图或手动上传 |
| Prefab 嵌套引用 | ❌ | Prefab 中包含其他 Prefab |

### 3.2 Scene 编辑器增强

| 功能 | 状态 | 说明 |
|------|------|------|
| Entity 复制 (Ctrl+D) | ❌ | 选中 entity 快速复制 |
| Entity 对齐/分布 | ❌ | 多选时对齐工具 |
| Entity 层级 (parent) | 🟡 | 类型有字段，但编辑器未使用 |
| 场景摄像机系统 | ❌ | 多摄像机、跟随、边界 |
| 运行时预览 (PIE) | ❌ | Play In Editor，接入 Engine World |

### 3.3 资产管理工作流

| 功能 | 状态 | 说明 |
|------|------|------|
| Prefab 分类/标签过滤 | 🟡 | PrefabBrowser 有 Category，但无动态标签 |
| 场景内搜索 entity | ❌ | SceneTree 搜索框 |
| 批量操作（删除/移动） | ❌ | 多选 entity 批量处理 |
| 撤销/重做栈可视化 | ❌ | 显示历史记录列表 |

### 3.4 构建与导出

| 功能 | 状态 | 说明 |
|------|------|------|
| 项目构建包 | 🟡 | `exportBuildBundle` 存在但 UI 未集成 |
| 游戏发布流程 | ❌ | 从场景生成可运行游戏 |
| 资源打包优化 | ❌ | 图集合并、JSON 压缩 |

---

## 4. 近期推荐任务（接下来 1-2 周）

### Task A: Entity 复制与对齐（1-2 天）
- [ ] `Ctrl+D` 复制选中 entity（`cloneEntity` + 偏移）
- [ ] 多选时 Inspector 显示对齐工具（左/中/右对齐、等间距分布）
- [ ] `Delete` 键删除选中（已有命令，需绑定快捷键）

### Task B: Prefab 组件管理（2-3 天）
- [ ] PrefabPreviewEditor 中添加 "+ 添加组件" 按钮
- [ ] 组件选择弹窗（从 ComponentRegistry 列出可用组件）
- [ ] 组件删除按钮（确认对话框）
- [ ] Tag 输入框（逗号分隔，实时更新）

### Task C: SceneTree 搜索与过滤（1 天）
- [ ] SceneTree 顶部搜索框（按 name / prefab 过滤）
- [ ] 按 Prefab 类型分组显示（可选）
- [ ] 显示/隐藏不可见 entity（`visible: false` 的淡化显示）

### Task D: PIE 基础（Play In Editor）（3-5 天）
- [ ] 接入 Engine World 运行时
- [ ] `sceneToEngine`：SceneEntity → Engine Entity（spawn + component）
- [ ] Viewport 切换到"播放模式"（隐藏编辑器 UI，显示游戏）
- [ ] 基础游戏循环（update + render）
- [ ] Stop 按钮回到编辑模式

---

## 5. 废弃文件的清理清单

以下 EntityDef 相关文件可以删除（确认不再引用后）：

```
packages/editor/src/
├── data/EntityDef.ts           # 已废弃，被 Prefab.ts 替代
├── store/entityDefs.ts         # 已废弃，被 prefabs.ts 替代
├── editors/inspector/panels/   # 检查是否有 EntityDefQuickPanel
└── components/                 # 检查是否有 EntityDefEditor / SpritePicker
```

> ⚠️ 删除前需全局搜索引用，确保没有遗留依赖。

---

## 6. 关联文档

| 文档 | 说明 |
|------|------|
| `docs/mote-editor-spec.md` | 编辑器架构规范 |
| `docs/mote-engine-spec.md` | Engine ECS 规范 |
| `designs/design-prefab-workflow-v2-20260418.md` | Prefab Workflow v2 设计文档 |
| `packages/editor/src/data/Prefab.ts` | Prefab 数据模型 |
| `packages/editor/src/data/Scene.ts` | Scene 数据模型 |
| `packages/editor/src/store/prefabs.ts` | Prefab Store |
| `packages/editor/src/store/scene.ts` | Scene Store |

---

## 7. 验收标准（Prefab Workflow v2 已达成）

- [x] Scene 文件格式正确（无 entity id，有 name，无 path）
- [x] Prefab 文件格式正确（无 id，路径派生）
- [x] 场景可保存到 `assets/` 目录
- [x] 场景可从文件加载（运行时 id 重新生成）
- [x] Prefab 可编辑（Draft 模式 + 保存）
- [x] SceneEntity 可 override Prefab 属性
- [x] Inspector 显示 override 指示器
- [x] SceneTree 实时更新
- [x] 笔刷绘制正常工作
- [x] 拖放 / SpawnMenu 放置 Prefab 正常
