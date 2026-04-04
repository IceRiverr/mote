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
  color?: string;      // color tag for visual identification
  data: number[];      // row-major, 0 = empty
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

/** Preset color tags for layers */
export const LAYER_COLORS = [
  { id: "red",    hex: "#e06060", label: "红" },
  { id: "orange", hex: "#e09040", label: "橙" },
  { id: "yellow", hex: "#d0c040", label: "黄" },
  { id: "green",  hex: "#60b060", label: "绿" },
  { id: "blue",   hex: "#4a90d9", label: "蓝" },
  { id: "purple", hex: "#a060d0", label: "紫" },
  { id: "gray",   hex: "#808080", label: "无" },
] as const;

/** Get hex color for a layer's color tag, default to gray */
export function getLayerColor(color?: string): string {
  if (!color) return "#808080";
  const found = LAYER_COLORS.find((c) => c.id === color);
  return found ? found.hex : "#808080";
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
