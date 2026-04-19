# Design: 2D Map Viewport Redesign

**Date:** 2026-04-19
**Scope:** Editor Viewport rendering, camera controls, HUD overlays, and interaction architecture (edit modes + tools)

---

## 1. Problem Statement

The current 2D map viewport (`ViewportCanvas.tsx`) uses placeholder rendering (colored squares with letters) for entities, lacks visual hierarchy between in-bounds and out-of-bounds areas, has broken grid clipping that draws outside the scene boundary, and provides insufficient viewport navigation aids (no axis gizmo, no world coordinate readout, no minimap). This makes the editor feel like a debug tool rather than a professional level editor.

Additionally, the current viewport mixes entity-manipulation tools (`select`, `move`) with brush-based tools (`brush`, `eraser`, `eyedropper`) in a single flat `ToolType` union. There is no concept of an "edit mode" — the user must mentally track which tools work with entities vs. which work with the grid, and the tool bar shows all buttons regardless of context. This is confusing and does not scale:
- **Entity workflow** (placing prefabs, then moving them) needs entity selection.
- **Brush workflow** (painting tiles/entities onto a grid) needs a brush picker, pattern preview, and grid-based stroke commands.
- **Future Tilemap workflow** will need brush sources drawn directly from sprite-sheet frames, not prefabs, operating on a `Tilemap` component rather than individual entities.

---

## 2. Constraints Gathered

### 2.1 Lifecycle
- **Viewport session-scoped**: Camera position, zoom, grid visibility, and edit mode are editor session state. They do not serialize into the Scene file.
- **Per-frame rendering**: Entity positions and selections update at interaction frequency (not a fixed game tick), driven by PointerEvents and signal changes.

| State | Lifetime | Notes |
|-------|----------|-------|
| `editMode` | Session | Not serialized into scene. Default on open: `entity`. |
| `entityTool` / `brushTool` | Session | Last-used tool per mode remembered during session. |
| `brushStamp` / `brushPattern` | Session | Current brush content; reset on mode switch is acceptable. |
| Entity selection (`selectedEntityIds`) | Session | Preserved on mode switch, but gizmos only render in Entity Mode. |
| Stroke commands (`PaintBrushCommand`) | Per-interaction | Created on pointer-down, committed on pointer-up. |

### 2.2 Ownership
| Data | Owner |
|------|-------|
| Scene entities, grid settings | `store/scene.ts` |
| Prefab definitions, atlas → image mapping | `store/prefabs.ts`, `store/spriteSheet.ts` |
| Camera (pan, zoom) | New `store/viewport.ts` (extracted from `ViewportCanvas.tsx`) |
| Entity selection | `store/scene.ts` (`selectedEntityIds`) |
| Edit mode & active tool per mode | New `store/viewport-mode.ts` |
| Brush stamp/pattern content | `store/brush.ts` (extended) |
| Brush pattern, legacy tool state | `store/brush.ts`, `store/selection.ts` |
| Render loop | `ViewportCanvas.tsx` component |

### 2.3 Mutation Pattern
- **Read-heavy**: 99% of frames are observation (render loop reads all entities + prefabs).
- **Write bursts**: During brush strokes or drag-selection, many entities mutate in a single frame.
- **Cross-mode contamination risk**: Must ensure a Brush Mode stroke cannot accidentally move an entity, and Entity Mode drag cannot paint tiles.
- **Readers**: Canvas draw loop.
- **Writers**: Pointer event handlers → Commands → scene store.

### 2.4 Cross-Boundary
- **Editor ↔ Engine**: The editor does **not** currently run an Engine `World` (`engineSync.ts` explicitly notes this). The viewport is pure editor-side rendering.
- **Shared format**: Prefab `Sprite` component uses the same `atlas` + `frame` convention as the engine's `TextureAtlas`, but the editor loads `HTMLImageElement` via `store/spriteSheet.ts` instead of engine `IGfxDevice` textures.
- All data stays within editor boundary. No engine `World` involvement.
- Brush commands operate on `SceneEntity[]` today; future Tilemap commands will operate on component data. The mode system must not hard-code the target data structure.

### 2.5 Serialization
- **Scene-serialized**: Entity transforms, prefab references, layer assignments.
- **Editor-serialized (future)**: Camera position, grid color, snap settings, panel visibility. These belong in a separate `editor-settings.json`, not the scene file.
- **Editor session state**: Mode, last tool per mode, brush pattern — could be saved to `localStorage` or `.mote-editor.json` later, but out of scope now.
- **Not serialized**: Hover state, transient tool previews, frame-rate render state.

### 2.6 Existing Patterns
1. **SpriteEditorCanvas.tsx**: Canvas 2D + `HTMLImageElement` from `spriteSheetImages`. Proven pattern for drawing atlas-sliced sprites with pan/zoom camera, hover/selection overlays, and collider debug rendering.
2. **ViewportCanvas.tsx (current)**: Canvas 2D with manual grid/entity/selection rendering, but uses placeholder colors instead of real images. Has camera, box-select, entity drag, and brush tool infrastructure.
3. **Engine RenderPlugin**: WebGPU/WebGL2 `SpriteBatch` with `TextureAtlas.load()`. Requires a full `World` runtime and `IGfxDevice` context.
4. **Sprite Editor modes** (`sprite-editor/state.ts`): `editorMode: 'select' | 'collider' | 'tag'` with `Tab` cycling. Each mode changes the canvas interaction semantics and the status-bar help text. This proves mode-based UX works well in the codebase.
5. **Current flat tools** (`store/selection.ts`): `activeTool: 'select' | 'brush' | ...` with a single `switch(tool)` in `ViewportCanvas.tsx`. This is the pattern we are replacing because it conflates two different workflows.

---

## 3. Architecture Decisions

### Decision 1: Keep Canvas 2D for viewport rendering (do not plug into Engine WebGPU yet)

**Alternatives considered:**
- A. Integrate Engine `RenderPlugin` + `SpriteBatch` into the editor viewport.
- B. Hybrid: Canvas 2D for HUD/grid, WebGPU for entity sprites.
- C. **Canvas 2D only**, loading `HTMLImageElement` from existing `spriteSheetImages` store.

