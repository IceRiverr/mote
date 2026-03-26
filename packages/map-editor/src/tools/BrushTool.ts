import { BaseTool } from './Tool.js';
import { PaintTilesCommand } from '../commands/TileCommands.js';

export class BrushTool extends BaseTool {
  readonly name = '画笔';
  readonly icon = '🖱️';
  readonly cursor = 'crosshair';

  // 记录本次拖拽的所有绘制操作
  private paintedTiles: { x: number; y: number; oldTile: number; newTile: number }[] = [];

  onMouseDown(pos: { x: number; y: number }): void {
    this.isDragging = true;
    this.paintedTiles = [];
    this.paint(pos);
  }

  onMouseMove(pos: { x: number; y: number }): void {
    if (this.isDragging) {
      this.paint(pos);
    }
  }

  onMouseUp(_pos: { x: number; y: number }): void {
    this.isDragging = false;
    
    // 提交命令到历史记录
    if (this.paintedTiles.length > 0) {
      this.editor.executeCommand(new PaintTilesCommand(
        this.editor,
        [...this.paintedTiles]
      ));
      this.paintedTiles = [];
    }
    
    this.lastPos = null;
  }

  private paint(pos: { x: number; y: number }): void {
    // 避免重复绘制同一个格子
    if (this.lastPos && this.lastPos.x === pos.x && this.lastPos.y === pos.y) {
      return;
    }
    
    const tileId = this.editor.getSelectedTile();
    const oldTile = this.editor.getTile(pos.x, pos.y);
    
    // 只有当瓦片真正改变时才记录
    if (oldTile !== tileId) {
      this.editor.setTile(pos.x, pos.y, tileId);
      this.paintedTiles.push({
        x: pos.x,
        y: pos.y,
        oldTile,
        newTile: tileId,
      });
    }
    
    this.lastPos = { ...pos };
  }
}
