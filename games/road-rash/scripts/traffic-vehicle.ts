import type { Entity } from '@mote/engine';
import type { ScriptLifecycle } from '@mote/engine';
import type { RoadRashContext } from '../src/engine-context';
import { kmhToPxPerSec } from './physics';
import { triggerCrash } from './combat';

/**
 * Traffic vehicle — drives at a constant speed in one lane.
 * Moves either "up" (same direction as racers, slower) or "down" (oncoming,
 * faster relative closing speed). Acts as an obstacle for collision.
 */
export default class TrafficVehicleScript implements ScriptLifecycle {
  private entity: Entity;
  private ctx: RoadRashContext;

  constructor(entity: Entity, engine: unknown) {
    this.entity = entity;
    this.ctx = engine as RoadRashContext;
  }

  update(dt: number): void {
    const speedKmh = this.entity.getField<number>('speed') ?? 60;
    const direction = this.entity.getField<string>('direction') ?? 'up';

    const speedPx = kmhToPxPerSec(speedKmh);

    if (direction === 'up') {
      // Same direction as racers — world Y decreases going "forward"
      this.entity.y -= speedPx * dt;
    } else {
      // Oncoming traffic — world Y increases (driving toward higher rows)
      this.entity.y += speedPx * dt;
    }
  }

  /**
   * When a bike hits a traffic vehicle, the rider takes damage and slows down.
   */
  onCollisionEnter(other: Entity): void {
    if (other.templateId !== 'player-bike' && other.templateId !== 'opponent-bike') return;
    if (other.getField<boolean>('crashed')) return;

    // Collision damage proportional to speed difference
    const riderSpeed = other.getField<number>('currentSpeed') ?? 0;
    const trafficSpeed = this.entity.getField<number>('speed') ?? 60;
    const direction = this.entity.getField<string>('direction') ?? 'up';

    // Relative speed: oncoming = additive, same direction = subtractive
    const relativeSpeed = direction === 'up'
      ? Math.max(0, riderSpeed - trafficSpeed)
      : riderSpeed + trafficSpeed;

    // Damage scales with relative speed: 5 base + 0.2 per km/h difference
    const damage = Math.round(5 + relativeSpeed * 0.2);

    const currentHealth = other.getField<number>('health') ?? 100;
    const newHealth = Math.max(0, currentHealth - damage);
    other.setField('health', newHealth);

    // Slow down the rider by 40%
    other.setField('currentSpeed', (other.getField<number>('currentSpeed') ?? 0) * 0.6);

    // Player damage flash
    if (other.templateId === 'player-bike') {
      this.ctx.damageFlash();
    }

    // Check for crash
    if (newHealth <= 0) {
      triggerCrash(other);
    }
  }
}
