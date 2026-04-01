import { BaseTilemapTool } from './TilemapTool.js';
import { BatchSetTileCommand } from '../commands/SetTileCommand.js';

/**
 * BrushTool - 画笔工具
 * 
 * 拖拽绘制连续的 tiles，支持批量 Undo
 */
export class BrushTool extends BaseTilemapTool {
  readonly name = 'Brush';
  readonly icon = '🖌️';
  readonly cursor = 'crosshair';

  private paintedTiles: Array<{ x: number; y: number; oldTileId: number; newTileId: number }> = [];

  onPointerDown(x: number, y: number): void {
    this.isDragging = true;
    this.paintedTiles = [];
    this.paintAt(x, y);
  }

  onPointerMove(x: number, y: number): void {
    if (this.isDragging) {
      this.paintAt(x, y);
    }
  }

  onPointerUp(_x: number, _y: number): void {
    if (this.isDragging && this.paintedTiles.length > 0) {
      // 提交批量命令
      this.history.execute(new BatchSetTileCommand(
        this.bridge,
        this.layerName,
        [...this.paintedTiles],
      ));
      this.paintedTiles = [];
    }
    this.isDragging = false;
    this.lastX = -1;
    this.lastY = -1;
  }

  private paintAt(x: number, y: number): void {
    // 避免重复绘制同一格子
    if (x === this.lastX && y === this.lastY) return;

    const oldTileId = this.bridge.getTile(this.layerName, x, y);
    
    // 只有真正改变时才记录
    if (oldTileId !== this.tileId) {
      // 立即应用（用于实时预览）
      this.bridge.setTile(this.layerName, x, y, this.tileId);
      
      // 记录变更
      this.paintedTiles.push({
        x,
        y,
        oldTileId,
        newTileId: this.tileId,
      });
      
      this.lastX = x;
      this.lastY = y;
    }
  }
}
