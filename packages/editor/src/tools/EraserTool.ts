import { BaseTilemapTool } from './TilemapTool.js';
import { BatchSetTileCommand } from '../commands/SetTileCommand.js';

/**
 * EraserTool - 橡皮工具
 * 
 * 拖拽擦除 tiles（设置为 0）
 */
export class EraserTool extends BaseTilemapTool {
  readonly name = 'Eraser';
  readonly icon = '🧼';
  readonly cursor = 'not-allowed';

  private erasedTiles: Array<{ x: number; y: number; oldTileId: number; newTileId: number }> = [];

  onPointerDown(x: number, y: number): void {
    this.isDragging = true;
    this.erasedTiles = [];
    this.eraseAt(x, y);
  }

  onPointerMove(x: number, y: number): void {
    if (this.isDragging) {
      this.eraseAt(x, y);
    }
  }

  onPointerUp(_x: number, _y: number): void {
    if (this.isDragging && this.erasedTiles.length > 0) {
      this.history.execute(new BatchSetTileCommand(
        this.bridge,
        this.layerName,
        [...this.erasedTiles],
      ));
      this.erasedTiles = [];
    }
    this.isDragging = false;
    this.lastX = -1;
    this.lastY = -1;
  }

  private eraseAt(x: number, y: number): void {
    if (x === this.lastX && y === this.lastY) return;

    const oldTileId = this.bridge.getTile(this.layerName, x, y);
    
    // 只擦除非空 tile
    if (oldTileId !== 0) {
      this.bridge.setTile(this.layerName, x, y, 0);
      
      this.erasedTiles.push({
        x,
        y,
        oldTileId,
        newTileId: 0,
      });
      
      this.lastX = x;
      this.lastY = y;
    }
  }
}
