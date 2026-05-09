# Mote Editor（微尘）— 架构与现状分析文档

## 1. 项目概览

**Mote**（微尘）是一个面向 2D 游戏开发的浏览器端瓦片地图编辑器，使用 Preact + Vite + TypeScript 构建。设计理念借鉴了 Blender 的面积分割布局系统和 LDtk 的实体层概念，目标是提供一个轻量但专业的 Web 端 2D 关卡编辑工具。

| 指标 | 数值 |
|---|---|
| 技术栈 | Preact 10.19 + @preact/signals 1.2 + Vite 5 + TypeScript 5.3 |
| 源码文件数 | 51 个 (.ts/.tsx/.css) |
| 总代码行数 | ~7,300 行 |
| 构建产物 | 107 KB JS (34 KB gzip) + 1.9 KB CSS |
| 外部依赖 | 仅 preact + @preact/signals（零 UI 框架依赖） |
| 部署目标 | https://iceriver.cc |

---

## 2. 架构分层

```
┌─────────────────────────────────────────────────────────┐
│                    App (全局快捷键)                        │
├─────────────────────────────────────────────────────────┤
│  LayoutRoot  ──  AreaView (编辑器切换)  ──  SplitHandle   │  ← UI 壳层
├─────────────────────────────────────────────────────────┤
│  Viewport     │  TilePalette  │  SpritePanel │ Inspector │  ← 编辑器层
│  (画布渲染)    │  (瓦片选择)    │ (精灵选择)   │ (属性面板)  │
├─────────────────────────────────────────────────────────┤
│  Commands (paint / layer / entity / selection / map-props) │  ← 命令层
├─────────────────────────────────────────────────────────┤
│  Store (project / history / selection / atlas / layout)    │  ← 状态层
├─────────────────────────────────────────────────────────┤
│  Data (TileMap / TileSet / SpriteAtlas / io / export)      │  ← 数据层
└─────────────────────────────────────────────────────────┘
```

### 2.1 数据层 (src/data/)

纯数据结构与序列化逻辑，无 UI 依赖。

| 模块 | 行数 | 职责 |
|---|---|---|
| `TileMap.ts` | 215 | 核心数据模型：TileMap、TileLayer、EntityLayer、EntityDef、EntityInstance；联合类型 MapLayer + 类型守卫 |
| `TileSet.ts` | 72 | 瓦片集定义：切片参数、坐标计算、tileData 自定义属性 |
| `SpriteAtlas.ts` | 336 | 精灵图集：SpriteFrame、4 种创建工厂（Grid/PackedJSON/SparrowXML/Loose），shelf-packing 算法 |
| `atlas-import.ts` | 191 | 图集导入管道：4 种模式（网格/JSON/XML/散图）的完整导入流程 |
| `io.ts` | 458 | 序列化/反序列化：TileSetJson、TileMapStandalone、TileMapBundle 三种格式 + 导入/导出 |
| `export.ts` | 39 | 导出辅助函数 |

**数据模型设计亮点：**

- **判别联合类型（Discriminated Union）**：`MapLayer = TileLayer | EntityLayer`，通过 `type: "tile" | "entity"` 判别字段实现类型安全的多态访问
- **类型守卫模式**：`isTileLayer()` / `isEntityLayer()` 在全代码库 12+ 处使用，确保访问 `.data`（仅 TileLayer）或 `.entities`（仅 EntityLayer）时类型安全
- **模板—实例分离**：`EntityDef`（模板）→ `EntityInstance`（实例），类似 LDtk 的设计
- **可选精灵绑定**：`EntityDef.spriteAtlasId/spriteFrameId` 为可选字段，实体可选择性地绑定精灵，未绑定时回退到颜色形状 gizmo

### 2.2 状态层 (src/store/)

使用 `@preact/signals` 实现细粒度响应式状态管理，无 Redux/Zustand 等外部状态库。

