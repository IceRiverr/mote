<!--
================================================================================
CODE EXPORT - Markdown Format
================================================================================
Project: packages/editor
Generated: 2026-04-03T05:50:58.144Z
Total Files: 40
Source Directory: ./src
================================================================================
-->

# 📦 Code Export - packages/editor

> 导出时间: `2026-04-03T05:50:58.144Z`
> 文件数量: `40` 个
> 源目录: `./src`

---

## 📁 文件清单

```
./src/
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
│   ├── io.ts
│   ├── TileMap.ts
│   └── TileSet.ts
├── editors/
│   ├── inspector/
│   │   ├── InspectorEditor.tsx
│   │   ├── panels/
│   │   │   ├── ExportPanel.tsx
│   │   │   ├── LayersPanel.tsx
│   │   │   ├── MapPropsPanel.tsx
│   │   │   └── PanelShell.tsx
│   │   └── register.ts
│   ├── registry.ts
│   ├── tile-palette/
│   │   ├── PaletteCanvas.tsx
│   │   ├── PaletteHeader.tsx
│   │   ├── RedoPanel.tsx
│   │   ├── register.ts
│   │   ├── TilePaletteEditor.tsx
│   │   └── TileSetPopover.tsx
│   └── viewport/
│       ├── LayerPanel.tsx
│       ├── register.ts
│       ├── ViewportCanvas.tsx
│       ├── ViewportEditor.tsx
│       ├── ViewportFooter.tsx
│       ├── ViewportHeader.tsx
│       └── ViewportToolbar.tsx
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
- [data/io.ts](#data-io-ts)
- [data/TileMap.ts](#data-tilemap-ts)
- [data/TileSet.ts](#data-tileset-ts)
- [editors/inspector/InspectorEditor.tsx](#editors-inspector-inspectoreditor-tsx)
- [editors/inspector/panels/ExportPanel.tsx](#editors-inspector-panels-exportpanel-tsx)
- [editors/inspector/panels/LayersPanel.tsx](#editors-inspector-panels-layerspanel-tsx)
- [editors/inspector/panels/MapPropsPanel.tsx](#editors-inspector-panels-mappropspanel-tsx)
- [editors/inspector/panels/PanelShell.tsx](#editors-inspector-panels-panelshell-tsx)
- [editors/inspector/register.ts](#editors-inspector-register-ts)
- [editors/registry.ts](#editors-registry-ts)
- [editors/tile-palette/PaletteCanvas.tsx](#editors-tile-palette-palettecanvas-tsx)
- [editors/tile-palette/PaletteHeader.tsx](#editors-tile-palette-paletteheader-tsx)
- [editors/tile-palette/RedoPanel.tsx](#editors-tile-palette-redopanel-tsx)
- [editors/tile-palette/register.ts](#editors-tile-palette-register-ts)
- [editors/tile-palette/TilePaletteEditor.tsx](#editors-tile-palette-tilepaletteeditor-tsx)
- [editors/tile-palette/TileSetPopover.tsx](#editors-tile-palette-tilesetpopover-tsx)
- [editors/viewport/LayerPanel.tsx](#editors-viewport-layerpanel-tsx)
- [editors/viewport/register.ts](#editors-viewport-register-ts)
- [editors/viewport/ViewportCanvas.tsx](#editors-viewport-viewportcanvas-tsx)
- [editors/viewport/ViewportEditor.tsx](#editors-viewport-viewporteditor-tsx)
- [editors/viewport/ViewportFooter.tsx](#editors-viewport-viewportfooter-tsx)
- [editors/viewport/ViewportHeader.tsx](#editors-viewport-viewportheader-tsx)
- [editors/viewport/ViewportToolbar.tsx](#editors-viewport-viewporttoolbar-tsx)
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
import './editors/tile-palette/register';
import './editors/viewport/register';
import './editors/inspector/register';

import { LayoutRoot } from './components/LayoutRoot';

export function App() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
      <div style={{
        height: 32,
        background: '#2a2a2a',
        borderBottom: '1px solid #111',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: 12,
        fontWeight: 600,
        fontSize: 13,
        color: '#aaa',
        flexShrink: 0,
      }}>
        Mote Editor — 微尘
      </div>
      <div style={{ flex: 1, position: 'relative' }}>
        <LayoutRoot />
      </div>
    </div>
  );
}

```

