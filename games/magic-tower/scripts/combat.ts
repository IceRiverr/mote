/**
 * combat.ts — Deterministic Combat System
 *
 * Magic Tower uses a fully deterministic combat model:
 *   1. The player and monster trade blows in turn (player strikes first).
 *   2. Each hit deals max(0, attacker_atk - defender_def) damage.
 *   3. If the player's damage per hit is 0, the monster is invincible.
 *   4. Otherwise we compute total damage the player receives before the
 *      monster dies, and check whether the player can survive.
 *
 * Special rule — Holy Cross:
 *   If the player owns the 'cross' special item AND the monster's tags
 *   contain 'undead', the player gets +10 ATK for the calculation only.
 */

import { GameState } from './game-state';

// ─── Data Interfaces ──────────────────────────────────────────────────

/** Monster stats extracted from an entity's fields. */
export interface MonsterData {
  /** Template/kind identifier, e.g. "slime_green". */
  monsterType: string;
  hp: number;
  atk: number;
  def: number;
  /** Gold rewarded on kill. */
  gold: number;
  /** Experience rewarded on kill. */
  exp: number;
  /** Comma-separated tags, e.g. "undead,boss". */
  tags: string;
  /** Whether this monster is a boss. */
  boss: boolean;
}

/** Outcome of a combat encounter. */
export interface CombatResult {
  /** Whether the player won the fight. */
  won: boolean;
  /** Total damage the player received during the fight. */
  damage: number;
  /** Gold reward from the monster. */
  goldReward: number;
  /** Exp reward from the monster. */
  expReward: number;
  /** Human-readable message for the UI. */
  message: string;
}

// ─── Internal Damage Calculation ──────────────────────────────────────

/**
 * Pure internal calculation — determines fight outcome without any
 * cross-bonus logic. Callers adjust ATK before calling if needed.
 */
function calcDamage(
  pAtk: number,
  pDef: number,
  mHp: number,
  mAtk: number,
  mDef: number
): { canWin: boolean; damage: number } {
  const playerDmg = Math.max(0, pAtk - mDef);
  if (playerDmg === 0) {
    return { canWin: false, damage: -1 };
  }
  const hitsToKill = Math.ceil(mHp / playerDmg);
  const monsterDmg = Math.max(0, mAtk - pDef);
  const totalDamage = (hitsToKill - 1) * monsterDmg;
  return { canWin: true, damage: totalDamage };
}

// ─── Public API ───────────────────────────────────────────────────────

/**
 * Predict the damage the player would take fighting this monster.
 * Used by the Monster Book UI to display expected damage.
 *
 * @param playerAtk  Player's current ATK stat.
 * @param playerDef  Player's current DEF stat.
 * @param monster    Monster data object.
 * @param hasCross   Whether the player has the Holy Cross (optional, default false).
 * @returns  The exact HP cost of winning, or -1 if the monster is invincible.
 */
export function predictDamage(
  playerAtk: number,
  playerDef: number,
  monster: MonsterData,
  hasCross: boolean = false
): number {
  let atk = playerAtk;
  if (hasCross && monster.tags && monster.tags.includes('undead')) {
    atk += 10;
  }
  const result = calcDamage(atk, playerDef, monster.hp, monster.atk, monster.def);
  return result.canWin ? result.damage : -1;
}

/**
 * Execute combat against a monster, mutating the player's state.
 *
 * Applies the Holy Cross bonus automatically if the player has it.
 * Deducts HP, awards gold and exp on victory.
 *
 * @param state       Current game state (mutated on victory).
 * @param monster     Monster data object.
 * @param monsterName Display name of the monster (for messages).
 * @returns CombatResult describing the outcome.
 */
export function executeCombat(
  state: GameState,
  monster: MonsterData,
  monsterName: string
): CombatResult {
  let atk = state.atk;
  if (state.specialItems.has('cross') && monster.tags && monster.tags.includes('undead')) {
    atk += 10;
  }

  const { canWin, damage } = calcDamage(atk, state.def, monster.hp, monster.atk, monster.def);

  if (!canWin) {
    return {
      won: false,
      damage: 0,
      goldReward: 0,
      expReward: 0,
      message: `无法战胜${monsterName}！`,
    };
  }

  // Check if player would die
  if (damage >= state.hp) {
    return {
      won: false,
      damage: 0,
      goldReward: 0,
      expReward: 0,
      message: `${monsterName}太强了！你会损失${damage}点HP。`,
    };
  }

  // Victory — apply damage and rewards
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

/**
 * Legacy combat calculation — kept for backward compatibility.
 *
 * Pure function that computes fight outcome without mutating state.
 * Handles Holy Cross bonus internally based on hasCross + monsterTags.
 *
 * @param playerAtk   Player's current ATK stat.
 * @param playerDef   Player's current DEF stat.
 * @param monsterHp   Monster's hit points.
 * @param monsterAtk  Monster's ATK.
 * @param monsterDef  Monster's DEF.
 * @param hasCross    Whether the player has the Holy Cross special item.
 * @param monsterTags Comma-separated tag string from monster data.
 * @returns Object with canWin, damage, goldReward, expReward.
 */
export function calculateCombat(
  playerAtk: number,
  playerDef: number,
  monsterHp: number,
  monsterAtk: number,
  monsterDef: number,
  hasCross: boolean,
  monsterTags: string
): { canWin: boolean; damage: number; goldReward: number; expReward: number } {
  let effectiveAtk = playerAtk;
  if (hasCross && monsterTags) {
    const tags = monsterTags.split(',').map((t) => t.trim().toLowerCase());
    if (tags.includes('undead')) {
      effectiveAtk += 10;
    }
  }

  const playerDmg = Math.max(0, effectiveAtk - monsterDef);

  if (playerDmg === 0) {
    return { canWin: false, damage: 0, goldReward: 0, expReward: 0 };
  }

  const hitsToKill = Math.ceil(monsterHp / playerDmg);
  const monsterDmg = Math.max(0, monsterAtk - playerDef);
  const totalDamage = (hitsToKill - 1) * monsterDmg;

  return {
    canWin: true,
    damage: totalDamage,
    goldReward: 0,
    expReward: 0,
  };
}

/**
 * Check whether the player can defeat a monster without dying.
 *
 * @param state   Current game state.
 * @param monster Monster data object.
 * @returns true if the player can win and survive.
 */
export function canDefeatMonster(state: GameState, monster: MonsterData): boolean {
  let atk = state.atk;
  if (state.specialItems.has('cross') && monster.tags && monster.tags.includes('undead')) {
    atk += 10;
  }
  const result = calcDamage(atk, state.def, monster.hp, monster.atk, monster.def);
  return result.canWin && result.damage < state.hp;
}
