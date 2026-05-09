# 资源打开交互设计规范

版本：2.0.0 | 日期：2026-04-18

> **变更说明**（相对 v1.0）：
> - 引入 Area + Editor Slot + Tab 分层架构，对齐 Blender 5 的 Area 系统演进方向
> - 修正 Prefab 双击行为：从"实例化"改为"打开 Prefab 预览/编辑面板"
> - 修正 Prefab 单击行为：仅在 Brush 模式下自动更新笔刷
> - 新增 Properties 面板设计（跟随选中对象刷新）
> - 新增 Blender 5 对比研究章节
> - 新增分阶段实施路线图

---

## 1. 概述

本文档定义微尘编辑器 **Content Browser（资源浏览器）** 中资源打开方式的交互规范。涵盖单击、双击、右键菜单三种操作的职责划分，以及不同资源类型（Prefab、Sprite、图片、场景、脚本等）的统一行为规则。

### 1.1 为什么需要统一规范

当前编辑器中存在交互不一致的问题：

- **Sprite** 只能通过右键菜单打开，双击无响应
- **图片** 只能通过右键菜单打开，双击无响应
- **Prefab** 双击是"在场景中心创建实体"，但这不是"打开"而是"实例化"
- **文件夹** 双击是"进入"，但某些用户期望双击展开

这种不一致性导致用户需要记忆每种资源类型的特殊操作，增加了认知负担。本规范的目标是让所有资源类型遵循同一套交互规则，降低学习成本。

### 1.2 核心问题

如何在保持 Blender Area 系统作为布局基础的同时，实现游戏引擎标准的"双击打开资源"交互？

---

## 2. 设计原则

### 2.1 五条核心原则

| 编号 | 原则 | 说明 |
|------|------|------|
| P1 | **双击打开（Double-Click Open）** | 所有资源的"打开"操作统一由双击触发，100% 无例外 |
| P2 | **右键精简（Right-Click Lean）** | 右键菜单只保留文件管理操作（重命名/删除/新建），不包含"打开" |
| P3 | **单击选中（Click to Select）** | 单击用于选中资源，为后续操作（拖拽/属性查看）做准备 |
| P4 | **不动源面板（Keep Source Panel）** | 打开操作不会替换当前 Content Browser 面板，使用 Reuse-or-Split 策略 |
| P5 | **Blender 容器 + 游戏引擎交互（Blender Shell, Engine UX）** | 底层面板系统对齐 Blender Area 模型，交互层对齐主流游戏引擎 |

### 2.2 原则推导

**为什么是双击打开？**

- 用户预期：Windows Explorer、macOS Finder、Unity Project、Godot FileSystem 都是双击打开
- 操作效率：双击（1 次操作）比 右键→移动→点击（3 次操作）快 3 倍
- 肌肉记忆：专业游戏开发者已经在 Unity/Godot/UE 中形成了双击打开的习惯

**为什么是右键精简？**

- 网页端限制：右键需要 `preventDefault`，可能被浏览器拦截；触摸设备无右键
- 认知负担：右键菜单项越多，用户找到目标的时间越长（Hick's Law）
- 职责单一：右键只做"文件管理"，不做"打开"

**为什么要融合 Blender 和游戏引擎？**

- 微尘的面板布局系统（Split/Join/Resize）直接对齐 Blender 的 Area 模型，这是正确的容器层基础
- 但 Blender 本身没有"双击资源打开编辑器"这一工作流（Blender 的 .blend 数据模型是全局的，没有独立文件资源的概念）
- 微尘是基于文件系统的游戏引擎，天然需要"打开资源"的概念——这是游戏引擎模型的领地
- 因此融合方向是：**Blender 的 Area 系统做容器，游戏引擎的交互模式做操作层**

---

## 3. 主流引擎 + Blender 5 对比研究

### 3.1 各引擎 / 工具的资源打开方式

| 引擎 | 双击行为 | 右键菜单内容 | 面板策略 | 备注 |
|------|---------|-------------|---------|------|
| **Unity** | 打开 Inspector 或对应编辑器 | Open / Show in Explorer / Rename / Delete | Inspector 刷新 / 新标签页 | 双击是主要打开方式 |
| **Unreal** | 打开对应编辑器（新 Docked Tab） | Open / Rename / Delete / Asset Actions | 新 Docked Tab，Content Browser 不动 | 双击是主要打开方式 |
| **Godot** | 打开对应编辑器 | Open / Open in File Manager / Rename / Delete | 中央区域切换 Tab | 双击是主要打开方式 |
| **Blender 5** | 进入编辑模式（3D 对象）/ 无标准行为（Asset Browser） | Open Blend File（在新实例中打开） | Area 系统 + Docking | 无"双击资源打开编辑器"工作流 |

