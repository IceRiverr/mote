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