## 📄 components/AreaView.tsx

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

## 📄 components/SplitHandle.tsx

```tsx
import { SplitInfo } from '../layout/types';
import { containerSize, layoutTree } from '../store/layout';
import { resizeSplit } from '../layout/tree';
import { useDrag } from '../hooks/useDrag';

interface Props {
  splitInfo: SplitInfo;
}

export function SplitHandle({ splitInfo }: Props) {
  const { splitId, direction, rect } = splitInfo;

  const { onPointerDown } = useDrag({
    onMove(e) {
      const bounds = containerSize.value;
      let ratio: number;
      if (direction === 'horizontal') {
        ratio = (e.clientY - bounds.y) / bounds.h;
      } else {
        ratio = (e.clientX - bounds.x) / bounds.w;
      }
      layoutTree.value = resizeSplit(layoutTree.value, splitId, ratio);
    },
  });

  return (
    <div
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

  execute(cmd: Command) {
    cmd.execute();
    this.undoStack.push(cmd);
    this.redoStack = [];
  }

  undo(): boolean {
    const cmd = this.undoStack.pop();
    if (!cmd) return false;
    cmd.undo();
    this.redoStack.push(cmd);
    return true;
  }

  redo(): boolean {
    const cmd = this.redoStack.pop();
    if (!cmd) return false;
    cmd.execute();
    this.undoStack.push(cmd);
    return true;
  }

  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}

export const commandHistory = new CommandHistory();

```

## 📄 data/export.ts

```typescript
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

## 📄 data/io.ts

```typescript
import type { TileSet, TileData } from "./TileSet";
import type { TileMap, TileSetRef, TileLayer } from "./TileMap";
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
  layers: ExportLayer[];
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
    layers: map.layers.map((l) => ({
      id: l.id,
      name: l.name,
      type: "tilelayer" as const,
      visible: l.visible,
      opacity: l.opacity,
      locked: l.locked,
      data: Array.from(l.data),
    })),
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
  layers: ExportLayer[];
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
    layers: map.layers.map((l) => ({
      id: l.id,
      name: l.name,
      type: "tilelayer" as const,
      visible: l.visible,
      opacity: l.opacity,
      locked: l.locked,
      data: Array.from(l.data),
    })),
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
    layers: json.layers.map((l) => ({
      id: l.id,
      name: l.name,
      visible: l.visible,
      opacity: l.opacity,
      locked: l.locked,
      data: Array.from(l.data),
    })),
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
    layers: json.layers.map((l) => ({
      id: l.id,
      name: l.name,
      visible: l.visible,
      opacity: l.opacity,
      locked: l.locked,
      data: Array.from(l.data),
    })),
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
  const json = JSON.stringify(data, null, 2);
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

## 📄 editors/inspector/InspectorEditor.tsx

```tsx
import { registerEditor } from "../registry";
import { MapPropsPanel } from "./panels/MapPropsPanel";
import { LayersPanel } from "./panels/LayersPanel";
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

## 📄 editors/inspector/panels/LayersPanel.tsx

```tsx
import {
  currentMap,
  activeLayerId,
  bumpMapVersion,
} from "../../../store/project";
import { PanelShell } from "./PanelShell";
import { useState } from "preact/hooks";

let layerUid = 10;