**Rationale:**
- The editor currently has **no Engine `World` instance** (`engineSync.ts` is stubbed). Bringing up a full engine runtime inside the editor requires major infrastructure: component registry sync, resource management, lifecycle management, and a second canvas backend.
- `SpriteEditorCanvas.tsx` already proves Canvas 2D is sufficient for sprite editing with pan/zoom.
- For a 2D pixel-art tilemap editor, Canvas 2D `drawImage` produces visually identical results to WebGPU `SpriteBatch` for the purposes of layout and placement.

**Tradeoff accepted:**
- Editor viewport cannot preview engine-specific rendering features (custom shaders, post-processing, blend modes). These will only be visible in the game runtime preview. This is acceptable for a level editor whose primary job is spatial arrangement.

---

### Decision 2: Entity sprites rendered via `spriteSheetImages` + `prefabs` stores

**Alternatives considered:**
- A. Embed base64 thumbnails inside each Prefab file (redundant, bloats files).
- B. Load images on-demand inside `drawEntity` via `new Image()` (no caching, repeated loads).
- C. **Reuse existing `spriteSheetImages: Map<string, HTMLImageElement>` cache**, keyed by `Prefab.components.Sprite.atlas`.

**Rationale:**
- Prefab's `Sprite` component stores `atlas: string` (atlas ID) and `frame: string` (frame ID). This is the same schema the engine uses.
- `store/spriteSheet.ts` already maintains `spriteSheetImages`, populated during asset import.
- `SpriteEditorCanvas.tsx` already demonstrates cross-referencing a `SpriteSheet` + `HTMLImageElement` to slice a frame via `ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)`.

**Tradeoff accepted:**
- If a Prefab references an atlas that hasn't been imported into the editor yet, the entity will render as a fallback rectangle. We will add a lazy-load or "missing image" indicator.

---

### Decision 3: Extract camera state into `store/viewport.ts`

**Alternatives considered:**
- A. Keep `camera` signal inside `ViewportCanvas.tsx` (current). Header/Footer cannot read or mutate it.
- B. Pass camera via prop drilling through `ViewportEditor` → `ViewportHeader`/`ViewportFooter`.
- C. **New `store/viewport.ts` module** with signals for camera, grid display toggles, and viewport-fit utilities.

**Rationale:**
- Footer needs to display world coordinates under the mouse.
- Header zoom control needs to read/write zoom.
- "Frame selection" (F key) and "Frame all" (Home key) need to mutate camera from keyboard handlers.
- Sprite editor already uses a similar pattern (`editorCam` in `sprite-editor/state.ts`).

**Tradeoff accepted:**
- One more store file. This is negligible.

---

### Decision 4: Three-layer draw order: Background → Entities → Editor Overlays

**Draw order (back to front):**
1. **Background fill** (`#1a1a1a`) + **out-of-bounds dimming** (dark overlay outside scene rect).
2. **Grid** (clipped to scene bounds).
3. **Entities** (sorted by layer then Y for top-down occlusion).
4. **Brush preview** (semi-transparent prefab ghost or erase highlight).
5. **Selection overlays** (selection boxes, transform gizmos, pivot markers).
6. **Axis gizmo** (world origin indicator, bottom-left corner, screen-space).
7. **HUD text** (cursor coordinates, optional).

**Rationale:**
- Matches `SpriteEditorCanvas.tsx` layering (image → collider → hover → selection).
- Prevents grid lines from obscuring sprites.
- Prevents selection boxes from being hidden behind entities.

**Tradeoff accepted:**
- Multiple `ctx.save()` / `ctx.restore()` calls per frame. Negligible for Canvas 2D.

---

### Decision 5: Selection box sized from actual sprite frame, falling back to grid size

**Alternatives considered:**
- A. Keep fixed 20×20 selection box (current). Broken for any entity not exactly 20×20.
- B. Use a generic "tolerance" circle (current `findEntityAt` uses 16px radius). Good for hit-testing, bad for selection visuals.
- C. **Lookup `Prefab.components.Sprite` → atlas → frame rect** to get real dimensions. Fall back to `scene.grid.size` if atlas/frame unavailable.

**Rationale:**
- Accurate selection visuals are essential for precise editing.
- The data is already available in `spriteSheets` store.
- Fallback to grid size ensures the editor still works before all assets are loaded.

**Tradeoff accepted:**
- Selection box size may pop slightly when an atlas finishes async loading after the entity is already visible. Acceptable for editor UX.

---

## 4. Edit Modes & Tool Architecture

### 4.1 Two top-level edit modes — `entity` and `brush`

**Alternatives considered:**
- A. Keep flat tool list, add context-sensitive disabling (e.g. disable `rotate` when no entity selected). Rejected: still mixes workflows; brush tools appear when user is placing prefabs.
- B. Three modes: `entity`, `brush`, `tilemap` (including tilemap now). Rejected: tilemap component does not exist yet; premature abstraction.
- C. **Two modes now**, with `brush` mode designed so a third `tilemap` mode can be added later by following the same pattern.

**Rationale:**
- Matches the user's mental model: "I am either placing/adjusting objects, or I am painting the level."
- Sprite Editor already uses mode switching successfully.
- Keeps the scope bounded while leaving a clear extension path.

**Tradeoff accepted:**
- Mode switch requires an extra click or `Tab` press. Mitigated by making `Tab` a fast toggle and persisting last-used tool per mode.

---

### 4.2 Per-mode tool sets stored independently

```typescript
type EntityTool = 'select' | 'move';
type BrushTool  = 'brush' | 'eraser' | 'eyedropper' | 'rect-select';
```

**Alternatives considered:**
- A. Single `ToolType` union with mode-conditional filtering (`if (mode === 'entity') tool = entityTool else ...`). Rejected: type safety is weaker; invalid states possible.
- B. Namespaced string IDs (`'entity:select'`, `'brush:fill'`). Rejected: parsing overhead, less ergonomic in switch statements.
- C. **Separate typed signals** — `entityTool` and `brushTool` — active one determined by `editMode`.

