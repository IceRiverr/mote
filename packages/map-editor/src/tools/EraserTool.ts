import { BaseTool } from './Tool.js';

export class EraserTool extends BaseTool {
  readonly name = '橡皮';
  readonly icon = '⌫';
  readonly cursor = 'not-allowed';

  onMouseDown(pos: { x: number; y: number }): void {
    this.isDragging = true;
    this.erase(pos);
  }

  onMouseMove(pos: { x: number; y: number }): void {
    if (this.isDragging) {
      this.erase(pos);
    }
  }

  onMouseUp(_pos: { x: number; y: number }): void {
    this.isDragging = false;
  }

  private erase(_pos: { x: number; y: number }): void {
    if (this.lastPos && this.lastPos.x === _pos.x && this.lastPos.y === _pos.y) {
      return;
    }
    
    // 0 是 VOID（空白）
    this.editor.setTile(_pos.x, _pos.y, 0);
    this.lastPos = { ..._pos };
  }
}