| 模块 | 行数 | 职责 |
|---|---|---|
| `project.ts` | 257 | 项目核心状态：currentMap、tilesets、tilesetImages、activeLayer 系列计算属性、瓦片集 CRUD、地图导入 |
| `history.ts` | 87 | Undo/Redo 栈：Command 接口、executeCommand()、undo()、redo()，最大 100 步 |
| `selection.ts` | 76 | 工具状态：activeTool（6 种）、brushTiles、displayScale、viewportZoom、showGrid、entity 选择 |
| `atlas.ts` | 49 | 精灵图集状态：spriteAtlases、atlasImages、activeAtlasId/activeFrameId + computed |
| `layout.ts` | 39 | 布局树状态：默认 3 面板布局定义，layoutComputed 驱动渲染 |
| `tileSelection.ts` | 16 | 矩形选区状态 |

**状态管理设计评价：**

- **优势**：信号（signals）提供自动依赖追踪和精确更新，避免了 React Context 的瀑布式重渲染问题。`computed` 信号（如 `activeTileLayer`、`activeEntityLayer`）在消费端自动缓存和更新
- **待改进**：`project.ts`（257 行）承载了过多职责——状态定义、CRUD 操作、导入逻辑混杂在一个文件中，可考虑拆分为 `projectState.ts` + `projectActions.ts` + `projectImport.ts`

### 2.3 命令层 (src/commands/)

实现了完整的 Command 模式，所有可撤销操作均通过命令对象执行。

| 模块 | 行数 | 命令类 |
|---|---|---|
| `paint.ts` | 54 | PaintTilesCommand — 瓦片绘制（支持多格区域） |
| `entity.ts` | 186 | AddEntityCommand / RemoveEntityCommand / MoveEntityCommand / SetEntityPropertyCommand |
| `layer.ts` | 159 | AddLayerCommand / RemoveLayerCommand / ReorderLayerCommand / SetLayerPropertyCommand |
| `selection.ts` | 98 | CutSelectionCommand / CopySelectionCommand / PasteSelectionCommand |
| `map-props.ts` | 99 | RenameMapCommand / ResizeTileCommand / ResizeMapCommand |

**命令系统设计评价：**

- **优势**：命令粒度适中，每个命令都正确实现了 `execute()` / `undo()` 的对称逻辑。`PaintTilesCommand` 在 `execute` 时保存旧值用于 undo，是最小化内存开销的正确做法
- **亮点**：`ResizeMapCommand` 智能跳过 EntityLayer（实体不受地图网格大小影响），`SetEntityPropertyCommand` 使用泛型 `<K extends keyof EntityInstance>` 确保类型安全
- **待改进**：缺少批量命令（CompoundCommand / MacroCommand），无法将"拖拽移动多个实体"合并为一个 undo 步骤

### 2.4 布局系统 (src/layout/ + src/components/)

仿 Blender 的面积分割布局，是本项目的架构亮点之一。

```
LayoutNode (联合类型)
├── AreaNode { type: "area", id, editorType }
└── SplitNode { type: "split", id, direction, ratio, children: [LayoutNode, LayoutNode] }
```

| 模块 | 行数 | 职责 |
|---|---|---|
| `types.ts` | 32 | 类型定义：Rect、AreaNode、SplitNode、LayoutNode、SplitInfo |
| `rect.ts` | 49 | `computeRects()` — 递归计算每个 Area 的绝对像素位置 |
| `tree.ts` | 84 | 树操作：mapNode / splitArea / resizeSplit / setEditorType / collectAreas |
| `LayoutRoot.tsx` | 36 | 容器组件：ResizeObserver + 渲染 AreaView + SplitHandle |
| `AreaView.tsx` | 76 | 区域容器：编辑器类型下拉切换 + 动态渲染注册的编辑器组件 |
| `SplitHandle.tsx` | 51 | 分割线拖拽手柄 |

**与 Blender 的对比：**

| 特性 | Blender | Mote 当前状态 |
|---|---|---|
| 二叉分割树 | ✅ | ✅ |
| 拖拽调整比例 | ✅ | ✅ |
| 编辑器类型切换 | ✅ | ✅（下拉菜单） |
| 拖拽分割/合并区域 | ✅ 角落三角拖拽 | ❌ 未实现 |
| 面积最大化/恢复 | ✅ Ctrl+Space | ❌ 未实现 |
| 多窗口/浮动面板 | ✅ | ❌ 未实现 |
| 用户自定义布局预设 | ✅ | ❌ 硬编码默认布局 |

### 2.5 编辑器层 (src/editors/)

通过 `registerEditor()` 注册机制实现编辑器的解耦加载。

