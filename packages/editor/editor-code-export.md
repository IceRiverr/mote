# packages/editor 代码导出

## 文件清单

```
src/
├── App.tsx
├── main.tsx
├── index.css
├── commands/
│   ├── entity.ts
│   ├── layer.ts
│   ├── map-props.ts
│   ├── paint.ts
│   └── selection.ts
├── components/
│   ├── AreaView.tsx
│   ├── LayoutRoot.tsx
│   └── SplitHandle.tsx
├── data/
│   ├── atlas-import.ts
│   ├── export.ts
│   ├── io.ts
│   ├── SpriteAtlas.ts
│   ├── TileMap.ts
│   └── TileSet.ts
├── editors/
│   ├── inspector/
│   │   ├── InspectorEditor.tsx
│   │   ├── register.ts
│   │   └── panels/
│   │       ├── EntityPanel.tsx
│   │       ├── ExportPanel.tsx
│   │       ├── LayersPanel.tsx
│   │       ├── MapPropsPanel.tsx
│   │       └── PanelShell.tsx
│   ├── sprite-panel/
│   │   ├── SpritePanelCanvas.tsx
│   │   ├── SpritePanelEditor.tsx
│   │   ├── SpritePanelHeader.tsx
│   │   └── register.ts
│   ├── tile-palette/
│   │   ├── PaletteCanvas.tsx
│   │   ├── PaletteHeader.tsx
│   │   ├── RedoPanel.tsx
│   │   ├── register.ts
│   │   ├── TileContextMenu.tsx
│   │   ├── TilePaletteEditor.tsx
│   │   └── TileSetPopover.tsx
│   ├── viewport/
│   │   ├── ViewportCanvas.tsx
│   │   ├── ViewportEditor.tsx
│   │   ├── ViewportFooter.tsx
│   │   ├── ViewportHeader.tsx
│   │   └── register.ts
│   └── registry.ts
├── hooks/
│   └── useDrag.ts
├── layout/
│   ├── rect.ts
│   ├── tree.ts
│   └── types.ts
└── store/
    ├── atlas.ts
    ├── history.ts
    ├── layout.ts
    ├── project.ts
    ├── selection.ts
    └── tileSelection.ts
```

## 快速导航

