import { Entity } from '@mote/engine';
import type { ScriptLifecycle } from '@mote/engine';
import type { EngineContext } from '../src/engine-context';

export default class ShopScript implements ScriptLifecycle {
  constructor(private entity: Entity, private engine: EngineContext) {}

  onInteract(player: Entity): void {
    this.showShopMenu();
  }

  private showShopMenu(): void {
    const state = this.engine.state;
    const priceHP = this.entity.getField<number>('priceHP') ?? 25;
    const amountHP = this.entity.getField<number>('amountHP') ?? 800;
    const priceATK = this.entity.getField<number>('priceATK') ?? 25;
    const amountATK = this.entity.getField<number>('amountATK') ?? 4;
    const priceDEF = this.entity.getField<number>('priceDEF') ?? 25;
    const amountDEF = this.entity.getField<number>('amountDEF') ?? 4;

    const buttons: { label: string; action: () => any }[] = [];

    buttons.push({
      label: `HP+${amountHP} (${priceHP}金)`,
      action: () => {
        if (state.gold >= priceHP) {
          state.gold -= priceHP;
          state.hp += amountHP;
          this.engine.updateHUD();
          this.engine.showDialog('商人', `体力增加了${amountHP}！`, [
            { label: '继续购买', action: () => this.showShopMenu() },
            { label: '离开', action: () => {} },
          ]);
        } else {
          this.engine.showDialog('商人', '金币不足！', [
            { label: '返回', action: () => this.showShopMenu() },
          ]);
        }
      },
    });

    buttons.push({
      label: `ATK+${amountATK} (${priceATK}金)`,
      action: () => {
        if (state.gold >= priceATK) {
          state.gold -= priceATK;
          state.atk += amountATK;
          this.engine.updateHUD();
          this.engine.showDialog('商人', `攻击增加了${amountATK}！`, [
            { label: '继续购买', action: () => this.showShopMenu() },
            { label: '离开', action: () => {} },
          ]);
        } else {
          this.engine.showDialog('商人', '金币不足！', [
            { label: '返回', action: () => this.showShopMenu() },
          ]);
        }
      },
    });

    buttons.push({
      label: `DEF+${amountDEF} (${priceDEF}金)`,
      action: () => {
        if (state.gold >= priceDEF) {
          state.gold -= priceDEF;
          state.def += amountDEF;
          this.engine.updateHUD();
          this.engine.showDialog('商人', `防御增加了${amountDEF}！`, [
            { label: '继续购买', action: () => this.showShopMenu() },
            { label: '离开', action: () => {} },
          ]);
        } else {
          this.engine.showDialog('商人', '金币不足！', [
            { label: '返回', action: () => this.showShopMenu() },
          ]);
        }
      },
    });

    buttons.push({ label: '离开', action: () => {} });

    this.engine.showDialog('商人', `欢迎光临！金币: ${state.gold}`, buttons);
  }
}
