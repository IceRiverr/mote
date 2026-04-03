<!--
================================================================================
CODE EXPORT - Markdown Format
================================================================================
Project: packages/editor
Generated: 2026-04-03T01:09:29.614Z
Total Files: 34
Source Directory: src
================================================================================
-->

# 📦 Code Export - packages/editor

> 导出时间: `2026-04-03T01:09:29.614Z`
> 文件数量: `34` 个
> 源目录: `src`

---

## 📁 文件清单

```
src/
├── App.tsx
├── components/
│   ├── AreaView.tsx
│   ├── EditorSwitcher.tsx
│   ├── LayoutRoot.tsx
│   └── SplitHandle.tsx
├── core/
│   └── Command.ts
├── data/
│   ├── export.ts
│   ├── TileMap.ts
│   └── TileSet.ts
├── editors/
│   ├── inspector/
│   │   ├── InspectorEditor.tsx
│   │   └── panels/
│   │       ├── ExportPanel.tsx
│   │       ├── LayersPanel.tsx
│   │       ├── MapPropsPanel.tsx
│   │       ├── PanelShell.tsx
│   │       └── TileSetsPanel.tsx
│   ├── registry.ts
│   ├── tile-palette/
│   │   ├── PaletteCanvas.tsx
│   │   ├── PaletteHeader.tsx
│   │   ├── RedoPanel.tsx
│   │   └── TilePaletteEditor.tsx
│   └── viewport/
│       ├── ViewportCanvas.tsx
│       ├── ViewportEditor.tsx
│       ├── ViewportFooter.tsx
│       └── ViewportHeader.tsx
├── hooks/
│   ├── useCanvas.ts
│   └── useDrag.ts
├── index.css
├── layout/
│   ├── rect.ts
│   ├── tree.ts
│   └── types.ts
├── main.tsx
└── store/
    ├── layout.ts
    ├── project.ts
    └── selection.ts
```

---

## 📋 文件详情

### 快速导航

