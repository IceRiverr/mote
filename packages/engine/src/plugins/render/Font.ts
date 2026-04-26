// ═══════════════════════════════════════════════════════════════════════════
// FontLayout — CPU text layout engine
//
// FontData — Unified font data structures + parsers
//
// Supports:
//   - BMFont text format (.fnt) — AngelCode BMFont standard
//   - BMFont JSON format (.json) — AngelCode BMFont JSON export
// 
// Converts a string + style into an array of positioned glyph quads.
// Supports: kerning, word wrap, multi-line, alignment, letter/line spacing.
// ═══════════════════════════════════════════════════════════════════════════

import type { Color } from '../../math/index.js';

// ── Types ────────────────────────────────────────────────────────────────

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

export interface TextStyle {
  font: FontData;
  fontSize: number;         // desired pixel size
  color?: Color;            // default white
  letterSpacing?: number;   // extra px between characters
  lineSpacing?: number;     // extra px between lines
  align?: 'left' | 'center' | 'right';
  maxWidth?: number;        // auto word-wrap width in px (0 = no wrap)
  /** How to handle missing glyphs: 'skip' (default), 'tofu' (□ placeholder), or 'space' (advance only) */
  missingGlyph?: 'skip' | 'tofu' | 'space';
}

export interface GlyphQuad {
  unicode: number;          // character code for atlas lookup
  // Screen-space position (top-left corner)
  x: number;
  y: number;
  // Screen-space size
  w: number;
  h: number;
  // Atlas UV
  u0: number; v0: number;
  u1: number; v1: number;
}

export interface TextLayoutResult {
  quads: GlyphQuad[];
  width: number;            // bounding box width
  height: number;           // bounding box height
  missingChars: string[];   // characters not found in font
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

// ── Layout ───────────────────────────────────────────────────────────────

/**
 * Layout text into positioned glyph quads.
 *
 * @param text    The string to layout (supports \n for newlines)
 * @param x       Origin X in screen/world pixels
 * @param y       Origin Y in screen/world pixels (top of first line)
 * @param style   Text styling options
 * @returns       Array of glyph quads + bounding box
 */
export function layoutText(
  text: string,
  x: number,
  y: number,
  style: TextStyle,
): TextLayoutResult {
  const font = style.font;
  const scale = style.fontSize / font.metrics.fontSize;
  const lineHeight = font.metrics.lineHeight * scale + (style.lineSpacing ?? 0);
  const letterSpacing = style.letterSpacing ?? 0;
  const maxWidth = style.maxWidth ?? 0;
  const missingMode = style.missingGlyph ?? 'skip';

  const quads: GlyphQuad[] = [];
  const missingChars: string[] = [];

  // Get tofu glyph for missing characters (□ or fallback space)
  const tofuGlyph = font.glyphs.get(0x25A1) // White Square □
    ?? font.glyphs.get(0x2610) // Ballot Box ☐
    ?? font.glyphs.get(32);    // Space fallback

  // Track lines for alignment
  const lineStarts: number[] = [0]; // quad index where each line starts
  const lineWidths: number[] = [];

  let cursorX = 0;
  let cursorY = 0;
  let prevUnicode = -1;
  let lineMaxX = 0;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    const char = text[i];

    // Handle newline
    if (code === 0x0A) {
      lineWidths.push(cursorX);
      lineMaxX = Math.max(lineMaxX, cursorX);
      cursorX = 0;
      cursorY += lineHeight;
      prevUnicode = -1;
      lineStarts.push(quads.length);
      continue;
    }

    // Handle carriage return (ignore)
    if (code === 0x0D) continue;

    let glyph = font.glyphs.get(code);
    let isMissing = false;

    if (!glyph) {
      missingChars.push(char);
      isMissing = true;

      if (missingMode === 'skip') {
        prevUnicode = -1;
        continue;
      } else if (missingMode === 'tofu' && tofuGlyph) {
        glyph = tofuGlyph;
      } else {
        // 'space' mode or no tofu available: just advance
        const spaceAdvance = font.glyphs.get(32)?.advance ?? style.fontSize * 0.5;
        cursorX += spaceAdvance * scale;
        prevUnicode = -1;
        continue;
      }
    }

    // Kerning (skip for tofu placeholders to avoid weird spacing)
    if (!isMissing && prevUnicode >= 0) {
      const kern = font.kerning.get(prevUnicode)?.get(code) ?? 0;
      cursorX += kern * scale;
    }

    // Word wrap: if adding this glyph exceeds maxWidth, break line
    if (maxWidth > 0 && cursorX + glyph.advance * scale > maxWidth && cursorX > 0) {
      lineWidths.push(cursorX);
      lineMaxX = Math.max(lineMaxX, cursorX);
      cursorX = 0;
      cursorY += lineHeight;
      prevUnicode = -1;
      lineStarts.push(quads.length);
    }

    // Only emit a quad if the glyph has visible pixels
    if (glyph.width > 0 && glyph.height > 0) {
      let qw = glyph.width * scale;
      let qh = glyph.height * scale;
      let qx = cursorX + glyph.offsetX * scale;
      // BMFont yoffset: offset from baseline to glyph top
      // For pixel-perfect rendering, round coordinates when scale is close to 1
      let qy = cursorY + glyph.offsetY * scale;

      // Round to nearest pixel for pixel-perfect rendering
      // This ensures 1:1 texture-to-screen pixel mapping when fontSize matches exported size
      qw = Math.round(qw);
      qh = Math.round(qh);
      qx = Math.round(qx);
      qy = Math.round(qy);

      quads.push({
        unicode: glyph.unicode,
        x: qx, y: qy,
        w: qw, h: qh,
        u0: glyph.u0, v0: glyph.v0,
        u1: glyph.u1, v1: glyph.v1,
      });
    }

    cursorX += glyph.advance * scale + letterSpacing;
    prevUnicode = code;
  }

