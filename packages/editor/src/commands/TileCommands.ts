import type { Command } from './Command.js';
import type { MapEditor } from '../Editor.js';

/**
 * 绘制单个或多个瓦片的命令
 */
export class PaintTilesCommand implements Command {
  readonly name: string;
  
  private changes: { x: number; y: number; oldTile: number; newTile: number }[] = [];

  constructor(
    private editor: MapEditor,
    changes: { x: number; y: number; oldTile: number; newTile: number }[]
  ) {
    this.changes = changes;
    this.name = changes.length === 1 ? '绘制瓦片' : `绘制 ${changes.length} 个瓦片`;
  }

  execute(): void {
    for (const change of this.changes) {
      this.editor.setTile(change.x, change.y, change.newTile);
    }
  }

  undo(): void {
    for (const change of this.changes) {
      this.editor.setTile(change.x, change.y, change.oldTile);
    }
  }
}

/**
 * 调整地图尺寸的命令
 */
export class ResizeMapCommand implements Command {
  readonly name = '调整地图尺寸';
  
  constructor(
    private editor: MapEditor,
    private oldWidth: number,
    private oldHeight: number,
    private oldTiles: number[],
    private oldSpawnPoint: { x: number; y: number },
    private newWidth: number,
    private newHeight: number,
    private newTiles: number[],
    private newSpawnPoint: { x: number; y: number }
  ) {}

  execute(): void {
    this.applySize(this.newWidth, this.newHeight, this.newTiles, this.newSpawnPoint);
  }

  undo(): void {
    this.applySize(this.oldWidth, this.oldHeight, this.oldTiles, this.oldSpawnPoint);
  }

  private applySize(width: number, height: number, tiles: number[], spawnPoint: { x: number; y: number }): void {
    // 这里通过 editor 的内部方法应用尺寸
    // 需要修改 Editor 来支持这个操作
    const mapData = (this.editor as any).mapData;
    if (mapData) {
      mapData.width = width;
      mapData.height = height;
      mapData.tiles = [...tiles];
      mapData.spawnPoint = { ...spawnPoint };
      (this.editor as any).resizeCanvas();
      (this.editor as any).updateProperties();
    }
  }
}