**Rationale:**
- TypeScript can enforce that `entityTool` never holds `'brush'`.
- Header component simply switches which tool array it renders based on `editMode`.
- Pointer event dispatcher calls the correct handler without runtime string parsing.

**Tradeoff accepted:**
- Two signals instead of one. Negligible.

---

### 4.3 `BrushStamp` abstraction for brush content source

```typescript
interface BrushStamp {
  type: 'prefab';
  ref: string; // prefabId or prefabPath
}

// Reserved for future extension:
// interface BrushStamp { type: 'sprite-frame'; atlasId: string; frameId: string; }
// interface BrushStamp { type: 'tile'; tilesetId: string; tileId: number; }
```

**Alternatives considered:**
- A. Keep `activePrefabPath: string | null` as the only brush source. Rejected: cannot represent sprite-frame or tile sources later without breaking changes.
- B. Full polymorphic `BrushTarget` interface that abstracts over entity arrays vs tilemap components. Rejected: tilemap does not exist yet; over-engineering.
- C. **Simple `BrushStamp` union with type tag** — easy to extend later without rewriting brush commands.

**Rationale:**
- The `ref` string can encode any identifier (prefab ID, atlas:frame combo, etc.).
- `type` tag lets the renderer choose how to draw the brush preview (prefab thumbnail vs sprite frame vs tile icon).
- `PaintBrushCommand` can accept `BrushStamp` and dispatch to the correct placement logic based on stamp type.

**Tradeoff accepted:**
- For now, only `type: 'prefab'` is implemented. The abstraction is lightly used until sprite-frame brush arrives.

---

### 4.4 Mode-specific pointer event handlers in `ViewportCanvas.tsx`

```typescript
// In ViewportCanvas.tsx onPointerDown:
if (editMode.value === 'entity') {
  handleEntityPointerDown(e, entityTool.value);
} else {
  handleBrushPointerDown(e, brushTool.value);
}
```

**Alternatives considered:**
- A. Keep single monolithic handler with nested `switch(mode) → switch(tool)`. Rejected: `ViewportCanvas.tsx` is already >400 LOC; adding modes makes it unmaintainable.
- B. Extract handlers into separate files (`viewport/handlers/entity.ts`, `viewport/handlers/brush.ts`). Rejected: they need access to many local canvas refs and draw callbacks; too much plumbing.
- C. **Inline helper functions inside `ViewportCanvas.tsx`** — `handleEntityPointerDown`, `handleBrushPointerDown`, etc. Each receives the event and current tool, operates on shared signals. Keeps related logic together without cross-file coupling.

**Rationale:**
- Helper functions can capture `containerRef`, `canvasRef`, camera signals, and `draw()` via closure.
- Mode-specific logic is cleanly separated while staying in the same module.
- If a handler grows beyond ~150 LOC, it can be extracted later without breaking the architecture.

**Tradeoff accepted:**
- `ViewportCanvas.tsx` will still be large (~300–400 LOC), but the mode dispatch is a single if/else at the top level.

---

### 4.5 Entity Mode tools — `select`, `move`

**Tool behaviors (Blender-inspired):**

| Tool | Shortcut | Interaction | Notes |
|------|----------|-------------|-------|
| `select` | V | Click to select; **drag on entity = move**; drag on empty = box-select; Ctrl+click toggle | Blender-style: select tool does not block move. |
| `move` | G | Always move selected entities on drag (regardless of hover target) | Explicit move mode when user wants guaranteed move. |

**Rationale:**
- `select` tool drag-on-entity behavior matches Blender exactly: users don't need to switch to `move` for quick adjustments.
- `rotate` and `scale` are deferred to a future milestone; only select + move are required for M1.

**Tradeoff accepted:**
- `select` and `move` overlap (both can drag entities). Resolution: `select` drags only when cursor starts on a selected entity; `move` always moves. This matches Blender and reduces tool switching.

---

### 4.6 UI Layout — T-Panel for Entity tools (Blender-style)

**Alternatives considered:**
- A. All tools in top Header (current design). Rejected: Entity tools are transform operations best accessed via a persistent vertical toolbar like Blender's T-Panel.
- B. Floating toolbar. Rejected: docked panel is more predictable and doesn't obscure canvas.
- C. **Left-side T-Panel for Entity tools**, top Header for mode switch + view options.

**Rationale:**
- Blender's left T-Panel is the industry-standard location for transform tools.
- Entity Mode has 2 tools (`select`, `move`) that fit naturally in a vertical stack with icons.
- Brush Mode tools (`brush`, `eraser`, `eyedropper`, `rect-select`) remain in the top Header because they are more context-menu-like; **T-Panel is hidden in Brush Mode** (M1).

**Layout:**
```
┌─┐ ┌────────────────────────────────────┐
│🖱│ │ [实体 ▼]          [👁] [🧲8px]    │  ← Header: mode + view opts
│↕│ │                                    │
└─┘ │      [ Canvas viewport ]          │
    │                                    │
    └────────────────────────────────────┘
T-Panel  (Entity Mode only; hidden in Brush Mode)
```

---

### 4.7 Visual Design — Colors, Grid, Gizmo (Blender-inspired)

**Color scheme update:**
```css
--selection-primary:   #f4a742;  /* orange — main selection */
--selection-secondary: #c4802a;  /* dark orange — inactive in multi-select */
--axis-x:              #e06060;  /* red — X axis */
--axis-y:              #60c060;  /* green — Y axis */
--grid-line:           rgba(255,255,255,0.04);   /* very faint */
--grid-center-axis:    rgba(255,255,255,0.25);   /* center axes slightly visible */
--out-of-bounds:       rgba(0,0,0,0.50);
```

**Grid style:**
- Grid lines are very faint (almost invisible at normal zoom).
- **World center axes** are drawn thicker: red horizontal line (X), green vertical line (Y).
- This matches Blender's "grid is subtle, axes are clear" approach.

