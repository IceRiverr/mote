import { Entity } from '@mote/engine';
import type { ScriptLifecycle } from '@mote/engine';
import type { EngineContext } from '../src/engine-context';
import {
  MonsterData,
  predictDamage,
  executeCombat,
  MONSTER_NAMES,
} from './combat';

export default class MonsterScript implements ScriptLifecycle {
  constructor(private entity: Entity, private engine: EngineContext) {}

  onInteract(player: Entity): void {
    const state = this.engine.state;
    const monsterType =
      this.entity.getField<string>('monsterType') || 'slime_green';
    const monsterName = MONSTER_NAMES[monsterType] || monsterType;

    const monster: MonsterData = {
      monsterType,
      hp: this.entity.getField<number>('hp') ?? 50,
      atk: this.entity.getField<number>('atk') ?? 20,
      def: this.entity.getField<number>('def') ?? 1,
      gold: this.entity.getField<number>('gold') ?? 1,
      exp: this.entity.getField<number>('exp') ?? 1,
      tags: this.entity.getField<string>('tags') || '',
      boss: this.entity.getField<boolean>('boss') ?? false,
    };

    const predicted = predictDamage(
      state.atk,
      state.def,
      monster,
      state.specialItems.has('cross')
    );
    if (predicted < 0) {
      this.engine.showDialog(
        '战斗',
        `${monsterName}的防御太高了，你无法造成伤害！`
      );
      return;
    }

    const result = executeCombat(state, monster, monsterName);
    if (result.won) {
      this.engine.removeEntity(this.entity);
      this.engine.updateHUD();
      this.engine.showDialog(
        '战斗胜利',
        `击败了${monsterName}！<br>受到伤害: ${result.damage}<br>获得金币: ${result.goldReward}`
      );
      // Move player to monster's position
      this.engine.startPlayerMove(this.entity.x / 32, this.entity.y / 32);
    } else {
      this.engine.updateHUD();
      if (state.hp <= 0) {
        this.engine.showDialog('游戏结束', '你被击败了...', [
          { label: '重新开始', action: () => location.reload() },
        ]);
      }
    }
  }
}
