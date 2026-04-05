/**
 * canvas-renderer.ts — Canvas2D renderer with camera support for scrolling.
 * Extends the magic-tower pattern with viewport-aware rendering that culls
 * off-screen tiles and translates entity world positions to screen space.
 *
 * Camera-aware methods accept raw cameraX/cameraY numbers (and optionally
 * viewport dimensions) so the caller can pass camera.x / camera.y directly.
 */

import type {
  TileLayerRuntime,
  SpriteSheetRuntime,
  FrameRuntime,
} from '@mote/engine';
import { Entity } from '@mote/engine';
import type { Canvas2DAssets } from './canvas-loader';
import type { ScrollingCamera } from './scrolling-camera';

export class Canvas2DRenderer {
  private ctx: CanvasRenderingContext2D;
  private assets: Canvas2DAssets;
  private spriteSheets: Map<string, SpriteSheetRuntime>;

  constructor(
    ctx: CanvasRenderingContext2D,
    assets: Canvas2DAssets,
    sheets: Map<string, SpriteSheetRuntime>,
  ) {
    this.ctx = ctx;
    this.assets = assets;
    this.spriteSheets = sheets;
  }

  // ── Basic rendering ─────────────────────────────────────────────────────

  /** Clear the canvas with a dark background. */
  clear(color = '#1a3a1a'): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(0, 0, this.ctx.canvas.width, this.ctx.canvas.height);
  }

  // ── Tile layer without camera (full-map render, like magic-tower) ──────

  /** Render an entire tile layer without camera offset (for non-scrolling views). */
  renderTileLayer(
    layer: TileLayerRuntime,
    mapCols: number,
    mapRows: number,
    tw: number,
    th: number,
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

        this.ctx.drawImage(
          img,
          frame.x, frame.y, frame.w, frame.h,
          col * tw, row * th, tw, th,
        );
      }
    }
  }

  // ── Tile layer WITH camera (viewport culling) ─────────────────────────

  /**
   * Render only the tiles visible in the viewport, applying camera offset.
   *
   * Accepts either:
   *  - A ScrollingCamera object as the 6th argument, OR
   *  - Raw numbers: cameraX, cameraY, viewportW, viewportH as args 6-9
   *
   * main.ts calls this with 9 arguments (raw numbers).
   */
  renderTileLayerWithCamera(
    layer: TileLayerRuntime,
    mapCols: number,
    mapRows: number,
    tw: number,
    th: number,
    cameraXOrCamera: number | ScrollingCamera,
    cameraY?: number,
    viewportW?: number,
    viewportH?: number,
  ): void {
    const sheet = this.spriteSheets.get(layer.spriteSheet);
    if (!sheet) return;
    const img = this.assets.images.get(layer.spriteSheet);
    if (!img) return;

    let camX: number;
    let camY: number;
    let vpW: number;
    let vpH: number;

    if (typeof cameraXOrCamera === 'object') {
      // ScrollingCamera object
      const cam = cameraXOrCamera;
      camX = cam.x;
      camY = cam.y;
      vpW = cam.viewportWidth;
      vpH = cam.viewportHeight;
    } else {
      // Raw numbers
      camX = cameraXOrCamera;
      camY = cameraY ?? 0;
      vpW = viewportW ?? this.ctx.canvas.width;
      vpH = viewportH ?? this.ctx.canvas.height;
    }

    // Calculate visible tile range
    const startCol = Math.max(0, Math.floor(camX / tw));
    const startRow = Math.max(0, Math.floor(camY / th));
    const endCol = Math.min(mapCols - 1, Math.floor((camX + vpW) / tw));
    const endRow = Math.min(mapRows - 1, Math.floor((camY + vpH) / th));

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const idx = row * mapCols + col;
        const frameId = layer.data[idx];
        if (!frameId || frameId === '') continue;

        const frame = sheet.frames.get(frameId);
        if (!frame) continue;

        // World position -> screen position
        const screenX = col * tw - camX;
        const screenY = row * th - camY;

        this.ctx.drawImage(
          img,
          frame.x, frame.y, frame.w, frame.h,
          Math.round(screenX), Math.round(screenY), tw, th,
        );
      }
    }
  }

  // ── Entity rendering without camera ───────────────────────────────────

  /** Render an entity at its world position (no camera transform). */
  renderEntity(entity: Entity): void {
    if (!entity.visible) return;

    const frameData = entity.getCurrentFrame();
    if (!frameData) return;

    const img = this.assets.images.get(frameData.sheet.id);
    if (!img) return;

    const frame = frameData.frame;
    this.ctx.drawImage(
      img,
      frame.x, frame.y, frame.w, frame.h,
      entity.x, entity.y, entity.width, entity.height,
    );
  }

  // ── Entity rendering WITH camera ──────────────────────────────────────

  /**
   * Render an entity translated to screen position via camera offset.
   *
   * Accepts either:
   *  - A ScrollingCamera object as the 2nd argument, OR
   *  - Raw cameraX, cameraY numbers as args 2-3
   *
   * main.ts calls this with 3 arguments: (entity, camera.x, camera.y).
   */
  renderEntityWithCamera(
    entity: Entity,
    cameraXOrCamera: number | ScrollingCamera,
    cameraY?: number,
  ): void {
    if (!entity.visible) return;

    let camX: number;
    let camY: number;
    let vpW: number;
    let vpH: number;

    if (typeof cameraXOrCamera === 'object') {
      const cam = cameraXOrCamera;
      camX = cam.x;
      camY = cam.y;
      vpW = cam.viewportWidth;
      vpH = cam.viewportHeight;
    } else {
      camX = cameraXOrCamera;
      camY = cameraY ?? 0;
      vpW = this.ctx.canvas.width;
      vpH = this.ctx.canvas.height;
    }

    // Quick visibility check
    if (
      entity.x + entity.width <= camX ||
      entity.x >= camX + vpW ||
      entity.y + entity.height <= camY ||
      entity.y >= camY + vpH
    ) {
      return;
    }

    const frameData = entity.getCurrentFrame();
    if (!frameData) return;

    const img = this.assets.images.get(frameData.sheet.id);
    if (!img) return;

    const frame = frameData.frame;
    const screenX = entity.x - camX;
    const screenY = entity.y - camY;

    this.ctx.drawImage(
      img,
      frame.x, frame.y, frame.w, frame.h,
      Math.round(screenX), Math.round(screenY), entity.width, entity.height,
    );
  }

  // ── Draw a specific frame at screen coordinates ───────────────────────

  /**
   * Draw a frame from a sprite sheet at absolute screen coordinates.
   * Useful for HUD elements, effects overlays, or manual sprite placement.
   */
  drawFrameAt(
    sheetId: string,
    frameId: string,
    screenX: number,
    screenY: number,
    w: number,
    h: number,
  ): void {
    const sheet = this.spriteSheets.get(sheetId);
    if (!sheet) return;
    const img = this.assets.images.get(sheetId);
    if (!img) return;
    const frame = sheet.frames.get(frameId);
    if (!frame) return;

    this.ctx.drawImage(
      img,
      frame.x, frame.y, frame.w, frame.h,
      Math.round(screenX), Math.round(screenY), w, h,
    );
  }

  /**
   * Draw a specific frame at a world position, translated through the camera.
   * Useful for drawing effects, weapon animations, etc. at world positions.
   */
  drawFrameAtWorld(
    sheetId: string,
    frameId: string,
    worldX: number,
    worldY: number,
    w: number,
    h: number,
    cameraXOrCamera: number | ScrollingCamera,
    cameraY?: number,
  ): void {
    let camX: number;
    let camY: number;
    let vpW: number;
    let vpH: number;

    if (typeof cameraXOrCamera === 'object') {
      const cam = cameraXOrCamera;
      camX = cam.x;
      camY = cam.y;
      vpW = cam.viewportWidth;
      vpH = cam.viewportHeight;
    } else {
      camX = cameraXOrCamera;
      camY = cameraY ?? 0;
      vpW = this.ctx.canvas.width;
      vpH = this.ctx.canvas.height;
    }

    // Visibility check
    if (
      worldX + w <= camX || worldX >= camX + vpW ||
      worldY + h <= camY || worldY >= camY + vpH
    ) {
      return;
    }

    this.drawFrameAt(sheetId, frameId, worldX - camX, worldY - camY, w, h);
  }

  // ── Text / primitive helpers ──────────────────────────────────────────

  /** Draw text at screen coordinates. */
  drawText(
    text: string,
    x: number,
    y: number,
    color = '#fff',
    font = '14px monospace',
    align: CanvasTextAlign = 'left',
  ): void {
    this.ctx.fillStyle = color;
    this.ctx.font = font;
    this.ctx.textAlign = align;
    this.ctx.textBaseline = 'top';
    this.ctx.fillText(text, x, y);
  }

  /** Draw a filled rectangle at screen coordinates. */
  drawRect(
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
  ): void {
    this.ctx.fillStyle = color;
    this.ctx.fillRect(x, y, w, h);
  }

  /** Draw a stroked rectangle at screen coordinates. */
  drawRectOutline(
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    lineWidth = 1,
  ): void {
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = lineWidth;
    this.ctx.strokeRect(x, y, w, h);
  }

  // ── Access to raw context (for advanced drawing) ──────────────────────

  /** Get the underlying CanvasRenderingContext2D for custom drawing. */
  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  /** Get a loaded HTMLImageElement by sprite sheet ID. */
  getImage(sheetId: string): HTMLImageElement | undefined {
    return this.assets.images.get(sheetId);
  }

  /** Get a sprite sheet runtime by ID. */
  getSheet(sheetId: string): SpriteSheetRuntime | undefined {
    return this.spriteSheets.get(sheetId);
  }

  /** Get a frame runtime from a sheet. */
  getFrame(sheetId: string, frameId: string): FrameRuntime | undefined {
    return this.spriteSheets.get(sheetId)?.frames.get(frameId);
  }
}
