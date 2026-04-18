# Content Browser 设计文档

版本：1.0.0 | 日期：2026-04-17

---

## 1. 概述

本文档定义微尘编辑器中 **Content Browser（内容浏览器 / 资源浏览器）** 的设计方案。它将替代当前分离的 **Prefab 浏览器** 和 **资源面板**，提供一个统一的、基于文件系统的资源管理视图。

### 1.1 为什么要合并

当前编辑器存在两个互不相通的右侧面板：
- **Prefab 浏览器**：以卡片网格展示 Prefab，支持 Tag 分组和拖拽到场景，但数据来源是内存中的 `Map`，未连接真实文件系统。
- **资源面板**：以文件夹树展示 `assets/` 结构，但 `assetTree` 是硬编码的静态数据，不反映磁盘文件。

这导致了严重的信息孤岛问题：
- Prefab 是存储在 `assets/` 下的 `.mote-prefab.json` 文件，但在资源面板中不可见。
- 用户在资源面板中管理文件，却在 Prefab 浏览器中寻找可用的 Prefab，工作流是断裂的。
- 右侧面板被垂直切成上下两块，空间利用率低。

### 1.2 设计原则

- **一个入口，统一管理**：所有资源（Prefab、场景、图片、脚本）都在同一个浏览器中管理。
- **文件即资源**：视图直接映射真实文件系统，不维护独立的资源数据库。
- **扩展名即类型**：资源类型由文件扩展名决定，不由所在目录决定（与 `design-mote-folder-structure.md` 保持一致）。
- **渐进加载**：目录树按需/增量扫描，避免打开大项目时全量扫描造成的卡顿。
- **向后兼容现有工作流**：保留 Prefab 卡片的拖拽和"设为笔刷"行为，只是换了一个容器。

---

## 2. 设计目标

| 目标 | 说明 |
|------|------|
| **统一视图** | 左树右网格的经典布局，同时满足导航和浏览需求 |
| **真实文件映射** | 直接扫描 `assets/` 和 `src/` 目录，动态反映文件变化 |
| **类型过滤** | 通过扩展名过滤器快速筛选 Prefab / 图片 / 场景 / 脚本等 |
| **搜索** | 全局搜索（跨文件夹）和当前文件夹内搜索 |
| **拖拽** | Prefab 拖到视口创建实体；图片拖到 Sprite Editor 打开 |
| **快捷操作** | 右键菜单支持新建、重命名、删除、导入；支持拖拽移动文件 |

---

## 3. 与旧方案对比

| 维度 | 旧方案（Prefab 浏览器 + 资源） | 新方案（Content Browser） |
|------|------------------------------|--------------------------|
| 面板数量 | 2 个（上下分割） | 1 个 |
| 数据来源 | Prefab 浏览器：内存 Map；资源：硬编码树 | 统一来自真实文件系统扫描 |
| Prefab 可见性 | 仅在 Prefab 浏览器 | 在资源树和网格中均可见 |
| 空间利用 | 右侧面板被切成 4 块 | 右侧可只保留 2 块（资源 + 属性） |
| 用户体验 | 需要记忆 Prefab 在哪个面板 | 和 Unity/Godot 一致，学习成本低 |
| 代码维护 | 两套状态、两套拖拽逻辑 | 一套状态、一套通用卡片组件 |

---

## 4. UI/UX 设计

### 4.1 整体布局

采用 **Unity/Godot 风格** 的左树右网格布局：

#### Grid 视图
```
┌──────────────────────────────────────────────────────┐
│ 🔍 搜索...    [全部 ▼]   ⊞ Grid  ☰ List      ＋   │  ← 工具栏
├──────────────────┬───────────────────────────────────┤
│ 📁 assets        │  ┌──────┐ ┌──────┐ ┌──────┐      │
│   ▼ 📁 images    │  │      │ │      │ │      │      │
│   ▶ 📁 sprites   │  │ 🖼   │ │ 🎨   │ │ 📦   │      │
│   ▼ 📁 entities  │  │      │ │      │ │      │      │
│     📦 hero      │  └──────┘ └──────┘ └──────┘      │
│     📦 enemy     │  hero.png tileset  player        │
│   ▶ 📁 maps      │                                  │
│ ▶ 📁 scripts     │                                  │
└──────────────────┴───────────────────────────────────┘
  ← Folder Tree    →   Asset Grid (Tile / Grid)
```