- [src/App.tsx](#src-App_tsx)
- [src/commands/entity.ts](#src-commands-entity_ts)
- [src/commands/layer.ts](#src-commands-layer_ts)
- [src/commands/map-props.ts](#src-commands-map-props_ts)
- [src/commands/paint.ts](#src-commands-paint_ts)
- [src/commands/selection.ts](#src-commands-selection_ts)
- [src/components/AreaView.tsx](#src-components-AreaView_tsx)
- [src/components/LayoutRoot.tsx](#src-components-LayoutRoot_tsx)
- [src/components/SplitHandle.tsx](#src-components-SplitHandle_tsx)
- [src/data/atlas-import.ts](#src-data-atlas-import_ts)
- [src/data/export.ts](#src-data-export_ts)
- [src/data/io.ts](#src-data-io_ts)
- [src/data/SpriteAtlas.ts](#src-data-SpriteAtlas_ts)
- [src/data/TileMap.ts](#src-data-TileMap_ts)
- [src/data/TileSet.ts](#src-data-TileSet_ts)
- [src/editors/inspector/InspectorEditor.tsx](#src-editors-inspector-InspectorEditor_tsx)
- [src/editors/inspector/panels/EntityPanel.tsx](#src-editors-inspector-panels-EntityPanel_tsx)
- [src/editors/inspector/panels/ExportPanel.tsx](#src-editors-inspector-panels-ExportPanel_tsx)
- [src/editors/inspector/panels/LayersPanel.tsx](#src-editors-inspector-panels-LayersPanel_tsx)
- [src/editors/inspector/panels/MapPropsPanel.tsx](#src-editors-inspector-panels-MapPropsPanel_tsx)
- [src/editors/inspector/panels/PanelShell.tsx](#src-editors-inspector-panels-PanelShell_tsx)
- [src/editors/inspector/register.ts](#src-editors-inspector-register_ts)
- [src/editors/registry.ts](#src-editors-registry_ts)
- [src/editors/sprite-panel/register.ts](#src-editors-sprite-panel-register_ts)
- [src/editors/sprite-panel/SpritePanelCanvas.tsx](#src-editors-sprite-panel-SpritePanelCanvas_tsx)
- [src/editors/sprite-panel/SpritePanelEditor.tsx](#src-editors-sprite-panel-SpritePanelEditor_tsx)
- [src/editors/sprite-panel/SpritePanelHeader.tsx](#src-editors-sprite-panel-SpritePanelHeader_tsx)
- [src/editors/tile-palette/PaletteCanvas.tsx](#src-editors-tile-palette-PaletteCanvas_tsx)
- [src/editors/tile-palette/PaletteHeader.tsx](#src-editors-tile-palette-PaletteHeader_tsx)
- [src/editors/tile-palette/RedoPanel.tsx](#src-editors-tile-palette-RedoPanel_tsx)
- [src/editors/tile-palette/register.ts](#src-editors-tile-palette-register_ts)
- [src/editors/tile-palette/TileContextMenu.tsx](#src-editors-tile-palette-TileContextMenu_tsx)
- [src/editors/tile-palette/TilePaletteEditor.tsx](#src-editors-tile-palette-TilePaletteEditor_tsx)
- [src/editors/tile-palette/TileSetPopover.tsx](#src-editors-tile-palette-TileSetPopover_tsx)
- [src/editors/viewport/register.ts](#src-editors-viewport-register_ts)
- [src/editors/viewport/ViewportCanvas.tsx](#src-editors-viewport-ViewportCanvas_tsx)
- [src/editors/viewport/ViewportEditor.tsx](#src-editors-viewport-ViewportEditor_tsx)
- [src/editors/viewport/ViewportFooter.tsx](#src-editors-viewport-ViewportFooter_tsx)
- [src/editors/viewport/ViewportHeader.tsx](#src-editors-viewport-ViewportHeader_tsx)
- [src/hooks/useDrag.ts](#src-hooks-useDrag_ts)
- [src/index.css](#src-index_css)
- [src/layout/rect.ts](#src-layout-rect_ts)
- [src/layout/tree.ts](#src-layout-tree_ts)
- [src/layout/types.ts](#src-layout-types_ts)
- [src/main.tsx](#src-main_tsx)
- [src/store/atlas.ts](#src-store-atlas_ts)
- [src/store/history.ts](#src-store-history_ts)
- [src/store/layout.ts](#src-store-layout_ts)
- [src/store/project.ts](#src-store-project_ts)
- [src/store/selection.ts](#src-store-selection_ts)
- [src/store/tileSelection.ts](#src-store-tileSelection_ts)

---

<!-- src/App.tsx -->
<a id="src-App_tsx"></a>

## src/App.tsx

```tsx
import "./editors/tile-palette/register";
import "./editors/viewport/register";
import "./editors/inspector/register";
import "./editors/sprite-panel/register";

import { useEffect } from "preact/hooks";
import { LayoutRoot } from "./components/LayoutRoot";
import { undo, redo } from "./store/history";
import { activeTool, type ToolType } from "./store/selection";

const TOOL_SHORTCUTS: Record<string, ToolType> = {
  v: "select",
  b: "brush",
  e: "eraser",
  g: "fill",
  i: "eyedropper",
  n: "entity",
};

export function App() {
  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if focused on input/select/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;

      // Ctrl+Z / Cmd+Z → Undo
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        undo();
        return;
      }

      // Ctrl+Shift+Z / Cmd+Shift+Z → Redo
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "Z") {
        e.preventDefault();
        redo();
        return;
      }

      // Ctrl+Y / Cmd+Y → Redo (alternative)
      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        redo();
        return;
      }

      // Tool shortcuts (single key, no modifiers)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        const tool = TOOL_SHORTCUTS[e.key.toLowerCase()];
        if (tool) {
          e.preventDefault();
          activeTool.value = tool;
          return;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
      }}
    >
      <div
        style={{
          height: 32,
          background: "#2a2a2a",
          borderBottom: "1px solid #111",
          display: "flex",
          alignItems: "center",
          paddingLeft: 12,
          fontWeight: 600,
          fontSize: 13,
          color: "#aaa",
          flexShrink: 0,
        }}
      >
        Mote Editor — 微尘
      </div>
      <div style={{ flex: 1, position: "relative" }}>
        <LayoutRoot />
      </div>
    </div>
  );
}

```

<!-- src/commands/entity.ts -->
<a id="src-commands-entity_ts"></a>

## src/commands/entity.ts

```ts
import type { Command } from "../store/history";
import type { EntityInstance } from "../data/TileMap";
import { isEntityLayer } from "../data/TileMap";
import { currentMap, bumpMapVersion } from "../store/project";

// ---------------------------------------------------------------------------
// AddEntityCommand
// ---------------------------------------------------------------------------
export class AddEntityCommand implements Command {
  readonly label = "\u653e\u7f6e\u5b9e\u4f53";

  constructor(
    private layerId: string,
    private entity: EntityInstance,
  ) {}

  execute(): void {
    const map = currentMap.value;
    currentMap.value = {
      ...map,
      layers: map.layers.map((l) => {
        if (l.id !== this.layerId || !isEntityLayer(l)) return l;
        return { ...l, entities: [...l.entities, this.entity] };
      }),
    };
    bumpMapVersion();
  }

  undo(): void {
    const map = currentMap.value;
    currentMap.value = {
      ...map,
      layers: map.layers.map((l) => {
        if (l.id !== this.layerId || !isEntityLayer(l)) return l;
        return { ...l, entities: l.entities.filter((e) => e.id !== this.entity.id) };
      }),
    };
    bumpMapVersion();
  }
}

// ---------------------------------------------------------------------------
// RemoveEntityCommand
// ---------------------------------------------------------------------------
export class RemoveEntityCommand implements Command {
  readonly label = "\u5220\u9664\u5b9e\u4f53";
  private entity: EntityInstance | null = null;
  private layerId: string;

  constructor(layerId: string, entityId: string) {
    this.layerId = layerId;
    const map = currentMap.value;
    const layer = map.layers.find((l) => l.id === layerId);
    if (layer && isEntityLayer(layer)) {
      this.entity = layer.entities.find((e) => e.id === entityId) ?? null;
    }
  }

  execute(): void {
    if (!this.entity) return;
    const map = currentMap.value;
    currentMap.value = {
      ...map,
      layers: map.layers.map((l) => {
        if (l.id !== this.layerId || !isEntityLayer(l)) return l;
        return { ...l, entities: l.entities.filter((e) => e.id !== this.entity!.id) };
      }),
    };
    bumpMapVersion();
  }

  undo(): void {
    if (!this.entity) return;
    const map = currentMap.value;
    const entity = this.entity;
    currentMap.value = {
      ...map,
      layers: map.layers.map((l) => {
        if (l.id !== this.layerId || !isEntityLayer(l)) return l;
        return { ...l, entities: [...l.entities, entity] };
      }),
    };
    bumpMapVersion();
  }
}

// ---------------------------------------------------------------------------
// MoveEntityCommand
// ---------------------------------------------------------------------------
export class MoveEntityCommand implements Command {
  readonly label = "\u79fb\u52a8\u5b9e\u4f53";

  constructor(
    private layerId: string,
    private entityId: string,
    private oldX: number,
    private oldY: number,
    private newX: number,
    private newY: number,
  ) {}

  execute(): void {
    this.apply(this.newX, this.newY);
  }

  undo(): void {
    this.apply(this.oldX, this.oldY);
  }

  private apply(x: number, y: number): void {
    const map = currentMap.value;
    currentMap.value = {
      ...map,
      layers: map.layers.map((l) => {
        if (l.id !== this.layerId || !isEntityLayer(l)) return l;
        return {
          ...l,
          entities: l.entities.map((e) =>
            e.id === this.entityId ? { ...e, x, y } : e
          ),
        };
      }),
    };
    bumpMapVersion();
  }
}

// ---------------------------------------------------------------------------
// SetEntityPropertyCommand
// ---------------------------------------------------------------------------
export class SetEntityPropertyCommand<K extends keyof EntityInstance> implements Command {
  readonly label: string;
  private layerId: string;
  private entityId: string;
  private key: K;
  private oldValue: EntityInstance[K];
  private newValue: EntityInstance[K];

  constructor(
    layerId: string,
    entityId: string,
    key: K,
    newValue: EntityInstance[K],
    label?: string,
  ) {
    this.layerId = layerId;
    this.entityId = entityId;
    this.key = key;
    this.newValue = newValue;
    this.label = label ?? `\u4fee\u6539\u5b9e\u4f53 ${String(key)}`;

    const map = currentMap.value;
    const layer = map.layers.find((l) => l.id === layerId);
    if (layer && isEntityLayer(layer)) {
      const entity = layer.entities.find((e) => e.id === entityId);
      this.oldValue = entity ? entity[key] : newValue;
    } else {
      this.oldValue = newValue;
    }
  }

  execute(): void {
    this.apply(this.newValue);
  }

  undo(): void {
    this.apply(this.oldValue);
  }

  private apply(value: EntityInstance[K]): void {
    const map = currentMap.value;
    currentMap.value = {
      ...map,
      layers: map.layers.map((l) => {
        if (l.id !== this.layerId || !isEntityLayer(l)) return l;
        return {
          ...l,
          entities: l.entities.map((e) =>
            e.id === this.entityId ? { ...e, [this.key]: value } : e
          ),
        };
      }),
    };
    bumpMapVersion();
  }
}

```

<!-- src/commands/layer.ts -->
<a id="src-commands-layer_ts"></a>

## src/commands/layer.ts

```ts
import type { Command } from "../store/history";
import type { MapLayer } from "../data/TileMap";
import { isTileLayer } from "../data/TileMap";
import { currentMap, activeLayerId, bumpMapVersion } from "../store/project";

// ---------------------------------------------------------------------------
// AddLayerCommand
// ---------------------------------------------------------------------------
export class AddLayerCommand implements Command {
  readonly label = "添加图层";
  private layer: MapLayer;
  private prevActiveId: string;

  constructor(layer: MapLayer) {
    this.layer = layer;
    this.prevActiveId = activeLayerId.value;
  }

  execute(): void {
    const map = currentMap.value;
    currentMap.value = {
      ...map,
      layers: [...map.layers, this.layer],
    };
    activeLayerId.value = this.layer.id;
    bumpMapVersion();
  }

  undo(): void {
    const map = currentMap.value;
    currentMap.value = {
      ...map,
      layers: map.layers.filter((l) => l.id !== this.layer.id),
    };
    activeLayerId.value = this.prevActiveId;
    bumpMapVersion();
  }
}

// ---------------------------------------------------------------------------
// RemoveLayerCommand
// ---------------------------------------------------------------------------
export class RemoveLayerCommand implements Command {
  readonly label = "删除图层";
  private layer: MapLayer;
  private index: number;
  private prevActiveId: string;

  constructor(layerId: string) {
    const map = currentMap.value;
    const idx = map.layers.findIndex((l) => l.id === layerId);
    const src = map.layers[idx];
    if (isTileLayer(src)) {
      this.layer = { ...src, data: [...src.data] };
    } else {
      this.layer = { ...src, entities: [...src.entities] };
    }
    this.index = idx;
    this.prevActiveId = activeLayerId.value;
  }

  execute(): void {
    const map = currentMap.value;
    currentMap.value = {
      ...map,
      layers: map.layers.filter((l) => l.id !== this.layer.id),
    };
    if (activeLayerId.value === this.layer.id) {
      activeLayerId.value = currentMap.value.layers[0]?.id ?? "";
    }
    bumpMapVersion();
  }

  undo(): void {
    const map = currentMap.value;
    const newLayers = [...map.layers];
    newLayers.splice(this.index, 0, this.layer);
    currentMap.value = { ...map, layers: newLayers };
    activeLayerId.value = this.prevActiveId;
    bumpMapVersion();
  }
}

// ---------------------------------------------------------------------------
// MoveLayerCommand
// ---------------------------------------------------------------------------
export class MoveLayerCommand implements Command {
  readonly label: string;
  private layerId: string;
  private dir: -1 | 1;

  constructor(layerId: string, dir: -1 | 1) {
    this.layerId = layerId;
    this.dir = dir;
    this.label = dir === -1 ? "上移图层" : "下移图层";
  }

  execute(): void {
    this.swap(this.dir);
  }

  undo(): void {
    this.swap(-this.dir as -1 | 1);
  }

  private swap(dir: -1 | 1): void {
    const map = currentMap.value;
    const idx = map.layers.findIndex((l) => l.id === this.layerId);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= map.layers.length) return;
    const newLayers = [...map.layers];
    [newLayers[idx], newLayers[newIdx]] = [newLayers[newIdx], newLayers[idx]];
    currentMap.value = { ...map, layers: newLayers };
    bumpMapVersion();
  }
}

// ---------------------------------------------------------------------------
// SetLayerPropertyCommand
// ---------------------------------------------------------------------------
type LayerBaseKey = "name" | "visible" | "opacity" | "locked" | "color";

export class SetLayerPropertyCommand<K extends LayerBaseKey> implements Command {
  readonly label: string;
  private layerId: string;
  private key: K;
  private oldValue: MapLayer[K];
  private newValue: MapLayer[K];

  constructor(layerId: string, key: K, newValue: MapLayer[K], label?: string) {
    this.layerId = layerId;
    this.key = key;
    this.newValue = newValue;
    const map = currentMap.value;
    const layer = map.layers.find((l) => l.id === layerId)!;
    this.oldValue = layer[key] as MapLayer[K];
    this.label = label ?? `修改图层 ${String(key)}`;
  }

  execute(): void {
    this.apply(this.newValue);
  }

  undo(): void {
    this.apply(this.oldValue);
  }

  private apply(value: MapLayer[K]): void {
    const map = currentMap.value;
    currentMap.value = {
      ...map,
      layers: map.layers.map((l) =>
        l.id === this.layerId ? { ...l, [this.key]: value } : l
      ),
    };
    bumpMapVersion();
  }
}

```

<!-- src/commands/map-props.ts -->
<a id="src-commands-map-props_ts"></a>

## src/commands/map-props.ts

```ts
import type { Command } from "../store/history";
import type { TileMap } from "../data/TileMap";
import { isTileLayer } from "../data/TileMap";
import { currentMap, bumpMapVersion } from "../store/project";

export class SetMapNameCommand implements Command {
  readonly label = "修改地图名称";
  private oldName: string;
  private newName: string;

  constructor(newName: string) {
    this.oldName = currentMap.value.name;
    this.newName = newName;
  }

  execute(): void {
    currentMap.value = { ...currentMap.value, name: this.newName };
    bumpMapVersion();
  }

  undo(): void {
    currentMap.value = { ...currentMap.value, name: this.oldName };
    bumpMapVersion();
  }
}

export class ResizeMapCommand implements Command {
  readonly label = "调整地图尺寸";
  private oldWidth: number;
  private oldHeight: number;
  private newWidth: number;
  private newHeight: number;
  private oldLayerData: Map<string, number[]>;

  constructor(newWidth: number, newHeight: number) {
    const map = currentMap.value;
    this.oldWidth = map.width;
    this.oldHeight = map.height;
    this.newWidth = newWidth;
    this.newHeight = newHeight;

    this.oldLayerData = new Map();
    for (const layer of map.layers) {
      if (isTileLayer(layer)) {
        this.oldLayerData.set(layer.id, [...layer.data]);
      }
    }
  }

  execute(): void {
    this.resize(this.newWidth, this.newHeight, this.oldWidth, this.oldHeight);
  }

  undo(): void {
    const map = currentMap.value;
    currentMap.value = {
      ...map,
      width: this.oldWidth,
      height: this.oldHeight,
      layers: map.layers.map((l) => {
        if (isTileLayer(l)) {
          const data = this.oldLayerData.get(l.id);
          return data ? { ...l, data: [...data] } : l;
        }
        return l;
      }),
    };
    bumpMapVersion();
  }

  private resize(
    newW: number,
    newH: number,
    oldW: number,
    _oldH: number
  ): void {
    const map = currentMap.value;
    currentMap.value = {
      ...map,
      width: newW,
      height: newH,
      layers: map.layers.map((l) => {
        if (!isTileLayer(l)) return l;
        const srcW = l.data.length > 0 ? oldW : newW;
        const srcH = Math.floor(l.data.length / (srcW || 1));
        const newData = new Array(newW * newH).fill(0);
        const copyW = Math.min(srcW, newW);
        const copyH = Math.min(srcH, newH);
        for (let y = 0; y < copyH; y++) {
          for (let x = 0; x < copyW; x++) {
            newData[y * newW + x] = l.data[y * srcW + x] ?? 0;
          }
        }
        return { ...l, data: newData };
      }),
    };
    bumpMapVersion();
  }
}

```

<!-- src/commands/paint.ts -->
<a id="src-commands-paint_ts"></a>

## src/commands/paint.ts

```ts
import type { Command } from "../store/history";
import { currentMap, bumpMapVersion } from "../store/project";
import { isTileLayer } from "../data/TileMap";

export type TileChange = Map<number, { oldGid: number; newGid: number }>;

export class PaintTilesCommand implements Command {
  readonly label: string;
  private changes: TileChange = new Map();
  private executed = false;

  constructor(private layerId: string, label = "绘制 tile") {
    this.label = label;
  }

  record(index: number, oldGid: number, newGid: number): void {
    const existing = this.changes.get(index);
    if (existing) {
      existing.newGid = newGid;
    } else {
      this.changes.set(index, { oldGid, newGid });
    }
  }

  hasChanges(): boolean {
    for (const [, { oldGid, newGid }] of this.changes) {
      if (oldGid !== newGid) return true;
    }
    return false;
  }

  execute(): void {
    if (this.executed) {
      const map = currentMap.value;
      const layer = map.layers.find((l) => l.id === this.layerId);
      if (!layer || !isTileLayer(layer)) return;
      for (const [idx, { newGid }] of this.changes) {
        layer.data[idx] = newGid;
      }
      bumpMapVersion();
    }
    this.executed = true;
  }

  undo(): void {
    const map = currentMap.value;
    const layer = map.layers.find((l) => l.id === this.layerId);
    if (!layer || !isTileLayer(layer)) return;
    for (const [idx, { oldGid }] of this.changes) {
      layer.data[idx] = oldGid;
    }
    bumpMapVersion();
  }
}

```

<!-- src/commands/selection.ts -->
<a id="src-commands-selection_ts"></a>

## src/commands/selection.ts

```ts
import type { Command } from "../store/history";
import { currentMap, bumpMapVersion } from "../store/project";
import { isTileLayer } from "../data/TileMap";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class MoveSelectionCommand implements Command {
  readonly label = "移动选区";
  private executed = false;
  private destOldTiles: number[];

  constructor(
    private layerId: string,
    private sourceRect: Rect,
    private destRect: Rect,
    private tiles: number[],
    private sourceOldTiles: number[],
  ) {
    const map = currentMap.value;
    const layer = map.layers.find((l) => l.id === this.layerId);
    this.destOldTiles = [];
    if (layer && isTileLayer(layer)) {
      for (let r = 0; r < destRect.h; r++) {
        for (let c = 0; c < destRect.w; c++) {
          const tx = destRect.x + c;
          const ty = destRect.y + r;
          if (tx >= 0 && tx < map.width && ty >= 0 && ty < map.height) {
            this.destOldTiles.push(layer.data[ty * map.width + tx]);
          } else {
            this.destOldTiles.push(0);
          }
        }
      }
    }
  }

  execute(): void {
    if (this.executed) {
      const map = currentMap.value;
      const layer = map.layers.find((l) => l.id === this.layerId);
      if (!layer || !isTileLayer(layer)) return;

      for (let r = 0; r < this.sourceRect.h; r++) {
        for (let c = 0; c < this.sourceRect.w; c++) {
          const tx = this.sourceRect.x + c;
          const ty = this.sourceRect.y + r;
          if (tx >= 0 && tx < map.width && ty >= 0 && ty < map.height) {
            layer.data[ty * map.width + tx] = 0;
          }
        }
      }

      for (let r = 0; r < this.destRect.h; r++) {
        for (let c = 0; c < this.destRect.w; c++) {
          const tx = this.destRect.x + c;
          const ty = this.destRect.y + r;
          if (tx >= 0 && tx < map.width && ty >= 0 && ty < map.height) {
            layer.data[ty * map.width + tx] = this.tiles[r * this.destRect.w + c];
          }
        }
      }
      bumpMapVersion();
    }
    this.executed = true;
  }

  undo(): void {
    const map = currentMap.value;
    const layer = map.layers.find((l) => l.id === this.layerId);
    if (!layer || !isTileLayer(layer)) return;

    for (let r = 0; r < this.destRect.h; r++) {
      for (let c = 0; c < this.destRect.w; c++) {
        const tx = this.destRect.x + c;
        const ty = this.destRect.y + r;
        if (tx >= 0 && tx < map.width && ty >= 0 && ty < map.height) {
          layer.data[ty * map.width + tx] = this.destOldTiles[r * this.destRect.w + c];
        }
      }
    }

    for (let r = 0; r < this.sourceRect.h; r++) {
      for (let c = 0; c < this.sourceRect.w; c++) {
        const tx = this.sourceRect.x + c;
        const ty = this.sourceRect.y + r;
        if (tx >= 0 && tx < map.width && ty >= 0 && ty < map.height) {
          layer.data[ty * map.width + tx] = this.sourceOldTiles[r * this.sourceRect.w + c];
        }
      }
    }
    bumpMapVersion();
  }
}

```

<!-- src/components/AreaView.tsx -->
<a id="src-components-AreaView_tsx"></a>

## src/components/AreaView.tsx

```tsx
import { Rect } from '../layout/types';
import { getEditor, getAllEditors } from '../editors/registry';
import { setEditorType } from '../layout/tree';
import { layoutTree } from '../store/layout';

interface Props {
  areaId: string;
  editorType: string;
  rect: Rect;
}

export function AreaView({ areaId, editorType, rect }: Props) {
  const editor = getEditor(editorType);
  const allEditors = getAllEditors();

  const handleSwitch = (e: Event) => {
    const val = (e.target as HTMLSelectElement).value;
    layoutTree.value = setEditorType(layoutTree.value, areaId, val);
  };

  const Comp = editor?.component;

  return (
    <div
      style={{
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        display: 'flex',
        flexDirection: 'column',
        background: '#252525',
        borderRight: '1px solid #111',
        borderBottom: '1px solid #111',
        overflow: 'hidden',
      }}
    >
      {/* Area Header */}
      <div style={{
        height: 26,
        background: '#2d2d2d',
        borderBottom: '1px solid #1a1a1a',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 6,
        gap: 6,
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 12, opacity: 0.5 }}>{editor?.icon ?? '◻'}</span>
        <select
          value={editorType}
          onChange={handleSwitch}
          style={{
            background: '#333',
            color: '#ccc',
            border: '1px solid #444',
            borderRadius: 3,
            fontSize: 11,
            padding: '1px 4px',
            outline: 'none',
          }}
        >
          {allEditors.map((ed) => (
            <option key={ed.id} value={ed.id}>{ed.name}</option>
          ))}
        </select>
      </div>

      {/* Editor Content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {Comp ? <Comp areaId={areaId} /> : <div style={{ padding: 12, color: '#666' }}>Unknown editor: {editorType}</div>}
      </div>
    </div>
  );
}

```

<!-- src/components/LayoutRoot.tsx -->
<a id="src-components-LayoutRoot_tsx"></a>

## src/components/LayoutRoot.tsx

```tsx
import { useEffect, useRef } from 'preact/hooks';
import { containerSize, layoutComputed, layoutTree } from '../store/layout';
import { AreaView } from './AreaView';
import { SplitHandle } from './SplitHandle';
import { collectAreas } from '../layout/tree';

export function LayoutRoot() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      containerSize.value = { x: 0, y: 0, w: width, h: height };
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { areas, splits } = layoutComputed.value;
  const areaNodes = collectAreas(layoutTree.value);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {areaNodes.map((node) => {
        const rect = areas.get(node.id);
        if (!rect) return null;
        return <AreaView key={node.id} areaId={node.id} editorType={node.editorType} rect={rect} />;
      })}
      {splits.map((s) => (
        <SplitHandle key={s.splitId} splitInfo={s} />
      ))}
    </div>
  );
}

```

<!-- src/components/SplitHandle.tsx -->
<a id="src-components-SplitHandle_tsx"></a>

## src/components/SplitHandle.tsx

```tsx
import { useRef } from 'preact/hooks';
import { SplitInfo } from '../layout/types';
import { layoutTree } from '../store/layout';
import { resizeSplit } from '../layout/tree';
import { useDrag } from '../hooks/useDrag';

interface Props {
  splitInfo: SplitInfo;
}

export function SplitHandle({ splitInfo }: Props) {
  const { splitId, direction, rect, parentBounds } = splitInfo;
  const handleRef = useRef<HTMLDivElement>(null);

  const { onPointerDown } = useDrag({
    onMove(e) {
      // Get the layout container (grandparent of the handle)
      const container = handleRef.current?.parentElement;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();

      // Convert clientX/Y to layout-local coordinates, then compute ratio
      let ratio: number;
      if (direction === 'horizontal') {
        const localY = e.clientY - containerRect.top;
        ratio = (localY - parentBounds.y) / parentBounds.h;
      } else {
        const localX = e.clientX - containerRect.left;
        ratio = (localX - parentBounds.x) / parentBounds.w;
      }
      layoutTree.value = resizeSplit(layoutTree.value, splitId, ratio);
    },
  });

  return (
    <div
      ref={handleRef}
      onPointerDown={onPointerDown as any}
      style={{
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        cursor: direction === 'horizontal' ? 'row-resize' : 'col-resize',
        background: '#111',
        zIndex: 10,
      }}
    />
  );
}

```

<!-- src/data/atlas-import.ts -->
<a id="src-data-atlas-import_ts"></a>

## src/data/atlas-import.ts

```ts
/**
 * Atlas import helpers for all three modes:
 *   1. Tile Sheet (grid)
 *   2. Packed Atlas (TexturePacker JSON)
 *   3. Loose Files (directory of PNGs)
 */
import {
  createAtlasFromGrid,
  createAtlasFromPackedJson,
  createAtlasFromLooseFrames,
  createAtlasFromSparrowXml,
  parseSparrowXml,
  packLooseImages,
} from "./SpriteAtlas";
import type { SpriteAtlas, TexturePackerJson } from "./SpriteAtlas";
import { addAtlas } from "../store/atlas";

/** Load an image from a File object */
function loadImageFromFile(file: File): Promise<{ url: string; img: HTMLImageElement }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ url, img });
    img.onerror = reject;
    img.src = url;
  });
}

/** Load image from data URL */
function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/** Read a file as JSON */
function readJsonFile(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try { resolve(JSON.parse(reader.result as string)); }
      catch (e) { reject(e); }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}


/** Read a file as text */
function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}
// ============================================================
// Mode 1: Tile Sheet (grid)
// ============================================================
export async function importTileSheetAtlas(
  imageFile: File,
  tileWidth: number,
  tileHeight: number,
  margin = 0,
  spacing = 0,
  name?: string,
): Promise<SpriteAtlas> {
  const { url, img } = await loadImageFromFile(imageFile);
  const atlasName = name ?? imageFile.name.replace(/\.[^.]+$/, "");
  const id = `atlas_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const atlas = createAtlasFromGrid(
    id, atlasName, url,
    img.naturalWidth, img.naturalHeight,
    tileWidth, tileHeight, margin, spacing,
    atlasName,
  );

  addAtlas(atlas, img);
  return atlas;
}

// ============================================================
// Mode 2: Packed Atlas (TexturePacker JSON hash)
// ============================================================
export async function importPackedAtlas(
  jsonFile: File,
  imageFile: File,
  name?: string,
): Promise<SpriteAtlas> {
  const jsonData = await readJsonFile(jsonFile) as TexturePackerJson;

  // Validate basic structure
  if (!jsonData.frames || !jsonData.meta) {
    throw new Error("Invalid TexturePacker JSON: missing frames or meta");
  }

  const { url, img } = await loadImageFromFile(imageFile);
  const atlasName = name ?? jsonFile.name.replace(/\.[^.]+$/, "");
  const id = `atlas_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const atlas = createAtlasFromPackedJson(id, atlasName, url, jsonData);
  addAtlas(atlas, img);
  return atlas;
}

// ============================================================
// Mode 3: Loose Files (Kenney-style directory of PNGs)
// ============================================================
export async function importLooseFiles(
  imageFiles: File[],
  name?: string,
  padding = 1,
): Promise<SpriteAtlas> {
  // Load all images
  const loaded: Array<{ name: string; img: HTMLImageElement }> = [];
  for (const file of imageFiles) {
    const { img } = await loadImageFromFile(file);
    loaded.push({ name: file.name, img });
  }

  // Sort alphabetically for consistent ordering
  loaded.sort((a, b) => a.name.localeCompare(b.name));

  // Pack into single atlas
  const { canvas, frames } = packLooseImages(loaded, padding);

  // Convert canvas to data URL and create image
  const dataUrl = canvas.toDataURL("image/png");
  const atlasImg = await loadImageFromDataUrl(dataUrl);

  const atlasName = name ?? "loose_atlas";
  const id = `atlas_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const atlas = createAtlasFromLooseFrames(
    id, atlasName, dataUrl,
    canvas.width, canvas.height,
    frames,
  );

  addAtlas(atlas, atlasImg);
  return atlas;
}


// ============================================================
// Mode 4: XML Atlas (Sparrow / Starling format)
// ============================================================
export async function importXmlAtlas(
  xmlFile: File,
  imageFile: File,
  name?: string,
): Promise<SpriteAtlas> {
  const xmlText = await readTextFile(xmlFile);
  const xmlData = parseSparrowXml(xmlText);

  const { url, img } = await loadImageFromFile(imageFile);
  const atlasName = name ?? xmlFile.name.replace(/\.[^.]+$/, "");
  const id = `atlas_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const atlas = createAtlasFromSparrowXml(
    id, atlasName, url,
    img.naturalWidth, img.naturalHeight,
    xmlData,
  );
  addAtlas(atlas, img);
  return atlas;
}

// ============================================================
// Auto-detect import mode
// ============================================================
export function detectAtlasImportMode(
  files: File[],
): "packed" | "xml" | "loose" | "unknown" {
  const hasJson = files.some((f) => f.name.endsWith(".json"));
  const hasXml = files.some((f) => /\.(xml|txt)$/i.test(f.name));
  const imageCount = files.filter((f) =>
    /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name)
  ).length;

  if (hasJson && imageCount === 1) return "packed";
  if (hasXml && imageCount === 1) return "xml";
  if (!hasJson && !hasXml && imageCount > 1) return "loose";
  return "unknown";
}

```

<!-- src/data/export.ts -->
<a id="src-data-export_ts"></a>

## src/data/export.ts

```ts
import type { TileMap } from "./TileMap";
import type { TileSet } from "./TileSet";
import {
  exportMapStandalone,
  exportMapBundle,
  tileSetToJson,
  downloadJson,
} from "./io";

export type { TileMapStandaloneJson, TileMapBundleJson } from "./io";

/**
 * Export map as standalone (references external tilesets).
 */
export function exportStandalone(map: TileMap, tilesets: TileSet[]) {
  const data = exportMapStandalone(map, tilesets);
  downloadJson(data, `${map.name}.mote.json`);
}

/**
 * Export map as self-contained bundle (all data inline).
 */
export function exportBundle(
  map: TileMap,
  tilesets: TileSet[],
  images: Map<string, HTMLImageElement>,
) {
  const data = exportMapBundle(map, tilesets, images);
  downloadJson(data, `${map.name}.mote-bundle.json`);
}

/**
 * Export a single tileset as standalone JSON.
 */
export function exportTileSet(ts: TileSet) {
  const data = tileSetToJson(ts);
  const safeName = ts.name.replace(/[^a-zA-Z0-9_\-]/g, "_");
  downloadJson(data, `${safeName}.mote-tileset.json`);
}

```

<!-- src/data/io.ts -->
<a id="src-data-io_ts"></a>

## src/data/io.ts

```ts
import type { TileSet, TileData } from "./TileSet";
import type { TileMap, TileSetRef, MapLayer, EntityInstance } from "./TileMap";
import { isTileLayer, isEntityLayer } from "./TileMap";
import { createTileSet } from "./TileSet";

// ============================================================
// TileSet JSON format (.mote-tileset.json)
// ============================================================

export interface TileSetJson {
  version: "1.0";
  type: "mote-tileset";
  id: string;
  name: string;
  image: string; // filename only
  imageWidth: number;
  imageHeight: number;
  tileWidth: number;
  tileHeight: number;
  margin: number;
  spacing: number;
  columns: number;
  rows: number;
  tileCount: number;
  tileData?: Record<number, TileData>;
}

export function tileSetToJson(ts: TileSet): TileSetJson {
  const imageName = ts.name.replace(/[^a-zA-Z0-9_\-]/g, "_") + ".png";
  return {
    version: "1.0",
    type: "mote-tileset",
    id: ts.id,
    name: ts.name,
    image: imageName,
    imageWidth: ts.imageWidth,
    imageHeight: ts.imageHeight,
    tileWidth: ts.tileWidth,
    tileHeight: ts.tileHeight,
    margin: ts.margin,
    spacing: ts.spacing,
    columns: ts.columns,
    rows: ts.rows,
    tileCount: ts.tileCount,
    tileData: Object.keys(ts.tileData).length > 0 ? ts.tileData : undefined,
  };
}

export function tileSetFromJson(
  json: TileSetJson,
  imageUrl: string,
): TileSet {
  const ts = createTileSet(
    json.id,
    json.name,
    imageUrl,
    json.imageWidth,
    json.imageHeight,
    json.tileWidth,
    json.tileHeight,
    json.margin,
    json.spacing,
  );
  if (json.tileData) {
    ts.tileData = json.tileData;
  }
  return ts;
}

// ============================================================
// TileMap standalone export (.mote.json)
// ============================================================

export interface TileMapStandaloneJson {
  version: "1.0";
  type: "mote-tilemap";
  id: string;
  name: string;
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  tilesets: Array<{
    source: string; // e.g. "kenney.mote-tileset.json"
    firstGid: number;
  }>;
  layers: ExportAnyLayer[];
}

interface ExportLayer {
  id: string;
  name: string;
  type: "tilelayer";
  visible: boolean;
  opacity: number;
  locked: boolean;
  data: number[];
}

interface ExportEntityLayer {
  id: string;
  name: string;
  type: "entitylayer";
  visible: boolean;
  opacity: number;
  locked: boolean;
  entities: EntityInstance[];
}

type ExportAnyLayer = ExportLayer | ExportEntityLayer;

export function exportMapStandalone(
  map: TileMap,
  tilesets: TileSet[],
): TileMapStandaloneJson {
  const tsMap = new Map(tilesets.map((t) => [t.id, t]));
  return {
    version: "1.0",
    type: "mote-tilemap",
    id: map.id,
    name: map.name,
    width: map.width,
    height: map.height,
    tileWidth: map.tileWidth,
    tileHeight: map.tileHeight,
    tilesets: map.tilesets.map((ref) => {
      const ts = tsMap.get(ref.tilesetId);
      const name = ts ? ts.name.replace(/[^a-zA-Z0-9_\-]/g, "_") : ref.tilesetId;
      return {
        source: `${name}.mote-tileset.json`,
        firstGid: ref.firstGid,
      };
    }),
    layers: map.layers.map((l): ExportAnyLayer => {
      if (isTileLayer(l)) {
        return {
          id: l.id,
          name: l.name,
          type: "tilelayer" as const,
          visible: l.visible,
          opacity: l.opacity,
          locked: l.locked,
          data: Array.from(l.data),
        };
      } else {
        return {
          id: l.id,
          name: l.name,
          type: "entitylayer" as const,
          visible: l.visible,
          opacity: l.opacity,
          locked: l.locked,
          entities: l.entities.map((e) => ({ ...e })),
        };
      }
    }),
  };
}

// ============================================================
// TileMap bundle export (.mote-bundle.json) - self-contained
// ============================================================

export interface TileMapBundleJson {
  version: "1.0";
  type: "mote-tilemap-bundle";
  id: string;
  name: string;
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  tilesets: Array<{
    id: string;
    name: string;
    imageData: string; // base64 data URL
    imageWidth: number;
    imageHeight: number;
    tileWidth: number;
    tileHeight: number;
    margin: number;
    spacing: number;
    columns: number;
    rows: number;
    tileCount: number;
    firstGid: number;
    tileData?: Record<number, TileData>;
  }>;
  layers: ExportAnyLayer[];
}

function imageToDataUrl(img: HTMLImageElement): string {
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL("image/png");
}

export function exportMapBundle(
  map: TileMap,
  tilesets: TileSet[],
  images: Map<string, HTMLImageElement>,
): TileMapBundleJson {
  const tsMap = new Map(tilesets.map((t) => [t.id, t]));
  return {
    version: "1.0",
    type: "mote-tilemap-bundle",
    id: map.id,
    name: map.name,
    width: map.width,
    height: map.height,
    tileWidth: map.tileWidth,
    tileHeight: map.tileHeight,
    tilesets: map.tilesets.map((ref) => {
      const ts = tsMap.get(ref.tilesetId)!;
      const img = images.get(ref.tilesetId);
      return {
        id: ts.id,
        name: ts.name,
        imageData: img ? imageToDataUrl(img) : "",
        imageWidth: ts.imageWidth,
        imageHeight: ts.imageHeight,
        tileWidth: ts.tileWidth,
        tileHeight: ts.tileHeight,
        margin: ts.margin,
        spacing: ts.spacing,
        columns: ts.columns,
        rows: ts.rows,
        tileCount: ts.tileCount,
        firstGid: ref.firstGid,
        tileData: Object.keys(ts.tileData).length > 0 ? ts.tileData : undefined,
      };
    }),
    layers: map.layers.map((l): ExportAnyLayer => {
      if (isTileLayer(l)) {
        return {
          id: l.id,
          name: l.name,
          type: "tilelayer" as const,
          visible: l.visible,
          opacity: l.opacity,
          locked: l.locked,
          data: Array.from(l.data),
        };
      } else {
        return {
          id: l.id,
          name: l.name,
          type: "entitylayer" as const,
          visible: l.visible,
          opacity: l.opacity,
          locked: l.locked,
          entities: l.entities.map((e) => ({ ...e })),
        };
      }
    }),
  };
}

// ============================================================
// Import
// ============================================================

export function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

export function loadImageFromFile(file: File): Promise<{ url: string; img: HTMLImageElement }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ url, img });
    img.onerror = reject;
    img.src = url;
  });
}

/** Import a bundle JSON — fully self-contained, returns everything needed */
export async function importBundle(
  json: TileMapBundleJson,
): Promise<{
  map: TileMap;
  tilesets: TileSet[];
  images: Map<string, HTMLImageElement>;
}> {
  const tilesets: TileSet[] = [];
  const images = new Map<string, HTMLImageElement>();
  const tilesetRefs: TileSetRef[] = [];

  for (const tsData of json.tilesets) {
    const img = await loadImageFromUrl(tsData.imageData);
    const ts = createTileSet(
      tsData.id, tsData.name, tsData.imageData,
      tsData.imageWidth, tsData.imageHeight,
      tsData.tileWidth, tsData.tileHeight,
      tsData.margin, tsData.spacing,
    );
    if (tsData.tileData) ts.tileData = tsData.tileData;
    tilesets.push(ts);
    images.set(ts.id, img);
    tilesetRefs.push({ tilesetId: ts.id, firstGid: tsData.firstGid });
  }

  const map: TileMap = {
    id: json.id,
    name: json.name,
    width: json.width,
    height: json.height,
    tileWidth: json.tileWidth,
    tileHeight: json.tileHeight,
    tilesets: tilesetRefs,
    layers: json.layers.map((l): MapLayer => {
      if (l.type === "entitylayer") {
        const el = l as ExportEntityLayer;
        return {
          type: "entity" as const,
          id: el.id,
          name: el.name,
          visible: el.visible,
          opacity: el.opacity,
          locked: el.locked,
          entities: el.entities.map((e) => ({ ...e })),
        };
      }
      const tl = l as ExportLayer;
      return {
        type: "tile" as const,
        id: tl.id,
        name: tl.name,
        visible: tl.visible,
        opacity: tl.opacity,
        locked: tl.locked,
        data: Array.from(tl.data),
      };
    }),
  };

  return { map, tilesets, images };
}

/** Import a standalone map JSON — may need external tileset files */
export function importStandaloneMap(
  json: TileMapStandaloneJson,
): {
  map: TileMap;
  missingTilesets: Array<{ source: string; firstGid: number }>;
} {
  const map: TileMap = {
    id: json.id,
    name: json.name,
    width: json.width,
    height: json.height,
    tileWidth: json.tileWidth,
    tileHeight: json.tileHeight,
    tilesets: [], // will be filled as tilesets are loaded
    layers: json.layers.map((l): MapLayer => {
      if (l.type === "entitylayer") {
        const el = l as ExportEntityLayer;
        return {
          type: "entity" as const,
          id: el.id,
          name: el.name,
          visible: el.visible,
          opacity: el.opacity,
          locked: el.locked,
          entities: el.entities.map((e) => ({ ...e })),
        };
      }
      const tl = l as ExportLayer;
      return {
        type: "tile" as const,
        id: tl.id,
        name: tl.name,
        visible: tl.visible,
        opacity: tl.opacity,
        locked: tl.locked,
        data: Array.from(tl.data),
      };
    }),
  };

  return {
    map,
    missingTilesets: json.tilesets.map((ref) => ({
      source: ref.source,
      firstGid: ref.firstGid,
    })),
  };
}

// ============================================================
// File utilities
// ============================================================

export function downloadJson(data: unknown, filename: string) {
  let json = JSON.stringify(data, null, 2);

  // Format layer data arrays: one row per map width for readability
  // Matches "data": [<numbers>] and reformats into rows
  const obj = data as any;
  if (obj && obj.width && obj.layers) {
    const w = obj.width as number;
    json = json.replace(
      /"data":\s*\[([\s\S]*?)\]/g,
      (_match: string, inner: string) => {
        const nums = inner.replace(/\s+/g, " ").trim().split(/,\s*/);
        const rows: string[] = [];
        const maxLen = nums.reduce((m: number, n: string) => Math.max(m, n.length), 0);
        for (let i = 0; i < nums.length; i += w) {
          // Right-align numbers for readability (pad to max digit width)
          const padded = nums.slice(i, i + w).map(n => n.padStart(maxLen, " "));
          rows.push("        " + padded.join(", "));
        }
        return `"data": [\n${rows.join(",\n")}\n      ]`;
      }
    );
  }

  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function readJsonFile(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result as string));
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

/** Detect import JSON type */
export function detectJsonType(
  json: any,
): "mote-tileset" | "mote-tilemap" | "mote-tilemap-bundle" | "unknown" {
  if (json?.type === "mote-tileset") return "mote-tileset";
  if (json?.type === "mote-tilemap") return "mote-tilemap";
  if (json?.type === "mote-tilemap-bundle") return "mote-tilemap-bundle";
  return "unknown";
}

```

<!-- src/data/SpriteAtlas.ts -->
<a id="src-data-SpriteAtlas_ts"></a>

## src/data/SpriteAtlas.ts

```ts
/**
 * SpriteAtlas — a collection of named sprite frames from one or more source images.
 *
 * Three import modes:
 *   1. Tile Sheet (grid)   — uniform grid, like existing TileSet but produces named frames
 *   2. Packed Atlas         — TexturePacker / ShoeBox JSON hash format
 *   3. Loose Files          — directory of individual PNG files (Kenney-style)
 */

/** A single sprite frame within an atlas */
export interface SpriteFrame {
  /** Unique frame ID within this atlas (e.g. "player_idle_0") */
  id: string;
  /** Human-readable name (often same as id, or filename without ext) */
  name: string;
  /** Source rectangle in the atlas image */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Optional: trimmed sprite data (from TexturePacker trim) */
  trimmed?: boolean;
  sourceWidth?: number;   // original untrimmed size
  sourceHeight?: number;
  offsetX?: number;       // trim offset from top-left
  offsetY?: number;
  /** Whether the frame is rotated 90° CW in the atlas (TexturePacker) */
  rotated?: boolean;
  /** Tags for grouping (e.g. "idle", "walk", "attack") */
  tags?: string[];
}

/** Import source mode — how was this atlas created */
export type AtlasSourceType = "tilesheet" | "packed" | "loose";

/** The SpriteAtlas — references one image and contains named frames */
export interface SpriteAtlas {
  id: string;
  name: string;
  /** How this atlas was imported */
  sourceType: AtlasSourceType;
  /** Image URL (ObjectURL or data URL) */
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  /** All frames in this atlas */
  frames: SpriteFrame[];
  /** Frame lookup by ID (built at import time) */
  frameMap: Map<string, SpriteFrame>;
}

// ============================================================
// Factory helpers
// ============================================================

/** Create a SpriteAtlas from a grid tile sheet */
export function createAtlasFromGrid(
  id: string,
  name: string,
  imageUrl: string,
  imageWidth: number,
  imageHeight: number,
  tileWidth: number,
  tileHeight: number,
  margin = 0,
  spacing = 0,
  prefix = "",
): SpriteAtlas {
  const columns = Math.floor(
    (imageWidth - margin * 2 + spacing) / (tileWidth + spacing)
  );
  const rows = Math.floor(
    (imageHeight - margin * 2 + spacing) / (tileHeight + spacing)
  );

  const frames: SpriteFrame[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const idx = row * columns + col;
      const frameId = prefix ? `${prefix}_${idx}` : `frame_${idx}`;
      frames.push({
        id: frameId,
        name: frameId,
        x: margin + col * (tileWidth + spacing),
        y: margin + row * (tileHeight + spacing),
        width: tileWidth,
        height: tileHeight,
      });
    }
  }

  return buildAtlas(id, name, "tilesheet", imageUrl, imageWidth, imageHeight, frames);
}

/** Create a SpriteAtlas from TexturePacker JSON hash format */
export function createAtlasFromPackedJson(
  id: string,
  name: string,
  imageUrl: string,
  jsonData: TexturePackerJson,
): SpriteAtlas {
  const meta = jsonData.meta;
  const frames: SpriteFrame[] = [];

  for (const [key, val] of Object.entries(jsonData.frames)) {
    const frameName = key.replace(/\.[^.]+$/, ""); // strip extension
    frames.push({
      id: frameName,
      name: frameName,
      x: val.frame.x,
      y: val.frame.y,
      width: val.rotated ? val.frame.h : val.frame.w,
      height: val.rotated ? val.frame.w : val.frame.h,
      trimmed: val.trimmed,
      sourceWidth: val.sourceSize.w,
      sourceHeight: val.sourceSize.h,
      offsetX: val.spriteSourceSize?.x ?? 0,
      offsetY: val.spriteSourceSize?.y ?? 0,
      rotated: val.rotated,
    });
  }

  return buildAtlas(id, name, "packed", imageUrl, meta.size.w, meta.size.h, frames);
}

/** Create a SpriteAtlas from loose individual images packed into a runtime canvas */
export function createAtlasFromLooseFrames(
  id: string,
  name: string,
  imageUrl: string,
  imageWidth: number,
  imageHeight: number,
  frames: SpriteFrame[],
): SpriteAtlas {
  return buildAtlas(id, name, "loose", imageUrl, imageWidth, imageHeight, frames);
}

/** Internal: build atlas with frameMap */
function buildAtlas(
  id: string,
  name: string,
  sourceType: AtlasSourceType,
  imageUrl: string,
  imageWidth: number,
  imageHeight: number,
  frames: SpriteFrame[],
): SpriteAtlas {
  const frameMap = new Map<string, SpriteFrame>();
  for (const f of frames) {
    frameMap.set(f.id, f);
  }
  return { id, name, sourceType, imageUrl, imageWidth, imageHeight, frames, frameMap };
}

// ============================================================
// TexturePacker JSON format types
// ============================================================

export interface TexturePackerJson {
  frames: Record<string, TexturePackerFrame>;
  meta: {
    app: string;
    version: string;
    image: string;
    format: string;
    size: { w: number; h: number };
    scale: string;
  };
}

export interface TexturePackerFrame {
  frame: { x: number; y: number; w: number; h: number };
  rotated: boolean;
  trimmed: boolean;
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
}


// ============================================================
// XML Sparrow / Starling format types & parser
// ============================================================

export interface SparrowXmlData {
  imagePath: string;
  subtextures: Array<{
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}

/** Parse a TextureAtlas XML string (Sparrow / Starling format) */
export function parseSparrowXml(xmlText: string): SparrowXmlData {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  const root = doc.documentElement;

  if (root.tagName !== "TextureAtlas") {
    throw new Error("Invalid Sparrow XML: root element must be <TextureAtlas>");
  }

  const imagePath = root.getAttribute("imagePath") ?? "";
  const subtextures: SparrowXmlData["subtextures"] = [];

  const nodes = root.querySelectorAll("SubTexture");
  for (const node of Array.from(nodes)) {
    const name = node.getAttribute("name") ?? "";
    const x = parseInt(node.getAttribute("x") ?? "0");
    const y = parseInt(node.getAttribute("y") ?? "0");
    const width = parseInt(node.getAttribute("width") ?? "0");
    const height = parseInt(node.getAttribute("height") ?? "0");
    if (name && width > 0 && height > 0) {
      subtextures.push({ name, x, y, width, height });
    }
  }

  return { imagePath, subtextures };
}

/** Create a SpriteAtlas from parsed Sparrow XML data */
export function createAtlasFromSparrowXml(
  id: string,
  name: string,
  imageUrl: string,
  imageWidth: number,
  imageHeight: number,
  xmlData: SparrowXmlData,
): SpriteAtlas {
  const frames: SpriteFrame[] = xmlData.subtextures.map((st) => ({
    id: st.name.replace(/\.[^.]+$/, ""),
    name: st.name.replace(/\.[^.]+$/, ""),
    x: st.x,
    y: st.y,
    width: st.width,
    height: st.height,
  }));

  return buildAtlas(id, name, "packed", imageUrl, imageWidth, imageHeight, frames);
}

// ============================================================
// Loose files packing — pack individual images into a single atlas texture
// ============================================================

interface PackRect {
  id: string;
  name: string;
  width: number;
  height: number;
  img: HTMLImageElement;
}

interface PackedRect extends PackRect {
  x: number;
  y: number;
}

/**
 * Pack loose image files into a single atlas canvas.
 * Uses a simple shelf-packing algorithm.
 * Returns: { canvas, frames } where canvas is the packed atlas and frames are the sprite rects.
 */
export function packLooseImages(
  images: Array<{ name: string; img: HTMLImageElement }>,
  padding = 1,
): { canvas: HTMLCanvasElement; frames: SpriteFrame[] } {
  // Sort by height descending for better packing
  const rects: PackRect[] = images.map((im) => ({
    id: im.name.replace(/\.[^.]+$/, ""),
    name: im.name.replace(/\.[^.]+$/, ""),
    width: im.img.naturalWidth,
    height: im.img.naturalHeight,
    img: im.img,
  }));
  rects.sort((a, b) => b.height - a.height);

  // Calculate atlas size (power of 2)
  const totalArea = rects.reduce(
    (sum, r) => sum + (r.width + padding) * (r.height + padding),
    0
  );
  let atlasSize = 256;
  while (atlasSize * atlasSize < totalArea * 1.2) {
    atlasSize *= 2;
    if (atlasSize > 4096) break;
  }

  // Shelf packing
  const packed: PackedRect[] = [];
  let shelfY = 0;
  let shelfX = 0;
  let shelfHeight = 0;

  for (const rect of rects) {
    if (shelfX + rect.width + padding > atlasSize) {
      // New shelf
      shelfY += shelfHeight + padding;
      shelfX = 0;
      shelfHeight = 0;
    }
    // Check if we need to grow vertically
    if (shelfY + rect.height + padding > atlasSize) {
      atlasSize *= 2;
      if (atlasSize > 8192) atlasSize = 8192;
    }
    packed.push({ ...rect, x: shelfX, y: shelfY });
    shelfX += rect.width + padding;
    shelfHeight = Math.max(shelfHeight, rect.height);
  }

  const finalHeight = shelfY + shelfHeight + padding;

  // Draw onto canvas
  const canvas = document.createElement("canvas");
  canvas.width = atlasSize;
  canvas.height = Math.min(finalHeight, atlasSize);
  const ctx = canvas.getContext("2d")!;

  const frames: SpriteFrame[] = [];
  for (const p of packed) {
    ctx.drawImage(p.img, p.x, p.y);
    frames.push({
      id: p.id,
      name: p.name,
      x: p.x,
      y: p.y,
      width: p.width,
      height: p.height,
    });
  }

  return { canvas, frames };
}

```

<!-- src/data/TileMap.ts -->
<a id="src-data-TileMap_ts"></a>

## src/data/TileMap.ts

```ts
export interface TileSetRef {
  tilesetId: string;
  firstGid: number;
}

/* ── Layer base fields (shared by all layer types) ─────────── */

interface LayerBase {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  locked: boolean;
  color?: string;
}

/* ── Tile Layer ────────────────────────────────────────────── */

export interface TileLayer extends LayerBase {
  type: "tile";
  data: number[];      // row-major, 0 = empty
}

/* ── Entity System ─────────────────────────────────────────── */

/** Field definition inside an EntityDef template */
export interface EntityFieldDef {
  id: string;
  label: string;
  type: "string" | "number" | "bool";
  default: string | number | boolean;
}

/** Entity Definition — template that defines what an entity type looks like */
export interface EntityDef {
  id: string;
  name: string;
  shape: "point" | "rect";
  color: string;           // hex color for viewport rendering
  icon: string;            // emoji or short label
  defaultWidth: number;    // pixels (used for rect shape)
  defaultHeight: number;
  resizable: boolean;      // whether instances can be resized
  fields: EntityFieldDef[];
  /** Optional: sprite atlas ID this entity uses */
  spriteAtlasId?: string;
  /** Optional: default sprite frame ID */
  spriteFrameId?: string;
}

/** A placed entity instance on the map */
export interface EntityInstance {
  id: string;
  defId: string;           // references EntityDef.id
  name: string;            // user-editable instance name
  x: number;               // pixel coordinate
  y: number;
  width: number;           // only meaningful for rect shape
  height: number;
  fieldValues: Record<string, string | number | boolean>;
  visible: boolean;
  /** Override sprite frame (if different from EntityDef default) */
  spriteFrameId?: string;
}

/** Entity Layer — contains placed entity instances */
export interface EntityLayer extends LayerBase {
  type: "entity";
  entities: EntityInstance[];
}

/* ── Union type for all layers ─────────────────────────────── */

export type MapLayer = TileLayer | EntityLayer;

/* ── Built-in Entity Definitions ───────────────────────────── */

export const BUILTIN_ENTITY_DEFS: EntityDef[] = [
  {
    id: "player_spawn",
    name: "Player Spawn",
    shape: "point",
    color: "#4a90d9",
    icon: "\u25C6",
    defaultWidth: 16,
    defaultHeight: 16,
    resizable: false,
    fields: [
      { id: "direction", label: "Direction", type: "string", default: "down" },
    ],
  },
  {
    id: "trigger_zone",
    name: "Trigger Zone",
    shape: "rect",
    color: "#e06060",
    icon: "!",
    defaultWidth: 48,
    defaultHeight: 48,
    resizable: true,
    fields: [
      { id: "event", label: "Event", type: "string", default: "" },
      { id: "once", label: "Once", type: "bool", default: true },
    ],
  },
  {
    id: "waypoint",
    name: "Waypoint",
    shape: "point",
    color: "#60b060",
    icon: "\u25CB",
    defaultWidth: 16,
    defaultHeight: 16,
    resizable: false,
    fields: [
      { id: "order", label: "Order", type: "number", default: 0 },
    ],
  },
];

/** Look up a built-in entity def by id */
export function getEntityDef(defId: string): EntityDef | undefined {
  return BUILTIN_ENTITY_DEFS.find((d) => d.id === defId);
}

/* ── TileMap ───────────────────────────────────────────────── */

export interface TileMap {
  id: string;
  name: string;
  width: number;       // columns
  height: number;      // rows
  tileWidth: number;   // render tile width (px)
  tileHeight: number;  // render tile height (px)
  tilesets: TileSetRef[];
  layers: MapLayer[];
}

export function createTileMap(
  id: string,
  name: string,
  width: number,
  height: number,
  tileWidth: number,
  tileHeight: number
): TileMap {
  return {
    id,
    name,
    width,
    height,
    tileWidth,
    tileHeight,
    tilesets: [],
    layers: [
      createTileLayer("layer_bg", "background", width, height),
      createTileLayer("layer_fg", "foreground", width, height),
    ],
  };
}

export function createTileLayer(
  id: string,
  name: string,
  width: number,
  height: number
): TileLayer {
  return {
    type: "tile",
    id,
    name,
    visible: true,
    opacity: 1,
    locked: false,
    data: new Array(width * height).fill(0),
  };
}

export function createEntityLayer(id: string, name: string): EntityLayer {
  return {
    type: "entity",
    id,
    name,
    visible: true,
    opacity: 1,
    locked: false,
    entities: [],
  };
}

/** Resolve GID -> tilesetId + localId */
export function resolveGid(
  map: TileMap,
  gid: number
): { tilesetId: string; localId: number } | null {
  if (gid <= 0) return null;
  let best: TileSetRef | null = null;
  for (const ref of map.tilesets) {
    if (ref.firstGid <= gid && (!best || ref.firstGid > best.firstGid)) {
      best = ref;
    }
  }
  if (!best) return null;
  return { tilesetId: best.tilesetId, localId: gid - best.firstGid };
}

/* ── Type guards ───────────────────────────────────────────── */

export function isTileLayer(layer: MapLayer): layer is TileLayer {
  return layer.type === "tile";
}

export function isEntityLayer(layer: MapLayer): layer is EntityLayer {
  return layer.type === "entity";
}

```

<!-- src/data/TileSet.ts -->
<a id="src-data-TileSet_ts"></a>

## src/data/TileSet.ts

```ts
export interface TileData {
  collision?: boolean;
  tags?: string[];
  animation?: { frames: number[]; duration: number };
  properties?: Record<string, unknown>;
}

export interface TileSet {
  id: string;
  name: string;
  imageUrl: string;        // ObjectURL or data URL
  imageWidth: number;
  imageHeight: number;
  tileWidth: number;
  tileHeight: number;
  margin: number;
  spacing: number;
  columns: number;
  rows: number;
  tileCount: number;
  tileData: Record<number, TileData>;
}

/** Calculate derived fields from image dimensions + tile config */
export function createTileSet(
  id: string,
  name: string,
  imageUrl: string,
  imageWidth: number,
  imageHeight: number,
  tileWidth: number,
  tileHeight: number,
  margin = 0,
  spacing = 0
): TileSet {
  const columns = Math.floor(
    (imageWidth - margin * 2 + spacing) / (tileWidth + spacing)
  );
  const rows = Math.floor(
    (imageHeight - margin * 2 + spacing) / (tileHeight + spacing)
  );
  return {
    id,
    name,
    imageUrl,
    imageWidth,
    imageHeight,
    tileWidth,
    tileHeight,
    margin,
    spacing,
    columns,
    rows,
    tileCount: columns * rows,
    tileData: {},
  };
}

/** Get the source rect of a tile in the spritesheet */
export function getTileSrcRect(
  ts: TileSet,
  localId: number
): { sx: number; sy: number; sw: number; sh: number } {
  const col = localId % ts.columns;
  const row = Math.floor(localId / ts.columns);
  return {
    sx: ts.margin + col * (ts.tileWidth + ts.spacing),
    sy: ts.margin + row * (ts.tileHeight + ts.spacing),
    sw: ts.tileWidth,
    sh: ts.tileHeight,
  };
}

```

<!-- src/editors/inspector/InspectorEditor.tsx -->
<a id="src-editors-inspector-InspectorEditor_tsx"></a>

## src/editors/inspector/InspectorEditor.tsx

```tsx
import { registerEditor } from "../registry";
import { MapPropsPanel } from "./panels/MapPropsPanel";
import { LayersPanel } from "./panels/LayersPanel";
import { ExportPanel } from "./panels/ExportPanel";
import { EntityPanel } from "./panels/EntityPanel";

function InspectorEditor({ areaId }: { areaId: string }) {
  return (
    <div style={{ height: "100%", overflow: "auto" }}>
      <MapPropsPanel />
      <LayersPanel />
      <EntityPanel />
      <ExportPanel />
    </div>
  );
}

registerEditor({
  id: "inspector",
  name: "属性",
  icon: "⚙",
  component: InspectorEditor,
});

export { InspectorEditor };

```

<!-- src/editors/inspector/panels/EntityPanel.tsx -->
<a id="src-editors-inspector-panels-EntityPanel_tsx"></a>

## src/editors/inspector/panels/EntityPanel.tsx

```tsx
import { useState } from "preact/hooks";
import { PanelShell } from "./PanelShell";
import { BUILTIN_ENTITY_DEFS, getEntityDef, isEntityLayer } from "../../../data/TileMap";
import type { EntityDef, EntityInstance } from "../../../data/TileMap";
import { activeEntityDefId, selectedEntityId, activeTool } from "../../../store/selection";
import { currentMap, activeLayer, activeLayerId } from "../../../store/project";
import { executeCommand } from "../../../store/history";
import { RemoveEntityCommand, SetEntityPropertyCommand } from "../../../commands/entity";
import { spriteAtlases, activeAtlasId } from "../../../store/atlas";

export function EntityPanel() {
  const layer = activeLayer.value;
  const isEntity = layer && isEntityLayer(layer);

  return (
    <PanelShell title="\u5b9e\u4f53" defaultOpen={true}>
      {/* EntityDef picker */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 4 }}>
          \u5b9e\u4f53\u7c7b\u578b (\u70b9\u51fb\u9009\u62e9\u540e\u5728\u89c6\u53e3\u653e\u7f6e)
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {BUILTIN_ENTITY_DEFS.map((def) => {
            const isActive = activeEntityDefId.value === def.id;
            return (
              <button
                key={def.id}
                onClick={() => {
                  activeEntityDefId.value = isActive ? null : def.id;
                  if (!isActive) activeTool.value = "entity";
                }}
                title={def.name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  padding: "3px 8px",
                  fontSize: 11,
                  border: isActive ? "1px solid var(--accent)" : "1px solid var(--border)",
                  borderRadius: 3,
                  background: isActive ? "var(--accent)" + "30" : "transparent",
                  color: isActive ? "var(--text-bright)" : "var(--text-primary)",
                  cursor: "pointer",
                }}
              >
                <span style={{ color: def.color }}>{def.icon}</span>
                {def.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected entity inspector */}
      <SelectedEntityInspector />
    </PanelShell>
  );
}

function SelectedEntityInspector() {
  const entId = selectedEntityId.value;
  if (!entId) return null;

  // Find the entity across all layers
  const map = currentMap.value;
  let foundEntity: EntityInstance | null = null;
  let foundLayerId: string | null = null;
  for (const layer of map.layers) {
    if (!isEntityLayer(layer)) continue;
    const ent = layer.entities.find((e) => e.id === entId);
    if (ent) {
      foundEntity = ent;
      foundLayerId = layer.id;
      break;
    }
  }

  if (!foundEntity || !foundLayerId) {
    return (
      <div style={{ fontSize: 10, color: "var(--text-secondary)", fontStyle: "italic" }}>
        \u672a\u9009\u4e2d\u5b9e\u4f53
      </div>
    );
  }

  const def = getEntityDef(foundEntity.defId);
  const entity = foundEntity;
  const layerId = foundLayerId;

  const fieldRow = (label: string, value: string, onChange: (v: string) => void) => (
    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
      <span style={{ fontSize: 10, color: "var(--text-secondary)", width: 36, flexShrink: 0 }}>
        {label}
      </span>
      <input
        type="text"
        value={value}
        onInput={(e) => onChange((e.target as HTMLInputElement).value)}
        style={{
          flex: 1, fontSize: 11, height: 20, padding: "0 4px",
          border: "1px solid var(--border)", borderRadius: 2,
          background: "var(--bg-input)", color: "var(--text-bright)",
          outline: "none", minWidth: 0,
        }}
      />
    </div>
  );

  const numFieldRow = (label: string, value: number, onChange: (v: number) => void) => (
    <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 3 }}>
      <span style={{ fontSize: 10, color: "var(--text-secondary)", width: 36, flexShrink: 0 }}>
        {label}
      </span>
      <input
        type="number"
        value={value}
        onInput={(e) => {
          const v = parseInt((e.target as HTMLInputElement).value);
          if (!isNaN(v)) onChange(v);
        }}
        style={{
          flex: 1, fontSize: 11, height: 20, padding: "0 4px",
          border: "1px solid var(--border)", borderRadius: 2,
          background: "var(--bg-input)", color: "var(--text-bright)",
          outline: "none", minWidth: 0,
        }}
      />
    </div>
  );

  return (
    <div style={{ borderTop: "1px solid var(--border)", paddingTop: 6 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 600, color: "var(--text-bright)" }}>
          <span style={{ color: def?.color ?? "#888" }}>{def?.icon ?? "?"}</span>{" "}
          {def?.name ?? entity.defId}
        </span>
        <button
          onClick={() => {
            executeCommand(new RemoveEntityCommand(layerId, entity.id));
            selectedEntityId.value = null;
          }}
          title="\u5220\u9664\u5b9e\u4f53"
          style={{
            background: "transparent", border: "none", cursor: "pointer",
            color: "var(--text-secondary)", fontSize: 11, padding: "0 4px",
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#e06060"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
        >
          \u2715
        </button>
      </div>

      {fieldRow("\u540d\u79f0", entity.name, (v) => {
        executeCommand(new SetEntityPropertyCommand(layerId, entity.id, "name", v, "\u91cd\u547d\u540d\u5b9e\u4f53"));
      })}

      {numFieldRow("X", entity.x, (v) => {
        executeCommand(new SetEntityPropertyCommand(layerId, entity.id, "x", v, "\u8bbe\u7f6e\u5b9e\u4f53 X"));
      })}

      {numFieldRow("Y", entity.y, (v) => {
        executeCommand(new SetEntityPropertyCommand(layerId, entity.id, "y", v, "\u8bbe\u7f6e\u5b9e\u4f53 Y"));
      })}

      {def?.shape === "rect" && def.resizable && (
        <>
          {numFieldRow("W", entity.width, (v) => {
            executeCommand(new SetEntityPropertyCommand(layerId, entity.id, "width", v, "\u8bbe\u7f6e\u5b9e\u4f53\u5bbd\u5ea6"));
          })}
          {numFieldRow("H", entity.height, (v) => {
            executeCommand(new SetEntityPropertyCommand(layerId, entity.id, "height", v, "\u8bbe\u7f6e\u5b9e\u4f53\u9ad8\u5ea6"));
          })}
        </>
      )}

      {/* Sprite frame override */}
      {def?.spriteAtlasId && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 2 }}>
            Sprite Frame
          </div>
          {fieldRow("Frame", entity.spriteFrameId ?? def.spriteFrameId ?? "", (v) => {
            executeCommand(new SetEntityPropertyCommand(layerId, entity.id, "spriteFrameId", v || undefined, "\u8bbe\u7f6e\u7cbe\u7075\u5e27"));
          })}
        </div>
      )}

      {/* Custom fields */}
      {def && def.fields.length > 0 && (
        <div style={{ marginTop: 4 }}>
          <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 2 }}>
            \u81ea\u5b9a\u4e49\u5b57\u6bb5
          </div>
          {def.fields.map((field) => {
            const val = entity.fieldValues[field.id] ?? field.default;
            return fieldRow(field.label, String(val), (v) => {
              let parsed: string | number | boolean = v;
              if (field.type === "number") parsed = parseFloat(v) || 0;
              if (field.type === "bool") parsed = v === "true";
              const newFieldValues = { ...entity.fieldValues, [field.id]: parsed };
              executeCommand(
                new SetEntityPropertyCommand(layerId, entity.id, "fieldValues", newFieldValues, `\u8bbe\u7f6e ${field.label}`)
              );
            });
          })}
        </div>
      )}
    </div>
  );
}

```

<!-- src/editors/inspector/panels/ExportPanel.tsx -->
<a id="src-editors-inspector-panels-ExportPanel_tsx"></a>

## src/editors/inspector/panels/ExportPanel.tsx

```tsx
import { useRef } from "preact/hooks";
import { currentMap, tilesets, tilesetImages, importTileMapFromFile } from "../../../store/project";
import { exportStandalone, exportBundle } from "../../../data/export";
import { PanelShell } from "./PanelShell";

export function ExportPanel() {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExportStandalone = () => {
    exportStandalone(currentMap.value, tilesets.value);
  };

  const handleExportBundle = () => {
    exportBundle(currentMap.value, tilesets.value, tilesetImages.value);
  };

  const handleImport = () => {
    fileRef.current?.click();
  };

  const handleFile = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      await importTileMapFromFile(file);
    } catch (err) {
      console.error("Import failed:", err);
      alert("导入失败: " + (err as Error).message);
    }
    (e.target as HTMLInputElement).value = "";
  };

  return (
    <PanelShell title="导入/导出">
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ color: "var(--text-secondary)", fontSize: 10, marginBottom: 2 }}>
          导出为 .mote.json (引用外部 TileSet) 或 .mote-bundle.json (自包含)
        </div>

        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={handleExportStandalone} style={{ flex: 1, fontSize: 10 }}>
            导出 (引用)
          </button>
          <button onClick={handleExportBundle} style={{ flex: 1, fontSize: 10 }}>
            导出 (打包)
          </button>
        </div>

        <div style={{
          borderTop: "1px solid var(--border)",
          paddingTop: 6,
          marginTop: 4,
        }}>
          <div style={{ color: "var(--text-secondary)", fontSize: 10, marginBottom: 4 }}>
            导入 .mote.json 或 .mote-bundle.json 地图文件
          </div>
          <button onClick={handleImport} style={{ width: "100%", fontSize: 10 }}>
            导入地图
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".json"
          style={{ display: "none" }}
          onChange={handleFile}
        />
      </div>
    </PanelShell>
  );
}

```

<!-- src/editors/inspector/panels/LayersPanel.tsx -->
<a id="src-editors-inspector-panels-LayersPanel_tsx"></a>

## src/editors/inspector/panels/LayersPanel.tsx

```tsx
import { useState, useRef, useCallback } from "preact/hooks";
import {
  currentMap,
  activeLayerId,
  bumpMapVersion,
} from "../../../store/project";
import { executeCommand } from "../../../store/history";
import {
  AddLayerCommand,
  RemoveLayerCommand,
  SetLayerPropertyCommand,
} from "../../../commands/layer";
import { createTileLayer, createEntityLayer, isTileLayer, isEntityLayer } from "../../../data/TileMap";
import { PanelShell } from "./PanelShell";

let layerUid = 10;

export function LayersPanel() {
  const map = currentMap.value;
  const selectedLayer =
    map.layers.find((l) => l.id === activeLayerId.value) ?? map.layers[0];

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [insertIdx, setInsertIdx] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [showAddMenu, setShowAddMenu] = useState(false);

  const addTileLayer = () => {
    const id = `layer_${++layerUid}`;
    const newLayer = createTileLayer(id, `tile_${map.layers.length + 1}`, map.width, map.height);
    executeCommand(new AddLayerCommand(newLayer));
    setShowAddMenu(false);
  };

  const addEntityLayer = () => {
    const id = `layer_${++layerUid}`;
    const newLayer = createEntityLayer(id, `entity_${map.layers.length + 1}`);
    executeCommand(new AddLayerCommand(newLayer));
    setShowAddMenu(false);
  };

  const removeLayer = (id: string) => {
    if (map.layers.length <= 1) return;
    executeCommand(new RemoveLayerCommand(id));
  };

  const toggleVisible = (id: string) => {
    const layer = map.layers.find((l) => l.id === id);
    if (!layer) return;
    executeCommand(
      new SetLayerPropertyCommand(id, "visible", !layer.visible, "切换图层可见性")
    );
  };

  const toggleLock = (id: string) => {
    const layer = map.layers.find((l) => l.id === id);
    if (!layer) return;
    executeCommand(
      new SetLayerPropertyCommand(id, "locked", !layer.locked, "切换图层锁定")
    );
  };

  const startRename = (id: string, currentName: string) => {
    setRenamingId(id);
    setRenameValue(currentName);
    requestAnimationFrame(() => renameRef.current?.select());
  };

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      executeCommand(
        new SetLayerPropertyCommand(renamingId, "name", renameValue.trim(), "重命名图层")
      );
    }
    setRenamingId(null);
  };

  const displayLayers = [...map.layers].reverse();

  /* Pointer-event drag reorder */
  const onRowPointerDown = useCallback(
    (e: PointerEvent, layerId: string) => {
      if (e.button !== 0) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "BUTTON" || tag === "INPUT") return;

      const startY = e.clientY;
      let started = false;
      let currentInsert: number | null = null;
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        const dy = ev.clientY - startY;
        if (!started && Math.abs(dy) > 4) {
          started = true;
          setDragId(layerId);
        }
        if (!started || !listRef.current) return;

        const children = Array.from(listRef.current.children) as HTMLElement[];
        let bestIdx = displayLayers.length;
        for (let i = 0; i < children.length; i++) {
          const rect = children[i].getBoundingClientRect();
          const mid = rect.top + rect.height / 2;
          if (ev.clientY < mid) {
            bestIdx = i;
            break;
          }
        }
        const realInsert = map.layers.length - bestIdx;
        currentInsert = realInsert;
        setInsertIdx(realInsert);
      };

      const onUp = () => {
        target.removeEventListener("pointermove", onMove);
        target.removeEventListener("pointerup", onUp);

        if (started && currentInsert !== null) {
          const fromDisplayIdx = displayLayers.findIndex((l) => l.id === layerId);
          const fromRealIdx = map.layers.length - 1 - fromDisplayIdx;
          let targetIdx = currentInsert;
          if (targetIdx > fromRealIdx) targetIdx--;
          if (targetIdx !== fromRealIdx && targetIdx >= 0 && targetIdx < map.layers.length) {
            const newLayers = [...map.layers];
            const [removed] = newLayers.splice(fromRealIdx, 1);
            newLayers.splice(targetIdx, 0, removed);
            currentMap.value = { ...map, layers: newLayers };
            bumpMapVersion();
          }
        }
        setDragId(null);
        setInsertIdx(null);
      };

      target.addEventListener("pointermove", onMove);
      target.addEventListener("pointerup", onUp);
    },
    [displayLayers, map]
  );

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      if (renamingId) return;
      if (selectedLayer && map.layers.length > 1) removeLayer(selectedLayer.id);
    }
    if (e.key === "F2" && selectedLayer && !renamingId) {
      startRename(selectedLayer.id, selectedLayer.name);
    }
  };

  const insertDisplayIdx =
    insertIdx !== null ? map.layers.length - insertIdx : null;

  const addBtn = (
    <div style={{ position: "relative" }}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowAddMenu(!showAddMenu);
        }}
        title="添加图层"
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "var(--text-secondary)",
          fontSize: 14,
          padding: "0 4px",
          lineHeight: 1,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.color = "var(--text-bright)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
        }}
      >
        ＋
      </button>
      {showAddMenu && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            zIndex: 100,
            background: "var(--bg-panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: "2px 0",
            minWidth: 120,
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          }}
          onMouseLeave={() => setShowAddMenu(false)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); addTileLayer(); }}
            style={{
              display: "block", width: "100%", textAlign: "left",
              background: "transparent", border: "none", cursor: "pointer",
              color: "var(--text-primary)", fontSize: 11, padding: "4px 10px",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--selection)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            ▦ Tile Layer
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); addEntityLayer(); }}
            style={{
              display: "block", width: "100%", textAlign: "left",
              background: "transparent", border: "none", cursor: "pointer",
              color: "var(--text-primary)", fontSize: 11, padding: "4px 10px",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--selection)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            ◇ Entity Layer
          </button>
        </div>
      )}
    </div>
  );

  return (
    <PanelShell title="图层" headerRight={addBtn}>
      <div tabIndex={0} onKeyDown={onKeyDown} style={{ outline: "none" }}>
        <div
          ref={listRef}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 0,
            position: "relative",
          }}
        >
          {displayLayers.map((layer, displayIdx) => {
            const isSelected = activeLayerId.value === layer.id;
            const isDragging = dragId === layer.id;
            const isHovered = hoverId === layer.id;
            const showInsertBefore =
              insertDisplayIdx === displayIdx && dragId !== null && dragId !== layer.id;
            const showInsertAfter =
              insertDisplayIdx === displayLayers.length &&
              displayIdx === displayLayers.length - 1 &&
              dragId !== null &&
              dragId !== layer.id;

            return (
              <div key={layer.id}>
                {showInsertBefore && (
                  <div
                    style={{
                      height: 2,
                      background: "var(--accent)",
                      borderRadius: 1,
                      margin: "0 4px",
                    }}
                  />
                )}

                <div
                  onPointerDown={(e) => onRowPointerDown(e as any, layer.id)}
                  onClick={() => { activeLayerId.value = layer.id; }}
                  onMouseEnter={() => setHoverId(layer.id)}
                  onMouseLeave={() => setHoverId(null)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    height: 28,
                    padding: "0 4px",
                    gap: 4,
                    background: isSelected
                      ? "var(--selection)"
                      : isHovered && !isDragging
                      ? "rgba(255,255,255,0.04)"
                      : "transparent",
                    borderLeft: isSelected
                      ? "2px solid var(--accent)"
                      : "2px solid transparent",
                    borderRadius: 2,
                    cursor: "grab",
                    opacity: isDragging ? 0.3 : 1,
                    transition: "background 0.1s, opacity 0.1s",
                    userSelect: "none",
                  }}
                >
                  {/* Visibility */}
                  <button
                    title={layer.visible ? "隐藏" : "显示"}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleVisible(layer.id);
                    }}
                    style={{
                      border: "none", background: "transparent",
                      padding: "0 1px", cursor: "pointer",
                      opacity: layer.visible ? 0.9 : 0.25,
                      fontSize: 11, width: 20, height: 20,
                      flexShrink: 0, lineHeight: "20px", textAlign: "center",
                    }}
                  >
                    👁
                  </button>

                  {/* Lock */}
                  <button
                    title={layer.locked ? "解锁" : "锁定"}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleLock(layer.id);
                    }}
                    style={{
                      background: layer.locked ? "var(--accent)" : "transparent",
                      border: layer.locked
                        ? "1px solid var(--accent)"
                        : "1px solid var(--border)",
                      borderRadius: 3,
                      padding: "1px 5px",
                      cursor: "pointer",
                      fontSize: 12,
                      lineHeight: 1,
                      color: layer.locked ? "#fff" : "var(--text-secondary)",
                      width: 24, height: 20, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {layer.locked ? "🔒" : "🔓"}
                  </button>

                  {/* Type icon */}
                  <span
                    title={isTileLayer(layer) ? "Tile Layer" : "Entity Layer"}
                    style={{
                      fontSize: 9,
                      color: isEntityLayer(layer) ? "#e0a040" : "var(--text-secondary)",
                      flexShrink: 0,
                      width: 14,
                      textAlign: "center",
                      opacity: 0.7,
                    }}
                  >
                    {isTileLayer(layer) ? "▦" : "◇"}
                  </span>

                  {/* Name */}
                  {renamingId === layer.id ? (
                    <input
                      ref={renameRef}
                      type="text"
                      value={renameValue}
                      onInput={(e) =>
                        setRenameValue((e.target as HTMLInputElement).value)
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename();
                        if (e.key === "Escape") setRenamingId(null);
                        e.stopPropagation();
                      }}
                      onBlur={commitRename}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        flex: 1, minWidth: 0, fontSize: 11, height: 18,
                        padding: "0 3px",
                        border: "1px solid var(--accent)", borderRadius: 2,
                        background: "var(--bg-input)", color: "var(--text-bright)",
                        outline: "none",
                      }}
                    />
                  ) : (
                    <span
                      onDblClick={(e) => {
                        e.stopPropagation();
                        startRename(layer.id, layer.name);
                      }}
                      style={{
                        flex: 1, overflow: "hidden",
                        textOverflow: "ellipsis", whiteSpace: "nowrap",
                        fontSize: 11, cursor: "default",
                      }}
                    >
                      {layer.name}
                    </span>
                  )}

                  {/* Delete */}
                  <button
                    title="删除图层 (Delete)"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeLayer(layer.id);
                    }}
                    style={{
                      border: "none",
                      background: "transparent",
                      cursor: map.layers.length <= 1 ? "default" : "pointer",
                      fontSize: 10,
                      width: 18,
                      height: 18,
                      flexShrink: 0,
                      lineHeight: "18px",
                      textAlign: "center",
                      color: "var(--text-secondary)",
                      opacity: (isHovered || isSelected) && map.layers.length > 1 ? 0.7 : 0,
                      transition: "opacity 0.15s",
                      padding: 0,
                      borderRadius: 2,
                    }}
                    onMouseEnter={(e) => {
                      if (map.layers.length > 1)
                        (e.currentTarget as HTMLElement).style.color = "#e06060";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
                    }}
                  >
                    ✕
                  </button>
                </div>

                {showInsertAfter && (
                  <div
                    style={{
                      height: 2,
                      background: "var(--accent)",
                      borderRadius: 1,
                      margin: "0 4px",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </PanelShell>
  );
}

```

<!-- src/editors/inspector/panels/MapPropsPanel.tsx -->
<a id="src-editors-inspector-panels-MapPropsPanel_tsx"></a>

## src/editors/inspector/panels/MapPropsPanel.tsx

```tsx
import { currentMap, bumpMapVersion } from "../../../store/project";
import { executeCommand } from "../../../store/history";
import { SetMapNameCommand, ResizeMapCommand } from "../../../commands/map-props";
import { PanelShell } from "./PanelShell";

export function MapPropsPanel() {
  const map = currentMap.value;

  return (
    <PanelShell title="地图属性">
      <Row label="名称">
        <input
          type="text"
          value={map.name}
          onChange={(e) => {
            const name = (e.target as HTMLInputElement).value;
            executeCommand(new SetMapNameCommand(name));
          }}
          style={{ width: "100%" }}
        />
      </Row>
      <Row label="尺寸">
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <input
            type="number"
            value={map.width}
            min={1}
            max={500}
            style={{ width: 50 }}
            onChange={(e) => {
              const w = parseInt((e.target as HTMLInputElement).value) || 1;
              if (w !== map.width) {
                executeCommand(new ResizeMapCommand(w, map.height));
              }
            }}
          />
          <span>×</span>
          <input
            type="number"
            value={map.height}
            min={1}
            max={500}
            style={{ width: 50 }}
            onChange={(e) => {
              const h = parseInt((e.target as HTMLInputElement).value) || 1;
              if (h !== map.height) {
                executeCommand(new ResizeMapCommand(map.width, h));
              }
            }}
          />
          <span style={{ color: "var(--text-secondary)" }}>瓦片</span>
        </div>
      </Row>
      <Row label="瓦片大小">
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <input
            type="number"
            value={map.tileWidth}
            min={1}
            max={256}
            style={{ width: 50 }}
            onChange={(e) => {
              currentMap.value = {
                ...map,
                tileWidth:
                  parseInt((e.target as HTMLInputElement).value) || 16,
              };
              bumpMapVersion();
            }}
          />
          <span>×</span>
          <input
            type="number"
            value={map.tileHeight}
            min={1}
            max={256}
            style={{ width: 50 }}
            onChange={(e) => {
              currentMap.value = {
                ...map,
                tileHeight:
                  parseInt((e.target as HTMLInputElement).value) || 16,
              };
              bumpMapVersion();
            }}
          />
          <span style={{ color: "var(--text-secondary)" }}>px</span>
        </div>
      </Row>
    </PanelShell>
  );
}

function Row({ label, children }: { label: string; children: any }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        marginBottom: 4,
        gap: 8,
      }}
    >
      <span
        style={{
          width: 56,
          flexShrink: 0,
          color: "var(--text-secondary)",
          fontSize: 11,
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

```

<!-- src/editors/inspector/panels/PanelShell.tsx -->
<a id="src-editors-inspector-panels-PanelShell_tsx"></a>

## src/editors/inspector/panels/PanelShell.tsx

```tsx
import { useState } from "preact/hooks";
import type { ComponentChildren, VNode } from "preact";

interface Props {
  title: string;
  defaultOpen?: boolean;
  /** Optional element rendered at the right side of the header bar */
  headerRight?: VNode | null;
  children: ComponentChildren;
}

export function PanelShell({
  title,
  defaultOpen = true,
  headerRight,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{ borderBottom: "1px solid var(--border)" }}>
      <div
        style={{
          height: 26,
          background: "var(--panel-header)",
          display: "flex",
          alignItems: "center",
          padding: "0 8px",
          fontWeight: 500,
          fontSize: 11,
          color: "var(--text-bright)",
        }}
      >
        <div
          onClick={() => setOpen(!open)}
          style={{
            display: "flex",
            alignItems: "center",
            flex: 1,
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          <span style={{ marginRight: 6, fontSize: 9 }}>
            {open ? "\u25BC" : "\u25B6"}
          </span>
          {title}
        </div>
        {headerRight && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ display: "flex", alignItems: "center" }}
          >
            {headerRight}
          </div>
        )}
      </div>
      {open && <div style={{ padding: "6px 10px" }}>{children}</div>}
    </div>
  );
}

```

<!-- src/editors/inspector/register.ts -->
<a id="src-editors-inspector-register_ts"></a>

## src/editors/inspector/register.ts

```ts
// Side-effect import: triggers registerEditor inside InspectorEditor
import './InspectorEditor';

```

<!-- src/editors/registry.ts -->
<a id="src-editors-registry_ts"></a>

## src/editors/registry.ts

```ts
import { ComponentType } from 'preact';

export interface EditorDef {
  id: string;
  name: string;
  icon: string;
  component: ComponentType<{ areaId: string }>;
}

const editors = new Map<string, EditorDef>();

export function registerEditor(def: EditorDef) {
  editors.set(def.id, def);
}

export function getEditor(id: string): EditorDef | undefined {
  return editors.get(id);
}

export function getAllEditors(): EditorDef[] {
  return Array.from(editors.values());
}

```

<!-- src/editors/sprite-panel/register.ts -->
<a id="src-editors-sprite-panel-register_ts"></a>

## src/editors/sprite-panel/register.ts

```ts
// Side-effect: registers the sprite-panel editor type
import "./SpritePanelEditor";

```

<!-- src/editors/sprite-panel/SpritePanelCanvas.tsx -->
<a id="src-editors-sprite-panel-SpritePanelCanvas_tsx"></a>

## src/editors/sprite-panel/SpritePanelCanvas.tsx

```tsx
import { useRef, useEffect, useCallback, useState } from "preact/hooks";
import { signal } from "@preact/signals";
import {
  spriteAtlases,
  atlasImages,
  activeAtlasId,
  activeFrameId,
  activeAtlas,
} from "../../store/atlas";
import { activeEntityDefId } from "../../store/selection";
import type { SpriteAtlas, SpriteFrame } from "../../data/SpriteAtlas";

// ---- Internal signals for canvas state ----
const panelCam = signal({ x: 0, y: 0 });
const panelZoom = signal(1);

/** Search / filter term */
export const spriteFilterText = signal("");

interface Props {
  /** Callback when a frame is selected */
  onFrameSelect?: (frame: SpriteFrame) => void;
}

export function SpritePanelCanvas({ onFrameSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoverIdx = useRef<number>(-1);
  const [tooltip, setTooltip] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);

  // ---- Derived data ----
  const getFilteredFrames = useCallback((): SpriteFrame[] => {
    const atlas = activeAtlas.value;
    if (!atlas) return [];
    const q = spriteFilterText.value.toLowerCase().trim();
    if (!q) return atlas.frames;
    return atlas.frames.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.id.toLowerCase().includes(q) ||
        (f.tags && f.tags.some((t) => t.toLowerCase().includes(q)))
    );
  }, []);

  /** Compute grid layout parameters based on container width */
  const getGridLayout = useCallback(
    (
      containerW: number,
      frames: SpriteFrame[]
    ): {
      cols: number;
      cellSize: number;
      thumbSize: number;
      padding: number;
      rows: number;
    } => {
      const zoom = panelZoom.value;
      const baseCellSize = 64;
      const cellSize = Math.max(32, Math.round(baseCellSize * zoom));
      const padding = 4;
      const cols = Math.max(1, Math.floor((containerW + padding) / (cellSize + padding)));
      const rows = Math.ceil(frames.length / cols);
      const thumbSize = cellSize - 8; // inner thumbnail with padding
      return { cols, cellSize, thumbSize, padding, rows };
    },
    []
  );

  // ---- Drawing ----
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const atlas = activeAtlas.value;
    const img = atlas ? atlasImages.value.get(atlas.id) : null;
    const frames = getFilteredFrames();
    const cam = panelCam.value;

    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = container.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;

    if (!atlas) {
      ctx.fillStyle = "#888";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("在检查器面板中导入 Sprite Atlas", w / 2, h / 2);
      return;
    }

    if (frames.length === 0) {
      ctx.fillStyle = "#888";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        spriteFilterText.value ? "未找到匹配帧" : "图集无帧",
        w / 2,
        h / 2
      );
      return;
    }

    const { cols, cellSize, thumbSize, padding, rows } = getGridLayout(
      w,
      frames
    );

    ctx.save();
    ctx.translate(-cam.x, -cam.y);

    const selectedFrameId = activeFrameId.value;

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = col * (cellSize + padding);
      const cy = row * (cellSize + padding);

      // Cell background
      const isSelected = frame.id === selectedFrameId;
      const isHovered = i === hoverIdx.current;

      if (isSelected) {
        ctx.fillStyle = "rgba(74, 144, 217, 0.35)";
        ctx.fillRect(cx, cy, cellSize, cellSize);
        ctx.strokeStyle = "rgba(74, 144, 217, 0.9)";
        ctx.lineWidth = 2;
        ctx.strokeRect(cx + 1, cy + 1, cellSize - 2, cellSize - 2);
      } else if (isHovered) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
        ctx.fillRect(cx, cy, cellSize, cellSize);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
        ctx.lineWidth = 1;
        ctx.strokeRect(cx + 0.5, cy + 0.5, cellSize - 1, cellSize - 1);
      } else {
        ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
        ctx.fillRect(cx, cy, cellSize, cellSize);
      }

      // Draw frame thumbnail
      if (img) {
        const innerPad = 4;
        const drawArea = thumbSize;
        // Fit frame into drawArea while maintaining aspect ratio
        const scale = Math.min(
          drawArea / frame.width,
          drawArea / frame.height,
          1
        );
        const dw = frame.width * scale;
        const dh = frame.height * scale;
        const dx = cx + innerPad + (drawArea - dw) / 2;
        const dy = cy + innerPad + (drawArea - dh) / 2;

        if (frame.rotated) {
          ctx.save();
          ctx.translate(dx + dw / 2, dy + dh / 2);
          ctx.rotate(-Math.PI / 2);
          ctx.drawImage(
            img,
            frame.x,
            frame.y,
            frame.height,
            frame.width,
            -dh / 2,
            -dw / 2,
            dh,
            dw
          );
          ctx.restore();
        } else {
          ctx.drawImage(
            img,
            frame.x,
            frame.y,
            frame.width,
            frame.height,
            dx,
            dy,
            dw,
            dh
          );
        }
      }

      // Frame name (truncated)
      if (cellSize >= 48) {
        ctx.fillStyle = "#bbb";
        ctx.font = "9px sans-serif";
        ctx.textAlign = "center";
        const label =
          frame.name.length > 10
            ? frame.name.slice(0, 9) + "…"
            : frame.name;
        ctx.fillText(label, cx + cellSize / 2, cy + cellSize - 2);
      }
    }

    ctx.restore();

    // Bottom overflow fade
    const totalH = rows * (cellSize + padding) - cam.y;
    if (totalH > h) {
      const grad = ctx.createLinearGradient(0, h - 20, 0, h);
      grad.addColorStop(0, "rgba(30,30,30,0)");
      grad.addColorStop(1, "rgba(30,30,30,0.8)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, h - 20, w, 20);
    }
  }, []);

  // Redraw on relevant signal changes
  useEffect(() => {
    draw();
  }, [
    activeAtlasId.value,
    activeFrameId.value,
    spriteAtlases.value,
    atlasImages.value,
    spriteFilterText.value,
    panelCam.value,
    panelZoom.value,
  ]);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current!;
    const ro = new ResizeObserver(() => draw());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Reset camera when atlas changes
  useEffect(() => {
    panelCam.value = { x: 0, y: 0 };
    panelZoom.value = 1;
  }, [activeAtlasId.value]);

  // ---- Hit testing ----
  const screenToIndex = (clientX: number, clientY: number): number => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return -1;
    const frames = getFilteredFrames();
    if (frames.length === 0) return -1;

    const rect = canvas.getBoundingClientRect();
    const cam = panelCam.value;
    const w = container.clientWidth;
    const { cols, cellSize, padding } = getGridLayout(w, frames);

    const x = clientX - rect.left + cam.x;
    const y = clientY - rect.top + cam.y;
    const col = Math.floor(x / (cellSize + padding));
    const row = Math.floor(y / (cellSize + padding));
    if (col < 0 || col >= cols || row < 0) return -1;

    // Check we're inside the cell, not in padding
    const cellX = x - col * (cellSize + padding);
    const cellY = y - row * (cellSize + padding);
    if (cellX > cellSize || cellY > cellSize) return -1;

    const idx = row * cols + col;
    return idx < frames.length ? idx : -1;
  };

  // ---- Event handlers ----
  const onPointerDown = (e: PointerEvent) => {
    // Middle-click or Alt+click → pan
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      const startCam = { ...panelCam.value };
      const startX = e.clientX;
      const startY = e.clientY;
      const onMove = (ev: PointerEvent) => {
        panelCam.value = {
          x: Math.max(0, startCam.x - (ev.clientX - startX)),
          y: Math.max(0, startCam.y - (ev.clientY - startY)),
        };
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      return;
    }

    // Left click → select frame
    if (e.button === 0) {
      const idx = screenToIndex(e.clientX, e.clientY);
      if (idx < 0) return;
      const frames = getFilteredFrames();
      const frame = frames[idx];
      activeFrameId.value = frame.id;
      onFrameSelect?.(frame);
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    const idx = screenToIndex(e.clientX, e.clientY);
    if (idx !== hoverIdx.current) {
      hoverIdx.current = idx;
      draw();
      // Update tooltip
      if (idx >= 0) {
        const frames = getFilteredFrames();
        const frame = frames[idx];
        const rect = containerRef.current!.getBoundingClientRect();
        setTooltip({
          text: `${frame.name}  (${frame.width}×${frame.height})`,
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      } else {
        setTooltip(null);
      }
    } else if (idx >= 0) {
      const rect = containerRef.current!.getBoundingClientRect();
      setTooltip((prev) =>
        prev
          ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top }
          : prev
      );
    }
  };

  const onPointerLeave = () => {
    if (hoverIdx.current >= 0) {
      hoverIdx.current = -1;
      draw();
    }
    setTooltip(null);
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Zoom
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      panelZoom.value = Math.min(4, Math.max(0.25, panelZoom.value + delta));
    } else {
      // Scroll
      const cam = panelCam.value;
      panelCam.value = { ...cam, y: Math.max(0, cam.y + e.deltaY) };
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        cursor: "pointer",
        position: "relative",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onWheel={onWheel}
    >
      <canvas
        ref={canvasRef}
        style={{ display: "block", imageRendering: "pixelated" }}
      />
      {tooltip && (
        <div
          style={{
            position: "absolute",
            left: tooltip.x + 12,
            top: tooltip.y - 28,
            background: "rgba(0,0,0,0.85)",
            color: "#ddd",
            fontSize: 11,
            padding: "3px 8px",
            borderRadius: 4,
            pointerEvents: "none",
            whiteSpace: "nowrap",
            zIndex: 10,
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}

```

<!-- src/editors/sprite-panel/SpritePanelEditor.tsx -->
<a id="src-editors-sprite-panel-SpritePanelEditor_tsx"></a>

## src/editors/sprite-panel/SpritePanelEditor.tsx

```tsx
import { registerEditor } from "../registry";
import { SpritePanelHeader } from "./SpritePanelHeader";
import { SpritePanelCanvas } from "./SpritePanelCanvas";
import { activeAtlasId, activeFrameId } from "../../store/atlas";
import { activeTool, activeEntityDefId } from "../../store/selection";
import { BUILTIN_ENTITY_DEFS } from "../../data/TileMap";
import type { SpriteFrame } from "../../data/SpriteAtlas";

function SpritePanelEditor({ areaId }: { areaId: string }) {
  const handleFrameSelect = (frame: SpriteFrame) => {
    // When a frame is selected, auto-activate the entity tool
    // and pick a sprite-bound entity def if available
    const atlasId = activeAtlasId.value;
    if (!atlasId) return;

    // Find an EntityDef that's bound to this atlas, or use the first sprite-capable one
    const defWithAtlas = BUILTIN_ENTITY_DEFS.find(
      (d) => d.spriteAtlasId === atlasId
    );
    if (defWithAtlas) {
      activeEntityDefId.value = defWithAtlas.id;
      activeTool.value = "entity";
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        position: "relative",
      }}
    >
      <SpritePanelHeader />
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <SpritePanelCanvas onFrameSelect={handleFrameSelect} />
      </div>
      <SpritePanelFooter />
    </div>
  );
}

/** Status bar showing selected frame details */
function SpritePanelFooter() {
  const frameId = activeFrameId.value;
  if (!frameId) return null;

  return (
    <div
      style={{
        height: 22,
        borderTop: "1px solid #333",
        background: "#252525",
        display: "flex",
        alignItems: "center",
        padding: "0 8px",
        fontSize: 10,
        color: "#888",
        flexShrink: 0,
        gap: 8,
      }}
    >
      <span>已选: <span style={{ color: "#aaa" }}>{frameId}</span></span>
    </div>
  );
}

registerEditor({
  id: "sprite-panel",
  name: "Sprite 面板",
  icon: "🖼",
  component: SpritePanelEditor,
});

export { SpritePanelEditor };

```

<!-- src/editors/sprite-panel/SpritePanelHeader.tsx -->
<a id="src-editors-sprite-panel-SpritePanelHeader_tsx"></a>

## src/editors/sprite-panel/SpritePanelHeader.tsx

```tsx
import { useState, useRef } from "preact/hooks";
import {
  spriteAtlases,
  activeAtlasId,
  activeFrameId,
  activeAtlas,
  activeFrame,
  removeAtlas,
} from "../../store/atlas";
import {
  importTileSheetAtlas,
  importPackedAtlas,
  importXmlAtlas,
  importLooseFiles,
} from "../../data/atlas-import";
import { spriteFilterText } from "./SpritePanelCanvas";

type ImportMode = "tilesheet" | "packed" | "xml" | "loose";

export function SpritePanelHeader() {
  const atlas = activeAtlas.value;
  const frame = activeFrame.value;
  const atlases = spriteAtlases.value;
  const [showImport, setShowImport] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        borderBottom: "1px solid #333",
        background: "#2a2a2a",
        flexShrink: 0,
        position: "relative",
      }}
    >
      {/* Top row: atlas selector + info + actions */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "0 8px",
          height: 32,
        }}
      >
        <select
          value={activeAtlasId.value ?? ""}
          onChange={(e) => {
            const v = (e.target as HTMLSelectElement).value;
            activeAtlasId.value = v || null;
            activeFrameId.value = null;
          }}
          style={{ flex: 1, minWidth: 0 }}
        >
          {atlases.length === 0 && (
            <option value="">（无图集）</option>
          )}
          {atlases.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.frames.length} 帧)
            </option>
          ))}
        </select>

        {atlas && (
          <span
            style={{
              fontSize: 10,
              color: "var(--text-secondary)",
              whiteSpace: "nowrap",
              fontFamily: "monospace",
            }}
          >
            {atlas.imageWidth}×{atlas.imageHeight}
          </span>
        )}

        {/* Delete active atlas */}
        {atlas && (
          <button
            onClick={() => removeAtlas(atlas.id)}
            title="删除当前图集"
            style={{
              background: "transparent",
              border: "none",
              borderRadius: 3,
              padding: "2px 5px",
              cursor: "pointer",
              fontSize: 13,
              lineHeight: 1,
              color: "var(--text-secondary)",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#e06060"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
          >✕</button>
        )}

        {/* Import button */}
        <button
          onClick={() => setShowImport(!showImport)}
          style={{
            background: showImport ? "var(--accent)" : undefined,
            color: showImport ? "#fff" : undefined,
          }}
        >导入</button>
      </div>

      {/* Second row: search */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "0 8px 4px",
          height: 24,
        }}
      >
        <input
          type="text"
          placeholder="搜索帧名…"
          value={spriteFilterText.value}
          onInput={(e) => {
            spriteFilterText.value = (e.target as HTMLInputElement).value;
          }}
          style={{
            flex: 1,
            height: 20,
            background: "#1e1e1e",
            color: "#ccc",
            border: "1px solid #444",
            borderRadius: 3,
            fontSize: 11,
            paddingLeft: 6,
          }}
        />
        {frame && (
          <span
            style={{
              fontSize: 10,
              color: "#aaa",
              whiteSpace: "nowrap",
              maxWidth: 140,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={`${frame.name} (${frame.width}×${frame.height})`}
          >
            {frame.name} {frame.width}×{frame.height}
          </span>
        )}
      </div>

      {/* Import popover */}
      {showImport && (
        <ImportPopover onDone={() => setShowImport(false)} />
      )}
    </div>
  );
}

// ============================================================
// Import Popover — appears below header, matches tile palette style
// ============================================================
function ImportPopover({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<ImportMode>("xml");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tilesheet params
  const [tileW, setTileW] = useState(16);
  const [tileH, setTileH] = useState(16);
  const [margin, setMargin] = useState(0);
  const [spacing, setSpacing] = useState(0);

  const fileRef = useRef<HTMLInputElement>(null);

  const acceptMap: Record<ImportMode, string> = {
    tilesheet: ".png,.jpg,.jpeg,.webp,.gif",
    packed: ".json,.png,.jpg,.jpeg,.webp",
    xml: ".xml,.txt,.png,.jpg,.jpeg,.webp",
    loose: ".png,.jpg,.jpeg,.webp,.gif",
  };

  const doImport = async () => {
    const files = Array.from(fileRef.current?.files ?? []);
    if (files.length === 0) { setError("请选择文件"); return; }

    setLoading(true);
    setError(null);
    try {
      if (mode === "tilesheet") {
        const imgFile = files.find((f) => /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name));
        if (!imgFile) throw new Error("未找到图片文件");
        await importTileSheetAtlas(imgFile, tileW, tileH, margin, spacing);
      } else if (mode === "packed") {
        const jsonFile = files.find((f) => f.name.endsWith(".json"));
        const imgFile = files.find((f) => /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name));
        if (!jsonFile || !imgFile) throw new Error("需要 JSON + 图片文件");
        await importPackedAtlas(jsonFile, imgFile);
      } else if (mode === "xml") {
        const xmlFile = files.find((f) => /\.(xml|txt)$/i.test(f.name));
        const imgFile = files.find((f) => /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name));
        if (!xmlFile || !imgFile) throw new Error("需要 XML + 图片文件");
        await importXmlAtlas(xmlFile, imgFile);
      } else {
        const imgFiles = files.filter((f) => /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name));
        if (imgFiles.length < 2) throw new Error("至少需要 2 张图片");
        await importLooseFiles(imgFiles);
      }
      onDone();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const tabStyle = (m: ImportMode) => ({
    flex: 1 as const,
    fontSize: 10,
    padding: "3px 0",
    border: "1px solid var(--border)" as const,
    borderRadius: 3,
    cursor: "pointer" as const,
    background: mode === m ? "var(--accent)" : "transparent",
    color: mode === m ? "#fff" : "var(--text-secondary)",
  });

  const numInput = (value: number, onChange: (v: number) => void) => ({
    type: "number" as const,
    value,
    onInput: (e: Event) => onChange(parseInt((e.target as HTMLInputElement).value) || 0),
    style: {
      width: 44,
      height: 20,
      fontSize: 11,
      padding: "0 3px",
      border: "1px solid var(--border)",
      borderRadius: 2,
      background: "var(--bg-input)",
      color: "var(--text-bright)",
      outline: "none",
    },
  });

  const labels: Record<ImportMode, string> = {
    tilesheet: "网格",
    packed: "JSON",
    xml: "XML",
    loose: "散图",
  };

  const hints: Record<ImportMode, string> = {
    tilesheet: "选择等距网格 sprite sheet 图片",
    packed: "选择 TexturePacker JSON + PNG",
    xml: "选择 Sparrow/Starling XML + PNG",
    loose: "选择多张 PNG，自动打包成图集",
  };

  return (
    <div
      style={{
        position: "absolute",
        top: "100%",
        left: 0,
        right: 0,
        zIndex: 100,
        background: "#2a2a2a",
        borderBottom: "2px solid var(--accent)",
        padding: "8px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
      }}
    >
      {/* Mode tabs */}
      <div style={{ display: "flex", gap: 2, marginBottom: 6 }}>
        {(["tilesheet", "packed", "xml", "loose"] as ImportMode[]).map((m) => (
          <button key={m} onClick={() => setMode(m)} style={tabStyle(m)}>
            {labels[m]}
          </button>
        ))}
      </div>

      {/* Hint */}
      <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 4 }}>
        {hints[mode]}
      </div>

      {/* File input */}
      <input
        ref={fileRef}
        type="file"
        multiple={mode !== "tilesheet"}
        accept={acceptMap[mode]}
        style={{ fontSize: 10, marginBottom: 4, width: "100%" }}
      />

      {/* Grid params */}
      {mode === "tilesheet" && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "4px 0" }}>
          <label style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 2 }}>
            W <input {...numInput(tileW, setTileW)} />
          </label>
          <label style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 2 }}>
            H <input {...numInput(tileH, setTileH)} />
          </label>
          <label style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 2 }}>
            M <input {...numInput(margin, setMargin)} />
          </label>
          <label style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 2 }}>
            S <input {...numInput(spacing, setSpacing)} />
          </label>
        </div>
      )}

      {error && (
        <div style={{ fontSize: 10, color: "#e06060", margin: "4px 0" }}>{error}</div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
        <button
          onClick={doImport}
          disabled={loading}
          style={{
            flex: 1,
            fontSize: 11,
            padding: "4px 0",
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: 3,
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "导入中…" : "导入"}
        </button>
        <button
          onClick={onDone}
          style={{
            fontSize: 11,
            padding: "4px 8px",
            background: "transparent",
            color: "var(--text-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 3,
            cursor: "pointer",
          }}
        >
          取消
        </button>
      </div>
    </div>
  );
}

```

<!-- src/editors/tile-palette/PaletteCanvas.tsx -->
<a id="src-editors-tile-palette-PaletteCanvas_tsx"></a>

## src/editors/tile-palette/PaletteCanvas.tsx

```tsx
import { useRef, useEffect, useCallback, useState } from "preact/hooks";
import { signal } from "@preact/signals";
import { tilesets, tilesetImages, currentMap } from "../../store/project";
import {
  activeTool,
  activeTilesetId,
  brushTiles,
  brushWidth,
  brushHeight,
  displayScale,
} from "../../store/selection";
import { getTileSrcRect } from "../../data/TileSet";
import type { TileSet } from "../../data/TileSet";
import { TileContextMenu } from "./TileContextMenu";

/** Palette camera for pan support */
const paletteCam = signal({ x: 0, y: 0 });

export function PaletteCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selStart = useRef<{ col: number; row: number } | null>(null);
  const selEnd = useRef<{ col: number; row: number } | null>(null);
  const hoverCell = useRef<{ col: number; row: number } | null>(null);

  // Context menu state
  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    localId: number;
    tilesetId: string;
  } | null>(null);

  const getTs = (): TileSet | null => {
    const id = activeTilesetId.value;
    return id ? tilesets.value.find((t) => t.id === id) ?? null : null;
  };

  const getCellSize = (ts: TileSet | null) => {
    const scale = displayScale.value;
    return {
      cellW: ts ? Math.max(1, Math.round(ts.tileWidth * scale)) : 32,
      cellH: ts ? Math.max(1, Math.round(ts.tileHeight * scale)) : 32,
    };
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ts = getTs();
    const img = ts ? tilesetImages.value.get(ts.id) : null;
    const { cellW, cellH } = getCellSize(ts);
    const cam = paletteCam.value;

    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = container.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;

    if (!ts || !img) {
      ctx.fillStyle = "#888";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("点击「导入」添加瓦片集", w / 2, h / 2);
      return;
    }

    ctx.save();
    ctx.translate(-cam.x, -cam.y);

    // Draw tiles
    for (let r = 0; r < ts.rows; r++) {
      for (let c = 0; c < ts.columns; c++) {
        const localId = r * ts.columns + c;
        const src = getTileSrcRect(ts, localId);
        ctx.drawImage(
          img,
          src.sx, src.sy, src.sw, src.sh,
          c * cellW, r * cellH, cellW, cellH
        );
      }
    }

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    for (let c = 0; c <= ts.columns; c++) {
      ctx.beginPath();
      ctx.moveTo(c * cellW + 0.5, 0);
      ctx.lineTo(c * cellW + 0.5, ts.rows * cellH);
      ctx.stroke();
    }
    for (let r = 0; r <= ts.rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * cellH + 0.5);
      ctx.lineTo(ts.columns * cellW, r * cellH + 0.5);
      ctx.stroke();
    }

    // Hover highlight
    const hover = hoverCell.current;
    if (hover && hover.col >= 0 && hover.col < ts.columns && hover.row >= 0 && hover.row < ts.rows) {
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(hover.col * cellW, hover.row * cellH, cellW, cellH);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1;
      ctx.strokeRect(hover.col * cellW + 0.5, hover.row * cellH + 0.5, cellW - 1, cellH - 1);
    }

    // Selection highlight
    const bt = brushTiles.value;
    if (bt.length > 0) {
      const map = currentMap.value;
      const ref = map.tilesets.find((r) => r.tilesetId === ts.id);
      if (ref) {
        const firstLocal = bt[0] - ref.firstGid;
        if (firstLocal >= 0) {
          const startCol = firstLocal % ts.columns;
          const startRow = Math.floor(firstLocal / ts.columns);
          ctx.strokeStyle = "rgba(74,144,217,0.9)";
          ctx.lineWidth = 2;
          ctx.strokeRect(
            startCol * cellW, startRow * cellH,
            brushWidth.value * cellW, brushHeight.value * cellH
          );
          ctx.fillStyle = "rgba(74,144,217,0.2)";
          ctx.fillRect(
            startCol * cellW, startRow * cellH,
            brushWidth.value * cellW, brushHeight.value * cellH
          );
        }
      }
    }

    ctx.restore();

    // Bottom fade indicator (if content overflows)
    const totalH = ts.rows * cellH - cam.y;
    if (totalH > h) {
      const grad = ctx.createLinearGradient(0, h - 24, 0, h);
      grad.addColorStop(0, "rgba(30,30,30,0)");
      grad.addColorStop(1, "rgba(30,30,30,0.8)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, h - 24, w, 24);
    }

    // Right fade indicator (if content overflows horizontally)
    const totalW = ts.columns * cellW - cam.x;
    if (totalW > w) {
      const grad = ctx.createLinearGradient(w - 24, 0, w, 0);
      grad.addColorStop(0, "rgba(30,30,30,0)");
      grad.addColorStop(1, "rgba(30,30,30,0.8)");
      ctx.fillStyle = grad;
      ctx.fillRect(w - 24, 0, 24, h);
    }
  }, []);

  // Redraw on signal changes
  useEffect(() => {
    draw();
  }, [
    activeTilesetId.value,
    tilesets.value,
    tilesetImages.value,
    brushTiles.value,
    displayScale.value,
    paletteCam.value,
  ]);

  // Resize
  useEffect(() => {
    const el = containerRef.current!;
    const ro = new ResizeObserver(() => draw());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Reset camera when tileset changes
  useEffect(() => {
    paletteCam.value = { x: 0, y: 0 };
  }, [activeTilesetId.value]);

  const screenToCell = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const ts = getTs();
    if (!ts) return null;
    const { cellW, cellH } = getCellSize(ts);
    const cam = paletteCam.value;
    const col = Math.floor((clientX - rect.left + cam.x) / cellW);
    const row = Math.floor((clientY - rect.top + cam.y) / cellH);
    if (col < 0 || row < 0 || col >= ts.columns || row >= ts.rows) return null;
    return { col, row };
  };

  const commitSelection = () => {
    const ts = getTs();
    const s = selStart.current;
    const e = selEnd.current;
    if (!ts || !s || !e) return;
    const map = currentMap.value;
    const ref = map.tilesets.find((r) => r.tilesetId === ts.id);
    if (!ref) return;

    const c1 = Math.min(s.col, e.col);
    const c2 = Math.max(s.col, e.col);
    const r1 = Math.min(s.row, e.row);
    const r2 = Math.max(s.row, e.row);
    const bw = c2 - c1 + 1;
    const bh = r2 - r1 + 1;
    const tiles: number[] = [];
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        tiles.push(ref.firstGid + r * ts.columns + c);
      }
    }
    brushTiles.value = tiles;
    brushWidth.value = bw;
    brushHeight.value = bh;
    // Auto-switch to brush when selecting tiles
    activeTool.value = "brush";
  };

  const onPointerDown = (e: PointerEvent) => {
    // Close context menu on any click
    if (ctxMenu) {
      setCtxMenu(null);
      return;
    }

    // Middle-click or Alt+click → pan
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      const startCam = { ...paletteCam.value };
      const startX = e.clientX;
      const startY = e.clientY;
      const onMove = (ev: PointerEvent) => {
        paletteCam.value = {
          x: Math.max(0, startCam.x - (ev.clientX - startX)),
          y: Math.max(0, startCam.y - (ev.clientY - startY)),
        };
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      return;
    }

    // Left click → select
    if (e.button === 0) {
      const cell = screenToCell(e.clientX, e.clientY);
      if (!cell) return;
      selStart.current = cell;
      selEnd.current = cell;
      commitSelection();
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    // Update hover
    const cell = screenToCell(e.clientX, e.clientY);
    const prev = hoverCell.current;
    if (cell?.col !== prev?.col || cell?.row !== prev?.row) {
      hoverCell.current = cell;
      draw();
    }

    // Drag select
    if (e.buttons & 1 && !(e.altKey)) {
      if (!cell || !selStart.current) return;
      selEnd.current = cell;
      commitSelection();
    }
  };

  const onPointerLeave = () => {
    if (hoverCell.current) {
      hoverCell.current = null;
      draw();
    }
  };

  // Right-click → context menu
  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    const cell = screenToCell(e.clientX, e.clientY);
    const ts = getTs();
    if (!cell || !ts) return;
    const localId = cell.row * ts.columns + cell.col;
    const rect = containerRef.current!.getBoundingClientRect();
    setCtxMenu({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      localId,
      tilesetId: ts.id,
    });
  };

  // Scroll → vertical scroll (shift+scroll → horizontal)
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const cam = paletteCam.value;
    if (e.shiftKey) {
      paletteCam.value = { ...cam, x: Math.max(0, cam.x + e.deltaY) };
    } else {
      paletteCam.value = { ...cam, y: Math.max(0, cam.y + e.deltaY) };
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        cursor: "pointer",
        imageRendering: "pixelated",
        position: "relative",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onContextMenu={onContextMenu}
      onWheel={onWheel}
    >
      <canvas
        ref={canvasRef}
        style={{ display: "block", imageRendering: "pixelated" }}
      />
      {ctxMenu && (
        <TileContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          localId={ctxMenu.localId}
          tilesetId={ctxMenu.tilesetId}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}

```

<!-- src/editors/tile-palette/PaletteHeader.tsx -->
<a id="src-editors-tile-palette-PaletteHeader_tsx"></a>

## src/editors/tile-palette/PaletteHeader.tsx

```tsx
import { useRef } from "preact/hooks";
import {
  tilesets,
  tilesetImages,
  currentMap,
  bumpMapVersion,
  lastImportedTilesetId,
  importTileSetFromFiles,
} from "../../store/project";
import {
  activeTilesetId,
  displayScale,
  displayScaleLocked,
  DISPLAY_SCALE_STEPS,
  formatDisplayScale,
} from "../../store/selection";
import { createTileSet } from "../../data/TileSet";
import { popoverOpen } from "./TileSetPopover";

let tsUid = 0;

export function PaletteHeader() {
  const fileRef = useRef<HTMLInputElement>(null);
  const ts = activeTilesetId.value
    ? tilesets.value.find((t) => t.id === activeTilesetId.value) ?? null
    : null;

  const handleImport = () => {
    fileRef.current?.click();
  };

  const handleFile = (e: Event) => {
    const files = Array.from((e.target as HTMLInputElement).files ?? []);
    if (files.length === 0) return;

    const jsonFile = files.find((f) => f.name.endsWith(".json"));
    const imageFile = files.find((f) => !f.name.endsWith(".json"));

    if (jsonFile && imageFile) {
      importTileSetFromFiles(jsonFile, imageFile).catch(console.error);
      (e.target as HTMLInputElement).value = "";
      return;
    }

    const file = files[0];
    if (!file || !file.type.startsWith("image/")) return;

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const name = file.name.replace(/\.[^.]+$/, "");
      const id = `ts_${++tsUid}`;

      const tsNew = createTileSet(id, name, url, img.width, img.height, 16, 16, 0, 0);
      tilesets.value = [...tilesets.value, tsNew];

      const newImages = new Map(tilesetImages.value);
      newImages.set(id, img);
      tilesetImages.value = newImages;

      activeTilesetId.value = id;

      const map = currentMap.value;
      const maxGid = map.tilesets.reduce((max, ref) => {
        const t = tilesets.value.find((t) => t.id === ref.tilesetId);
        return Math.max(max, ref.firstGid + (t?.tileCount ?? 0));
      }, 1);
      currentMap.value = {
        ...map,
        tilesets: [...map.tilesets, { tilesetId: id, firstGid: maxGid }],
      };
      bumpMapVersion();

      if (!displayScaleLocked.value) {
        displayScale.value = Math.max(1, Math.round(32 / tsNew.tileWidth));
      }

      lastImportedTilesetId.value = id;
    };
    img.src = url;
    (e.target as HTMLInputElement).value = "";
  };

  const hasActiveTileset = activeTilesetId.value !== null;
  const scale = displayScale.value;

  const stepScale = (dir: -1 | 1) => {
    const idx = DISPLAY_SCALE_STEPS.indexOf(scale);
    let nextIdx: number;
    if (idx === -1) {
      nextIdx = DISPLAY_SCALE_STEPS.findIndex((s) => s > scale);
      if (dir === -1) nextIdx = Math.max(0, nextIdx - 1);
      if (nextIdx === -1) nextIdx = DISPLAY_SCALE_STEPS.length - 1;
    } else {
      nextIdx = Math.max(0, Math.min(DISPLAY_SCALE_STEPS.length - 1, idx + dir));
    }
    displayScale.value = DISPLAY_SCALE_STEPS[nextIdx];
  };

  return (
    <div
      style={{
        height: 32,
        background: "var(--bg-header)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        padding: "0 8px",
        gap: 4,
        flexShrink: 0,
      }}
    >
      {/* TileSet selector */}
      <select
        value={activeTilesetId.value ?? ""}
        onChange={(e) => {
          activeTilesetId.value = (e.target as HTMLSelectElement).value || null;
        }}
        style={{ flex: 1, minWidth: 0 }}
      >
        {tilesets.value.length === 0 && <option value="">（无瓦片集）</option>}
        {tilesets.value.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} ({t.columns}×{t.rows})
          </option>
        ))}
      </select>

      {/* Tile size + scale info */}
      {ts && (
        <span
          style={{
            fontSize: 10,
            color: "var(--text-secondary)",
            whiteSpace: "nowrap",
            fontFamily: "monospace",
          }}
        >
          {ts.tileWidth}×{ts.tileHeight}
        </span>
      )}

      {/* Settings popover toggle */}
      {hasActiveTileset && (
        <button
          onClick={() => { popoverOpen.value = !popoverOpen.value; }}
          title="瓦片集属性"
          style={{
            background: popoverOpen.value ? "var(--accent)" : "transparent",
            border: "none",
            borderRadius: 3,
            padding: "2px 5px",
            cursor: "pointer",
            fontSize: 13,
            lineHeight: 1,
          }}
        >⚙</button>
      )}

      {/* Inline scale control */}
      <div style={{ display: "flex", alignItems: "center", gap: 1 }}>
        <button
          onClick={() => stepScale(-1)}
          style={{ width: 18, height: 20, padding: 0, fontSize: 11 }}
          title="缩小显示比例"
        >−</button>
        <span
          style={{
            minWidth: 20,
            textAlign: "center",
            fontSize: 10,
            fontFamily: "monospace",
            color: "var(--text-bright)",
          }}
        >
          {formatDisplayScale(scale)}
        </span>
        <button
          onClick={() => stepScale(1)}
          style={{ width: 18, height: 20, padding: 0, fontSize: 11 }}
          title="放大显示比例"
        >+</button>
      </div>

      {/* Import */}
      <button onClick={handleImport}>导入</button>
      <input
        ref={fileRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp,.json"
        multiple
        style={{ display: "none" }}
        onChange={handleFile}
      />
    </div>
  );
}

```

<!-- src/editors/tile-palette/RedoPanel.tsx -->
<a id="src-editors-tile-palette-RedoPanel_tsx"></a>

## src/editors/tile-palette/RedoPanel.tsx

```tsx
import { useEffect, useRef } from "preact/hooks";
import {
  tilesets,
  lastImportedTilesetId,
  updateTileSetParams,
} from "../../store/project";

/**
 * Redo Panel — Blender-style "Adjust Last Operation" panel.
 * Appears at the bottom of TilePalette after a tileset import.
 * Non-modal: user can still interact with other Areas.
 * Dismisses on: click outside, Escape, or next import.
 */
export function RedoPanel() {
  const id = lastImportedTilesetId.value;
  const ts = id ? tilesets.value.find((t) => t.id === id) ?? null : null;
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!id) return;
    const handler = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        lastImportedTilesetId.value = null;
      }
    };
    const timer = setTimeout(() => {
      window.addEventListener("pointerdown", handler);
    }, 200);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", handler);
    };
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") lastImportedTilesetId.value = null;
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [id]);

  if (!ts) return null;

  const set = (field: string, raw: string) => {
    if (field === "name") {
      updateTileSetParams(ts.id, { name: raw });
    } else {
      const v = Math.max(field.startsWith("tile") ? 1 : 0, parseInt(raw) || 0);
      updateTileSetParams(ts.id, { [field]: v });
    }
  };

  return (
    <div
      ref={panelRef}
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        background: "#2a2a2a",
        borderTop: "2px solid var(--accent)",
        padding: "8px 10px",
        zIndex: 50,
        fontSize: 11,
        boxShadow: "0 -4px 12px rgba(0,0,0,0.3)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", marginBottom: 8, gap: 6 }}>
        <span style={{ color: "var(--accent)", fontSize: 10 }}>▶</span>
        <span style={{ color: "var(--text-bright)", fontWeight: 500 }}>导入瓦片集</span>
        <div style={{ flex: 1 }} />
        <span style={{ color: "var(--text-secondary)", fontSize: 10 }}>
          {ts.columns}×{ts.rows} = {ts.tileCount} 瓦片
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <Field label="名称">
          <input type="text" value={ts.name}
            onInput={(e) => set("name", (e.target as HTMLInputElement).value)}
            style={{ width: "100%" }} />
        </Field>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="瓦片宽">
            <input type="number" value={ts.tileWidth} min={1} max={512} style={{ width: 52 }}
              onChange={(e) => set("tileWidth", (e.target as HTMLInputElement).value)} />
          </Field>
          <Field label="瓦片高">
            <input type="number" value={ts.tileHeight} min={1} max={512} style={{ width: 52 }}
              onChange={(e) => set("tileHeight", (e.target as HTMLInputElement).value)} />
          </Field>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Field label="外边距">
            <input type="number" value={ts.margin} min={0} max={128} style={{ width: 52 }}
              onChange={(e) => set("margin", (e.target as HTMLInputElement).value)} />
          </Field>
          <Field label="间距">
            <input type="number" value={ts.spacing} min={0} max={128} style={{ width: 52 }}
              onChange={(e) => set("spacing", (e.target as HTMLInputElement).value)} />
          </Field>
        </div>
      </div>

      {ts.tileCount === 0 && (
        <div style={{ color: "var(--danger)", marginTop: 6, fontSize: 10 }}>
          ⚠ 当前参数无法切出瓦片，请调整
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ color: "var(--text-secondary)", fontSize: 10, width: 38, flexShrink: 0, textAlign: "right" }}>
        {label}
      </span>
      {children}
    </div>
  );
}

```

<!-- src/editors/tile-palette/register.ts -->
<a id="src-editors-tile-palette-register_ts"></a>

## src/editors/tile-palette/register.ts

```ts
// Side-effect import: triggers registerEditor inside TilePaletteEditor
import './TilePaletteEditor';

```

<!-- src/editors/tile-palette/TileContextMenu.tsx -->
<a id="src-editors-tile-palette-TileContextMenu_tsx"></a>

## src/editors/tile-palette/TileContextMenu.tsx

```tsx
import { useEffect, useRef, useState } from "preact/hooks";
import { tilesets } from "../../store/project";
import type { TileSet, TileData } from "../../data/TileSet";

interface Props {
  x: number;
  y: number;
  localId: number;
  tilesetId: string;
  onClose: () => void;
}

export function TileContextMenu({ x, y, localId, tilesetId, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);

  const ts = tilesets.value.find((t) => t.id === tilesetId);
  if (!ts) return null;

  const tileData: TileData = ts.tileData?.[localId] ?? {};
  const hasCollision = tileData.collision ?? false;
  const tags = tileData.tags ?? [];

  // Click outside to close
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      window.addEventListener("pointerdown", handler);
    }, 50);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", handler);
    };
  }, []);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const updateTileData = (patch: Partial<TileData>) => {
    const newData = { ...tileData, ...patch };
    const newTileData = { ...ts.tileData, [localId]: newData };
    // Mutate tileset's tileData and trigger re-render
    tilesets.value = tilesets.value.map((t) =>
      t.id === tilesetId ? { ...t, tileData: newTileData } : t
    );
  };

  const toggleCollision = () => {
    updateTileData({ collision: !hasCollision });
  };

  const [tagInput, setTagInput] = useState(tags.join(", "));

  const commitTags = () => {
    const newTags = tagInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    updateTileData({ tags: newTags });
    setEditing(false);
  };

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        left: Math.min(x, 180), // prevent overflow
        top: y,
        minWidth: 160,
        background: "#2a2a2a",
        border: "1px solid var(--border)",
        borderRadius: 5,
        boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
        zIndex: 300,
        fontSize: 11,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "5px 10px",
          borderBottom: "1px solid var(--border)",
          color: "var(--text-secondary)",
          fontSize: 10,
          fontFamily: "monospace",
        }}
      >
        瓦片 #{localId} ({localId % ts.columns}, {Math.floor(localId / ts.columns)})
      </div>

      {/* Collision toggle */}
      <div
        onClick={toggleCollision}
        style={{
          padding: "6px 10px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = "var(--bg-input)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      >
        <span style={{ width: 16, textAlign: "center" }}>
          {hasCollision ? "✅" : "⬜"}
        </span>
        <span>碰撞体</span>
      </div>

      {/* Tags */}
      <div
        style={{
          padding: "6px 10px",
          borderTop: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            color: "var(--text-secondary)",
            fontSize: 10,
            marginBottom: 4,
          }}
        >
          标签
        </div>
        {editing ? (
          <div style={{ display: "flex", gap: 3 }}>
            <input
              type="text"
              value={tagInput}
              onInput={(e) => setTagInput((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitTags();
                if (e.key === "Escape") setEditing(false);
              }}
              style={{ flex: 1, fontSize: 10, height: 20 }}
              autoFocus
            />
            <button onClick={commitTags} style={{ fontSize: 10, height: 20, padding: "0 6px" }}>
              ✓
            </button>
          </div>
        ) : (
          <div
            onClick={() => setEditing(true)}
            style={{
              cursor: "pointer",
              minHeight: 18,
              padding: "2px 4px",
              borderRadius: 3,
              border: "1px solid var(--border)",
              fontSize: 10,
              color: tags.length > 0 ? "var(--text-primary)" : "var(--text-secondary)",
            }}
          >
            {tags.length > 0 ? tags.join(", ") : "点击添加标签…"}
          </div>
        )}
      </div>

      {/* Properties preview */}
      {tileData.properties && Object.keys(tileData.properties).length > 0 && (
        <div
          style={{
            padding: "6px 10px",
            borderTop: "1px solid var(--border)",
            fontSize: 10,
            color: "var(--text-secondary)",
          }}
        >
          自定义属性: {Object.keys(tileData.properties).length} 项
        </div>
      )}
    </div>
  );
}

```

<!-- src/editors/tile-palette/TilePaletteEditor.tsx -->
<a id="src-editors-tile-palette-TilePaletteEditor_tsx"></a>

## src/editors/tile-palette/TilePaletteEditor.tsx

```tsx
import { registerEditor } from "../registry";
import { PaletteHeader } from "./PaletteHeader";
import { PaletteCanvas } from "./PaletteCanvas";
import { RedoPanel } from "./RedoPanel";
import { TileSetPopover } from "./TileSetPopover";

function TilePaletteEditor({ areaId }: { areaId: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        position: "relative",
      }}
    >
      <PaletteHeader />
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <PaletteCanvas />
        <RedoPanel />
      </div>
      <TileSetPopover />
    </div>
  );
}

registerEditor({
  id: "tile-palette",
  name: "瓦片面板",
  icon: "🎨",
  component: TilePaletteEditor,
});

export { TilePaletteEditor };

```

<!-- src/editors/tile-palette/TileSetPopover.tsx -->
<a id="src-editors-tile-palette-TileSetPopover_tsx"></a>

## src/editors/tile-palette/TileSetPopover.tsx

```tsx
import { useEffect, useRef, useState } from "preact/hooks";
import { signal } from "@preact/signals";
import {
  tilesets,
  updateTileSetParams,
  removeTileSet,
} from "../../store/project";
import {
  activeTilesetId,
  displayScale,
  displayScaleLocked,
  DISPLAY_SCALE_STEPS,
  formatDisplayScale,
  parseDisplayScale,
} from "../../store/selection";
import { exportTileSet } from "../../data/export";

/** Controls whether the popover is visible */
export const popoverOpen = signal(false);

export function TileSetPopover() {
  const tsId = activeTilesetId.value;
  const ts = tsId ? tilesets.value.find((t) => t.id === tsId) ?? null : null;
  const panelRef = useRef<HTMLDivElement>(null);
  const locked = displayScaleLocked.value;
  const scale = displayScale.value;

  const [editingScale, setEditingScale] = useState(false);
  const [scaleInput, setScaleInput] = useState("");
  const scaleInputRef = useRef<HTMLInputElement>(null);

  // Dismiss on click outside
  useEffect(() => {
    if (!popoverOpen.value) return;
    const handler = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        popoverOpen.value = false;
      }
    };
    const timer = setTimeout(() => {
      window.addEventListener("pointerdown", handler);
    }, 100);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", handler);
    };
  }, [popoverOpen.value]);

  // Dismiss on Escape
  useEffect(() => {
    if (!popoverOpen.value) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") popoverOpen.value = false;
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [popoverOpen.value]);

  if (!popoverOpen.value || !ts) return null;

  const set = (field: string, raw: string) => {
    if (field === "name") {
      updateTileSetParams(ts.id, { name: raw });
    } else {
      const v = Math.max(field.startsWith("tile") ? 1 : 0, parseInt(raw) || 0);
      updateTileSetParams(ts.id, { [field]: v });
    }
  };

  const stepScale = (dir: -1 | 1) => {
    const idx = DISPLAY_SCALE_STEPS.indexOf(scale);
    let nextIdx: number;
    if (idx === -1) {
      // Find nearest step
      nextIdx = DISPLAY_SCALE_STEPS.findIndex((s) => s > scale);
      if (dir === -1) nextIdx = Math.max(0, nextIdx - 1);
      if (nextIdx === -1) nextIdx = DISPLAY_SCALE_STEPS.length - 1;
    } else {
      nextIdx = Math.max(0, Math.min(DISPLAY_SCALE_STEPS.length - 1, idx + dir));
    }
    displayScale.value = DISPLAY_SCALE_STEPS[nextIdx];
  };

  const startEditScale = () => {
    setScaleInput(formatDisplayScale(scale));
    setEditingScale(true);
    requestAnimationFrame(() => scaleInputRef.current?.select());
  };

  const commitScaleEdit = () => {
    setEditingScale(false);
    const v = parseDisplayScale(scaleInput);
    if (v !== null) {
      displayScale.value = v;
    }
  };

  return (
    <div
      ref={panelRef}
      style={{
        position: "absolute",
        top: 34,
        right: 4,
        width: 220,
        background: "#2a2a2a",
        border: "1px solid var(--border)",
        borderRadius: 6,
        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
        zIndex: 200,
        fontSize: 11,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "6px 10px",
          borderBottom: "1px solid var(--border)",
          background: "var(--panel-header)",
          fontWeight: 600,
          color: "var(--text-bright)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>瓦片集属性</span>
        <button
          onClick={() => {
            popoverOpen.value = false;
          }}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-secondary)",
            cursor: "pointer",
            fontSize: 13,
            padding: 0,
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      {/* Properties */}
      <div
        style={{
          padding: "8px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 5,
        }}
      >
        <Field label="名称">
          <input
            type="text"
            value={ts.name}
            onInput={(e) => set("name", (e.target as HTMLInputElement).value)}
            style={{ width: "100%" }}
          />
        </Field>

        <div style={{ display: "flex", gap: 6 }}>
          <Field label="瓦片宽">
            <input
              type="number"
              value={ts.tileWidth}
              min={1}
              max={512}
              style={{ width: 48 }}
              onChange={(e) =>
                set("tileWidth", (e.target as HTMLInputElement).value)
              }
            />
          </Field>
          <Field label="瓦片高">
            <input
              type="number"
              value={ts.tileHeight}
              min={1}
              max={512}
              style={{ width: 48 }}
              onChange={(e) =>
                set("tileHeight", (e.target as HTMLInputElement).value)
              }
            />
          </Field>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <Field label="外边距">
            <input
              type="number"
              value={ts.margin}
              min={0}
              max={128}
              style={{ width: 48 }}
              onChange={(e) =>
                set("margin", (e.target as HTMLInputElement).value)
              }
            />
          </Field>
          <Field label="间距">
            <input
              type="number"
              value={ts.spacing}
              min={0}
              max={128}
              style={{ width: 48 }}
              onChange={(e) =>
                set("spacing", (e.target as HTMLInputElement).value)
              }
            />
          </Field>
        </div>

        {/* Display scale with editable value + lock */}
        <Field label="显示比例">
          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <button
              onClick={() => stepScale(-1)}
              disabled={locked}
              style={{
                width: 22,
                height: 22,
                padding: 0,
                opacity: locked ? 0.4 : 1,
                cursor: locked ? "not-allowed" : "pointer",
              }}
            >
              −
            </button>

            {editingScale ? (
              <input
                ref={scaleInputRef}
                type="text"
                value={scaleInput}
                onInput={(e) =>
                  setScaleInput((e.target as HTMLInputElement).value)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitScaleEdit();
                  if (e.key === "Escape") setEditingScale(false);
                }}
                onBlur={commitScaleEdit}
                style={{
                  width: 36,
                  height: 20,
                  fontSize: 11,
                  textAlign: "center",
                  padding: "0 2px",
                  border: "1px solid var(--accent)",
                  borderRadius: 3,
                  background: "var(--bg-input)",
                  color: "var(--text-bright)",
                  outline: "none",
                  fontFamily: "monospace",
                }}
              />
            ) : (
              <span
                onClick={startEditScale}
                title="点击输入精确比例 (支持 1/4, 1/2, 0.5, 1~8)"
                style={{
                  minWidth: 32,
                  textAlign: "center",
                  cursor: "text",
                  padding: "1px 3px",
                  borderRadius: 3,
                  border: "1px solid transparent",
                  fontFamily: "monospace",
                  fontSize: 11,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "var(--border)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "transparent";
                }}
              >
                {formatDisplayScale(scale)}
              </span>
            )}

            <button
              onClick={() => stepScale(1)}
              disabled={locked}
              style={{
                width: 22,
                height: 22,
                padding: 0,
                opacity: locked ? 0.4 : 1,
                cursor: locked ? "not-allowed" : "pointer",
              }}
            >
              +
            </button>

            {/* Lock button */}
            <button
              onClick={() => {
                displayScaleLocked.value = !locked;
              }}
              title={locked ? "解锁比例 (导入时自动计算)" : "锁定比例 (导入时保持不变)"}
              style={{
                background: locked ? "var(--accent)" : "transparent",
                border: locked
                  ? "1px solid var(--accent)"
                  : "1px solid var(--border)",
                borderRadius: 3,
                padding: "1px 4px",
                cursor: "pointer",
                fontSize: 11,
                lineHeight: 1,
                color: locked ? "#fff" : "var(--text-secondary)",
                marginLeft: 2,
              }}
            >
              {locked ? "🔒" : "🔓"}
            </button>
          </div>
        </Field>

        {/* Stats */}
        <div
          style={{
            borderTop: "1px solid var(--border)",
            paddingTop: 6,
            marginTop: 2,
            color: "var(--text-secondary)",
            fontSize: 10,
          }}
        >
          {ts.columns}×{ts.rows} = {ts.tileCount} 瓦片 · 原图{" "}
          {ts.imageWidth}×{ts.imageHeight}px
          {ts.tileCount === 0 && (
            <div style={{ color: "var(--danger)", marginTop: 3 }}>
              ⚠ 当前参数无法切出瓦片
            </div>
          )}
        </div>

        {/* Actions */}
        <div
          style={{
            display: "flex",
            gap: 4,
            borderTop: "1px solid var(--border)",
            paddingTop: 6,
            marginTop: 2,
          }}
        >
          <button
            onClick={() => {
              exportTileSet(ts);
            }}
            style={{ flex: 1, fontSize: 10 }}
          >
            导出 TileSet
          </button>
          <button
            onClick={() => {
              removeTileSet(ts.id);
              popoverOpen.value = false;
            }}
            style={{
              flex: 1,
              fontSize: 10,
              color: "var(--danger)",
              borderColor: "var(--danger)",
            }}
          >
            删除
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          width: 42,
          flexShrink: 0,
          color: "var(--text-secondary)",
          fontSize: 10,
          textAlign: "right",
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

```

<!-- src/editors/viewport/register.ts -->
<a id="src-editors-viewport-register_ts"></a>

## src/editors/viewport/register.ts

```ts
// Side-effect import: triggers registerEditor inside ViewportEditor
import './ViewportEditor';

```

<!-- src/editors/viewport/ViewportCanvas.tsx -->
<a id="src-editors-viewport-ViewportCanvas_tsx"></a>

## src/editors/viewport/ViewportCanvas.tsx

```tsx
import { useRef, useEffect, useCallback } from "preact/hooks";
import { signal } from "@preact/signals";
import {
  currentMap,
  tilesets,
  tilesetImages,
  activeLayerId,
  activeLayer,
  mapVersion,
  bumpMapVersion,
} from "../../store/project";
import {
  activeTool,
  brushTiles,
  brushWidth,
  brushHeight,
  hoverTile,
  viewportZoom,
  viewportZoomLocked,
  showGrid,
  gridColor,
  activeEntityDefId,
  selectedEntityId,
} from "../../store/selection";
import { tileSelection } from "../../store/tileSelection";
import { executeCommand } from "../../store/history";
import { PaintTilesCommand } from "../../commands/paint";
import { MoveSelectionCommand } from "../../commands/selection";
import { AddEntityCommand, MoveEntityCommand } from "../../commands/entity";
import { activeEntityLayer } from "../../store/project";
import { spriteAtlases, atlasImages } from "../../store/atlas";
import { resolveGid, isTileLayer, isEntityLayer, getEntityDef } from "../../data/TileMap";
import type { EntityInstance } from "../../data/TileMap";
import { getTileSrcRect } from "../../data/TileSet";

/** Camera: x,y = world coordinate at viewport top-left. zoom = scale factor. */
const camera = signal({ x: 0, y: 0, zoom: 1 });
const needsCenter = signal(true);

// --- Selection drag state (module-level so draw() can access) ---

/** Box-select drag: start and current tile coords */
const selectDragStart = signal<{ x: number; y: number } | null>(null);
const selectDragEnd = signal<{ x: number; y: number } | null>(null);

/** Move-selection drag state */
const moveDragOrigin = signal<{ x: number; y: number } | null>(null);
const moveDragOffset = signal<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

/** Entity being dragged (move) */
const entityDragId = signal<string | null>(null);
const entityDragStart = signal<{ x: number; y: number } | null>(null);
const entityDragOrigPos = signal<{ x: number; y: number } | null>(null);

/** Set zoom preserving a world point at a screen position */
function setZoomAt(newZoom: number, screenX: number, screenY: number) {
  const cam = camera.value;
  const worldX = (screenX + cam.x) / cam.zoom;
  const worldY = (screenY + cam.y) / cam.zoom;
  camera.value = {
    x: worldX * newZoom - screenX,
    y: worldY * newZoom - screenY,
    zoom: newZoom,
  };
  viewportZoom.value = newZoom;
}

/** Set zoom preserving viewport center */
function setZoomCenter(newZoom: number, vw: number, vh: number) {
  setZoomAt(newZoom, vw / 2, vh / 2);
}

export function ViewportCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPainting = useRef(false);
  const paintedCells = useRef<Set<string>>(new Set());
  /** Current stroke command, created on mouse-down, committed on mouse-up */
  const strokeCmd = useRef<PaintTilesCommand | null>(null);

  /** Whether we are currently box-selecting */
  const isBoxSelecting = useRef(false);
  /** Whether we are currently move-dragging a selection */
  const isMovingSelection = useRef(false);
  /** Whether tiles have been cut from layer during current move drag */
  const hasCutTiles = useRef(false);

  // --- Center the map in viewport ---
  const centerMap = useCallback((fitToView = false) => {
    const el = containerRef.current;
    if (!el) return;
    const map = currentMap.value;
    const vw = el.clientWidth;
    const vh = el.clientHeight;
    const mapPxW = map.width * map.tileWidth;
    const mapPxH = map.height * map.tileHeight;

    let zoom = camera.value.zoom;
    if (fitToView) {
      zoom = Math.min(vw / mapPxW, vh / mapPxH) * 0.9;
      zoom = Math.max(0.25, zoom);
    }

    camera.value = {
      x: (mapPxW * zoom - vw) / 2,
      y: (mapPxH * zoom - vh) / 2,
      zoom,
    };
    viewportZoom.value = zoom;
  }, []);

  // --- Resize handler ---
  useEffect(() => {
    const el = containerRef.current!;
    const canvas = canvasRef.current!;
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = el.clientWidth * dpr;
      canvas.height = el.clientHeight * dpr;
      canvas.style.width = el.clientWidth + "px";
      canvas.style.height = el.clientHeight + "px";
      if (needsCenter.value && el.clientWidth > 0 && el.clientHeight > 0) {
        centerMap(true);
        needsCenter.value = false;
      }
      draw();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // --- Listen for external zoom set (from ViewportHeader input) ---
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail.zoom === "number") {
        const el = containerRef.current;
        if (!el) return;
        setZoomCenter(detail.zoom, el.clientWidth, el.clientHeight);
        draw();
      }
    };
    window.addEventListener("mote-set-viewport-zoom", handler);
    return () =>
      window.removeEventListener("mote-set-viewport-zoom", handler);
  }, []);

  // --- Keyboard: number keys 1-6 for integer zoom, Home for fit ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).tagName === "INPUT" ||
        (e.target as HTMLElement).tagName === "SELECT"
      )
        return;

      if (e.key === "Home") {
        e.preventDefault();
        centerMap(true);
        draw();
        return;
      }

      // Escape clears selection
      if (e.key === "Escape" && tileSelection.value) {
        // If floating, drop tiles back to original position (discard move)
        if (tileSelection.value.tiles) {
          const sel = tileSelection.value;
          const map = currentMap.value;
          const layer = map.layers.find((l) => l.id === sel.layerId);
          if (layer && isTileLayer(layer)) {
            for (let r = 0; r < sel.h; r++) {
              for (let c = 0; c < sel.w; c++) {
                const tx = sel.x + c;
                const ty = sel.y + r;
                if (tx >= 0 && tx < map.width && ty >= 0 && ty < map.height) {
                  layer.data[ty * map.width + tx] = sel.tiles![r * sel.w + c];
                }
              }
            }
            bumpMapVersion();
          }
        }
        tileSelection.value = null;
        draw();
        return;
      }

      // N = entity tool
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        activeTool.value = "entity";
        return;
      }

      if (viewportZoomLocked.value) return;

      const num = parseInt(e.key);
      if (num >= 1 && num <= 6) {
        e.preventDefault();
        const el = containerRef.current;
        if (!el) return;
        setZoomCenter(num, el.clientWidth, el.clientHeight);
        draw();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // --- Redraw on state change ---
  useEffect(() => {
    draw();
  }, [
    mapVersion.value,
    camera.value,
    hoverTile.value,
    activeTool.value,
    activeLayerId.value,
    brushTiles.value,
    tileSelection.value,
    selectDragStart.value,
    selectDragEnd.value,
    moveDragOffset.value,
    showGrid.value,
    gridColor.value,
    selectedEntityId.value,
    entityDragId.value,
    spriteAtlases.value,
  ]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    ctx.imageSmoothingEnabled = false;

    const map = currentMap.value;
    const { x: camX, y: camY, zoom } = camera.value;
    const tw = map.tileWidth * zoom;
    const th = map.tileHeight * zoom;

    ctx.save();
    ctx.translate(-camX, -camY);

    // Draw layers
    const images = tilesetImages.value;
    const tsMap = new Map(tilesets.value.map((t) => [t.id, t]));

    for (const layer of map.layers) {
      if (!layer.visible) continue;
      if (!isTileLayer(layer)) continue;
      ctx.globalAlpha = layer.opacity;

      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          const gid = layer.data[y * map.width + x];
          if (gid === 0) continue;

          const resolved = resolveGid(map, gid);
          if (!resolved) continue;

          const ts = tsMap.get(resolved.tilesetId);
          const img = images.get(resolved.tilesetId);
          if (!ts || !img) continue;

          const src = getTileSrcRect(ts, resolved.localId);
          ctx.drawImage(
            img,
            src.sx,
            src.sy,
            src.sw,
            src.sh,
            x * tw,
            y * th,
            tw,
            th
          );
        }
      }
    }

    ctx.globalAlpha = 1;

    // Render entity layers
    for (const layer of map.layers) {
      if (!layer.visible) continue;
      if (!isEntityLayer(layer)) continue;
      ctx.globalAlpha = layer.opacity;

      const aImages = atlasImages.value;
      const aList = spriteAtlases.value;

      for (const entity of layer.entities) {
        if (!entity.visible) continue;
        const def = getEntityDef(entity.defId);
        if (!def) continue;

        const ex = entity.x * zoom;
        const ey = entity.y * zoom;
        const ew = entity.width * zoom;
        const eh = entity.height * zoom;
        const isSelected = selectedEntityId.value === entity.id;

        // Try to render sprite
        const frameId = entity.spriteFrameId ?? def.spriteFrameId;
        const atlasId = def.spriteAtlasId;
        let drewSprite = false;

        if (atlasId && frameId) {
          const atlas = aList.find((a) => a.id === atlasId);
          const aImg = atlas ? aImages.get(atlas.id) : undefined;
          const frame = atlas?.frameMap.get(frameId);
          if (atlas && aImg && frame) {
            // Draw sprite
            const drawW = (def.shape === "rect" ? entity.width : frame.width) * zoom;
            const drawH = (def.shape === "rect" ? entity.height : frame.height) * zoom;
            const drawX = def.shape === "point" ? ex - drawW / 2 : ex;
            const drawY = def.shape === "point" ? ey - drawH / 2 : ey;
            ctx.drawImage(aImg, frame.x, frame.y, frame.width, frame.height, drawX, drawY, drawW, drawH);
            drewSprite = true;

            // Selection border
            if (isSelected) {
              ctx.strokeStyle = "#ffffff";
              ctx.lineWidth = 2;
              ctx.strokeRect(drawX - 1, drawY - 1, drawW + 2, drawH + 2);
            }
          }
        }

        if (!drewSprite) {
          // Fallback: draw shape gizmo
          if (def.shape === "rect") {
            ctx.fillStyle = def.color + "40";
            ctx.fillRect(ex, ey, ew, eh);
            ctx.strokeStyle = isSelected ? "#ffffff" : def.color;
            ctx.lineWidth = isSelected ? 2 : 1;
            ctx.strokeRect(ex, ey, ew, eh);
            ctx.fillStyle = def.color;
            ctx.font = `${Math.max(10, 12 * zoom)}px monospace`;
            ctx.fillText(entity.name || def.name, ex + 3 * zoom, ey + 12 * zoom);
          } else {
            const r = 8 * zoom;
            ctx.beginPath();
            ctx.arc(ex, ey, r, 0, Math.PI * 2);
            ctx.fillStyle = def.color + "80";
            ctx.fill();
            ctx.strokeStyle = isSelected ? "#ffffff" : def.color;
            ctx.lineWidth = isSelected ? 2 : 1;
            ctx.stroke();
            ctx.fillStyle = "#fff";
            ctx.font = `bold ${Math.max(10, 12 * zoom)}px monospace`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(def.icon, ex, ey);
            ctx.textAlign = "start";
            ctx.textBaseline = "alphabetic";
            ctx.fillStyle = def.color;
            ctx.font = `${Math.max(9, 10 * zoom)}px monospace`;
            ctx.fillText(entity.name || def.name, ex + r + 2, ey + 4 * zoom);
          }
        }
      }
    }

    ctx.globalAlpha = 1;

    // Grid
    if (showGrid.value) {
      ctx.strokeStyle = gridColor.value;
      ctx.lineWidth = 1;
      for (let x = 0; x <= map.width; x++) {
        ctx.beginPath();
        ctx.moveTo(x * tw, 0);
        ctx.lineTo(x * tw, map.height * th);
        ctx.stroke();
      }
      for (let y = 0; y <= map.height; y++) {
        ctx.beginPath();
        ctx.moveTo(0, y * th);
        ctx.lineTo(map.width * tw, y * th);
        ctx.stroke();
      }
    }

    // Map border
    ctx.strokeStyle = "rgba(74,144,217,0.5)";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, map.width * tw, map.height * th);

    // Brush preview
    const hover = hoverTile.value;
    if (hover && activeTool.value === "brush" && brushTiles.value.length > 0) {
      ctx.globalAlpha = 0.5;
      const bw = brushWidth.value;
      const bh = brushHeight.value;
      for (let by = 0; by < bh; by++) {
        for (let bx = 0; bx < bw; bx++) {
          const gid = brushTiles.value[by * bw + bx];
          if (gid === 0) continue;
          const resolved = resolveGid(currentMap.value, gid);
          if (!resolved) continue;
          const ts = tsMap.get(resolved.tilesetId);
          const img = images.get(resolved.tilesetId);
          if (!ts || !img) continue;
          const src = getTileSrcRect(ts, resolved.localId);
          ctx.drawImage(
            img,
            src.sx,
            src.sy,
            src.sw,
            src.sh,
            (hover.x + bx) * tw,
            (hover.y + by) * th,
            tw,
            th
          );
        }
      }
      ctx.globalAlpha = 1;
    }

    // Eraser preview
    if (hover && activeTool.value === "eraser") {
      ctx.fillStyle = "rgba(217, 74, 74, 0.3)";
      ctx.fillRect(hover.x * tw, hover.y * th, tw, th);
    }

    // Hover highlight
    if (hover) {
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1;
      ctx.strokeRect(hover.x * tw, hover.y * th, tw, th);
    }

    // --- Selection visual feedback ---

    // Box-select drag preview (dashed rect while dragging)
    const ds = selectDragStart.value;
    const de = selectDragEnd.value;
    if (ds && de) {
      const rx = Math.min(ds.x, de.x);
      const ry = Math.min(ds.y, de.y);
      const rw = Math.abs(de.x - ds.x) + 1;
      const rh = Math.abs(de.y - ds.y) + 1;

      ctx.save();
      ctx.fillStyle = "rgba(74, 144, 217, 0.15)";
      ctx.fillRect(rx * tw, ry * th, rw * tw, rh * th);
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = "rgba(74, 144, 217, 0.8)";
      ctx.lineWidth = 2;
      ctx.strokeRect(rx * tw, ry * th, rw * tw, rh * th);
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Active selection rect (after box-select or during move)
    const sel = tileSelection.value;
    if (sel) {
      const offDx = moveDragOffset.value.dx;
      const offDy = moveDragOffset.value.dy;
      const drawX = sel.x + offDx;
      const drawY = sel.y + offDy;

      // Draw floating tiles if cut
      if (sel.tiles) {
        ctx.save();
        ctx.globalAlpha = 0.85;
        for (let r = 0; r < sel.h; r++) {
          for (let c = 0; c < sel.w; c++) {
            const gid = sel.tiles[r * sel.w + c];
            if (gid === 0) continue;
            const resolved = resolveGid(map, gid);
            if (!resolved) continue;
            const ts = tsMap.get(resolved.tilesetId);
            const img = images.get(resolved.tilesetId);
            if (!ts || !img) continue;
            const src = getTileSrcRect(ts, resolved.localId);
            ctx.drawImage(
              img,
              src.sx,
              src.sy,
              src.sw,
              src.sh,
              (drawX + c) * tw,
              (drawY + r) * th,
              tw,
              th
            );
          }
        }
        ctx.globalAlpha = 1;
        ctx.restore();
      }

      // Dashed selection border
      ctx.save();
      ctx.fillStyle = "rgba(74, 144, 217, 0.1)";
      ctx.fillRect(drawX * tw, drawY * th, sel.w * tw, sel.h * th);
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = "rgba(74, 144, 217, 0.9)";
      ctx.lineWidth = 2;
      ctx.strokeRect(drawX * tw, drawY * th, sel.w * tw, sel.h * th);
      ctx.setLineDash([]);
      ctx.restore();
    }

    ctx.restore();
  }, []);

  // --- Mouse -> world pixel coord ---
  const screenToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      const { x: camX, y: camY, zoom } = camera.value;
      const mx = clientX - rect.left + camX;
      const my = clientY - rect.top + camY;
      return { x: mx / zoom, y: my / zoom };
    },
    []
  );

  /** Find entity at world position */
  const findEntityAt = useCallback(
    (wx: number, wy: number): { layerId: string; entity: EntityInstance } | null => {
      const map = currentMap.value;
      // Search layers in reverse (top-most first)
      for (let i = map.layers.length - 1; i >= 0; i--) {
        const layer = map.layers[i];
        if (!layer.visible || layer.locked || !isEntityLayer(layer)) continue;
        for (let j = layer.entities.length - 1; j >= 0; j--) {
          const e = layer.entities[j];
          if (!e.visible) continue;
          const def = getEntityDef(e.defId);
          if (!def) continue;
          if (def.shape === "rect") {
            if (wx >= e.x && wx <= e.x + e.width && wy >= e.y && wy <= e.y + e.height) {
              return { layerId: layer.id, entity: e };
            }
          } else {
            // Point: hit test with radius 8px
            const dx = wx - e.x;
            const dy = wy - e.y;
            if (dx * dx + dy * dy <= 12 * 12) {
              return { layerId: layer.id, entity: e };
            }
          }
        }
      }
      return null;
    },
    []
  );

  // --- Mouse -> tile coord ---
  const screenToTile = useCallback(
    (clientX: number, clientY: number) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      const map = currentMap.value;
      const { x: camX, y: camY, zoom } = camera.value;
      const mx = clientX - rect.left + camX;
      const my = clientY - rect.top + camY;
      const tx = Math.floor(mx / (map.tileWidth * zoom));
      const ty = Math.floor(my / (map.tileHeight * zoom));
      if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return null;
      return { x: tx, y: ty };
    },
    []
  );

  /** Check if a tile coord is inside the current selection */
  const isInsideSelection = useCallback(
    (tx: number, ty: number): boolean => {
      const sel = tileSelection.value;
      if (!sel) return false;
      return tx >= sel.x && tx < sel.x + sel.w && ty >= sel.y && ty < sel.y + sel.h;
    },
    []
  );

  // --- Paint (mutate data in-place + record into strokeCmd) ---
  const paintAt = useCallback((x: number, y: number) => {
    const map = currentMap.value;
    const layer = activeLayer.value;
    if (!layer || layer.locked || !isTileLayer(layer)) return;

    const tool = activeTool.value;
    const cmd = strokeCmd.current;

    if (tool === "brush") {
      const bt = brushTiles.value;
      if (bt.length === 0) return;
      const bw = brushWidth.value;
      const bh = brushHeight.value;
      for (let by = 0; by < bh; by++) {
        for (let bx = 0; bx < bw; bx++) {
          const tx = x + bx;
          const ty = y + by;
          if (tx >= map.width || ty >= map.height) continue;
          const idx = ty * map.width + tx;
          const oldGid = layer.data[idx];
          const newGid = bt[by * bw + bx];
          if (oldGid !== newGid) {
            layer.data[idx] = newGid;
            cmd?.record(idx, oldGid, newGid);
          }
        }
      }
    } else if (tool === "eraser") {
      const idx = y * map.width + x;
      const oldGid = layer.data[idx];
      if (oldGid !== 0) {
        layer.data[idx] = 0;
        cmd?.record(idx, oldGid, 0);
      }
    } else if (tool === "fill") {
      const fillGid = brushTiles.value.length > 0 ? brushTiles.value[0] : 0;
      floodFillWithRecord(layer.data, map.width, map.height, x, y, fillGid, cmd);
    } else if (tool === "eyedropper") {
      const idx = y * map.width + x;
      const gid = layer.data[idx];
      if (gid > 0) {
        brushTiles.value = [gid];
        brushWidth.value = 1;
        brushHeight.value = 1;
        activeTool.value = "brush";
      }
    }
    bumpMapVersion();
  }, []);

  // --- Pointer handlers ---
  const onPointerDown = (e: PointerEvent) => {
    // Middle-click or Alt+click -> pan
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      const startCam = { ...camera.value };
      const startX = e.clientX;
      const startY = e.clientY;
      const onMove = (ev: PointerEvent) => {
        camera.value = {
          ...startCam,
          x: startCam.x - (ev.clientX - startX),
          y: startCam.y - (ev.clientY - startY),
        };
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      return;
    }

    if (e.button === 0) {
      // ---- ENTITY TOOL ----
      if (activeTool.value === "entity") {
        const world = screenToWorld(e.clientX, e.clientY);

        // Check if clicking on an existing entity
        const hit = findEntityAt(world.x, world.y);
        if (hit) {
          // Select and start drag
          selectedEntityId.value = hit.entity.id;
          activeLayerId.value = hit.layerId;
          entityDragId.value = hit.entity.id;
          entityDragStart.value = { x: e.clientX, y: e.clientY };
          entityDragOrigPos.value = { x: hit.entity.x, y: hit.entity.y };
          return;
        }

        // Place new entity
        const defId = activeEntityDefId.value;
        const entLayer = activeEntityLayer.value;
        if (defId && entLayer) {
          const def = getEntityDef(defId);
          if (def) {
            // Snap to grid
            const map = currentMap.value;
            const snapX = Math.round(world.x / map.tileWidth) * map.tileWidth;
            const snapY = Math.round(world.y / map.tileHeight) * map.tileHeight;

            const newEntity = {
              id: `ent_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              defId: def.id,
              name: "",
              x: def.shape === "rect" ? snapX : snapX,
              y: def.shape === "rect" ? snapY : snapY,
              width: def.defaultWidth,
              height: def.defaultHeight,
              fieldValues: Object.fromEntries(
                def.fields.map((f) => [f.id, f.default])
              ),
              visible: true,
            };
            executeCommand(new AddEntityCommand(entLayer.id, newEntity));
            selectedEntityId.value = newEntity.id;
          }
        } else {
          selectedEntityId.value = null;
        }
        return;
      }

      // ---- SELECT TOOL ----
      if (activeTool.value === "select") {
        const tile = screenToTile(e.clientX, e.clientY);
        if (!tile) {
          // Click outside map: clear selection
          tileSelection.value = null;
          return;
        }

        // Check if clicking inside existing selection -> start move
        if (tileSelection.value && isInsideSelection(tile.x, tile.y)) {
          isMovingSelection.current = true;
          hasCutTiles.current = false;
          moveDragOrigin.value = { x: tile.x, y: tile.y };
          moveDragOffset.value = { dx: 0, dy: 0 };
          return;
        }

        // Otherwise start box-select
        isBoxSelecting.current = true;
        selectDragStart.value = { x: tile.x, y: tile.y };
        selectDragEnd.value = { x: tile.x, y: tile.y };
        // Clear any existing selection
        tileSelection.value = null;
        return;
      }

      // ---- Other tools (brush, eraser, fill, eyedropper) ----
      isPainting.current = true;
      paintedCells.current.clear();

      // Create a new stroke command
      const tool = activeTool.value;
      const label =
        tool === "brush"
          ? "\u7ed8\u5236 tile"
          : tool === "eraser"
          ? "\u64e6\u9664 tile"
          : tool === "fill"
          ? "\u586b\u5145 tile"
          : "\u5438\u53d6 tile";
      strokeCmd.current = new PaintTilesCommand(activeLayerId.value, label);

      const tile = screenToTile(e.clientX, e.clientY);
      if (tile) {
        const key = `${tile.x},${tile.y}`;
        paintedCells.current.add(key);
        paintAt(tile.x, tile.y);
      }
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    const tile = screenToTile(e.clientX, e.clientY);
    hoverTile.value = tile;

    // Entity dragging
    if (entityDragId.value && entityDragStart.value && entityDragOrigPos.value) {
      const { x: camX, y: camY, zoom } = camera.value;
      const dx = (e.clientX - entityDragStart.value.x) / zoom;
      const dy = (e.clientY - entityDragStart.value.y) / zoom;
      const map = currentMap.value;
      // Snap to grid while dragging
      const newX = Math.round((entityDragOrigPos.value.x + dx) / map.tileWidth) * map.tileWidth;
      const newY = Math.round((entityDragOrigPos.value.y + dy) / map.tileHeight) * map.tileHeight;

      // Update entity position in-place for visual feedback
      currentMap.value = {
        ...map,
        layers: map.layers.map((l) => {
          if (!isEntityLayer(l)) return l;
          return {
            ...l,
            entities: l.entities.map((ent) =>
              ent.id === entityDragId.value ? { ...ent, x: newX, y: newY } : ent
            ),
          };
        }),
      };
      bumpMapVersion();
      return;
    }

    // Box-selecting: update drag end
    if (isBoxSelecting.current && tile) {
      selectDragEnd.value = { x: tile.x, y: tile.y };
      return;
    }

    // Moving selection
    if (isMovingSelection.current && tile && moveDragOrigin.value) {
      const sel = tileSelection.value;
      if (!sel) return;

      // First movement: cut tiles from layer
      if (!hasCutTiles.current) {
        hasCutTiles.current = true;
        const map = currentMap.value;
        const layer = map.layers.find((l) => l.id === sel.layerId);
        if (layer && isTileLayer(layer)) {
          const tiles: number[] = [];
          for (let r = 0; r < sel.h; r++) {
            for (let c = 0; c < sel.w; c++) {
              const tx = sel.x + c;
              const ty = sel.y + r;
              if (tx >= 0 && tx < map.width && ty >= 0 && ty < map.height) {
                const idx = ty * map.width + tx;
                tiles.push(layer.data[idx]);
                layer.data[idx] = 0;
              } else {
                tiles.push(0);
              }
            }
          }
          tileSelection.value = { ...sel, tiles };
          bumpMapVersion();
        }
      }

      const dx = tile.x - moveDragOrigin.value.x;
      const dy = tile.y - moveDragOrigin.value.y;
      moveDragOffset.value = { dx, dy };
      return;
    }

    // Painting
    if (isPainting.current && tile) {
      const key = `${tile.x},${tile.y}`;
      if (!paintedCells.current.has(key)) {
        paintedCells.current.add(key);
        paintAt(tile.x, tile.y);
      }
    }
  };

  const onPointerUp = () => {
    // Finish entity drag
    if (entityDragId.value && entityDragOrigPos.value) {
      const entId = entityDragId.value;
      const origPos = entityDragOrigPos.value;
      entityDragId.value = null;
      entityDragStart.value = null;
      entityDragOrigPos.value = null;

      // Find the entity's current position
      const map = currentMap.value;
      for (const layer of map.layers) {
        if (!isEntityLayer(layer)) continue;
        const ent = layer.entities.find((e) => e.id === entId);
        if (ent && (ent.x !== origPos.x || ent.y !== origPos.y)) {
          // Revert to original position, then execute command (so undo works)
          const finalX = ent.x;
          const finalY = ent.y;
          // Revert
          currentMap.value = {
            ...map,
            layers: map.layers.map((l) => {
              if (!isEntityLayer(l)) return l;
              return {
                ...l,
                entities: l.entities.map((e) =>
                  e.id === entId ? { ...e, x: origPos.x, y: origPos.y } : e
                ),
              };
            }),
          };
          executeCommand(new MoveEntityCommand(layer.id, entId, origPos.x, origPos.y, finalX, finalY));
          break;
        }
      }
      return;
    }

    // Finish box-select
    if (isBoxSelecting.current) {
      isBoxSelecting.current = false;
      const ds = selectDragStart.value;
      const de = selectDragEnd.value;
      if (ds && de) {
        const rx = Math.min(ds.x, de.x);
        const ry = Math.min(ds.y, de.y);
        const rw = Math.abs(de.x - ds.x) + 1;
        const rh = Math.abs(de.y - ds.y) + 1;

        // Single-click on same tile with no meaningful area = 1x1 selection
        // If area is at least 1x1 tile, create selection
        tileSelection.value = {
          x: rx,
          y: ry,
          w: rw,
          h: rh,
          tiles: null,
          layerId: activeLayerId.value,
        };
      }
      selectDragStart.value = null;
      selectDragEnd.value = null;
      return;
    }

    // Finish move-selection
    if (isMovingSelection.current) {
      isMovingSelection.current = false;
      const sel = tileSelection.value;
      const off = moveDragOffset.value;

      if (sel && sel.tiles && (off.dx !== 0 || off.dy !== 0)) {
        const map = currentMap.value;
        const sourceRect = { x: sel.x, y: sel.y, w: sel.w, h: sel.h };
        const destRect = { x: sel.x + off.dx, y: sel.y + off.dy, w: sel.w, h: sel.h };

        // sourceOldTiles = the tiles data we cut (already stored in sel.tiles)
        const sourceOldTiles = sel.tiles.slice();

        // Write tiles at dest
        const layer = map.layers.find((l) => l.id === sel.layerId);
        if (layer && isTileLayer(layer)) {
          for (let r = 0; r < sel.h; r++) {
            for (let c = 0; c < sel.w; c++) {
              const tx = destRect.x + c;
              const ty = destRect.y + r;
              if (tx >= 0 && tx < map.width && ty >= 0 && ty < map.height) {
                layer.data[ty * map.width + tx] = sel.tiles[r * sel.w + c];
              }
            }
          }
        }

        // Create command (data already mutated in-place)
        const cmd = new MoveSelectionCommand(
          sel.layerId,
          sourceRect,
          destRect,
          sel.tiles.slice(),
          sourceOldTiles,
        );
        executeCommand(cmd);

        // Update selection to new position, clear floating tiles
        tileSelection.value = {
          x: destRect.x,
          y: destRect.y,
          w: sel.w,
          h: sel.h,
          tiles: null,
          layerId: sel.layerId,
        };
        bumpMapVersion();
      } else if (sel && sel.tiles && off.dx === 0 && off.dy === 0) {
        // No actual move: put tiles back
        const map = currentMap.value;
        const layer = map.layers.find((l) => l.id === sel.layerId);
        if (layer && isTileLayer(layer)) {
          for (let r = 0; r < sel.h; r++) {
            for (let c = 0; c < sel.w; c++) {
              const tx = sel.x + c;
              const ty = sel.y + r;
              if (tx >= 0 && tx < map.width && ty >= 0 && ty < map.height) {
                layer.data[ty * map.width + tx] = sel.tiles[r * sel.w + c];
              }
            }
          }
          tileSelection.value = { ...sel, tiles: null };
          bumpMapVersion();
        }
      }

      moveDragOrigin.value = null;
      moveDragOffset.value = { dx: 0, dy: 0 };
      return;
    }

    // Finish painting
    if (isPainting.current) {
      isPainting.current = false;
      // Commit the stroke command if there were actual changes
      const cmd = strokeCmd.current;
      if (cmd && cmd.hasChanges()) {
        // Data is already mutated in-place; executeCommand will just push to stack
        executeCommand(cmd);
      }
      strokeCmd.current = null;
    }
  };

  // --- Mouse-position zoom ---
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (viewportZoomLocked.value) return;

    const cam = camera.value;
    const rect = canvasRef.current!.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.25, Math.min(16, cam.zoom * factor));
    setZoomAt(newZoom, mouseX, mouseY);
  };

  // Determine cursor
  let cursor = "crosshair";
  if (activeTool.value === "entity") {
    cursor = activeEntityDefId.value ? "copy" : "default";
  } else if (activeTool.value === "select") {
    const sel = tileSelection.value;
    const hover = hoverTile.value;
    if (sel && hover && isInsideSelection(hover.x, hover.y)) {
      cursor = "move";
    } else {
      cursor = "crosshair";
    }
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        cursor,
        imageRendering: "pixelated",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => {
        hoverTile.value = null;
      }}
      onWheel={onWheel}
    >
      <canvas
        ref={canvasRef}
        style={{ display: "block", imageRendering: "pixelated" }}
      />
    </div>
  );
}

/** Flood fill that also records changes into a PaintTilesCommand */
function floodFillWithRecord(
  data: number[],
  w: number,
  h: number,
  sx: number,
  sy: number,
  newGid: number,
  cmd: PaintTilesCommand | null
) {
  const target = data[sy * w + sx];
  if (target === newGid) return;
  const stack = [[sx, sy]];
  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const idx = y * w + x;
    if (data[idx] !== target) continue;
    const oldGid = data[idx];
    data[idx] = newGid;
    cmd?.record(idx, oldGid, newGid);
    stack.push([x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]);
  }
}

```

<!-- src/editors/viewport/ViewportEditor.tsx -->
<a id="src-editors-viewport-ViewportEditor_tsx"></a>

## src/editors/viewport/ViewportEditor.tsx

```tsx
import { registerEditor } from "../registry";
import { ViewportHeader } from "./ViewportHeader";
import { ViewportCanvas } from "./ViewportCanvas";
import { ViewportFooter } from "./ViewportFooter";

function ViewportEditor({ areaId }: { areaId: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <ViewportHeader />
      <div style={{ flex: 1, overflow: "hidden" }}>
        <ViewportCanvas />
      </div>
      <ViewportFooter />
    </div>
  );
}

registerEditor({
  id: "viewport",
  name: "视口",
  icon: "🗺",
  component: ViewportEditor,
});

export { ViewportEditor };

```

<!-- src/editors/viewport/ViewportFooter.tsx -->
<a id="src-editors-viewport-ViewportFooter_tsx"></a>

## src/editors/viewport/ViewportFooter.tsx

```tsx
import {
  hoverTile,
  viewportZoomLocked,
  showGrid,
} from "../../store/selection";
import { activeLayer } from "../../store/project";
import { canUndo, canRedo, undoLabel, redoLabel, undo, redo } from "../../store/history";

export function ViewportFooter() {
  const tile = hoverTile.value;
  const layer = activeLayer.value;
  const locked = viewportZoomLocked.value;
  const gridOn = showGrid.value;

  return (
    <div
      style={{
        height: 22,
        background: "var(--bg-header)",
        borderTop: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        padding: "0 8px",
        fontSize: 10,
        color: "var(--text-secondary)",
        gap: 12,
        flexShrink: 0,
      }}
    >
      <span>{tile ? `瓦片 (${tile.x}, ${tile.y})` : "—"}</span>
      {layer && (
        <span>
          图层: {layer.name}
          {layer.locked ? " 🔒" : ""}
        </span>
      )}

      {/* Undo / Redo buttons */}
      <div style={{ display: "flex", gap: 2, marginLeft: 4 }}>
        <button
          onClick={() => undo()}
          disabled={!canUndo.value}
          title={canUndo.value ? `撤销: ${undoLabel.value}` : "无可撤销操作"}
          style={{
            fontSize: 10,
            padding: "0 4px",
            height: 16,
            border: "1px solid var(--border)",
            borderRadius: 2,
            background: "transparent",
            color: canUndo.value ? "var(--text)" : "var(--text-secondary)",
            cursor: canUndo.value ? "pointer" : "default",
            opacity: canUndo.value ? 1 : 0.4,
          }}
        >
          ↶
        </button>
        <button
          onClick={() => redo()}
          disabled={!canRedo.value}
          title={canRedo.value ? `重做: ${redoLabel.value}` : "无可重做操作"}
          style={{
            fontSize: 10,
            padding: "0 4px",
            height: 16,
            border: "1px solid var(--border)",
            borderRadius: 2,
            background: "transparent",
            color: canRedo.value ? "var(--text)" : "var(--text-secondary)",
            cursor: canRedo.value ? "pointer" : "default",
            opacity: canRedo.value ? 1 : 0.4,
          }}
        >
          ↷
        </button>
      </div>

      {/* Grid toggle */}
      <button
        onClick={() => { showGrid.value = !showGrid.value; }}
        title={gridOn ? "Hide grid" : "Show grid"}
        style={{
          fontSize: 10,
          padding: "0 5px",
          height: 16,
          border: "1px solid var(--border)",
          borderRadius: 2,
          background: gridOn ? "rgba(74, 144, 217, 0.25)" : "transparent",
          color: gridOn ? "var(--text)" : "var(--text-secondary)",
          cursor: "pointer",
          opacity: gridOn ? 1 : 0.5,
          display: "flex",
          alignItems: "center",
          gap: 3,
        }}
      >
        <span style={{ fontFamily: "monospace", fontWeight: "bold" }}>#</span>
        <span>{gridOn ? "Grid: On" : "Grid: Off"}</span>
      </button>

      <div style={{ flex: 1 }} />
      <span style={{ opacity: 0.6 }}>
        {locked ? "缩放已锁定" : "Ctrl+Z 撤销 · Ctrl+Shift+Z 重做"}
      </span>
    </div>
  );
}

```

<!-- src/editors/viewport/ViewportHeader.tsx -->
<a id="src-editors-viewport-ViewportHeader_tsx"></a>

## src/editors/viewport/ViewportHeader.tsx

```tsx
import { useRef, useState } from "preact/hooks";
import {
  activeTool,
  viewportZoom,
  viewportZoomLocked,
  type ToolType,
} from "../../store/selection";

const tools: { id: ToolType; label: string; icon: string; shortcut: string }[] = [
  { id: "select", label: "选择", icon: "↖", shortcut: "V" },
  { id: "brush", label: "笔刷", icon: "✏️", shortcut: "B" },
  { id: "eraser", label: "橡皮", icon: "🧹", shortcut: "E" },
  { id: "fill", label: "填充", icon: "🪣", shortcut: "G" },
  { id: "eyedropper", label: "吸管", icon: "💉", shortcut: "I" },
  { id: "entity", label: "实体", icon: "◇", shortcut: "N" },
];

export function ViewportHeader() {
  const zoom = viewportZoom.value;
  const locked = viewportZoomLocked.value;
  const isInteger = Math.abs(zoom - Math.round(zoom)) < 0.01;
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const formatZoom = (z: number) => {
    if (z === Math.floor(z)) return z.toFixed(0);
    return z.toFixed(1);
  };

  const commitEdit = () => {
    setEditing(false);
    const v = parseFloat(editValue);
    if (!isNaN(v) && v >= 0.25 && v <= 16) {
      window.dispatchEvent(
        new CustomEvent("mote-set-viewport-zoom", { detail: { zoom: v } })
      );
    }
  };

  const startEdit = () => {
    setEditValue(formatZoom(zoom));
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.select());
  };

  return (
    <div
      style={{
        height: 32,
        background: "var(--bg-header)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        padding: "0 8px",
        gap: 2,
        flexShrink: 0,
      }}
    >
      {tools.map((t) => (
        <button
          key={t.id}
          title={`${t.label} (${t.shortcut})`}
          onClick={() => {
            activeTool.value = t.id;
          }}
          style={{
            background:
              activeTool.value === t.id ? "var(--accent)" : "transparent",
            border: "none",
            borderRadius: 3,
            padding: "2px 8px",
            cursor: "pointer",
            fontSize: t.id === "select" ? 16 : 14,
            fontWeight: t.id === "select" ? 700 : 400,
          }}
        >
          {t.icon}
        </button>
      ))}

      <div style={{ flex: 1 }} />

      {/* Zoom input / display */}
      <span
        style={{
          fontSize: 11,
          fontFamily: "monospace",
          marginRight: 2,
          color: "var(--text-secondary)",
        }}
      >
        ×
      </span>
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onInput={(e) => setEditValue((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit();
            if (e.key === "Escape") setEditing(false);
          }}
          onBlur={commitEdit}
          style={{
            width: 40,
            height: 20,
            fontSize: 11,
            fontFamily: "monospace",
            textAlign: "center",
            padding: "0 2px",
            border: "1px solid var(--accent)",
            borderRadius: 3,
            background: "var(--bg-input)",
            color: "var(--text-bright)",
            outline: "none",
          }}
        />
      ) : (
        <span
          onClick={startEdit}
          title="点击输入精确缩放值 (0.25 ~ 16)"
          style={{
            fontSize: 11,
            color: isInteger ? "var(--accent)" : "var(--text-secondary)",
            fontWeight: isInteger ? 600 : 400,
            fontFamily: "monospace",
            cursor: "text",
            padding: "1px 4px",
            borderRadius: 3,
            border: "1px solid transparent",
            minWidth: 28,
            textAlign: "center",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor =
              "var(--border)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "transparent";
          }}
        >
          {formatZoom(zoom)}
        </span>
      )}

      {/* Lock button */}
      <button
        onClick={() => {
          viewportZoomLocked.value = !locked;
        }}
        title={locked ? "解锁缩放" : "锁定缩放"}
        style={{
          background: locked ? "var(--accent)" : "transparent",
          border: locked
            ? "1px solid var(--accent)"
            : "1px solid var(--border)",
          borderRadius: 3,
          padding: "1px 5px",
          cursor: "pointer",
          fontSize: 12,
          lineHeight: 1,
          color: locked ? "#fff" : "var(--text-secondary)",
          marginLeft: 2,
        }}
      >
        {locked ? "🔒" : "🔓"}
      </button>
    </div>
  );
}

```

<!-- src/hooks/useDrag.ts -->
<a id="src-hooks-useDrag_ts"></a>

## src/hooks/useDrag.ts

```ts
import { useCallback, useRef } from 'preact/hooks';

interface DragCallbacks {
  onStart?: (e: PointerEvent) => void;
  onMove?: (e: PointerEvent) => void;
  onEnd?: (e: PointerEvent) => void;
}

export function useDrag(callbacks: DragCallbacks) {
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  const onPointerDown = useCallback((e: PointerEvent) => {
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    cbRef.current.onStart?.(e);

    const onMove = (ev: PointerEvent) => {
      cbRef.current.onMove?.(ev);
    };
    const onUp = (ev: PointerEvent) => {
      target.releasePointerCapture(ev.pointerId);
      target.removeEventListener('pointermove', onMove as EventListener);
      target.removeEventListener('pointerup', onUp as EventListener);
      cbRef.current.onEnd?.(ev);
    };
    target.addEventListener('pointermove', onMove as EventListener);
    target.addEventListener('pointerup', onUp as EventListener);
  }, []);

  return { onPointerDown };
}

```

<!-- src/index.css -->
<a id="src-index_css"></a>

## src/index.css

```css
/* ---- Mote Editor - Dark Theme ---- */
:root {
  --bg-base: #1e1e1e;
  --bg-area: #252526;
  --bg-header: #2d2d2d;
  --bg-input: #3c3c3c;
  --border: #3e3e3e;
  --border-active: #4a90d9;
  --text-primary: #cccccc;
  --text-secondary: #888888;
  --text-bright: #e0e0e0;
  --accent: #4a90d9;
  --accent-hover: #5da0e9;
  --danger: #d94a4a;
  --handle-hover: #4a90d9;
  --panel-header: #333333;
  --selection: rgba(74, 144, 217, 0.3);
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #app {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: var(--bg-base);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif;
  font-size: 12px;
  user-select: none;
}

input, select, button {
  font-family: inherit;
  font-size: inherit;
  color: var(--text-primary);
}

input[type="text"], input[type="number"], select {
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 2px 6px;
  height: 22px;
  outline: none;
}

input[type="text"]:focus, input[type="number"]:focus, select:focus {
  border-color: var(--accent);
}

input[type="range"] {
  -webkit-appearance: none;
  appearance: none;
  height: 4px;
  background: var(--border);
  border-radius: 2px;
  outline: none;
}

input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--accent);
  cursor: pointer;
}

button {
  background: var(--bg-input);
  border: 1px solid var(--border);
  border-radius: 3px;
  padding: 2px 10px;
  height: 24px;
  cursor: pointer;
}

button:hover {
  background: var(--border);
}

button:active {
  background: var(--accent);
}

/* Thin scrollbar (global) */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: transparent;
}

::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.25);
}

/* Firefox thin scrollbar */
* {
  scrollbar-width: thin;
  scrollbar-color: rgba(255, 255, 255, 0.15) transparent;
}

canvas {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

```

<!-- src/layout/rect.ts -->
<a id="src-layout-rect_ts"></a>

## src/layout/rect.ts

```ts
import { LayoutNode, Rect, RectMap, SplitInfo } from './types';

export const HANDLE_SIZE = 4;

export function computeRects(
  node: LayoutNode,
  bounds: Rect,
  areas: RectMap,
  splits: SplitInfo[]
): void {
  if (node.type === 'area') {
    areas.set(node.id, { ...bounds });
    return;
  }

  const { direction, ratio, children, id } = node;

  if (direction === 'horizontal') {
    const splitY = bounds.y + Math.round(bounds.h * ratio);
    const topH = splitY - bounds.y - HANDLE_SIZE / 2;
    const bottomY = splitY + HANDLE_SIZE / 2;
    const bottomH = bounds.y + bounds.h - bottomY;

    splits.push({
      splitId: id,
      direction: 'horizontal',
      rect: { x: bounds.x, y: splitY - HANDLE_SIZE / 2, w: bounds.w, h: HANDLE_SIZE },
      parentBounds: { ...bounds },
    });

    computeRects(children[0], { x: bounds.x, y: bounds.y, w: bounds.w, h: topH }, areas, splits);
    computeRects(children[1], { x: bounds.x, y: bottomY, w: bounds.w, h: bottomH }, areas, splits);
  } else {
    const splitX = bounds.x + Math.round(bounds.w * ratio);
    const leftW = splitX - bounds.x - HANDLE_SIZE / 2;
    const rightX = splitX + HANDLE_SIZE / 2;
    const rightW = bounds.x + bounds.w - rightX;

    splits.push({
      splitId: id,
      direction: 'vertical',
      rect: { x: splitX - HANDLE_SIZE / 2, y: bounds.y, w: HANDLE_SIZE, h: bounds.h },
      parentBounds: { ...bounds },
    });

    computeRects(children[0], { x: bounds.x, y: bounds.y, w: leftW, h: bounds.h }, areas, splits);
    computeRects(children[1], { x: rightX, y: bounds.y, w: rightW, h: bounds.h }, areas, splits);
  }
}

```

<!-- src/layout/tree.ts -->
<a id="src-layout-tree_ts"></a>

## src/layout/tree.ts

```ts
import { LayoutNode, AreaNode, SplitNode } from './types';

let nextId = 1;
function genId(prefix: string) {
  return `${prefix}_${nextId++}`;
}

export function mapNode(
  root: LayoutNode,
  fn: (node: LayoutNode) => LayoutNode | null
): LayoutNode {
  const result = fn(root);
  if (result !== null) return result;
  if (root.type === 'area') return root;
  return {
    ...root,
    children: [
      mapNode(root.children[0], fn),
      mapNode(root.children[1], fn),
    ],
  } as SplitNode;
}

export function splitArea(
  root: LayoutNode,
  areaId: string,
  direction: 'horizontal' | 'vertical',
  ratio = 0.5
): LayoutNode {
  return mapNode(root, (node) => {
    if (node.type === 'area' && node.id === areaId) {
      const newArea: AreaNode = { type: 'area', id: genId('area'), editorType: node.editorType };
      const split: SplitNode = {
        type: 'split',
        id: genId('split'),
        direction,
        ratio,
        children: [{ ...node }, newArea],
      };
      return split;
    }
    return null;
  });
}

export function resizeSplit(
  root: LayoutNode,
  splitId: string,
  newRatio: number
): LayoutNode {
  const clamped = Math.max(0.1, Math.min(0.9, newRatio));
  return mapNode(root, (node) => {
    if (node.type === 'split' && node.id === splitId) {
      return { ...node, ratio: clamped };
    }
    return null;
  });
}

export function setEditorType(
  root: LayoutNode,
  areaId: string,
  editorType: string
): LayoutNode {
  return mapNode(root, (node) => {
    if (node.type === 'area' && node.id === areaId) {
      return { ...node, editorType };
    }
    return null;
  });
}

export function collectAreas(root: LayoutNode): AreaNode[] {
  if (root.type === 'area') return [root];
  return [
    ...collectAreas(root.children[0]),
    ...collectAreas(root.children[1]),
  ];
}

export function findArea(root: LayoutNode, areaId: string): AreaNode | null {
  if (root.type === 'area') return root.id === areaId ? root : null;
  return findArea(root.children[0], areaId) || findArea(root.children[1], areaId);
}

```

<!-- src/layout/types.ts -->
<a id="src-layout-types_ts"></a>

## src/layout/types.ts

```ts
export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AreaNode {
  type: 'area';
  id: string;
  editorType: string;
}

export interface SplitNode {
  type: 'split';
  id: string;
  direction: 'horizontal' | 'vertical';
  ratio: number;
  children: [LayoutNode, LayoutNode];
}

export type LayoutNode = AreaNode | SplitNode;

export interface SplitInfo {
  splitId: string;
  direction: 'horizontal' | 'vertical';
  rect: Rect;
  /** Parent bounds — needed to calculate ratio correctly for nested splits */
  parentBounds: Rect;
}

export type RectMap = Map<string, Rect>;

```

<!-- src/main.tsx -->
<a id="src-main_tsx"></a>

## src/main.tsx

```tsx
import './index.css';
import { render } from 'preact';
import { App } from './App';

render(<App />, document.getElementById('app')!);

```

<!-- src/store/atlas.ts -->
<a id="src-store-atlas_ts"></a>

## src/store/atlas.ts

```ts
import { signal, computed } from "@preact/signals";
import type { SpriteAtlas, SpriteFrame } from "../data/SpriteAtlas";

/** All loaded sprite atlases */
export const spriteAtlases = signal<SpriteAtlas[]>([]);

/** Atlas image cache: atlas.id -> HTMLImageElement */
export const atlasImages = signal<Map<string, HTMLImageElement>>(new Map());

/** Currently selected atlas ID (for the sprite panel) */
export const activeAtlasId = signal<string | null>(null);

/** Currently selected frame ID within the active atlas */
export const activeFrameId = signal<string | null>(null);

/** Get the active atlas object */
export const activeAtlas = computed((): SpriteAtlas | null => {
  const id = activeAtlasId.value;
  if (!id) return null;
  return spriteAtlases.value.find((a) => a.id === id) ?? null;
});

/** Get the active frame object */
export const activeFrame = computed((): SpriteFrame | null => {
  const atlas = activeAtlas.value;
  const fid = activeFrameId.value;
  if (!atlas || !fid) return null;
  return atlas.frameMap.get(fid) ?? null;
});

// ---- Atlas CRUD ----

export function addAtlas(atlas: SpriteAtlas, img: HTMLImageElement): void {
  spriteAtlases.value = [...spriteAtlases.value, atlas];
  const newImages = new Map(atlasImages.value);
  newImages.set(atlas.id, img);
  atlasImages.value = newImages;
  activeAtlasId.value = atlas.id;
}

export function removeAtlas(id: string): void {
  spriteAtlases.value = spriteAtlases.value.filter((a) => a.id !== id);
  const newImages = new Map(atlasImages.value);
  newImages.delete(id);
  atlasImages.value = newImages;
  if (activeAtlasId.value === id) {
    activeAtlasId.value = spriteAtlases.value[0]?.id ?? null;
  }
}

```

<!-- src/store/history.ts -->
<a id="src-store-history_ts"></a>

## src/store/history.ts

```ts
import { signal } from "@preact/signals";

// ---------------------------------------------------------------------------
// Command interface
// ---------------------------------------------------------------------------

export interface Command {
  /** Human-readable label, e.g. "绘制 tile", "添加图层" */
  readonly label: string;
  /** Execute (or re-do) the command */
  execute(): void;
  /** Reverse the command */
  undo(): void;
}

// ---------------------------------------------------------------------------
// History manager – singleton, reactive via Preact Signals
// ---------------------------------------------------------------------------

const MAX_UNDO = 100;

const undoStack = signal<Command[]>([]);
const redoStack = signal<Command[]>([]);

/** Whether an undo operation is available */
export const canUndo = signal(false);
/** Whether a redo operation is available */
export const canRedo = signal(false);
/** Label of the next undo command */
export const undoLabel = signal("");
/** Label of the next redo command */
export const redoLabel = signal("");

function sync() {
  const us = undoStack.value;
  const rs = redoStack.value;
  canUndo.value = us.length > 0;
  canRedo.value = rs.length > 0;
  undoLabel.value = us.length > 0 ? us[us.length - 1].label : "";
  redoLabel.value = rs.length > 0 ? rs[rs.length - 1].label : "";
}

/** Execute a command and push it onto the undo stack */
export function executeCommand(cmd: Command): void {
  cmd.execute();

  const us = [...undoStack.value, cmd];
  // Enforce max stack depth
  if (us.length > MAX_UNDO) {
    us.splice(0, us.length - MAX_UNDO);
  }
  undoStack.value = us;
  // New action clears the redo stack
  redoStack.value = [];
  sync();
}

/** Undo the last command */
export function undo(): boolean {
  const us = [...undoStack.value];
  const cmd = us.pop();
  if (!cmd) return false;
  cmd.undo();
  undoStack.value = us;
  redoStack.value = [...redoStack.value, cmd];
  sync();
  return true;
}

/** Redo the last undone command */
export function redo(): boolean {
  const rs = [...redoStack.value];
  const cmd = rs.pop();
  if (!cmd) return false;
  cmd.execute();
  redoStack.value = rs;
  undoStack.value = [...undoStack.value, cmd];
  sync();
  return true;
}

/** Clear all history (e.g. on new project load) */
export function clearHistory(): void {
  undoStack.value = [];
  redoStack.value = [];
  sync();
}

```

<!-- src/store/layout.ts -->
<a id="src-store-layout_ts"></a>

## src/store/layout.ts

```ts
import { signal, computed } from '@preact/signals';
import { LayoutNode, Rect, RectMap, SplitInfo } from '../layout/types';
import { computeRects } from '../layout/rect';

/**
 * Default layout (4 panels):
 * Left: Viewport (65%)
 * Right: top = TilePalette (33%) | middle = SpritePanel (33%) | bottom = Inspector (34%)
 *   Implemented as nested splits: right = split(palette | split(sprite-panel | inspector))
 */
const defaultLayout: LayoutNode = {
  type: 'split',
  id: 'root_split',
  direction: 'vertical',
  ratio: 0.65,
  children: [
    { type: 'area', id: 'area_viewport', editorType: 'viewport' },
    {
      type: 'split',
      id: 'split_right',
      direction: 'horizontal',
      ratio: 0.33,
      children: [
        { type: 'area', id: 'area_palette', editorType: 'tile-palette' },
        {
          type: 'split',
          id: 'split_right_bottom',
          direction: 'horizontal',
          ratio: 0.5,
          children: [
            { type: 'area', id: 'area_sprite_panel', editorType: 'sprite-panel' },
            { type: 'area', id: 'area_inspector', editorType: 'inspector' },
          ],
        },
      ],
    },
  ],
};

export const layoutTree = signal<LayoutNode>(defaultLayout);
export const containerSize = signal<Rect>({ x: 0, y: 0, w: 1200, h: 800 });

export const layoutComputed = computed<{ areas: RectMap; splits: SplitInfo[] }>(() => {
  const areas: RectMap = new Map();
  const splits: SplitInfo[] = [];
  computeRects(layoutTree.value, containerSize.value, areas, splits);
  return { areas, splits };
});

```

<!-- src/store/project.ts -->
<a id="src-store-project_ts"></a>

## src/store/project.ts

```ts
import { signal, computed } from "@preact/signals";
import type { TileSet } from "../data/TileSet";
import type { TileMap, TileLayer, EntityLayer } from "../data/TileMap";
import { createTileMap, isTileLayer, isEntityLayer } from "../data/TileMap";
import { createTileSet } from "../data/TileSet";
import {
  readJsonFile,
  detectJsonType,
  tileSetFromJson,
  importBundle,
  importStandaloneMap,
  loadImageFromFile,
} from "../data/io";
import type {
  TileSetJson,
  TileMapBundleJson,
  TileMapStandaloneJson,
} from "../data/io";
import { activeTilesetId, displayScale, displayScaleLocked } from "./selection";

// ---- TileSets ----
export const tilesets = signal<TileSet[]>([]);
export const tilesetImages = signal<Map<string, HTMLImageElement>>(new Map());

// ---- TileMap ----
export const currentMap = signal<TileMap>(
  createTileMap("map_1", "level_01", 30, 20, 16, 16)
);

// ---- Active layer ----
export const activeLayerId = signal<string>("layer_bg");

export const activeLayer = computed(() => {
  const map = currentMap.value;
  return map.layers.find((l) => l.id === activeLayerId.value) ?? map.layers[0];
});

/** Active layer narrowed to TileLayer, or null */
export const activeTileLayer = computed((): TileLayer | null => {
  const layer = activeLayer.value;
  return layer && isTileLayer(layer) ? layer : null;
});

/** Active layer narrowed to EntityLayer, or null */
export const activeEntityLayer = computed((): EntityLayer | null => {
  const layer = activeLayer.value;
  return layer && isEntityLayer(layer) ? layer : null;
});

// Force re-render trigger (increment after map data mutation)
export const mapVersion = signal(0);
export const bumpMapVersion = () => {
  mapVersion.value++;
};

// ---- Last import (for Redo Panel) ----
export const lastImportedTilesetId = signal<string | null>(null);

// ---- TileSet CRUD ----

/** Update a TileSet's slice parameters and recalculate derived fields */
export function updateTileSetParams(
  id: string,
  params: {
    tileWidth?: number;
    tileHeight?: number;
    margin?: number;
    spacing?: number;
    name?: string;
  }
) {
  const ts = tilesets.value.find((t) => t.id === id);
  if (!ts) return;

  const newTs = createTileSet(
    ts.id,
    params.name ?? ts.name,
    ts.imageUrl,
    ts.imageWidth,
    ts.imageHeight,
    params.tileWidth ?? ts.tileWidth,
    params.tileHeight ?? ts.tileHeight,
    params.margin ?? ts.margin,
    params.spacing ?? ts.spacing
  );
  // Preserve tileData
  newTs.tileData = ts.tileData;

  tilesets.value = tilesets.value.map((t) => (t.id === id ? newTs : t));
  bumpMapVersion();
}

/** Remove a TileSet and clean up references */
export function removeTileSet(id: string) {
  tilesets.value = tilesets.value.filter((t) => t.id !== id);
  const newImages = new Map(tilesetImages.value);
  newImages.delete(id);
  tilesetImages.value = newImages;

  // Remove from map refs
  const map = currentMap.value;
  currentMap.value = {
    ...map,
    tilesets: map.tilesets.filter((r) => r.tilesetId !== id),
  };
  bumpMapVersion();
}

// ---- Auto display scale calculation ----

/** Calculate optimal display scale for a tile width. Skipped when locked. */
function autoDisplayScale(tileWidth: number): void {
  if (displayScaleLocked.value) return;
  const raw = 32 / tileWidth;
  // Snap to nearest step from DISPLAY_SCALE_STEPS
  if (raw <= 0.25) {
    displayScale.value = 0.25;
  } else if (raw <= 0.5) {
    displayScale.value = 0.5;
  } else {
    displayScale.value = Math.max(1, Math.round(raw));
  }
}

// ---- Import TileSet from JSON file ----

export async function importTileSetFromFiles(
  jsonFile: File,
  imageFile: File
): Promise<void> {
  const raw = await readJsonFile(jsonFile);
  const json = raw as TileSetJson;
  if (json.type !== "mote-tileset") {
    throw new Error("Invalid tileset file format");
  }

  const { url, img } = await loadImageFromFile(imageFile);
  const ts = tileSetFromJson(json, url);

  // Deduplicate ID
  const existingIds = new Set(tilesets.value.map((t) => t.id));
  if (existingIds.has(ts.id)) {
    ts.id = `${ts.id}_${Date.now()}`;
  }

  tilesets.value = [...tilesets.value, ts];
  const newImages = new Map(tilesetImages.value);
  newImages.set(ts.id, img);
  tilesetImages.value = newImages;

  activeTilesetId.value = ts.id;

  // Auto-add to current map
  const map = currentMap.value;
  const maxGid = map.tilesets.reduce((max, ref) => {
    const t = tilesets.value.find((t) => t.id === ref.tilesetId);
    return Math.max(max, ref.firstGid + (t?.tileCount ?? 0));
  }, 1);
  currentMap.value = {
    ...map,
    tilesets: [...map.tilesets, { tilesetId: ts.id, firstGid: maxGid }],
  };

  // Update display scale (respects lock)
  autoDisplayScale(ts.tileWidth);
  bumpMapVersion();
}

// ---- Import TileMap ----

export async function importTileMapFromFile(file: File): Promise<void> {
  const raw = await readJsonFile(file);
  const type = detectJsonType(raw);

  if (type === "mote-tilemap-bundle") {
    const result = await importBundle(raw as TileMapBundleJson);
    currentMap.value = result.map;
    tilesets.value = result.tilesets;
    tilesetImages.value = result.images;
    if (result.map.layers.length > 0) {
      activeLayerId.value = result.map.layers[0].id;
    }
    if (result.tilesets.length > 0) {
      activeTilesetId.value = result.tilesets[0].id;
      autoDisplayScale(result.tilesets[0].tileWidth);
    }
    bumpMapVersion();
    return;
  }

  if (type === "mote-tilemap") {
    const { map, missingTilesets } = importStandaloneMap(
      raw as TileMapStandaloneJson
    );
    currentMap.value = map;
    if (map.layers.length > 0) {
      activeLayerId.value = map.layers[0].id;
    }

    if (missingTilesets.length > 0) {
      // Prompt user to select tileset + image files
      const input = document.createElement("input");
      input.type = "file";
      input.multiple = true;
      input.accept = ".json,.png,.jpg,.jpeg,.webp";
      input.onchange = async () => {
        const files = Array.from(input.files ?? []);
        const jsonFiles = files.filter((f) => f.name.endsWith(".json"));
        const imageFiles = files.filter((f) => !f.name.endsWith(".json"));

        for (const missing of missingTilesets) {
          // Try to find matching JSON file
          const tsJsonFile = jsonFiles.find((f) => f.name === missing.source);
          if (!tsJsonFile) continue;

          const tsRaw = await readJsonFile(tsJsonFile);
          const tsJson = tsRaw as TileSetJson;
          if (tsJson.type !== "mote-tileset") continue;

          // Find matching image
          const imgFile = imageFiles.find(
            (f) => f.name === tsJson.image || f.name.startsWith(tsJson.name)
          );
          if (!imgFile) continue;

          const { url, img } = await loadImageFromFile(imgFile);
          const ts = tileSetFromJson(tsJson, url);
          tilesets.value = [...tilesets.value, ts];
          const newImages = new Map(tilesetImages.value);
          newImages.set(ts.id, img);
          tilesetImages.value = newImages;

          // Add ref to map
          const m = currentMap.value;
          currentMap.value = {
            ...m,
            tilesets: [
              ...m.tilesets,
              { tilesetId: ts.id, firstGid: missing.firstGid },
            ],
          };
        }

        if (tilesets.value.length > 0) {
          activeTilesetId.value = tilesets.value[0].id;
          autoDisplayScale(tilesets.value[0].tileWidth);
        }
        bumpMapVersion();
      };
      input.click();
    }
    bumpMapVersion();
    return;
  }

  throw new Error("Unknown file format");
}

```

<!-- src/store/selection.ts -->
<a id="src-store-selection_ts"></a>

## src/store/selection.ts

```ts
import { signal } from "@preact/signals";

export type ToolType = "select" | "brush" | "eraser" | "fill" | "eyedropper" | "entity";

export const activeTool = signal<ToolType>("brush");

/** Currently selected tile GIDs forming the brush */
export const brushTiles = signal<number[]>([]);
export const brushWidth = signal(1);
export const brushHeight = signal(1);

/** Which tileset is shown in the palette */
export const activeTilesetId = signal<string | null>(null);

/** Hovered tile coord in the viewport */
export const hoverTile = signal<{ x: number; y: number } | null>(null);

/**
 * Editor display scale for TilePalette.
 * Supports fractional values like 0.25, 0.5, 1, 2, 4, 8.
 * Controls tile display size: displaySize = tileWidth * displayScale.
 */
export const displayScale = signal(1);

/** Whether TilePalette display scale is locked (prevents auto-calculation on import) */
export const displayScaleLocked = signal(false);

/** Current viewport zoom level */
export const viewportZoom = signal(1);

/** Whether viewport zoom is locked (prevents scroll/keyboard zoom) */
export const viewportZoomLocked = signal(false);

/** Whether to show the tile grid in the viewport */
export const showGrid = signal(true);

/** Grid line color */
export const gridColor = signal("rgba(255, 255, 255, 0.08)");

/** Currently selected EntityDef ID for placement */
export const activeEntityDefId = signal<string | null>(null);

/** Currently selected entity instance ID (for inspection/editing) */
export const selectedEntityId = signal<string | null>(null);



/**
 * Predefined scale steps for TilePalette.
 * Includes fractional (1/4, 1/2) and integer (1-8) values.
 */
export const DISPLAY_SCALE_STEPS = [0.25, 0.5, 1, 2, 3, 4, 5, 6, 7, 8];

/** Format display scale as human-readable string: 0.25->"1/4", 0.5->"1/2", 2->"2" */
export function formatDisplayScale(v: number): string {
  if (v === 0.25) return "1/4";
  if (v === 0.5) return "1/2";
  return String(v);
}

/** Parse user input string to display scale number. Supports "1/4", "0.25", "2", etc. */
export function parseDisplayScale(raw: string): number | null {
  const s = raw.trim();
  const fracMatch = s.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fracMatch) {
    const num = parseInt(fracMatch[1]);
    const den = parseInt(fracMatch[2]);
    if (den === 0) return null;
    const val = num / den;
    if (val >= 0.25 && val <= 8) return val;
    return null;
  }
  const val = parseFloat(s);
  if (isNaN(val) || val < 0.25 || val > 8) return null;
  return val;
}

```

<!-- src/store/tileSelection.ts -->
<a id="src-store-tileSelection_ts"></a>

## src/store/tileSelection.ts

```ts
import { signal } from "@preact/signals";

export interface TileSelection {
  /** Top-left tile coords of the selection box */
  x: number;
  y: number;
  /** Width/height in tiles */
  w: number;
  h: number;
  /** The selected tile data (gids), row-major. null = no floating selection */
  tiles: number[] | null;
  /** Which layer the selection was cut from */
  layerId: string;
}

export const tileSelection = signal<TileSelection | null>(null);

```

