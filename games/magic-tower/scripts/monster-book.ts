/**
 * monster-book.ts
 * Monster encyclopedia (怪物图鉴) for Magic Tower.
 * Shows all monsters on the current floor with predicted damage from combat.
 */

import { GameState } from './game-state';
import { MonsterData, predictDamage } from './combat';

export interface MonsterBookEntry {
  monsterType: string;
  name: string;
  hp: number;
  atk: number;
  def: number;
  gold: number;
  predictedDamage: number; // -1 means can't win
  sprite: string;          // frame name in characters sheet
}

/** Entity data from scene layer — minimal shape for what we need. */
export interface EntityData {
  id: string;
  templateId: string;
  fields: Record<string, any>;
}

/** All monster types with their Chinese names. */
export const MONSTER_NAMES: Record<string, string> = {
  slime_green: '绿色史莱姆',
  slime_red: '红色史莱姆',
  bat: '蝙蝠',
  skeleton: '骷髅兵',
  skeleton_warrior: '骷髅武士',
  mage: '法师',
  orc: '兽人',
  orc_captain: '兽人首领',
  great_mage: '大法师',
  dark_knight: '黑暗骑士',
  spirit: '幽灵',
  vampire: '吸血鬼',
  dragon: '火龙',
  demon_lord: '魔王',
};

/**
 * Get all monster entries on the current floor, deduplicated by monsterType,
 * with predicted damage calculated for the player's current stats.
 *
 * @param state - Current game state (for player ATK/DEF and cross check).
 * @param currentFloorEntities - All entities on the current floor (from scene data).
 * @returns Array of MonsterBookEntry sorted by predicted damage ascending.
 */
export function getMonsterBookEntries(
  state: GameState,
  currentFloorEntities: EntityData[]
): MonsterBookEntry[] {
  // Collect unique monster types from the current floor's entities
  const monsterMap = new Map<string, MonsterBookEntry>();

  const hasCross = state.specialItems.has('cross');

  for (const entity of currentFloorEntities) {
    // Only process monster entities
    if (entity.templateId !== 'monster') continue;

    const fields = entity.fields;
    const monsterType: string = fields.monsterType || 'slime_green';

    // Skip if we already have this type
    if (monsterMap.has(monsterType)) continue;

    const monsterData: MonsterData = {
      monsterType,
      hp: fields.hp ?? 50,
      atk: fields.atk ?? 20,
      def: fields.def ?? 1,
      gold: fields.gold ?? 1,
      exp: fields.exp ?? 1,
      tags: fields.tags ?? '',
      boss: fields.boss ?? false,
    };

    const damage = predictDamage(state.atk, state.def, monsterData, hasCross);

    monsterMap.set(monsterType, {
      monsterType,
      name: MONSTER_NAMES[monsterType] || monsterType,
      hp: monsterData.hp,
      atk: monsterData.atk,
      def: monsterData.def,
      gold: monsterData.gold,
      predictedDamage: damage,
      sprite: monsterType, // frame name in characters sprite sheet
    });
  }

  // Sort: monsters we can beat first (by damage asc), then unbeatable ones
  const entries = Array.from(monsterMap.values());
  entries.sort((a, b) => {
    // Unbeatable monsters (-1) sort to the end
    if (a.predictedDamage === -1 && b.predictedDamage === -1) return 0;
    if (a.predictedDamage === -1) return 1;
    if (b.predictedDamage === -1) return -1;
    return a.predictedDamage - b.predictedDamage;
  });

  return entries;
}