### 3.2 关键发现

1. **100% 的游戏引擎都把"打开编辑器"放在双击上。** 没有任何引擎把"打开"放在右键菜单作为主入口。
2. **Blender 5 自己都还没解决"双击资源打开编辑器"的问题**——因为 Blender 的数据模型不需要它。但微尘需要。

### 3.3 Blender 5 的 Area 系统演进

Blender 5 正在分三步解决 Area 系统的灵活性问题：

| 阶段 | 功能 | 状态 | 说明 |
|------|------|------|------|
| **第一步** | Interactive Editor Docking | ✅ 已发布（5.0/5.1） | 拖拽重排 Area、撕出浮动窗口、跨窗口 Dock |
| **第二步** | Editor Tabs | 🔬 设计探索中（2026） | 多编辑器共享一个 Area，通过 Tab 切换 |
| **第三步** | 资源系统改进 | 🔧 进行中 | Online Asset Libraries、Asset Packing、Dynamic Overrides |

**对微尘的启示：**

- Blender 的 Area 系统作为容器层是经过验证的正确基础，继续对齐
- Editor Tabs 是 Blender 的探索方向（尤其为平板端适配），微尘可以先行实现
- "双击资源打开编辑器"是微尘的差异化优势——Blender 没有，微尘可以做得比 Blender 更好

### 3.4 微尘 Content Browser 的定位

| 维度 | Blender 5 Asset Browser / Outliner | 微尘 Content Browser |
|------|-------------------------------------|---------------------|
| 布局基础 | Blender Area System | Blender Area System（对齐） |
| 双击行为 | 无标准"打开编辑器"行为 | **打开对应编辑器**（游戏引擎模式） |
| 面板策略 | 手动 Split + 类型下拉切换 | **自动 Reuse-or-Split**（自动化 Blender 操作） |
| 多实例 | 手动 Split 出多个同类 Area | **Area 内 Tab**（对齐 Blender 探索方向） |
| 单击行为 | 选中 | **选中 + Properties 面板刷新** |

---

## 4. 架构：Area + Editor Slot + Tab

### 4.1 分层设计

微尘引入一个融合架构，用 Blender 的 Area 系统作为容器层，游戏引擎的资源打开模式作为交互层：

```
┌─────────────────────────────────────────────┐
│              Workspace（工作区）               │  ← Blender 层：保存/恢复整体布局
├─────────────────────────────────────────────┤
│   Area A        │       Area B              │  ← Blender 层：可 Split / Join / Resize
│  ┌───────────┐  │  ┌─────────────────────┐  │
│  │ EditorType│  │  │    EditorType        │  │  ← Blender 层：每个 Area 有一个类型
│  │= Content  │  │  │  = SpriteEditor      │  │
│  │  Browser  │  │  │                      │  │
│  │           │  │  │  ┌─Tab1─┬─Tab2─┐     │  │  ← 游戏引擎层：同类编辑器内的多标签
│  │           │  │  │  │hero  │enemy │     │  │
│  │           │  │  │  │.sprite│.sprite│    │  │
│  └───────────┘  │  └─────────────────────┘  │
├─────────────────┤                           │
│   Area C        │       Area D              │
│  ┌───────────┐  │  ┌─────────────────────┐  │
│  │ EditorType│  │  │    EditorType        │  │
│  │= Viewport │  │  │  = Properties       │  │
│  │ (场景视口) │  │  │  (属性检查器)        │  │
│  └───────────┘  │  └─────────────────────┘  │
└─────────────────────────────────────────────┘
```

### 4.2 各层职责

