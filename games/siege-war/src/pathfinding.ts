/**
 * Pathfinding — A* pathfinding for ground, wall-top, and underground layers.
 *
 * Provides three pathfinding modes:
 *   1. findPath()            — Standard A* on a 2D tile grid (ground movement)
 *   2. findPathOnWall()      — Simplified linear path along wall-top segments
 *   3. findPathUnderground() — A* restricted to dug tunnel tiles only
 *
 * Also exports utility helpers:
 *   worldToGrid(wx, wy, tileSize) — convert world coords to grid col/row
 *   gridToWorld(col, row, tileSize) — convert grid col/row to world center
 */

// ── Types ────────────────────────────────────────────────────────────────

/** A single node in the A* search grid. */
export interface GridNode {
  col: number;
  row: number;
  walkable: boolean;
  /** Movement cost to enter this tile (default 1, higher for rough terrain). */
  cost: number;
  /** Parent node in the search path (set during A* expansion). */
  parent: GridNode | null;
  /** g-cost: accumulated cost from start. */
  g: number;
  /** f-cost: g + heuristic estimate to goal. */
  f: number;
}

/** Result of a pathfinding query. */
export interface PathResult {
  /** Sequence of world-coordinate waypoints from start to end. */
  path: Array<{ x: number; y: number }>;
  /** Total accumulated cost of the path. */
  cost: number;
  /** Whether a valid path was found. */
  found: boolean;
}

/** A wall segment descriptor used for wall-top pathfinding. */
export interface WallSegment {
  id: string;
  /** Left edge world-x of this segment. */
  startX: number;
  /** Right edge world-x of this segment. */
  endX: number;
  /** Wall-top world-y (all segments assumed same height for simplicity). */
  topY: number;
  /** Whether this segment is intact and traversable. */
  traversable: boolean;
}

/** A tile in the underground layer (dug tunnel tiles). */
export interface TunnelTile {
  col: number;
  row: number;
  dug: boolean;
}

// ── Grid / World conversion utilities ────────────────────────────────────

/** Convert world coordinates to grid column/row. */
export function worldToGrid(
  wx: number,
  wy: number,
  tileSize: number,
): { col: number; row: number } {
  return {
    col: Math.floor(wx / tileSize),
    row: Math.floor(wy / tileSize),
  };
}

/** Convert grid column/row to world-center coordinates. */
export function gridToWorld(
  col: number,
  row: number,
  tileSize: number,
): { x: number; y: number } {
  return {
    x: col * tileSize + tileSize / 2,
    y: row * tileSize + tileSize / 2,
  };
}

// ── Pathfinding class ────────────────────────────────────────────────────

export class Pathfinding {

  // ── Main A* ground pathfinding ─────────────────────────────────────

