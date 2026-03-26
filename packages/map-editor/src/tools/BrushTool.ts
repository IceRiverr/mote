import { BaseTool } from './Tool.js';

export class BrushTool extends BaseTool {
  readonly name = '画笔';
  readonly icon = '🖱️';
  readonly cursor = 'crosshair';

  onMouseDown(pos: { x: number; y: number }): void {
    this.isDragging = true;
    this.paint(pos);
  }

  onMouseMove(pos: { x: number; y: number }): void {
    if (this.isDragging) {
      this.paint(pos);
    }
  }

  onMouseUp(_pos: { x: number; y: number }): void {
    this.isDragging = false;
  }

  private paint(_pos: { x: number; y: number }): void {
    // 避免重复绘制同一个格子
    if (this.lastPos && this.lastPos.x === _pos.x && this.lastPos.y === _pos.y) {
      return;
    }
    
    const tileId = this.editor.getSelectedTile();
    this.editor.setTile(_pos.x, _pos.y, tileId);
    this.lastPos = { ..._pos };
  }
}