| 层级 | 来源 | 职责 | 操作 |
|------|------|------|------|
| **Workspace** | Blender | 整体布局的快照 | 手动切换（如 "2D Edit"、"Sprite Edit"、"Script" 工作区） |
| **Area** | Blender | 屏幕空间的容器 | Split / Join / Resize / 切换 EditorType（Blender 式下拉） |
| **Editor Slot** | 融合层 | Area 内的编辑器实例 | **双击资源 → 在合适的 Area 中加载** |
| **Tab** | 游戏引擎 | 同一个 Editor Slot 内的多资源切换 | 同类型资源在同一 Area 内以 Tab 形式共存 |

### 4.3 Tab 支持策略

并非所有 EditorType 都需要 Tab。只有需要同时编辑/对比多个文件的编辑器才开启：

| EditorType | 是否支持 Tab | 理由 |
|------------|-------------|------|
| **SpriteEditor** | ✅ | 用户经常需要对比多个 Sprite Sheet |
| **Viewport** | ❌ | 场景视口是全局唯一的 |
| **Content Browser** | ❌ | 资源浏览器本身有路径导航，不需要 Tab |
| **Properties** | ❌ | 属性面板跟随选中对象，天然单实例 |
| **PrefabPreview** | ✅ | 对比多个 Prefab |
| **Code Editor**（未来） | ✅ | 和 VS Code 一样，多文件多 Tab |
| **Animation Editor**（未来） | ✅ | 对比/编辑多个动画 |

---

## 5. 最终方案：Double-Click Open + Right-Click Lean

### 5.1 三击分工

| 操作 | 职责 | 类比 |
|------|------|------|
| **单击** | 选中资源 + Properties 面板刷新 | Windows Explorer 单击选中 + Unity Inspector 刷新 |
| **双击** | 打开资源对应编辑器（主入口） | Windows Explorer 双击打开 |
| **右键** | 文件管理（辅助） | Windows Explorer 右键菜单 |

### 5.2 Reuse-or-Split 面板路由策略

双击触发的是一个面板路由决策：

```
用户双击资源（如 hero.mote-sprite.json）
         │
         ▼
  ① 确定目标 EditorType
     hero.mote-sprite.json → SpriteEditor
         │
         ▼
  ② 搜索现有 Area：是否已有 EditorType = SpriteEditor 的 Area？
         │
    ┌────┴────┐
    是        否
    │         │
    ▼         ▼
  ③a Reuse    ③b 寻找最佳 Split 位置
  在该 Area   │
  中加载资源  ├─ 优先：Content Browser 旁边（用户视线就在那）
  （新 Tab    ├─ 其次：最大的 Area 旁边
  或替换）    ├─ Fallback：替换当前 Area（仅在无法 Split 时）
              │
              ▼
            Split 出新 Area，EditorType = 目标类型
            在新 Area 中加载资源
```

**Shift+双击 = 强制在新面板中打开**（跳过 Reuse，直接 Split），用于同时对比两个同类型资源。

### 5.3 Split 方向的智能选择

| 条件 | Split 方向 | 理由 |
|------|-----------|------|
| Content Browser 宽度 > 高度 | 水平 split（左右分割） | 两个面板各占一半宽度 |
| Content Browser 高度 > 宽度 | 垂直 split（上下分割） | 两个面板各占一半高度 |
| 默认 | 水平 split（右侧） | Content Browser 通常在底部或左侧 |

**最小面板尺寸约束**：`minWidth: 200px, minHeight: 150px`。当空间不足时触发 Fallback（替换当前面板）。

### 5.4 为什么不动源面板

- **工作流连续性**：用户在 Content Browser 中浏览资源时，可能需要连续打开多个资源对比。如果每次打开都替换 Content Browser，用户需要反复切回来。
- **行业标准**：Unity/Godot/UE 的资源浏览器都不会被资源打开操作替换。
- **Blender 兼容**：Blender 的 Outliner / Asset Browser 也是独立 Area，打开资源不会影响它本身。

---

## 6. 各资源类型的具体行为

### 6.1 统一行为表