#### List 视图
```
┌──────────────────────────────────────────────────────┐
│ 🔍 搜索...    [全部 ▼]   ⊞ Grid  ☰ List      ＋   │
├──────────────────┬───────────────────────────────────┤
│ 📁 assets        │  Name          Type      Modified │
│   ▼ 📁 images    │  ──────────────────────────────── │
│   ▶ 📁 sprites   │  □ hero.png    Image     2m ago  │
│   ▼ 📁 entities  │  □ tileset     Sprite    1h ago  │
│     📦 hero      │  □ player      Prefab    3h ago  │
│     📦 enemy     │  □ main        Scene     1d ago  │
│   ▶ 📁 maps      │  □ game.ts     Script    2d ago  │
│ ▶ 📁 scripts     │                                  │
└──────────────────┴───────────────────────────────────┘
  ← Folder Tree    →   Asset List (Details / List)
```

### 4.2 区域说明

#### 顶部工具栏
| 控件 | 功能 |
|------|------|
| 搜索框 | 按名称过滤当前视图。支持 `/` 前缀全局搜索 |
| 类型过滤器 | `全部` / `Prefab` / `图片` / `Sprite` / `场景` / `脚本` / `文件夹` |
| **视图切换** | **`⊞ Grid`** / **`☰ List`** — 切换右侧显示模式（参考 UE Content Browser） |
| `＋` 按钮 | 下拉菜单：新建文件夹、新建 Prefab、导入文件 |

> 工具栏右侧预留未来扩展：缩放滑块（Grid 模式下调节缩略图尺寸）、排序选项。

#### 左侧 Folder Tree
- 显示 `assets/` 和 `src/` 的递归目录结构。
- 文件夹可展开/折叠。
- 点击文件夹：在右侧网格中显示其内容。
- 支持右键菜单（新建、重命名、删除）。
- 支持拖拽：把文件/文件夹拖入另一个文件夹实现移动。

#### 右侧 Asset View
显示当前选中文件夹下的所有文件和子文件夹。根据工具栏切换，呈现 **Grid** 或 **List** 两种形态：

- **文件夹** 以文件夹图标展示，双击进入。
- **Prefab** 在 Grid 下以卡片形式展示缩略图，在 List 下以行形式展示。
- **其他资源** 以类型图标或真实缩略图展示。
- 支持框选、Ctrl 多选、Shift 连选（未来扩展）。

### 4.3 视图模式（Grid / List）

参考 **Unreal Engine Content Browser** 的设计，右侧视图只有两种互斥模式，通过工具栏上的按钮组切换：

#### Grid 视图（默认）

- **布局**：等宽网格，自适应列数（CSS `grid-template-columns: repeat(auto-fill, minmax(96px, 1fr))`）
- **单元内容**：
  - 顶部：缩略图/图标区域（默认 64×64 px，未来支持缩放）
  - 底部：文件名（单行截断，hover 显示完整路径）
  - 右下角：小图标表示资源类型（Prefab、Scene 等）
- **选中态**：蓝色边框 + 淡蓝背景（和现有 PrefabCard 一致）
- **适用场景**：浏览 Prefab、图片、Sprite 等需要视觉识别的资源

#### List 视图

- **布局**：单列纵向列表，每行占满整宽
- **行内容**：从左到右依次为
  - 类型图标（16px）
  - 资源名称
  - 资源类型（如 `Prefab`、`Image`、`Script`）
  - 修改时间（相对时间，如 `2m ago`）
  - 文件大小（未来扩展）
- **表头**：可点击排序（名称 / 类型 / 修改时间）
- **选中态**：整行高亮（蓝色背景）
- **适用场景**：管理大量脚本、查看文件元信息、批量重命名

#### 视图持久化

`viewMode` 保存到 `localStorage`，下次打开编辑器时恢复用户上次的选择。

---

## 5. 数据结构与状态管理

### 5.1 文件节点类型

