import type { Entity } from '@mote/engine';
import type { ScriptLifecycle } from '@mote/engine';
import type { RoadRashContext } from '../src/engine-context';

/**
 * Weapon pickup item. When the player rides over it, the player's weapon
 * is replaced with the weapon stored in this entity's "weaponType" field.
 */
export default class WeaponPickupScript implements ScriptLifecycle {
  private entity: Entity;
  private ctx: RoadRashContext;

  constructor(entity: Entity, engine: unknown) {
    this.entity = entity;
    this.ctx = engine as RoadRashContext;
  }

  onCollisionEnter(other: Entity): void {
    // Only the player can collect weapon pickups, and only once
    if (other.templateId !== 'player-bike') return;
    if (this.entity.getField<boolean>('collected')) return;

    const weaponType = this.entity.getField<string>('weaponType') ?? 'chain';
    other.setField('weapon', weaponType);

    // Mark as collected and hide
    this.entity.setField('collected', true);
    this.entity.visible = false;
  }
}