- [App.tsx](#app-tsx)
- [components/AreaView.tsx](#components-areaview-tsx)
- [components/EditorSwitcher.tsx](#components-editorswitcher-tsx)
- [components/LayoutRoot.tsx](#components-layoutroot-tsx)
- [components/SplitHandle.tsx](#components-splithandle-tsx)
- [core/Command.ts](#core-command-ts)
- [data/export.ts](#data-export-ts)
- [data/TileMap.ts](#data-tilemap-ts)
- [data/TileSet.ts](#data-tileset-ts)
- [editors/inspector/InspectorEditor.tsx](#editors-inspector-inspectoreditor-tsx)
- [editors/inspector/panels/ExportPanel.tsx](#editors-inspector-panels-exportpanel-tsx)
- [editors/inspector/panels/LayersPanel.tsx](#editors-inspector-panels-layerspanel-tsx)
- [editors/inspector/panels/MapPropsPanel.tsx](#editors-inspector-panels-mappropspanel-tsx)
- [editors/inspector/panels/PanelShell.tsx](#editors-inspector-panels-panelshell-tsx)
- [editors/inspector/panels/TileSetsPanel.tsx](#editors-inspector-panels-tilesetspanel-tsx)
- [editors/registry.ts](#editors-registry-ts)
- [editors/tile-palette/PaletteCanvas.tsx](#editors-tile-palette-palettecanvas-tsx)
- [editors/tile-palette/PaletteHeader.tsx](#editors-tile-palette-paletteheader-tsx)
- [editors/tile-palette/RedoPanel.tsx](#editors-tile-palette-redopanel-tsx)
- [editors/tile-palette/TilePaletteEditor.tsx](#editors-tile-palette-tilepaletteeditor-tsx)
- [editors/viewport/ViewportCanvas.tsx](#editors-viewport-viewportcanvas-tsx)
- [editors/viewport/ViewportEditor.tsx](#editors-viewport-viewporteditor-tsx)
- [editors/viewport/ViewportFooter.tsx](#editors-viewport-viewportfooter-tsx)
- [editors/viewport/ViewportHeader.tsx](#editors-viewport-viewportheader-tsx)
- [hooks/useCanvas.ts](#hooks-usecanvas-ts)
- [hooks/useDrag.ts](#hooks-usedrag-ts)
- [index.css](#index-css)
- [layout/rect.ts](#layout-rect-ts)
- [layout/tree.ts](#layout-tree-ts)
- [layout/types.ts](#layout-types-ts)
- [main.tsx](#main-tsx)
- [store/layout.ts](#store-layout-ts)
- [store/project.ts](#store-project-ts)
- [store/selection.ts](#store-selection-ts)

---

## 📄 App.tsx

```tsx
import { LayoutRoot } from "./components/LayoutRoot";

// Register all editors (side effects)
import "./editors/viewport/ViewportEditor";
import "./editors/tile-palette/TilePaletteEditor";
import "./editors/inspector/InspectorEditor";

export function App() {
  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Global top bar */}
      <div
        style={{
          height: 36,
          background: "#1a1a1a",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          gap: 12,
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 700, color: "var(--accent)", fontSize: 13, letterSpacing: 1 }}>
          微尘 EDITOR
        </span>
        <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>
          Tilemap 工作区
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ color: "var(--text-secondary)", fontSize: 10 }}>v0.1.0</span>
      </div>

      {/* Layout area */}
      <div style={{ flex: 1, position: "relative" }}>
        <LayoutRoot />
      </div>
    </div>
  );
}

```

## 📄 components/AreaView.tsx

```tsx
import type { AreaNode, Rect } from "../layout/types";
import { getEditor } from "../editors/registry";

interface Props {
  area: AreaNode;
  rect: Rect;
}

export function AreaView({ area, rect }: Props) {
  const def = getEditor(area.editorType);
  const Component = def?.component;

  return (
    <div
      style={{
        position: "absolute",
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        background: "var(--bg-area)",
        borderRadius: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {Component ? (
        <Component areaId={area.id} />
      ) : (
        <div style={{ padding: 16, color: "var(--text-secondary)" }}>
          Unknown: {area.editorType}
        </div>
      )}
    </div>
  );
}

```

## 📄 components/EditorSwitcher.tsx

```tsx
import { layoutTree } from "../store/layout";
import { setEditorType } from "../layout/tree";
import { getAllEditors } from "../editors/registry";

interface Props {
  areaId: string;
  current: string;
}

export function EditorSwitcher({ areaId, current }: Props) {
  const editors = getAllEditors();

  return (
    <select
      value={current}
      onChange={(e) => {
        const newType = (e.target as HTMLSelectElement).value;
        layoutTree.value = setEditorType(layoutTree.value, areaId, newType);
      }}
      style={{
        background: "transparent",
        border: "none",
        color: "var(--text-secondary)",
        fontSize: 11,
        cursor: "pointer",
        outline: "none",
      }}
    >
      {editors.map((ed) => (
        <option key={ed.id} value={ed.id}>
          {ed.icon} {ed.name}
        </option>
      ))}
    </select>
  );
}

```

## 📄 components/LayoutRoot.tsx

```tsx
import { useRef, useEffect } from "preact/hooks";
import { containerSize, layoutTree, layoutComputed } from "../store/layout";
import { collectAreas } from "../layout/tree";
import { AreaView } from "./AreaView";
import { SplitHandle } from "./SplitHandle";

export function LayoutRoot() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      containerSize.value = { width, height };
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const tree = layoutTree.value;
  const { areas: rectMap, splits } = layoutComputed.value;
  const areaNodes = collectAreas(tree);

  return (
    <div ref={ref} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      {areaNodes.map((area) => {
        const rect = rectMap.get(area.id);
        return rect ? <AreaView key={area.id} area={area} rect={rect} /> : null;
      })}
      {splits.map((s) => (
        <SplitHandle key={s.id} info={s} />
      ))}
    </div>
  );
}

```

## 📄 components/SplitHandle.tsx

```tsx
import type { SplitInfo } from "../layout/types";
import { layoutTree } from "../store/layout";
import { resizeSplit } from "../layout/tree";
import { useDrag } from "../hooks/useDrag";
import { HANDLE_SIZE } from "../layout/rect";
import { useRef } from "preact/hooks";

interface Props {
  info: SplitInfo;
}

export function SplitHandle({ info }: Props) {
  const { id, direction, ratio, rect } = info;
  const isVertical = direction === "vertical";
  const startRatio = useRef(ratio);

  const { onPointerDown } = useDrag({
    onStart: () => {
      startRatio.current = ratio;
      document.body.style.cursor = isVertical ? "col-resize" : "row-resize";
    },
    onMove: (_e, { dx, dy }) => {
      const delta = isVertical ? dx : dy;
      const total = isVertical ? rect.width : rect.height;
      if (total === 0) return;
      const newRatio = startRatio.current + delta / total;
      layoutTree.value = resizeSplit(layoutTree.value, id, newRatio);
    },
    onEnd: () => {
      document.body.style.cursor = "";
    },
  });

  const style = isVertical
    ? {
        left: rect.x + rect.width * ratio - HANDLE_SIZE / 2,
        top: rect.y,
        width: HANDLE_SIZE,
        height: rect.height,
        cursor: "col-resize" as const,
      }
    : {
        left: rect.x,
        top: rect.y + rect.height * ratio - HANDLE_SIZE / 2,
        width: rect.width,
        height: HANDLE_SIZE,
        cursor: "row-resize" as const,
      };

  return (
    <div
      onPointerDown={onPointerDown}
      style={{
        position: "absolute",
        ...style,
        zIndex: 100,
        background: "transparent",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "var(--handle-hover)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    />
  );
}

```

## 📄 core/Command.ts

```typescript
export interface Command {
  name: string;
  execute(): void;
  undo(): void;
}

export class CommandHistory {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];
  private _onChange?: () => void;

  constructor(onChange?: () => void) {
    this._onChange = onChange;
  }

  execute(cmd: Command) {
    cmd.execute();
    this.undoStack.push(cmd);
    this.redoStack = [];
    this._onChange?.();
  }

  undo() {
    const cmd = this.undoStack.pop();
    if (!cmd) return;
    cmd.undo();
    this.redoStack.push(cmd);
    this._onChange?.();
  }

  redo() {
    const cmd = this.redoStack.pop();
    if (!cmd) return;
    cmd.execute();
    this.undoStack.push(cmd);
    this._onChange?.();
  }

  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }
}

```

## 📄 data/export.ts

```typescript
import type { TileMap } from "./TileMap";
import type { TileSet } from "./TileSet";

export interface ExportData {
  version: "1.0";
  type: "tilemap";
  name: string;
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  tilesets: ExportTileSet[];
  layers: ExportLayer[];
}

interface ExportTileSet {
  name: string;
  image: string;
  tileWidth: number;
  tileHeight: number;
  columns: number;
  rows: number;
  firstGid: number;
  tileCount: number;
  margin: number;
  spacing: number;
}

interface ExportLayer {
  name: string;
  type: "tilelayer";
  visible: boolean;
  opacity: number;
  data: number[];
}

export function exportTileMap(
  map: TileMap,
  tilesets: Map<string, TileSet>
): ExportData {
  return {
    version: "1.0",
    type: "tilemap",
    name: map.name,
    width: map.width,
    height: map.height,
    tileWidth: map.tileWidth,
    tileHeight: map.tileHeight,
    tilesets: map.tilesets.map((ref) => {
      const ts = tilesets.get(ref.tilesetId)!;
      return {
        name: ts.name,
        image: ts.name + ".png",
        tileWidth: ts.tileWidth,
        tileHeight: ts.tileHeight,
        columns: ts.columns,
        rows: ts.rows,
        firstGid: ref.firstGid,
        tileCount: ts.tileCount,
        margin: ts.margin,
        spacing: ts.spacing,
      };
    }),
    layers: map.layers.map((layer) => ({
      name: layer.name,
      type: "tilelayer",
      visible: layer.visible,
      opacity: layer.opacity,
      data: Array.from(layer.data),
    })),
  };
}

export function downloadJson(data: ExportData) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${data.name}.weichen.json`;
  a.click();
  URL.revokeObjectURL(url);
}

```

## 📄 data/TileMap.ts

```typescript
export interface TileSetRef {
  tilesetId: string;
  firstGid: number;
}

export interface TileLayer {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  locked: boolean;
  data: number[];  // row-major, 0 = empty
}

export interface TileMap {
  id: string;
  name: string;
  width: number;       // columns
  height: number;      // rows
  tileWidth: number;   // render tile width (px)
  tileHeight: number;  // render tile height (px)
  tilesets: TileSetRef[];
  layers: TileLayer[];
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
      createLayer("layer_bg", "background"),
      createLayer("layer_fg", "foreground"),
    ],
  };

  function createLayer(id: string, name: string): TileLayer {
    return {
      id,
      name,
      visible: true,
      opacity: 1,
      locked: false,
      data: new Array(width * height).fill(0),
    };
  }
}

/** Resolve GID → tilesetId + localId */
export function resolveGid(
  map: TileMap,
  gid: number
): { tilesetId: string; localId: number } | null {
  if (gid <= 0) return null;
  // find the tileset with the highest firstGid <= gid
  let best: TileSetRef | null = null;
  for (const ref of map.tilesets) {
    if (ref.firstGid <= gid && (!best || ref.firstGid > best.firstGid)) {
      best = ref;
    }
  }
  if (!best) return null;
  return { tilesetId: best.tilesetId, localId: gid - best.firstGid };
}

```

## 📄 data/TileSet.ts

```typescript
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

## 📄 editors/inspector/InspectorEditor.tsx

```tsx
import { registerEditor } from "../registry";
import { MapPropsPanel } from "./panels/MapPropsPanel";
import { LayersPanel } from "./panels/LayersPanel";
import { TileSetsPanel } from "./panels/TileSetsPanel";
import { ExportPanel } from "./panels/ExportPanel";

function InspectorEditor({ areaId }: { areaId: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          height: 32,
          background: "var(--bg-header)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          padding: "0 8px",
          flexShrink: 0,
        }}
      >
        <span style={{ color: "var(--text-secondary)" }}>属性</span>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 0 }}>
        <MapPropsPanel />
        <LayersPanel />
        <TileSetsPanel />
        <ExportPanel />
      </div>
    </div>
  );
}

registerEditor({
  id: "inspector",
  name: "属性",
  icon: "⚙️",
  component: InspectorEditor,
});

export { InspectorEditor };

```

## 📄 editors/inspector/panels/ExportPanel.tsx

```tsx
import { currentMap, tilesets } from "../../../store/project";
import { exportTileMap, downloadJson } from "../../../data/export";
import { PanelShell } from "./PanelShell";

export function ExportPanel() {
  const handleExport = () => {
    const map = currentMap.value;
    const tsMap = new Map(tilesets.value.map((t) => [t.id, t]));
    const data = exportTileMap(map, tsMap);
    downloadJson(data);
  };

  return (
    <PanelShell title="导出">
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ color: "var(--text-secondary)", fontSize: 11 }}>
          导出为 .weichen.json 格式，可直接用于游戏引擎加载
        </div>
        <button onClick={handleExport} style={{ width: "100%" }}>
          导出地图数据
        </button>
      </div>
    </PanelShell>
  );
}

```

## 📄 editors/inspector/panels/LayersPanel.tsx

```tsx
import {
  currentMap,
  activeLayerId,
  bumpMapVersion,
} from "../../../store/project";
import { PanelShell } from "./PanelShell";

let layerUid = 10;

export function LayersPanel() {
  const map = currentMap.value;

  const addLayer = () => {
    const id = `layer_${++layerUid}`;
    const newLayer = {
      id,
      name: `layer_${map.layers.length + 1}`,
      visible: true,
      opacity: 1,
      locked: false,
      data: new Array(map.width * map.height).fill(0),
    };
    currentMap.value = {
      ...map,
      layers: [...map.layers, newLayer],
    };
    activeLayerId.value = id;
    bumpMapVersion();
  };

  const removeLayer = (id: string) => {
    if (map.layers.length <= 1) return;
    currentMap.value = {
      ...map,
      layers: map.layers.filter((l) => l.id !== id),
    };
    if (activeLayerId.value === id) {
      activeLayerId.value = currentMap.value.layers[0].id;
    }
    bumpMapVersion();
  };

  const toggleVisible = (id: string) => {
    currentMap.value = {
      ...map,
      layers: map.layers.map((l) =>
        l.id === id ? { ...l, visible: !l.visible } : l
      ),
    };
    bumpMapVersion();
  };

  const toggleLock = (id: string) => {
    currentMap.value = {
      ...map,
      layers: map.layers.map((l) =>
        l.id === id ? { ...l, locked: !l.locked } : l
      ),
    };
    bumpMapVersion();
  };

  return (
    <PanelShell title="图层">
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {[...map.layers].reverse().map((layer) => (
          <div
            key={layer.id}
            onClick={() => { activeLayerId.value = layer.id; }}
            style={{
              display: "flex",
              alignItems: "center",
              height: 26,
              padding: "0 4px",
              gap: 4,
              background:
                activeLayerId.value === layer.id
                  ? "var(--selection)"
                  : "transparent",
              borderRadius: 3,
              cursor: "pointer",
            }}
          >
            <button
              title={layer.visible ? "隐藏" : "显示"}
              onClick={(e) => { e.stopPropagation(); toggleVisible(layer.id); }}
              style={{
                border: "none",
                background: "transparent",
                padding: "0 2px",
                cursor: "pointer",
                opacity: layer.visible ? 1 : 0.3,
                fontSize: 12,
                width: 20,
                height: 20,
              }}
            >
              👁
            </button>
            <button
              title={layer.locked ? "解锁" : "锁定"}
              onClick={(e) => { e.stopPropagation(); toggleLock(layer.id); }}
              style={{
                border: "none",
                background: "transparent",
                padding: "0 2px",
                cursor: "pointer",
                opacity: layer.locked ? 1 : 0.3,
                fontSize: 12,
                width: 20,
                height: 20,
              }}
            >
              🔒
            </button>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11 }}>
              {layer.name}
            </span>
            <button
              title="删除图层"
              onClick={(e) => { e.stopPropagation(); removeLayer(layer.id); }}
              style={{
                border: "none",
                background: "transparent",
                padding: "0 2px",
                cursor: "pointer",
                color: "var(--danger)",
                fontSize: 11,
                width: 20,
                height: 20,
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button onClick={addLayer} style={{ width: "100%", marginTop: 4 }}>
        + 添加图层
      </button>
    </PanelShell>
  );
}

```

## 📄 editors/inspector/panels/MapPropsPanel.tsx

```tsx
import { currentMap, bumpMapVersion } from "../../../store/project";
import { PanelShell } from "./PanelShell";

export function MapPropsPanel() {
  const map = currentMap.value;

  const set = (key: string, value: any) => {
    currentMap.value = { ...map, [key]: value };
    bumpMapVersion();
  };

  return (
    <PanelShell title="地图属性">
      <Row label="名称">
        <input
          type="text"
          value={map.name}
          onInput={(e) => set("name", (e.target as HTMLInputElement).value)}
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
              const newMap = { ...map, width: w };
              newMap.layers = newMap.layers.map((l) => {
                const newData = new Array(w * map.height).fill(0);
                for (let y = 0; y < map.height; y++) {
                  for (let x = 0; x < Math.min(w, map.width); x++) {
                    newData[y * w + x] = l.data[y * map.width + x] ?? 0;
                  }
                }
                return { ...l, data: newData };
              });
              currentMap.value = newMap;
              bumpMapVersion();
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
              const newMap = { ...map, height: h };
              newMap.layers = newMap.layers.map((l) => {
                const newData = new Array(map.width * h).fill(0);
                for (let y = 0; y < Math.min(h, map.height); y++) {
                  for (let x = 0; x < map.width; x++) {
                    newData[y * map.width + x] = l.data[y * map.width + x] ?? 0;
                  }
                }
                return { ...l, data: newData };
              });
              currentMap.value = newMap;
              bumpMapVersion();
            }}
          />
          <span style={{ color: "var(--text-secondary)" }}>瓦片</span>
        </div>
      </Row>
      <Row label="瓦片大小">
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <input type="number" value={map.tileWidth} min={1} max={256} style={{ width: 50 }}
            onChange={(e) => set("tileWidth", parseInt((e.target as HTMLInputElement).value) || 16)} />
          <span>×</span>
          <input type="number" value={map.tileHeight} min={1} max={256} style={{ width: 50 }}
            onChange={(e) => set("tileHeight", parseInt((e.target as HTMLInputElement).value) || 16)} />
          <span style={{ color: "var(--text-secondary)" }}>px</span>
        </div>
      </Row>
    </PanelShell>
  );
}

function Row({ label, children }: { label: string; children: any }) {
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 4, gap: 8 }}>
      <span style={{ width: 56, flexShrink: 0, color: "var(--text-secondary)", fontSize: 11 }}>
        {label}
      </span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

```

## 📄 editors/inspector/panels/PanelShell.tsx

```tsx
import { useState } from "preact/hooks";
import type { ComponentChildren } from "preact";

interface Props {
  title: string;
  defaultOpen?: boolean;
  children: ComponentChildren;
}

export function PanelShell({ title, defaultOpen = true, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div style={{ borderBottom: "1px solid var(--border)" }}>
      <div
        onClick={() => setOpen(!open)}
        style={{
          height: 26,
          background: "var(--panel-header)",
          display: "flex",
          alignItems: "center",
          padding: "0 8px",
          cursor: "pointer",
          fontWeight: 500,
          fontSize: 11,
          color: "var(--text-bright)",
        }}
      >
        <span style={{ marginRight: 6, fontSize: 9 }}>{open ? "▼" : "▶"}</span>
        {title}
      </div>
      {open && (
        <div style={{ padding: "6px 10px" }}>
          {children}
        </div>
      )}
    </div>
  );
}

```

## 📄 editors/inspector/panels/TileSetsPanel.tsx

```tsx
import {
  tilesets,
  updateTileSetParams,
  removeTileSet,
} from "../../../store/project";
import { activeTilesetId } from "../../../store/selection";
import { PanelShell } from "./PanelShell";

export function TileSetsPanel() {
  return (
    <PanelShell title="瓦片集">
      {tilesets.value.length === 0 ? (
        <div
          style={{
            color: "var(--text-secondary)",
            fontSize: 11,
            padding: "4px 0",
          }}
        >
          在左侧瓦片面板中点击「导入」添加瓦片集
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {tilesets.value.map((ts) => {
            const isActive = activeTilesetId.value === ts.id;

            return (
              <div
                key={ts.id}
                style={{
                  background: isActive ? "var(--selection)" : "var(--bg-base)",
                  borderRadius: 4,
                  padding: "6px 8px",
                  cursor: "pointer",
                }}
                onClick={() => {
                  activeTilesetId.value = ts.id;
                }}
              >
                {/* Name + delete */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <input
                    type="text"
                    value={ts.name}
                    onInput={(e) =>
                      updateTileSetParams(ts.id, {
                        name: (e.target as HTMLInputElement).value,
                      })
                    }
                    onClick={(e) => e.stopPropagation()}
                    style={{ flex: 1, minWidth: 0, fontSize: 11 }}
                  />
                  <button
                    title="删除瓦片集"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTileSet(ts.id);
                    }}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--danger)",
                      cursor: "pointer",
                      padding: "0 4px",
                      fontSize: 11,
                      marginLeft: 4,
                    }}
                  >
                    ✕
                  </button>
                </div>

                {/* Tile size */}
                <Row label="瓦片">
                  <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <input
                      type="number"
                      value={ts.tileWidth}
                      min={1}
                      max={512}
                      style={{ width: 42 }}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        updateTileSetParams(ts.id, {
                          tileWidth: Math.max(
                            1,
                            parseInt((e.target as HTMLInputElement).value) || 1
                          ),
                        })
                      }
                    />
                    <span style={{ color: "var(--text-secondary)" }}>×</span>
                    <input
                      type="number"
                      value={ts.tileHeight}
                      min={1}
                      max={512}
                      style={{ width: 42 }}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        updateTileSetParams(ts.id, {
                          tileHeight: Math.max(
                            1,
                            parseInt((e.target as HTMLInputElement).value) || 1
                          ),
                        })
                      }
                    />
                    <span style={{ color: "var(--text-secondary)", fontSize: 10 }}>px</span>
                  </div>
                </Row>

                {/* Margin */}
                <Row label="边距">
                  <input
                    type="number"
                    value={ts.margin}
                    min={0}
                    max={128}
                    style={{ width: 42 }}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) =>
                      updateTileSetParams(ts.id, {
                        margin: Math.max(
                          0,
                          parseInt((e.target as HTMLInputElement).value) || 0
                        ),
                      })
                    }
                  />
                </Row>

                {/* Spacing */}
                <Row label="间距">
                  <input
                    type="number"
                    value={ts.spacing}
                    min={0}
                    max={128}
                    style={{ width: 42 }}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) =>
                      updateTileSetParams(ts.id, {
                        spacing: Math.max(
                          0,
                          parseInt((e.target as HTMLInputElement).value) || 0
                        ),
                      })
                    }
                  />
                </Row>

                {/* Computed info */}
                <div
                  style={{
                    marginTop: 4,
                    color: "var(--text-secondary)",
                    fontSize: 10,
                  }}
                >
                  {ts.columns}×{ts.rows} = {ts.tileCount} 瓦片 ·
                  原图 {ts.imageWidth}×{ts.imageHeight}px
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PanelShell>
  );
}

function Row({ label, children }: { label: string; children: any }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        marginBottom: 3,
        gap: 6,
      }}
    >
      <span
        style={{
          width: 30,
          flexShrink: 0,
          color: "var(--text-secondary)",
          fontSize: 10,
          textAlign: "right",
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}

```

## 📄 editors/registry.ts

```typescript
import type { ComponentType } from "preact";

interface EditorDef {
  id: string;
  name: string;
  icon: string;
  component: ComponentType<{ areaId: string }>;
}

const registry = new Map<string, EditorDef>();

export function registerEditor(def: EditorDef) {
  registry.set(def.id, def);
}

export function getEditor(id: string): EditorDef | undefined {
  return registry.get(id);
}

export function getAllEditors(): EditorDef[] {
  return Array.from(registry.values());
}

```

## 📄 editors/tile-palette/PaletteCanvas.tsx

```tsx
import { useRef, useEffect, useCallback } from "preact/hooks";
import { tilesets, tilesetImages, currentMap } from "../../store/project";
import {
  activeTilesetId,
  brushTiles,
  brushWidth,
  brushHeight,
} from "../../store/selection";
import { getTileSrcRect } from "../../data/TileSet";

const DISPLAY_TILE = 32; // display size per tile in palette

export function PaletteCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selStart = useRef<{ col: number; row: number } | null>(null);
  const selEnd = useRef<{ col: number; row: number } | null>(null);

  const getTs = () => {
    const id = activeTilesetId.value;
    return id ? tilesets.value.find((t) => t.id === id) ?? null : null;
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ts = getTs();
    const img = ts ? tilesetImages.value.get(ts.id) : null;

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

    if (!ts || !img) {
      ctx.fillStyle = "var(--text-secondary)";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("点击「导入」添加瓦片集", w / 2, h / 2);
      return;
    }

    // Draw tiles
    ctx.imageSmoothingEnabled = false;
    for (let r = 0; r < ts.rows; r++) {
      for (let c = 0; c < ts.columns; c++) {
        const localId = r * ts.columns + c;
        const src = getTileSrcRect(ts, localId);
        ctx.drawImage(
          img,
          src.sx, src.sy, src.sw, src.sh,
          c * DISPLAY_TILE, r * DISPLAY_TILE, DISPLAY_TILE, DISPLAY_TILE
        );
      }
    }

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    for (let c = 0; c <= ts.columns; c++) {
      ctx.beginPath();
      ctx.moveTo(c * DISPLAY_TILE, 0);
      ctx.lineTo(c * DISPLAY_TILE, ts.rows * DISPLAY_TILE);
      ctx.stroke();
    }
    for (let r = 0; r <= ts.rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * DISPLAY_TILE);
      ctx.lineTo(ts.columns * DISPLAY_TILE, r * DISPLAY_TILE);
      ctx.stroke();
    }

    // Selection highlight
    const bt = brushTiles.value;
    if (bt.length > 0) {
      // Find the selected tile range in this tileset
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
            startCol * DISPLAY_TILE,
            startRow * DISPLAY_TILE,
            brushWidth.value * DISPLAY_TILE,
            brushHeight.value * DISPLAY_TILE
          );
        }
      }
    }
  }, []);

  // Redraw on relevant signal changes
  useEffect(() => {
    draw();
  }, [
    activeTilesetId.value,
    tilesets.value,
    tilesetImages.value,
    brushTiles.value,
  ]);

  // Resize
  useEffect(() => {
    const el = containerRef.current!;
    const ro = new ResizeObserver(() => draw());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const screenToCell = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const ts = getTs();
    if (!ts) return null;
    const col = Math.floor((clientX - rect.left) / DISPLAY_TILE);
    const row = Math.floor((clientY - rect.top) / DISPLAY_TILE);
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
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const cell = screenToCell(e.clientX, e.clientY);
    if (!cell) return;
    selStart.current = cell;
    selEnd.current = cell;
    commitSelection();
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!(e.buttons & 1)) return;
    const cell = screenToCell(e.clientX, e.clientY);
    if (!cell || !selStart.current) return;
    selEnd.current = cell;
    commitSelection();
  };

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", overflow: "auto", cursor: "pointer" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
    >
      <canvas ref={canvasRef} style={{ display: "block" }} />
    </div>
  );
}

```

## 📄 editors/tile-palette/PaletteHeader.tsx

```tsx
import { useRef } from "preact/hooks";
import {
  tilesets,
  tilesetImages,
  currentMap,
  bumpMapVersion,
  lastImportedTilesetId,
} from "../../store/project";
import { activeTilesetId } from "../../store/selection";
import { createTileSet } from "../../data/TileSet";

let tsUid = 0;

export function PaletteHeader() {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = () => {
    fileRef.current?.click();
  };

  const handleFile = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const name = file.name.replace(/\.[^.]+$/, "");
      const id = `ts_${++tsUid}`;

      // Import with defaults — user refines via Redo Panel / Inspector
      const ts = createTileSet(id, name, url, img.width, img.height, 16, 16, 0, 0);
      tilesets.value = [...tilesets.value, ts];

      const newImages = new Map(tilesetImages.value);
      newImages.set(id, img);
      tilesetImages.value = newImages;

      activeTilesetId.value = id;

      // Auto-add to current map's tileset refs
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

      // Trigger Redo Panel
      lastImportedTilesetId.value = id;
    };
    img.src = url;
    (e.target as HTMLInputElement).value = "";
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
        gap: 8,
        flexShrink: 0,
      }}
    >
      <select
        value={activeTilesetId.value ?? ""}
        onChange={(e) => {
          activeTilesetId.value = (e.target as HTMLSelectElement).value || null;
        }}
        style={{ flex: 1, minWidth: 0 }}
      >
        {tilesets.value.length === 0 && <option value="">（无瓦片集）</option>}
        {tilesets.value.map((ts) => (
          <option key={ts.id} value={ts.id}>
            {ts.name} ({ts.columns}×{ts.rows})
          </option>
        ))}
      </select>
      <button onClick={handleImport}>导入</button>
      <input
        ref={fileRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp"
        style={{ display: "none" }}
        onChange={handleFile}
      />
    </div>
  );
}

```

## 📄 editors/tile-palette/RedoPanel.tsx

```tsx
import { useEffect, useRef } from "preact/hooks";
import {
  tilesets,
  lastImportedTilesetId,
  updateTileSetParams,
} from "../../store/project";

/**
 * Redo Panel — Blender-style "Adjust Last Operation" panel.
 *
 * Appears at the bottom of TilePalette after a tileset import.
 * Non-modal: user can still interact with other Areas.
 * Dismisses on: click outside, Escape, or next import.
 */
export function RedoPanel() {
  const id = lastImportedTilesetId.value;
  const ts = id ? tilesets.value.find((t) => t.id === id) ?? null : null;
  const panelRef = useRef<HTMLDivElement>(null);

  // Dismiss on click outside this panel
  useEffect(() => {
    if (!id) return;
    const handler = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        lastImportedTilesetId.value = null;
      }
    };
    // Delay to avoid immediate dismiss from the import click
    const timer = setTimeout(() => {
      window.addEventListener("pointerdown", handler);
    }, 200);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", handler);
    };
  }, [id]);

  // Dismiss on Escape
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
    const v = Math.max(field === "name" ? 0 : (field.startsWith("tile") ? 1 : 0), parseInt(raw) || 0);
    if (field === "name") {
      updateTileSetParams(ts.id, { name: raw });
    } else {
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
      {/* Title row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: 8,
          gap: 6,
        }}
      >
        <span style={{ color: "var(--accent)", fontSize: 10 }}>▶</span>
        <span style={{ color: "var(--text-bright)", fontWeight: 500 }}>
          导入瓦片集
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ color: "var(--text-secondary)", fontSize: 10 }}>
          {ts.columns}×{ts.rows} = {ts.tileCount} 瓦片
        </span>
      </div>

      {/* Fields */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <Field label="名称">
          <input
            type="text"
            value={ts.name}
            onInput={(e) => set("name", (e.target as HTMLInputElement).value)}
            style={{ width: "100%" }}
          />
        </Field>

        <div style={{ display: "flex", gap: 8 }}>
          <Field label="瓦片宽">
            <input
              type="number"
              value={ts.tileWidth}
              min={1}
              max={512}
              style={{ width: 52 }}
              onChange={(e) => set("tileWidth", (e.target as HTMLInputElement).value)}
            />
          </Field>
          <Field label="瓦片高">
            <input
              type="number"
              value={ts.tileHeight}
              min={1}
              max={512}
              style={{ width: 52 }}
              onChange={(e) => set("tileHeight", (e.target as HTMLInputElement).value)}
            />
          </Field>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Field label="外边距">
            <input
              type="number"
              value={ts.margin}
              min={0}
              max={128}
              style={{ width: 52 }}
              onChange={(e) => set("margin", (e.target as HTMLInputElement).value)}
            />
          </Field>
          <Field label="间距">
            <input
              type="number"
              value={ts.spacing}
              min={0}
              max={128}
              style={{ width: 52 }}
              onChange={(e) => set("spacing", (e.target as HTMLInputElement).value)}
            />
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

## 📄 editors/tile-palette/TilePaletteEditor.tsx

```tsx
import { registerEditor } from "../registry";
import { PaletteHeader } from "./PaletteHeader";
import { PaletteCanvas } from "./PaletteCanvas";
import { RedoPanel } from "./RedoPanel";

function TilePaletteEditor({ areaId }: { areaId: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <PaletteHeader />
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <PaletteCanvas />
        <RedoPanel />
      </div>
    </div>
  );
}

registerEditor({
  id: "tile_palette",
  name: "瓦片面板",
  icon: "🎨",
  component: TilePaletteEditor,
});

export { TilePaletteEditor };

```

## 📄 editors/viewport/ViewportCanvas.tsx

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
} from "../../store/selection";
import { resolveGid } from "../../data/TileMap";
import { getTileSrcRect } from "../../data/TileSet";

const camera = signal({ x: 0, y: 0, zoom: 1 });

export function ViewportCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPainting = useRef(false);
  const paintedCells = useRef<Set<string>>(new Set());

  // --- Resize ---
  useEffect(() => {
    const el = containerRef.current!;
    const canvas = canvasRef.current!;
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = el.clientWidth * dpr;
      canvas.height = el.clientHeight * dpr;
      canvas.style.width = el.clientWidth + "px";
      canvas.style.height = el.clientHeight + "px";
      draw();
    });
    ro.observe(el);
    return () => ro.disconnect();
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
      const isActive = layer.id === activeLayerId.value;
      ctx.globalAlpha = layer.opacity * (isActive ? 1 : 0.4);

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
            src.sx, src.sy, src.sw, src.sh,
            x * tw, y * th, tw, th
          );
        }
      }
    }

    ctx.globalAlpha = 1;

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
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
            src.sx, src.sy, src.sw, src.sh,
            (hover.x + bx) * tw, (hover.y + by) * th, tw, th
          );
        }
      }
      ctx.globalAlpha = 1;
    }

    // Hover highlight
    if (hover) {
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1;
      ctx.strokeRect(hover.x * tw, hover.y * th, tw, th);
    }

    ctx.restore();
  }, []);

  // --- Mouse → tile coord ---
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

  // --- Paint a single tile ---
  const paintAt = useCallback(
    (x: number, y: number) => {
      const map = currentMap.value;
      const layer = activeLayer.value;
      if (!layer || layer.locked) return;

      const tool = activeTool.value;
      const idx = y * map.width + x;

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
            layer.data[ty * map.width + tx] = bt[by * bw + bx];
          }
        }
      } else if (tool === "eraser") {
        layer.data[idx] = 0;
      } else if (tool === "fill") {
        floodFill(layer.data, map.width, map.height, x, y, bt());
      } else if (tool === "eyedropper") {
        const gid = layer.data[idx];
        if (gid > 0) {
          brushTiles.value = [gid];
          brushWidth.value = 1;
          brushHeight.value = 1;
          activeTool.value = "brush";
        }
      }
      bumpMapVersion();
    },
    []
  );

  function bt() {
    return brushTiles.value.length > 0 ? brushTiles.value[0] : 0;
  }

  // --- Pointer handlers ---
  const onPointerDown = (e: PointerEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Middle-click or Alt+click → pan
      const startCam = { ...camera.value };
      const startX = e.clientX;
      const startY = e.clientY;
      const onMove = (e: PointerEvent) => {
        camera.value = {
          ...startCam,
          x: startCam.x - (e.clientX - startX),
          y: startCam.y - (e.clientY - startY),
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
      isPainting.current = true;
      paintedCells.current.clear();
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

    if (isPainting.current && tile) {
      const key = `${tile.x},${tile.y}`;
      if (!paintedCells.current.has(key)) {
        paintedCells.current.add(key);
        paintAt(tile.x, tile.y);
      }
    }
  };

  const onPointerUp = () => {
    isPainting.current = false;
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.25, Math.min(8, camera.value.zoom * delta));
    camera.value = { ...camera.value, zoom: newZoom };
  };

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", cursor: "crosshair" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => { hoverTile.value = null; }}
      onWheel={onWheel}
    >
      <canvas ref={canvasRef} style={{ display: "block" }} />
    </div>
  );
}

/** Simple flood fill */
function floodFill(
  data: number[],
  w: number,
  h: number,
  sx: number,
  sy: number,
  newGid: number
) {
  const target = data[sy * w + sx];
  if (target === newGid) return;
  const stack = [[sx, sy]];
  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const idx = y * w + x;
    if (data[idx] !== target) continue;
    data[idx] = newGid;
    stack.push([x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]);
  }
}

```

## 📄 editors/viewport/ViewportEditor.tsx

```tsx
import { useRef, useEffect, useCallback } from "preact/hooks";
import { registerEditor } from "../registry";
import { ViewportCanvas } from "./ViewportCanvas";
import { ViewportHeader } from "./ViewportHeader";
import { ViewportFooter } from "./ViewportFooter";

function ViewportEditor({ areaId }: { areaId: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <ViewportHeader />
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <ViewportCanvas />
      </div>
      <ViewportFooter />
    </div>
  );
}

registerEditor({
  id: "viewport",
  name: "地图视口",
  icon: "🗺",
  component: ViewportEditor,
});

export { ViewportEditor };

```

## 📄 editors/viewport/ViewportFooter.tsx

```tsx
import { hoverTile } from "../../store/selection";
import { activeLayer } from "../../store/project";

export function ViewportFooter() {
  const tile = hoverTile.value;
  const layer = activeLayer.value;

  return (
    <div
      style={{
        height: 22,
        background: "var(--bg-header)",
        borderTop: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        padding: "0 8px",
        gap: 16,
        flexShrink: 0,
        color: "var(--text-secondary)",
        fontSize: 11,
      }}
    >
      <span>
        坐标: {tile ? `${tile.x}, ${tile.y}` : "—"}
      </span>
      <span>图层: {layer?.name ?? "—"}</span>
    </div>
  );
}

```

## 📄 editors/viewport/ViewportHeader.tsx

```tsx
import { activeTool, type ToolType } from "../../store/selection";

const tools: { id: ToolType; label: string; icon: string }[] = [
  { id: "brush", label: "笔刷", icon: "✏️" },
  { id: "eraser", label: "橡皮", icon: "🧹" },
  { id: "fill", label: "填充", icon: "🪣" },
  { id: "eyedropper", label: "吸管", icon: "💉" },
];

export function ViewportHeader() {
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
          title={t.label}
          onClick={() => { activeTool.value = t.id; }}
          style={{
            background:
              activeTool.value === t.id
                ? "var(--accent)"
                : "transparent",
            border: "none",
            borderRadius: 3,
            padding: "2px 8px",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          {t.icon}
        </button>
      ))}
    </div>
  );
}

```

## 📄 hooks/useCanvas.ts

```typescript
import { useRef, useEffect } from "preact/hooks";

/**
 * Manages a Canvas element with proper DPR scaling and resize handling.
 * Returns a ref to attach to a container div.
 * Calls `onDraw` whenever the canvas needs repainting.
 */
export function useCanvas(
  onDraw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void,
  deps: any[] = []
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let canvas = canvasRef.current;
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.style.display = "block";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      container.appendChild(canvas);
      canvasRef.current = canvas;
    }

    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = container.clientWidth;
      const h = container.clientHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };

    const draw = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        ctx.clearRect(0, 0, w, h);
        onDraw(ctx, w, h);
      });
    };

    const ro = new ResizeObserver(() => resize());
    ro.observe(container);
    resize();

    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, deps);

  return { containerRef, canvasRef };
}

```

## 📄 hooks/useDrag.ts

```typescript
import { useRef, useCallback } from "preact/hooks";

interface DragCallbacks {
  onStart?: (e: PointerEvent) => void;
  onMove: (e: PointerEvent, delta: { dx: number; dy: number }) => void;
  onEnd?: (e: PointerEvent) => void;
}

export function useDrag(callbacks: DragCallbacks) {
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  const onPointerDown = useCallback((e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    cbRef.current.onStart?.(e);

    const onMove = (e: PointerEvent) => {
      cbRef.current.onMove(e, {
        dx: e.clientX - startX,
        dy: e.clientY - startY,
      });
    };

    const onUp = (e: PointerEvent) => {
      cbRef.current.onEnd?.(e);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, []);

  return { onPointerDown };
}

```

## 📄 index.css

```css
/* ---- Weichen Editor - Dark Theme ---- */
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

::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

::-webkit-scrollbar-track {
  background: var(--bg-area);
}

::-webkit-scrollbar-thumb {
  background: var(--border);
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #555;
}

```

## 📄 layout/rect.ts

```typescript
import type { LayoutNode, Rect, RectMap, SplitInfo } from "./types";

export const HANDLE_SIZE = 4;

export function computeRects(
  node: LayoutNode,
  rect: Rect,
  areas: RectMap = new Map(),
  splits: SplitInfo[] = []
): { areas: RectMap; splits: SplitInfo[] } {
  if (node.type === "area") {
    areas.set(node.id, rect);
    return { areas, splits };
  }

  const { direction, ratio, children, id } = node;
  const half = HANDLE_SIZE / 2;

  splits.push({ id, direction, ratio, rect });

  if (direction === "vertical") {
    const splitX = rect.x + rect.width * ratio;
    computeRects(
      children[0],
      { x: rect.x, y: rect.y, width: splitX - half - rect.x, height: rect.height },
      areas,
      splits
    );
    computeRects(
      children[1],
      { x: splitX + half, y: rect.y, width: rect.x + rect.width - splitX - half, height: rect.height },
      areas,
      splits
    );
  } else {
    const splitY = rect.y + rect.height * ratio;
    computeRects(
      children[0],
      { x: rect.x, y: rect.y, width: rect.width, height: splitY - half - rect.y },
      areas,
      splits
    );
    computeRects(
      children[1],
      { x: rect.x, y: splitY + half, width: rect.width, height: rect.y + rect.height - splitY - half },
      areas,
      splits
    );
  }

  return { areas, splits };
}

```

## 📄 layout/tree.ts

```typescript
import type { LayoutNode, AreaNode, SplitNode, SplitDirection } from "./types";

let _uid = 0;
export const uid = (prefix = "id") => `${prefix}_${++_uid}`;

/** Deep-map every node in the tree */
export function mapNode(
  node: LayoutNode,
  fn: (n: LayoutNode) => LayoutNode
): LayoutNode {
  const mapped = fn(node);
  if (mapped.type === "split") {
    return {
      ...mapped,
      children: [
        mapNode(mapped.children[0], fn),
        mapNode(mapped.children[1], fn),
      ],
    } as SplitNode;
  }
  return mapped;
}

/** Find an area node by ID */
export function findArea(
  node: LayoutNode,
  id: string
): AreaNode | null {
  if (node.type === "area") return node.id === id ? node : null;
  return findArea(node.children[0], id) || findArea(node.children[1], id);
}

/** Collect all area nodes */
export function collectAreas(node: LayoutNode): AreaNode[] {
  if (node.type === "area") return [node];
  return [
    ...collectAreas(node.children[0]),
    ...collectAreas(node.children[1]),
  ];
}

/** Split an area into two */
export function splitArea(
  root: LayoutNode,
  targetId: string,
  direction: SplitDirection,
  ratio = 0.5
): LayoutNode {
  return mapNode(root, (node) => {
    if (node.type !== "area" || node.id !== targetId) return node;
    const newArea: AreaNode = {
      id: uid("area"),
      type: "area",
      editorType: node.editorType,
    };
    const split: SplitNode = {
      id: uid("split"),
      type: "split",
      direction,
      ratio,
      children: [{ ...node }, newArea],
    };
    return split;
  });
}

/** Resize a split node */
export function resizeSplit(
  root: LayoutNode,
  splitId: string,
  newRatio: number
): LayoutNode {
  const clamped = Math.max(0.1, Math.min(0.9, newRatio));
  return mapNode(root, (node) => {
    if (node.id !== splitId || node.type !== "split") return node;
    return { ...node, ratio: clamped };
  });
}

/** Change the editor type of an area */
export function setEditorType(
  root: LayoutNode,
  areaId: string,
  editorType: string
): LayoutNode {
  return mapNode(root, (node) => {
    if (node.type !== "area" || node.id !== areaId) return node;
    return { ...node, editorType };
  });
}

```

## 📄 layout/types.ts

```typescript
export type SplitDirection = "horizontal" | "vertical";

export interface AreaNode {
  id: string;
  type: "area";
  editorType: string;
}

export interface SplitNode {
  id: string;
  type: "split";
  direction: SplitDirection;
  ratio: number;
  children: [LayoutNode, LayoutNode];
}

export type LayoutNode = AreaNode | SplitNode;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type RectMap = Map<string, Rect>;

/** Collected split info for rendering handles */
export interface SplitInfo {
  id: string;
  direction: SplitDirection;
  ratio: number;
  rect: Rect; // the parent rect this split divides
}

```

## 📄 main.tsx

```tsx
import { render } from "preact";
import { App } from "./App";
import "./index.css";

render(<App />, document.getElementById("app")!);

```

## 📄 store/layout.ts

```typescript
import { signal, computed } from "@preact/signals";
import type { LayoutNode } from "../layout/types";
import { computeRects, HANDLE_SIZE } from "../layout/rect";

export const layoutTree = signal<LayoutNode>({
  id: "split_root",
  type: "split",
  direction: "vertical",
  ratio: 0.65,
  children: [
    {
      id: "area_viewport",
      type: "area",
      editorType: "viewport",
    },
    {
      id: "split_right",
      type: "split",
      direction: "horizontal",
      ratio: 0.55,
      children: [
        {
          id: "area_palette",
          type: "area",
          editorType: "tile_palette",
        },
        {
          id: "area_inspector",
          type: "area",
          editorType: "inspector",
        },
      ],
    },
  ],
});

export const containerSize = signal({ width: 1200, height: 800 });

export const layoutComputed = computed(() => {
  const { width, height } = containerSize.value;
  return computeRects(layoutTree.value, { x: 0, y: 0, width, height });
});

```

## 📄 store/project.ts

```typescript
import { signal, computed } from "@preact/signals";
import type { TileSet } from "../data/TileSet";
import type { TileMap } from "../data/TileMap";
import { createTileMap } from "../data/TileMap";
import { createTileSet } from "../data/TileSet";

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

```

## 📄 store/selection.ts

```typescript
import { signal } from "@preact/signals";

export type ToolType = "brush" | "eraser" | "fill" | "eyedropper";

export const activeTool = signal<ToolType>("brush");

/** Currently selected tile GIDs forming the brush */
export const brushTiles = signal<number[]>([]);
export const brushWidth = signal(1);
export const brushHeight = signal(1);

/** Which tileset is shown in the palette */
export const activeTilesetId = signal<string | null>(null);

/** Hovered tile coord in the viewport */
export const hoverTile = signal<{ x: number; y: number } | null>(null);

```

---

*文件由 export-code.mjs 自动生成*