export function LayersPanel() {
  const map = currentMap.value;
  const selectedLayer = map.layers.find((l) => l.id === activeLayerId.value) ?? map.layers[0];

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

  const moveLayer = (id: string, dir: -1 | 1) => {
    const idx = map.layers.findIndex((l) => l.id === id);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= map.layers.length) return;
    const newLayers = [...map.layers];
    [newLayers[idx], newLayers[newIdx]] = [newLayers[newIdx], newLayers[idx]];
    currentMap.value = { ...map, layers: newLayers };
    bumpMapVersion();
  };

  const renameLayer = (id: string, name: string) => {
    currentMap.value = {
      ...map,
      layers: map.layers.map((l) =>
        l.id === id ? { ...l, name } : l
      ),
    };
  };

  const setOpacity = (id: string, opacity: number) => {
    currentMap.value = {
      ...map,
      layers: map.layers.map((l) =>
        l.id === id ? { ...l, opacity } : l
      ),
    };
    bumpMapVersion();
  };

  return (
    <PanelShell title="图层">
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 2, marginBottom: 4 }}>
        <button onClick={addLayer} title="添加图层" style={{ flex: 1, fontSize: 11 }}>+</button>
        <button
          onClick={() => selectedLayer && moveLayer(selectedLayer.id, -1)}
          title="上移"
          style={{ flex: 1, fontSize: 11 }}
        >↑</button>
        <button
          onClick={() => selectedLayer && moveLayer(selectedLayer.id, 1)}
          title="下移"
          style={{ flex: 1, fontSize: 11 }}
        >↓</button>
        <button
          onClick={() => selectedLayer && removeLayer(selectedLayer.id)}
          title="删除图层"
          style={{ flex: 1, fontSize: 11, color: "var(--danger)" }}
        >✕</button>
      </div>

      {/* Quick visibility bar */}
      <div style={{ display: "flex", gap: 2, marginBottom: 6, flexWrap: "wrap" }}>
        {map.layers.map((layer) => (
          <div
            key={layer.id}
            onClick={() => toggleVisible(layer.id)}
            title={`${layer.name} (${layer.visible ? "可见" : "隐藏"})`}
            style={{
              width: 18,
              height: 18,
              borderRadius: 2,
              border: activeLayerId.value === layer.id
                ? "2px solid var(--accent)"
                : "1px solid var(--border)",
              background: layer.visible ? "var(--accent)" : "var(--bg-input)",
              opacity: layer.visible ? 1 : 0.3,
              cursor: "pointer",
            }}
          />
        ))}
      </div>

      {/* Layer list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {[...map.layers].reverse().map((layer) => (
          <div
            key={layer.id}
            onClick={() => { activeLayerId.value = layer.id; }}
            style={{
              display: "flex",
              alignItems: "center",
              height: 26,
              padding: "0 4px",
              gap: 3,
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
                fontSize: 11,
                width: 18,
                height: 20,
              }}
            >👁</button>
            <button
              title={layer.locked ? "解锁" : "锁定"}
              onClick={(e) => { e.stopPropagation(); toggleLock(layer.id); }}
              style={{
                border: "none",
                background: "transparent",
                padding: "0 2px",
                cursor: "pointer",
                opacity: layer.locked ? 1 : 0.3,
                fontSize: 11,
                width: 18,
                height: 20,
              }}
            >🔒</button>
            <span style={{
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              fontSize: 11,
            }}>
              {layer.name}
            </span>
            <span style={{
              fontSize: 10,
              color: "var(--text-secondary)",
              minWidth: 24,
              textAlign: "right",
            }}>
              {Math.round(layer.opacity * 100)}%
            </span>
          </div>
        ))}
      </div>

      {/* Selected layer properties */}
      {selectedLayer && (
        <div style={{
          marginTop: 8,
          paddingTop: 6,
          borderTop: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          gap: 4,
        }}>
          <div style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 500, marginBottom: 2 }}>
            图层属性
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 40, fontSize: 10, color: "var(--text-secondary)", textAlign: "right", flexShrink: 0 }}>名称</span>
            <input
              type="text"
              value={selectedLayer.name}
              onInput={(e) => renameLayer(selectedLayer.id, (e.target as HTMLInputElement).value)}
              onClick={(e) => e.stopPropagation()}
              style={{ flex: 1, minWidth: 0, fontSize: 11 }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 40, fontSize: 10, color: "var(--text-secondary)", textAlign: "right", flexShrink: 0 }}>透明度</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={selectedLayer.opacity}
              onInput={(e) => setOpacity(selectedLayer.id, parseFloat((e.target as HTMLInputElement).value))}
              style={{ flex: 1 }}
            />
            <span style={{ fontSize: 10, color: "var(--text-secondary)", width: 30, textAlign: "right" }}>
              {Math.round(selectedLayer.opacity * 100)}%
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 40, fontSize: 10, color: "var(--text-secondary)", textAlign: "right", flexShrink: 0 }}>锁定</span>
            <input
              type="checkbox"
              checked={selectedLayer.locked}
              onChange={() => toggleLock(selectedLayer.id)}
            />
          </div>
        </div>
      )}
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

