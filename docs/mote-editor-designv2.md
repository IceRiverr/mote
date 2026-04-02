从你截图看到的 Blender 界面，它有几个非常独特的设计哲学是值得 mote 借鉴的。我来逐一分析哪些能用、哪些不适合。

---

## Blender 的核心界面设计特点

### 1. 区域（Area）自由分割

这是 Blender 最标志性的设计——整个窗口是一棵**区域树**，任何区域都可以：
- 拖拽边缘**分割**成两个新区域
- 拖拽合并**回收**相邻区域
- 每个区域左上角的下拉菜单可以切换成**任意编辑器类型**

截图里就能看到：右上角是 Outliner，右下角是 Properties，左边是 3D Viewport，这些都是可以自由换的。

**适合 mote 吗：非常适合，而且是最值得做的特性。**

```
传统编辑器布局（固定）：
┌──────┬────────────┬────────┐
│ 固定  │   固定      │  固定   │  ← 面板类型写死
└──────┴────────────┴────────┘

Blender 风格（自由分割）：
┌──────┬────────────┬────────┐
│ Any  │   Any      │  Any   │  ← 每个区域可切换任意面板
│Editor│  Editor    │ Editor │
├──────┴────────────┤        │
│      Any Editor   │        │  ← 随时拖拽分割/合并
└───────────────────┴────────┘
```

实现方案：

```typescript
// 区域树结构
type AreaNode =
  | { type: "leaf"; editorType: EditorType; id: string }
  | { type: "split"; direction: "horizontal" | "vertical";
      ratio: number;  // 0~1, 分割比例
      first: AreaNode; second: AreaNode };

type EditorType =
  | "viewport"      // 2D 场景视口
  | "scene-tree"    // 实体树
  | "inspector"     // 属性面板
  | "asset-browser" // 资源浏览器
  | "tilemap"       // Tilemap 编辑器
  | "console"       // 控制台
  | "code"          // 脚本预览
  | "animation";    // 动画时间线

// 渲染区域树
function renderAreaTree(node: AreaNode): JSX.Element {
  if (node.type === "leaf") {
    return (
      <AreaPanel id={node.id} editorType={node.editorType}
                 onChangeType={(t) => updateEditorType(node.id, t)} />
    );
  }
  const isHorizontal = node.direction === "horizontal";
  return (
    <SplitPane direction={node.direction} ratio={node.ratio}
               onRatioChange={(r) => updateRatio(node, r)}>
      {renderAreaTree(node.first)}
      {renderAreaTree(node.second)}
    </SplitPane>
  );
}
```

每个 `AreaPanel` 左上角有一个下拉菜单，可以把这个区域切换成任意编辑器：

```typescript
function AreaPanel({ id, editorType, onChangeType }: AreaPanelProps) {
  return (
    <div class="area-panel">
      <div class="area-header">
        <select value={editorType}
                onChange={(e) => onChangeType(e.currentTarget.value as EditorType)}>
          <option value="viewport">🎮 Viewport</option>
          <option value="scene-tree">🌳 Scene Tree</option>
          <option value="inspector">🔧 Inspector</option>
          <option value="asset-browser">📁 Assets</option>
          <option value="tilemap">🗺️ Tilemap</option>
          <option value="console">💬 Console</option>
        </select>
      </div>
      <div class="area-content">
        {renderEditor(editorType)}
      </div>
    </div>
  );
}
```

### 2. 每个区域角落拖拽分割/合并

Blender 的分割操作是在**区域角落**拖拽触发的——向区域内拖拽分割、向外拖拽合并。

```
拖拽角落向右 → 水平分割
┌─────────┐         ┌────┬────┐
│         │   →     │    │    │
│    A    │         │ A  │ A' │
│         │         │    │    │
└─────────┘         └────┴────┘

拖拽角落向下 → 垂直分割
┌─────────┐         ┌─────────┐
│         │   →     │    A    │
│    A    │         ├─────────┤
│         │         │    A'   │
└─────────┘         └─────────┘
```

实现要点：

