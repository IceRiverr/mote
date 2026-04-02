import { signal, computed } from "@preact/signals";
import type { TileSet } from "../data/TileSet";
import type { TileMap } from "../data/TileMap";
import { createTileMap } from "../data/TileMap";

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
export const bumpMapVersion = () => { mapVersion.value++; };