#### 2.5.1 注册系统

```typescript
// registry.ts — 核心仅 22 行
interface EditorDef { id: string; name: string; icon: string; component: ComponentType<{areaId: string}> }
registerEditor(def) → editors.set(def.id, def)
getEditor(id) → EditorDef | undefined
getAllEditors() → EditorDef[]
```

各编辑器通过 `register.ts` 侧效果文件注册，由 `App.tsx` 静态导入触发。这是一个简洁的插件式设计，添加新编辑器只需：

1. 创建编辑器组件 + 调用 `registerEditor()`
2. 在 `App.tsx` 添加一行 `import "./editors/xxx/register"`

#### 2.5.2 视口编辑器 (Viewport)

**代码量最大的模块**（ViewportCanvas: 1074 行），承担了核心编辑交互。

| 子模块 | 行数 | 功能 |
|---|---|---|
| `ViewportCanvas.tsx` | 1074 | Canvas 2D 渲染循环、瓦片绘制、实体渲染/放置/拖拽、相机平移缩放、工具交互 |
| `ViewportHeader.tsx` | 172 | 工具栏（7 种工具按钮 + 缩放控件） |
| `ViewportFooter.tsx` | 107 | 状态栏（坐标、图层、缩放、提示） |
| `ViewportEditor.tsx` | 31 | 壳组件（Header + Canvas + Footer） |

**渲染管线分析：**

```
draw() 渲染顺序
  1. 清屏
  2. 应用相机变换 (translate + scale)
  3. 遍历图层（从底到顶）
     a. TileLayer → 遍历 data[]，resolveGid → 绘制瓦片图像
     b. EntityLayer → 遍历 entities[]
        - 有 sprite 绑定 → 绘制精灵帧图像
        - 无 sprite → 绘制颜色 gizmo (point=圆+图标, rect=矩形)
  4. 网格线
  5. 选区高亮
  6. 悬停提示
  7. 拖拽中的实体预览
```

**待改进点：**

- **1074 行单文件**：`ViewportCanvas.tsx` 严重超长，混合了渲染逻辑、事件处理、工具分发、实体交互。建议拆分为：
  - `ViewportRenderer.ts` — 纯渲染管线
  - `ViewportTools.ts` — 工具状态机
  - `ViewportEntityInteraction.ts` — 实体拖拽/选择
  - `ViewportInput.ts` — 指针/键盘事件处理
- **全帧重绘**：每次信号变更都执行完整 `draw()`，无脏区域追踪。当前地图规模（30×20 tiles）下性能充裕，但对大地图（200×200+）可能成为瓶颈
- **无 WebGPU 路径**：当前使用 Canvas 2D API，考虑项目的 WebGPU 技术方向，后续应提供 WebGPU 渲染后端

#### 2.5.3 瓦片面板 (Tile Palette)

| 子模块 | 行数 | 功能 |
|---|---|---|
| `PaletteCanvas.tsx` | 352 | Canvas 渲染瓦片网格、点击/拖拽选择 brush、hover 高亮、相机平移 |
| `PaletteHeader.tsx` | 197 | 瓦片集下拉选择 + 缩放控件 + 导入按钮 |
| `TileSetPopover.tsx` | 403 | 瓦片集属性弹窗（切片参数编辑、重命名、删除） |
| `TileContextMenu.tsx` | 192 | 右键菜单（瓦片标签/碰撞属性编辑） |
| `RedoPanel.tsx` | 126 | 导入后参数快速调整面板 |

**设计亮点**：Canvas 渲染 + 自定义 scroll/pan/zoom，避免了 DOM 节点爆炸。选中瓦片后自动切换到 brush 工具，交互流畅。

#### 2.5.4 精灵面板 (Sprite Panel)

| 子模块 | 行数 | 功能 |
|---|---|---|
| `SpritePanelCanvas.tsx` | 404 | Canvas 帧网格、hover tooltip、缩放、搜索过滤 |
| `SpritePanelHeader.tsx` | 356 | 图集下拉 + 搜索框 + 导入弹窗（4 种模式） |
| `SpritePanelEditor.tsx` | 76 | 壳组件 + 选帧→实体工具联动 |

**与瓦片面板的对比：**

