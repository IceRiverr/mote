// ═══════════════════════════════════════════════════════════════
// ColliderOverlay.ts — Pure rendering functions for collider
// shape visualization on the sprite editor canvas.
// ═══════════════════════════════════════════════════════════════

import type { ColliderShape } from '../../data/Collider';
import { shapeToPolygon } from '../../data/Collider';

const COLLIDER_FILL = 'rgba(220, 60, 60, 0.25)';
const COLLIDER_STROKE = 'rgba(220, 60, 60, 0.85)';
const ONEWAY_COLOR = 'rgba(230, 200, 50, 0.9)';
const COLLIDER_LINE_WIDTH = 1.5;

/**
 * Draw collider overlay on a single frame cell in the canvas.
 *
 * All shape coordinates are in normalized 0..1 space (relative to cell),
 * except 'full' which always covers the entire cell.
 *
 * @param ctx    Canvas 2D rendering context
 * @param shapes Array of collider shapes to draw
 * @param cellX  Screen X of cell top-left (pixels)
 * @param cellY  Screen Y of cell top-left (pixels)
 * @param cellW  Cell width in screen pixels
 * @param cellH  Cell height in screen pixels
 * @param oneWay Whether this frame is a one-way platform
 */
export function drawColliderOverlay(
  ctx: CanvasRenderingContext2D,
  shapes: ColliderShape[],
  cellX: number,
  cellY: number,
  cellW: number,
  cellH: number,
  oneWay?: boolean,
): void {
  ctx.save();

  for (const shape of shapes) {
    switch (shape.type) {
      case 'full':
        drawFullCollider(ctx, cellX, cellY, cellW, cellH);
        break;
      case 'rect':
        drawRectCollider(ctx, shape, cellX, cellY, cellW, cellH);
        break;
      case 'circle':
        drawCircleCollider(ctx, shape, cellX, cellY, cellW, cellH);
        break;
      case 'polygon':
        drawPolygonCollider(ctx, shape, cellX, cellY, cellW, cellH);
        break;
      case 'slope':
        drawSlopeCollider(ctx, shape, cellX, cellY, cellW, cellH);
        break;
    }
  }

  if (oneWay) {
    drawOneWayIndicator(ctx, cellX, cellY, cellW, cellH);
  }

  ctx.restore();
}

// ── Individual shape renderers ────────────────────────────────

function drawFullCollider(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  cw: number,
  ch: number,
): void {
  ctx.fillStyle = COLLIDER_FILL;
  ctx.fillRect(cx, cy, cw, ch);
  ctx.strokeStyle = COLLIDER_STROKE;
  ctx.lineWidth = COLLIDER_LINE_WIDTH;
  ctx.strokeRect(cx + 0.5, cy + 0.5, cw - 1, ch - 1);
}

function drawRectCollider(
  ctx: CanvasRenderingContext2D,
  shape: { type: 'rect'; x: number; y: number; w: number; h: number },
  cx: number,
  cy: number,
  cw: number,
  ch: number,
): void {
  const rx = cx + shape.x * cw;
  const ry = cy + shape.y * ch;
  const rw = shape.w * cw;
  const rh = shape.h * ch;

  ctx.fillStyle = COLLIDER_FILL;
  ctx.fillRect(rx, ry, rw, rh);
  ctx.strokeStyle = COLLIDER_STROKE;
  ctx.lineWidth = COLLIDER_LINE_WIDTH;
  ctx.strokeRect(rx + 0.5, ry + 0.5, rw - 1, rh - 1);
}

function drawCircleCollider(
  ctx: CanvasRenderingContext2D,
  shape: { type: 'circle'; cx: number; cy: number; r: number },
  cellX: number,
  cellY: number,
  cw: number,
  ch: number,
): void {
  const centerX = cellX + shape.cx * cw;
  const centerY = cellY + shape.cy * ch;
  const radiusX = shape.r * cw;
  const radiusY = shape.r * ch;

  ctx.beginPath();
  ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
  ctx.fillStyle = COLLIDER_FILL;
  ctx.fill();
  ctx.strokeStyle = COLLIDER_STROKE;
  ctx.lineWidth = COLLIDER_LINE_WIDTH;
  ctx.stroke();
}

