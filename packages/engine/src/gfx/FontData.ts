// ═══════════════════════════════════════════════════════════════════════════
// FontData — Unified font data structures + parsers
//
// Supports:
//   - BMFont text format (.fnt) — AngelCode BMFont standard
//   - MSDF JSON format (.json) — msdf-atlas-gen output (reserved for Phase 2)
// ═══════════════════════════════════════════════════════════════════════════

// ── Data Structures ──────────────────────────────────────────────────────

export interface GlyphData {
  unicode: number;
  advance: number;        // pixels (bitmap) or em units (msdf)
  // Atlas UV bounds (normalized 0..1)
  u0: number; v0: number;
  u1: number; v1: number;
  // Quad offset from cursor (pixels for bitmap, em for msdf)
  offsetX: number;        // xoffset
  offsetY: number;        // yoffset
  width: number;          // glyph pixel width
  height: number;         // glyph pixel height
}

export interface FontMetrics {
  fontSize: number;       // base font size in pixels
  lineHeight: number;     // pixels (bitmap) or em (msdf)
  base: number;           // baseline from top, pixels
}

export interface FontData {
  type: 'bitmap' | 'msdf';
  metrics: FontMetrics;
  atlasWidth: number;
  atlasHeight: number;
  distanceRange?: number; // MSDF only
  glyphs: Map<number, GlyphData>;
  kerning: Map<number, Map<number, number>>; // first → second → amount (px)
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
    type: 'bitmap',
    metrics: { fontSize, lineHeight, base },
    atlasWidth: scaleW,
    atlasHeight: scaleH,
    glyphs,
    kerning,
  };
}

// ── MSDF JSON Parser (reserved for Phase 2) ──────────────────────────────

export interface MSDFAtlasJson {
  atlas: {
    type: string;
    distanceRange: number;
    size: number;
    width: number;
    height: number;
    yOrigin?: string;
  };
  metrics: {
    emSize?: number;
    lineHeight: number;
    ascender: number;
    descender: number;
  };
  glyphs: Array<{
    unicode: number;
    advance: number;
    planeBounds?: { left: number; bottom: number; right: number; top: number };
    atlasBounds?: { left: number; bottom: number; right: number; top: number };
  }>;
  kerning?: Array<{
    unicode1: number;
    unicode2: number;
    advance: number;
  }>;
}

export function parseMSDFJson(json: MSDFAtlasJson): FontData {
  const glyphs = new Map<number, GlyphData>();
  const kerning = new Map<number, Map<number, number>>();

  const aw = json.atlas.width;
  const ah = json.atlas.height;
  const yTop = json.atlas.yOrigin === 'top';

  for (const g of json.glyphs) {
    if (!g.atlasBounds || !g.planeBounds) {
      // Space or other non-rendering glyphs
      glyphs.set(g.unicode, {
        unicode: g.unicode,
        advance: g.advance,
        u0: 0, v0: 0, u1: 0, v1: 0,
        offsetX: 0, offsetY: 0,
        width: 0, height: 0,
      });
      continue;
    }

    const ab = g.atlasBounds;
    const pb = g.planeBounds;

    let v0: number, v1: number;
    if (yTop) {
      // yOrigin=top: atlasBounds.bottom is lower y in image, .top is upper
      v0 = ab.top / ah;      // image top → small v
      v1 = ab.bottom / ah;   // image bottom → large v
    } else {
      // yOrigin=bottom (default): flip
      v0 = 1 - ab.top / ah;
      v1 = 1 - ab.bottom / ah;
    }

    glyphs.set(g.unicode, {
      unicode: g.unicode,
      advance: g.advance,
      u0: ab.left / aw,
      v0,
      u1: ab.right / aw,
      v1,
      offsetX: pb.left,
      offsetY: pb.bottom,
      width: pb.right - pb.left,
      height: pb.top - pb.bottom,
    });
  }

  if (json.kerning) {
    for (const k of json.kerning) {
      let map = kerning.get(k.unicode1);
      if (!map) { map = new Map(); kerning.set(k.unicode1, map); }
      map.set(k.unicode2, k.advance);
    }
  }

  return {
    type: 'msdf',
    metrics: {
      fontSize: json.atlas.size,
      lineHeight: json.metrics.lineHeight,
      base: json.metrics.ascender,
    },
    atlasWidth: aw,
    atlasHeight: ah,
    distanceRange: json.atlas.distanceRange,
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