## 📄 editors/inspector/register.ts

```typescript
import './InspectorEditor';

```

## 📄 editors/registry.ts

```typescript
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

## 📄 editors/tile-palette/PaletteCanvas.tsx

```tsx
import { useRef, useEffect, useCallback } from "preact/hooks";
import { tilesets, tilesetImages, currentMap } from "../../store/project";
import {
  activeTilesetId,
  brushTiles,
  brushWidth,
  brushHeight,
  displayScale,
} from "../../store/selection";
import { getTileSrcRect } from "../../data/TileSet";

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

    const scale = displayScale.value;
    const cellW = ts ? ts.tileWidth * scale : 32;
    const cellH = ts ? ts.tileHeight * scale : 32;

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

    // Pixel-perfect: disable smoothing
    ctx.imageSmoothingEnabled = false;

    if (!ts || !img) {
      ctx.fillStyle = "#888";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("点击「导入」添加瓦片集", w / 2, h / 2);
      return;
    }

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
            startCol * cellW,
            startRow * cellH,
            brushWidth.value * cellW,
            brushHeight.value * cellH
          );
          ctx.fillStyle = "rgba(74,144,217,0.2)";
          ctx.fillRect(
            startCol * cellW,
            startRow * cellH,
            brushWidth.value * cellW,
            brushHeight.value * cellH
          );
        }
      }
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
    const scale = displayScale.value;
    const cellW = ts.tileWidth * scale;
    const cellH = ts.tileHeight * scale;
    const col = Math.floor((clientX - rect.left) / cellW);
    const row = Math.floor((clientY - rect.top) / cellH);
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
      style={{
        width: "100%",
        height: "100%",
        overflow: "auto",
        cursor: "pointer",
        imageRendering: "pixelated",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
    >
      <canvas
        ref={canvasRef}
        style={{ display: "block", imageRendering: "pixelated" }}
      />
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
  importTileSetFromFiles,
} from "../../store/project";
import { activeTilesetId, displayScale } from "../../store/selection";
import { createTileSet } from "../../data/TileSet";
import { popoverOpen } from "./TileSetPopover";

let tsUid = 0;

export function PaletteHeader() {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = () => {
    fileRef.current?.click();
  };

  const handleFile = (e: Event) => {
    const files = Array.from((e.target as HTMLInputElement).files ?? []);
    if (files.length === 0) return;

    // Check if it's a JSON tileset import
    const jsonFile = files.find((f) => f.name.endsWith(".json"));
    const imageFile = files.find((f) => !f.name.endsWith(".json"));

    if (jsonFile && imageFile) {
      // Import from .mote-tileset.json + image
      importTileSetFromFiles(jsonFile, imageFile).catch(console.error);
      (e.target as HTMLInputElement).value = "";
      return;
    }

    // Regular image import
    const file = files[0];
    if (!file || !file.type.startsWith("image/")) return;

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const name = file.name.replace(/\.[^.]+$/, "");
      const id = `ts_${++tsUid}`;

      const ts = createTileSet(id, name, url, img.width, img.height, 16, 16, 0, 0);
      tilesets.value = [...tilesets.value, ts];

      const newImages = new Map(tilesetImages.value);
      newImages.set(id, img);
      tilesetImages.value = newImages;

      activeTilesetId.value = id;

      // Auto-add to current map
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

      // Update display scale based on tile size
      displayScale.value = Math.max(1, Math.round(32 / ts.tileWidth));

      // Trigger Redo Panel
      lastImportedTilesetId.value = id;
    };
    img.src = url;
    (e.target as HTMLInputElement).value = "";
  };

  const hasActiveTileset = activeTilesetId.value !== null;

  return (
    <div
      style={{
        height: 32,
        background: "var(--bg-header)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        padding: "0 8px",
        gap: 6,
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

## 📄 editors/tile-palette/register.ts

```typescript
import { registerEditor } from '../registry';
import { TilePaletteEditor } from './TilePaletteEditor';

registerEditor({
  id: 'tile-palette',
  name: 'Tile Palette',
  icon: '🎨',
  component: TilePaletteEditor,
});

```

## 📄 editors/tile-palette/TilePaletteEditor.tsx

```tsx
import { registerEditor } from "../registry";
import { PaletteHeader } from "./PaletteHeader";
import { PaletteCanvas } from "./PaletteCanvas";
import { RedoPanel } from "./RedoPanel";
import { TileSetPopover } from "./TileSetPopover";

function TilePaletteEditor({ areaId }: { areaId: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", position: "relative" }}>
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

## 📄 editors/tile-palette/TileSetPopover.tsx

```tsx
import { useEffect, useRef } from "preact/hooks";
import { signal } from "@preact/signals";
import {
  tilesets,
  updateTileSetParams,
  removeTileSet,
} from "../../store/project";
import { activeTilesetId, displayScale } from "../../store/selection";
import { exportTileSet } from "../../data/export";

/** Controls whether the popover is visible */
export const popoverOpen = signal(false);

export function TileSetPopover() {
  const tsId = activeTilesetId.value;
  const ts = tsId ? tilesets.value.find((t) => t.id === tsId) ?? null : null;
  const panelRef = useRef<HTMLDivElement>(null);

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
      <div style={{
        padding: "6px 10px",
        borderBottom: "1px solid var(--border)",
        background: "var(--panel-header)",
        fontWeight: 600,
        color: "var(--text-bright)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
      }}>
        <span>瓦片集属性</span>
        <button
          onClick={() => { popoverOpen.value = false; }}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-secondary)",
            cursor: "pointer",
            fontSize: 13,
            padding: 0,
            lineHeight: 1,
          }}
        >✕</button>
      </div>

      {/* Properties */}
      <div style={{ padding: "8px 10px", display: "flex", flexDirection: "column", gap: 5 }}>
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
            <input type="number" value={ts.tileWidth} min={1} max={512} style={{ width: 48 }}
              onChange={(e) => set("tileWidth", (e.target as HTMLInputElement).value)} />
          </Field>
          <Field label="瓦片高">
            <input type="number" value={ts.tileHeight} min={1} max={512} style={{ width: 48 }}
              onChange={(e) => set("tileHeight", (e.target as HTMLInputElement).value)} />
          </Field>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <Field label="外边距">
            <input type="number" value={ts.margin} min={0} max={128} style={{ width: 48 }}
              onChange={(e) => set("margin", (e.target as HTMLInputElement).value)} />
          </Field>
          <Field label="间距">
            <input type="number" value={ts.spacing} min={0} max={128} style={{ width: 48 }}
              onChange={(e) => set("spacing", (e.target as HTMLInputElement).value)} />
          </Field>
        </div>

        {/* Display scale */}
        <Field label="显示倍率">
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <button
              onClick={() => { displayScale.value = Math.max(1, displayScale.value - 1); }}
              style={{ width: 22, height: 22, padding: 0 }}
            >−</button>
            <span style={{ minWidth: 20, textAlign: "center" }}>{displayScale.value}×</span>
            <button
              onClick={() => { displayScale.value = Math.min(8, displayScale.value + 1); }}
              style={{ width: 22, height: 22, padding: 0 }}
            >+</button>
          </div>
        </Field>

        {/* Stats */}
        <div style={{
          borderTop: "1px solid var(--border)",
          paddingTop: 6,
          marginTop: 2,
          color: "var(--text-secondary)",
          fontSize: 10,
        }}>
          {ts.columns}×{ts.rows} = {ts.tileCount} 瓦片 · 原图 {ts.imageWidth}×{ts.imageHeight}px
          {ts.tileCount === 0 && (
            <div style={{ color: "var(--danger)", marginTop: 3 }}>
              ⚠ 当前参数无法切出瓦片
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{
          display: "flex",
          gap: 4,
          borderTop: "1px solid var(--border)",
          paddingTop: 6,
          marginTop: 2,
        }}>
          <button
            onClick={() => { exportTileSet(ts); }}
            style={{ flex: 1, fontSize: 10 }}
          >导出 TileSet</button>
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
          >删除</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{
        width: 38,
        flexShrink: 0,
        color: "var(--text-secondary)",
        fontSize: 10,
        textAlign: "right",
      }}>{label}</span>
      {children}
    </div>
  );
}