function drawPolygonCollider(
  ctx: CanvasRenderingContext2D,
  shape: { type: 'polygon'; points: [number, number][] },
  cellX: number,
  cellY: number,
  cw: number,
  ch: number,
): void {
  if (shape.points.length < 3) return;

  ctx.beginPath();
  const [firstX, firstY] = shape.points[0];
  ctx.moveTo(cellX + firstX * cw, cellY + firstY * ch);
  for (let i = 1; i < shape.points.length; i++) {
    const [px, py] = shape.points[i];
    ctx.lineTo(cellX + px * cw, cellY + py * ch);
  }
  ctx.closePath();

  ctx.fillStyle = COLLIDER_FILL;
  ctx.fill();
  ctx.strokeStyle = COLLIDER_STROKE;
  ctx.lineWidth = COLLIDER_LINE_WIDTH;
  ctx.stroke();
}

function drawSlopeCollider(
  ctx: CanvasRenderingContext2D,
  shape: { type: 'slope'; direction: 'NE' | 'NW' | 'SE' | 'SW' },
  cellX: number,
  cellY: number,
  cw: number,
  ch: number,
): void {
  // Use shapeToPolygon to get the triangle points in pixel space (1x1 tile)
  const polyNorm = shapeToPolygon(shape, 1, 1);

  ctx.beginPath();
  const [fx, fy] = polyNorm[0];
  ctx.moveTo(cellX + fx * cw, cellY + fy * ch);
  for (let i = 1; i < polyNorm.length; i++) {
    const [px, py] = polyNorm[i];
    ctx.lineTo(cellX + px * cw, cellY + py * ch);
  }
  ctx.closePath();

  ctx.fillStyle = COLLIDER_FILL;
  ctx.fill();
  ctx.strokeStyle = COLLIDER_STROKE;
  ctx.lineWidth = COLLIDER_LINE_WIDTH;
  ctx.stroke();
}

/**
 * Draw a one-way platform indicator: a yellow dashed line
 * across the top of the cell with small downward arrows.
 */
function drawOneWayIndicator(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  cw: number,
  _ch: number,
): void {
  const y = cy + 2;

  // Dashed line across top
  ctx.strokeStyle = ONEWAY_COLOR;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(cx + 2, y);
  ctx.lineTo(cx + cw - 2, y);
  ctx.stroke();
  ctx.setLineDash([]);

  // Small downward arrows
  const arrowCount = Math.max(1, Math.floor(cw / 16));
  const spacing = cw / (arrowCount + 1);
  const arrowSize = Math.min(5, cw / 6);

  ctx.fillStyle = ONEWAY_COLOR;
  for (let i = 1; i <= arrowCount; i++) {
    const ax = cx + spacing * i;
    const ay = y + 3;
    ctx.beginPath();
    ctx.moveTo(ax, ay + arrowSize);
    ctx.lineTo(ax - arrowSize * 0.6, ay);
    ctx.lineTo(ax + arrowSize * 0.6, ay);
    ctx.closePath();
    ctx.fill();
  }
}

/**
 * Draw a small collider badge/icon in the corner of a cell
 * to indicate it has collider data (when not in collider edit mode).
 *
 * @param ctx  Canvas context
 * @param cx   Cell screen X
 * @param cy   Cell screen Y
 * @param cw   Cell width
 * @param ch   Cell height
 * @param hasOneWay Whether this is a one-way platform
 */
export function drawColliderBadge(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  cw: number,
  ch: number,
  hasOneWay?: boolean,
): void {
  // Fixed badge size (in screen pixels), clamped to reasonable range
  const badgeSize = Math.max(4, Math.min(10, Math.min(cw, ch) / 5));
  
  // Position: top-right corner with small padding
  const padding = 2;
  const bx = cx + cw - badgeSize - padding;
  const by = cy + padding;

  // Draw a small filled circle
  ctx.fillStyle = hasOneWay ? 'rgba(255, 200, 0, 0.9)' : 'rgba(255, 60, 60, 0.9)';
  ctx.beginPath();
  ctx.arc(bx + badgeSize / 2, by + badgeSize / 2, badgeSize / 2, 0, Math.PI * 2);
  ctx.fill();
  
  // Add a subtle border
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
  ctx.lineWidth = 1;
  ctx.stroke();
}
