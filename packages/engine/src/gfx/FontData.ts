// ═══════════════════════════════════════════════════════════════════════════
// FontData — Unified font data structures + parsers
//
// Supports:
//   - BMFont text format (.fnt) — AngelCode BMFont standard
//   - BMFont JSON format (.json) — AngelCode BMFont JSON export
// ═══════════════════════════════════════════════════════════════════════════

// ── Data Structures ──────────────────────────────────────────────────────

export interface GlyphData {
  unicode: number;
  advance: number;        // pixels
  // Atlas UV bounds (normalized 0..1)
  u0: number; v0: number;
  u1: number; v1: number;
  // Quad offset from cursor (pixels)
  offsetX: number;        // xoffset
  offsetY: number;        // yoffset
  width: number;          // glyph pixel width
  height: number;         // glyph pixel height
  // Multi-atlas support: which atlas page this glyph belongs to
  page?: number;
}

export interface FontMetrics {
  fontSize: number;       // base font size in pixels
  lineHeight: number;     // pixels
  base: number;           // baseline from top, pixels
}

export interface FontData {
  type: 'bitmap';
  metrics: FontMetrics;
  atlasWidth: number;
  atlasHeight: number;
  glyphs: Map<number, GlyphData>;
  kerning: Map<number, Map<number, number>>; // first → second → amount (px)
}

// ── BMFont JSON Parser (.json) ───────────────────────────────────────────

export interface BMFontJson {
  info: {
    face: string;
    size: number;
  };
  common: {
    lineHeight: number;
    base: number;
    scaleW: number;
    scaleH: number;
  };
  pages: string[];
  chars: Array<{
    id: number;
    x: number;
    y: number;
    width: number;
    height: number;
    xoffset: number;
    yoffset: number;
    xadvance: number;
    page?: number;
    chnl?: number;
  }>;
  kernings?: Array<{
    first: number;
    second: number;
    amount: number;
  }>;
}

/**
 * Parse BMFont JSON format (exported from tools like snowb.org).
 */
export function parseBMFontJson(json: BMFontJson): FontData {
  const glyphs = new Map<number, GlyphData>();
  const kerning = new Map<number, Map<number, number>>();

  const fontSize = Math.abs(json.info?.size ?? 16);
  const lineHeight = json.common?.lineHeight ?? fontSize;
  const base = json.common?.base ?? fontSize;
  const scaleW = json.common?.scaleW ?? 1;
  const scaleH = json.common?.scaleH ?? 1;

  // Parse chars
  for (const char of json.chars ?? []) {
    const x = char.x ?? 0;
    const y = char.y ?? 0;
    const w = char.width ?? 0;
    const h = char.height ?? 0;

    glyphs.set(char.id, {
      unicode: char.id,
      advance: char.xadvance ?? 0,
      u0: x / scaleW,
      v0: y / scaleH,
      u1: (x + w) / scaleW,
      v1: (y + h) / scaleH,
      offsetX: char.xoffset ?? 0,
      offsetY: char.yoffset ?? 0,
      width: w,
      height: h,
      page: char.page ?? 0,
    });
  }

  // Parse kernings
  for (const kern of json.kernings ?? []) {
    const first = kern.first;
    const second = kern.second;
    const amount = kern.amount ?? 0;
    
    let map = kerning.get(first);
    if (!map) {
      map = new Map();
      kerning.set(first, map);
    }
    map.set(second, amount);
  }

  return {
    type: 'bitmap',
    metrics: { fontSize, lineHeight, base },
    atlasWidth: scaleW,
    atlasHeight: scaleH,
    glyphs,
    kerning,
  };
}

// ── BMFont Text Parser (.fnt) ────────────────────────────────────────────

/**
 * Parse AngelCode BMFont text format (.fnt).
 *
 * Expected format:
 *   info face="FontName" size=16 ...
 *   common lineHeight=18 base=14 scaleW=256 scaleH=256 pages=1
 *   page id=0 file="font.png"
 *   chars count=95
 *   char id=65 x=0 y=0 width=8 height=14 xoffset=0 yoffset=2 xadvance=9 page=0 chnl=15
 *   kerning first=65 second=86 amount=-1
 */
