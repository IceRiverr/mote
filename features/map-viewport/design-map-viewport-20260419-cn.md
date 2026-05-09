# 设计：2D 地图视口重构

**日期：** 2026-04-19
**范围：** 编辑器视口渲染、相机控制、HUD 覆盖层、交互架构（编辑模式 + 工具）

---

## 问题

当前 2D 地图视口 (`ViewportCanvas.tsx`) 使用占位渲染（带字母的彩色方块）来绘制实体，缺乏场景边界内/外的视觉层级，网格裁剪错误（会画到场景边界外），且提供的视口导航辅助不足（无轴向指示器、无世界坐标读数、无小地图）。这使得编辑器感觉像个调试工具，而非专业的关卡编辑器。

此外，当前视口将实体操作工具（`select`、`move`）与笔刷类工具（`brush`、`eraser`、`eyedropper`）混在一个扁平的 `ToolType` 联合类型中。没有"编辑模式"的概念——用户必须自行记住哪些工具适用于实体、哪些适用于网格，而且工具栏始终显示所有按钮，不管当前上下文。这很混乱且无法扩展：
- **实体工作流**（放置预制体，然后移动它们）需要实体选择。
- **笔刷工作流**（在网格上绘制瓦片/实体）需要笔刷选择器、图案预览和基于网格的笔画命令。
- **未来的瓦片地图工作流** 将需要直接从精灵图帧中选取笔刷源，而非预制体，操作的是 `Tilemap` 组件而非单个实体。

---

## 约束

### 1. 生命周期
- **视口会话级**：相机位置、缩放、网格可见性、编辑模式均为编辑器会话状态，不序列化到场景文件。
- **每帧渲染**：实体位置和选择状态以交互频率更新（非固定游戏 tick），由 PointerEvents 和 Signal 变更驱动。

| 状态 | 生命周期 | 说明 |
|------|----------|------|
| `editMode` | 会话 | 不序列化到场景。打开时默认：`entity` |
| `entityTool` / `brushTool` | 会话 | 会话期间记住每个模式的最后使用工具 |
| `brushStamp` / `brushPattern` | 会话 | 当前笔刷内容；模式切换时重置可接受 |
| 实体选择 (`selectedEntityIds`) | 会话 | 模式切换时保留，但 Gizmo 只在实体模式下渲染 |
| 笔画命令 (`PaintBrushCommand`) | 每次交互 | 按下指针时创建，松开时提交 |

### 2. 归属

| 数据 | 归属 |
|------|------|
| 场景实体、网格设置 | `store/scene.ts` |
| 预制体定义、图集 → 图片映射 | `store/prefabs.ts`, `store/spriteSheet.ts` |
| 相机（平移、缩放） | 新建 `store/viewport.ts`（从 `ViewportCanvas.tsx` 中提取） |
| 实体选择 | `store/scene.ts` (`selectedEntityIds`) |
| 编辑模式及各模式下的活动工具 | 新建 `store/viewport-mode.ts` |
| 笔刷印章/图案内容 | `store/brush.ts`（扩展） |
| 笔刷图案、旧版工具状态 | `store/brush.ts`, `store/selection.ts` |
| 渲染循环 | `ViewportCanvas.tsx` 组件 |

### 3. 变更模式
- **读多写少**：99% 的帧是观察（渲染循环读取所有实体 + 预制体）。
- **写突发**：笔刷笔画或框选拖拽期间，单帧内大量实体发生变更。
- **跨模式污染风险**：必须确保笔刷模式的笔画不会意外移动实体，实体模式的拖拽不会绘制瓦片。
- **读取者**：Canvas 绘制循环。
- **写入者**：指针事件处理器 → 命令 → 场景 store。

### 4. 已有模式
1. **`SpriteEditorCanvas.tsx`**：Canvas 2D + `HTMLImageElement` 来自 `spriteSheetImages`。已验证的模式：绘制图集切片精灵、带平移/缩放相机、悬停/选择覆盖层、碰撞体调试渲染。
2. **`ViewportCanvas.tsx`（当前）**：Canvas 2D 手动网格/实体/选择渲染，但使用占位颜色而非真实图片。已有相机、框选、实体拖拽和笔刷工具基础设施。
3. **引擎 `RenderPlugin`**：WebGPU/WebGL2 `SpriteBatch` + `TextureAtlas.load()`。需要完整的 `World` 运行时和 `IGfxDevice` 上下文。
4. **精灵编辑器模式** (`sprite-editor/state.ts`)：`editorMode: 'select' | 'collider' | 'tag'`，按 `Tab` 循环。每种模式改变画布交互语义和状态栏帮助文本。已验证模式系统在本代码库中运行良好。
5. **当前扁平工具** (`store/selection.ts`)：`activeTool: 'select' | 'brush' | ...`，在 `ViewportCanvas.tsx` 中单一切换。这是我们要替换的模式，因为它混淆了两种不同的工作流。

### 5. 序列化
- **场景级序列化**：实体变换、预制体引用、图层分配。
- **编辑器级序列化（未来）**：相机位置、网格颜色、吸附设置、面板可见性。这些应放在单独的 `editor-settings.json` 中，而非场景文件。
- **编辑器会话状态**：模式、每个模式的最后工具、笔刷图案——以后可以保存到 `localStorage` 或 `.mote-editor.json`，但目前超出范围。
- **不序列化**：悬停状态、瞬态工具预览、帧率渲染状态。

