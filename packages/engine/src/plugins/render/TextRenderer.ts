// ═══════════════════════════════════════════════════════════════════════════
// TextRenderer — High-level text rendering API
//
// BMFont rendering via SpriteBatch (zero extra shaders)
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
import type { Color } from '../../math/index.js';
import { FontData, parseBMFont, parseBMFontJson, mergeFontData, BMFontJson } from './Font.js';
import { layoutText, measureText, findMissingChars, canRender } from './Font.js';
import type { TextStyle, TextLayoutResult } from './Font.js';

// Re-export for convenience
export type { TextStyle, TextLayoutResult };
export type { BMFontJson };
export { findMissingChars, canRender, mergeFontData };

// ── Font Entry ───────────────────────────────────────────────────────────

interface FontEntry {
  data: FontData;
  atlas: TextureAtlas;
  atlases?: TextureAtlas[];  // Multi-atlas fonts (e.g., split into multiple PNGs)
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
   * Load a BMFont JSON format (.json + atlas PNG).
   * This is the format exported by tools like snowb.org.
   *
   * @param key       Unique font identifier
   * @param atlasUrl  URL to the font atlas PNG
   * @param jsonUrl   URL to the .json descriptor file
   */
  async loadBitmapFontJson(key: string, atlasUrl: string, jsonUrl: string): Promise<void> {
    if (this.fonts.has(key)) return;

    // Load JSON and atlas in parallel
    const [jsonData, atlas] = await Promise.all([
      fetch(jsonUrl).then(r => {
        if (!r.ok) throw new Error(`Failed to load font descriptor: ${jsonUrl} (${r.status})`);
        return r.json() as Promise<BMFontJson>;
      }),
      TextureAtlas.load(this.gfx, this.atlasLayout, atlasUrl),
    ]);

    const data = parseBMFontJson(jsonData);
    this.fonts.set(key, { data, atlas });
  }

  /**
   * Load a BMFont JSON split into multiple atlases (e.g., 3000 + 500 chars).
   * All parts will be merged into a single font entry.
   *
   * Usage for Fonsung (1-3000 + 3001-3500):
   *   await text.loadBitmapFontJsonMulti('fonsung', [
   *     { atlasUrl: '/fonts/Fonsung-16-3000.png', jsonUrl: '/fonts/Fonsung-16-3000.json' },
   *     { atlasUrl: '/fonts/Fonsung-16-3500.png', jsonUrl: '/fonts/Fonsung-16-3500.json' },
   *   ]);
   *
   * @param key   Unique font identifier
   * @param parts Array of atlas/json pairs, each will be assigned a page index
   */
  async loadBitmapFontJsonMulti(
    key: string,
    parts: Array<{ atlasUrl: string; jsonUrl: string }>,
  ): Promise<void> {
    if (this.fonts.has(key)) return;
    if (parts.length === 0) throw new Error('[TextRenderer] No font parts provided');

    // Load all atlases and JSONs in parallel, with page index
    const results = await Promise.all(
      parts.map(async ({ atlasUrl, jsonUrl }, pageIndex) => {
        const [jsonData, atlas] = await Promise.all([
          fetch(jsonUrl).then(r => {
            if (!r.ok) throw new Error(`Failed to load font descriptor: ${jsonUrl} (${r.status})`);
            return r.json() as Promise<BMFontJson>;
          }),
          TextureAtlas.load(this.gfx, this.atlasLayout, atlasUrl),
        ]);
        // Parse and assign page index to each glyph
        const data = parseBMFontJson(jsonData);
        // Override page for all glyphs to match the atlas index
        for (const glyph of data.glyphs.values()) {
          glyph.page = pageIndex;
        }
        return { data, atlas };
      }),
    );

    // Merge font data
    const mergedData = mergeFontData(results.map(r => r.data));
    const atlases = results.map(r => r.atlas);

    this.fonts.set(key, {
      data: mergedData,
      atlas: atlases[0],
      atlases,
    });
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

    // When align is center/right without a maxWidth container, treat x as the anchor point:
    //   center → x is the horizontal midpoint
    //   right  → x is the right edge
    // This matches the intuitive expectation of drawText(text, centerX, y, { align: 'center' }).
    let layoutX = x;
    const align = style.align;
    if (align && align !== 'left' && !(style.maxWidth ?? 0)) {
      const { width } = measureText(text, style);
      if (align === 'center') layoutX = Math.round(x - width * 0.5);
      else if (align === 'right') layoutX = Math.round(x - width);
    }

    const result = layoutText(text, layoutX, y, style);

    for (const q of result.quads) {
      // Set up the temp region to avoid allocating per-glyph
      _tmpRegion.u0 = q.u0;
      _tmpRegion.v0 = q.v0;
      _tmpRegion.u1 = q.u1;
      _tmpRegion.v1 = q.v1;
      _tmpRegion.pixelWidth = q.w;
      _tmpRegion.pixelHeight = q.h;

      // Select the correct atlas for this glyph (multi-atlas support)
      const glyph = fontEntry.data.glyphs.get(q.unicode);
      const page = glyph?.page ?? 0;
      const atlas = fontEntry.atlases?.[page] ?? fontEntry.atlas;

      // drawQuad expects center position, but our quads have top-left origin
      this.spriteBatch.drawQuad(
        q.x + q.w * 0.5,
        q.y + q.h * 0.5,
        q.w,
        q.h,
        0, // no rotation for text
        _tmpRegion,
        atlas,
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

  /**
   * Check which characters in the text are missing from the font.
   * Returns unique missing characters for debugging or pre-flight checks.
   */
  findMissingChars(text: string, fontKey: string): string[] {
    const font = this.getFont(fontKey);
    return findMissingChars(text, font);
  }

  /**
   * Check if the font can render all characters in the given text.
   */
  canRender(text: string, fontKey: string): boolean {
    const font = this.getFont(fontKey);
    return canRender(text, font);
  }

  // ── Lifecycle ──

  destroy(): void {
    this.fonts.clear();
  }
}
