import type { Entity } from '@mote/engine';
import type { ScriptLifecycle } from '@mote/engine';
import type { RoadRashContext } from '../src/engine-context';
import { checkCrash, triggerCrash } from './combat';

/**
 * Road hazard (oil slick, pothole, debris cone, etc.).
 * On collision, deals damage and applies a speed slowdown to the rider.
 * If the rider's health drops to zero the crash handler is triggered.
 */
export default class RoadHazardScript implements ScriptLifecycle {
  private entity: Entity;
  private ctx: RoadRashContext;

  constructor(entity: Entity, engine: unknown) {
    this.entity = entity;
    this.ctx = engine as RoadRashContext;
  }

  onCollisionEnter(other: Entity): void {
    // Hazards affect both player and opponent bikes
    if (other.templateId !== 'player-bike' && other.templateId !== 'opponent-bike') return;

    // If the entity is already crashed, ignore
    if (other.getField<boolean>('crashed')) return;

    const damage = this.entity.getField<number>('damage') ?? 15;
    const slowdown = this.entity.getField<number>('slowdown') ?? 0.3;

    // Apply damage
    const currentHealth = other.getField<number>('health') ?? 100;
    const newHealth = Math.max(0, currentHealth - damage);
    other.setField('health', newHealth);

    // Apply speed reduction (percentage-based)
    const currentSpeed = other.getField<number>('currentSpeed') ?? 0;
    other.setField('currentSpeed', currentSpeed * (1 - slowdown));

    // Flash damage if player
    if (other.templateId === 'player-bike') {
      this.ctx.damageFlash();
    }

    // Check if the entity should crash (health depleted)
    if (newHealth <= 0) {
      triggerCrash(other);
    }
  }
}
