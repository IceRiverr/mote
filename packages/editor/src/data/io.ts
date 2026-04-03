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
