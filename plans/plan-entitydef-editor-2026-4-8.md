# Phase 5: EntityDef 编辑器开发计划

> **日期**: 2026-04-08
> **目标**: 实现 EntityDef 可视化编辑 + EntityPalette 笔刷面板
> **预计工期**: 4-5 天

---

## 1. 背景与目标

### 当前状态
- ✅ `EntityDef` 数据模型完整 (`data/EntityDef.ts`)
- ✅ `entityDefs.ts` Store 层完成
- ✅ 7 个内置 EntityDef 硬编码在 `loadBuiltinEntityDefs()`
- ❌ **无 EntityPalette 面板** —— 无法像选 Sprite 一样选 EntityDef 作为笔刷
- ❌ **无专用编辑器** —— 用户无法创建/修改 EntityDef
- ❌ **无可视化 Sprite 选择** —— 无法选择 `sheetId:frameId`

### 目标
用户可以在 **EntityPalette** 面板中：
1. **浏览**所有 EntityDef（像 SpriteEditor 一样网格/列表视图）
2. **选择** EntityDef 作为当前笔刷 → 在 Viewport 放置实例
3. **创建/编辑** EntityDef（双击或右键编辑）
4. **管理**自定义字段和 Sprite 引用

---

## 2. 核心概念：笔刷工作流

### 类比 SpriteEditor 的成功模式

| 步骤 | Sprite (Tile) | EntityDef |
|------|---------------|-----------|
| **1. 打开面板** | SpriteEditor | **EntityPalette** |
| **2. 浏览资源** | Grid/List 视图 | **Grid/List 视图** |
| **3. 选择笔刷** | 点击 Frame → `activeFrame` | **点击 EntityDef → `activeEntityDefId`** |
| **4. 切换工具** | Brush 工具 | **Entity 工具** |
| **5. 放置** | 在 TileLayer 涂刷 | **在 EntityLayer 点击放置** |
| **6. 编辑实例** | — | Inspector 编辑覆盖字段 |

### 面板布局关系

