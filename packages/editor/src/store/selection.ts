import { signal } from "@preact/signals";

export type ToolType = "brush" | "eraser" | "fill" | "eyedropper";

export const activeTool = signal<ToolType>("brush");

/** Currently selected tile GIDs forming the brush */
export const brushTiles = signal<number[]>([]);
export const brushWidth = signal(1);
export const brushHeight = signal(1);

/** Which tileset is shown in the palette */
export const activeTilesetId = signal<string | null>(null);

/** Hovered tile coord in the viewport */
export const hoverTile = signal<{ x: number; y: number } | null>(null);

/**
 * Editor display scale (integer).
 * Controls tile display size in TilePalette: displaySize = tileWidth * displayScale.
 * Number keys 1-6 in Viewport snap zoom to this integer scale.
 * Auto-calculated on tileset import: Math.max(1, Math.round(32 / tileWidth)).
 */
export const displayScale = signal(2);

/** Current viewport zoom level (for display in footer) */
export const viewportZoom = signal(1);
