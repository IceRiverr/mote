import { Entity } from '@mote/engine';
import type { ScriptLifecycle } from '@mote/engine';
import type { EngineContext } from '../src/engine-context';

export default class ItemPickupScript implements ScriptLifecycle {
  constructor(private entity: Entity, private engine: EngineContext) {}

  onInteract(player: Entity): void {
    const state = this.engine.state;
    const itemType = this.entity.getField<string>('itemType') || 'key';
    let message = '';

    switch (itemType) {
      case 'key': {
        const color = this.entity.getField<string>('color') || 'yellow';
        if (color === 'yellow') {
          state.yellowKeys++;
          message = '获得黄色钥匙！';
        } else if (color === 'blue') {
          state.blueKeys++;
          message = '获得蓝色钥匙！';
        } else if (color === 'red') {
          state.redKeys++;
          message = '获得红色钥匙！';
        }
        break;
      }
      case 'potion': {
        const amount = this.entity.getField<number>('amount') ?? 200;
        state.hp += amount;
        message = `获得药水，HP+${amount}！`;
        break;
      }
      case 'gem': {
        const stat = this.entity.getField<string>('stat') || 'atk';
        const amount = this.entity.getField<number>('amount') ?? 3;
        if (stat === 'atk') {
          state.atk += amount;
          message = `获得红宝石，攻击+${amount}！`;
        } else if (stat === 'def') {
          state.def += amount;
          message = `获得蓝宝石，防御+${amount}！`;
        } else {
          state.hp += amount;
          message = `获得绿宝石，HP+${amount}！`;
        }
        break;
      }
      case 'equipment': {
        const equipId =
          this.entity.getField<string>('equipId') || 'sword_iron';
        const stat = this.entity.getField<string>('stat') || 'atk';
        const amount = this.entity.getField<number>('amount') ?? 10;
        if (stat === 'atk') state.atk += amount;
        else if (stat === 'def') state.def += amount;
        state.equippedItems.add(equipId);
        const equipNames: Record<string, string> = {
          sword_iron: '铁剑',
          shield_iron: '铁盾',
          sword_holy: '圣剑',
          shield_holy: '圣盾',
        };
        message = `获得${equipNames[equipId] || equipId}！${stat === 'atk' ? '攻击' : '防御'}+${amount}`;
        break;
      }
      case 'special': {
        const specialId =
          this.entity.getField<string>('specialId') || 'monster_book';
        state.specialItems.add(specialId);
        const specialNames: Record<string, string> = {
          monster_book: '怪物图鉴',
          cross: '十字架',
          teleporter_item: '传送器',
          star: '胜利之星',
        };
        message = `获得${specialNames[specialId] || specialId}！`;
        if (specialId === 'star') {
          this.engine.removeEntity(this.entity);
          this.engine.showDialog(
            '恭喜通关！',
            '你获得了胜利之星，成功征服了魔塔！',
            [{ label: '再玩一次', action: () => location.reload() }]
          );
          return;
        }
        break;
      }
    }

    this.engine.removeEntity(this.entity);
    this.engine.updateHUD();
    if (message) this.engine.showDialog('获得物品', message);
  }
}