```typescript
export type AssetType =
  | 'folder'
  | 'image'
  | 'sprite'
  | 'prefab'
  | 'scene'
  | 'tilemap'
  | 'script'
  | 'audio'
  | 'unknown';

export interface AssetNode {
  id: string;           // 唯一标识，使用文件路径
  name: string;         // 显示名称（文件名或文件夹名）
  path: string;         // 相对于项目根的路径，如 "assets/prefabs/hero.mote-prefab.json"
  type: AssetType;
  children?: AssetNode[];
  lastModified?: number;
  // 未来扩展：size, thumbnail, tags 等
}
```

### 5.2 Signal 状态

在 `store/contentBrowser.ts` 中维护：

```typescript
// 完整资产树（只包含 assets/ 和 src/）
export const assetTree = signal<AssetNode[]>([]);

// 当前选中的文件夹路径
export const selectedFolderPath = signal<string>('assets');

// 搜索关键词
export const searchQuery = signal('');

// 类型过滤器
export const typeFilter = signal<AssetType | 'all'>('all');

// 视图模式：Grid（卡片网格）或 List（列表详情）
export const viewMode = signal<'grid' | 'list'>('grid');

// Grid 模式下缩略图尺寸级别（未来扩展，当前固定 64）
export const gridThumbnailSize = signal<64 | 96 | 128>(64);

// List 模式下排序字段
export const listSortBy = signal<'name' | 'type' | 'modified'>('name');
export const listSortAsc = signal<boolean>(true);

// 当前选中的资源路径（多选未来扩展为数组）
export const selectedAssetPaths = signal<string[]>([]);
```

### 5.3 计算属性

```typescript
// 当前文件夹下的可见节点（应用搜索和类型过滤）
export const visibleAssets = computed(() => {
  const folder = findNode(assetTree.value, selectedFolderPath.value);
  if (!folder || !folder.children) return [];
  
  let nodes = folder.children;
  
  if (searchQuery.value) {
    nodes = nodes.filter(n => n.name.toLowerCase().includes(searchQuery.value.toLowerCase()));
  }
  
  if (typeFilter.value !== 'all') {
    nodes = nodes.filter(n => n.type === typeFilter.value || n.type === 'folder');
  }
  
  return nodes;
});
```

---

## 6. 文件类型与图标映射

由扩展名自动识别，映射规则：

| 扩展名 | AssetType | 图标/缩略图 | 打开方式 |
|--------|-----------|------------|---------|
| `.mote-prefab.json` | `prefab` | `PrefabCard` 组件（带缩略图） | 点击设为笔刷；双击在场景中心创建 |
| `.mote-scene.json` | `scene` | 🗺 | 双击打开场景编辑器 |
| `.mote-sprite.json` | `sprite` | 🎨 | 双击打开 Sprite Editor |
| `.mote-tilemap.json` | `tilemap` | ⬜ | 双击打开 Tilemap Editor |
| `.png` / `.jpg` / `.webp` | `image` | 🖼 或真实缩略图 | 双击在图片查看器中打开 |
| `.ts` / `.js` | `script` | 📜 | 双击在代码编辑器中打开 |
| `.mp3` / `.ogg` / `.wav` | `audio` | 🔊 | 双击预览播放 |
| 目录 | `folder` | 📁 / 📂 | 双击进入文件夹 |
| 其他 | `unknown` | 📄 | — |

### 6.1 Prefab 缩略图逻辑

直接复用 `data/Prefab.ts` 中的 `getPrefabThumbnail()`：
- 如果 Prefab 有 `thumbnail` 字段，显示该图片。
- 如果 Prefab 有 `Sprite` 组件，尝试从对应的 Atlas 加载帧图像作为缩略图（异步）。
- 否则显示默认图标（`📦` 或 `🎨`）。

---

## 7. 交互行为

### 7.1 点击行为

| 目标 | 单击 | 双击 |
|------|------|------|
| **文件夹** | 选中 + 右侧显示内容 | 进入该文件夹 |
| **Prefab** | 设为当前笔刷 + 切到 Brush 工具 | 在场景中心 (320, 240) 创建实体 |
| **场景** | 选中 | 打开该场景 |
| **Sprite** | 选中 | 打开 Sprite Editor |
| **图片** | 选中 | 在图片查看器中打开 |
| **脚本** | 选中 | 在代码编辑器中打开 |

### 7.2 拖拽行为