| 特性 | 瓦片面板 | 精灵面板 |
|---|---|---|
| 选择模型 | 矩形区域 brush | 单帧选择 |
| 导入方式 | Header 按钮，直接拖入图片 | Header 弹窗，4 种模式（Grid/JSON/XML/Loose） |
| Canvas 渲染 | 等距网格 | 自适应列数 + 缩略图 |
| 搜索过滤 | ❌ | ✅ 帧名/ID/Tag 模糊搜索 |
| Tooltip | ❌ | ✅ 帧名 + 尺寸 |

#### 2.5.5 属性面板 (Inspector)

| 子模块 | 行数 | 功能 |
|---|---|---|
| `MapPropsPanel.tsx` | 117 | 地图名称、尺寸、瓦片大小编辑 |
| `LayersPanel.tsx` | 445 | 图层列表 CRUD：可见性、锁定、重排、颜色、添加（Tile/Entity 类型选择） |
| `EntityPanel.tsx` | 212 | 实体类型选择器 + 选中实体属性检查器（位置、尺寸、自定义字段） |
| `ExportPanel.tsx` | 72 | 导出/导入入口 |
| `PanelShell.tsx` | 61 | 可折叠面板壳组件 |

`LayersPanel` 是属性面板中最复杂的组件（445 行），实现了完整的图层管理 UI，包括拖拽重排、类型图标区分、属性编辑等。

---

## 3. 与同类工具对比

### 3.1 功能矩阵

| 功能 | Tiled | LDtk | Mote 当前 | 评价 |
|---|---|---|---|---|
| 瓦片图层 | ✅ 完整 | ✅ 完整 | ✅ 基础完整 | 绘制/擦除/填充/吸色/选区 |
| 实体系统 | ✅ 自由属性 | ✅ 定义驱动 | ✅ 定义驱动 | LDtk 风格，3 个内置类型 |
| 精灵图集 | ✅ TSX | ❌ 外部 | ✅ 4 种格式 | JSON/XML/Grid/Loose |
| 自动瓦片 (AutoTile) | ✅ Wang/Terrain | ✅ 规则瓦片 | ❌ | **主要缺失功能** |
| 动画瓦片 | ✅ | ✅ | ❌ | 路线图 Phase 3 |
| 多地图/世界 | ✅ 世界文件 | ✅ 世界编辑器 | ❌ 单地图 | |
| Undo/Redo | ✅ | ✅ | ✅ 100 步 | Command 模式 |
| 导出格式 | TMX/JSON/Lua | JSON | JSON (3种) | 独立/Bundle/TileSet |
| 可扩展性 | ✅ 插件 | ❌ | ⚠️ 编辑器注册 | 有框架但无外部 API |
| 布局系统 | 固定面板 | 固定面板 | ✅ Blender 式分割 | **差异化优势** |

### 3.2 差异化分析

**Mote 的独特优势：**

1. **Blender 式布局系统** — 在 2D 地图编辑器领域独树一帜，Tiled/LDtk/Aseprite 均采用固定面板布局
2. **零依赖轻量级** — 仅 preact + signals，构建产物 34 KB gzip，可嵌入任何 Web 页面
3. **精灵图集多格式支持** — 同时支持 TexturePacker JSON、Sparrow XML、Grid、Loose，覆盖面超过 LDtk
4. **Web-native** — 浏览器端运行，无需安装，适合快速原型和教学场景

**主要差距：**

1. **AutoTile / Terrain** — Tiled 和 LDtk 的核心效率功能，Mote 完全缺失
2. **自定义 EntityDef** — 当前只有 3 个硬编码的内置实体类型，无法在 UI 中创建/编辑自定义类型
3. **大地图性能** — 无分层渲染/脏区域追踪/虚拟化，大地图可能卡顿
4. **导出兼容性** — 自定义 `.mote.json` 格式，无 Tiled TMX 兼容

---

## 4. 代码质量评估

### 4.1 优秀实践

| 实践 | 说明 |
|---|---|
| **TypeScript 严格模式** | `strict: true`，类型安全贯穿全代码 |
| **判别联合 + 类型守卫** | `MapLayer` 类型系统设计清晰，消除了 `as` 断言的需要 |
| **信号驱动架构** | 状态变更自动追踪，无手动订阅管理 |
| **Command 模式** | 可撤销操作的标准实现，execute/undo 对称 |
| **插件式编辑器注册** | 添加新面板类型极其简单 |
| **Canvas 渲染** | 避免了 DOM 性能陷阱，适合像素级精确控制 |
| **DPR 处理** | 所有 Canvas 均正确处理 `devicePixelRatio` |

