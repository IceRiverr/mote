// ═════════════════════════════════════════════════════════════════════════════
// CollisionSystem — AABB, circle, polygon (SAT), and tile-merge utilities
// ═════════════════════════════════════════════════════════════════════════════

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AABB {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CollisionResult {
  collided: boolean;
  /** Overlap magnitude along the X axis (positive) */
  overlapX: number;
  /** Overlap magnitude along the Y axis (positive) */
  overlapY: number;
  /** Separation normal, pointing from A toward B */
  normal: { x: number; y: number };
}

// ── Reusable zero result ──────────────────────────────────────────────────────

const NO_COLLISION: Readonly<CollisionResult> = Object.freeze({
  collided: false,
  overlapX: 0,
  overlapY: 0,
  normal: Object.freeze({ x: 0, y: 0 }),
});

// ── CollisionSystem ───────────────────────────────────────────────────────────

export class CollisionSystem {

  // ── AABB vs AABB ────────────────────────────────────────────────────────

  /**
   * Test overlap of two AABBs and compute minimum separation vector.
   */
  static testAABB(a: AABB, b: AABB): CollisionResult {
    const overlapX = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const overlapY = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);

    if (overlapX <= 0 || overlapY <= 0) {
      return NO_COLLISION as CollisionResult;
    }

    // Resolve along the axis with the smaller overlap
    let nx = 0;
    let ny = 0;
    if (overlapX < overlapY) {
      nx = (a.x + a.w * 0.5) < (b.x + b.w * 0.5) ? -1 : 1;
    } else {
      ny = (a.y + a.h * 0.5) < (b.y + b.h * 0.5) ? -1 : 1;
    }

    return {
      collided: true,
      overlapX: nx !== 0 ? overlapX : 0,
      overlapY: ny !== 0 ? overlapY : 0,
      normal: { x: nx, y: ny },
    };
  }

  // ── Point vs AABB ──────────────────────────────────────────────────────

  /** Test whether a point lies inside an AABB (inclusive edges). */
  static pointInAABB(px: number, py: number, box: AABB): boolean {
    return px >= box.x && px <= box.x + box.w &&
           py >= box.y && py <= box.y + box.h;
  }

  // ── AABB vs Circle ────────────────────────────────────────────────────

  /** Test overlap of an AABB and a circle. */
  static testAABBCircle(box: AABB, cx: number, cy: number, r: number): boolean {
    const closestX = Math.max(box.x, Math.min(cx, box.x + box.w));
    const closestY = Math.max(box.y, Math.min(cy, box.y + box.h));
    const dx = cx - closestX;
    const dy = cy - closestY;
    return (dx * dx + dy * dy) <= (r * r);
  }

  // ── Circle vs Circle ──────────────────────────────────────────────────

  /** Test overlap of two circles. */
  static testCircles(
    ax: number, ay: number, ar: number,
    bx: number, by: number, br: number,
  ): CollisionResult {
    const dx = bx - ax;
    const dy = by - ay;
    const distSq = dx * dx + dy * dy;
    const radSum = ar + br;

    if (distSq > radSum * radSum) {
      return NO_COLLISION as CollisionResult;
    }

    const dist = Math.sqrt(distSq);
    if (dist === 0) {
      // Circles are concentric; pick an arbitrary normal
      return {
        collided: true,
        overlapX: radSum,
        overlapY: 0,
        normal: { x: 1, y: 0 },
      };
    }

    const overlap = radSum - dist;
    const nx = dx / dist;
    const ny = dy / dist;

    return {
      collided: true,
      overlapX: overlap * Math.abs(nx),
      overlapY: overlap * Math.abs(ny),
      normal: { x: nx, y: ny },
    };
  }

  // ── SAT: Polygon vs Polygon ───────────────────────────────────────────

  /**
   * Separating Axis Theorem collision test for two convex polygons.
   * Vertices are [x, y] pairs in clockwise or counter-clockwise order.
   */
  static testPolygons(
    polyA: [number, number][],
    polyB: [number, number][],
  ): CollisionResult {
    let minOverlap = Infinity;
    let minAxisX = 0;
    let minAxisY = 0;

    // Test all edge normals from both polygons
    if (!CollisionSystem._testAxes(polyA, polyB, (ox, oy, overlap) => {
      if (overlap < minOverlap) {
        minOverlap = overlap;
        minAxisX = ox;
        minAxisY = oy;
      }
    })) {
      return NO_COLLISION as CollisionResult;
    }

    if (!CollisionSystem._testAxes(polyB, polyA, (ox, oy, overlap) => {
      if (overlap < minOverlap) {
        minOverlap = overlap;
        minAxisX = ox;
        minAxisY = oy;
      }
    })) {
      return NO_COLLISION as CollisionResult;
    }

    // Ensure the normal points from A's centroid toward B's centroid
    const centAX = polyA.reduce((s, p) => s + p[0], 0) / polyA.length;
    const centAY = polyA.reduce((s, p) => s + p[1], 0) / polyA.length;
    const centBX = polyB.reduce((s, p) => s + p[0], 0) / polyB.length;
    const centBY = polyB.reduce((s, p) => s + p[1], 0) / polyB.length;

    const dot = (centBX - centAX) * minAxisX + (centBY - centAY) * minAxisY;
    if (dot < 0) {
      minAxisX = -minAxisX;
      minAxisY = -minAxisY;
    }

    return {
      collided: true,
      overlapX: minOverlap * Math.abs(minAxisX),
      overlapY: minOverlap * Math.abs(minAxisY),
      normal: { x: minAxisX, y: minAxisY },
    };
  }

  /**
   * Test all edge-normal axes of `source` against both polygons.
   * Calls `onAxis` for each non-separating axis.
   * Returns false immediately if a separating axis is found.
   */
  private static _testAxes(
    source: [number, number][],
    other: [number, number][],
    onAxis: (nx: number, ny: number, overlap: number) => void,
  ): boolean {
    const len = source.length;
    for (let i = 0; i < len; i++) {
      const j = (i + 1) % len;
      const edgeX = source[j][0] - source[i][0];
      const edgeY = source[j][1] - source[i][1];

      // Perpendicular (normal) of the edge
      const mag = Math.sqrt(edgeX * edgeX + edgeY * edgeY);
      if (mag === 0) continue;

      const nx = -edgeY / mag;
      const ny = edgeX / mag;

      // Project both polygons onto this axis
      const projA = CollisionSystem._project(source, nx, ny);
      const projB = CollisionSystem._project(other, nx, ny);

      const overlap = Math.min(projA.max, projB.max) - Math.max(projA.min, projB.min);
      if (overlap <= 0) {
        return false; // separating axis found — no collision
      }

      onAxis(nx, ny, overlap);
    }
    return true;
  }

  /** Project all vertices of a polygon onto a 1D axis and return min/max. */
  private static _project(
    poly: [number, number][],
    axisX: number,
    axisY: number,
  ): { min: number; max: number } {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < poly.length; i++) {
      const d = poly[i][0] * axisX + poly[i][1] * axisY;
      if (d < min) min = d;
      if (d > max) max = d;
    }
    return { min, max };
  }

  // ── AABB to polygon helper ────────────────────────────────────────────

  /** Convert an AABB to a polygon (4 vertices, clockwise). */
  static aabbToPolygon(box: AABB): [number, number][] {
    return [
      [box.x, box.y],
      [box.x + box.w, box.y],
      [box.x + box.w, box.y + box.h],
      [box.x, box.y + box.h],
    ];
  }

  // ── Tile collider merging ─────────────────────────────────────────────

  /**
   * Merge adjacent collidable tiles into larger AABB rectangles.
   * This is a greedy row-first rectangle packing optimisation for
   * tile-based collision.
   *
   * @param tileData    - flat array of frame IDs (row-major)
   * @param width       - map width in tiles (columns)
   * @param height      - map height in tiles (rows)
   * @param tileW       - single tile width in pixels
   * @param tileH       - single tile height in pixels
   * @param hasCollider - predicate: does this frame ID have a collider?
   * @returns array of merged AABBs in world (pixel) coordinates
   */
  static mergeTileColliders(
    tileData: string[],
    width: number,
    height: number,
    tileW: number,
    tileH: number,
    hasCollider: (frameId: string) => boolean,
  ): AABB[] {
    const visited = new Uint8Array(width * height);
    const result: AABB[] = [];

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = y * width + x;
        if (visited[idx]) continue;

        const frameId = tileData[idx];
        if (!frameId || !hasCollider(frameId)) continue;

        // ── Greedy expand width ──
        let rw = 1;
        while (x + rw < width) {
          const nIdx = y * width + (x + rw);
          const nFrame = tileData[nIdx];
          if (visited[nIdx] || !nFrame || !hasCollider(nFrame)) break;
          rw++;
        }

        // ── Greedy expand height ──
        let rh = 1;
        expandHeight:
        while (y + rh < height) {
          for (let dx = 0; dx < rw; dx++) {
            const nIdx = (y + rh) * width + (x + dx);
            const nFrame = tileData[nIdx];
            if (visited[nIdx] || !nFrame || !hasCollider(nFrame)) {
              break expandHeight;
            }
          }
          rh++;
        }

        // ── Mark visited ──
        for (let dy = 0; dy < rh; dy++) {
          for (let dx = 0; dx < rw; dx++) {
            visited[(y + dy) * width + (x + dx)] = 1;
          }
        }

        result.push({
          x: x * tileW,
          y: y * tileH,
          w: rw * tileW,
          h: rh * tileH,
        });
      }
    }

    return result;
  }

  // ── Broad-phase: sweep check ──────────────────────────────────────────

  /**
   * Simple O(n^2) broad-phase that returns all overlapping AABB pairs.
   * Suitable for small entity counts. For large counts, plug in a
   * spatial hash or grid.
   */
  static broadPhase(boxes: { id: string; aabb: AABB }[]): [string, string][] {
    const pairs: [string, string][] = [];
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i].aabb;
        const b = boxes[j].aabb;
        if (
          a.x < b.x + b.w && a.x + a.w > b.x &&
          a.y < b.y + b.h && a.y + a.h > b.y
        ) {
          pairs.push([boxes[i].id, boxes[j].id]);
        }
      }
    }
    return pairs;
  }
}