#### 从 Content Browser 拖出
- **Prefab → Viewport**：创建该 Prefab 的实体。
- **图片 → Sprite Editor**：将该图片作为新 Atlas 的 `image` 源。
- **文件夹/文件 在 Tree 中拖拽**：移动文件到目标文件夹（调用 `FileSystem.move`）。

#### 拖入 Content Browser
- **外部图片拖入**：触发导入，保存到当前选中文件夹。
- **Viewport 中的实体拖入**：将该实体导出为 Prefab 并保存到当前文件夹（未来扩展）。

### 7.3 右键菜单

| 选项 | 适用类型 | 行为 |
|------|---------|------|
| 新建文件夹 | 文件夹 | 在当前文件夹下创建 `New Folder` |
| 新建 Prefab | 文件夹 | 创建空白 `new-prefab.mote-prefab.json` |
| 导入文件... | 文件夹 | 打开文件选择器，复制文件到当前目录 |
| 在 Sprite Editor 中打开 | `image`, `sprite` | 打开 Sprite Editor |
| 重命名 | 全部 | 原地重命名（调用 `FileSystem.move`） |
| 删除 | 全部 | 确认后删除（调用 `FileSystem.remove`） |

### 7.4 搜索行为

- **普通输入**：在当前选中文件夹下按名称过滤。
- **`/` 前缀**：全局搜索（递归搜索整个 `assets/` 和 `src/`），结果在网格中平铺展示，左侧 Tree 高亮匹配项。
- **清空搜索**：返回之前选中的文件夹视图。

---

## 8. 与现有系统的集成

### 8.1 文件系统（FileSystem）

Content Browser 是 `FileSystem` 的消费方。扫描逻辑：

```typescript
async function scanDirectory(dirPath: string): Promise<AssetNode[]> {
  const entries = await fs.listDirectory(dirPath);
  const nodes: AssetNode[] = [];
  
  for (const entry of entries) {
    const path = `${dirPath}/${entry.name}`;
    if (entry.kind === 'directory') {
      nodes.push({
        id: path,
        name: entry.name,
        path,
        type: 'folder',
        children: await scanDirectory(path),
      });
    } else {
      nodes.push({
        id: path,
        name: entry.name,
        path,
        type: detectAssetType(entry.name),
      });
    }
  }
  
  return nodes;
}
```

> **性能提示**：大项目下全量递归扫描可能较慢。未来可引入增量扫描 + `manifest.json` 缓存，但当前版本先实现全量扫描，保证简单和正确性。

### 8.2 Prefab Store

当扫描到 `.mote-prefab.json` 时，自动调用 `PrefabFS.loadFromPath()` 将其加载到 `store/prefabs` 中。这样：
- Content Browser 可以显示 Prefab 的 `name` 和缩略图。
- 视口拖拽和笔刷系统无需改动，继续使用 `store/prefabs`。

### 8.3 布局系统（Layout）

默认布局将调整：

```typescript
// 旧布局：右侧 = Prefab Browser (上) + Inspector (下)
// 新布局：右侧 = Content Browser (上) + Inspector (下)
{
  type: 'split',
  id: 'right',
  direction: 'horizontal',
  ratio: 0.55,
  children: [
    { type: 'area', id: 'area_content_browser', editorType: 'content-browser' },
    { type: 'area', id: 'area_inspector', editorType: 'inspector' },
  ],
}
```

或者更激进地把 Content Browser 放在底部左侧，视口上方：

```typescript
// 备选布局：左下 = Content Browser，左上 = Viewport，右侧 = Inspector
{
  type: 'split',
  id: 'left',
  direction: 'horizontal',
  ratio: 0.6,
  children: [
    { type: 'area', id: 'area_viewport', editorType: 'viewport' },
    { type: 'area', id: 'area_content_browser', editorType: 'content-browser' },
  ],
}
```

> **决策**：先采用方案一（右侧上下），因为和现有用户习惯最接近；后续根据反馈可调整。

### 8.4 编辑器注册

新增一个编辑器类型 `content-browser`，注册到 `editors/registry.ts`：

```typescript
registerEditor({
  id: 'content-browser',
  name: '资源',
  icon: '📦',
  component: ContentBrowser,
});
```

---

## 9. 实现计划