| 资源类型 | 扩展名 | 单击 | 双击 | 右键菜单 |
|---------|--------|------|------|---------|
| **文件夹** | 目录 | 选中 + 展开子文件夹 | **进入该文件夹** | 新建文件夹 / 新建 Prefab / 重命名 / 删除 |
| **Prefab** | `.mote-prefab.json` | 选中 + Properties 显示 Prefab 信息；**仅 Brush 模式下**自动更新笔刷 | **Reuse-or-Split 打开 Prefab Preview 面板** | 重命名 / 删除 |
| **Sprite** | `.mote-sprite.json` | 选中 + Properties 显示 Sprite 信息 | **Reuse-or-Split 打开 Sprite Editor** | 重命名 / 删除 |
| **图片** | `.png` / `.jpg` / `.webp` | 选中 + Properties 显示图片元信息 | **Reuse-or-Split 打开 Sprite Editor**（16×16 grid 导入模式） | 重命名 / 删除 |
| **场景** | `.mote-scene.json` | 选中 + Properties 显示场景概要 | **加载场景到 Viewport** | 重命名 / 删除 |
| **脚本** | `.ts` / `.js` | 选中 + Properties 显示脚本元信息 | **（未来）Reuse-or-Split 打开 Code Editor** | 重命名 / 删除 |
| **音频** | `.mp3` / `.ogg` / `.wav` | 选中 + Properties 显示音频元信息 | **（未来）预览播放** | 重命名 / 删除 |
| **未知** | 其他 | 选中 | 无 | 重命名 / 删除 |

**核心规则：双击 = 打开该资源最合适的编辑环境，100% 无例外。**

### 6.2 Prefab 的交互设计

v1.0 中 Prefab 双击为"在场景中心创建实体"，这违反了 P1（双击打开）原则。v2.0 修正如下：

| 操作 | v1.0（旧） | v2.0（新） | 变更理由 |
|------|-----------|-----------|---------|
| 单击 | 无条件设为笔刷 + 切 Brush 工具 | 选中 + Properties 刷新；**仅当前已在 Brush 模式时**才更新笔刷 | 避免意外切换工具、打断工作流 |
| 双击 | 在场景中心 (320,240) 创建实体 | **Reuse-or-Split 打开 Prefab Preview 面板** | 对齐 P1 原则，消除唯一的例外 |
| 实例化 | 仅双击 | 拖拽到 Viewport / Preview 面板按钮 / 快捷键 | 实例化变为显式操作，可预期 |

**Prefab Preview 面板**（轻量实现，为未来 Prefab Editor 铺路）：

```
┌─────────────────────────────────┐
│  Prefab Preview            [×]  │
│  ┌───────────┐                  │
│  │           │  Name: Torch     │
│  │  (预览图)  │  Entities: 1    │
│  │           │  Components:     │
│  └───────────┘   - Transform    │
│                   - SpriteRenderer │
│                   - Light2D     │
│                                 │
│  ┌──────────────────┐           │
│  │ 🎯 实例化到场景   │           │
│  └──────────────────┘           │
└─────────────────────────────────┘
```

**未来扩展**：当 Prefab Editor 实现后，双击直接打开 Prefab Editor 进行编辑，Preview 面板升级为完整编辑器。

### 6.3 单击 Prefab 的条件笔刷逻辑

```typescript
function handleAssetClick(asset: AssetNode) {
  // 所有资源：选中 + Properties 刷新
  selectAsset(asset);
  propertiesPanel.inspect(asset);

  // Prefab 特殊逻辑：仅当已在 Brush 模式时才更新笔刷
  if (asset.type === 'prefab' && currentTool.value === 'brush') {
    setBrushPrefab(asset.path);
  }
}
```

这样：
- 在 **Selection 模式** 下单击 Prefab → 只是选中，Properties 显示信息，不切工具
- 在 **Brush 模式** 下单击 Prefab → 选中 + 更新笔刷（高效的笔刷切换）

### 6.4 图片的双击行为

`.png` 等图片文件没有对应的 `.mote-sprite.json`，双击时：

1. 读取图片文件
2. 使用默认参数创建临时 SpriteSheet（16×16 grid，0 margin，0 spacing）
3. 在 Sprite Editor 中打开
4. **顶部显示提示条**：`📝 临时导入模式（16×16 grid）— 调整参数后可保存为 .mote-sprite.json`
5. 用户可以在 Sprite Editor 中调整参数后导出为 `.mote-sprite.json`

---

## 6.5 Spawn Menu：Blender Shift+A 快速添加

在 Blender 中，**Shift+A** 是 3D Viewport 的核心添加快捷键——无论当前处于什么模式，按 Shift+A 即可在光标位置弹出 Add Menu，选择对象类型后直接创建。这种"无模态快速添加"模式极大地减少了工具切换的打断感。

微尘将其融入 Viewport 的实体放置工作流。

