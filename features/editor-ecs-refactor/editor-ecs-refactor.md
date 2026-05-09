# Mote Editor ECS 架构重构计划

> **目标**：将 Editor 改造成基于 ECS Prefab 的架构，实现 Editor 与 Runtime 的数据同构  
> **时间预估**：4-5 周  
> **状态**：Phase 2 已完成 ✅

---

## 执行摘要

| 阶段 | 状态 | 核心交付物 | 完成日期 |
|------|------|-----------|----------|
| **Phase 1** | ✅ 已完成 | 基础设施：Schema 提取、数据层、Store | 2026-04-12 |
| **Phase 2** | ✅ 已完成 | 核心编辑器：Prefab 浏览器、Viewport、Inspector | 2026-04-12 |
| **Phase 3** | 🔄 规划中 | 资产管线与运行时集成 | - |
| **Phase 4** | 📋 待规划 | 性能优化与高级功能 | - |

---

## 1. 架构愿景（已实现 ✅）

### 核心原则

| 原则 | 说明 | 状态 |
|------|------|------|
| **数据同构** | Editor 编辑的 JSON 文件 = ECS 运行的 Prefab/Scene，零转换 | ✅ 已实现 |
| **一切皆 Prefab** | 地块、角色、道具全部是 Prefab，无特殊 Tile 层 | ✅ 已实现 |
| **可视化编辑** | Prefab 浏览器 + 组件编辑器 + Scene Viewport | ✅ 已实现 |
| **Canvas 2D** | 保留现有渲染方式，降低复杂度 | ✅ 已实现 |

### 当前架构

