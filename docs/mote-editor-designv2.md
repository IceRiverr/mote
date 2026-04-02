# Mote Editor 设计文档 v2

本文档描述 Mote 编辑器的架构设计和实现细节。编辑器采用 **Blender 风格的自由分割布局系统**，整个窗口是一棵可动态分割/合并的区域树。

---

## 核心架构

### 1. 区域树（Area Tree）

整个编辑器布局由一棵二叉树表示，每个节点可以是：

```typescript
// packages/editor/src/core/area-tree.ts

/** 区域节点 - 叶子节点（实际的面板） */
interface LeafNode {
  type: "leaf";
  id: string;
  editorType: EditorType;
}

/** 区域节点 - 分割节点（内部节点） */
interface SplitNode {
  type: "split";
  direction: "horizontal" | "vertical";
  ratio: number;  // 0~1, first 占的比例
  first: AreaNode;
  second: AreaNode;
}

type AreaNode = LeafNode | SplitNode;

/** 支持的编辑器类型 */
type EditorType =
  | "viewport"      // 2D 场景视口
  | "scene-tree"    // 实体树
  | "inspector"     // 属性面板
  | "asset-browser" // 资源浏览器
  | "tilemap"       // Tilemap 编辑器
  | "console"       // 控制台
  | "code";         // 脚本预览
```

### 2. 状态管理（LayoutState）

使用 **Preact Signals** 进行响应式状态管理，支持自动持久化：

```typescript
// packages/editor/src/core/layout-state.ts

export class LayoutState {
  root: Signal<AreaNode>;           // 区域树根节点
  activeEditorId: Signal<string | null>;
  leafs: Signal<LeafNode[]>;        // 所有叶子节点（计算属性）
  
  // 核心操作
  setEditorType(id, type)          // 切换编辑器类型
  setRatio(node, ratio)            // 调整分割比例
  split(id, direction, ratio)      // 分割区域
  remove(id)                       // 合并区域（至少保留 1 个）
  reset()                          // 重置为默认布局
  
  // 持久化
  private saveToStorage()          // 自动保存到 localStorage
  private loadFromStorage()        // 从 localStorage 恢复
}

// 全局单例
export const layoutState = new LayoutState();
```

### 3. 默认布局

```typescript
// 经典的 3+1 面板布局
// 左侧 Scene Tree (20%) | 中间 Viewport (55%) | 右侧 Inspector (25%)
// 底部 Asset Browser (25%)

function createDefaultLayout(): AreaNode {
  const left = createLeaf("scene-tree");
  const center = createLeaf("viewport");
  const right = createLeaf("inspector");
  const bottom = createLeaf("asset-browser");

  // 先分割左右：左 20% | 中右 80%
  const topRow = createSplit("horizontal", 0.2, left, 
    createSplit("horizontal", 0.7, center, right)
  );

  // 上下分割：上 75% | 下 25%
  return createSplit("vertical", 0.75, topRow, bottom);
}
```

---

## 组件系统

### 递归渲染

```typescript
// packages/editor/src/components/AreaTreeRenderer.tsx

export function AreaTreeRenderer({ node }: { node: AreaNode }) {
  if (node.type === "leaf") {
    return <AreaPanel node={node} />;
  }

  return (
    <SplitPane node={node}>
      <AreaTreeRenderer node={node.first} />
      <AreaTreeRenderer node={node.second} />
    </SplitPane>
  );
}
```

### SplitPane - 可拖拽分割面板

```typescript
// packages/editor/src/components/SplitPane.tsx

interface SplitPaneProps {
  node: SplitNode;
  children: [preact.ComponentChild, preact.ComponentChild];
}

// 特性：
// - 水平/垂直分割方向
// - 拖拽 divider 调整 ratio（限制 0.1~0.9）
// - 拖拽时设置 pointer-events: none 避免干扰
```

### AreaPanel - 区域面板

```typescript
// packages/editor/src/components/AreaPanel.tsx

interface AreaPanelProps {
  node: LeafNode;
}

// 结构：
// ┌─[AreaHeader]─────────────────┐
// │                              │
// │    [Editor Content]          │
// │                              │
// │ [CornerHandle x 4]           │
// └──────────────────────────────┘
```

### AreaHeader - 区域头栏

```typescript
// packages/editor/src/components/AreaHeader.tsx

interface AreaHeaderProps {
  editorType: EditorType;
  onChangeType: (type: EditorType) => void;
}

// 结构：
// ┌─[Editor Selector ▾]──[Tools]────┐
// 
// Editor Selector: 下拉菜单切换编辑器类型
// Tools: 编辑器专属工具（如 Viewport 的 Move/Rotate/Scale 按钮）
```

