// ═══════════════════════════════════════════════════════════════
// Collider.ts — Unified collision shape types
// Shared between editor and engine (via copy or shared package)
// ═══════════════════════════════════════════════════════════════

/** Individual collision shape */
export type ColliderShape =
  | { type: 'full' }
  | { type: 'rect'; x: number; y: number; w: number; h: number }
  | { type: 'circle'; cx: number; cy: number; r: number }
  | { type: 'polygon'; points: [number, number][] }
  | { type: 'slope'; direction: 'NE' | 'NW' | 'SE' | 'SW' };

/** Full collision data attached to a Frame or EntityDef */
export interface ColliderData {
  shapes: ColliderShape[];
  oneWay?: boolean;
  layer?: number;
  mask?: number;
  properties?: Record<string, unknown>;
}

// ── Slope helpers ─────────────────────────────────────────────

const SLOPE_POLYGONS: Record<string, [number, number][]> = {
  NE: [[0, 1], [1, 1], [1, 0]],
  NW: [[0, 0], [0, 1], [1, 1]],
  SE: [[0, 0], [1, 0], [1, 1]],
  SW: [[0, 0], [1, 0], [0, 1]],
};

/**
 * Expand a ColliderShape to normalized polygon points (0..1 space).
 * Useful for rendering and hit-testing.
 */
export function shapeToPolygon(
  shape: ColliderShape,
  tileW: number,
  tileH: number,
): [number, number][] {
  switch (shape.type) {
    case 'full':
      return [[0, 0], [tileW, 0], [tileW, tileH], [0, tileH]];
    case 'rect':
      return [
        [shape.x, shape.y],
        [shape.x + shape.w, shape.y],
        [shape.x + shape.w, shape.y + shape.h],
        [shape.x, shape.y + shape.h],
      ];
    case 'circle': {
      const segs = 16;
      const pts: [number, number][] = [];
      for (let i = 0; i < segs; i++) {
        const a = (i / segs) * Math.PI * 2;
        pts.push([
          shape.cx + Math.cos(a) * shape.r,
          shape.cy + Math.sin(a) * shape.r,
        ]);
      }
      return pts;
    }
    case 'polygon':
      return shape.points;
    case 'slope':
      return (SLOPE_POLYGONS[shape.direction] ?? SLOPE_POLYGONS.NE).map(
        ([x, y]) => [x * tileW, y * tileH] as [number, number],
      );
  }
}

/** Resolve the effective collider from the 3-level inheritance chain */
export function resolveCollider(
  instanceOverride?: ColliderData | null,
  defCollider?: ColliderData | null,
  frameCollider?: ColliderData,
): ColliderData | undefined {
  if (instanceOverride !== undefined && instanceOverride !== null) return instanceOverride;
  if (defCollider !== undefined && defCollider !== null) return defCollider;
  return frameCollider;
}

/** Quick presets for right-click menu */
export const COLLIDER_PRESETS: Record<string, ColliderShape[]> = {
  full:        [{ type: 'full' }],
  halfTop:     [{ type: 'rect', x: 0, y: 0, w: 1, h: 0.5 }],
  halfBottom:  [{ type: 'rect', x: 0, y: 0.5, w: 1, h: 0.5 }],
  halfLeft:    [{ type: 'rect', x: 0, y: 0, w: 0.5, h: 1 }],
  halfRight:   [{ type: 'rect', x: 0.5, y: 0, w: 0.5, h: 1 }],
  slopeNE:     [{ type: 'slope', direction: 'NE' }],
  slopeNW:     [{ type: 'slope', direction: 'NW' }],
  slopeSE:     [{ type: 'slope', direction: 'SE' }],
  slopeSW:     [{ type: 'slope', direction: 'SW' }],
};

/** Serialize ColliderData to plain JSON (strips undefined) */
export function colliderToJson(c: ColliderData): Record<string, unknown> {
  const obj: Record<string, unknown> = { shapes: c.shapes };
  if (c.oneWay) obj.oneWay = true;
  if (c.layer !== undefined) obj.layer = c.layer;
  if (c.mask !== undefined) obj.mask = c.mask;
  if (c.properties && Object.keys(c.properties).length > 0) obj.properties = c.properties;
  return obj;
}

/** Deserialize ColliderData from JSON */
export function colliderFromJson(obj: unknown): ColliderData | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  const o = obj as Record<string, unknown>;
  // Legacy boolean format
  if (typeof o === 'boolean' || (o as any) === true) {
    return { shapes: [{ type: 'full' }] };
  }
  if (Array.isArray(o)) {
    return { shapes: o as ColliderShape[] };
  }
  if (Array.isArray(o.shapes)) {
    return {
      shapes: o.shapes as ColliderShape[],
      oneWay: o.oneWay as boolean | undefined,
      layer: o.layer as number | undefined,
      mask: o.mask as number | undefined,
      properties: o.properties as Record<string, unknown> | undefined,
    };
  }
  return undefined;
}