  // Finalize last line
  lineWidths.push(cursorX);
  lineMaxX = Math.max(lineMaxX, cursorX);
  const totalHeight = cursorY + lineHeight;

  // Apply alignment
  const align = style.align ?? 'left';
  if (align !== 'left') {
    // Use maxWidth if set, otherwise use the widest line for alignment
    const alignWidth = maxWidth > 0 ? maxWidth : lineMaxX;
    for (let lineIdx = 0; lineIdx < lineStarts.length; lineIdx++) {
      const start = lineStarts[lineIdx];
      const end = lineIdx + 1 < lineStarts.length ? lineStarts[lineIdx + 1] : quads.length;
      const lw = lineWidths[lineIdx];
      let shift = 0;
      if (align === 'center') shift = Math.round((alignWidth - lw) * 0.5);
      else if (align === 'right') shift = Math.round(alignWidth - lw);
      for (let qi = start; qi < end; qi++) {
        quads[qi].x += shift;
      }
    }
  }

  // Offset all quads to world position
  // Round final position for pixel-perfect rendering
  const roundX = Math.round(x);
  const roundY = Math.round(y);
  for (const q of quads) {
    q.x += roundX;
    q.y += roundY;
  }

  return {
    quads,
    width: maxWidth > 0 ? maxWidth : lineMaxX,
    height: totalHeight,
    missingChars,
  };
}

// ── Missing Character Detection ──────────────────────────────────────────

/**
 * Check which characters in the text are not available in the font.
 * Useful for pre-flight checking or logging missing glyphs.
 *
 * @param text  The text to check
 * @param font  The font data
 * @returns     Array of unique missing characters
 */
export function findMissingChars(text: string, font: FontData): string[] {
  const missing = new Set<string>();
  for (const char of text) {
    const code = char.charCodeAt(0);
    // Skip control characters and whitespace
    if (code < 32 || code === 0x0A || code === 0x0D) continue;
    if (!font.glyphs.has(code)) {
      missing.add(char);
    }
  }
  return Array.from(missing);
}

/**
 * Check if a font can render all characters in the given text.
 */
export function canRender(text: string, font: FontData): boolean {
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code < 32 || code === 0x0A || code === 0x0D) continue;
    if (!font.glyphs.has(code)) return false;
  }
  return true;
}

// ── Measure ──────────────────────────────────────────────────────────────

/**
 * Measure the bounding box of text without generating quads.
 */
export function measureText(
  text: string,
  style: TextStyle,
): { width: number; height: number } {
  const font = style.font;
  const scale = style.fontSize / font.metrics.fontSize;
  const lineHeight = font.metrics.lineHeight * scale + (style.lineSpacing ?? 0);
  const letterSpacing = style.letterSpacing ?? 0;
  const maxWidth = style.maxWidth ?? 0;

  let cursorX = 0;
  let maxLineWidth = 0;
  let lines = 1;
  let prevUnicode = -1;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);

    if (code === 0x0A) {
      maxLineWidth = Math.max(maxLineWidth, cursorX);
      cursorX = 0;
      lines++;
      prevUnicode = -1;
      continue;
    }
    if (code === 0x0D) continue;

    const glyph = font.glyphs.get(code);
    if (!glyph) { prevUnicode = -1; continue; }

    if (prevUnicode >= 0) {
      cursorX += (font.kerning.get(prevUnicode)?.get(code) ?? 0) * scale;
    }

    // Word wrap check
    if (maxWidth > 0 && cursorX + glyph.advance * scale > maxWidth && cursorX > 0) {
      maxLineWidth = Math.max(maxLineWidth, cursorX);
      cursorX = 0;
      lines++;
      prevUnicode = -1;
    }

    cursorX += glyph.advance * scale + letterSpacing;
    prevUnicode = code;
  }

  maxLineWidth = Math.max(maxLineWidth, cursorX);
  return {
    width: maxWidth > 0 ? Math.min(maxLineWidth, maxWidth) : maxLineWidth,
    height: lines * lineHeight,
  };
}