```

## 📄 editors/viewport/LayerPanel.tsx

```tsx
import { currentMap, activeLayerId, bumpMapVersion } from '../../store/project';
import type { TileLayer } from '../../data/TileMap';

let nextLayerId = 2;

export function LayerPanel() {
  const map = currentMap.value;

  const addLayer = () => {
    const id = `layer_${nextLayerId++}`;
    const layer = {
      id,
      name: `Layer ${map.layers.length + 1}`,
      visible: true,
      opacity: 1,
      locked: false,
      data: new Array(map.width * map.height).fill(0),
    };
    currentMap.value = { ...map, layers: [...map.layers, layer as TileLayer] };
    activeLayerId.value = id;
    bumpMapVersion();
  };

  const toggleVisibility = (layerId: string) => {
    currentMap.value = {
      ...map,
      layers: map.layers.map((l) =>
        l.id === layerId ? { ...l, visible: !l.visible } : l
      ),
    };
    bumpMapVersion();
  };

  return (
    <div style={{
      width: 140,
      background: '#2a2a2a',
      borderLeft: '1px solid #1a1a1a',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 6px',
        borderBottom: '1px solid #1a1a1a',
      }}>
        <span style={{ fontSize: 11, fontWeight: 600 }}>Layers</span>
        <button
          onClick={addLayer}
          style={{
            background: '#333',
            color: '#ccc',
            border: '1px solid #444',
            borderRadius: 3,
            fontSize: 11,
            cursor: 'pointer',
            padding: '0 6px',
          }}
        >+</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {[...map.layers].reverse().map((layer) => (
          <div
            key={layer.id}
            onClick={() => { activeLayerId.value = layer.id; }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 6px',
              background: activeLayerId.value === layer.id ? '#3a3a4a' : 'transparent',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            <span
              onClick={(e) => { e.stopPropagation(); toggleVisibility(layer.id); }}
              style={{ cursor: 'pointer', opacity: layer.visible ? 1 : 0.3, fontSize: 10 }}
            >
              👁
            </span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {layer.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

```

## 📄 editors/viewport/register.ts

```typescript
import { registerEditor } from '../registry';
import { ViewportEditor } from './ViewportEditor';

registerEditor({
  id: 'viewport',
  name: 'Viewport',
  icon: '🗺',
  component: ViewportEditor,
});

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
  viewportZoom,
} from "../../store/selection";
import { resolveGid } from "../../data/TileMap";
import { getTileSrcRect } from "../../data/TileSet";

/** Camera: x,y = world coordinate at viewport top-left. zoom = scale factor. */
const camera = signal({ x: 0, y: 0, zoom: 2 });
const needsCenter = signal(true);

export function ViewportCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPainting = useRef(false);
  const paintedCells = useRef<Set<string>>(new Set());

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
      if (needsCenter.value) {
        centerMap();
        needsCenter.value = false;
      }
      draw();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // --- Keyboard: number keys 1-6 for integer zoom, Home for fit ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if focused on input
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

      const num = parseInt(e.key);
      if (num >= 1 && num <= 6) {
        e.preventDefault();
        // Snap to integer zoom, centered on viewport center
        const el = containerRef.current;
        if (!el) return;
        const vw = el.clientWidth;
        const vh = el.clientHeight;
        const cam = camera.value;
        // World point at viewport center
        const worldCX = (vw / 2 + cam.x) / cam.zoom;
        const worldCY = (vh / 2 + cam.y) / cam.zoom;
        const newZoom = num;
        camera.value = {
          x: worldCX * newZoom - vw / 2,
          y: worldCY * newZoom - vh / 2,
          zoom: newZoom,
        };
        viewportZoom.value = newZoom;
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

    // Pixel-perfect rendering
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

  // --- Paint ---
  const paintAt = useCallback((x: number, y: number) => {
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
      const fillGid = brushTiles.value.length > 0 ? brushTiles.value[0] : 0;
      floodFill(layer.data, map.width, map.height, x, y, fillGid);
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
  }, []);

  // --- Pointer handlers ---
  const onPointerDown = (e: PointerEvent) => {
    // Middle-click or Alt+click → pan
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

  // --- Mouse-position zoom ---
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const cam = camera.value;
    const rect = canvasRef.current!.getBoundingClientRect();
    // Mouse position relative to canvas
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    // World position under mouse
    const worldX = (mouseX + cam.x) / cam.zoom;
    const worldY = (mouseY + cam.y) / cam.zoom;
    // New zoom
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.25, Math.min(16, cam.zoom * factor));
    // Adjust camera so world point stays under mouse
    camera.value = {
      x: worldX * newZoom - mouseX,
      y: worldY * newZoom - mouseY,
      zoom: newZoom,
    };
    viewportZoom.value = newZoom;
  };

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        cursor: "crosshair",
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
  name: "Viewport",
  icon: "🗺",
  component: ViewportEditor,
});

export { ViewportEditor };

```

## 📄 editors/viewport/ViewportFooter.tsx

```tsx
import { hoverTile, viewportZoom } from "../../store/selection";
import { activeLayer } from "../../store/project";

export function ViewportFooter() {
  const tile = hoverTile.value;
  const layer = activeLayer.value;
  const zoom = viewportZoom.value;
  const isInteger = Math.abs(zoom - Math.round(zoom)) < 0.01;

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
      <span>坐标: {tile ? `${tile.x}, ${tile.y}` : "—"}</span>
      <span>图层: {layer?.name ?? "—"}</span>
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: 10, opacity: 0.6 }}>
        滚轮缩放 · 1-6整数 · Home居中
      </span>
    </div>
  );
}

```

## 📄 editors/viewport/ViewportHeader.tsx

```tsx
import { activeTool, viewportZoom, type ToolType } from "../../store/selection";

const tools: { id: ToolType; label: string; icon: string }[] = [
  { id: "brush", label: "笔刷", icon: "✏️" },
  { id: "eraser", label: "橡皮", icon: "🧹" },
  { id: "fill", label: "填充", icon: "🪣" },
  { id: "eyedropper", label: "吸管", icon: "💉" },
];

export function ViewportHeader() {
  const zoom = viewportZoom.value;
  const isInteger = Math.abs(zoom - Math.round(zoom)) < 0.01;

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
            fontSize: 14,
          }}
        >
          {t.icon}
        </button>
      ))}

      <div style={{ flex: 1 }} />

      {/* Zoom display */}
      <span
        style={{
          fontSize: 11,
          color: isInteger ? "var(--accent)" : "var(--text-secondary)",
          fontWeight: isInteger ? 600 : 400,
          marginRight: 4,
          fontFamily: "monospace",
        }}
        title={
          isInteger
            ? "像素完美"
            : "非整数缩放 (按 1-6 吸附整数)"
        }
      >
        ×{zoom.toFixed(zoom === Math.floor(zoom) ? 0 : 1)}
      </span>
    </div>
  );
}

