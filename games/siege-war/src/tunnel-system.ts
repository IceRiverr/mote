// ---------------------------------------------------------------------------
// src/tunnel-system.ts — Full tunnel system for underground warfare
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TunnelTile {
  col: number;
  row: number;
  dug: boolean;
  type: 'soil' | 'hard' | 'rock' | 'foundation';
  hasSupport: boolean;
  flooded: boolean;
  smoky: boolean;
}

export interface TunnelRoute {
  id: string;
  side: 'attacker' | 'defender';
  purpose: 'penetrate' | 'collapse' | 'recon';
  path: TunnelTile[];
  headCol: number;
  headRow: number;
  progress: number;
  engineerCount: number;
  hasVent: boolean;
  detected: boolean;
  completed: boolean;
  abandoned: boolean;
  /** Index signature for internal runtime properties. */
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DIG_RATE_SOIL = 1 / 10;
const DIG_RATE_HARD = 1 / 15;
const DIG_RATE_FOUNDATION = 1 / 40;
const MAX_UNVENTED_LENGTH = 8;
const COLLAPSE_CHANCE_PER_SEC = 0.02;
const TILE_PX = 32;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let _nextRouteId = 0;
function generateRouteId(): string {
  return `route_${++_nextRouteId}`;
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

// ---------------------------------------------------------------------------
// TunnelSystem
// ---------------------------------------------------------------------------

export class TunnelSystem {
  routes: Map<string, TunnelRoute> = new Map();
  undergroundGrid: TunnelTile[][] = [];

  private gridWidth = 0;
  private gridHeight = 0;
  private foundationCols: Set<number> = new Set();

  onTunnelComplete: ((route: TunnelRoute) => void) | null = null;
  onEncounter: ((attackerRouteId: string, defenderRouteId: string) => void) | null = null;

  // -----------------------------------------------------------------------
  // Initialisation
  // -----------------------------------------------------------------------

  initGrid(width: number, height: number, wallFoundationCols: number[]): void {
    this.gridWidth = width;
    this.gridHeight = height;
    this.foundationCols = new Set(wallFoundationCols);
    this.undergroundGrid = [];

    for (let row = 0; row < height; row++) {
      const rowArr: TunnelTile[] = [];
      for (let col = 0; col < width; col++) {
        let type: TunnelTile['type'] = 'soil';

        if (this.foundationCols.has(col)) {
          type = 'foundation';
        } else if (this.isRockPosition(col, row, height)) {
          type = 'rock';
        } else if (((col * 7919) ^ (row * 6271)) % 100 < 15) {
          type = 'hard';
        }

        rowArr.push({
          col,
          row,
          dug: false,
          type,
          hasSupport: false,
          flooded: false,
          smoky: false,
        });
      }
      this.undergroundGrid.push(rowArr);
    }
  }

  private isRockPosition(col: number, row: number, height: number): boolean {
    if (row >= height - 2) return true;
    const hash = ((col * 7919) ^ (row * 104729)) & 0xffff;
    return hash < 0xffff * 0.05;
  }

  // -----------------------------------------------------------------------
  // Digging lifecycle
  // -----------------------------------------------------------------------

  startDigging(
    side: 'attacker' | 'defender',
    purpose: 'penetrate' | 'collapse' | 'recon',
    entranceCol: number,
    entranceRow: number,
    targetCol: number,
    targetRow: number,
  ): TunnelRoute | null {
    if (!this.isDiggable(entranceCol, entranceRow)) return null;

    const id = generateRouteId();
    const plannedPath = this.planPath(entranceCol, entranceRow, targetCol, targetRow);

    const route: TunnelRoute = {
      id,
      side,
      purpose,
      path: [],
      headCol: entranceCol,
      headRow: entranceRow,
      progress: 0,
      engineerCount: 1,
      hasVent: false,
      detected: false,
      completed: false,
      abandoned: false,
    };

    (route as Record<string, unknown>)['_plan'] = plannedPath;
    (route as Record<string, unknown>)['_planIdx'] = 0;
    (route as Record<string, unknown>)['_tileProg'] = 0;

    this.digTile(entranceCol, entranceRow);
    const entranceTile = this.getTile(entranceCol, entranceRow);
    if (entranceTile) {
      route.path.push(entranceTile);
      route.progress = 1;
    }

    this.routes.set(id, route);
    return route;
  }

  // -----------------------------------------------------------------------
  // Per-frame update
  // -----------------------------------------------------------------------

  update(dt: number): void {
    for (const route of this.routes.values()) {
      if (route.completed || route.abandoned) continue;

      const plan = (route as Record<string, unknown>)['_plan'] as
        Array<{ col: number; row: number }> | undefined;
      let planIdx = ((route as Record<string, unknown>)['_planIdx'] as number) ?? 0;

      if (!plan || planIdx >= plan.length) {
        this.completeRoute(route);
        continue;
      }

      const nextWP = plan[planIdx];
      const nextTile = this.getTile(nextWP.col, nextWP.row);
      if (!nextTile || nextTile.type === 'rock') {
        route.abandoned = true;
        continue;
      }

      // Determine dig speed
      let rate: number;
      switch (nextTile.type) {
        case 'foundation':
          rate = DIG_RATE_FOUNDATION;
          break;
        case 'hard':
          rate = DIG_RATE_HARD;
          break;
        default:
          rate = DIG_RATE_SOIL;
      }

      const engBonus = 1 + Math.min(route.engineerCount - 1, 3) * 0.3;
      const progressDelta = rate * engBonus * dt;

      let tileProg = ((route as Record<string, unknown>)['_tileProg'] as number) ?? 0;
      tileProg += progressDelta;

      if (tileProg >= 1) {
        tileProg = 0;
        this.digTile(nextWP.col, nextWP.row);
        route.path.push(nextTile);
        route.headCol = nextWP.col;
        route.headRow = nextWP.row;
        route.progress = route.path.length;
        planIdx += 1;
        (route as Record<string, unknown>)['_planIdx'] = planIdx;
      }

      (route as Record<string, unknown>)['_tileProg'] = tileProg;

      // Ventilation check
      this.checkVentilation(route);

      // Collapse risk
      if (!route.hasVent && route.path.length > MAX_UNVENTED_LENGTH) {
        if (Math.random() < COLLAPSE_CHANCE_PER_SEC * dt) {
          this.collapseTunnel(route.id);
        }
      }
    }

    this.checkEncounter();
  }

  // -----------------------------------------------------------------------
  // Active digging query (for listening pot detection)
  // -----------------------------------------------------------------------

  getActiveDigging(): Array<{ x: number; y: number; soilType: string }> {
    const result: Array<{ x: number; y: number; soilType: string }> = [];
    for (const route of this.routes.values()) {
      if (route.completed || route.abandoned) continue;

      const plan = (route as Record<string, unknown>)['_plan'] as
        Array<{ col: number; row: number }> | undefined;
      const planIdx = ((route as Record<string, unknown>)['_planIdx'] as number) ?? 0;
      if (!plan || planIdx >= plan.length) continue;

      const wp = plan[planIdx];
      const tile = this.getTile(wp.col, wp.row);
      result.push({
        x: wp.col * TILE_PX + TILE_PX / 2,
        y: wp.row * TILE_PX + TILE_PX / 2,
        soilType: tile ? tile.type : 'soil',
      });
    }
    return result;
  }

  // -----------------------------------------------------------------------
  // Encounter detection
  // -----------------------------------------------------------------------

  checkEncounter(): void {
    const attackerHeads: Map<string, TunnelRoute> = new Map();
    const defenderDugTiles: Map<string, TunnelRoute> = new Map();

    for (const route of this.routes.values()) {
      if (route.completed || route.abandoned) continue;
      const headKey = `${route.headCol},${route.headRow}`;
      if (route.side === 'attacker') {
        attackerHeads.set(headKey, route);
      } else {
        // Register all defender dug tiles
        for (const tile of route.path) {
          defenderDugTiles.set(`${tile.col},${tile.row}`, route);
        }
      }
    }

    for (const [headKey, atkRoute] of attackerHeads) {
      const defRoute = defenderDugTiles.get(headKey);
      if (defRoute) {
        atkRoute.detected = true;
        defRoute.detected = true;
        this.onEncounter?.(atkRoute.id, defRoute.id);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Counter-measures
  // -----------------------------------------------------------------------

  collapseTunnel(routeId: string): void {
    const route = this.routes.get(routeId);
    if (!route) return;

    for (const tile of route.path) {
      tile.dug = false;
      tile.hasSupport = false;
    }
    route.abandoned = true;
  }

  floodTunnel(routeId: string): void {
    const route = this.routes.get(routeId);
    if (!route) return;

    for (const tile of route.path) {
      tile.flooded = true;
    }
    route.abandoned = true;
  }

  smokeTunnel(routeId: string): void {
    const route = this.routes.get(routeId);
    if (!route) return;

    for (const tile of route.path) {
      tile.smoky = true;
    }
  }

  // -----------------------------------------------------------------------
  // Completion
  // -----------------------------------------------------------------------

  completeTunnel(routeId: string): void {
    const route = this.routes.get(routeId);
    if (!route || route.completed) return;
    this.completeRoute(route);
  }

  private completeRoute(route: TunnelRoute): void {
    route.completed = true;
    this.onTunnelComplete?.(route);
  }

  // -----------------------------------------------------------------------
  // Query helpers
  // -----------------------------------------------------------------------

  getTunnelTiles(): TunnelTile[] {
    const result: TunnelTile[] = [];
    for (const row of this.undergroundGrid) {
      for (const tile of row) {
        if (tile.dug || tile.flooded || tile.smoky) {
          result.push(tile);
        }
      }
    }
    return result;
  }

  isDiggable(col: number, row: number): boolean {
    const tile = this.getTile(col, row);
    if (!tile) return false;
    if (tile.type === 'rock') return false;
    if (tile.dug) return false;
    if (tile.flooded) return false;
    return true;
  }

  // -----------------------------------------------------------------------
  // Internal helpers
  // -----------------------------------------------------------------------

  private getTile(col: number, row: number): TunnelTile | null {
    if (row < 0 || row >= this.gridHeight || col < 0 || col >= this.gridWidth) {
      return null;
    }
    return this.undergroundGrid[row][col];
  }

  private digTile(col: number, row: number): void {
    const tile = this.getTile(col, row);
    if (tile) {
      tile.dug = true;
    }
  }

  private planPath(
    startCol: number,
    startRow: number,
    endCol: number,
    endRow: number,
  ): Array<{ col: number; row: number }> {
    const path: Array<{ col: number; row: number }> = [];
    let col = startCol;
    let row = startRow;

    const colStep = endCol > startCol ? 1 : endCol < startCol ? -1 : 0;
    const totalColDist = Math.abs(endCol - startCol);
    const totalRowDist = endRow - startRow;
    const steps = Math.max(totalColDist, Math.abs(totalRowDist));

    for (let i = 1; i <= steps; i++) {
      if (col !== endCol) {
        col += colStep;
      }

      const frac = totalColDist > 0
        ? Math.abs(col - startCol) / totalColDist
        : i / Math.max(1, Math.abs(totalRowDist));
      const desiredRow = Math.round(startRow + totalRowDist * frac);
      if (row !== desiredRow) {
        row += row < desiredRow ? 1 : -1;
      }

      col = clamp(col, 0, this.gridWidth - 1);
      row = clamp(row, 0, this.gridHeight - 1);
      path.push({ col, row });

      if (col === endCol && row === endRow) break;
    }

    // Ensure final destination is reached
    while (path.length === 0 || (path[path.length - 1].col !== endCol || path[path.length - 1].row !== endRow)) {
      if (col !== endCol) col += col < endCol ? 1 : -1;
      else if (row !== endRow) row += row < endRow ? 1 : -1;
      else break;
      col = clamp(col, 0, this.gridWidth - 1);
      row = clamp(row, 0, this.gridHeight - 1);
      path.push({ col, row });
    }

    return path;
  }

  private checkVentilation(route: TunnelRoute): void {
    let tilesSinceVent = 0;
    let ventilated = true;

    for (const tile of route.path) {
      tilesSinceVent++;
      if (tile.hasSupport) {
        tilesSinceVent = 0;
      }
      if (tilesSinceVent > MAX_UNVENTED_LENGTH) {
        ventilated = false;
        break;
      }
    }

    route.hasVent = route.path.length <= MAX_UNVENTED_LENGTH || ventilated;
  }
}
