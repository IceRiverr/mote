// ═════════════════════════════════════════════════════════════════════════════
// TileMapRenderer — renders tile layers and entity layers via SpriteBatch
// ═════════════════════════════════════════════════════════════════════════════

import type { ProjectRuntime, SpriteSheetRuntime, FrameRuntime } from './ProjectLoader.js';
import type { SceneRuntime, TileLayerRuntime, EntityLayerRuntime } from './SceneManager.js';
import type { SpriteBatch, AtlasRegion } from './gfx/SpriteBatch.js';
import { Color } from './Math.js';

/**
 * Computes an AtlasRegion from a FrameRuntime and the underlying texture size.
 */
function frameToRegion(frame: FrameRuntime, texW: number, texH: number): AtlasRegion {
  return {
    u0: frame.x / texW,
    v0: frame.y / texH,
    u1: (frame.x + frame.w) / texW,
    v1: (frame.y + frame.h) / texH,
    pixelWidth: frame.w,
    pixelHeight: frame.h,
  };
}

export class TileMapRenderer {
  private readonly project: ProjectRuntime;

  /** Cached AtlasRegions keyed by "sheetId:frameId" */
  private regionCache = new Map<string, AtlasRegion>();

  constructor(project: ProjectRuntime) {
    this.project = project;
  }

  /**
   * Render all visible layers of a scene into the given SpriteBatch.
   *
   * The caller is responsible for calling `batch.begin(camera)` before and
   * `batch.end()` after this method.
   *
   * @param scene  - active SceneRuntime
   * @param batch  - SpriteBatch (already begun)
   * @param camX   - camera left-edge in world coords
   * @param camY   - camera top-edge in world coords
   * @param viewW  - viewport width in world units
   * @param viewH  - viewport height in world units
   */
  render(
    scene: SceneRuntime,
    batch: SpriteBatch,
    camX: number,
    camY: number,
    viewW: number,
    viewH: number,
  ): void {
    const tw = scene.data.tileWidth;
    const th = scene.data.tileHeight;

    for (const layer of scene.layers) {
      if (!layer.visible) continue;

      if (layer.type === 'tile') {
        this.renderTileLayer(
          layer as TileLayerRuntime,
          scene.data.width, scene.data.height,
          tw, th,
          batch, camX, camY, viewW, viewH,
        );
      } else if (layer.type === 'entity') {
        this.renderEntityLayer(
          layer as EntityLayerRuntime,
          batch, camX, camY, viewW, viewH,
        );
      }
    }
  }

  // ── Tile layer rendering ──────────────────────────────────────────────────

  private renderTileLayer(
    layer: TileLayerRuntime,
    mapCols: number,
    mapRows: number,
    tw: number,
    th: number,
    batch: SpriteBatch,
    camX: number,
    camY: number,
    viewW: number,
    viewH: number,
  ): void {
    const sheet = this.project.spriteSheets.get(layer.spriteSheet);
    if (!sheet) return;

    const texW = sheet.texture.width;
    const texH = sheet.texture.height;
    const alpha = layer.opacity;
    const color = alpha < 1 ? new Color(1, 1, 1, alpha) : Color.white();

    // Compute visible tile range for frustum culling
    const startCol = Math.max(0, Math.floor(camX / tw));
    const startRow = Math.max(0, Math.floor(camY / th));
    const endCol = Math.min(mapCols, Math.ceil((camX + viewW) / tw));
    const endRow = Math.min(mapRows, Math.ceil((camY + viewH) / th));

    for (let row = startRow; row < endRow; row++) {
      for (let col = startCol; col < endCol; col++) {
        const idx = row * mapCols + col;
        const frameId = layer.data[idx];
        if (!frameId || frameId === '') continue;

        const frame = sheet.frames.get(frameId);
        if (!frame) continue;

        const region = this.getRegion(sheet, frame, texW, texH);

        // Draw centred at tile midpoint (SpriteBatch expects centre position)
        const cx = col * tw + tw * 0.5;
        const cy = row * th + th * 0.5;
        batch.drawQuad(cx, cy, tw, th, 0, region, sheet.atlas, color);
      }
    }
  }

  // ── Entity layer rendering ────────────────────────────────────────────────

  private renderEntityLayer(
    layer: EntityLayerRuntime,
    batch: SpriteBatch,
    camX: number,
    camY: number,
    viewW: number,
    viewH: number,
  ): void {
    const alpha = layer.opacity;
    const color = alpha < 1 ? new Color(1, 1, 1, alpha) : Color.white();

    for (const entity of layer.entities) {
      const def = this.project.entityDefs.get(entity.template);
      if (!def?.sprite) continue;

      const sheet = this.project.spriteSheets.get(def.sprite.sheetId);
      if (!sheet) continue;

      const frame = sheet.frames.get(def.sprite.frameId);
      if (!frame) continue;

      // Simple frustum culling
      const ex = entity.x;
      const ey = entity.y;
      const ew = entity.width;
      const eh = entity.height;

      if (ex + ew < camX || ey + eh < camY || ex > camX + viewW || ey > camY + viewH) {
        continue;
      }

      const texW = sheet.texture.width;
      const texH = sheet.texture.height;
      const region = this.getRegion(sheet, frame, texW, texH);

      // SpriteBatch expects the centre position
      const cx = ex + ew * 0.5;
      const cy = ey + eh * 0.5;
      batch.drawQuad(cx, cy, ew, eh, 0, region, sheet.atlas, color);
    }
  }

  // ── Region cache ──────────────────────────────────────────────────────────

  private getRegion(
    sheet: SpriteSheetRuntime,
    frame: FrameRuntime,
    texW: number,
    texH: number,
  ): AtlasRegion {
    const key = sheet.id + ':' + frame.id;
    let region = this.regionCache.get(key);
    if (!region) {
      region = frameToRegion(frame, texW, texH);
      this.regionCache.set(key, region);
    }
    return region;
  }

  /** Clear the internal region cache (call after hot-reloading sprite sheets). */
  clearCache(): void {
    this.regionCache.clear();
  }
}