  /**
   * Find a path from (startX, startY) to (endX, endY) on a 2D tile grid
   * using A* with 4-directional movement.
   *
   * @param startX  Start world-x
   * @param startY  Start world-y
   * @param endX    Goal world-x
   * @param endY    Goal world-y
   * @param grid    2D array of walkability: grid[row][col].
   *                true = walkable, false = blocked.
   *                Can also be a GridNode[][] for weighted movement.
   * @param tileSize  Pixel size of each tile (square tiles assumed).
   */
  findPath(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
    grid: boolean[][] | GridNode[][],
    tileSize: number,
  ): PathResult {
    const start = worldToGrid(startX, startY, tileSize);
    const end = worldToGrid(endX, endY, tileSize);

    const rows = grid.length;
    if (rows === 0) return { path: [], cost: 0, found: false };
    const cols = grid[0].length;

    // Bounds check
    if (
      !this.inBounds(start.col, start.row, cols, rows) ||
      !this.inBounds(end.col, end.row, cols, rows)
    ) {
      return { path: [], cost: 0, found: false };
    }

    // Check start/end walkability
    if (
      !this.isWalkable(start.col, start.row, grid) ||
      !this.isWalkable(end.col, end.row, grid)
    ) {
      return { path: [], cost: 0, found: false };
    }

    // Build search nodes
    const nodeGrid: GridNode[][] = [];
    for (let r = 0; r < rows; r++) {
      nodeGrid[r] = [];
      for (let c = 0; c < cols; c++) {
        const cell = grid[r][c];
        const walkable =
          typeof cell === 'boolean' ? cell : (cell as GridNode).walkable;
        const cost =
          typeof cell === 'boolean' ? 1 : (cell as GridNode).cost;
        nodeGrid[r][c] = {
          col: c,
          row: r,
          walkable,
          cost,
          parent: null,
          g: Infinity,
          f: Infinity,
        };
      }
    }

    const startNode = nodeGrid[start.row][start.col];
    const endNode = nodeGrid[end.row][end.col];
    startNode.g = 0;
    startNode.f = this.heuristic(startNode, endNode);

    // Open set implemented as a simple sorted array (sufficient for
    // tile grids up to ~200x200 which covers siege maps).
    const open: GridNode[] = [startNode];
    const closedSet = new Set<string>();

    while (open.length > 0) {
      // Pick node with lowest f
      let bestIdx = 0;
      for (let i = 1; i < open.length; i++) {
        if (open[i].f < open[bestIdx].f) {
          bestIdx = i;
        }
      }
      const current = open[bestIdx];
      open.splice(bestIdx, 1);

      // Goal reached
      if (current.col === endNode.col && current.row === endNode.row) {
        const rawPath = this.reconstructPath(current);
        const worldPath = rawPath.map((n) => gridToWorld(n.col, n.row, tileSize));
        return { path: worldPath, cost: current.g, found: true };
      }

      const key = `${current.col},${current.row}`;
      if (closedSet.has(key)) continue;
      closedSet.add(key);

      // Expand 4-directional neighbors
      const neighbors = this.getNeighbors(current, nodeGrid, cols, rows);
      for (const neighbor of neighbors) {
        const nKey = `${neighbor.col},${neighbor.row}`;
        if (closedSet.has(nKey)) continue;

        const tentativeG = current.g + neighbor.cost;
        if (tentativeG < neighbor.g) {
          neighbor.parent = current;
          neighbor.g = tentativeG;
          neighbor.f = tentativeG + this.heuristic(neighbor, endNode);
          // Add to open if not already present
          if (!open.includes(neighbor)) {
            open.push(neighbor);
          }
        }
      }
    }

    // No path found
    return { path: [], cost: 0, found: false };
  }

  // ── Heuristic ─────────────────────────────────────────────────────

  /** Manhattan distance heuristic for 4-directional grid movement. */
  heuristic(a: { col: number; row: number }, b: { col: number; row: number }): number {
    return Math.abs(a.col - b.col) + Math.abs(a.row - b.row);
  }

  // ── Neighbor expansion ────────────────────────────────────────────

  /** Return walkable 4-directional neighbors of a node. */
  getNeighbors(
    node: GridNode,
    grid: GridNode[][],
    cols: number,
    rows: number,
  ): GridNode[] {
    const result: GridNode[] = [];
    const dirs = [
      { dc: 0, dr: -1 }, // up
      { dc: 0, dr: 1 },  // down
      { dc: -1, dr: 0 }, // left
      { dc: 1, dr: 0 },  // right
    ];

    for (const { dc, dr } of dirs) {
      const nc = node.col + dc;
      const nr = node.row + dr;
      if (this.inBounds(nc, nr, cols, rows) && grid[nr][nc].walkable) {
        result.push(grid[nr][nc]);
      }
    }

    return result;
  }

  // ── Path reconstruction ───────────────────────────────────────────

  /** Trace the parent chain from end node back to start. */
  reconstructPath(endNode: GridNode): GridNode[] {
    const path: GridNode[] = [];
    let current: GridNode | null = endNode;
    while (current !== null) {
      path.push(current);
      current = current.parent;
    }
    path.reverse();
    return path;
  }

  // ── Walkability checks ────────────────────────────────────────────

  /** Check if a grid cell is within bounds and walkable. */
  isWalkable(
    col: number,
    row: number,
    grid: boolean[][] | GridNode[][],
  ): boolean {
    if (row < 0 || row >= grid.length) return false;
    if (col < 0 || col >= grid[0].length) return false;
    const cell = grid[row][col];
    if (typeof cell === 'boolean') return cell;
    return (cell as GridNode).walkable;
  }

  /** Bounds check helper. */
  private inBounds(col: number, row: number, cols: number, rows: number): boolean {
    return col >= 0 && col < cols && row >= 0 && row < rows;
  }

  // ── Wall-top pathfinding ──────────────────────────────────────────