```
┌─────────────────────────────────────────────────────────────────┐
│                         Mote Editor                              │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │ Prefab       │  │   Viewport   │  │     Inspector        │  │
│  │ Browser      │  │  (Canvas 2D) │  │  ├─ Transform        │  │
│  │  ├─ Search   │  │              │  │  ├─ Sprite           │  │
│  │  ├─ Category │  │  ├─ Entities │  │  └─ [+ Add Comp]     │  │
│  │  └─ Drag     │  │  ├─ Select   │  │                      │  │
│  │     & Drop   │  │  └─ Gizmo    │  │                      │  │
│  └──────────────┘  └──────────────┘  └──────────────────────┘  │
├─────────────────────────────────────────────────────────────────┤
│  Data Layer                                                      │
│  ├─ Prefab  ────────►  JSON 文件  ◄───────►  ECS Runtime       │
│  ├─ Scene   ────────►  JSON 文件  ◄───────►  ECS Runtime       │
│  └─ ComponentSchema ─► 自动生成  ◄───────►  Inspector UI       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. 已完成回顾

### Phase 1: 基础设施 ✅

**Schema 提取系统**
- ✅ `extract-schemas.ts` - 从 JSDoc 提取组件定义
- ✅ 5 个基础组件（Transform, Sprite, Camera, Collider, Rigidbody）
- ✅ `component-schemas.json` 自动生成

**数据层**
- ✅ `Prefab.ts` - 与 ECS 同构的 Prefab 定义
- ✅ `Scene.ts` - Entity-based 场景（无 TileLayer）
- ✅ `frameToPrefab.ts` - Sprite 转 Prefab 工具

**Store**
- ✅ `prefabs.ts` - Signal-based 状态管理
- ✅ `scene.ts` - Entity CRUD、选择管理

### Phase 2: 核心编辑器 ✅

**Prefab 浏览器**
- ✅ `PrefabBrowser.tsx` - 分类浏览、搜索过滤
- ✅ `PrefabCard.tsx` - 缩略图卡片
- ✅ 拖放系统 - 拖放到 Viewport 创建 Entity

**Viewport 改造**
- ✅ Entity-based 渲染（替代 Tile-based）
- ✅ 点击选择、框选多选
- ✅ 选择高亮、Transform Gizmo

**Inspector 面板**
- ✅ `EntityInspector.tsx` - 组件列表
- ✅ `PropertyField.tsx` - 动态属性编辑
- ✅ 基于 Schema 的表单生成

---

## 3. Phase 3: 资产管线与运行时集成 🔄

### 3.1 现状分析

**已具备能力：**
- Prefab 在内存中创建和编辑
- Scene 在内存中编辑
- 基础的 Viewport 渲染

**缺失的关键能力：**
- ❌ Prefab/Scene 无法保存到文件
- ❌ 无法从文件加载 Prefab/Scene
- ❌ 无法从 Sprite 一键生成 Prefab（UI 未连接）
- ❌ 无法在 Editor 中运行游戏（Play Mode）
- ❌ 项目结构混乱（新旧系统并存）

### 3.2 Phase 3 目标

使 Editor 成为一个**完整可用的工具**，能够：
1. 保存和加载工作成果
2. 从 Sprite 快速生成 Prefab
3. 在 Editor 中测试游戏
4. 导出可发布的游戏包

### 3.3 任务清单

#### 3.3.1 文件系统集成 ⭐ 高优先级

**目标**：Prefab 和 Scene 可以保存/加载

**任务：**
- [ ] 定义标准项目结构
  ```
  project/
  ├── prefabs/           # *.prefab.json
  ├── scenes/            # *.scene.json
  ├── sprites/           # *.mote-sprite.json + *.png
  └── project.json       # 项目配置
  ```
- [ ] `FileSystem.ts` - 文件系统抽象层
  - 支持 File System Access API（Chrome）
  - 降级到传统文件下载（其他浏览器）
- [ ] `PrefabFS.ts` - Prefab 文件操作
  - `savePrefab(prefab)` → `prefabs/${id}.prefab.json`
  - `loadPrefab(id)` ← 文件读取
  - `scanPrefabs()` - 扫描目录加载所有 Prefab
- [ ] `SceneFS.ts` - Scene 文件操作
  - `saveScene(scene)` → `scenes/${id}.scene.json`
  - `loadScene(id)` ← 文件读取
  - `listScenes()` - 列出所有场景

#### 3.3.2 项目系统重构 ⭐ 高优先级

**目标**：统一的项目管理，取代旧系统

**任务：**
- [ ] `Project.ts` - 新的项目定义
  ```typescript
  interface Project {
    id: string;
    name: string;
    version: string;
    lastOpenedScene?: string;
    settings: ProjectSettings;
  }
  ```
- [ ] `projectStore.ts` - 项目状态管理
  - 当前项目
  - 最近打开的项目列表
  - 自动保存开关
- [ ] 更新 `App.tsx` 启动流程
  - 欢迎页面（新建/打开项目）
  - 项目加载后初始化 Prefab Store
- [ ] 菜单栏集成
  - 文件 → 保存/另存为
  - 文件 → 导入 Sprite
  - 文件 → 导出游戏

#### 3.3.3 Sprite Editor 集成 ⭐ 中优先级

**目标**：在 Sprite Editor 中一键生成 Prefab

**任务：**
- [ ] 更新 `SpriteEditorToolbar.tsx`
  - 添加 "Generate Prefab" 按钮（选中 Frame 时启用）
- [ ] `GeneratePrefabDialog.tsx`
  - 单帧生成：输入 ID、名称、分类
  - 批量生成：输入前缀、起始序号
  - 预览生成的 Prefab 列表
- [ ] 自动保存生成的 Prefab
  - 生成后立即保存到 `prefabs/` 目录
  - 刷新 Prefab Browser

#### 3.3.4 Play Mode（运行时集成） ⭐ 高优先级

**目标**：在 Editor 中直接运行游戏

**任务：**
- [ ] `EditorRuntime.ts` - 运行时管理器
  ```typescript
  class EditorRuntime {
    world: World;
    isPlaying: boolean;
    
    start(scene: Scene): void;
    pause(): void;
    stop(): void;
    step(): void;  // 单步前进
  }
  ```
- [ ] `SceneSync.ts` - Scene ↔ World 同步
  - `sceneToWorld(scene)` - 将 Scene 转换为 ECS World
  - `worldToScene(world)` - 将 World 状态转回 Scene
- [ ] 工具栏 Play 控制
  - Play/Pause/Stop 按钮
  - 状态指示器（编辑中/运行中）
- [ ] Viewport 运行时渲染
  - Play Mode 下使用 Engine 渲染（或保持 Canvas 2D）
  - 运行时禁用编辑操作
- [ ] 运行时 Inspector
  - 查看实时组件值
  - 调试信息（Entity 数量、FPS）

#### 3.3.5 导出系统 ⭐ 中优先级

**目标**：导出可发布的游戏

**任务：**
- [ ] `exportGame()` - 游戏导出
  - 打包所有 Prefab 和 Scene
  - 复制必要的引擎文件
  - 生成入口 HTML
- [ ] 优化导出内容
  - 移除 Editor 专用数据
  - 压缩 JSON
  - 图集合并（可选）

### 3.4 Phase 3 文件结构

```
packages/editor/src/
├── fs/                              # NEW: 文件系统层
│   ├── FileSystem.ts               # 文件系统抽象
│   ├── PrefabFS.ts                 # Prefab 文件操作
│   └── SceneFS.ts                  # Scene 文件操作
│
├── project/                         # NEW: 项目系统
│   ├── Project.ts                  # 项目定义
│   ├── projectStore.ts             # 项目状态
│   └── ProjectManager.ts           # 项目管理逻辑
│
├── runtime/                         # NEW: 运行时
│   ├── EditorRuntime.ts            # Play Mode 管理
│   ├── SceneSync.ts                # Scene ↔ World 同步
│   └── RuntimeViewport.tsx         # 运行时 Viewport
│
└── editors/sprite-editor/
    └── GeneratePrefabDialog.tsx    # NEW: 生成 Prefab 对话框