### Phase 1：基础扫描与树形展示 ✅
- [x] 创建 `editors/content-browser/` 目录结构
- [x] 实现 `scanAssets()` 递归扫描函数
- [x] 实现 `FolderTree` 组件（左侧树）
- [x] 实现 `AssetView` 组件（右侧 Grid / List 视图）
- [x] 创建 `store/contentBrowser.ts` 状态管理
- [x] 注册 `content-browser` 编辑器

### Phase 2：Prefab 集成与卡片视图 ✅
- [x] 扫描时自动加载 `.mote-prefab.json` 到 `store/prefabs`
- [x] 在 `AssetCard` 中为 Prefab 复用缩略图图标（🎨/📦）
- [x] 实现点击设为笔刷、双击创建实体
- [x] 实现 Prefab 的拖拽到视口

### Phase 3：交互补全 ✅
- [x] 搜索框（当前文件夹过滤 + `/` 全局搜索）
- [x] 类型过滤器下拉菜单
- [x] 视图切换（Grid / List）
- [ ] Grid 视图缩略图尺寸调节（未来扩展）
- [x] List 视图表头排序（名称 / 类型）
- [x] 右键菜单（新建文件夹、新建 Prefab、重命名、删除、导入）
- [ ] 拖拽移动文件（Tree 内，未来扩展）

### Phase 4：布局迁移与清理 ✅
- [x] 更新 `store/layout.ts` 默认布局（Content Browser 替换右侧上方）
- [x] 移除 `prefab-browser` 和 `assets` 的注册导入
- [x] 废弃（保留源码但不注册）`editors/prefab-browser/` 和 `editors/assets/`
- [x] 更新 `App.tsx` 的注册顺序

---

## 10. 废弃与迁移说明

### 10.1 废弃的模块

以下模块在 Content Browser 完成后进入**维护冻结状态**：

- `packages/editor/src/editors/prefab-browser/PrefabBrowser.tsx`
- `packages/editor/src/editors/prefab-browser/PrefabCard.tsx`
- `packages/editor/src/editors/prefab-browser/PrefabCategory.tsx`
- `packages/editor/src/editors/prefab-browser/SearchBar.tsx`
- `packages/editor/src/editors/prefab-browser/register.ts`
- `packages/editor/src/editors/assets/AssetsEditor.tsx`
- `packages/editor/src/editors/assets/register.ts`

### 10.2 可复用的逻辑

| 旧模块 | 可复用内容 | 迁移目标 |
|--------|-----------|---------|
| `PrefabCard.tsx` | 卡片样式、缩略图逻辑、拖拽数据 | `content-browser/AssetCard.tsx` |
| `AssetsEditor.tsx` | ContextMenu 组件、TreeNode 结构 | `content-browser/FolderTree.tsx` |
| `prefabs.ts` | Prefab 状态管理 | 保留，由 Content Browser 自动填充 |
| `PrefabFS.ts` | 文件读写、扫描 | 保留，Content Browser 直接调用 |

### 10.3 不兼容变更

- 默认布局中 `prefab-browser` 和 `assets` 区域将替换为 `content-browser`。
- 之前打开过旧布局的用户（如果布局持久化到 localStorage）可能需要重置布局才能看到新面板。

---

## 11. 设计决策记录

| 编号 | 决策 | 理由 |
|------|------|------|
| D1 | 合并 Prefab 浏览器和资源面板 | 消除信息孤岛，符合 Unity/Godot 行业标准 |
| D2 | 采用左树右网格布局 | 同时满足导航（树）和浏览（网格）两种需求 |
| D3 | 直接扫描真实文件系统 | 数据单一来源，避免内存与磁盘不一致 |
| D4 | 保留 PrefabCard 视觉风格 | 降低迁移成本，保持现有笔刷工作流不变 |
| D5 | 扩展名决定类型和图标 | 与 `design-mote-folder-structure.md` 一致，目录结构完全自由 |
| D6 | 扫描时自动加载 Prefab 到 Store | 让视口和笔刷系统无需感知 Content Browser 的存在 |
| D7 | 先全量扫描，未来引入 manifest 优化 | 保证正确性和简单性，性能问题后续用缓存解决 |
| D8 | 旧编辑器源码保留但不注册 | 防止误删有用的 UI 模式代码，后续可提取为子组件 |