**World Axis Gizmo (bottom-left, screen-space):**
- Position: bottom-left corner of viewport.
- Size: ~48px.
- Colors: red X arrow, green Y arrow.
- Non-clickable: purely a world orientation indicator (B3). Camera alignment shortcuts (e.g. Home) are keyboard-driven.

**Move Gizmo (on selected entities, world-space):**
- `move`: Red arrow (X), Green arrow (Y). Drag arrow = axis-constrained move. Drag center = free move.
- `rotate` / `scale` gizmos are deferred to a future milestone.

---

### 4.8 Brush Mode tools — `brush`, `eraser`, `eyedropper`, `rect-select`

**Tool behaviors:**

| Tool | Shortcut | Interaction | Notes |
|------|----------|-------------|-------|
| `brush` | B | Click/drag to paint brush stamp onto grid | Uses `brushPattern` + `BrushStamp`. |
| `eraser` | E | Click/drag to erase entities in brush radius | Same as current eraser. |
| `eyedropper` | I | Click to pick entity/tile at grid cell as new brush | Sets `brushStamp` to picked content (L1: grid-cell granularity). |
| `rect-select` | M | Drag to select grid region; then cut/copy/paste | New tool for bulk grid operations. |

**Rationale:**
- `brush`, `eraser`, `eyedropper` are already implemented; just re-categorized under Brush Mode.
- `fill` is removed (C2): low-frequency operation in a prefab-based workflow; can be reintroduced later if needed.
- `rect-select` is added because bulk operations on grid regions are common in brush workflows (e.g. copy a 5×5 section of map).

**Tradeoff accepted:**
- `rect-select` is a new feature not yet implemented. It can be stubbed (no-op or simple selection highlight) in the first milestone.

---

### 4.9 Mode switch clears transient interaction state

When switching modes (`Tab` or clicking mode tab):
- Clear: `isPanning`, `isBoxSelecting`, `isMovingEntity`, `isPainting`, `currentBrushCmd`, `paintedCells`.
- Preserve: `selectedEntityIds`, `camera`, `brushStamp`.

**Rationale:**
- Prevents half-finished drags from one mode leaking into the other.
- Preserving selection allows user to switch to Brush Mode, paint, switch back to Entity Mode, and continue adjusting the same entities.
- Preserving brush stamp avoids forcing re-selection after every mode switch.

**Tradeoff accepted:**
- An accidental `Tab` press mid-drag aborts the operation. Mitigated by only reacting to `Tab` on key-up or when no mouse buttons are pressed.

---

## 5. Proposed API

### 5.1 `store/viewport.ts`

```typescript
import { signal } from '@preact/signals';

export interface ViewportCamera {
  x: number;    // world x at left edge of viewport (CSS pixels, pre-zoom)
  y: number;    // world y at top edge of viewport (CSS pixels, pre-zoom)
  zoom: number; // scale factor (1 = 1:1)
}

export const viewportCamera = signal<ViewportCamera>({ x: 0, y: 0, zoom: 1 });
export const needsInitialCenter = signal(true);

> **Per-scene camera (E2):** Camera state is keyed by `scenePath`. When the user switches scenes, the previous camera is saved and the new scene's last-known camera is restored. Closing the editor discards all camera state (session-only).

/** Viewport display preferences (not serialized yet) */
export const viewportSettings = signal({
  showGrid: true,
  showAxisGizmo: true,
  dimOutOfBounds: true,
  gridColor: 'rgba(255, 255, 255, 0.08)',
  outOfBoundsColor: 'rgba(0, 0, 0, 0.50)',
  axisGizmoSize: 60,
});

/** Convert screen → world coordinates */
export function screenToWorld(
  screenX: number,
  screenY: number,
  rect: DOMRect,
  cam: ViewportCamera,
): { x: number; y: number };

/** Convert world → screen coordinates */
export function worldToScreen(
  worldX: number,
  worldY: number,
  cam: ViewportCamera,
): { x: number; y: number };

/** Set zoom while keeping a screen point anchored to the same world position */
export function setZoomAt(
  newZoom: number,
  screenX: number,
  screenY: number,
  rect: DOMRect,
): void;

/** Center camera on scene bounds */
export function centerCameraOnScene(): void;

/** Frame camera to fit selection, or all entities if none selected */
export function frameCameraOnSelection(): void;
```

### 5.2 `store/viewport-mode.ts`

```typescript
import { signal, computed } from '@preact/signals';

// ── Edit Mode ─────────────────────────────────────────────────

export type EditMode = 'entity' | 'brush';

export const editMode = signal<EditMode>('entity');

export function setEditMode(mode: EditMode): void {
  abortCurrentInteraction();
  editMode.value = mode;
}

export function toggleEditMode(): void {
  setEditMode(editMode.value === 'entity' ? 'brush' : 'entity');
}

// ── Entity Mode Tools ─────────────────────────────────────────

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

// ── Brush Mode Tools ──────────────────────────────────────────

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

// ── Unified Active Tool (for display / shortcuts) ─────────────

export const activeToolId = computed(() =>
  editMode.value === 'entity' ? entityTool.value : brushTool.value
);

export const activeToolLabel = computed(() => {
  if (editMode.value === 'entity') {
    return ENTITY_TOOLS.find(t => t.id === entityTool.value)?.label ?? '';
  }
  return BRUSH_TOOLS.find(t => t.id === brushTool.value)?.label ?? '';
});

// ── Shortcut Dispatch ─────────────────────────────────────────

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

### 5.3 `store/brush.ts` (Extended)

```typescript
/** What a single brush cell places */
export interface BrushStamp {
  type: 'prefab';
  ref: string; // prefabId or prefabPath
}

// Future extensions (reserved, not implemented):
// export interface SpriteFrameStamp { type: 'sprite-frame'; atlasId: string; frameId: string; }
// export interface TileStamp { type: 'tile'; tilesetId: string; tileId: number; }

/** Current active stamp (single cell) */
export const brushStamp = signal<BrushStamp | null>(null);

/** Convenience: set stamp from prefab path */
export function setPrefabStamp(prefabPath: string): void {
  brushStamp.value = { type: 'prefab', ref: prefabPath };
  activePrefabPath.value = prefabPath;
}

