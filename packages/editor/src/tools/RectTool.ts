import { BaseTilemapTool, type TilePreview } from './TilemapTool.js';
import { BatchSetTileCommand } from '../commands/SetTileCommand.js';

/**
 * RectTool - 矩形填充工具
 * 
 * 拖拽绘制矩形区域，填充选中的 tile
 */
export class RectTool extends BaseTilemapTool {
  readonly name = 'Rectangle';
  readonly icon = '▭';
  readonly cursor = 'crosshair';

  private startX = 0;
  private startY = 0;
  private currentX = 0;
  private currentY = 0;
  private isDrawing = false;

  onPointerDown(x: number, y: number): void {
    this.isDragging = true;
    this.isDrawing = true;
    this.startX = x;
    this.startY = y;
    this.currentX = x;
    this.currentY = y;
  }

  onPointerMove(x: number, y: number): void {
    if (this.isDragging) {
      this.currentX = x;
      this.currentY = y;
    }
  }

  onPointerUp(_x: number, _y: number): void {
    if (this.isDragging && this.isDrawing) {
      this.fillRect();
    }
    this.isDragging = false;
    this.isDrawing = false;
  }

  private fillRect(): void {
    const minX = Math.min(this.startX, this.currentX);
    const maxX = Math.max(this.startX, this.currentX);
    const minY = Math.min(this.startY, this.currentY);
    const maxY = Math.max(this.startY, this.currentY);

    const changes: Array<{ x: number; y: number; oldTileId: number; newTileId: number }> = [];

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const oldTileId = this.bridge.getTile(this.layerName, x, y);
        if (oldTileId !== this.tileId) {
          changes.push({ x, y, oldTileId, newTileId: this.tileId });
        }
      }
    }

    if (changes.length > 0) {
      this.history.execute(new BatchSetTileCommand(
        this.bridge,
        this.layerName,
        changes,
      ));
    }
  }

  getPreview(): TilePreview | null {
    if (!this.isDrawing) return null;

    const minX = Math.min(this.startX, this.currentX);
    const maxX = Math.max(this.startX, this.currentX);
    const minY = Math.min(this.startY, this.currentY);
    const maxY = Math.max(this.startY, this.currentY);

    return {
      type: 'rect',
      x: minX,
      y: minY,
      w: maxX - minX + 1,
      h: maxY - minY + 1,
    };
  }
}
