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
  // ── 通用 ──
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

  // ── 游戏专用 (tiny-dungeon) ──
  {
    id: "enemy_skeleton",
    name: "Skeleton",
    shape: "point",
    color: "#c0392b",
    icon: "\uD83D\uDC80",
    defaultWidth: 16,
    defaultHeight: 16,
    resizable: false,
    fields: [
      { id: "health", label: "Health", type: "number", default: 30 },
    ],
  },
  {
    id: "pickup_potion_red",
    name: "Red Potion",
    shape: "point",
    color: "#e74c3c",
    icon: "\u2764\uFE0F",
    defaultWidth: 16,
    defaultHeight: 16,
    resizable: false,
    fields: [
      { id: "amount", label: "Heal Amount", type: "number", default: 20 },
    ],
  },
  {
    id: "pickup_potion_blue",
    name: "Blue Potion",
    shape: "point",
    color: "#3498db",
    icon: "\uD83D\uDCA7",
    defaultWidth: 16,
    defaultHeight: 16,
    resizable: false,
    fields: [
      { id: "amount", label: "Mana Amount", type: "number", default: 15 },
    ],
  },
  {
    id: "weapon_axe",
    name: "Axe",
    shape: "point",
    color: "#f39c12",
    icon: "\uD83E\uDE93",
    defaultWidth: 16,
    defaultHeight: 16,
    resizable: false,
    fields: [],
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
