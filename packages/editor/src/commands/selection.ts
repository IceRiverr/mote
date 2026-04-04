import type { Command } from "../store/history";
import { currentMap, bumpMapVersion } from "../store/project";
import { isTileLayer } from "../data/TileMap";

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export class MoveSelectionCommand implements Command {
  readonly label = "移动选区";
  private executed = false;
  private destOldTiles: number[];

  constructor(
    private layerId: string,
    private sourceRect: Rect,
    private destRect: Rect,
    private tiles: number[],
    private sourceOldTiles: number[],
  ) {
    const map = currentMap.value;
    const layer = map.layers.find((l) => l.id === this.layerId);
    this.destOldTiles = [];
    if (layer && isTileLayer(layer)) {
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
      const map = currentMap.value;
      const layer = map.layers.find((l) => l.id === this.layerId);
      if (!layer || !isTileLayer(layer)) return;

      for (let r = 0; r < this.sourceRect.h; r++) {
        for (let c = 0; c < this.sourceRect.w; c++) {
          const tx = this.sourceRect.x + c;
          const ty = this.sourceRect.y + r;
          if (tx >= 0 && tx < map.width && ty >= 0 && ty < map.height) {
            layer.data[ty * map.width + tx] = 0;
          }
        }
      }

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
    if (!layer || !isTileLayer(layer)) return;

    for (let r = 0; r < this.destRect.h; r++) {
      for (let c = 0; c < this.destRect.w; c++) {
        const tx = this.destRect.x + c;
        const ty = this.destRect.y + r;
        if (tx >= 0 && tx < map.width && ty >= 0 && ty < map.height) {
          layer.data[ty * map.width + tx] = this.destOldTiles[r * this.destRect.w + c];
        }
      }
    }

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