```

## 📄 editors/viewport/ViewportToolbar.tsx

```tsx
import { activeTool, ToolType } from '../../store/selection';
import { exportStandalone } from '../../data/export';
import { currentMap, tilesets } from '../../store/project';

const tools: { id: ToolType; label: string; icon: string }[] = [
  { id: 'brush', label: 'Brush', icon: '🖌' },
  { id: 'eraser', label: 'Eraser', icon: '🧹' },
  { id: 'fill', label: 'Fill', icon: '🪣' },
  { id: 'eyedropper', label: 'Eyedropper', icon: '💉' },
];

export function ViewportToolbar() {
  const handleExport = () => {
    exportStandalone(currentMap.value, tilesets.value);
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      padding: '3px 6px',
      borderBottom: '1px solid #1a1a1a',
      background: '#2a2a2a',
      flexShrink: 0,
    }}>
      {tools.map((t) => (
        <button
          key={t.id}
          onClick={() => { activeTool.value = t.id; }}
          title={t.label}
          style={{
            background: activeTool.value === t.id ? '#4a6fa5' : '#333',
            color: '#fff',
            border: activeTool.value === t.id ? '1px solid #6a9fd5' : '1px solid #444',
            borderRadius: 3,
            padding: '2px 6px',
            fontSize: 13,
            cursor: 'pointer',
            lineHeight: 1,
          }}
        >
          {t.icon}
        </button>
      ))}
      <div style={{ flex: 1 }} />
      <button
        onClick={handleExport}
        style={{
          background: '#3a7d4a',
          color: '#fff',
          border: 'none',
          borderRadius: 3,
          padding: '2px 10px',
          fontSize: 11,
          cursor: 'pointer',
        }}
      >
        Export JSON
      </button>
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

