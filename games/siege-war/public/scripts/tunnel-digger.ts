// ---------------------------------------------------------------------------
// scripts/tunnel-digger.ts — Tunnel engineer behavior
// ---------------------------------------------------------------------------

import type { Entity } from '@mote/engine';
import type { ScriptLifecycle } from '@mote/engine';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SUPPORT_INTERVAL = 4;      // place support every N tiles
const VENT_INTERVAL = 7;         // place vent shaft every N tiles
const RETREAT_SPEED = 50;        // px/s
const WOOD_PER_SUPPORT = 10;     // resource cost
const TILE_PX = 32;
const SMOKE_DAMAGE_PER_SEC = 8;
const FLOOD_DAMAGE_PER_SEC = 25;

type DiggerState = 'idle' | 'digging' | 'placing_support' | 'retreating' | 'done';

// ---------------------------------------------------------------------------
// Script
// ---------------------------------------------------------------------------

export default class TunnelDiggerScript implements ScriptLifecycle {
  private entity: Entity;
  private engine: unknown;

  private supportCounter = 0;
  private ventCounter = 0;
  private state: DiggerState = 'idle';

  constructor(entity: Entity, engine: unknown) {
    this.entity = entity;
    this.engine = engine;
  }

  update(dt: number): void {
    const hp = this.entity.getField<number>('hpCurrent') ?? 0;
    if (hp <= 0) {
      this.entity.setField('state', 'dead');
      this.entity.setFrame('tunnel_specialist_idle');
      return;
    }

    const routeId = this.entity.getField<string>('routeId') ?? '';
    if (!routeId) {
      this.entity.setFrame('tunnel_specialist_idle');
      return;
    }

    const ctx = this.engine as Record<string, unknown>;
    const tunnelSystem = ctx['tunnelSystem'] as {
      routes: Map<string, {
        completed: boolean;
        abandoned: boolean;
        headCol: number;
        headRow: number;
        path: Array<{ smoky: boolean; flooded: boolean; hasSupport: boolean }>;
        progress: number;
        hasVent: boolean;
      }>;
    } | undefined;

    if (!tunnelSystem) return;
    const route = tunnelSystem.routes.get(routeId);
    if (!route) return;

    // Check for hazards — retreat if flooded or smoked
    const lastTile = route.path[route.path.length - 1];
    if (lastTile?.flooded) {
      this.takeDamage(FLOOD_DAMAGE_PER_SEC * dt);
      this.retreat(dt);
      return;
    }
    if (lastTile?.smoky) {
      this.takeDamage(SMOKE_DAMAGE_PER_SEC * dt);
      this.retreat(dt);
      return;
    }

    if (route.completed || route.abandoned) {
      this.state = 'done';
      this.entity.setFrame('tunnel_specialist_idle');
      return;
    }

    // Track engineer position at tunnel head
    this.entity.x = route.headCol * TILE_PX + TILE_PX / 2;
    this.entity.y = route.headRow * TILE_PX + TILE_PX / 2;

    // Digging is handled by TunnelSystem.update — this script manages
    // support pillar and vent shaft placement.
    this.state = 'digging';
    this.entity.setFrame('tunnel_specialist_dig');

    // Place support pillar at intervals
    const currentProgress = route.progress;
    if (currentProgress > 0 && currentProgress % SUPPORT_INTERVAL === 0) {
      if (!lastTile?.hasSupport) {
        this.placeSupport(route, lastTile);
      }
    }

    // Place vent shaft at intervals
    if (currentProgress > 0 && currentProgress % VENT_INTERVAL === 0) {
      if (!route.hasVent || this.ventCounter < Math.floor(currentProgress / VENT_INTERVAL)) {
        this.placeVent(route);
      }
    }
  }

  // -----------------------------------------------------------------------
  // Support pillar placement
  // -----------------------------------------------------------------------

  private placeSupport(
    route: { path: Array<{ hasSupport: boolean }> },
    tile: { hasSupport: boolean } | undefined,
  ): void {
    if (!tile) return;

    const ctx = this.engine as Record<string, unknown>;
    const resources = ctx['resourceManager'] as {
      spend?: (type: string, amount: number) => boolean;
    } | undefined;

    // Check if we have enough wood
    if (resources?.spend) {
      const success = resources.spend('wood', WOOD_PER_SUPPORT);
      if (!success) return; // Not enough wood
    }

    tile.hasSupport = true;
    this.supportCounter++;
  }

  // -----------------------------------------------------------------------
  // Vent shaft placement
  // -----------------------------------------------------------------------

  private placeVent(route: { hasVent: boolean }): void {
    route.hasVent = true;
    this.ventCounter++;
  }

  // -----------------------------------------------------------------------
  // Retreat behaviour
  // -----------------------------------------------------------------------

  private retreat(dt: number): void {
    this.state = 'retreating';
    this.entity.setFrame('tunnel_specialist_idle');

    // Move backward toward the tunnel entrance (leftward for attackers)
    const side = this.entity.getField<string>('side') ?? 'attacker';
    const dir = side === 'attacker' ? -1 : 1;
    this.entity.x += dir * RETREAT_SPEED * dt;
  }

  // -----------------------------------------------------------------------
  // Damage helper
  // -----------------------------------------------------------------------

  private takeDamage(amount: number): void {
    const hp = this.entity.getField<number>('hpCurrent') ?? 0;
    this.entity.setField('hpCurrent', Math.max(0, hp - amount));
  }
}
