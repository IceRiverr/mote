// ═══════════════════════════════════════════════════════════════════════════
// TextRenderer — High-level text rendering API
//
// Phase 1: BMFont rendering via SpriteBatch (zero extra shaders)
// Phase 2: MSDF rendering via dedicated TextBatch (separate pipeline)
//
// Usage:
//   const text = new TextRenderer(gfx, spriteBatch);
//   await text.loadBitmapFont('pixel', '/fonts/pixel.png', '/fonts/pixel.fnt');
//
//   spriteBatch.begin(camera);
//   text.drawText('Score: 1234', 10, 10, {
//     font: text.getFont('pixel'),
//     fontSize: 16,
//     color: { r: 1, g: 1, b: 1, a: 1 },
//   });
//   spriteBatch.end();
// ═══════════════════════════════════════════════════════════════════════════

import type { IGfxDevice, IGfxBindGroupLayout } from './IGfxDevice.js';
import type { SpriteBatch, AtlasRegion } from './SpriteBatch.js';
import { TextureAtlas } from './SpriteBatch.js';
import type { Color } from '../Math.js';
import { FontData, parseBMFont, parseMSDFJson } from './FontData.js';
import type { MSDFAtlasJson } from './FontData.js';
import { layoutText, measureText } from './FontLayout.js';
import type { TextStyle, TextLayoutResult } from './FontLayout.js';

// Re-export for convenience
export type { TextStyle, TextLayoutResult };

// ── Font Entry ───────────────────────────────────────────────────────────

interface FontEntry {
  data: FontData;
  atlas: TextureAtlas;
}

// ── Temp region object (reused to avoid GC) ──────────────────────────────

const _tmpRegion: AtlasRegion = {
  u0: 0, v0: 0, u1: 0, v1: 0,
  pixelWidth: 0, pixelHeight: 0,
};

const WHITE: Color = { r: 1, g: 1, b: 1, a: 1 } as Color;

// ── TextRenderer ─────────────────────────────────────────────────────────

export class TextRenderer {
  private readonly gfx: IGfxDevice;
  private readonly spriteBatch: SpriteBatch;
  private readonly atlasLayout: IGfxBindGroupLayout;
  private readonly fonts = new Map<string, FontEntry>();

  constructor(gfx: IGfxDevice, spriteBatch: SpriteBatch) {
    this.gfx = gfx;
    this.spriteBatch = spriteBatch;
    this.atlasLayout = spriteBatch.getAtlasBindGroupLayout();
  }

  // ── Font Loading ──

  /**
   * Load a BMFont (.fnt text format + atlas PNG).
   *
   * @param key       Unique font identifier
   * @param atlasUrl  URL to the font atlas PNG
   * @param fntUrl    URL to the .fnt descriptor file
   */
  async loadBitmapFont(key: string, atlasUrl: string, fntUrl: string): Promise<void> {
    if (this.fonts.has(key)) return;

    // Load .fnt text and atlas in parallel
    const [fntText, atlas] = await Promise.all([
      fetch(fntUrl).then(r => {
        if (!r.ok) throw new Error(`Failed to load font descriptor: ${fntUrl} (${r.status})`);
        return r.text();
      }),
      TextureAtlas.load(this.gfx, this.atlasLayout, atlasUrl),
    ]);

    const data = parseBMFont(fntText);
    this.fonts.set(key, { data, atlas });
  }

  /**
   * Load an MSDF font (msdf-atlas-gen JSON + atlas PNG).
   * NOTE: Phase 2 — MSDF rendering requires a dedicated TextBatch with MSDF shader.
   *       For now, this only loads the data. Rendering will fall back to bitmap-style
   *       (won't look correct for MSDF — placeholder until TextBatch is implemented).
   */
  async loadMSDFFont(key: string, atlasUrl: string, jsonUrl: string): Promise<void> {
    if (this.fonts.has(key)) return;

    const [jsonData, atlas] = await Promise.all([
      fetch(jsonUrl).then(r => {
        if (!r.ok) throw new Error(`Failed to load MSDF metadata: ${jsonUrl} (${r.status})`);
        return r.json() as Promise<MSDFAtlasJson>;
      }),
      TextureAtlas.load(this.gfx, this.atlasLayout, atlasUrl),
    ]);

    const data = parseMSDFJson(jsonData);
    this.fonts.set(key, { data, atlas });
  }

  /**
   * Check if a font is loaded.
   */
  hasFont(key: string): boolean {
    return this.fonts.has(key);
  }

  /**
   * Get font data by key (for use in TextStyle).
   */
  getFont(key: string): FontData {
    const entry = this.fonts.get(key);
    if (!entry) throw new Error(`[TextRenderer] Font "${key}" not loaded`);
    return entry.data;
  }

  /**
   * Unload a font and release its atlas.
   */
  unloadFont(key: string): void {
    this.fonts.delete(key);
    // Note: TextureAtlas.texture.destroy() should be called if needed
  }

  // ── Rendering ──

  /**
   * Draw text using the SpriteBatch.
   * MUST be called between spriteBatch.begin() and spriteBatch.end().
   *
   * For BMFont: renders directly via SpriteBatch (uses sprite pipeline).
   * For MSDF:  Phase 2 — will use a dedicated TextBatch.
   *
   * @param text   The string to render
   * @param x      X position (world/screen space)
   * @param y      Y position (world/screen space, top of first line)
   * @param style  Text style (must include `font` from getFont())
   */
  drawText(text: string, x: number, y: number, style: TextStyle): void {
    // Find the font entry (atlas)
    let fontEntry: FontEntry | null = null;
    for (const entry of this.fonts.values()) {
      if (entry.data === style.font) { fontEntry = entry; break; }
    }
    if (!fontEntry) throw new Error('[TextRenderer] Font in style not registered');

    const color = style.color ?? WHITE;
    const result = layoutText(text, x, y, style);

    for (const q of result.quads) {
      // Set up the temp region to avoid allocating per-glyph
      _tmpRegion.u0 = q.u0;
      _tmpRegion.v0 = q.v0;
      _tmpRegion.u1 = q.u1;
      _tmpRegion.v1 = q.v1;
      _tmpRegion.pixelWidth = q.w;
      _tmpRegion.pixelHeight = q.h;

      // drawQuad expects center position, but our quads have top-left origin
      this.spriteBatch.drawQuad(
        q.x + q.w * 0.5,
        q.y + q.h * 0.5,
        q.w,
        q.h,
        0, // no rotation for text
        _tmpRegion,
        fontEntry.atlas,
        color,
      );
    }
  }

  // ── Measurement ──

  /**
   * Measure the bounding box of text without rendering.
   */
  measureText(text: string, style: TextStyle): { width: number; height: number } {
    return measureText(text, style);
  }

  // ── Lifecycle ──

  destroy(): void {
    this.fonts.clear();
  }
}
