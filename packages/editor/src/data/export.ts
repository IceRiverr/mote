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
