import type { Command } from '../types/editor.js';
import type { EditorBridge } from '../core/EditorBridge.js';

/**
 * SetTileCommand - 设置单个 Tile 的命令
 * 
 * 支持 Undo/Redo，记录修改前后的 tile ID
 */
export class SetTileCommand implements Command {
  readonly description: string;

  constructor(
    private bridge: EditorBridge,
    private layerName: string,
    private x: number,
    private y: number,
    private oldTileId: number,
    private newTileId: number,
  ) {
    this.description = `Set tile (${x},${y}) to ${newTileId}`;
  }

  execute(): void {
    this.bridge.setTile(this.layerName, this.x, this.y, this.newTileId);
  }

  undo(): void {
    this.bridge.setTile(this.layerName, this.x, this.y, this.oldTileId);
  }
}

/**
 * BatchSetTileCommand - 批量设置 Tile 的命令
 * 
 * 用于画笔、矩形等连续操作，作为一个整体进行 Undo/Redo
 */
export class BatchSetTileCommand implements Command {
  readonly description: string;

  constructor(
    private bridge: EditorBridge,
    private layerName: string,
    private changes: Array<{
      x: number;
      y: number;
      oldTileId: number;
      newTileId: number;
    }>,
  ) {
    this.description = changes.length === 1 
      ? `Set tile (${changes[0].x},${changes[0].y})` 
      : `Paint ${changes.length} tiles`;
  }

  execute(): void {
    for (const change of this.changes) {
      this.bridge.setTile(this.layerName, change.x, change.y, change.newTileId);
    }
  }

  undo(): void {
    // 逆序撤销
    for (let i = this.changes.length - 1; i >= 0; i--) {
      const change = this.changes[i];
      this.bridge.setTile(this.layerName, change.x, change.y, change.oldTileId);
    }
  }

  /**
   * 获取受影响的 tile 数量
   */
  getAffectedCount(): number {
    return this.changes.length;
  }
}

/**
 * ClearLayerCommand - 清空图层的命令
 */
export class ClearLayerCommand implements Command {
  readonly description: string;
  private backup: number[] = [];

  constructor(
    private bridge: EditorBridge,
    private layerName: string,
    _width: number,
    _height: number,
  ) {
    this.description = `Clear layer "${layerName}"`;
  }

  execute(): void {
    const tilemap = this.bridge.getTilemapData();
    if (!tilemap) return;

    const layer = tilemap.layers.find(l => l.name === this.layerName);
    if (!layer) return;

    // 备份当前数据
    this.backup = [...layer.data];

    // 清空 (GID 0 表示空)
    layer.data.fill(0);
  }

  undo(): void {
    const tilemap = this.bridge.getTilemapData();
    if (!tilemap) return;

    const layer = tilemap.layers.find(l => l.name === this.layerName);
    if (!layer || this.backup.length === 0) return;

    layer.data = [...this.backup];
  }
}

/**
 * FillRegionCommand - 填充区域的命令
 */
export class FillRegionCommand implements Command {
  readonly description: string;
  private backup: Array<{ x: number; y: number; oldTileId: number }> = [];

  constructor(
    private bridge: EditorBridge,
    private layerName: string,
    private x: number,
    private y: number,
    private width: number,
    private height: number,
    private tileId: number,
  ) {
    this.description = `Fill region (${x},${y},${width}x${height}) with tile ${tileId}`;
  }

  execute(): void {
    this.backup = [];
    
    for (let dy = 0; dy < this.height; dy++) {
      for (let dx = 0; dx < this.width; dx++) {
        const tx = this.x + dx;
        const ty = this.y + dy;
        const oldTileId = this.bridge.getTile(this.layerName, tx, ty);
        
        if (oldTileId !== this.tileId) {
          this.backup.push({ x: tx, y: ty, oldTileId });
          this.bridge.setTile(this.layerName, tx, ty, this.tileId);
        }
      }
    }
  }

  undo(): void {
    for (const item of this.backup) {
      this.bridge.setTile(this.layerName, item.x, item.y, item.oldTileId);
    }
  }
}
