import { signal } from "@preact/signals";

export interface TileSelection {
  /** Top-left tile coords of the selection box */
  x: number;
  y: number;
  /** Width/height in tiles */
  w: number;
  h: number;
  /** The selected tile data (gids), row-major. null = no floating selection */
  tiles: number[] | null;
  /** Which layer the selection was cut from */
  layerId: string;
}

export const tileSelection = signal<TileSelection | null>(null);
