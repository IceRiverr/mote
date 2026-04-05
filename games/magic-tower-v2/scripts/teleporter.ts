import { Entity } from '@mote/engine';
import type { ScriptLifecycle } from '@mote/engine';
import type { EngineContext } from '../src/engine-context';

export default class TeleporterScript implements ScriptLifecycle {
  constructor(private entity: Entity, private engine: EngineContext) {}

  onInteract(player: Entity): void {
    const targetFloor = this.entity.getField<string>('targetFloor') || '';
    const targetX = this.entity.getField<number>('targetX') ?? 6;
    const targetY = this.entity.getField<number>('targetY') ?? 6;

    if (!targetFloor) return;

    const state = this.engine.state;
    state.playerX = targetX;
    state.playerY = targetY;

    const match = targetFloor.match(/(\d+)/);
    if (match) state.floor = parseInt(match[1]);
    state.visitedFloors.add(state.floor);

    this.engine.loadScene(targetFloor);
  }
}
