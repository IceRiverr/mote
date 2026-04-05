import type { Entity } from '@mote/engine';
import type { ScriptLifecycle } from '@mote/engine';
import type { RoadRashContext } from '../src/engine-context';

/**
 * Nitro pickup item. Adds nitro fuel to the player's reserves when collected.
 * Nitro amount is stored in the entity's "nitroAmount" field and caps at 100.
 */
export default class NitroPickupScript implements ScriptLifecycle {
  private entity: Entity;
  private ctx: RoadRashContext;

  constructor(entity: Entity, engine: unknown) {
    this.entity = entity;
    this.ctx = engine as RoadRashContext;
  }

  onCollisionEnter(other: Entity): void {
    if (other.templateId !== 'player-bike') return;
    if (this.entity.getField<boolean>('collected')) return;

    const amount = this.entity.getField<number>('nitroAmount') ?? 50;
    const current = other.getField<number>('nitro') ?? 0;
    other.setField('nitro', Math.min(100, current + amount));

    this.entity.setField('collected', true);
    this.entity.visible = false;
  }
}