---

## 关键决策

### 决策 1：视口渲染继续使用 Canvas 2D（暂不接入引擎 WebGPU）

**考虑的替代方案：**
- A. 将引擎 `RenderPlugin` + `SpriteBatch` 接入编辑器视口。
- B. 混合：HUD/网格用 Canvas 2D，实体精灵用 WebGPU。
- C. **仅 Canvas 2D**，从现有 `spriteSheetImages` store 加载 `HTMLImageElement`。

**理由：**
- 编辑器目前**没有引擎 `World` 实例**（`engineSync.ts` 是存根）。在编辑器内启动完整引擎运行时所需基础设施巨大：组件注册表同步、资源管理、生命周期管理、第二个画布后端。
- `SpriteEditorCanvas.tsx` 已证明 Canvas 2D 足以应对带平移/缩放的精灵编辑。
- 对于 2D 像素艺术瓦片地图编辑器，Canvas 2D `drawImage` 在布局和放置用途上，视觉效果与 WebGPU `SpriteBatch` 完全相同。

**接受的权衡：**
- 编辑器视口无法预览引擎特有的渲染功能（自定义着色器、后处理、混合模式）。这些只能在游戏运行时预览中查看。对于以空间排列为主要职责的关卡编辑器来说，这是可接受的。

---

### 决策 2：实体精灵通过 `spriteSheetImages` + `prefabs` stores 渲染

**考虑的替代方案：**
- A. 在每个预制体文件中嵌入 base64 缩略图（冗余，膨胀文件）。
- B. 在 `drawEntity` 中通过 `new Image()` 按需加载图片（无缓存，重复加载）。
- C. **复用现有的 `spriteSheetImages: Map<string, HTMLImageElement>` 缓存**，以 `Prefab.components.Sprite.atlas` 为键。

**理由：**
- 预制体的 `Sprite` 组件存储 `atlas: string`（图集 ID）和 `frame: string`（帧 ID）。这与引擎使用的模式相同。
- `store/spriteSheet.ts` 已维护 `spriteSheetImages`，在资源导入期间填充。
- `SpriteEditorCanvas.tsx` 已演示如何交叉引用 `SpriteSheet` + `HTMLImageElement`，通过 `ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)` 切片绘制一帧。

**接受的权衡：**
- 如果预制体引用的图集尚未导入到编辑器，实体将渲染为回退矩形。我们将添加懒加载或"缺失图片"指示器。

---

### 决策 3：将相机状态提取到 `store/viewport.ts`

**考虑的替代方案：**
- A. 将 `camera` signal 保留在 `ViewportCanvas.tsx` 内（当前）。页眉/页脚无法读取或修改它。
- B. 通过 `ViewportEditor` → `ViewportHeader`/`ViewportFooter` 的 prop drilling 传递相机。
- C. **新建 `store/viewport.ts` 模块**，包含相机、网格显示切换和视口适配工具的 signal。

**理由：**
- 页脚需要显示鼠标下的世界坐标。
- 页眉缩放控件需要读取/写入缩放。
- "框选适配"（F 键）和"框选全部"（Home 键）需要从键盘处理器修改相机。
- 精灵编辑器已使用类似模式（`sprite-editor/state.ts` 中的 `editorCam`）。

**接受的权衡：**
- 多一个 store 文件。影响可忽略。

---

### 决策 4：三层绘制顺序：背景 → 实体 → 编辑器覆盖层

**绘制顺序（从后到前）：**
1. **背景填充** (`#1a1a1a`) + **边界外变暗**（场景矩形外的暗色覆盖层）。
2. **网格**（裁剪到场景边界）。
3. **实体**（按图层然后按 Y 排序，实现俯视遮挡）。
4. **笔刷预览**（半透明的预制体幽灵或擦除高亮）。
5. **选择覆盖层**（选择框、变换 Gizmo、轴心标记）。
6. **轴向指示器**（世界原点指示器，左下角，屏幕空间）。
7. **HUD 文本**（光标坐标，可选）。

**理由：**
- 匹配 `SpriteEditorCanvas.tsx` 的层级（图片 → 碰撞体 → 悬停 → 选择）。
- 防止网格线遮挡精灵。
- 防止选择框被实体隐藏。

**接受的权衡：**
- 每帧多次 `ctx.save()` / `ctx.restore()` 调用。Canvas 2D 下影响可忽略。

---

### 决策 5：选择框按实际精灵帧尺寸计算，回退到网格大小

**考虑的替代方案：**
- A. 保持固定的 20×20 选择框（当前）。对任何非 20×20 的实体都错误。
- B. 使用通用的"容差"圆（当前 `findEntityAt` 使用 16px 半径）。适合点击测试，不适合选择视觉。
- C. **查找 `Prefab.components.Sprite` → 图集 → 帧矩形** 获取真实尺寸。图集/帧不可用时回退到 `scene.grid.size`。

