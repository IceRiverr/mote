import type { Entity } from '@mote/engine';
import type { ScriptLifecycle } from '@mote/engine';
import type { RoadRashContext } from '../src/engine-context';

/**
 * Health pickup item. Restores some health to the player, capped at their
 * durability (max health) value.
 */
export default class HealthPickupScript implements ScriptLifecycle {
  private entity: Entity;
  private ctx: RoadRashContext;

  constructor(entity: Entity, engine: unknown) {
    this.entity = entity;
    this.ctx = engine as RoadRashContext;
  }

  onCollisionEnter(other: Entity): void {
    if (other.templateId !== 'player-bike') return;
    if (this.entity.getField<boolean>('collected')) return;

    const amount = this.entity.getField<number>('healAmount') ?? 30;
    const currentHealth = other.getField<number>('health') ?? 0;
    const maxHealth = other.getField<number>('durability') ?? 100;
    other.setField('health', Math.min(maxHealth, currentHealth + amount));

    this.entity.setField('collected', true);
    this.entity.visible = false;
  }
}
