# 资源打开交互设计规范

版本：1.0.0 | 日期：2026-04-17

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

在网页端编辑器中，**双击**和**右键菜单**哪种方式更适合作为"打开资源"的主入口？

---

## 2. 设计原则

### 2.1 四条核心原则

| 编号 | 原则 | 说明 |
|------|------|------|
| P1 | **双击打开（Double-Click Open）** | 所有资源的"打开"操作统一由双击触发，和主流引擎一致 |
| P2 | **右键精简（Right-Click Lean）** | 右键菜单只保留文件管理操作（重命名/删除/新建），不包含"打开" |
| P3 | **单击选中（Click to Select）** | 单击用于选中资源，为后续操作（拖拽/笔刷/属性查看）做准备 |
| P4 | **不动源面板（Keep Source Panel）** | 打开操作不会替换当前 Content Browser 面板，使用 Reuse-or-Split 策略 |

### 2.2 原则推导

**为什么是双击打开？**

- 用户预期：Windows Explorer、macOS Finder、Unity Project、Godot FileSystem 都是双击打开
- 操作效率：双击（1 次操作）比 右键→移动→点击（3 次操作）快 3 倍
- 肌肉记忆：专业游戏开发者已经在 Unity/Godot/UE 中形成了双击打开的习惯

**为什么是右键精简？**

- 网页端限制：右键需要 `preventDefault`，可能被浏览器拦截；触摸设备无右键
- 认知负担：右键菜单项越多，用户找到目标的时间越长（Hick's Law）
- 职责单一：右键只做"文件管理"，不做"打开"

---

## 3. 主流引擎对比研究

### 3.1 各引擎的资源打开方式

| 引擎 | 双击行为 | 右键菜单内容 | 备注 |
|------|---------|-------------|------|
| **Unity** | 打开 Inspector 或对应编辑器 | Open / Open With / Show in Explorer / Rename / Delete | 双击是主要打开方式 |
| **Unreal** | 打开对应编辑器（新标签页） | Open / Open With / Rename / Delete / Asset Actions | 双击是主要打开方式 |
| **Godot** | 打开对应编辑器 | Open / Open in File Manager / Rename / Delete | 双击是主要打开方式 |
| **Blender** | 进入编辑模式 / 打开编辑器 | 选中操作 / 数据管理 | Outliner 双击即打开 |

### 3.2 关键发现

**100% 的主流引擎都把"打开编辑器"放在双击上。** 没有任何引擎把"打开"放在右键菜单作为主入口。

右键菜单在所有引擎中都是辅助性的，用途包括：
- 文件系统操作（重命名/删除/复制路径）
- 高级资产管理（导出/导入/引用查找）
- 快捷操作（设为默认/创建副本）

### 3.3 和 Blender 的关系

微尘编辑器的布局系统是 Blender-style（可分割/可切换的面板），但资源浏览器的交互规则不需要和 Blender 完全一致。

| 维度 | Blender Outliner | 微尘 Content Browser |
|------|------------------|---------------------|
| 布局风格 | 固定左侧 Dock | 左树右网格（类似 Unity/Godot） |
| 双击行为 | 进入编辑模式 | **打开对应编辑器** |
| 单击行为 | 选中对象 | **选中资源** |
| 右键菜单 | 数据管理 | **文件管理** |

**结论**：微尘 Content Browser 的交互更接近 Unity/Godot 的 Project 窗口，而非 Blender Outliner。双击打开不会和 Blender 风格冲突。

---

## 4. 最终方案：Double-Click Open + Right-Click Lean

### 4.1 三击分工

| 操作 | 职责 | 类比 |
|------|------|------|
| **单击** | 选中资源 | Windows Explorer 单击选中 |
| **双击** | 打开资源（主入口） | Windows Explorer 双击打开 |
| **右键** | 文件管理（辅助） | Windows Explorer 右键菜单 |

### 4.2 Reuse-or-Split 面板策略

打开资源时，目标编辑器面板遵循以下策略：

```
1. 复用（Reuse）
   └─ 布局中是否已有同类型编辑器面板？
      └─ 是 → 在该面板中加载资源
      └─ 否 → 进入步骤 2

2. 分割（Split）
   └─ 在当前面板旁边 split 出一个新面板
   └─ 新面板加载对应编辑器类型
   └─ 原面板（Content Browser）保持不动

3. Fallback（极端情况）
   └─ 如果无法 split（如只剩一个面板）
   └─ 才允许原地替换当前面板
```

### 4.3 为什么不动源面板