### 6.5.1 触发与行为

| 场景 | 操作 | 结果 |
|------|------|------|
| 鼠标在 Viewport 内 | **Shift+A** | 在**鼠标位置**弹出 Spawn Menu |
| 鼠标不在 Viewport 内 | **Shift+A** | 在**视口中心**弹出 Spawn Menu |
| Spawn Menu 打开时 | **Esc** / 点击空白处 | 关闭菜单，保持当前工具 |
| Spawn Menu 打开时 | **↑↓** / 鼠标悬停 | 导航高亮项 |
| Spawn Menu 打开时 | **Enter** / 点击项 | 在菜单打开位置**单次放置**选中 Prefab |

**核心规则**：
- 放置后**自动关闭菜单**，**不切换当前工具**（Select 模式下单击放置后继续选择）
- 和 Brush 工具是完全互补的两条路径：
  - **Shift+A** = 单次快速放置（零打断）
  - **Brush 工具 + Content Browser** = 连续批量绘制

### 6.5.2 菜单内容

Spawn Menu 是一个浮动非模态面板，列出当前项目中**所有已加载的 Prefab**：

```
┌─────────────────────────────┐
│ [搜索 Prefab...      ]      │
│ 12 个 Prefab   ↑↓选择·Enter  │
├─────────────────────────────┤
│ ● Player          [CHAR]    │  ← 高亮
│ ● Enemy           [CHAR]    │
│ ● Wall            [WALL]    │
│ ● Tree            [ENV]     │
│ ● Torch           [ITEM]    │
└─────────────────────────────┘
```

- **搜索框**：自动聚焦，输入即时过滤（支持名称 / ID / tag）
- **Tag 色点**：每个 Prefab 左侧显示第一个 tag 的颜色标识
- **Tag 标签**：右侧显示 tag 名称（大写缩写）
- **空状态**：若无 Prefab，提示"暂无 Prefab，请在 Content Browser 中创建"

### 6.5.3 放置坐标计算

```typescript
function openSpawnMenuFromViewport() {
  const rect = container.getBoundingClientRect();

  // 1. 确定菜单位置（相对于 container）
  let screenX = lastMousePos ? lastMousePos.x - rect.left : rect.width / 2;
  let screenY = lastMousePos ? lastMousePos.y - rect.top  : rect.height / 2;

  // 2. 边界调整，避免溢出
  if (screenX + MENU_W > rect.width) screenX = rect.width - MENU_W - 8;
  if (screenY + MENU_H > rect.height) screenY = rect.height - MENU_H - 8;

  // 3. 计算对应世界坐标
  const worldPos = screenToWorld(
    lastMousePos ? lastMousePos.x : rect.left + rect.width / 2,
    lastMousePos ? lastMousePos.y : rect.top + rect.height / 2,
    rect
  );

  openSpawnMenu(screenX, screenY, worldPos.x, worldPos.y);
}
```

选择 Prefab 后直接调用 `spawnPrefab(path, worldPos.x, worldPos.y)`，和从 Content Browser 拖拽放置使用同一底层函数。

### 6.5.4 和现有工作流的关系

| 操作路径 | 适用场景 | 工具状态变化 |
|---------|---------|-------------|
| **Shift+A → 选 Prefab** | 快速放置单个对象 | 不变（Select 模式下仍保持 Select） |
| **Content Browser 单击 + Brush 点击** | 连续批量绘制 | 切到 Brush，可连续点击 |
| **Content Browser 拖拽到 Viewport** | 精确位置放置 | 不变 |

**设计意图**：Shift+A 是"想到就放"的快捷入口，Brush 工具是"大规模铺设"的专业入口。两者共存，用户根据任务密度自行选择。

---

## 7. Properties 面板设计

Properties 面板是连接"单击选中"和"双击打开"的桥梁。它让单击有实质性反馈，减少不必要的双击打开操作。

### 7.1 核心行为

| 触发方式 | Properties 面板内容 |
|---------|-------------------|
| 单击 Content Browser 中的资源 | 显示该资源的属性/元信息 |
| 单击 Viewport 中的实体 | 显示该实体的组件/属性 |
| 双击打开编辑器后，在编辑器内选中元素 | 切到编辑器内选中元素的属性 |
| 无选中 | 显示空状态或当前场景概要 |