**理由：**
- 准确的选择视觉对于精确编辑至关重要。
- 数据已在 `spriteSheets` store 中可用。
- 回退到网格大小确保所有资源加载前编辑器仍可工作。

**接受的权衡：**
- 当图集在实体可见后异步完成加载时，选择框尺寸可能略有跳动。对于编辑器 UX 来说可接受。

---

### 决策 6：两种顶层编辑模式 —— `entity` 和 `brush`

**考虑的替代方案：**
- A. 保持扁平工具列表，添加上下文敏感禁用（例如未选择实体时禁用 `rotate`）。已拒绝：仍混淆工作流；用户放置预制体时笔刷工具仍然出现。
- B. 三种模式：`entity`、`brush`、`tilemap`（现在包含瓦片地图）。已拒绝：瓦片地图组件尚不存在；过早抽象。
- C. **现在两种模式**，`brush` 模式设计为以后可通过相同模式添加第三种 `tilemap` 模式。

**理由：**
- 匹配用户心智模型："我要么在放置/调整对象，要么在绘制关卡。"
- 精灵编辑器已成功使用模式切换。
- 范围可控，同时留有清晰的扩展路径。

**接受的权衡：**
- 模式切换需要额外一次点击或 `Tab` 按键。通过将 `Tab` 设为快速切换、并记住每个模式的最后使用工具来缓解。

---

### 决策 7：每种模式的工具集独立存储

```typescript
type EntityTool = 'select' | 'move';
type BrushTool  = 'brush' | 'eraser' | 'eyedropper' | 'rect-select';
```

**考虑的替代方案：**
- A. 单个 `ToolType` 联合类型，带模式条件过滤（`if (mode === 'entity') tool = entityTool else ...`）。已拒绝：类型安全性较弱；可能出现无效状态。
- B. 命名空间字符串 ID（`'entity:select'`、`'brush:fill'`）。已拒绝：解析开销，switch 语句中不够直观。
- C. **独立的类型化 signal** —— `entityTool` 和 `brushTool` —— 活动工具由 `editMode` 决定。

**理由：**
- TypeScript 可以强制 `entityTool` 永远不会持有 `'brush'`。
- 页眉组件只需根据 `editMode` 切换渲染哪个工具数组。
- 指针事件分发器无需运行时字符串解析即可调用正确的处理器。

**接受的权衡：**
- 两个 signal 而非一个。影响可忽略。

---

### 决策 8：`BrushStamp` 抽象作为笔刷内容来源

```typescript
interface BrushStamp {
  type: 'prefab';
  ref: string; // prefabId 或 prefabPath
}

// 预留未来扩展：
// interface BrushStamp { type: 'sprite-frame'; atlasId: string; frameId: string; }
// interface BrushStamp { type: 'tile'; tilesetId: string; tileId: number; }
```

**考虑的替代方案：**
- A. 保持 `activePrefabPath: string | null` 作为唯一笔刷源。已拒绝：以后无法表示精灵帧或瓦片源而不产生破坏性变更。
- B. 完整的多态 `BrushTarget` 接口，抽象实体数组与瓦片地图组件。已拒绝：瓦片地图尚不存在；过度设计。
- C. **简单的 `BrushStamp` 联合类型，带 type 标签** —— 以后易于扩展，无需重写笔刷命令。

**理由：**
- `ref` 字符串可编码任何标识符（预制体 ID、图集:帧 组合等）。
- `type` 标签让渲染器选择如何绘制笔刷预览（预制体缩略图 vs 精灵帧 vs 瓦片图标）。
- `PaintBrushCommand` 可以接受 `BrushStamp` 并根据印章类型分派到正确的放置逻辑。

**接受的权衡：**
- 目前只实现 `type: 'prefab'`。直到精灵帧笔刷到来之前，该抽象仅轻度使用。

---

### 决策 9：`ViewportCanvas.tsx` 中模式特定的指针事件处理器

```typescript
// 在 ViewportCanvas.tsx 的 onPointerDown 中：
if (editMode.value === 'entity') {
  handleEntityPointerDown(e, entityTool.value);
} else {
  handleBrushPointerDown(e, brushTool.value);
}
```

**考虑的替代方案：**
- A. 保持单一庞大的处理器，嵌套 `switch(mode) → switch(tool)`。已拒绝：`ViewportCanvas.tsx` 已超过 400 行；添加模式会使其无法维护。
- B. 将处理器提取到单独文件（`viewport/handlers/entity.ts`、`viewport/handlers/brush.ts`）。已拒绝：它们需要访问许多本地 canvas ref 和绘制回调；太多管道。
- C. **`ViewportCanvas.tsx` 内联辅助函数** —— `handleEntityPointerDown`、`handleBrushPointerDown` 等。每个接收事件和当前工具，操作共享 signal。保持相关逻辑在一起，无需跨文件耦合。

**理由：**
- 辅助函数可以通过闭包捕获 `containerRef`、`canvasRef`、相机 signal 和 `draw()`。
- 模式特定逻辑清晰分离，同时保持在同一模块内。
- 如果处理器增长到超过 ~150 行，以后可以再提取而不破坏架构。

**接受的权衡：**
- `ViewportCanvas.tsx` 仍然较大（~300–400 行），但模式分发是顶层的单一 if/else。