- **工作流连续性**：用户在 Content Browser 中浏览资源时，可能需要连续打开多个资源对比。如果每次打开都替换 Content Browser，用户需要反复切回来。
- **行业标准**：Unity/Godot/UE 的资源浏览器（Project/Content Browser）都不会被资源打开操作替换。
- **Blender 兼容**：Blender 的 Outliner 也是独立面板，打开资源不会影响 Outliner 本身。

---

## 5. 各资源类型的具体行为

### 5.1 统一行为表

| 资源类型 | 扩展名 | 单击 | 双击 | 右键菜单 |
|---------|--------|------|------|---------|
| **文件夹** | 目录 | 选中 + 展开子文件夹 | **进入该文件夹** | 新建文件夹 / 新建 Prefab / 重命名 / 删除 |
| **Prefab** | `.mote-prefab.json` | **设为当前笔刷** + 切 Brush 工具 | **在场景中心 (320,240) 创建实体** | 重命名 / 删除 |
| **Sprite** | `.mote-sprite.json` | 选中 | **Reuse-or-Split 打开 Sprite Editor** | 重命名 / 删除 |
| **图片** | `.png` / `.jpg` / `.webp` | 选中 | **Reuse-or-Split 打开 Sprite Editor**（16x16 grid 导入模式） | 重命名 / 删除 |
| **场景** | `.mote-scene.json` | 选中 | **加载场景到 Viewport** | 重命名 / 删除 |
| **脚本** | `.ts` / `.js` | 选中 | **（未来）Reuse-or-Split 打开 Code Editor** | 重命名 / 删除 |
| **音频** | `.mp3` / `.ogg` / `.wav` | 选中 | **（未来）预览播放** | 重命名 / 删除 |
| **未知** | 其他 | 选中 | 无 | 重命名 / 删除 |

### 5.2 Prefab 的特殊处理

Prefab 的"打开"行为比较特殊，因为它既可以：

1. **作为笔刷使用**（单击）—— 在场景中绘制
2. **实例化为实体**（双击）—— 在场景中心创建一个实体

当前方案保留这两种行为，因为：
- 单击设笔刷是微尘编辑器的核心工作流（和 Tiled 的 tile 笔刷一致）
- 双击创建实体是 Unity/Godot 用户的预期（类似拖 Prefab 到场景）

**未来扩展**：当 Prefab Editor 实现后，双击可以改为"打开 Prefab Editor"，实例化可以通过拖拽到视口或专门的"实例化"按钮完成。

### 5.3 图片的双击行为

`.png` 等图片文件没有对应的 `.mote-sprite.json`，双击时：

1. 读取图片文件
2. 使用默认参数创建临时 SpriteSheet（16x16 grid，0 margin，0 spacing）
3. 在 Sprite Editor 中打开
4. 用户可以在 Sprite Editor 中调整参数后导出为 `.mote-sprite.json`

这相当于一个快速导入流程，让用户无需先手动创建 `.mote-sprite.json` 就能预览和编辑图集。

---

## 6. 网页端特殊考虑

### 6.1 双击 vs 右键的技术差异

| 维度 | 双击 | 右键 |
|------|------|------|
| **浏览器兼容性** | ✅ 原生支持，无需 preventDefault | ⚠️ 需要 `preventDefault`，部分浏览器可能弹原生菜单 |
| **触摸设备** | ⚠️ 需要"点击选中 + 点击打开按钮"替代 | ❌ 无右键，需要长按或点击菜单按钮 |
| **页面缩放** | ⚠️ 需要 `touch-action: manipulation` 防止双击缩放 | ✅ 不影响缩放 |
| **操作速度** | ✅ 快（单次操作） | ❌ 慢（右键→移动→点击） |

### 6.2 触摸设备适配

在平板/iPad 等触摸设备上：

- **单击**：选中资源
- **双击**：模拟双击（通过两次快速点击识别）
- **长按（Long Press）**：替代右键菜单，显示文件管理选项
- **顶部工具栏**：提供"打开"按钮，选中后点击即可打开

```
触摸设备工作流：
  单击资源 → 选中（高亮）
  点击顶部"打开"按钮 → 打开对应编辑器
  长按资源 → 弹出文件管理菜单（重命名/删除）
```

### 6.3 为什么坚持双击而不是单击打开

虽然网页端有"单击打开"的先例（如某些网页文件管理器），但对于微尘的目标用户（游戏开发者）：

- 他们已经习惯了专业软件的交互模式
- 单击选中是一个必要的中间步骤（设笔刷、拖拽、查看属性）
- 如果单击直接打开，用户无法"选中但不打开"，会打断工作流

