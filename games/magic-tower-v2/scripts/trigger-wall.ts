import { Entity } from '@mote/engine';
import type { ScriptLifecycle } from '@mote/engine';
import type { EngineContext } from '../src/engine-context';
import { firedEvents } from './event-trigger';

export default class TriggerWallScript implements ScriptLifecycle {
  constructor(private entity: Entity, private engine: EngineContext) {}

  update(dt: number): void {
    const triggerEvent = this.entity.getField<string>('triggerEvent') || '';
    const disappear =
      this.entity.getField<boolean>('disappearOnTrigger') ?? true;

    if (triggerEvent && firedEvents.has(triggerEvent) && disappear) {
      this.engine.removeEntity(this.entity);
    }
  }
}
