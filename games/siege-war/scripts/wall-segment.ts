// ---------------------------------------------------------------------------
// scripts/wall-segment.ts — Wall segment logic
// ---------------------------------------------------------------------------

import type { Entity } from '@mote/engine';
import type { ScriptLifecycle } from '@mote/engine';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DAMAGE_TIER_1 = 0.75; // above 75% = intact
const DAMAGE_TIER_2 = 0.50; // above 50% = damaged_1
const DAMAGE_TIER_3 = 0.25; // above 25% = damaged_2
// below 25% and > 0 = breached visual, at 0 = rubble

const FIRE_SPREAD_CHANCE_PER_SEC = 0.05;
const FIRE_DAMAGE_PER_SEC = 2;
const REPAIR_RATE = 5; // HP per second when repair is active

// ---------------------------------------------------------------------------
// Script
// ---------------------------------------------------------------------------

export default class WallSegmentScript implements ScriptLifecycle {
  private entity: Entity;
  private engine: unknown;

  private lastHpRatio = 1;
  private fireTimer = 0;

  constructor(entity: Entity, engine: unknown) {
    this.entity = entity;
    this.engine = engine;
  }

  update(dt: number): void {
    const hp = this.entity.getField<number>('hp') ?? 0;
    const maxHp = this.entity.getField<number>('maxHp') ?? 100;
    const hpRatio = maxHp > 0 ? hp / maxHp : 0;

    // --- Damage frame switching ---
    if (hpRatio !== this.lastHpRatio) {
      this.lastHpRatio = hpRatio;
      this.updateDamageFrame(hpRatio);
    }

    // --- Breach detection ---
    if (hp <= 0 && !this.entity.getField<boolean>('breached')) {
      this.entity.setField('breached', true);
      this.entity.setFrame('wall_rubble');
      // Emit breach event
      const ctx = this.engine as Record<string, unknown>;
      const events = ctx['events'] as { emit?: (name: string, data: unknown) => void } | undefined;
      events?.emit?.('wall:breached', {
        segmentId: this.entity.getField<string>('segmentId'),
        x: this.entity.x,
        y: this.entity.y,
      });
    }

    // --- Fire damage ---
    const onFire = this.entity.getField<boolean>('onFire') ?? false;
    if (onFire) {
      this.fireTimer += dt;
      const fireDmg = FIRE_DAMAGE_PER_SEC * dt;
      this.entity.setField('hp', Math.max(0, hp - fireDmg));

      // Fire spreading to adjacent segments
      if (Math.random() < FIRE_SPREAD_CHANCE_PER_SEC * dt) {
        this.spreadFire();
      }
    }

    // --- Repair ---
    const repairing = this.entity.getField<boolean>('repairActive') ?? false;
    if (repairing && hp > 0 && hp < maxHp) {
      const newHp = Math.min(maxHp, hp + REPAIR_RATE * dt);
      this.entity.setField('hp', newHp);
    }

    // --- Garrison management ---
    this.updateGarrison();
  }

  onCollisionEnter(other: Entity): void {
    const otherType = other.getField<string>('entityType') ?? '';
    if (otherType === 'projectile') {
      const dmg = other.getField<number>('damage') ?? 10;
      const hp = this.entity.getField<number>('hp') ?? 0;
      this.entity.setField('hp', Math.max(0, hp - dmg));
    } else if (otherType === 'siege_ladder') {
      const count = this.entity.getField<number>('ladderCount') ?? 0;
      this.entity.setField('ladderCount', count + 1);
    }
  }

  // -----------------------------------------------------------------------
  // Damage frame
  // -----------------------------------------------------------------------

  private updateDamageFrame(hpRatio: number): void {
    if (hpRatio <= 0) {
      this.entity.setFrame('wall_rubble');
    } else if (hpRatio <= DAMAGE_TIER_3) {
      this.entity.setFrame('wall_breached');
    } else if (hpRatio <= DAMAGE_TIER_2) {
      this.entity.setFrame('wall_damaged_2');
    } else if (hpRatio <= DAMAGE_TIER_1) {
      this.entity.setFrame('wall_damaged_1');
    } else {
      this.entity.setFrame('wall_intact');
    }
  }

  // -----------------------------------------------------------------------
  // Fire spread
  // -----------------------------------------------------------------------

  private spreadFire(): void {
    const ctx = this.engine as Record<string, unknown>;
    const wallSegments = ctx['wallSegments'] as Entity[] | undefined;
    if (!wallSegments) return;

    for (const seg of wallSegments) {
      if (seg.id === this.entity.id) continue;
      if (seg.getField<boolean>('onFire')) continue;

      const dx = Math.abs(seg.x - this.entity.x);
      if (dx <= 48) { // adjacent segment
        seg.setField('onFire', true);
        break; // spread to one neighbour at a time
      }
    }
  }

  // -----------------------------------------------------------------------
  // Garrison helpers
  // -----------------------------------------------------------------------

  private updateGarrison(): void {
    const garrisonStr = this.entity.getField<string>('garrisonIds') ?? '[]';
    let garrisonIds: string[];
    try {
      garrisonIds = JSON.parse(garrisonStr);
    } catch {
      garrisonIds = [];
    }

    // Remove dead soldiers from garrison list
    const ctx = this.engine as Record<string, unknown>;
    const entityManager = ctx['entityManager'] as {
      getById?: (id: string) => Entity | null;
    } | undefined;
    if (!entityManager || !entityManager.getById) return;

    const alive = garrisonIds.filter(id => {
      const e = entityManager.getById!(id);
      if (!e) return false;
      const hp = e.getField<number>('hpCurrent') ?? 0;
      return hp > 0;
    });

    if (alive.length !== garrisonIds.length) {
      this.entity.setField('garrisonIds', JSON.stringify(alive));
    }
  }
}