---

## 7. 右键菜单设计

### 7.1 菜单项

右键菜单只保留文件管理操作，**不包含任何"打开"相关的菜单项**。

```
┌────────────────────────┐
│ ✏️ 重命名              │
│ 🗑️ 删除                │
├────────────────────────┤
│ 📋 复制路径  (未来)    │
│ 📋 复制 GUID (未来)    │
│ 📁 在文件夹中显示(未来)│
└────────────────────────┘
```

### 7.2 为什么移除"在 Sprite Editor 中打开"

- **职责重复**：双击已经覆盖了这个功能，右键菜单再提供就是冗余
- **菜单精简**：菜单项越少，用户找到目标的速度越快（Hick's Law: RT = a + b·log₂(n)）
- **避免混淆**：如果右键有"打开"，用户会疑惑"双击和右键打开有什么区别？"

---

## 8. 实现要点

### 8.1 双击检测

双击需要在合理的时间窗口内（通常 300-500ms）检测两次连续点击。

```typescript
// 伪代码
let lastClickTime = 0;
let lastClickTarget = null;

function onAssetClick(asset: AssetNode) {
  const now = Date.now();
  const timeDiff = now - lastClickTime;
  
  if (timeDiff < 300 && lastClickTarget === asset.id) {
    // 双击
    handleAssetDoubleClick(asset);
  } else {
    // 单击
    handleAssetClick(asset);
  }
  
  lastClickTime = now;
  lastClickTarget = asset.id;
}
```

### 8.2 Reuse-or-Split 实现

`layout/tree.ts` 中提供通用函数：

```typescript
export function openEditorForResource(
  root: LayoutNode,
  sourceAreaId: string,      // 当前面板 ID（Content Browser）
  editorType: string,        // 目标编辑器类型
  direction: 'horizontal' | 'vertical' = 'horizontal',
  ratio = 0.5
): { layout: LayoutNode; targetAreaId: string }
```

### 8.3 各资源类型的双击 handler

```typescript
function handleAssetDoubleClick(asset: AssetNode) {
  switch (asset.type) {
    case 'folder':
      selectedFolderPath.value = asset.path;
      searchQuery.value = '';
      break;
    case 'prefab':
      spawnPrefab(asset.path, 320, 240);
      break;
    case 'sprite':
      openAssetInSpriteEditor(asset.path).then(ok => {
        if (ok) {
          const result = openEditorForResource(layoutTree.value, areaId, 'sprite-editor');
          layoutTree.value = result.layout;
        }
      });
      break;
    case 'image':
      openImageInSpriteEditor(asset.path).then(ok => {
        if (ok) {
          const result = openEditorForResource(layoutTree.value, areaId, 'sprite-editor');
          layoutTree.value = result.layout;
        }
      });
      break;
    case 'scene':
      // TODO: 加载场景
      break;
    case 'script':
      // TODO: 打开 Code Editor
      break;
  }
}
```

---

## 9. 设计决策记录

| 编号 | 决策 | 理由 |
|------|------|------|
| D1 | 双击作为"打开"的主入口 | 100% 主流引擎（Unity/Godot/UE）都采用此方案 |
| D2 | 右键菜单不包含"打开" | 避免职责重复，精简菜单，降低认知负担 |
| D3 | 单击用于选中 | 为后续操作（笔刷/拖拽/属性）提供必要的前置步骤 |
| D4 | Reuse-or-Split 不动源面板 | 保持工作流连续性，符合行业标准 |
| D5 | 图片双击直接导入 Sprite Editor | 降低首次使用门槛，无需手动创建 .mote-sprite.json |
| D6 | Prefab 单击设笔刷，双击实例化 | 保留微尘特有的笔刷工作流，同时提供 Unity 式实例化 |
| D7 | 触摸设备用"选中+打开按钮"替代双击 | 适应触摸设备的交互限制，同时保持桌面端的效率 |

---

## 10. 后续扩展

| 功能 | 说明 |
|------|------|
| **Prefab Editor** | 实现后，Prefab 双击改为打开 Prefab Editor，实例化改为拖拽到视口 |
| **Code Editor** | 实现后，脚本双击打开代码编辑器 |
| **Animation Editor** | 实现后，动画文件双击打开动画编辑器 |
| **拖放打开** | 支持把资源拖到已有编辑器面板上打开 |
| **Shift+双击** | 在第二个面板中打开（类似 VS Code 的"在新标签页打开"） |
| **Ctrl+单击** | 多选资源（类似文件管理器） |
