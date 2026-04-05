// ═══════════════════════════════════════════════════════════════
// formats.ts — JSON file format type definitions for Mote project files
// Defines the on-disk schema for all .json files:
//   - project.mote.json  (ProjectJson)
//   - *.sprite.json      (SpriteSheetJson)
//   - *.entity.json      (EntityDefJson)
//   - *.map.json          (SceneJson)
// ═══════════════════════════════════════════════════════════════

// ── project.mote.json ─────────────────────────────────────────

/** Schema for project.mote.json — the project manifest file */
export interface ProjectJson {
  name: string;
  version: string;
  engine: string;
  tileWidth: number;
  tileHeight: number;
  spriteSheets: string[];   // paths to .sprite.json files
  entities: string[];        // paths to .entity.json files
  scenes: string[];          // paths to .map.json files
  scripts: string;           // scripts directory path
  startScene: string;
}

// ── .sprite.json ──────────────────────────────────────────────

/** Schema for .sprite.json — a sprite sheet definition */
export interface SpriteSheetJson {
  id: string;
  name: string;
  image: string;  // relative path to image
  slicing: {
    mode: 'grid' | 'packed' | 'xml' | 'manual';
    tileWidth?: number;
    tileHeight?: number;
    margin?: number;
    spacing?: number;
    source?: string;
  };
  frames: Record<string, {
    x: number;
    y: number;
    w: number;
    h: number;
    collider?: Array<{ type: string; [key: string]: unknown }>;
    tags?: string[];
    properties?: Record<string, unknown>;
    trimmed?: boolean;
    sourceWidth?: number;
    sourceHeight?: number;
    offsetX?: number;
    offsetY?: number;
    rotated?: boolean;
  }>;
}

// ── .entity.json ──────────────────────────────────────────────

/** Schema for .entity.json — an entity definition template */
export interface EntityDefJson {
  id: string;
  name: string;
  sprite?: string;
  shape: 'point' | 'rect';
  width: number;
  height: number;
  resizable: boolean;
  color: string;
  icon: string;
  script?: string;
  collider?: Array<{ type: string; [key: string]: unknown }> | null;
  fields: Array<{
    id: string;
    label: string;
    type: 'string' | 'number' | 'bool';
    default: string | number | boolean;
  }>;
}

// ── .map.json (scene) ─────────────────────────────────────────

/** Schema for tile layer within a .map.json */
export interface TileLayerJson {
  id: string;
  name: string;
  type: 'tile';
  visible: boolean;
  opacity: number;
  locked: boolean;
  spriteSheet: string;
  encoding: 'names' | 'indexed';
  data: (string | number)[];
  frameIndex?: string[];
}

/** Schema for entity layer within a .map.json */
export interface EntityLayerJson {
  id: string;
  name: string;
  type: 'entity';
  visible: boolean;
  opacity: number;
  locked: boolean;
  entities: Array<{
    id: string;
    template: string;
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
    fields: Record<string, string | number | boolean>;
    colliderOverride?: Array<{ type: string; [key: string]: unknown }> | null;
  }>;
}

/** Schema for .map.json — a scene / level definition */
export interface SceneJson {
  id: string;
  name: string;
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  spriteSheets: string[];
  layers: Array<TileLayerJson | EntityLayerJson>;
}
