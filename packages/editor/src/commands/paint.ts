import type { Command } from "../store/history";
import { currentMap, bumpMapVersion } from "../store/project";
import { isTileLayer } from "../data/TileMap";

export type TileChange = Map<number, { oldGid: number; newGid: number }>;

export class PaintTilesCommand implements Command {
  readonly label: string;
  private changes: TileChange = new Map();
  private executed = false;

  constructor(private layerId: string, label = "绘制 tile") {
    this.label = label;
  }

  record(index: number, oldGid: number, newGid: number): void {
    const existing = this.changes.get(index);
    if (existing) {
      existing.newGid = newGid;
    } else {
      this.changes.set(index, { oldGid, newGid });
    }
  }

  hasChanges(): boolean {
    for (const [, { oldGid, newGid }] of this.changes) {
      if (oldGid !== newGid) return true;
    }
    return false;
  }

  execute(): void {
    if (this.executed) {
      const map = currentMap.value;
      const layer = map.layers.find((l) => l.id === this.layerId);
      if (!layer || !isTileLayer(layer)) return;
      for (const [idx, { newGid }] of this.changes) {
        layer.data[idx] = newGid;
      }
      bumpMapVersion();
    }
    this.executed = true;
  }

  undo(): void {
    const map = currentMap.value;
    const layer = map.layers.find((l) => l.id === this.layerId);
    if (!layer || !isTileLayer(layer)) return;
    for (const [idx, { oldGid }] of this.changes) {
      layer.data[idx] = oldGid;
    }
    bumpMapVersion();
  }
}