### 4.2 技术债务

| 问题 | 严重度 | 文件 | 建议 |
|---|---|---|---|
| `ViewportCanvas.tsx` 1074 行 | 🔴 高 | viewport/ | 拆分为 Renderer + Tools + Input + EntityInteraction |
| `LayersPanel.tsx` 445 行 | 🟡 中 | inspector/ | 提取 LayerRow 和 LayerDrag 为独立组件 |
| `TileSetPopover.tsx` 403 行 | 🟡 中 | tile-palette/ | 提取各编辑区段为子组件 |
| `project.ts` 257 行混合职责 | 🟡 中 | store/ | 拆分 state / actions / import |
| `SpriteAtlasPanel.tsx` 未使用 | 🟢 低 | inspector/ | 已从 Inspector 移除引用，可删除文件 |
| 部分文件残留 `\uXXXX` | 🟢 低 | 多处 | 已在最新版修复 |

### 4.3 架构指标

| 指标 | 值 | 评价 |
|---|---|---|
| 最大文件行数 | 1074 (ViewportCanvas) | ⚠️ 超过 500 行建议阈值 |
| 平均文件行数 | ~143 | ✅ 合理 |
| 循环依赖 | 0 | ✅ 清洁的单向依赖图 |
| 外部运行时依赖 | 2 (preact + signals) | ✅ 极简 |
| 类型覆盖率 | ~100% (strict mode) | ✅ |
| 构建时间 | ~470ms | ✅ 极快 |

---

## 5. 与 Blender 界面理念的进一步对齐

Mote 已实现 Blender 布局系统的核心部分（二叉分割树 + 编辑器类型切换），但要深化"任何区域可承载任何编辑器"的理念，可考虑：

### 5.1 已实现

- ✅ 二叉分割树 (SplitNode/AreaNode)
- ✅ 拖拽调整分割比例 (SplitHandle)
- ✅ 区域编辑器类型下拉切换 (AreaView)
- ✅ 4 种编辑器类型注册 (viewport / tile-palette / sprite-panel / inspector)

### 5.2 建议补充

| 特性 | 优先级 | 实现复杂度 | 说明 |
|---|---|---|---|
| **角落三角拖拽分割/合并** | P1 | 中 | Blender 标志性交互，在 Area 角落拖拽创建新分割或合并相邻区域 |
| **Ctrl+Space 最大化/恢复** | P1 | 低 | 临时最大化某个 Area 为全屏，再按恢复，极其实用 |
| **布局预设保存/切换** | P2 | 低 | 存储多套 layoutTree 到 localStorage，快捷切换 |
| **Tab 键切换模式** | P2 | 低 | 如 Blender 的编辑模式/对象模式概念 |
| **Header bar 统一化** | P2 | 中 | 当前每个编辑器自行实现 Header，可提取公共 EditorHeader 组件 |
| **右键 Area 菜单** | P3 | 低 | 右键区域头部弹出：分割、关闭、复制、最大化等操作 |

---

## 6. 文件清单与模块依赖图

### 6.1 目录结构