### 7.2 各资源类型的 Properties 内容

| 资源类型 | Properties 显示内容 |
|---------|-------------------|
| **Prefab** | 缩略图、包含的组件列表、引用关系 |
| **Sprite** | 缩略图、帧数、网格尺寸、源图片路径 |
| **图片** | 缩略图、分辨率、文件大小、格式 |
| **场景** | 实体数量、使用的 Prefab 列表 |
| **脚本** | 文件大小、导出的类/函数列表 |
| **音频** | 时长、采样率、文件大小、波形缩略图 |

### 7.3 和 Blender / 游戏引擎的对齐

| 工具 | 类似面板 | 行为 |
|------|---------|------|
| Blender | Properties Editor | 独立 Area，跟随激活对象自动切换 |
| Unity | Inspector | 独立 Docked Panel，跟随选中对象刷新 |
| UE | Details Panel | 独立 Docked Tab，跟随选中对象刷新 |
| **微尘** | **Properties** | **独立 Area，跟随选中资源/实体自动刷新** |

---

## 8. 网页端特殊考虑

### 8.1 双击 vs 右键的技术差异

| 维度 | 双击 | 右键 |
|------|------|------|
| **浏览器兼容性** | ✅ 原生 `dblclick` 事件，无需 preventDefault | ⚠️ 需要 `preventDefault`，部分浏览器可能弹原生菜单 |
| **触摸设备** | ⚠️ 需要"选中 + 打开按钮"替代 | ❌ 无右键，需要长按或点击菜单按钮 |
| **页面缩放** | ⚠️ 需要 `touch-action: manipulation` 防止双击缩放 | ✅ 不影响缩放 |
| **操作速度** | ✅ 快（单次操作） | ❌ 慢（右键→移动→点击） |

### 8.2 双击检测

**推荐使用浏览器原生 `dblclick` 事件**，而非手动检测，理由：
- 原生事件已适配各平台的时间窗口（Windows ~500ms，macOS ~460ms）
- 无需手动维护 `lastClickTarget` / `lastClickTime` 状态
- 浏览器原生处理了同一目标的判定逻辑

```typescript
assetElement.addEventListener('click', (e) => {
  handleAssetClick(asset);
});

assetElement.addEventListener('dblclick', (e) => {
  handleAssetDoubleClick(asset);
});
```

> **注意**：`click` 事件仍然会在 `dblclick` 之前触发两次。如果单击有副作用（如切换工具），需要用 `setTimeout` 延迟单击处理，在 `dblclick` 触发时取消：

```typescript
let clickTimer: number | null = null;

assetElement.addEventListener('click', (e) => {
  if (clickTimer) clearTimeout(clickTimer);
  clickTimer = setTimeout(() => {
    handleAssetClick(asset);  // 延迟执行单击
    clickTimer = null;
  }, 250);
});

assetElement.addEventListener('dblclick', (e) => {
  if (clickTimer) {
    clearTimeout(clickTimer);  // 取消单击
    clickTimer = null;
  }
  handleAssetDoubleClick(asset);  // 立即执行双击
});
```

### 8.3 触摸设备适配

在平板/iPad 等触摸设备上：

- **单击**：选中资源 + Properties 刷新
- **双击**：浏览器原生模拟双击（两次快速点击识别）
- **长按（Long Press）**：替代右键菜单，显示文件管理选项
- **顶部工具栏**：提供"打开"按钮，选中后点击即可打开（参考 Blender Android 端的 Tab 化方向）

```
触摸设备工作流：
  单击资源 → 选中（高亮）+ Properties 刷新
  点击顶部"打开"按钮 → 打开对应编辑器
  长按资源 → 弹出文件管理菜单（重命名/删除）
```

### 8.4 为什么坚持双击而不是单击打开

虽然网页端有"单击打开"的先例（如某些网页文件管理器），但对于微尘的目标用户（游戏开发者）：

- 他们已经习惯了专业软件的交互模式
- 单击选中是一个必要的中间步骤（Properties 查看、拖拽、笔刷设置）
- 如果单击直接打开，用户无法"选中但不打开"，会打断工作流

---

## 9. 右键菜单设计

### 9.1 菜单项

右键菜单只保留文件管理操作，**不包含任何"打开"相关的菜单项**。