/** Convenience: set stamp from prefab ID */
export function setPrefabStampById(prefabId: string): void {
  const path = getPrefabPath(prefabId);
  if (path) setPrefabStamp(path);
  else setPrefabStamp(prefabId);
}
```

### 5.4 `ViewportCanvas.tsx` — Render Helpers

```typescript
/** Draw the scene background with out-of-bounds dimming */
function drawBackground(
  ctx: CanvasRenderingContext2D,
  sceneW: number,
  sceneH: number,
  cam: ViewportCamera,
  viewW: number,
  viewH: number,
): void;

/** Draw grid clipped to scene bounds */
function drawGrid(
  ctx: CanvasRenderingContext2D,
  sceneW: number,
  sceneH: number,
  gridSize: number,
  cam: ViewportCamera,
  viewW: number,
  viewH: number,
): void;

/** Draw a single entity with real sprite image if available */
function drawEntity(
  ctx: CanvasRenderingContext2D,
  entity: SceneEntity,
  isSelected: boolean,
  cam: ViewportCamera,
): void;

/** Draw world-axis gizmo in screen-space (bottom-left) */
function drawAxisGizmo(
  ctx: CanvasRenderingContext2D,
  cam: ViewportCamera,
  size: number,
): void;

/** Draw brush hover preview (ghost of prefab sprite or eraser highlight) */
function drawBrushPreview(
  ctx: CanvasRenderingContext2D,
  gridX: number,
  gridY: number,
  gridSize: number,
  cam: ViewportCamera,
): void;
```

### 5.5 `ViewportCanvas.tsx` — Mode Dispatch Skeleton

```typescript
export function ViewportCanvas() {
  // ... refs, camera, setup ...

  const onPointerDown = (e: PointerEvent) => {
    if (spawnMenuOpen.value) { closeSpawnMenu(); return; }

    const container = containerRef.current;
    if (!container) return;

    // Global: middle-click pan (any mode)
    if (e.button === 1) {
      startPan(e);
      return;
    }

    if (e.button !== 0) return;

    // Mode dispatch
    if (editMode.value === 'entity') {
      handleEntityPointerDown(e, entityTool.value);
    } else {
      handleBrushPointerDown(e, brushTool.value);
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    if (isPanning.value) { updatePan(e); return; }

    if (editMode.value === 'entity') {
      handleEntityPointerMove(e, entityTool.value);
    } else {
      handleBrushPointerMove(e, brushTool.value);
    }
  };

  const onPointerUp = (e: PointerEvent) => {
    if (isPanning.value) { endPan(); return; }

    if (editMode.value === 'entity') {
      handleEntityPointerUp(e, entityTool.value);
    } else {
      handleBrushPointerUp(e, brushTool.value);
    }
  };

  // ── Entity Mode Handlers ────────────────────────────────────

  function handleEntityPointerDown(e: PointerEvent, tool: EntityTool) {
    const worldPos = getWorldPos(e);

    switch (tool) {
      case 'select': {
        const clicked = findEntityAt(worldPos.x, worldPos.y);
        if (clicked) {
          if (!e.ctrlKey) selectEntity(clicked.id);
          else toggleEntitySelection(clicked.id);
          isMovingEntity.value = true;
          moveStart.value = worldPos;
          captureEntityStartPositions();
        } else {
          if (!e.ctrlKey) clearSelection();
          startBoxSelect(worldPos);
        }
        break;
      }
      case 'move': {
        if (selectedEntityIds.value.size === 0) {
          const clicked = findEntityAt(worldPos.x, worldPos.y);
          if (clicked) selectEntity(clicked.id);
        }
        if (selectedEntityIds.value.size > 0) {
          isMovingEntity.value = true;
          moveStart.value = worldPos;
          captureEntityStartPositions();
        }
        break;
      }
    }
  }

  function handleEntityPointerMove(e: PointerEvent, tool: EntityTool) {
    const worldPos = getWorldPos(e);

    switch (tool) {
      case 'select':
        if (isBoxSelecting.value) updateBoxSelect(worldPos);
        else if (isMovingEntity.value) updateEntityMove(worldPos);
        break;
      case 'move':
        if (isMovingEntity.value) updateEntityMove(worldPos);
        break;
    }
    draw();
  }

  function handleEntityPointerUp(e: PointerEvent, tool: EntityTool) {
    if (isBoxSelecting.value) commitBoxSelect();
    else if (isMovingEntity.value) commitEntityMove();
  }

  // ── Brush Mode Handlers ─────────────────────────────────────

  function handleBrushPointerDown(e: PointerEvent, tool: BrushTool) {
    const gridPos = getGridPos(e);

    switch (tool) {
      case 'brush': startBrushStroke(gridPos); break;
      case 'eraser': startEraseStroke(gridPos); break;
      case 'eyedropper': executeEyedropper(gridPos); break;
      case 'rect-select': startGridRectSelect(gridPos); break;
    }
  }

  function handleBrushPointerMove(e: PointerEvent, tool: BrushTool) {
    const gridPos = getGridPos(e);
    hoverGridPos.value = gridPos;

    switch (tool) {
      case 'brush': if (isPainting.value) continueBrushStroke(gridPos); break;
      case 'eraser': if (isPainting.value) continueEraseStroke(gridPos); break;
      case 'rect-select': if (isGridRectSelecting.value) updateGridRectSelect(gridPos); break;
    }
    draw();
  }

  function handleBrushPointerUp(e: PointerEvent, tool: BrushTool) {
    switch (tool) {
      case 'brush':
      case 'eraser': commitBrushStroke(); break;
      case 'rect-select': commitGridRectSelect(); break;
    }
  }

  // ... render JSX ...
}
```

### 5.6 Sprite Resolution Helper

```typescript
/** Resolve an entity's display size from its Prefab's Sprite component */
export function getEntityDisplaySize(
  entity: SceneEntity,
  fallbackSize: number,
): { w: number; h: number };

/** Resolve an entity's atlas image and frame rect for drawing */
export function resolveEntitySprite(
  entity: SceneEntity,
): {
  image: HTMLImageElement | null;
  frame: { x: number; y: number; w: number; h: number } | null;
};

> **Loading strategy (D3):** All atlases referenced by the current scene are pre-loaded before the viewport enters the render loop. `resolveEntitySprite` is therefore synchronous; a missing image indicates a broken prefab reference rather than a pending load.
```

---

## 6. Data Structures

No new ECS Components or engine data structures are required. All changes are editor-side.

### Editor State (new / modified)

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

// store/brush.ts (extended)
interface BrushStamp {
  type: 'prefab';           // reserved: 'sprite-frame' | 'tile'
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

// Color constants (CSS custom properties)
interface ViewportColors {
  selectionPrimary:   '#f4a742';  // orange
  selectionSecondary: '#c4802a';  // dark orange
  axisX:              '#e06060';  // red
  axisY:              '#60c060';  // green
  gridLine:           'rgba(255,255,255,0.04)';
  gridCenterAxis:     'rgba(255,255,255,0.25)';
  outOfBounds:        'rgba(0,0,0,0.50)';
}
```

### SceneEntity (unchanged, used by render)

```typescript
// data/Scene.ts
interface SceneEntity {
  id: string;
  prefab: PrefabId;        // references store/prefabs.ts
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

## 7. Module Placement

| Module | File | Responsibility |
|--------|------|----------------|
| Viewport state store | `packages/editor/src/store/viewport.ts` | Camera signals, coordinate conversion utilities, frame/center helpers |
| Edit mode & tool state | `packages/editor/src/store/viewport-mode.ts` | `editMode`, `entityTool`, `brushTool`, shortcuts, mode toggle |
| Brush stamp/pattern | `packages/editor/src/store/brush.ts` (extend) | `BrushStamp`, `brushStamp`, `brushPattern`, prefab/sprite-frame helpers |
| Sprite resolution | `packages/editor/src/utils/entitySprite.ts` | `resolveEntitySprite()`, `getEntityDisplaySize()` — bridges `prefabs` + `spriteSheets` stores |
| Viewport canvas | `packages/editor/src/editors/viewport/ViewportCanvas.tsx` | Canvas component; mode dispatch to handler functions; render loop; gizmo rendering |
| Viewport header | `packages/editor/src/editors/viewport/ViewportHeader.tsx` | Mode tab dropdown + view options (👁 overlays, 🧲 snap, ⊕ gizmo toggle, 🏠 frame, zoom) |
| Viewport T-Panel | `packages/editor/src/editors/viewport/ViewportTPanel.tsx` | Entity Mode tools (`select`/`move`) vertical icon bar; hidden in Brush Mode |
| Viewport footer | `packages/editor/src/editors/viewport/ViewportFooter.tsx` | Coordinate readout, entity counts, undo/redo, grid toggle, mode + active tool name |
| Entity handlers | Inline in `ViewportCanvas.tsx` | `handleEntityPointerDown/Move/Up` — select, move |
| Brush handlers | Inline in `ViewportCanvas.tsx` | `handleBrushPointerDown/Move/Up` — brush, eraser, eyedropper, rect-select |
| Background / grid / gizmo renderers | Inline in `ViewportCanvas.tsx` (or extracted to `viewport/renderers.ts` if >300 LOC) | Pure draw functions |
| Brush palette panel | `packages/editor/src/editors/inspector/panels/BrushPalette.tsx` (extend) | Prefab brush picker; future: sprite-frame brush picker |

---

## 8. Open Questions

1. **Asset lazy-loading**: If a Prefab references an atlas not yet imported, should we auto-trigger a load attempt, or just show a "missing image" placeholder? This affects whether `resolveEntitySprite` needs to be async.
2. **Editor settings persistence**: Should `viewportSettings` (grid color, gizmo visibility) be saved to `localStorage` or a project-level `.mote-editor.json` file?
3. **Engine runtime preview**: Do we want a separate "Play" viewport that *does* use the Engine WebGPU renderer (in a popup or split panel)? If so, that is a follow-up design, not in this scope.
4. **Coordinate system**: ✅ **RESOLVED — Y-down (Option A)**. Editor viewport uses Canvas 2D native coordinates (Y-down, origin top-left). All screen/world transforms, grid drawing, and pointer-event math align with `AGENTS.md` convention.
5. **Rotate/Scale tools deferred?**: ✅ **RESOLVED**. `rotate`/`scale` tools and gizmos are out of scope for current milestones; will be revisited after core mode system is stable.
6. **`rect-select` initial scope?**: ✅ **RESOLVED**. M1: highlight only; copy/paste commands deferred to a future milestone after core brush system is stable.
7. **`select` drag behavior**: ✅ **RESOLVED**. `select` tool drag on entity moves it; `move` tool always moves.
8. **Mode-specific cursor styles?**: ✅ **RESOLVED**. CSS cursor per tool.
9. **T-Panel visibility toggle?**: ✅ **RESOLVED**. `T` key toggles T-Panel in Entity Mode; T-Panel is hidden in Brush Mode.

---

## 9. Snap System Design (Pixel-Game Friendly)

### 9.1 Problem

Current `snapToGrid` uses `grid.size` (default 32px) as the snap increment. For pixel-art games this is far too coarse:
- A 16×16 tile game wants 4px snap for fine placement within tiles.
- A 32×32 character wants 8px snap for sub-tile positioning.
- UI layout may want 1px free movement while keeping a 32px visual grid.

### 9.2 Decision: Separate `snapSize` from `grid.size`

**Grid** = visual reference (can be large: 32px, 64px).  
**Snap** = placement precision (can be small: 1px, 2px, 4px, 8px).

```typescript
// data/Scene.ts
interface GridSettings {
  enabled: boolean;
  size: number;        // visual grid size (px)
  snap: boolean;       // master snap toggle
  snapSize?: number;   // snap increment (px), defaults to `size`
  color?: string;
}

// Default presets for pixel games
export const SNAP_PRESETS = [1, 2, 4, 8, 16, 32, 64];
```

**Rationale:** Sprite editors (Aseprite, Photoshop) and game engines (Godot, Unity) universally separate grid display from snap increment. Pixel artists routinely work with 4px or 8px snap while viewing a 32px tile grid.

**Default:** `snapSize` defaults to `8` for new scenes (friendly to pixel-art sub-tile positioning).

**Tradeoff:** One additional number in the scene format. Negligible. Old scenes without `snapSize` are not auto-migrated; this is a breaking change acceptable for pre-release.

### 9.3 Updated `snapToGrid`

```typescript
export function snapToGrid(
  worldX: number,
  worldY: number,
  snapSize: number,
): { x: number; y: number } {
  if (snapSize <= 0) return { x: worldX, y: worldY };
  return {
    x: Math.round(worldX / snapSize) * snapSize,
    y: Math.round(worldY / snapSize) * snapSize,
  };
}
```

### 9.4 Snap Resolution at Call Sites

```typescript
// store/scene.ts — spawnPrefab / moveEntity
const snapSize = scene.grid.snap
  ? (scene.grid.snapSize ?? scene.grid.size)
  : 1; // 1px when snap is off

const snapped = snapToGrid(x, y, snapSize);
```

### 9.5 UI / Interaction Design

**Footer controls:**

```
[Grid:On▼] [Snap:8px▼] [Gizmo:On]
     │          │
     │          └─ Dropdown: 1px / 2px / 4px / 8px / 16px / 32px / 64px
     └─ Toggle grid visibility
```

**Shortcuts:**

| Shortcut | Behavior |
|----------|----------|
| `Ctrl+Shift+G` | Toggle snap on/off |
| `Shift+G` | Cycle snap size: 4→8→16→32→4... |
| Drag + `Ctrl` | **Temporarily disable snap** (fine-tweak mode) |
| Drag + `Shift` | **Temporarily enable snap** (if currently off) |

**Visual feedback during drag:**
- When snap is active: entity "jumps" between snap increments; a tooltip shows the snapped coordinate.
- When snap is temporarily disabled (Ctrl held): entity moves smoothly; tooltip shows raw coordinate with "(free)" label.

### 9.6 Migration Path

No backward-compatibility path. This is a breaking change. All scene files must include `snapSize`; editor save will write it explicitly.

---

## 10. Viewport UI Design (ASCII)

### 10.1 Overall Layout

```
┌─────────────────────────────────────────────────────────────────────────────────────────────┐
│ Mote — gg02                              [文件] [编辑] [视图] [帮助]                        │  ← Window-level MenuBar
├─────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                             │
│  ┌─┐  ┌──────────────────────────────────────────────────────────────────────────────────┐ │
│  │🖱│  │ [实体 ▼]                              │ [👁] [🧲8px] [⊕] [🏠] │ ×1.0 │ [🔒]      │ │  ← Viewport Header
│  │↕│  │ select │ move                            │                               │         │ │     (mode tab + view opts)
│  │  │  │──────────────────────────────────────────────────────────────────────────────────│ │
│  │  │  │                                                                                  │ │
│  │  │  │                           ╔═══════════════════════╗                              │ │
│  │  │  │                           ║                       ║                              │ │
│  │  │  │                           ║   ┌───┐  🌲          ║  ← Scene Bounds (bright)     │ │
│  │  │  │                           ║   └───┘              ║                              │ │
│  │  │  │    ═══════╪═══════        ║       ┌───┐ 👤      ║                              │ │
│  │  │  │           │               ║       └───┘ [═══]   ║  ← Selection box +           │ │
│  │  │  │    World Axis Gizmo       ║            ▲         ║     Move Gizmo               │ │
│  │  │  │    (bottom-left)          ║            │ pivot   ║     (red X / green Y)        │ │
│  │  │  │                           ║   ┌───┐ 🗿           ║                              │ │
│  │  │  │                           ║   └───┘            ║                              │ │
│  │  │  │                           ╚═══════════════════════╝                              │ │
│  │  │  │                                                                                  │ │
│  │  │  │  ~~~ out-of-bounds (dimmed 50%) ~~~                                              │ │
│  │  │  │                                                                                  │ │
│  │  │  │   [ faint grid: rgba(255,255,255,0.04) ]                                         │ │
│  │  │  │   [ bold center axes: ───→ X(red)  ↑ Y(green) ]                                  │ │
│  │  │  │                                                                                  │ │
│  │  │  │   ┌──────┐                                                                       │ │
│  │  │  │   │ 🧱░  │  ← brush ghost preview (semi-transparent prefab)                      │ │
│  │  │  │   └──────┘                                                                       │ │
│  │  │  │                                                                                  │ │
│  └─┘  └──────────────────────────────────────────────────────────────────────────────────┘ │
│  T-Panel (Entity Mode only)    │  Canvas Viewport                                          │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐    │
│  │ ( 256.00,  96.00 ) │ Grid(-8,3) │ Snap:8px │ Ent:42 (3 sel) │ 🏷Ground │ ↶Move ↷Place │    │  ← Footer
│  │   World              Tile         Snap       Count              Layer      History   │    │
│  └─────────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────────────────────┐    │
│  │ Scene Tree │ Inspector (N-Panel)                                                    │    │
│  │            │ Item: player                                                           │    │
│  │ [+] Scene  │ ├─ Transform ▼                                                         │    │
│  │   ├─ 🌲    │ │  X [ 256.00 ▲▼ ]  Y [ 96.00 ▲▼ ]  Rotation [ 0° ▲▼ ]                 │    │
│  │   ├─ 👤    │ │  Scale X [ 1.00 ▲▼ ]  Scale Y [ 1.00 ▲▼ ]                            │    │
│  │   └─ 🗿    │ ├─ Sprite ▼                                                            │    │
│  │            │ │  Atlas [ dungeon ▼ ]  Frame [ wall_01 ▼ ]                             │    │
│  └─────────────────────────────────────────────────────────────────────────────────────┘    │
│                                                                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────┘
```

### 10.2 Entity Mode — Detail View

```
T-Panel (left, 36px wide)          Canvas
┌────┐  ┌────────────────────────────────────────┐
│ 🖱 │  │  [实体 ▼]  [👁] [🧲8px] [⊕]    ×1.0  │
│    │  │  select move                           │
│ ↕  │  │                                        │
│    │  │         Z ↑                            │
│    │  │    ═════╪═════  ← World Axis Gizmo    │
│    │  │         │   (non-clickable)            │
│    │  │         ↓                              │
│    │  │                                        │
│    │  │      ┌─────────┐                       │
│    │  │      │  ┌───┐  │  ← Selected Entity    │
│    │  │      │  │ 🌲│  │     (orange outline)  │
│    │  │      │  └───┘  │                       │
│    │  │      │    ●    │  ← pivot point        │
│    │  │      │ ↑     → │  ← move gizmo         │
│    │  │      └─────────┘     (red X / green Y) │
│    │  │                                        │
└────┘  └────────────────────────────────────────┘
```

### 10.3 Brush Mode — Detail View

```
T-Panel hidden in Brush Mode       Canvas
                                   ┌────────────────────────────────────────┐
                                   │  [笔刷 ▼]  [👁] [🧲8px] [⊕]    ×1.0  │
                                   │  ✏️  🧹  💉  ▭                        │
                                   │  brush erase pick rect                │
                                   │                                        │
                                   │   ┌────┐ ┌────┐                       │
                                   │   │ 🧱░│ │ 🧱░│  ← brush ghost        │
                                   │   └────┘ └────┘     (2×2 pattern)     │
                                   │   ┌────┐ ┌────┐                       │
                                   │   │ 🧱░│ │ 🧱░│                       │
                                   │   └────┘ └────┘                       │
                                   │                                        │
                                   │      [ faint grid ]                    │
                                   │                                        │
                                   └────────────────────────────────────────┘
```

### 10.4 Selection States

```
Unselected              Selected (single)              Selected (multi, this is active)
┌────┐                  ┌═══════════┐                  ┌═══════════┐
│ 🌲 │                  │ ╔═══════╗ │                  │ ╔═══════╗ │
└────┘                  │ ║  🌲   ║ │                  │ ║  🌲   ║ │  ← brightest orange
                        │ ╚═══════╝ │                  │ ╚═══════╝ │
                        │     ●     │                  │     ●     │
                        │   ↑   →   │                  │   ↑   →   │
                        └───────────┘                  └───────────┘
                                                   ┌────┐
                                                   │ 🗿 │  ← other selected (darker)
                                                   └────┘

Selection color: #f4a742 (orange)
Active selection: #ffbb5c (light orange) + 2px outline
Inactive selection: #c4802a (dark orange) + 1px outline
```

### 10.5 Gizmo Designs (Canvas 2D)

```
Move Gizmo (on selected entity):
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

## 11. Keyboard Shortcuts Summary

| Key | Context | Action |
|-----|---------|--------|
| `Tab` | Global (viewport focused) | Toggle Entity ↔ Brush mode |
| `V` | Entity Mode | `select` tool |
| `G` | Entity Mode | `move` tool |
| `B` | Brush Mode | `brush` tool |
| `E` | Brush Mode | `eraser` tool |
| `I` | Brush Mode | `eyedropper` tool |
| `M` | Brush Mode | `rect-select` tool |
| `T` | Entity Mode | Toggle T-Panel visibility (no-op in Brush Mode) |
| `N` | Global | Toggle Inspector (N-Panel) visibility |
| `Ctrl+Shift+G` | Global | Toggle snap on/off |
| `Shift+G` | Global | Cycle snap size |
| `F` | Global | Frame camera to fit scene |
| `Home` | Global | Center camera |
| `Ctrl+Z` | Global | Undo |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Global | Redo |
| `Delete` / `Backspace` | Entity Mode | Delete selected entities |
| `Ctrl` (hold) | During drag | Temporarily disable snap |
| `Shift` (hold) | During drag | Temporarily enable snap (if off) |

---

## 12. Implementation Milestones

### M1 — Infrastructure
- Create `store/viewport.ts`, extract camera from `ViewportCanvas.tsx`, update Header/Footer to use shared store.
- Create `store/viewport-mode.ts` with `editMode`, `entityTool`, `brushTool`, shortcuts.
- Refactor `ViewportHeader.tsx`: add mode tabs + per-mode tool buttons.
- Refactor `ViewportCanvas.tsx`: add mode dispatch skeleton; extract entity/brush handlers.
- Move existing flat tools into correct mode (`select`/`move`→Entity, `brush`/`eraser`/`eyedropper`→Brush). `rotate`/`scale` and `fill` omitted per current decisions.
- `entity` tool stubbed (no-op); `move` reuses existing drag logic.
- Footer updated to show mode + active tool name.
- T-Panel: visible only in Entity Mode, hidden in Brush Mode.

### M2 — Real Sprite Rendering
- Add `utils/entitySprite.ts`, replace placeholder `drawEntity` with `drawImage` from `spriteSheetImages`.

### M3 — Visual Polish
- Fix grid clipping, add out-of-bounds dimming, add axis gizmo, resize selection boxes to match sprite frames.

### M4 — HUD & Navigation
- Enhanced Footer with world coordinates, zoom slider, frame-selection camera action.

### M5 — Brush Source Abstraction
- Add `BrushStamp` type to `store/brush.ts`; migrate `activePrefabPath` → `brushStamp`.
- Update `PaintBrushCommand` / `EraseCommand` to accept `BrushStamp`.
- Brush preview in Canvas draws actual prefab thumbnail (not blue rectangle).

### M6 — Performance
- Add dirty-rectangle or entity-bounds culling to skip off-screen entities.

### M7 — Sprite-Frame Brush Source (future)
- Extend `BrushStamp` with `type: 'sprite-frame'`.
- Add sprite-frame picker to Brush Palette panel.
- Update brush placement logic to create entities with `Sprite` override pointing to chosen frame.

### M8 — Tilemap Mode (future)
- New `EditMode: 'tilemap'`.
- New tilemap-specific commands operating on `TilemapComponent` data.
- Reuses Brush Mode UI (tool buttons, brush picker) but with tileset sources.