```typescript
// 每个区域的四个角各放一个 8×8px 的拖拽热区
function AreaCornerHandle({ corner, onSplit, onMerge }: CornerProps) {
  const handleDrag = (e: PointerEvent) => {
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    if (absDx < 20 && absDy < 20) return; // 还没拖够距离

    if (absDx > absDy) {
      // 水平拖拽
      if (isInward(dx, corner)) onSplit("horizontal", 0.5);
      else onMerge("horizontal");
    } else {
      // 垂直拖拽
      if (isInward(dy, corner)) onSplit("vertical", 0.5);
      else onMerge("vertical");
    }
  };

  return <div class={`corner-handle corner-${corner}`}
              onPointerDown={startDrag} />;
}
```

### 3. Header Bar（区域头栏）

截图中每个编辑器区域顶部都有一个**窄头栏**——左侧是编辑器类型切换，右侧是该编辑器特有的工具按钮。这比 Tab 切换更紧凑。

```
┌─[🎮 Viewport ▾]──[View][Select][Add]──────────────────┐
│                                                         │
│                    渲染内容                               │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

```typescript
function AreaHeader({ editorType, children }: HeaderProps) {
  return (
    <div class="area-header" style={{ height: "26px", background: "#2d2d3d" }}>
      <EditorTypeSelector current={editorType} />
      <div class="header-tools">
        {children}  {/* 每种编辑器类型的专属工具栏 */}
      </div>
    </div>
  );
}

// Viewport 的头栏
function ViewportHeader() {
  return (
    <AreaHeader editorType="viewport">
      <ToolButton icon="move" tooltip="Translate (W)" />
      <ToolButton icon="scale" tooltip="Scale (E)" />
      <Separator />
      <ToolButton icon="grid" tooltip="Toggle Grid" />
      <ToolButton icon="snap" tooltip="Snap to Grid" />
    </AreaHeader>
  );
}
```

### 4. 暗色主题 + 紧凑间距

Blender 的 UI 密度非常高：
- 行高 ~20px
- 字号 11-12px
- 间距极小（2-4px padding）
- 统一暗色背景（`#303030` 区域、`#2d2d2d` 头栏、`#1d1d1d` 边框）

**mote CSS 主题参考**：

```css
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

  --accent:      #5b9bd5;    /* 主强调色 */
  --accent-warn: #e5a84b;    /* 警告色 */
  --accent-error:#e05555;    /* 错误色 */

  --font-size:   12px;
  --font-family: "Inter", "Segoe UI", system-ui, sans-serif;
  --row-height:  22px;       /* 紧凑行高 */
  --header-height: 26px;     /* 区域头栏高度 */
  --gap:         2px;        /* 区域间缝隙 */
}

/* 全局紧凑样式 */
* { box-sizing: border-box; margin: 0; padding: 0; }
body {
  font-family: var(--font-family);
  font-size: var(--font-size);
  color: var(--text-primary);
  background: var(--bg-base);
  overflow: hidden;  /* 编辑器全屏，不要页面滚动条 */
}

.area-panel {
  display: flex;
  flex-direction: column;
  background: var(--bg-area);
  border: 1px solid var(--border);
  overflow: hidden;
}

.area-header {
  height: var(--header-height);
  background: var(--bg-header);
  display: flex;
  align-items: center;
  padding: 0 4px;
  gap: 4px;
  border-bottom: 1px solid var(--border);
  user-select: none;
  flex-shrink: 0;
}

/* Blender 风格的紧凑按钮 */
.tool-button {
  height: 20px;
  padding: 0 6px;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: var(--text-secondary);
  cursor: pointer;
  font-size: 11px;
}
.tool-button:hover { background: var(--bg-hover); color: var(--text-primary); }
.tool-button.active { background: var(--bg-active); color: #fff; }

/* 紧凑输入框 */
input, select {
  height: var(--row-height);
  background: var(--bg-input);
  border: 1px solid var(--border-light);
  border-radius: 3px;
  color: var(--text-primary);
  font-size: var(--font-size);
  padding: 0 6px;
}
```

### 5. 属性面板的折叠分组

Blender 的 Properties 面板用**可折叠的分组头**来组织属性，每个组件/modifier 都是一个可折叠块：

