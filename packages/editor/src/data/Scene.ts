// ═══════════════════════════════════════════════════════════════
// Scene.ts — Scene type (replaces TileMap)
// A Scene is a complete level/map composed of tile layers and
// entity layers, referencing SpriteSheets by ID.
// ═══════════════════════════════════════════════════════════════

import type { EntityInstance } from './EntityDef';

// ── Layer base ────────────────────────────────────────────────

interface LayerBase {
  id: string;
  name: string;
  visible: boolean;
  opacity: number;
  locked: boolean;
  color?: string;
}

// ── Tile layer ────────────────────────────────────────────────

/** Tile layer — references Frame IDs from a SpriteSheet */
export interface TileLayerData extends LayerBase {
  type: 'tile';
  /** Which SpriteSheet this layer uses */
  spriteSheet: string;
  /** Encoding mode */
  encoding: 'names' | 'indexed';
  /** For 'names' mode: array of frameId strings ("" = empty) */
  data: string[];
  /** For 'indexed' mode only: maps index -> frameId */
  frameIndex?: string[];
}

// ── Entity layer ──────────────────────────────────────────────

/** Entity layer — contains placed entity instances */
export interface EntityLayerData extends LayerBase {
  type: 'entity';
  entities: EntityInstance[];
}

// ── Union type ────────────────────────────────────────────────

export type SceneLayer = TileLayerData | EntityLayerData;

// ── Scene ─────────────────────────────────────────────────────

/** Scene — a complete level/map */
export interface Scene {
  id: string;
  name: string;
  width: number;      // columns
  height: number;     // rows
  tileWidth: number;
  tileHeight: number;
  /** SpriteSheets referenced by this scene (IDs) */
  spriteSheets: string[];
  layers: SceneLayer[];
}

// ── Type guards ───────────────────────────────────────────────

/** Type guard: is this layer a tile layer? */
export function isTileLayer(layer: SceneLayer): layer is TileLayerData {
  return layer.type === 'tile';
}

/** Type guard: is this layer an entity layer? */
export function isEntityLayer(layer: SceneLayer): layer is EntityLayerData {
  return layer.type === 'entity';
}

// ── Layer factories ───────────────────────────────────────────

/**
 * Create an empty tile layer filled with "" (no tile).
 * @param id - Layer ID
 * @param name - Layer display name
 * @param width - Number of columns in the scene
 * @param height - Number of rows in the scene
 * @param spriteSheet - SpriteSheet ID this layer references
 */
export function createTileLayer(
  id: string,
  name: string,
  width: number,
  height: number,
  spriteSheet: string,
): TileLayerData {
  return {
    type: 'tile',
    id,
    name,
    visible: true,
    opacity: 1,
    locked: false,
    spriteSheet,
    encoding: 'names',
    data: new Array<string>(width * height).fill(''),
  };
}

/**
 * Create an empty entity layer.
 */
export function createEntityLayer(
  id: string,
  name: string,
): EntityLayerData {
  return {
    type: 'entity',
    id,
    name,
    visible: true,
    opacity: 1,
    locked: false,
    entities: [],
  };
}

// ── Scene factory ─────────────────────────────────────────────

/**
 * Create a Scene with 2 default tile layers (background, foreground)
 * and 1 entity layer. The tile layers use an empty spriteSheet ref
 * that should be set after creation.
 */
export function createScene(
  id: string,
  name: string,
  width: number,
  height: number,
  tileWidth: number,
  tileHeight: number,
): Scene {
  return {
    id,
    name,
    width,
    height,
    tileWidth,
    tileHeight,
    spriteSheets: [],
    layers: [
      createTileLayer('layer_bg', 'background', width, height, ''),
      createTileLayer('layer_fg', 'foreground', width, height, ''),
      createEntityLayer('layer_entities', 'entities'),
    ],
  };
}

// ── Tile accessors ────────────────────────────────────────────

/**
 * Get the frame ID at tile position (x, y) in a tile layer.
 * Returns "" if empty, or the frameId string.
 * Returns undefined if out of bounds.
 */
export function getTileAt(
  layer: TileLayerData,
  x: number,
  y: number,
  width: number,
): string | undefined {
  if (x < 0 || y < 0 || x >= width) return undefined;
  const index = y * width + x;
  if (index < 0 || index >= layer.data.length) return undefined;

  if (layer.encoding === 'indexed' && layer.frameIndex) {
    // In indexed mode, data stores index numbers as strings
    const raw = layer.data[index];
    if (raw === '' || raw === '-1') return '';
    const numIndex = parseInt(raw, 10);
    if (isNaN(numIndex) || numIndex < 0 || numIndex >= layer.frameIndex.length) return '';
    return layer.frameIndex[numIndex];
  }

  // Names mode: data directly contains frameId strings
  return layer.data[index];
}

/**
 * Set the frame ID at tile position (x, y) in a tile layer.
 * Mutates the layer data in place for performance.
 * Use "" to clear a tile.
 */
export function setTileAt(
  layer: TileLayerData,
  x: number,
  y: number,
  width: number,
  frameId: string,
): void {
  if (x < 0 || y < 0 || x >= width) return;
  const index = y * width + x;
  if (index < 0 || index >= layer.data.length) return;

  if (layer.encoding === 'indexed' && layer.frameIndex) {
    // In indexed mode, we need to find or add the frameId in frameIndex
    if (frameId === '') {
      layer.data[index] = '';
      return;
    }
    let frameIdx = layer.frameIndex.indexOf(frameId);
    if (frameIdx === -1) {
      frameIdx = layer.frameIndex.length;
      layer.frameIndex.push(frameId);
    }
    layer.data[index] = String(frameIdx);
    return;
  }

  // Names mode: store frameId directly
  layer.data[index] = frameId;
}

// ── Encoding conversion ───────────────────────────────────────

/**
 * Convert a tile layer to 'names' encoding if it is in 'indexed' mode.
 * Returns a new data array with resolved frame ID strings.
 * If already in 'names' mode, returns a copy of the existing data.
 */
export function resolveTileData(layer: TileLayerData): string[] {
  if (layer.encoding === 'names' || !layer.frameIndex) {
    return [...layer.data];
  }

  // Indexed mode: resolve each entry through the frameIndex lookup
  return layer.data.map((raw) => {
    if (raw === '' || raw === '-1') return '';
    const numIndex = parseInt(raw, 10);
    if (isNaN(numIndex) || numIndex < 0 || numIndex >= layer.frameIndex!.length) return '';
    return layer.frameIndex![numIndex];
  });
}
