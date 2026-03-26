import { BaseTool } from './Tool.js';
import { PaintTilesCommand } from '../commands/TileCommands.js';

export class RectTool extends BaseTool {
  readonly name = '矩形';
  readonly icon = '▭';
  readonly cursor = 'crosshair';

  private startPos: { x: number; y: number } | null = null;
  private endPos: { x: number; y: number } | null = null;

  onMouseDown(pos: { x: number; y: number }): void {
    this.isDragging = true;
    this.startPos = { ...pos };
    this.endPos = { ...pos };
  }

  onMouseMove(pos: { x: number; y: number }): void {
    if (this.isDragging && this.startPos) {
      this.endPos = { ...pos };
    }
  }

  onMouseUp(_pos: { x: number; y: number }): void {
    if (this.isDragging && this.startPos && this.endPos) {
      this.fillRect();
    }
    this.isDragging = false;
    this.startPos = null;
    this.endPos = null;
  }

  private fillRect(): void {
    if (!this.startPos || !this.endPos) return;

    const minX = Math.min(this.startPos.x, this.endPos.x);
    const maxX = Math.max(this.startPos.x, this.endPos.x);
    const minY = Math.min(this.startPos.y, this.endPos.y);
    const maxY = Math.max(this.startPos.y, this.endPos.y);

    const tileId = this.editor.getSelectedTile();
    const changes: { x: number; y: number; oldTile: number; newTile: number }[] = [];

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const oldTile = this.editor.getTile(x, y);
        if (oldTile !== tileId) {
          this.editor.setTile(x, y, tileId);
          changes.push({ x, y, oldTile, newTile: tileId });
        }
      }
    }

    // 提交命令到历史记录
    if (changes.length > 0) {
      this.editor.executeCommand(new PaintTilesCommand(this.editor, changes));
    }
  }

  // 获取预览矩形（用于渲染）
  getPreviewRect(): { x: number; y: number; w: number; h: number } | null {
    if (!this.isDragging || !this.startPos || !this.endPos) return null;

    const minX = Math.min(this.startPos.x, this.endPos.x);
    const maxX = Math.max(this.startPos.x, this.endPos.x);
    const minY = Math.min(this.startPos.y, this.endPos.y);
    const maxY = Math.max(this.startPos.y, this.endPos.y);

    return {
      x: minX,
      y: minY,
      w: maxX - minX + 1,
      h: maxY - minY + 1,
    };
  }

  // 获取起始位置（用于绘制预览）
  getStartPos(): { x: number; y: number } | null {
    return this.startPos;
  }

  // 获取结束位置
  getEndPos(): { x: number; y: number } | null {
    return this.endPos;
  }
}
