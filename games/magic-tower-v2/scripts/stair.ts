import { Entity } from '@mote/engine';
import type { ScriptLifecycle } from '@mote/engine';
import type { EngineContext } from '../src/engine-context';

export default class StairScript implements ScriptLifecycle {
  constructor(private entity: Entity, private engine: EngineContext) {}

  onInteract(player: Entity): void {
    const targetFloor =
      this.entity.getField<string>('targetFloor') || 'floor-2';
    const targetX = this.entity.getField<number>('targetX') ?? 6;
    const targetY = this.entity.getField<number>('targetY') ?? 11;
    const state = this.engine.state;

    state.playerX = targetX;
    state.playerY = targetY;

    // Parse floor number
    const match = targetFloor.match(/(\d+)/);
    if (match) state.floor = parseInt(match[1]);
    state.visitedFloors.add(state.floor);

    this.engine.loadScene(targetFloor);
  }
}