## 📄 index.css

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

canvas {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
}

```

## 📄 layout/rect.ts

```typescript
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
    });

    computeRects(children[0], { x: bounds.x, y: bounds.y, w: leftW, h: bounds.h }, areas, splits);
    computeRects(children[1], { x: rightX, y: bounds.y, w: rightW, h: bounds.h }, areas, splits);
  }
}

```

## 📄 layout/tree.ts

```typescript
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

## 📄 layout/types.ts

```typescript
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
}

export type RectMap = Map<string, Rect>;

```

## 📄 main.tsx

```tsx
import './index.css';
import { render } from 'preact';
import { App } from './App';

render(<App />, document.getElementById('app')!);

```

## 📄 store/layout.ts

```typescript
import { signal, computed } from '@preact/signals';
import { LayoutNode, Rect, RectMap, SplitInfo } from '../layout/types';
import { computeRects } from '../layout/rect';

const defaultLayout: LayoutNode = {
  type: 'split',
  id: 'root_split',
  direction: 'vertical',
  ratio: 0.22,
  children: [
    { type: 'area', id: 'area_palette', editorType: 'tile-palette' },
    {
      type: 'split',
      id: 'split_right',
      direction: 'vertical',
      ratio: 0.75,
      children: [
        { type: 'area', id: 'area_viewport', editorType: 'viewport' },
        { type: 'area', id: 'area_inspector', editorType: 'inspector' },
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

## 📄 store/project.ts

```typescript
import { signal, computed } from "@preact/signals";
import type { TileSet } from "../data/TileSet";
import type { TileMap } from "../data/TileMap";
import { createTileMap } from "../data/TileMap";
import { createTileSet } from "../data/TileSet";
import {
  readJsonFile,
  detectJsonType,
  tileSetFromJson,
  importBundle,
  importStandaloneMap,
  loadImageFromFile,
} from "../data/io";
import type { TileSetJson, TileMapBundleJson, TileMapStandaloneJson } from "../data/io";
import { activeTilesetId, displayScale } from "./selection";

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

