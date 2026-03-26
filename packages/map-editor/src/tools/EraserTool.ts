import { BaseTool } from './Tool.js';
import { PaintTilesCommand } from '../commands/TileCommands.js';

export class EraserTool extends BaseTool {
  readonly name = '橡皮';
  readonly icon = '⌫';
  readonly cursor = 'not-allowed';

  // 记录本次拖拽的所有擦除操作
  private erasedTiles: { x: number; y: number; oldTile: number; newTile: number }[] = [];

  onMouseDown(pos: { x: number; y: number }): void {
    this.isDragging = true;
    this.erasedTiles = [];
    this.erase(pos);
  }

  onMouseMove(pos: { x: number; y: number }): void {
    if (this.isDragging) {
      this.erase(pos);
    }
  }

  onMouseUp(_pos: { x: number; y: number }): void {
    this.isDragging = false;

    // 提交命令到历史记录
    if (this.erasedTiles.length > 0) {
      this.editor.executeCommand(new PaintTilesCommand(
        this.editor,
        [...this.erasedTiles]
      ));
      this.erasedTiles = [];
    }

    this.lastPos = null;
  }

  private erase(pos: { x: number; y: number }): void {
    if (this.lastPos && this.lastPos.x === pos.x && this.lastPos.y === pos.y) {
      return;
    }

    const oldTile = this.editor.getTile(pos.x, pos.y);

    // 只有当瓦片不是 VOID 时才记录
    if (oldTile !== 0) {
      this.editor.setTile(pos.x, pos.y, 0);
      this.erasedTiles.push({
        x: pos.x,
        y: pos.y,
        oldTile,
        newTile: 0,
      });
    }

    this.lastPos = { ...pos };
  }
}