```
▼ Transform               ← 点击折叠/展开
  Location   X [0.0] Y [0.0]
  Rotation   X [0.0] Y [0.0]
  Scale      X [1.0] Y [1.0]

▶ Sprite                  ← 已折叠
▼ Physics
  Mass       [1.0]
  Friction   [0.5]
```

```typescript
function CollapsibleSection({ title, defaultOpen = true, children }: SectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div class="collapsible-section">
      <div class="section-header" onClick={() => setOpen(!open)}>
        <span class={`arrow ${open ? "open" : ""}`}>▶</span>
        <span class="section-title">{title}</span>
      </div>
      {open && <div class="section-body">{children}</div>}
    </div>
  );
}

// Inspector 中渲染组件
function InspectorPanel() {
  const { selection, bridge } = useContext(EditorContext);
  const entityId = selection.selected.value[0];
  if (entityId == null) return <EmptyState text="No selection" />;

  const components = bridge.getComponents(entityId);
  return (
    <div class="inspector">
      {Object.entries(components).map(([type, data]) => (
        <CollapsibleSection key={type} title={type}>
          <ComponentFields entityId={entityId} type={type} data={data} />
        </CollapsibleSection>
      ))}
    </div>
  );
}
```

---

## 哪些 Blender 特性不适合 mote

| Blender 特性 | 不适合的原因 |
|-------------|-------------|
| **F 键切换编辑器类型** | Blender 有 15+ 种编辑器类型，mote 只有 6-7 种，下拉菜单就够 |
| **Pie Menu（饼状菜单）** | 需要精确的鼠标方向判断，Web 端实现复杂且触屏不友好 |
| **N/T 侧边栏** | 3D 场景需要大量属性面板，2D tilemap 编辑器面板数量有限，没必要 |
| **多窗口弹出** | 浏览器中无法真正创建独立窗口（`window.open` 体验差），放弃 |
| **节点编辑器** | Shader/Geometry Nodes 是 3D 特性，2D 引擎 MVP 不需要 |

---

## mote 最终推荐的 Blender 风格布局

综合以上分析，mote 编辑器应该采用：

```
┌─────────────────────────────────────────────────────────────┐
│ [🎮 mote] [File ▾] [Edit ▾] [View ▾]     [▶ Play] [⏹ Stop] │  ← 全局菜单栏
├─────────────────────────────────────────────────────────────┤
│ ┌─[🌳 Scene Tree ▾]──┬─[🎮 Viewport ▾]──────────┬─[🔧 Inspector ▾]─┐ │
│ │                     │                           │                  │ │
│ │  ▶ Root             │                           │ ▼ Position       │ │
│ │    ├─ Player        │      Canvas               │   X [100]       │ │
│ │    ├─ Ground        │      (引擎渲染)             │   Y [200]       │ │
│ │    ├─ Coin_1        │                           │ ▼ Sprite        │ │
│ │    └─ Coin_2        │                           │   atlas: ...    │ │
│ │                     │                           │   frame: ...    │ │
│ │ 可拖拽角落分割 ◢     │ 可拖拽角落分割 ◢           │ 可拖拽角落分割 ◢ │ │
│ ├─────────────────────┴───────────────────────────┤                  │ │
│ │ [📁 Assets ▾]                                    │                  │ │
│ │  tilesets/   sprites/   audio/                  │                  │ │
│ │  ├─ grass.png   ├─ player.atlas.json            │                  │ │
│ └─────────────────────────────────────────────────┴──────────────────┘ │
└─────────────────────────────────────────────────────────────────────────┘
```

核心特征：
1. **自由分割区域树** — 拖拽角落分割/合并
2. **每个区域可切换编辑器类型** — 左上角下拉菜单
3. **26px 紧凑头栏** — 类型选择 + 专属工具
4. **暗色主题** — Blender 色系
5. **折叠属性分组** — Inspector 面板

布局状态（区域树 JSON）存入 IndexedDB，下次打开编辑器时恢复用户自定义的布局。

这套设计既保留了 Blender 最精华的自由布局理念，又不过度复杂化——对于一个 2D tilemap 编辑器来说，这个复杂度刚好合适。