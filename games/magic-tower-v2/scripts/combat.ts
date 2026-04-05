// Combat utility — NOT a script, just exported functions

export interface MonsterData {
  monsterType: string;
  hp: number;
  atk: number;
  def: number;
  gold: number;
  exp: number;
  tags: string;
  boss: boolean;
}

export interface CombatResult {
  won: boolean;
  damage: number;
  goldReward: number;
  expReward: number;
  message: string;
}

export function predictDamage(
  playerAtk: number,
  playerDef: number,
  monster: MonsterData,
  hasCross = false
): number {
  let atk = playerAtk;
  if (hasCross && monster.tags.includes('undead')) atk += 10;

  const playerDmg = Math.max(0, atk - monster.def);
  if (playerDmg === 0) return -1; // Can't win

  const hitsToKill = Math.ceil(monster.hp / playerDmg);
  const monsterDmg = Math.max(0, monster.atk - playerDef);
  return (hitsToKill - 1) * monsterDmg;
}

export function executeCombat(
  state: any,
  monster: MonsterData,
  monsterName: string
): CombatResult {
  let atk = state.atk;
  if (state.specialItems.has('cross') && monster.tags.includes('undead'))
    atk += 10;

  const playerDmg = Math.max(0, atk - monster.def);
  if (playerDmg === 0) {
    return {
      won: false,
      damage: 0,
      goldReward: 0,
      expReward: 0,
      message: `无法战胜${monsterName}！`,
    };
  }

  const hitsToKill = Math.ceil(monster.hp / playerDmg);
  const monsterDmg = Math.max(0, monster.atk - state.def);
  const damage = (hitsToKill - 1) * monsterDmg;

  state.hp -= damage;
  state.gold += monster.gold;
  state.exp += monster.exp;

  return {
    won: true,
    damage,
    goldReward: monster.gold,
    expReward: monster.exp,
    message: `击败${monsterName}！\n受到${damage}点伤害\n获得${monster.gold}金币`,
  };
}

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
