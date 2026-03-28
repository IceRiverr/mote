// ═══════════════════════════════════════════════════════════════════════════
// FontLayout — CPU text layout engine
//
// Converts a string + style into an array of positioned glyph quads.
// Supports: kerning, word wrap, multi-line, alignment, letter/line spacing.
// ═══════════════════════════════════════════════════════════════════════════

import type { FontData, GlyphData } from './FontData.js';
import type { Color } from '../Math.js';

// ── Types ────────────────────────────────────────────────────────────────

export interface TextStyle {
  font: FontData;
  fontSize: number;         // desired pixel size
  color?: Color;            // default white
  letterSpacing?: number;   // extra px between characters
  lineSpacing?: number;     // extra px between lines
  align?: 'left' | 'center' | 'right';
  maxWidth?: number;        // auto word-wrap width in px (0 = no wrap)
}

export interface GlyphQuad {
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
}

// ── Layout ───────────────────────────────────────────────────────────────

const DEFAULT_COLOR: Color = { r: 1, g: 1, b: 1, a: 1 } as Color;

/**
 * Layout text into positioned glyph quads.
 *
 * For BMFont: scale = fontSize / font.metrics.fontSize
 * For MSDF:  scale = fontSize / font.metrics.fontSize (emSize mapped to atlas size)
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

  const quads: GlyphQuad[] = [];

  // Track lines for alignment
  const lineStarts: number[] = [0]; // quad index where each line starts
  const lineWidths: number[] = [];

  let cursorX = 0;
  let cursorY = 0;
  let prevUnicode = -1;
  let lineMaxX = 0;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);

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

    const glyph = font.glyphs.get(code);
    if (!glyph) {
      prevUnicode = -1;
      continue;
    }

    // Kerning
    if (prevUnicode >= 0) {
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
      const qw = glyph.width * scale;
      const qh = glyph.height * scale;
      const qx = cursorX + glyph.offsetX * scale;
      const qy = cursorY + glyph.offsetY * scale;

      quads.push({
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
  if (align !== 'left' && maxWidth > 0) {
    const alignWidth = maxWidth;
    for (let lineIdx = 0; lineIdx < lineStarts.length; lineIdx++) {
      const start = lineStarts[lineIdx];
      const end = lineIdx + 1 < lineStarts.length ? lineStarts[lineIdx + 1] : quads.length;
      const lw = lineWidths[lineIdx];
      let shift = 0;
      if (align === 'center') shift = (alignWidth - lw) * 0.5;
      else if (align === 'right') shift = alignWidth - lw;
      for (let qi = start; qi < end; qi++) {
        quads[qi].x += shift;
      }
    }
  }

  // Offset all quads to world position
  for (const q of quads) {
    q.x += x;
    q.y += y;
  }

  return {
    quads,
    width: maxWidth > 0 ? maxWidth : lineMaxX,
    height: totalHeight,
  };
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
