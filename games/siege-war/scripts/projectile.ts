// ---------------------------------------------------------------------------
// scripts/projectile.ts — Projectile trajectory
// ---------------------------------------------------------------------------

import type { Entity } from '@mote/engine';
import type { ScriptLifecycle } from '@mote/engine';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GRAVITY = 400;           // px/s^2
const BASE_FLIGHT_SPEED = 200; // px/s horizontal reference
const GROUND_Y_DEFAULT = 600;  // fallback ground level

// ---------------------------------------------------------------------------
// Script
// ---------------------------------------------------------------------------

export default class ProjectileScript implements ScriptLifecycle {
  private entity: Entity;
  private engine: unknown;

  private vx = 0;
  private vy = 0;
  private initialised = false;

  constructor(entity: Entity, engine: unknown) {
    this.entity = entity;
    this.engine = engine;
  }

  update(dt: number): void {
    if (!this.initialised) {
      this.initTrajectory();
      this.initialised = true;
    }

    // Advance position
    this.entity.x += this.vx * dt;
    this.vy += GRAVITY * dt;
    this.entity.y += this.vy * dt;

    // Rotation follows velocity vector
    const angle = Math.atan2(this.vy, this.vx);
    this.entity.setField('rotation', angle);

    // Ground collision check
    const groundY = this.getGroundY();
    if (this.entity.y >= groundY) {
      this.entity.y = groundY;
      this.onImpact();
    }

    // Off-screen cleanup
    if (this.entity.x < -200 || this.entity.x > 4200 || this.entity.y > groundY + 100) {
      this.recycle();
    }
  }

  onCollisionEnter(other: Entity): void {
    const otherType = other.getField<string>('entityType') ?? '';
    if (otherType === 'wall_segment' || otherType === 'soldier' || otherType === 'siege_engine') {
      this.onImpact();
    }
  }

  // -----------------------------------------------------------------------
  // Trajectory initialisation
  // -----------------------------------------------------------------------

  private initTrajectory(): void {
    const targetX = this.entity.getField<number>('targetX') ?? this.entity.x;
    const targetY = this.entity.getField<number>('targetY') ?? this.entity.y;
    const startX = this.entity.x;
    const startY = this.entity.y;

    const dx = targetX - startX;
    const dy = targetY - startY;

    // Compute flight time from horizontal distance
    const t = Math.max(0.3, Math.abs(dx) / BASE_FLIGHT_SPEED);

    this.vx = dx / t;
    this.vy = (dy - 0.5 * GRAVITY * t * t) / t;
  }

  // -----------------------------------------------------------------------
  // Impact
  // -----------------------------------------------------------------------

  private onImpact(): void {
    const damage = this.entity.getField<number>('damage') ?? 10;
    const aoeRadius = this.entity.getField<number>('aoeRadius') ?? 32;
    const projType = this.entity.getField<string>('projectileType') ?? 'stone';

    const ctx = this.engine as Record<string, unknown>;

    // AOE damage
    const entityManager = ctx['entityManager'] as {
      getInRadius?: (x: number, y: number, r: number) => Entity[];
    } | undefined;

    if (entityManager?.getInRadius) {
      const targets = entityManager.getInRadius(this.entity.x, this.entity.y, aoeRadius);
      for (const target of targets) {
        const dx = target.x - this.entity.x;
        const dy = target.y - this.entity.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const falloff = Math.max(0, 1 - dist / aoeRadius);
        const actualDmg = Math.round(damage * falloff);

        const tHp = target.getField<number>('hpCurrent') ?? target.getField<number>('hp') ?? 0;
        const hpField = target.getField<number>('hpCurrent') !== undefined ? 'hpCurrent' : 'hp';
        target.setField(hpField, Math.max(0, tHp - actualDmg));
      }
    }

    // Spawn fire if fire projectile
    if (projType === 'fire' || projType === 'fire_arrow') {
      const spawner = ctx['spawner'] as {
        spawn?: (template: string, x: number, y: number, fields?: Record<string, unknown>) => Entity;
      } | undefined;
      spawner?.spawn?.('fire-effect', this.entity.x, this.entity.y, {
        entityType: 'fire_effect',
        duration: 8,
      });
    }

    // Camera shake
    const camera = ctx['camera'] as { shakeOnImpact?: (v: number) => void } | undefined;
    camera?.shakeOnImpact?.(damage / 50);

    this.recycle();
  }

  // -----------------------------------------------------------------------
  // Helpers
  // -----------------------------------------------------------------------

  private getGroundY(): number {
    const ctx = this.engine as Record<string, unknown>;
    const getGround = ctx['getGroundY'] as ((x: number) => number) | undefined;
    if (getGround) return getGround(this.entity.x);
    return GROUND_Y_DEFAULT;
  }

  private recycle(): void {
    const ctx = this.engine as Record<string, unknown>;
    const spawner = ctx['spawner'] as { recycle?: (e: Entity) => void } | undefined;
    if (spawner?.recycle) {
      spawner.recycle(this.entity);
    } else {
      this.entity.visible = false;
    }
  }
}
