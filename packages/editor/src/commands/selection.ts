import type { Command } from "../store/history";
import { currentMap, bumpMapVersion } from "../store/project";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * MoveSelectionCommand - records cutting tiles from a source rect
 * and pasting them at a destination rect on a given layer.
 *
 * execute(): clears source, writes dest
 * undo(): clears dest, restores source
 */
export class MoveSelectionCommand implements Command {
  readonly label = "\u79fb\u52a8\u9009\u533a";
  private executed = false;

  /** Tiles that were at the destination before pasting (for undo) */
  private destOldTiles: number[];

  constructor(
    private layerId: string,
    private sourceRect: Rect,
    private destRect: Rect,
    /** The tile data (gids) that were cut, row-major */
    private tiles: number[],
    /** Tiles that were at the source before cutting (for undo restore) */
    private sourceOldTiles: number[],
  ) {
    // Capture what's currently at the destination so undo can restore it
    const map = currentMap.value;
    const layer = map.layers.find((l) => l.id === this.layerId);
    this.destOldTiles = [];
    if (layer) {
      for (let r = 0; r < destRect.h; r++) {
        for (let c = 0; c < destRect.w; c++) {
          const tx = destRect.x + c;
          const ty = destRect.y + r;
          if (tx >= 0 && tx < map.width && ty >= 0 && ty < map.height) {
            this.destOldTiles.push(layer.data[ty * map.width + tx]);
          } else {
            this.destOldTiles.push(0);
          }
        }
      }
    }
  }

  execute(): void {
    if (this.executed) {
      // Redo path: clear source, write dest
      const map = currentMap.value;
      const layer = map.layers.find((l) => l.id === this.layerId);
      if (!layer) return;

      // Clear source
      for (let r = 0; r < this.sourceRect.h; r++) {
        for (let c = 0; c < this.sourceRect.w; c++) {
          const tx = this.sourceRect.x + c;
          const ty = this.sourceRect.y + r;
          if (tx >= 0 && tx < map.width && ty >= 0 && ty < map.height) {
            layer.data[ty * map.width + tx] = 0;
          }
        }
      }

      // Write dest
      for (let r = 0; r < this.destRect.h; r++) {
        for (let c = 0; c < this.destRect.w; c++) {
          const tx = this.destRect.x + c;
          const ty = this.destRect.y + r;
          if (tx >= 0 && tx < map.width && ty >= 0 && ty < map.height) {
            layer.data[ty * map.width + tx] = this.tiles[r * this.destRect.w + c];
          }
        }
      }
      bumpMapVersion();
    }
    this.executed = true;
  }

  undo(): void {
    const map = currentMap.value;
    const layer = map.layers.find((l) => l.id === this.layerId);
    if (!layer) return;

    // Clear dest, restore old dest tiles
    for (let r = 0; r < this.destRect.h; r++) {
      for (let c = 0; c < this.destRect.w; c++) {
        const tx = this.destRect.x + c;
        const ty = this.destRect.y + r;
        if (tx >= 0 && tx < map.width && ty >= 0 && ty < map.height) {
          layer.data[ty * map.width + tx] = this.destOldTiles[r * this.destRect.w + c];
        }
      }
    }

    // Restore source
    for (let r = 0; r < this.sourceRect.h; r++) {
      for (let c = 0; c < this.sourceRect.w; c++) {
        const tx = this.sourceRect.x + c;
        const ty = this.sourceRect.y + r;
        if (tx >= 0 && tx < map.width && ty >= 0 && ty < map.height) {
          layer.data[ty * map.width + tx] = this.sourceOldTiles[r * this.sourceRect.w + c];
        }
      }
    }
    bumpMapVersion();
  }
}