```
┌────────────────────────┐
│ ✏️ 重命名              │
│ 🗑️ 删除                │
├────────────────────────┤
│ 📋 复制路径  (未来)    │
│ 📋 复制 GUID (未来)    │
│ 🔍 查找引用  (未来)    │
│ 📁 在文件夹中显示(未来)│
└────────────────────────┘
```

### 9.2 为什么移除"在 Sprite Editor 中打开"

- **职责重复**：双击已经覆盖了这个功能，右键菜单再提供就是冗余
- **菜单精简**：菜单项越少，用户找到目标的速度越快（Hick's Law: RT = a + b·log₂(n)）
- **避免混淆**：如果右键有"打开"，用户会疑惑"双击和右键打开有什么区别？"

### 9.3 "查找引用"说明

"查找引用"对于游戏资源管理非常有价值（类似 Unity 的 "Find References in Scene"），可以回答"这个 Sprite 被哪些 Prefab 使用了？"。虽然是未来功能，在菜单设计中预留位置。

---

## 10. 实现要点

### 10.1 Reuse-or-Split 实现

`layout/tree.ts` 中提供通用函数：

```typescript
export function openEditorForResource(
  root: LayoutNode,
  sourceAreaId: string,      // 当前面板 ID（Content Browser）
  editorType: string,        // 目标编辑器类型
  resourcePath: string,      // 资源路径
  options?: {
    direction?: 'horizontal' | 'vertical';  // Split 方向（auto 时自动计算）
    ratio?: number;            // Split 比例，默认 0.5
    forceNewPanel?: boolean;   // true = 跳过 Reuse，强制 Split（Shift+双击）
    minWidth?: number;         // 最小面板宽度，默认 200
    minHeight?: number;        // 最小面板高度，默认 150
  }
): { layout: LayoutNode; targetAreaId: string }
```

### 10.2 各资源类型的双击 handler

```typescript
function handleAssetDoubleClick(asset: AssetNode) {
  switch (asset.type) {
    case 'folder':
      // 进入文件夹
      selectedFolderPath.value = asset.path;
      searchQuery.value = '';
      break;

    case 'prefab':
      // 打开 Prefab Preview 面板
      openPrefabPreview(asset.path).then(ok => {
        if (ok) {
          const result = openEditorForResource(
            layoutTree.value, areaId, 'prefab-preview', asset.path
          );
          layoutTree.value = result.layout;
        }
      });
      break;

    case 'sprite':
      // 打开 Sprite Editor
      openAssetInSpriteEditor(asset.path).then(ok => {
        if (ok) {
          const result = openEditorForResource(
            layoutTree.value, areaId, 'sprite-editor', asset.path
          );
          layoutTree.value = result.layout;
        }
      });
      break;

    case 'image':
      // 打开 Sprite Editor（导入模式）
      openImageInSpriteEditor(asset.path).then(ok => {
        if (ok) {
          const result = openEditorForResource(
            layoutTree.value, areaId, 'sprite-editor', asset.path
          );
          layoutTree.value = result.layout;
        }
      });
      break;

    case 'scene':
      // 加载场景到 Viewport
      loadScene(asset.path);
      break;

    case 'script':
      // TODO: 打开 Code Editor
      break;

    case 'audio':
      // TODO: 预览播放
      break;

    default:
      // 未知类型：无操作
      break;
  }
}
```

### 10.3 Prefab 实例化入口（拖拽到 Viewport）

```typescript
// Content Browser 中的拖拽开始
function onPrefabDragStart(asset: AssetNode, e: DragEvent) {
  if (asset.type !== 'prefab') return;
  e.dataTransfer?.setData('application/x-mote-prefab', asset.path);
}

// Viewport 中的拖放接收
function onViewportDrop(e: DragEvent) {
  const prefabPath = e.dataTransfer?.getData('application/x-mote-prefab');
  if (!prefabPath) return;

  const worldPos = screenToWorld(e.clientX, e.clientY);
  spawnPrefab(prefabPath, worldPos.x, worldPos.y);
}
```

---

## 11. 设计决策记录

