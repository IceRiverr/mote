import type { Command } from "../store/history";
import { currentMap, bumpMapVersion } from "../store/project";

// ---------------------------------------------------------------------------
// Record of tile changes: Map<index, {oldGid, newGid}>
// ---------------------------------------------------------------------------
export type TileChange = Map<number, { oldGid: number; newGid: number }>;

/**
 * PaintTilesCommand – records a set of tile changes on a specific layer.
 *
 * Usage:
 *   const cmd = new PaintTilesCommand(layerId);
 *   // while painting…
 *   cmd.record(index, oldGid, newGid);
 *   // on mouse up
 *   if (cmd.hasChanges()) executeCommand(cmd);   // already applied in-place
 */
export class PaintTilesCommand implements Command {
  readonly label: string;
  private changes: TileChange = new Map();
  private executed = false;

  constructor(private layerId: string, label = "绘制 tile") {
    this.label = label;
  }

  /** Record a single cell change (call this while painting) */
  record(index: number, oldGid: number, newGid: number): void {
    // Only keep the first old value if multiple writes hit the same cell
    const existing = this.changes.get(index);
    if (existing) {
      existing.newGid = newGid;
    } else {
      this.changes.set(index, { oldGid, newGid });
    }
  }

  /** Whether any actual changes were recorded */
  hasChanges(): boolean {
    for (const [, { oldGid, newGid }] of this.changes) {
      if (oldGid !== newGid) return true;
    }
    return false;
  }

  /**
   * Execute / redo.
   * On first call (`executed === false`) the data has already been mutated
   * during live painting, so we just bump the version.
   * On redo we need to re-apply.
   */
  execute(): void {
    if (this.executed) {
      // Redo path: re-apply changes
      const map = currentMap.value;
      const layer = map.layers.find((l) => l.id === this.layerId);
      if (!layer) return;
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
    if (!layer) return;
    for (const [idx, { oldGid }] of this.changes) {
      layer.data[idx] = oldGid;
    }
    bumpMapVersion();
  }
}