### CornerHandle - 四角手柄

```typescript
// packages/editor/src/components/CornerHandle.tsx

interface CornerHandleProps {
  corner: "tl" | "tr" | "bl" | "br";  // top-left, top-right, bottom-left, bottom-right
  areaId: string;
}

// 交互逻辑：
// - 向内拖拽 → 分割区域（水平或垂直）
// - 向外拖拽 → 合并区域（删除当前区域）
// - 最小触发距离：20px
```

### CollapsibleSection - 可折叠分组

```typescript
// packages/editor/src/components/CollapsibleSection.tsx

interface CollapsibleSectionProps {
  title: string;
  defaultOpen?: boolean;
  children: preact.ComponentChild;
}

// 用于 Inspector 面板的属性分组
// ▼ Transform    ← 点击折叠/展开
// ▶ Sprite
// ▼ Physics
```

---

## 编辑器实现

### 1. ViewportEditor - 场景视口

```typescript
// packages/editor/src/editors/ViewportEditor.tsx

// 当前状态：占位实现
// - Canvas 自适应父容器大小（ResizeObserver）
// - 绘制网格背景（32px 网格）
// - 占位文字提示

// TODO: 集成 @mote/engine 进行实际渲染
```

### 2. SceneTreeEditor - 实体树

```typescript
// packages/editor/src/editors/SceneTreeEditor.tsx

// 功能：
// - 树形结构展示实体层级
// - 支持展开/折叠文件夹
// - 点击选中实体
// - 缩进表示层级深度

// 当前：使用 mock 数据
// TODO: 对接引擎实体系统
```

### 3. InspectorEditor - 属性检查器

```typescript
// packages/editor/src/editors/InspectorEditor.tsx

// 功能：
// - Transform: Position(vec2), Rotation, Scale(vec2)
// - Sprite: Sprite 名称, Visible, Color, Alpha
// - Physics: Body Type, Mass, Friction, Restitution
// - Scripts: 脚本列表 + Add Script 按钮

// 使用 CollapsibleSection 组织
// 当前：使用 mock 数据
// TODO: 对接引擎组件系统
```

### 4. AssetBrowserEditor - 资源浏览器

```typescript
// packages/editor/src/editors/AssetBrowserEditor.tsx

// 功能：
// - 资源列表展示（图标 + 名称）
// - 搜索过滤
// - 点击选中
// - 底部显示资源数量

// 支持类型：folder, image, audio, script, data
// 当前：使用 mock 数据
// TODO: 对接实际文件系统
```

---

## 样式主题

### CSS 变量系统

```css
/* packages/editor/src/index.css */

:root {
  /* Blender-inspired dark theme */
  --bg-base:     #1d1d2e;    /* 最深背景（窗口底色） */
  --bg-area:     #2d2d3d;    /* 区域背景 */
  --bg-header:   #252535;    /* 头栏背景 */
  --bg-input:    #383848;    /* 输入框背景 */
  --bg-hover:    #404055;    /* hover 高亮 */
  --bg-active:   #4a6fa5;    /* 选中/激活（蓝色） */

  --text-primary:   #e0e0e0;
  --text-secondary: #909090;
  --text-disabled:  #606060;

  --border:      #1a1a2a;
  --border-light: #3a3a4a;
  --border-hover: #5a5a6a;

  --accent:      #5b9bd5;    /* 主强调色 */
  --accent-warn: #e5a84b;    /* 警告色 */
  --accent-error:#e05555;    /* 错误色 */

  --font-size:   12px;
  --font-family: "Inter", "Segoe UI", system-ui, sans-serif;
  --row-height:  22px;       /* 紧凑行高 */
  --header-height: 26px;     /* 区域头栏高度 */
  --gap:         2px;        /* 区域间缝隙 */
}
```

### 关键样式规则

```css
/* 全局紧凑样式 */
* { box-sizing: border-box; margin: 0; padding: 0; }

/* 分割面板 */
.split-pane { display: flex; overflow: hidden; }
.split-pane__divider { background: var(--border); }
.split-pane__divider:hover { background: var(--accent); }

/* 区域面板 */
.area-panel { 
  display: flex; 
  flex-direction: column; 
  background: var(--bg-area);
  border: 1px solid var(--border);
}

/* 四角手柄 */
.corner-handle { 
  position: absolute; 
  width: 12px; 
  height: 12px;
  opacity: 0;  /* hover 时显示 */
}
.area-panel:hover .corner-handle { opacity: 0.6; }
```

---

## 界面布局