---

### 决策 10：吸附系统 —— `snapSize` 与 `grid.size` 分离

**Grid** = 视觉参考（可以很大：32px、64px）。
**Snap** = 放置精度（可以很小：1px、2px、4px、8px）。

```typescript
// data/Scene.ts
interface GridSettings {
  enabled: boolean;
  size: number;        // 视觉网格大小（px）
  snap: boolean;       // 主吸附开关
  snapSize?: number;   // 吸附增量（px），默认 `size`
  color?: string;
}
```

**理由：**
- 精灵编辑器（Aseprite、Photoshop）和游戏引擎（Godot、Unity）普遍将网格显示与吸附增量分离。
- 像素艺术家经常在查看 32px 瓦片网格时使用 4px 或 8px 吸附。

**接受的权衡：**
- 场景格式中多一个数字。影响可忽略。旧场景若无 `snapSize` 不自动迁移；预发布阶段可接受破坏性变更。

---

## 数据结构

### 编辑器状态（新增/修改）

```typescript
// store/viewport.ts
interface ViewportCamera { x: number; y: number; zoom: number; }
interface ViewportSettings {
  showGrid: boolean;
  showAxisGizmo: boolean;
  dimOutOfBounds: boolean;
  gridColor: string;
  outOfBoundsColor: string;
  axisGizmoSize: number;
}

// store/viewport-mode.ts
interface ViewportModeState {
  editMode: 'entity' | 'brush';
  entityTool: 'select' | 'move';
  brushTool: 'brush' | 'eraser' | 'eyedropper' | 'rect-select';
}

// store/brush.ts（扩展）
interface BrushStamp {
  type: 'prefab';           // 预留: 'sprite-frame' | 'tile'
  ref: string;              // prefabId | "atlas:frameId" | "tileset:tileId"
}

interface BrushCell {
  offsetX: number;
  offsetY: number;
  stamp: BrushStamp;
}

interface BrushPattern {
  cells: BrushCell[];
}

// 颜色常量（CSS 自定义属性）
interface ViewportColors {
  selectionPrimary:   '#f4a742';  // 橙色
  selectionSecondary: '#c4802a';  // 深橙色
  axisX:              '#e06060';  // 红色
  axisY:              '#60c060';  // 绿色
  gridLine:           'rgba(255,255,255,0.04)';
  gridCenterAxis:     'rgba(255,255,255,0.25)';
  outOfBounds:        'rgba(0,0,0,0.50)';
}
```

### SceneEntity（未变更，渲染使用）

```typescript
// data/Scene.ts
interface SceneEntity {
  id: string;
  prefab: PrefabId;        // 引用 store/prefabs.ts
  transform: {
    x: number; y: number;
    rotation: number;
    scaleX: number; scaleY: number;
  };
  overrides?: Record<string, any>;
  name?: string;
}
```

---

## 文件结构

| 模块 | 文件 | 职责 |
|------|------|------|
| 视口状态 store | `packages/editor/src/store/viewport.ts` | 相机 signal、坐标转换工具、框选/居中辅助函数 |
| 编辑模式 & 工具状态 | `packages/editor/src/store/viewport-mode.ts` | `editMode`、`entityTool`、`brushTool`、快捷键、模式切换 |
| 笔刷印章/图案 | `packages/editor/src/store/brush.ts`（扩展） | `BrushStamp`、`brushStamp`、`brushPattern`、预制体/精灵帧辅助函数 |
| 精灵解析 | `packages/editor/src/utils/entitySprite.ts` | `resolveEntitySprite()`、`getEntityDisplaySize()` —— 桥接 `prefabs` + `spriteSheets` stores |
| 视口画布 | `packages/editor/src/editors/viewport/ViewportCanvas.tsx` | Canvas 组件；模式分发到处理器函数；渲染循环；Gizmo 渲染 |
| 视口页眉 | `packages/editor/src/editors/viewport/ViewportHeader.tsx` | 模式标签下拉 + 视图选项（👁 覆盖层、🧲 吸附、⊕ Gizmo 切换、🏠 框选、缩放） |
| 视口 T-Panel | `packages/editor/src/editors/viewport/ViewportTPanel.tsx` | 实体模式工具（`select`/`move`）垂直图标栏；笔刷模式下隐藏 |
| 视口页脚 | `packages/editor/src/editors/viewport/ViewportFooter.tsx` | 坐标读数、实体数量、撤销/重做、网格切换、模式 + 活动工具名称 |
| 实体处理器 | `ViewportCanvas.tsx` 内联 | `handleEntityPointerDown/Move/Up` —— 选择、移动 |
| 笔刷处理器 | `ViewportCanvas.tsx` 内联 | `handleBrushPointerDown/Move/Up` —— 笔刷、橡皮、吸管、框选 |
| 背景/网格/Gizmo 渲染器 | `ViewportCanvas.tsx` 内联（或若 >300 行则提取到 `viewport/renderers.ts`） | 纯绘制函数 |
| 笔刷调色板面板 | `packages/editor/src/editors/inspector/panels/BrushPalette.tsx`（扩展） | 预制体笔刷选择器；未来：精灵帧笔刷选择器 |

---

## API 提案