```
src/
├── App.tsx                        # 应用入口，全局快捷键，编辑器注册导入
├── main.tsx                       # Preact render 入口
├── index.css                      # 全局暗色主题 CSS 变量
├── components/
│   ├── LayoutRoot.tsx             # 布局容器（ResizeObserver + Area/Split 渲染）
│   ├── AreaView.tsx               # 单个编辑区域（类型切换 + 编辑器渲染）
│   └── SplitHandle.tsx            # 分割线拖拽手柄
├── layout/
│   ├── types.ts                   # LayoutNode 类型定义
│   ├── rect.ts                    # 递归计算区域矩形位置
│   └── tree.ts                    # 树操作（分割/调整/查找）
├── data/
│   ├── TileMap.ts                 # 核心数据模型
│   ├── TileSet.ts                 # 瓦片集定义
│   ├── SpriteAtlas.ts             # 精灵图集 + XML/JSON 解析器
│   ├── atlas-import.ts            # 图集导入管道
│   ├── io.ts                      # 序列化/反序列化
│   └── export.ts                  # 导出辅助
├── store/
│   ├── project.ts                 # 项目状态 + CRUD
│   ├── history.ts                 # Undo/Redo 栈
│   ├── selection.ts               # 工具/选择状态
│   ├── atlas.ts                   # 图集状态
│   ├── layout.ts                  # 布局状态
│   └── tileSelection.ts           # 矩形选区
├── commands/
│   ├── paint.ts                   # 瓦片绘制命令
│   ├── entity.ts                  # 实体 CRUD 命令
│   ├── layer.ts                   # 图层管理命令
│   ├── selection.ts               # 剪切/复制/粘贴
│   └── map-props.ts               # 地图属性命令
├── editors/
│   ├── registry.ts                # 编辑器注册中心
│   ├── viewport/                  # 视口编辑器
│   │   ├── ViewportCanvas.tsx     # 主画布（1074 行）
│   │   ├── ViewportHeader.tsx     # 工具栏
│   │   ├── ViewportFooter.tsx     # 状态栏
│   │   ├── ViewportEditor.tsx     # 壳组件
│   │   └── register.ts
│   ├── tile-palette/              # 瓦片面板
│   │   ├── PaletteCanvas.tsx      # 瓦片网格画布
│   │   ├── PaletteHeader.tsx      # 选择器 + 导入
│   │   ├── TileSetPopover.tsx     # 属性弹窗
│   │   ├── TileContextMenu.tsx    # 右键菜单
│   │   ├── RedoPanel.tsx          # 导入调参面板
│   │   ├── TilePaletteEditor.tsx  # 壳组件
│   │   └── register.ts
│   ├── sprite-panel/              # 精灵面板
│   │   ├── SpritePanelCanvas.tsx  # 帧网格画布
│   │   ├── SpritePanelHeader.tsx  # 选择器 + 搜索 + 导入
│   │   ├── SpritePanelEditor.tsx  # 壳组件
│   │   └── register.ts
│   └── inspector/                 # 属性面板
│       ├── InspectorEditor.tsx    # 壳组件
│       ├── register.ts
│       └── panels/
│           ├── MapPropsPanel.tsx   # 地图属性
│           ├── LayersPanel.tsx     # 图层管理
│           ├── EntityPanel.tsx     # 实体检查器
│           ├── ExportPanel.tsx     # 导出/导入
│           ├── PanelShell.tsx      # 可折叠面板壳
│           └── SpriteAtlasPanel.tsx # (已弃用)
└── hooks/
    └── useDrag.ts                 # 拖拽 hook
```

### 6.2 模块依赖方向

```
App.tsx
  └→ editors/**/register.ts (侧效果导入)
  └→ store/history (undo/redo)
  └→ store/selection (工具快捷键)

LayoutRoot → store/layout → layout/rect → layout/types
           → AreaView → editors/registry → 各编辑器组件

各编辑器组件
  → store/* (读写状态)
  → commands/* (执行命令)
  → data/* (类型定义)

commands/* → store/project (读写地图数据)
           → data/TileMap (类型守卫)

store/* → data/* (类型定义)
```

依赖方向严格单向：`data ← store ← commands ← editors ← App`，无循环依赖。

---

## 7. 下一步建议

### 7.1 短期（Phase 3）

1. **动画定义系统** — `AnimationDef { frames: SpriteFrame[], fps, loop }` + 时间轴 UI
2. **自定义 EntityDef 编辑器** — 允许用户在 UI 中创建/编辑实体类型定义
3. **ViewportCanvas 拆分** — 将 1074 行拆为 4-5 个模块

### 7.2 中期

4. **AutoTile / Terrain 系统** — 基于规则的自动瓦片，是生产力最高的待实现功能
5. **WebGPU 渲染后端** — 对接项目的 WebGPU 技术方向，为大地图和特效渲染做准备
6. **布局增强** — 角落分割/合并、最大化、布局预设

### 7.3 长期

7. **多地图/世界编辑器** — 地图间导航，支持大世界关卡设计
8. **协作编辑** — 基于 CRDT 的多人实时编辑
9. **插件 API** — 暴露编辑器扩展接口，支持自定义工具和面板