| 编号 | 决策 | 理由 | 变更 |
|------|------|------|------|
| D1 | 双击作为"打开编辑器"的主入口，100% 无例外 | 所有主流引擎都采用此方案 | v2.0：Prefab 从"实例化"改为"打开" |
| D2 | 右键菜单不包含"打开" | 避免职责重复，精简菜单 | — |
| D3 | 单击用于选中 + Properties 刷新 | 为后续操作提供前置步骤和即时反馈 | v2.0：新增 Properties 刷新 |
| D4 | Reuse-or-Split 不动源面板 | 保持工作流连续性，符合行业标准 | — |
| D5 | 图片双击直接导入 Sprite Editor | 降低首次使用门槛 | v2.0：新增提示条 |
| D6 | Prefab 单击仅在 Brush 模式下设笔刷 | 避免意外切换工具，打断其他模式的工作流 | v2.0：从无条件切换改为条件触发 |
| D7 | 触摸设备用"选中+打开按钮"替代双击 | 适应触摸限制，对齐 Blender Android 端方向 | — |
| D8 | 使用浏览器原生 `dblclick` 事件 | 避免手动管理时间窗口，平台适配更好 | v2.0 新增 |
| D9 | Blender Area 容器层 + 游戏引擎交互层 | 底层对齐 Blender 经过验证的面板系统，交互层对齐用户预期 | v2.0 新增 |
| D10 | 部分 EditorType 支持 Area 内 Tab | 对齐 Blender 5 的 Editor Tabs 探索方向，解决多资源对比需求 | v2.0 新增 |
| D11 | Viewport 中 Shift+A 弹出 Spawn Menu 快速放置 Prefab | 对齐 Blender 的无模态快速添加模式，和 Brush 工具形成互补 | v2.0 新增 |

---

## 12. 分阶段实施路线图

### 阶段 1：统一双击行为（当前优先）

| 任务 | 说明 | 工作量预估 |
|------|------|-----------|
| 修正 Prefab 双击 | 从"实例化"改为"打开 Prefab Preview 面板" | 中 |
| 修正 Prefab 单击 | 条件笔刷逻辑（仅 Brush 模式） | 小 |
| Sprite 双击 | Reuse-or-Split 打开 Sprite Editor | 中 |
| 图片双击 | Reuse-or-Split 打开 Sprite Editor（导入模式）+ 提示条 | 中 |
| 使用原生 dblclick | 替换手动双击检测 | 小 |

### 阶段 2：Properties 面板 + 面板路由

| 任务 | 说明 | 工作量预估 |
|------|------|-----------|
| Properties 面板实现 | 独立 Area，跟随选中对象刷新 | 大 |
| Split 方向智能选择 | 根据面板长宽比自动决定 Split 方向 | 小 |
| 最小面板尺寸约束 | 低于阈值时触发 Fallback | 小 |
| Prefab 拖拽实例化 | 从 Content Browser 拖 Prefab 到 Viewport | 中 |

### 阶段 3：Area 内 Tab（对齐 Blender 5 方向）

| 任务 | 说明 | 工作量预估 |
|------|------|-----------|
| Tab Bar 组件 | Area Header 区域的 Tab 切换 UI | 中 |
| SpriteEditor 多 Tab | 在同一 Area 内打开多个 Sprite | 中 |
| Shift+双击强制新面板 | 跳过 Reuse，直接 Split | 小 |
| Tab 拖拽排序 / 关闭 | Tab 的基础管理操作 | 中 |

### 阶段 4：高级面板管理（远期）

| 任务 | 说明 | 工作量预估 |
|------|------|-----------|
| Interactive Docking | 拖拽 Area 重新排列（对齐 Blender 5.0） | 大 |
| Workspace 预设 | 保存/恢复完整布局 | 中 |
| Prefab Editor | 完整的 Prefab 编辑器，双击 Prefab 打开 | 大 |
| Code Editor | 脚本编辑器 | 大 |
| 查找引用 | 右键菜单"查找引用" | 中 |

---

## 13. 后续扩展

| 功能 | 说明 |
|------|------|
| **Prefab Editor** | 实现后，Prefab 双击改为打开完整 Prefab Editor |
| **Code Editor** | 实现后，脚本双击打开代码编辑器（支持 Tab） |
| **Animation Editor** | 实现后，动画文件双击打开动画编辑器 |
| **拖放打开** | 支持把资源拖到已有编辑器面板上打开 |
| **Ctrl+单击** | 多选资源（类似文件管理器） |
| **Workspace 快捷切换** | 类似 Blender 顶部的 Workspace Tab Bar |