  /**
   * Simplified wall-top pathfinding: move linearly along connected wall
   * segments from startSeg to endSeg. Wall segments are assumed to form
   * a horizontal line at their topY, so movement is purely left/right.
   *
   * @param startSeg  Starting wall segment
   * @param endSeg    Target wall segment
   * @param wallSegments  All wall segments, ordered left-to-right
   * @returns PathResult with waypoints along the wall top
   */
  findPathOnWall(
    startSeg: WallSegment,
    endSeg: WallSegment,
    wallSegments: WallSegment[],
  ): PathResult {
    if (startSeg.id === endSeg.id) {
      // Already on the target segment
      const midX = (startSeg.startX + startSeg.endX) / 2;
      return {
        path: [{ x: midX, y: startSeg.topY }],
        cost: 0,
        found: true,
      };
    }

    // Find indices
    const startIdx = wallSegments.findIndex((s) => s.id === startSeg.id);
    const endIdx = wallSegments.findIndex((s) => s.id === endSeg.id);
    if (startIdx === -1 || endIdx === -1) {
      return { path: [], cost: 0, found: false };
    }

    // Determine traversal direction
    const step = startIdx < endIdx ? 1 : -1;
    const path: Array<{ x: number; y: number }> = [];
    let totalCost = 0;

    // Walk through each segment from start to end
    for (let i = startIdx; i !== endIdx + step; i += step) {
      const seg = wallSegments[i];
      if (!seg.traversable) {
        // Path blocked by a breached/destroyed segment
        return { path, cost: totalCost, found: false };
      }

      // Add the entry edge and exit edge of each segment
      if (step > 0) {
        // Moving left-to-right
        if (i === startIdx) {
          path.push({ x: seg.endX, y: seg.topY });
        } else if (i === endIdx) {
          path.push({ x: seg.startX, y: seg.topY });
          const midX = (seg.startX + seg.endX) / 2;
          path.push({ x: midX, y: seg.topY });
        } else {
          path.push({ x: seg.startX, y: seg.topY });
          path.push({ x: seg.endX, y: seg.topY });
        }
      } else {
        // Moving right-to-left
        if (i === startIdx) {
          path.push({ x: seg.startX, y: seg.topY });
        } else if (i === endIdx) {
          path.push({ x: seg.endX, y: seg.topY });
          const midX = (seg.startX + seg.endX) / 2;
          path.push({ x: midX, y: seg.topY });
        } else {
          path.push({ x: seg.endX, y: seg.topY });
          path.push({ x: seg.startX, y: seg.topY });
        }
      }

      if (i !== startIdx) {
        const prevSeg = wallSegments[i - step];
        totalCost += Math.abs(seg.startX - prevSeg.startX);
      }
    }

    return { path, cost: totalCost, found: true };
  }

  // ── Underground pathfinding ───────────────────────────────────────

  /**
   * A* pathfinding restricted to dug tunnel tiles only.
   * Only tiles marked as `dug: true` are considered walkable.
   *
   * @param start     Start world position
   * @param end       Goal world position
   * @param tunnelTiles  Flat array of all underground tiles
   * @param tileSize  Tile size in pixels
   * @param gridCols  Number of columns in the underground grid
   * @param gridRows  Number of rows in the underground grid
   */
  findPathUnderground(
    start: { x: number; y: number },
    end: { x: number; y: number },
    tunnelTiles: TunnelTile[],
    tileSize: number,
    gridCols: number,
    gridRows: number,
  ): PathResult {
    // Build a boolean grid from tunnel tiles
    const grid: boolean[][] = [];
    for (let r = 0; r < gridRows; r++) {
      grid[r] = new Array(gridCols).fill(false);
    }

    // Mark dug tiles as walkable
    for (const tile of tunnelTiles) {
      if (tile.dug && tile.row >= 0 && tile.row < gridRows && tile.col >= 0 && tile.col < gridCols) {
        grid[tile.row][tile.col] = true;
      }
    }

    // Delegate to standard A*
    return this.findPath(start.x, start.y, end.x, end.y, grid, tileSize);
  }

  // ── Path smoothing ────────────────────────────────────────────────

  /**
   * Optional path smoothing: remove redundant collinear waypoints.
   * Keeps first, last, and any point where direction changes.
   */
  smoothPath(path: Array<{ x: number; y: number }>): Array<{ x: number; y: number }> {
    if (path.length <= 2) return path;

    const smoothed: Array<{ x: number; y: number }> = [path[0]];

    for (let i = 1; i < path.length - 1; i++) {
      const prev = path[i - 1];
      const curr = path[i];
      const next = path[i + 1];

      // Check if prev -> curr -> next are collinear
      const dx1 = curr.x - prev.x;
      const dy1 = curr.y - prev.y;
      const dx2 = next.x - curr.x;
      const dy2 = next.y - curr.y;

      // Direction changed — keep this waypoint
      if (dx1 !== dx2 || dy1 !== dy2) {
        smoothed.push(curr);
      }
    }

    smoothed.push(path[path.length - 1]);
    return smoothed;
  }
}
