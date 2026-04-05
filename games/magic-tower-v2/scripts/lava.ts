import { Entity } from '@mote/engine';
import type { ScriptLifecycle } from '@mote/engine';
import type { EngineContext } from '../src/engine-context';

export default class LavaScript implements ScriptLifecycle {
  constructor(private entity: Entity, private engine: EngineContext) {}

  onInteract(player: Entity): void {
    const damage = this.entity.getField<number>('damage') ?? 100;
    this.engine.state.hp -= damage;
    this.engine.updateHUD();
    this.engine.showDialog('岩浆', `踩到岩浆，受到${damage}点伤害！`);
    if (this.engine.state.hp <= 0) {
      this.engine.showDialog('游戏结束', '你被岩浆吞噬了...', [
        { label: '重新开始', action: () => location.reload() },
      ]);
    }
  }
}