```
┌─────────────────────────────────────────────────────────────┐
│  Global Header                                              │
├────────────────┬────────────────────────┬───────────────────┤
│                │                        │                   │
│  Scene Tree    │      Viewport          │  Inspector        │
│  (图层树)       │                        │  (属性编辑)        │
│                │   2D场景视图            │                   │
│                │   Tile + Entity         │                   │
│                │                        │                   │
├────────────────┴────────────────────────┴───────────────────┤
│                                                             │
│  Sprite Editor          │          Entity Palette          │
│  (精灵笔刷)              │          (实体笔刷)               │
│                         │                                   │
│  Grid/List 选 Frame     │          Grid/List 选 EntityDef   │
│  → 用于 Tile 绘制        │          → 用于 Entity 放置       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**关键洞察**：
- SpriteEditor 和 EntityPalette 是**并列关系**，不是包含关系
- 都放在底部区域，用户可以根据当前工作切换
- 或者放在左右两侧，同时可见

---

## 3. 任务分解

### Task 0: EntityPalette 面板（核心）⭐

**文件**: `src/editors/entity-palette/EntityPalette.tsx`

**定位**：独立面板，注册为 `entity-palette` 类型

**功能**:
- **网格视图**：显示 EntityDef 的图标+颜色+名称（类似 SpriteEditor Grid）
- **列表视图**：紧凑列表，显示更多信息（字段数量、脚本等）
- **搜索过滤**：按名称过滤
- **单击选择**：设置 `activeEntityDefId`，成为当前笔刷
- **双击编辑**：打开详细编辑弹窗或 Inspector
- **右键菜单**：新建 / 复制 / 删除 / 导出
- **新建按钮**：快速创建空白 EntityDef

**界面草图**：
```
┌─────────────────────────────────────────┐
│ 实体库                          [+ 新建] │
├─────────────────────────────────────────┤
│ [搜索...]           [🔲网格 ▤列表 ▼分类] │
├─────────────────────────────────────────┤
│                                         │
│ ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│ │   ❤️    │ │   💀    │ │   📦    │    │
│ │  红药水  │ │  骷髅   │ │  宝箱   │    │
│ │(potion_ │ │(skeleto │ │ (chest) │    │
│ │   red)  │ │   n)    │ │         │    │
│ │   ✓     │ │         │ │         │    │ ← ✓ 表示当前笔刷
│ └─────────┘ └─────────┘ └─────────┘    │
│ ┌─────────┐ ┌─────────┐                 │
│ │   ⚔️    │ │   🚪    │                 │
│ │  玩家   │ │   门    │                 │
│ │(player_ │ │  (door) │                 │
│ │  spawn) │ │         │                 │
│ └─────────┘ └─────────┘                 │
│                                         │
├─────────────────────────────────────────┤
│ 笔刷: 红药水 (potion_red)               │
│ 形状: 点  精灵: tiny-dungeon:potion_red │
│ [编辑定义...]                           │
└─────────────────────────────────────────┘
```

**Store 新增**：
```ts
// store/selection.ts 新增
export const activeEntityDefId = signal<string | null>(null);
```

**实现要点**：
- 复用 `entityDefs` signal
- 选中状态持久化（localStorage）
- 支持拖拽排序（自定义顺序）

---

### Task 1: Sprite 选择器组件（弹出式）

**文件**: `src/components/SpritePicker.tsx`

**定位**：可复用的弹窗组件，不是独立面板

**使用场景**：
- EntityPalette 底部点击"编辑定义"
- EntityDef 编辑时选择 sprite 字段

**功能**：
- 弹出式模态窗口
- Grid/List 双视图（复用 SpriteEditor 样式）
- 搜索过滤 Frame
- 点击选择 → 返回 `"sheetId:frameId"`
- 支持清除选择

**界面**：见原 plan

---

### Task 2: EntityDef 详细编辑器（弹窗/抽屉）

**文件**: `src/components/EntityDefEditor.tsx`

**定位**：弹窗或右侧抽屉，编辑单个 EntityDef 的完整属性

**触发方式**：
- EntityPalette 双击项目
- EntityPalette 右键菜单 → 编辑
- Inspector 中点击"编辑定义"

**功能分区**：
1. **基本属性**：名称、图标、颜色、形状、尺寸
2. **视觉**：Sprite 选择器 + 预览
3. **碰撞**：继承/自定义/无 三级选择
4. **脚本**：路径输入 + 浏览按钮
5. **字段**：嵌入 FieldEditor（Task 3）

**界面**：宽弹窗（600px+）或右侧抽屉

---

### Task 3: 字段管理组件（FieldEditor）

**文件**: `src/components/FieldEditor.tsx`

**定位**：嵌入在 EntityDefEditor 中

**功能**：
- 显示所有字段定义
- 添加新字段（选择类型）
- 删除字段
- 编辑字段属性（id, label, default）

**与原 plan 相同**，不再赘述

---

### Task 4: Inspector 快速编辑

**文件**: `src/editors/inspector/panels/EntityDefQuickPanel.tsx`

**定位**：Inspector 中的简化面板，快速修改常用属性

**显示时机**：
- EntityPalette 选中 EntityDef 时
- 或 Viewport 选中 EntityInstance 时点击"编辑模板"

**可编辑字段**：
- 名称、图标、颜色
- 快速跳转"详细编辑"按钮

**目的**：不用打开弹窗就能改常用属性

---

### Task 5: 导出功能

**文件**: `src/data/export-entity.ts`

**与原 plan 相同**，新增 EntityPalette 右键菜单导出

---

### Task 6: 替换内置 EntityDef

**文件**: `src/store/entityDefs.ts`

**修改**：
- 移除 `loadBuiltinEntityDefs()` 硬编码
- 从 `assets/entities/*.entity.json` 加载
- 提供默认初始化（如果目录为空，创建示例）

---

## 4. 文件结构

```
packages/editor/src/
├── editors/
│   ├── entity-palette/           # 新增: 核心面板
│   │   ├── EntityPalette.tsx     # 主组件
│   │   ├── EntityPaletteGrid.tsx # 网格视图
│   │   ├── EntityPaletteList.tsx # 列表视图
│   │   ├── EntityPaletteItem.tsx # 单个项目渲染
│   │   └── register.ts           # 注册面板
│   │
│   ├── inspector/panels/
│   │   └── EntityDefQuickPanel.tsx  # 新增: Inspector 快速编辑
│   │
│   └── sprite-editor/            # 已有
│
├── components/
│   ├── EntityDefEditor.tsx       # 新增: 详细编辑弹窗
│   ├── SpritePicker.tsx          # 新增: Sprite 选择弹窗
│   └── FieldEditor.tsx           # 新增: 字段管理
│
├── data/
│   └── export-entity.ts          # 新增
│
└── store/
    ├── entityDefs.ts             # 修改: 加载逻辑
    └── selection.ts              # 修改: 新增 activeEntityDefId
```

---

## 5. 实现顺序

```
Day 1: EntityPalette 基础
├── Task 0.1: 注册面板，基础布局
├── Task 0.2: Grid 视图渲染
├── Task 0.3: 选择逻辑（activeEntityDefId）
└── Task 0.4: 与 Viewport Entity 工具集成

Day 2: EntityPalette 功能
├── Task 0.5: 搜索过滤
├── Task 0.6: 新建/删除/右键菜单
├── Task 0.7: List 视图
└── Task 0.8: 双击打开编辑器

Day 3: 编辑器组件
├── Task 1: SpritePicker 组件
├── Task 3: FieldEditor 组件
└── Task 2: EntityDefEditor 弹窗框架

Day 4: 集成与导出
├── Task 2: EntityDefEditor 完成功能
├── Task 4: Inspector Quick Panel
├── Task 5: 导出功能
└── Task 6: 替换内置加载

Day 5: 测试与优化
├── 撤销/重做支持
├── 性能优化（虚拟列表）
└── Bug 修复
```

---

## 6. 关键工作流程

### 6.1 创建新 EntityDef

```
1. 点击 EntityPalette [+ 新建]
   ↓
2. 创建空白 EntityDef，ID 自动生成
   ↓
3. 自动打开 EntityDefEditor 弹窗
   ↓
4. 填写名称、选择 Sprite、添加字段
   ↓
5. 点击保存（实时更新，无需显式保存）
   ↓
6. EntityPalette 显示新项目，自动选中
```

### 6.2 放置 Entity 实例

```
1. 在 EntityPalette 点击选择"红药水"
   ↓
2. activeEntityDefId = "potion_red"
   ↓
3. Viewport 自动切换到 Entity 工具（或提示切换）
   ↓
4. 在地图上点击 → 创建 EntityInstance
   {
     template: "potion_red",
     x, y,
     fields: {} // 使用默认值
   }
   ↓
5. 选中实例 → Inspector 编辑覆盖字段
```

### 6.3 编辑现有 EntityDef

```
方式 A: 快速编辑
- EntityPalette 选中 → Inspector 显示 QuickPanel
- 修改名称/颜色/图标

方式 B: 详细编辑
- EntityPalette 双击项目
- 或右键 → 编辑
- 打开 EntityDefEditor 弹窗
- 修改所有属性、字段、Sprite 等
```

---

## 7. 布局建议

### 推荐默认布局

```
┌─────────────────────────────────────────────────────────────┐
│ Header                                                      │
├────────────────┬────────────────────────┬───────────────────┤
│                │                        │                   │
│  Scene Tree    │      Viewport          │  Inspector        │
│  (图层树)       │                        │                   │
│                │                        │                   │
│                │                        │                   │
│                │                        │                   │
├────────────────┴────────────────────────┴───────────────────┤
│                                                             │
│  Sprite Editor (左下)          Entity Palette (右下)        │
│  宽度: 50%                     宽度: 50%                    │
│                                                             │
│  用途: 选 Sprite 笔刷          用途: 选 Entity 笔刷         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 备选布局（竖屏/小屏幕）

```
底部标签切换:
┌─────────────────────────────────────────────────┐
│  [Sprite Editor] [Entity Palette] [Console]    │
├─────────────────────────────────────────────────┤
│                                                 │
│  内容区域（切换显示）                             │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## 8. 与现有系统的关系

| 系统 | 关系 | 说明 |
|------|------|------|
| SpriteEditor | 并列 | 都是"笔刷选择"面板，分别对应 Tile 和 Entity |
| Inspector | 协作 | EntityPalette 选择 → Inspector 显示快速编辑 |
| Viewport | 消费 | EntityPalette 提供笔刷，Viewport 执行放置 |
| Asset Browser | 底层 | Asset Browser 管文件，EntityPalette 管运行时资源 |
| Scene Tree | 区分 | Scene Tree 是当前场景的实例列表，EntityPalette 是全局模板库 |

---

## 9. 验收标准

- [ ] **EntityPalette 面板**
  - [ ] 网格/列表双视图
  - [ ] 显示图标、颜色、名称
  - [ ] 单击选择成为笔刷
  - [ ] 搜索过滤
  - [ ] 新建/删除/复制

- [ ] **笔刷工作流**
  - [ ] 选择 EntityDef → Viewport 可放置
  - [ ] 放置后创建正确的 EntityInstance
  - [ ] 选中实例可编辑覆盖字段

- [ ] **编辑功能**
  - [ ] 双击打开详细编辑器
  - [ ] Sprite 选择器正常工作
  - [ ] 字段管理（增删改）
  - [ ] 导出为 `.entity.json`

- [ ] **集成**
  - [ ] Inspector 快速编辑面板
  - [ ] 从 `assets/entities/` 加载
  - [ ] 撤销/重做支持

---

## 10. 风险与备选

| 风险 | 备选方案 |
|------|----------|
| Entity 太多（100+）性能差 | 虚拟列表 + 分类筛选 |
| 面板空间不够 | 做成浮动面板或可折叠 |
| 与 SpriteEditor 代码重复太多 | 提取公共组件 `ResourceGrid` |

---

## 11. 关联文档

- `SPEC.md` 第 6 章: 编辑器架构
- `data/EntityDef.ts`: 数据模型
- `store/entityDefs.ts`: Store 层
- `editors/sprite-editor/`: 参考实现