```
┌─────────────────────────────────────────────────────────────┐
│ 🎮 mote    File  Edit  View  Window  Help        [Reset] [▶ Play] │  ← GlobalMenuBar
├─────────────────────────────────────────────────────────────┤
│ ┌─[🌳 Scene Tree ▾]──┬─[🎮 Viewport ▾]──[Move][Rotate][Scale]─┬─[🔧 Inspector ▾]─┐
│ │                     │                                      │                  │
│ │  ▶ Root             │      ┌──────────────────────┐        │ ▼ Transform      │
│ │    ├─ Player        │      │                      │        │   X [100]       │
│ │    ├─ Ground        │      │   Canvas (网格背景)   │        │   Y [200]       │
│ │    ├─ Coin_1        │      │                      │        │ ▼ Sprite        │
│ │    └─ Coin_2        │      │   Viewport - Engine  │        │   atlas: ...    │
│ │                     │      │   integration WIP    │        │   frame: ...    │
│ │                     │      │                      │        │ ▼ Physics       │
│ │                     │      └──────────────────────┘        │   Mass [1.0]    │
│ │                     │                                      │                  │
│ │  ◢ 四角手柄          │              ◢ 四角手柄               │     ◢ 四角手柄    │
│ ├─────────────────────┴──────────────────────────────────────┤                  │
│ │ [📁 Assets ▾] [Search...                                   ]                  │
│ │  📁 tilesets        📁 sprites      📁 audio                 │                  │
│ │  🖼️ grass.png       🖼️ player.png   🔊 jump.wav              │                  │
│ └────────────────────────────────────────────────────────────┴──────────────────┘
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## 已实现功能

| 功能 | 状态 | 说明 |
|------|------|------|
| 区域树数据结构 | ✅ | `area-tree.ts` 完整实现 |
| 响应式状态管理 | ✅ | Preact Signals + localStorage 持久化 |
| 递归渲染 | ✅ | `AreaTreeRenderer` |
| 分割拖拽 | ✅ | `SplitPane` 支持水平/垂直分割 |
| 编辑器切换 | ✅ | `AreaHeader` 下拉菜单 |
| 四角手柄分割/合并 | ✅ | `CornerHandle` 组件 |
| Scene Tree UI | ✅ | 树形结构 + 展开/选中 |
| Inspector UI | ✅ | 折叠分组 + 属性字段 |
| Asset Browser UI | ✅ | 列表 + 搜索过滤 |
| Viewport 占位 | 🟡 | Canvas + 网格背景，待集成引擎 |
| 全局菜单栏 | ✅ | Reset Layout + Play 按钮 |
| 暗色主题 | ✅ | CSS 变量系统 |

---

## 待办事项

### 高优先级
1. **Viewport 引擎集成** - 将 `@mote/engine` 渲染到 Canvas
2. **实体系统对接** - Scene Tree 显示真实引擎实体
3. **组件系统对接** - Inspector 编辑真实组件属性
4. **资源系统对接** - Asset Browser 读取实际文件

### 中优先级
5. **菜单栏功能** - File/Edit/View 菜单实现
6. **快捷键系统** - 键盘快捷键支持
7. **撤销/重做** - 操作历史管理

### 低优先级
8. **多窗口支持** - Popout 面板（浏览器限制，可能放弃）
9. **自定义主题** - 浅色主题选项
10. **插件系统** - 扩展编辑器功能

---

## 技术栈

- **框架**: Preact 10.25 + Preact Signals 1.3
- **构建**: Vite 8 + @preact/preset-vite
- **语言**: TypeScript 6.0
- **依赖**: `@mote/engine`

---

## 文件清单

```
packages/editor/
├── package.json
├── vite.config.ts
├── tsconfig.json
└── src/
    ├── index.ts              # 公共 API 导出
    ├── main.tsx              # 入口点
    ├── app.tsx               # 主应用组件
    ├── index.css             # 全局样式
    ├── core/
    │   ├── area-tree.ts      # 区域树数据结构
    │   └── layout-state.ts   # 布局状态管理
    ├── components/
    │   ├── AreaTreeRenderer.tsx
    │   ├── AreaPanel.tsx
    │   ├── AreaHeader.tsx
    │   ├── SplitPane.tsx
    │   ├── CornerHandle.tsx
    │   ├── CollapsibleSection.tsx
    │   └── GlobalMenuBar.tsx
    └── editors/
        ├── index.ts
        ├── ViewportEditor.tsx
        ├── SceneTreeEditor.tsx
        ├── InspectorEditor.tsx
        └── AssetBrowserEditor.tsx
```