### `store/viewport.ts`

```typescript
import { signal } from '@preact/signals';

export interface ViewportCamera {
  x: number;    // 视口左边缘的世界 x（CSS 像素，缩放前）
  y: number;    // 视口顶边缘的世界 y（CSS 像素，缩放前）
  zoom: number; // 缩放因子（1 = 1:1）
}

export const viewportCamera = signal<ViewportCamera>({ x: 0, y: 0, zoom: 1 });
export const needsInitialCenter = signal(true);

/** 相机按 scenePath 隔离（E2）：用户切换场景时，保存前一个相机，恢复新场景的最后已知相机。关闭编辑器丢弃所有相机状态（仅会话级）。 */

/** 视口显示偏好（尚未序列化） */
export const viewportSettings = signal({
  showGrid: true,
  showAxisGizmo: true,
  dimOutOfBounds: true,
  gridColor: 'rgba(255, 255, 255, 0.08)',
  outOfBoundsColor: 'rgba(0, 0, 0, 0.50)',
  axisGizmoSize: 60,
});

/** 屏幕 → 世界坐标转换 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  rect: DOMRect,
  cam: ViewportCamera,
): { x: number; y: number };

/** 世界 → 屏幕坐标转换 */
export function worldToScreen(
  worldX: number,
  worldY: number,
  cam: ViewportCamera,
): { x: number; y: number };

/** 设置缩放，同时保持屏幕某点锚定在同一世界位置 */
export function setZoomAt(
  newZoom: number,
  screenX: number,
  screenY: number,
  rect: DOMRect,
): void;

/** 将相机居中到场景边界 */
export function centerCameraOnScene(): void;

/** 将相机框选到适配选择，若无选择则适配所有实体 */
export function frameCameraOnSelection(): void;
```

### `store/viewport-mode.ts`

```typescript
import { signal, computed } from '@preact/signals';

// ── 编辑模式 ─────────────────────────────────────────────────

export type EditMode = 'entity' | 'brush';

export const editMode = signal<EditMode>('entity');

export function setEditMode(mode: EditMode): void {
  abortCurrentInteraction();
  editMode.value = mode;
}

export function toggleEditMode(): void {
  setEditMode(editMode.value === 'entity' ? 'brush' : 'entity');
}

// ── 实体模式工具 ─────────────────────────────────────────────

export type EntityTool = 'select' | 'move';

export const entityTool = signal<EntityTool>('select');

export const ENTITY_TOOLS: Array<{
  id: EntityTool;
  label: string;
  icon: string;
  shortcut: string;
}> = [
  { id: 'select', label: '选择', icon: '↖', shortcut: 'V' },
  { id: 'move',   label: '移动', icon: '✋', shortcut: 'G' },
];

// ── 笔刷模式工具 ─────────────────────────────────────────────

export type BrushTool = 'brush' | 'eraser' | 'eyedropper' | 'rect-select';

export const brushTool = signal<BrushTool>('brush');

export const BRUSH_TOOLS: Array<{
  id: BrushTool;
  label: string;
  icon: string;
  shortcut: string;
}> = [
  { id: 'brush',       label: '笔刷', icon: '✏️', shortcut: 'B' },
  { id: 'eraser',      label: '橡皮', icon: '🧹', shortcut: 'E' },
  { id: 'eyedropper',  label: '吸管', icon: '💉', shortcut: 'I' },
  { id: 'rect-select', label: '框选', icon: '▭', shortcut: 'M' },
];

// ── 统一活动工具（用于显示 / 快捷键）──────────────────────────

export const activeToolId = computed(() =>
  editMode.value === 'entity' ? entityTool.value : brushTool.value
);

export const activeToolLabel = computed(() => {
  if (editMode.value === 'entity') {
    return ENTITY_TOOLS.find(t => t.id === entityTool.value)?.label ?? '';
  }
  return BRUSH_TOOLS.find(t => t.id === brushTool.value)?.label ?? '';
});

// ── 快捷键分发 ───────────────────────────────────────────────

export function handleViewportShortcut(key: string): boolean {
  const mode = editMode.value;

  if (key === 'Tab') {
    toggleEditMode();
    return true;
  }

  if (mode === 'entity') {
    const tool = ENTITY_TOOLS.find(t => t.shortcut.toLowerCase() === key.toLowerCase());
    if (tool) { entityTool.value = tool.id; return true; }
  }

  if (mode === 'brush') {
    const tool = BRUSH_TOOLS.find(t => t.shortcut.toLowerCase() === key.toLowerCase());
    if (tool) { brushTool.value = tool.id; return true; }
  }

  return false;
}
```

### `store/brush.ts`（扩展）

```typescript
/** 单个笔刷单元格放置的内容 */
export interface BrushStamp {
  type: 'prefab';
  ref: string; // prefabId 或 prefabPath
}

// 未来扩展（预留，未实现）：
// export interface SpriteFrameStamp { type: 'sprite-frame'; atlasId: string; frameId: string; }
// export interface TileStamp { type: 'tile'; tilesetId: string; tileId: number; }

/** 当前活动印章（单个单元格） */
export const brushStamp = signal<BrushStamp | null>(null);

/** 快捷方式：从预制体路径设置印章 */
export function setPrefabStamp(prefabPath: string): void {
  brushStamp.value = { type: 'prefab', ref: prefabPath };
  activePrefabPath.value = prefabPath;
}

/** 快捷方式：从预制体 ID 设置印章 */
export function setPrefabStampById(prefabId: string): void {
  const path = getPrefabPath(prefabId);
  if (path) setPrefabStamp(path);
  else setPrefabStamp(prefabId);
}
```

