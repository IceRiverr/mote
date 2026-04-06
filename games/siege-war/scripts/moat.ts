// ---------------------------------------------------------------------------
// scripts/moat.ts — Moat behavior
// ---------------------------------------------------------------------------

import type { Entity } from '@mote/engine';
import type { ScriptLifecycle } from '@mote/engine';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MAX_WATER_LEVEL = 100;
const FILL_RATE = 2.0;           // fill units per second per engineer
const BRIDGE_BUILD_RATE = 1.5;   // progress units per second per engineer
const BRIDGE_COMPLETE = 100;
const OIL_BURN_DURATION = 15;    // seconds of fire when oil is ignited on moat
const OIL_DAMAGE_PER_SEC = 12;
const OIL_DAMAGE_RADIUS = 48;

type BridgeState = 'none' | 'building' | 'complete' | 'destroyed';

// ---------------------------------------------------------------------------
// Script
// ---------------------------------------------------------------------------

export default class MoatScript implements ScriptLifecycle {
  private entity: Entity;
  private engine: unknown;

  private oilBurnTimer = 0;

  constructor(entity: Entity, engine: unknown) {
    this.entity = entity;
    this.engine = engine;
  }

  update(dt: number): void {
    this.updateWaterLevel(dt);
    this.updateBridge(dt);
    this.updateOilFire(dt);
    this.updateFrame();
  }

  // -----------------------------------------------------------------------
  // Water level & fill progress
  // -----------------------------------------------------------------------

  private updateWaterLevel(dt: number): void {
    const waterLevel = this.entity.getField<number>('waterLevel') ?? MAX_WATER_LEVEL;
    const fillActive = this.entity.getField<boolean>('fillActive') ?? false;
    const engineerCount = this.entity.getField<number>('fillEngineers') ?? 0;

    if (fillActive && engineerCount > 0 && waterLevel > 0) {
      const fillAmount = FILL_RATE * engineerCount * dt;
      const newLevel = Math.max(0, waterLevel - fillAmount);
      this.entity.setField('waterLevel', newLevel);

      // Track fill progress as percentage
      const maxLevel = this.entity.getField<number>('maxWaterLevel') ?? MAX_WATER_LEVEL;
      const fillProgress = maxLevel > 0 ? ((maxLevel - newLevel) / maxLevel) * 100 : 100;
      this.entity.setField('fillProgress', fillProgress);
    }
  }

  // -----------------------------------------------------------------------
  // Bridge construction
  // -----------------------------------------------------------------------

  private updateBridge(dt: number): void {
    const bridgeState = (this.entity.getField<string>('bridgeState') ?? 'none') as BridgeState;
    if (bridgeState !== 'building') return;

    const engineerCount = this.entity.getField<number>('bridgeEngineers') ?? 0;
    if (engineerCount <= 0) return;

    let progress = this.entity.getField<number>('bridgeProgress') ?? 0;
    progress += BRIDGE_BUILD_RATE * engineerCount * dt;
    this.entity.setField('bridgeProgress', progress);

    if (progress >= BRIDGE_COMPLETE) {
      this.entity.setField('bridgeState', 'complete');
      this.entity.setField('bridgeProgress', BRIDGE_COMPLETE);

      // Emit bridge complete event
      const ctx = this.engine as Record<string, unknown>;
      const events = ctx['events'] as {
        emit?: (name: string, data: unknown) => void;
      } | undefined;
      events?.emit?.('moat:bridgeComplete', {
        moatId: this.entity.id,
        x: this.entity.x,
        y: this.entity.y,
      });
    }
  }

  // -----------------------------------------------------------------------
  // Oil ignition on moat surface
  // -----------------------------------------------------------------------

  private updateOilFire(dt: number): void {
    const oilIgnited = this.entity.getField<boolean>('oilIgnited') ?? false;
    if (!oilIgnited) return;

    this.oilBurnTimer += dt;

    // Apply damage to entities on the moat surface
    const ctx = this.engine as Record<string, unknown>;
    const entityManager = ctx['entityManager'] as {
      getInRadius?: (x: number, y: number, r: number) => Entity[];
    } | undefined;

    if (entityManager?.getInRadius) {
      const targets = entityManager.getInRadius(this.entity.x, this.entity.y, OIL_DAMAGE_RADIUS);
      const dmg = OIL_DAMAGE_PER_SEC * dt;
      for (const target of targets) {
        if (target.id === this.entity.id) continue;
        const hp = target.getField<number>('hpCurrent') ?? target.getField<number>('hp') ?? 0;
        const field = target.getField<number>('hpCurrent') !== undefined ? 'hpCurrent' : 'hp';
        target.setField(field, Math.max(0, hp - dmg));
      }
    }

    // Auto-extinguish after burn duration
    if (this.oilBurnTimer >= OIL_BURN_DURATION) {
      this.entity.setField('oilIgnited', false);
      this.oilBurnTimer = 0;
    }
  }

  // -----------------------------------------------------------------------
  // Frame updates
  // -----------------------------------------------------------------------

  private updateFrame(): void {
    const waterLevel = this.entity.getField<number>('waterLevel') ?? MAX_WATER_LEVEL;
    const bridgeState = this.entity.getField<string>('bridgeState') ?? 'none';
    const oilIgnited = this.entity.getField<boolean>('oilIgnited') ?? false;

    if (oilIgnited) {
      this.entity.setFrame('moat_fire');
    } else if (bridgeState === 'complete') {
      this.entity.setFrame('moat_bridge');
    } else if (waterLevel <= 0) {
      this.entity.setFrame('moat_filled');
    } else {
      this.entity.setFrame('moat_water');
    }
  }
}
