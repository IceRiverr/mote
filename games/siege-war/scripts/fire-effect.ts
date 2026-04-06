// ---------------------------------------------------------------------------
// scripts/fire-effect.ts — Fire spread & damage
// ---------------------------------------------------------------------------

import type { Entity } from '@mote/engine';
import type { ScriptLifecycle } from '@mote/engine';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FIRE_FRAME_COUNT = 8;
const FIRE_FRAME_DURATION = 0.12;  // seconds per animation frame
const FIRE_DOT_DAMAGE = 5;        // damage per second to entities in fire area
const FIRE_DOT_RADIUS = 24;       // pixels
const FIRE_SPREAD_CHANCE = 0.03;  // chance per second to spread to adjacent tile
const FIRE_SPREAD_RADIUS = 40;    // max distance for spread

// ---------------------------------------------------------------------------
// Script
// ---------------------------------------------------------------------------

export default class FireEffectScript implements ScriptLifecycle {
  private entity: Entity;
  private engine: unknown;

  private animTimer = 0;
  private animFrame = 0;

  constructor(entity: Entity, engine: unknown) {
    this.entity = entity;
    this.engine = engine;
  }

  update(dt: number): void {
    // Duration countdown
    let duration = this.entity.getField<number>('duration') ?? 8;
    duration -= dt;
    this.entity.setField('duration', duration);

    if (duration <= 0) {
      this.extinguish();
      return;
    }

    // Frame animation cycling
    this.animTimer += dt;
    if (this.animTimer >= FIRE_FRAME_DURATION) {
      this.animTimer -= FIRE_FRAME_DURATION;
      this.animFrame = (this.animFrame + 1) % FIRE_FRAME_COUNT;
      this.entity.setFrame(`fire_${this.animFrame}`);
    }

    // Apply DoT damage to entities in fire area
    this.applyDamage(dt);

    // Spread chance
    if (Math.random() < FIRE_SPREAD_CHANCE * dt) {
      this.trySpread();
    }
  }

  onDestroy(): void {
    // Cleanup handled by entity recycling
  }

  // -----------------------------------------------------------------------
  // Damage application
  // -----------------------------------------------------------------------

  private applyDamage(dt: number): void {
    const ctx = this.engine as Record<string, unknown>;
    const entityManager = ctx['entityManager'] as {
      getInRadius?: (x: number, y: number, r: number) => Entity[];
    } | undefined;
    if (!entityManager?.getInRadius) return;

    const targets = entityManager.getInRadius(this.entity.x, this.entity.y, FIRE_DOT_RADIUS);
    const dmg = FIRE_DOT_DAMAGE * dt;

    for (const target of targets) {
      if (target.id === this.entity.id) continue;
      const eType = target.getField<string>('entityType') ?? '';
      if (eType === 'fire_effect') continue; // don't damage other fires

      // Try hpCurrent first, then hp
      const hpCurrent = target.getField<number>('hpCurrent');
      if (hpCurrent !== undefined) {
        target.setField('hpCurrent', Math.max(0, hpCurrent - dmg));
      } else {
        const hp = target.getField<number>('hp');
        if (hp !== undefined) {
          target.setField('hp', Math.max(0, hp - dmg));
        }
      }
    }
  }

  // -----------------------------------------------------------------------
  // Fire spread
  // -----------------------------------------------------------------------

  private trySpread(): void {
    const ctx = this.engine as Record<string, unknown>;
    const spawner = ctx['spawner'] as {
      spawn?: (template: string, x: number, y: number, fields?: Record<string, unknown>) => Entity;
    } | undefined;
    if (!spawner?.spawn) return;

    // Pick a random adjacent direction
    const angle = Math.random() * Math.PI * 2;
    const dist = FIRE_SPREAD_RADIUS * (0.5 + Math.random() * 0.5);
    const nx = this.entity.x + Math.cos(angle) * dist;
    const ny = this.entity.y + Math.sin(angle) * dist;

    // Check if the target position is flammable (e.g., wood structure)
    // Simplified: always spawn a smaller fire at the spread location
    spawner.spawn('fire-effect', nx, ny, {
      entityType: 'fire_effect',
      duration: 5 + Math.random() * 3,
    });
  }

  // -----------------------------------------------------------------------
  // Extinguish
  // -----------------------------------------------------------------------

  private extinguish(): void {
    const ctx = this.engine as Record<string, unknown>;
    const spawner = ctx['spawner'] as { recycle?: (e: Entity) => void } | undefined;
    if (spawner?.recycle) {
      spawner.recycle(this.entity);
    } else {
      this.entity.visible = false;
    }
  }
}