### `ViewportCanvas.tsx` —— 渲染辅助函数

```typescript
/** 绘制场景背景及边界外变暗 */
function drawBackground(
  ctx: CanvasRenderingContext2D,
  sceneW: number,
  sceneH: number,
  cam: ViewportCamera,
  viewW: number,
  viewH: number,
): void;

/** 绘制裁剪到场景边界的网格 */
function drawGrid(
  ctx: CanvasRenderingContext2D,
  sceneW: number,
  sceneH: number,
  gridSize: number,
  cam: ViewportCamera,
  viewW: number,
  viewH: number,
): void;

/** 绘制单个实体，若可用则使用真实精灵图片 */
function drawEntity(
  ctx: CanvasRenderingContext2D,
  entity: SceneEntity,
  isSelected: boolean,
  cam: ViewportCamera,
): void;

/** 在屏幕空间中绘制世界轴向指示器（左下角） */
function drawAxisGizmo(
  ctx: CanvasRenderingContext2D,
  cam: ViewportCamera,
  size: number,
): void;

/** 绘制笔刷悬停预览（预制体精灵幽灵或擦除高亮） */
function drawBrushPreview(
  ctx: CanvasRenderingContext2D,
  gridX: number,
  gridY: number,
  gridSize: number,
  cam: ViewportCamera,
): void;
```

### 精灵解析辅助函数

```typescript
/** 从实体预制体的 Sprite 组件解析显示尺寸 */
export function getEntityDisplaySize(
  entity: SceneEntity,
  fallbackSize: number,
): { w: number; h: number };

/** 解析实体的图集图片和帧矩形用于绘制 */
export function resolveEntitySprite(
  entity: SceneEntity,
): {
  image: HTMLImageElement | null;
  frame: { x: number; y: number; w: number; h: number } | null;
};

/** 加载策略（D3）：当前场景引用的所有图集在视口进入渲染循环前预加载。
 *  因此 `resolveEntitySprite` 是同步的；图片缺失表示预制体引用损坏，而非加载中。 */
```

---

## 实体模式工具行为（Blender 风格）

| 工具 | 快捷键 | 交互 | 说明 |
|------|--------|------|------|
| `select` | V | 点击选择；**在实体上拖拽 = 移动**；在空白处拖拽 = 框选；Ctrl+点击切换 | Blender 风格：选择工具不阻塞移动 |
| `move` | G | 拖拽时始终移动已选实体（无论悬停目标是什么） | 用户想要确保移动时的显式移动模式 |

- `select` 工具在实体上拖拽的行为完全匹配 Blender：用户无需切换到 `move` 即可快速调整。
- `rotate` 和 `scale` 推迟到未来里程碑；M1 只需要 select + move。

## 笔刷模式工具行为

| 工具 | 快捷键 | 交互 | 说明 |
|------|--------|------|------|
| `brush` | B | 点击/拖拽将笔刷印章绘制到网格上 | 使用 `brushPattern` + `BrushStamp` |
| `eraser` | E | 点击/拖拽在笔刷半径内擦除实体 | 与当前橡皮相同 |
| `eyedropper` | I | 点击拾取网格单元格处的实体/瓦片作为新笔刷 | 将 `brushStamp` 设置为拾取内容（L1：网格单元格粒度） |
| `rect-select` | M | 拖拽选择网格区域；然后剪切/复制/粘贴 | 用于批量网格操作的新工具 |

- `fill` 已移除（C2）：在基于预制体的工作流中频率低；如需要以后可重新引入。
- `rect-select` 是尚未实现的新功能。M1 可先存根（无操作或简单选择高亮）。

## 模式切换清除瞬态交互状态

切换模式时（`Tab` 或点击模式标签）：
- **清除**：`isPanning`、`isBoxSelecting`、`isMovingEntity`、`isPainting`、`currentBrushCmd`、`paintedCells`
- **保留**：`selectedEntityIds`、`camera`、`brushStamp`

理由：防止一个模式中未完成的拖拽泄漏到另一个模式。保留选择允许用户切换到笔刷模式绘制，再切回实体模式继续调整相同实体。

---

## 视觉设计（Blender 风格）

### 颜色方案

```css
--selection-primary:   #f4a742;  /* 橙色 —— 主选择 */
--selection-secondary: #c4802a;  /* 深橙色 —— 多选中的非活动项 */
--axis-x:              #e06060;  /* 红色 —— X 轴 */
--axis-y:              #60c060;  /* 绿色 —— Y 轴 */
--grid-line:           rgba(255,255,255,0.04);   /* 极淡 */
--grid-center-axis:    rgba(255,255,255,0.25);   /* 中心轴稍微可见 */
--out-of-bounds:       rgba(0,0,0,0.50);
```