// ---- Import TileSet from JSON file ----

export async function importTileSetFromFiles(
  jsonFile: File,
  imageFile: File,
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

  // Update display scale
  displayScale.value = Math.max(1, Math.round(32 / ts.tileWidth));
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
      displayScale.value = Math.max(1, Math.round(32 / result.tilesets[0].tileWidth));
    }
    bumpMapVersion();
    return;
  }

  if (type === "mote-tilemap") {
    const { map, missingTilesets } = importStandaloneMap(raw as TileMapStandaloneJson);
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
            tilesets: [...m.tilesets, { tilesetId: ts.id, firstGid: missing.firstGid }],
          };
        }

        if (tilesets.value.length > 0) {
          activeTilesetId.value = tilesets.value[0].id;
          displayScale.value = Math.max(1, Math.round(32 / tilesets.value[0].tileWidth));
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

/**
 * Editor display scale (integer).
 * Controls tile display size in TilePalette: displaySize = tileWidth * displayScale.
 * Number keys 1-6 in Viewport snap zoom to this integer scale.
 * Auto-calculated on tileset import: Math.max(1, Math.round(32 / tileWidth)).
 */
export const displayScale = signal(2);

/** Current viewport zoom level (for display in footer) */
export const viewportZoom = signal(1);

```

---

*文件由 export-code.mjs 自动生成*
