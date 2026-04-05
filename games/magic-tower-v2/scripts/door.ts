import { Entity } from '@mote/engine';
import type { ScriptLifecycle } from '@mote/engine';
import type { EngineContext } from '../src/engine-context';

export default class DoorScript implements ScriptLifecycle {
  constructor(private entity: Entity, private engine: EngineContext) {}

  onInteract(player: Entity): void {
    const color = this.entity.getField<string>('color') || 'yellow';
    const state = this.engine.state;

    let hasKey = false;
    if (color === 'yellow' && state.yellowKeys > 0) {
      state.yellowKeys--;
      hasKey = true;
    } else if (color === 'blue' && state.blueKeys > 0) {
      state.blueKeys--;
      hasKey = true;
    } else if (color === 'red' && state.redKeys > 0) {
      state.redKeys--;
      hasKey = true;
    }

    if (hasKey) {
      this.engine.removeEntity(this.entity);
      this.engine.updateHUD();
      // Move player through the door
      this.engine.startPlayerMove(this.entity.x / 32, this.entity.y / 32);
    } else {
      const colorNames: Record<string, string> = {
        yellow: '黄色',
        blue: '蓝色',
        red: '红色',
      };
      this.engine.showDialog(
        '提示',
        `需要${colorNames[color] || color}钥匙！`
      );
    }
  }
}
