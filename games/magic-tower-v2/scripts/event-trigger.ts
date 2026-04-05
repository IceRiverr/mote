import { Entity } from '@mote/engine';
import type { ScriptLifecycle } from '@mote/engine';
import type { EngineContext } from '../src/engine-context';

// Global event registry
export const firedEvents = new Set<string>();

export default class EventTriggerScript implements ScriptLifecycle {
  private triggered = false;

  constructor(private entity: Entity, private engine: EngineContext) {}

  onInteract(player: Entity): void {
    const eventId = this.entity.getField<string>('event') || '';
    const once = this.entity.getField<boolean>('once') ?? true;

    if (!eventId) return;
    if (once && this.triggered) return;

    firedEvents.add(eventId);
    this.triggered = true;

    if (once) {
      this.engine.removeEntity(this.entity);
    }
  }
}
