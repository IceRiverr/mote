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
