// ═══════════════════════════════════════════════════════════════
// SpriteSheet.ts — Unified sprite sheet type (replaces TileSet + SpriteAtlas)
// A SpriteSheet is a single image sliced into named frames,
// supporting grid, packed, xml, and manual slicing modes.
// ═══════════════════════════════════════════════════════════════

import type { ColliderShape } from './Collider';

// ── Slicing modes ─────────────────────────────────────────────

export type SlicingMode = 'grid' | 'packed' | 'xml' | 'manual';

export interface GridSlicing {
  mode: 'grid';
  tileWidth: number;
  tileHeight: number;
  margin?: number;
  spacing?: number;
}

export interface PackedSlicing {
  mode: 'packed';
  source?: string; // path to TexturePacker JSON
}

export interface XmlSlicing {
  mode: 'xml';
  source?: string; // path to Sparrow XML
}

export interface ManualSlicing {
  mode: 'manual';
}

export type Slicing = GridSlicing | PackedSlicing | XmlSlicing | ManualSlicing;

// ── Frame data ────────────────────────────────────────────────

/** Frame data — atomic sprite unit */
export interface FrameData {
  x: number;
  y: number;
  w: number;
  h: number;
  /** Collision shapes (can be multiple) */
  collider?: ColliderShape[];
  /** Tags for grouping/querying */
  tags?: string[];
  /** Custom properties */
  properties?: Record<string, unknown>;
  /** Trimmed sprite data (from TexturePacker) */
  trimmed?: boolean;
  sourceWidth?: number;
  sourceHeight?: number;
  offsetX?: number;
  offsetY?: number;
  /** Whether rotated 90° CW in atlas */
  rotated?: boolean;
}

/** Frame data with ID for array export format */
export interface FrameDataWithId extends FrameData {
  id: string;
}

// ── SpriteSheet ───────────────────────────────────────────────

/** Unified SpriteSheet — replaces both TileSet and SpriteAtlas */
export interface SpriteSheet {
  id: string;
  name: string;
  /** Path/URL to source image (runtime URL for display) */
  image: string;
  /** Original source image path (relative to project) for export */
  sourcePath?: string;
  imageWidth: number;
  imageHeight: number;
  /** How the image is sliced into frames */
  slicing: Slicing;
  /** Named frames — key is the Frame ID (string) */
  frames: Record<string, FrameData>;
}

// ── Frame reference ───────────────────────────────────────────

/** Reference to a specific frame in a specific sheet */
export type FrameRef = {
  sheetId: string;
  frameId: string;
};

// ── Helper: frame ID from grid index ──────────────────────────

/**
 * Generate a frame ID name from a grid index.
 * E.g. frameIdFromGridIndex(5, 10) => "frame_5"
 * The `columns` parameter is accepted for API consistency but
 * the name is simply "frame_{index}".
 */
export function frameIdFromGridIndex(index: number, _columns: number): string {
  return `frame_${index}`;
}

// ── Factory ───────────────────────────────────────────────────

/**
 * Create a SpriteSheet with grid slicing and auto-generated frame entries.
 * Frames are named frame_0, frame_1, ... in row-major order.
 */
export function createGridSpriteSheet(
  id: string,
  name: string,
  image: string,
  imageWidth: number,
  imageHeight: number,
  tileWidth: number,
  tileHeight: number,
  margin = 0,
  spacing = 0,
): SpriteSheet {
  const columns = Math.floor(
    (imageWidth - margin * 2 + spacing) / (tileWidth + spacing),
  );
  const rows = Math.floor(
    (imageHeight - margin * 2 + spacing) / (tileHeight + spacing),
  );

  const frames: Record<string, FrameData> = {};
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const index = row * columns + col;
      const frameId = frameIdFromGridIndex(index, columns);
      frames[frameId] = {
        x: margin + col * (tileWidth + spacing),
        y: margin + row * (tileHeight + spacing),
        w: tileWidth,
        h: tileHeight,
      };
    }
  }

  return {
    id,
    name,
    image,
    imageWidth,
    imageHeight,
    slicing: {
      mode: 'grid',
      tileWidth,
      tileHeight,
      margin: margin || undefined,
      spacing: spacing || undefined,
    },
    frames,
  };
}

// ── Accessors ─────────────────────────────────────────────────

/** Returns {x, y, w, h} for a frame, or undefined if not found */
export function getFrameRect(
  sheet: SpriteSheet,
  frameId: string,
): { x: number; y: number; w: number; h: number } | undefined {
  const frame = sheet.frames[frameId];
  if (!frame) return undefined;
  return { x: frame.x, y: frame.y, w: frame.w, h: frame.h };
}

/**
 * Returns {columns, rows} for grid-mode sheets.
 * Returns undefined for non-grid sheets.
 */
export function getGridDimensions(
  sheet: SpriteSheet,
): { columns: number; rows: number } | undefined {
  if (sheet.slicing.mode !== 'grid') return undefined;
  const { tileWidth, tileHeight, margin = 0, spacing = 0 } = sheet.slicing;
  const columns = Math.floor(
    (sheet.imageWidth - margin * 2 + spacing) / (tileWidth + spacing),
  );
  const rows = Math.floor(
    (sheet.imageHeight - margin * 2 + spacing) / (tileHeight + spacing),
  );
  return { columns, rows };
}

/** Returns an array of all frame IDs in the sheet */
export function getAllFrameIds(sheet: SpriteSheet): string[] {
  return Object.keys(sheet.frames);
}

// ── Mutators (immutable — return new SpriteSheet) ─────────────

/**
 * Rename a frame. Returns a new SpriteSheet with the frame renamed.
 * If oldId does not exist, returns the sheet unchanged.
 */
export function renameFrame(
  sheet: SpriteSheet,
  oldId: string,
  newId: string,
): SpriteSheet {
  if (!(oldId in sheet.frames)) return sheet;
  if (oldId === newId) return sheet;
  const newFrames: Record<string, FrameData> = {};
  for (const [key, value] of Object.entries(sheet.frames)) {
    if (key === oldId) {
      newFrames[newId] = value;
    } else {
      newFrames[key] = value;
    }
  }
  return { ...sheet, frames: newFrames };
}

/**
 * Set collider shapes on a frame. Returns a new SpriteSheet.
 * If frameId does not exist, returns the sheet unchanged.
 */
export function setFrameCollider(
  sheet: SpriteSheet,
  frameId: string,
  collider: ColliderShape[],
): SpriteSheet {
  const frame = sheet.frames[frameId];
  if (!frame) return sheet;
  return {
    ...sheet,
    frames: {
      ...sheet.frames,
      [frameId]: { ...frame, collider },
    },
  };
}

/**
 * Remove collider from a frame. Returns a new SpriteSheet.
 * If frameId does not exist, returns the sheet unchanged.
 */
export function removeFrameCollider(
  sheet: SpriteSheet,
  frameId: string,
): SpriteSheet {
  const frame = sheet.frames[frameId];
  if (!frame) return sheet;
  const { collider: _, ...rest } = frame;
  return {
    ...sheet,
    frames: {
      ...sheet.frames,
      [frameId]: rest,
    },
  };
}
