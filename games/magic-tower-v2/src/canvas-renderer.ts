/**
 * canvas-renderer.ts — Canvas2D renderer that uses engine data structures.
 * Draws tile layers and entities using HTMLImageElement + sprite sheet frame data.
 */

import type {
  SceneRuntime,
  TileLayerRuntime,
  EntityLayerRuntime,
  SpriteSheetRuntime,
  FrameRuntime,
} from '@mote/engine';
import { Entity } from '@mote/engine';
import type { Canvas2DAssets } from './canvas-loader';

export class Canvas2DRenderer {
  private ctx: CanvasRenderingContext2D;
  private assets: Canvas2DAssets;
  private spriteSheets: Map<string, SpriteSheetRuntime>;

  constructor(
    ctx: CanvasRenderingContext2D,
    assets: Canvas2DAssets,
    sheets: Map<string, SpriteSheetRuntime>
  ) {
    this.ctx = ctx;
    this.assets = assets;
    this.spriteSheets = sheets;
  }

  clear(): void {
    this.ctx.fillStyle = '#111';
    this.ctx.fillRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
  }

  /** Render a tile layer */
  renderTileLayer(
    layer: TileLayerRuntime,
    mapCols: number,
    mapRows: number,
    tw: number,
    th: number
  ): void {
    const sheet = this.spriteSheets.get(layer.spriteSheet);
    if (!sheet) return;
    const img = this.assets.images.get(layer.spriteSheet);
    if (!img) return;

    for (let row = 0; row < mapRows; row++) {
      for (let col = 0; col < mapCols; col++) {
        const frameId = layer.data[row * mapCols + col];
        if (!frameId || frameId === '') continue;

        const frame = sheet.frames.get(frameId);
        if (!frame) continue;

        // Source rect from sprite sheet PNG
        // Dest: upscale 16px source to 32px tile on canvas
        this.ctx.drawImage(
          img,
          frame.x,
          frame.y,
          frame.w,
          frame.h,
          col * tw,
          row * th,
          tw,
          th
        );
      }
    }
  }

  /** Render an Entity using its current frame */
  renderEntity(entity: Entity): void {
    if (!entity.visible) return;

    const frameData = entity.getCurrentFrame();
    if (!frameData) return;

    const img = this.assets.images.get(frameData.sheet.id);
    if (!img) return;

    const frame = frameData.frame;
    this.ctx.drawImage(
      img,
      frame.x,
      frame.y,
      frame.w,
      frame.h,
      entity.x,
      entity.y,
      entity.width,
      entity.height
    );
  }

  /** Draw a specific frame from a sheet at a position (for player rendering with direction) */
  drawFrame(
    sheetId: string,
    frameId: string,
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    const sheet = this.spriteSheets.get(sheetId);
    if (!sheet) return;
    const img = this.assets.images.get(sheetId);
    if (!img) return;
    const frame = sheet.frames.get(frameId);
    if (!frame) return;

    this.ctx.drawImage(
      img,
      frame.x,
      frame.y,
      frame.w,
      frame.h,
      x,
      y,
      w,
      h
    );
  }
}