```

---

## 4. Phase 4: 性能优化与高级功能（待规划）

### 4.1 潜在功能

| 功能 | 优先级 | 说明 |
|------|--------|------|
| 空间索引 | 中 | 加速 Entity 拾取和渲染 |
| 批量渲染 | 中 | 相同 Prefab 合并渲染 |
| 撤销重做 | 中 | 完整的 Undo/Redo 系统 |
| 场景切换 | 低 | 多场景编辑和切换 |
| 组件依赖 | 低 | 自动添加依赖组件 |
| 脚本编辑 | 低 | 内置脚本编辑器 |

---

## 5. 技术决策更新

### ADR-005: Phase 3 范围调整

**背景**：原计划 Phase 3 是 "Prefab 编辑器"，但当前架构下 Prefab 编辑可以通过 Inspector 完成，独立的 Prefab 编辑器价值有限。

**决策**：
- ❌ 不开发独立的 Prefab 编辑器面板
- ✅ 在 Prefab Browser 中添加 "Edit" 按钮，打开 Inspector 编辑
- ✅ 优先开发文件系统和 Play Mode，使 Editor 可用

**原因**：
1. 文件系统是当前最大缺失（无法保存工作）
2. Play Mode 是游戏编辑器核心价值
3. Prefab 编辑功能已可通过 Inspector 实现 80%

### ADR-006: 项目结构标准

**决策**：采用扁平化项目结构

```
project/
├── prefabs/           # 所有 Prefab 定义
│   ├── characters/
│   ├── environment/
│   └── items/
├── scenes/            # 所有场景
│   ├── level_01.scene.json
│   └── level_02.scene.json
├── sprites/           # 图集资源
│   └── terrain.mote-sprite.json
└── project.json       # 项目元数据
```

**原因**：
- 简单直观，易于版本控制
- 便于手动编辑和批量操作
- 与 Godot/Unity 等引擎类似，用户熟悉

---

## 6. 下一步行动

### 立即可开始（Phase 3.1）

1. **文件系统集成**
   - 创建 `FileSystem.ts` 抽象层
   - 实现 `PrefabFS.ts` 保存/加载
   - 在 Prefab Browser 添加保存按钮

2. **项目系统**
   - 定义 `Project.ts` 类型
   - 创建欢迎页面（新建/打开项目）
   - 实现项目加载流程

### 需要设计决策

- Play Mode 渲染方案：继续使用 Canvas 2D 还是切换到 Engine WebGL？
- 自动保存策略：实时保存还是定时保存？
- 导出格式：单 HTML 文件还是多文件结构？

---

## 7. 附录

### 已完成文件清单

```
packages/engine/
├── scripts/extract-schemas.ts      ✅
├── dist/component-schemas.json     ✅
└── src/components/
    ├── Transform.ts                ✅
    ├── Sprite.ts                   ✅
    ├── Camera.ts                   ✅
    ├── Collider.ts                 ✅
    ├── Rigidbody.ts                ✅
    └── index.ts                    ✅

packages/editor/src/
├── data/
│   ├── Prefab.ts                   ✅
│   └── Scene.ts                    ✅
├── store/
│   ├── prefabs.ts                  ✅
│   └── scene.ts                    ✅
├── tools/
│   └── frameToPrefab.ts            ✅
├── components/inspector/
│   ├── EntityInspector.tsx         ✅
│   ├── ComponentPanel.tsx          ✅
│   └── PropertyField.tsx           ✅
└── editors/prefab-browser/
    ├── PrefabBrowser.tsx           ✅
    ├── PrefabCard.tsx              ✅
    ├── PrefabCategory.tsx          ✅
    ├── SearchBar.tsx               ✅
    └── register.ts                 ✅
```

### 参考文档

- 原始 ECS 设计：`@docs/mote-ecs-api-design.md`
- Phase 1 总结：`plans/phase1-complete.md`
- Phase 2 总结：（待创建）

---

*更新日期: 2026-04-12*  
*状态: Phase 2 已完成，Phase 3 规划中*