export function parseBMFont(fntText: string): FontData {
  const glyphs = new Map<number, GlyphData>();
  const kerning = new Map<number, Map<number, number>>();

  let fontSize = 16;
  let lineHeight = 0;
  let base = 0;
  let scaleW = 1;
  let scaleH = 1;

  const lines = fntText.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const tag = trimmed.split(/\s+/)[0];

    switch (tag) {
      case 'info': {
        const sizeMatch = trimmed.match(/size=(-?\d+)/);
        if (sizeMatch) fontSize = Math.abs(parseInt(sizeMatch[1], 10));
        break;
      }

      case 'common': {
        const vals = parseKeyValues(trimmed);
        lineHeight = vals['lineHeight'] ?? 0;
        base = vals['base'] ?? 0;
        scaleW = vals['scaleW'] ?? 1;
        scaleH = vals['scaleH'] ?? 1;
        break;
      }

      case 'char': {
        const v = parseKeyValues(trimmed);
        const id = v['id'];
        if (id === undefined) break;

        const x = v['x'] ?? 0;
        const y = v['y'] ?? 0;
        const w = v['width'] ?? 0;
        const h = v['height'] ?? 0;

        glyphs.set(id, {
          unicode: id,
          advance: v['xadvance'] ?? 0,
          u0: x / scaleW,
          v0: y / scaleH,
          u1: (x + w) / scaleW,
          v1: (y + h) / scaleH,
          offsetX: v['xoffset'] ?? 0,
          offsetY: v['yoffset'] ?? 0,
          width: w,
          height: h,
        });
        break;
      }

      case 'kerning': {
        const v = parseKeyValues(trimmed);
        const first = v['first'];
        const second = v['second'];
        const amount = v['amount'] ?? 0;
        if (first === undefined || second === undefined) break;

        let map = kerning.get(first);
        if (!map) { map = new Map(); kerning.set(first, map); }
        map.set(second, amount);
        break;
      }
    }
  }

  return {
    type: 'bitmap' as const,
    metrics: { fontSize, lineHeight, base },
    atlasWidth: scaleW,
    atlasHeight: scaleH,
    glyphs,
    kerning,
  };
}

// ── Font Merging ─────────────────────────────────────────────────────────

/**
 * Merge multiple FontData objects into a single font.
 * Useful for loading large fonts split into multiple atlases (e.g., 3000 + 500 chars).
 *
 * Note: All fonts must have the same metrics (fontSize, lineHeight, base).
 *       The first font's metrics will be used.
 *
 * @param fonts  Array of FontData to merge
 * @returns      Combined FontData
 */
export function mergeFontData(fonts: FontData[]): FontData {
  if (fonts.length === 0) {
    throw new Error('[mergeFontData] No fonts to merge');
  }
  if (fonts.length === 1) {
    return fonts[0];
  }

  const base = fonts[0];
  const glyphs = new Map(base.glyphs);
  const kerning = new Map<number, Map<number, number>>();

  // Copy base font's kerning
  for (const [first, map] of base.kerning) {
    kerning.set(first, new Map(map));
  }

  // Merge subsequent fonts
  for (let i = 1; i < fonts.length; i++) {
    const font = fonts[i];

    // Validate metrics match
    if (font.metrics.fontSize !== base.metrics.fontSize ||
        font.metrics.lineHeight !== base.metrics.lineHeight ||
        font.metrics.base !== base.metrics.base) {
      console.warn(`[mergeFontData] Font ${i} has different metrics, may cause rendering issues`);
    }

    // Merge glyphs
    for (const [code, glyph] of font.glyphs) {
      glyphs.set(code, glyph);
    }

    // Merge kerning
    for (const [first, map] of font.kerning) {
      let targetMap = kerning.get(first);
      if (!targetMap) {
        targetMap = new Map();
        kerning.set(first, targetMap);
      }
      for (const [second, amount] of map) {
        targetMap.set(second, amount);
      }
    }
  }

  return {
    type: base.type,
    metrics: base.metrics,
    atlasWidth: base.atlasWidth,
    atlasHeight: base.atlasHeight,
    glyphs,
    kerning,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────

function parseKeyValues(line: string): Record<string, number> {
  const result: Record<string, number> = {};
  // Match key=value pairs (value can be negative)
  const regex = /(\w+)=(-?\d+)/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(line)) !== null) {
    result[m[1]] = parseInt(m[2], 10);
  }
  return result;
}
