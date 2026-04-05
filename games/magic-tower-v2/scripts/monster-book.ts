import type { GameState } from '../src/game-state';
import type { Entity } from '@mote/engine';
import { MonsterData, predictDamage, MONSTER_NAMES } from './combat';

export interface MonsterBookEntry {
  monsterType: string;
  name: string;
  hp: number;
  atk: number;
  def: number;
  gold: number;
  predictedDamage: number; // -1 = can't win
}

export function getMonsterBookEntries(
  state: GameState,
  entities: readonly Entity[]
): MonsterBookEntry[] {
  const seen = new Map<string, MonsterBookEntry>();
  const hasCross = state.specialItems.has('cross');

  for (const e of entities) {
    if (e.templateId !== 'monster' || !e.visible) continue;
    const type = e.getField<string>('monsterType') || 'slime_green';
    if (seen.has(type)) continue;

    const monster: MonsterData = {
      monsterType: type,
      hp: e.getField<number>('hp') ?? 50,
      atk: e.getField<number>('atk') ?? 20,
      def: e.getField<number>('def') ?? 1,
      gold: e.getField<number>('gold') ?? 1,
      exp: e.getField<number>('exp') ?? 1,
      tags: e.getField<string>('tags') || '',
      boss: e.getField<boolean>('boss') ?? false,
    };

    seen.set(type, {
      monsterType: type,
      name: MONSTER_NAMES[type] || type,
      hp: monster.hp,
      atk: monster.atk,
      def: monster.def,
      gold: monster.gold,
      predictedDamage: predictDamage(state.atk, state.def, monster, hasCross),
    });
  }

  return [...seen.values()].sort((a, b) => {
    if (a.predictedDamage < 0 && b.predictedDamage >= 0) return 1;
    if (b.predictedDamage < 0 && a.predictedDamage >= 0) return -1;
    return a.predictedDamage - b.predictedDamage;
  });
}