### 网格样式
- 网格线极淡（正常缩放下几乎不可见）。
- **世界中心轴** 画得更粗：红色水平线（X）、绿色竖直线（Y）。
- 匹配 Blender "网格细微、轴线清晰" 的做法。

### 世界轴向指示器（左下角，屏幕空间）
- 位置：视口左下角。
- 大小：~48px。
- 颜色：红色 X 箭头，绿色 Y 箭头。
- 不可点击：纯世界方向指示器。相机对齐快捷键（如 Home）由键盘驱动。

### 移动 Gizmo（在已选实体上，世界空间）
- `move`：红色箭头（X）、绿色箭头（Y）。拖拽箭头 = 轴向约束移动。拖拽中心 = 自由移动。
- `rotate` / `scale` Gizmo 推迟到未来里程碑。

---

## UI 布局（Blender 风格三栏）

```
┌─┐ ┌────────────────────────────────────┐
│🖱│ │ [实体 ▼]          [👁] [🧲8px]    │  ← 页眉：模式 + 视图选项
│↕│ │                                    │
└─┘ │      [ Canvas 视口 ]               │
    │                                    │
    └────────────────────────────────────┘
T-Panel（仅实体模式；笔刷模式下隐藏）
```

### 实体模式详细视图

```
T-Panel（左侧，36px 宽）          画布
┌────┐  ┌────────────────────────────────────────┐
│ 🖱 │  │  [实体 ▼]  [👁] [🧲8px] [⊕]    ×1.0  │
│    │  │  select move                           │
│ ↕  │  │                                        │
│    │  │         Z ↑                            │
│    │  │    ═════╪═════  ← 世界轴向指示器      │
│    │  │         │   （不可点击）                │
│    │  │         ↓                              │
│    │  │                                        │
│    │  │      ┌─────────┐                       │
│    │  │      │  ┌───┐  │  ← 已选实体           │
│    │  │      │  │ 🌲│  │     （橙色轮廓）      │
│    │  │      │  └───┘  │                       │
│    │  │      │    ●    │  ← 轴心点             │
│    │  │      │ ↑     → │  ← 移动 Gizmo         │
│    │  │      └─────────┘     （红色 X / 绿色 Y）│
│    │  │                                        │
└────┘  └────────────────────────────────────────┘
```

### 笔刷模式详细视图

```
T-Panel 在笔刷模式下隐藏         画布
                                   ┌────────────────────────────────────────┐
                                   │  [笔刷 ▼]  [👁] [🧲8px] [⊕]    ×1.0  │
                                   │  ✏️  🧹  💉  ▭                        │
                                   │  brush erase pick rect                │
                                   │                                        │
                                   │   ┌────┐ ┌────┐                       │
                                   │   │ 🧱░│ │ 🧱░│  ← 笔刷幽灵           │
                                   │   └────┘ └────┘     （2×2 图案）      │
                                   │   ┌────┐ ┌────┐                       │
                                   │   │ 🧱░│ │ 🧱░│                       │
                                   │   └────┘ └────┘                       │
                                   │                                        │
                                   │      [ 淡网格 ]                        │
                                   │                                        │
                                   └────────────────────────────────────────┘
```

### 选择状态

```
未选中                  已选中（单个）                   已选中（多选，此为活动项）
┌────┐                  ┌═══════════┐                  ┌═══════════┐
│ 🌲 │                  │ ╔═══════╗ │                  │ ╔═══════╗ │
                        │ ║  🌲   ║ │                  │ ║  🌲   ║ │  ← 最亮橙色
                        │ ╚═══════╝ │                  │ ╚═══════╝ │
                        │     ●     │                  │     ●     │
                        │   ↑   →   │                  │   ↑   →   │
                        └───────────┘                  └───────────┘
                                                   ┌────┐
                                                   │ 🗿 │  ← 其他已选项（更深）
                                                   └────┘

选择颜色: #f4a742 (橙色)
活动选择: #ffbb5c (浅橙色) + 2px 轮廓
非活动选择: #c4802a (深橙色) + 1px 轮廓
```

### Gizmo 设计（Canvas 2D）

```
移动 Gizmo（在已选实体上）：
┌──────────────────┐
│        ↑ Y       │
│        │         │
│   ←────┼────→ X  │
│        │         │
│        ●         │
│     (pivot)      │
│                  │
└──────────────────┘
```

---

## 快捷键汇总

| 按键 | 上下文 | 动作 |
|------|--------|------|
| `Tab` | 全局（视口聚焦） | 切换实体 ↔ 笔刷模式 |
| `V` | 实体模式 | `select` 工具 |
| `G` | 实体模式 | `move` 工具 |
| `B` | 笔刷模式 | `brush` 工具 |
| `E` | 笔刷模式 | `eraser` 工具 |
| `I` | 笔刷模式 | `eyedropper` 工具 |
| `M` | 笔刷模式 | `rect-select` 工具 |
| `T` | 实体模式 | 切换 T-Panel 可见性（笔刷模式下无操作） |
| `N` | 全局 | 切换 Inspector（N-Panel）可见性 |
| `Ctrl+Shift+G` | 全局 | 切换吸附 开/关 |
| `Shift+G` | 全局 | 循环吸附尺寸 |
| `F` | 全局 | 框选相机适配场景 |
| `Home` | 全局 | 居中相机 |
| `Ctrl+Z` | 全局 | 撤销 |
| `Ctrl+Shift+Z` / `Ctrl+Y` | 全局 | 重做 |
| `Delete` / `Backspace` | 实体模式 | 删除已选实体 |
| `Ctrl`（按住） | 拖拽期间 | **临时禁用吸附**（微调模式） |
| `Shift`（按住） | 拖拽期间 | **临时启用吸附**（若当前关闭） |

