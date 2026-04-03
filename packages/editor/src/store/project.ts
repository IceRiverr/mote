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