---

## 吸附系统交互设计

### 页脚控件

```
[Grid:On▼] [Snap:8px▼] [Gizmo:On]
     │          │
     │          └─ 下拉：1px / 2px / 4px / 8px / 16px / 32px / 64px
     └─ 切换网格可见性
```

### 拖拽时的视觉反馈
- 吸附激活时：实体在吸附增量间"跳跃"；工具提示显示吸附后的坐标。
- 吸附临时禁用（按住 Ctrl）时：实体平滑移动；工具提示显示原始坐标并带 "(free)" 标签。

---

## 实现里程碑

### M1 —— 基础设施
- 创建 `store/viewport.ts`，从 `ViewportCanvas.tsx` 提取相机，更新页眉/页脚使用共享 store。
- 创建 `store/viewport-mode.ts`，包含 `editMode`、`entityTool`、`brushTool`、快捷键。
- 重构 `ViewportHeader.tsx`：添加模式标签 + 每种模式的工具按钮。
- 重构 `ViewportCanvas.tsx`：添加模式分发骨架；提取实体/笔刷处理器。
- 将现有扁平工具移入正确模式（`select`/`move`→实体，`brush`/`eraser`/`eyedropper`→笔刷）。`rotate`/`scale` 和 `fill` 按当前决策省略。
- `entity` 工具存根（无操作）；`move` 复用现有拖拽逻辑。
- 更新页脚显示模式 + 活动工具名称。
- T-Panel：仅在实体模式可见，笔刷模式下隐藏。

### M2 —— 真实精灵渲染
- 添加 `utils/entitySprite.ts`，用 `spriteSheetImages` 的 `drawImage` 替换占位 `drawEntity`。

### M3 —— 视觉打磨
- 修复网格裁剪，添加边界外变暗，添加轴向指示器，将选择框尺寸调整为匹配精灵帧。

### M4 —— HUD & 导航
- 增强页脚：世界坐标、缩放滑块、框选相机动作。

### M5 —— 笔刷源抽象
- 添加 `BrushStamp` 类型到 `store/brush.ts`；迁移 `activePrefabPath` → `brushStamp`。
- 更新 `PaintBrushCommand` / `EraseCommand` 接受 `BrushStamp`。
- 画布中的笔刷预览绘制实际预制体缩略图（非蓝色矩形）。

### M6 —— 性能
- 添加脏矩形或实体边界剔除，跳过屏幕外实体。

### M7 —— 精灵帧笔刷源（未来）
- 扩展 `BrushStamp` 增加 `type: 'sprite-frame'`。
- 在笔刷调色板面板添加精灵帧选择器。
- 更新笔刷放置逻辑，创建带有指向所选帧的 `Sprite` 覆盖的实体。

### M8 —— 瓦片地图模式（未来）
- 新 `EditMode: 'tilemap'`。
- 操作 `TilemapComponent` 数据的新瓦片地图专用命令。
- 复用笔刷模式 UI（工具按钮、笔刷选择器），但使用瓦片集源。

---

## 开放问题

1. **资源懒加载**：如果预制体引用尚未导入的图集，我们应自动触发加载尝试，还是只显示"缺失图片"占位？这影响 `resolveEntitySprite` 是否需要异步。
2. **编辑器设置持久化**：`viewportSettings`（网格颜色、Gizmo 可见性）应保存到 `localStorage` 还是项目级 `.mote-editor.json` 文件？
3. **引擎运行时预览**：我们是否需要一个单独的"播放"视口，使用引擎 WebGPU 渲染器（在弹窗或分割面板中）？如果是，那是后续设计，不在本范围内。
4. **坐标系**：✅ **已解决 —— Y 向下（选项 A）**。编辑器视口使用 Canvas 2D 原生坐标（Y 向下，原点左上角）。所有屏幕/世界变换、网格绘制和指针事件数学与 `AGENTS.md` 约定一致。
5. **Rotate/Scale 工具推迟？**：✅ **已解决**。`rotate`/`scale` 工具和 Gizmo 超出当前里程碑范围；核心模式系统稳定后再考虑。
6. **`rect-select` 初始范围？**：✅ **已解决**。M1：仅高亮；复制/粘贴命令推迟到核心笔刷系统稳定后的未来里程碑。
7. **`select` 拖拽行为**：✅ **已解决**。`select` 工具在实体上拖拽会移动它；`move` 工具始终移动。
8. **模式特定光标样式？**：✅ **已解决**。每种工具的 CSS cursor。
9. **T-Panel 可见性切换？**：✅ **已解决**。实体模式下 `T` 键切换 T-Panel；笔刷模式下 T-Panel 隐藏。
