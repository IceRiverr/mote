/**
 * monster.ts — Monster Interaction Handler
 *
 * Called when the player bumps into a monster entity on the grid.
 * Uses the deterministic combat system to resolve the fight, then
 * mutates GameState accordingly (HP lost, gold/exp gained, entity removed).
 */

import { GameState, removeEntity } from './game-state';
import { calculateCombat, MonsterData } from './combat';

// ─── Types ────────────────────────────────────────────────────────────

export interface BattleResult {
  /** Whether the player won the fight. */
  won: boolean;
  /** HP the player lost (0 if the fight didn't happen). */
  damage: number;
  /** Gold gained on victory (0 otherwise). */
  goldGained: number;
  /** Exp gained on victory (0 otherwise). */
  expGained: number;
  /** Human-readable message to display in the UI. */
  message: string;
}

// ─── Handler ──────────────────────────────────────────────────────────

/**
 * Resolve a monster interaction.
 *
 * This function:
 *  1. Builds a MonsterData object from the entity's raw field map.
 *  2. Runs the deterministic combat calculation.
 *  3. If the player wins, applies damage/rewards and marks the entity removed.
 *  4. If the player would lose, returns a warning — no state is changed.
 *
 * @param state         Global game state (mutated on victory).
 * @param entityId      Unique id of the monster entity on this scene.
 * @param sceneId       Scene (floor) identifier, e.g. "floor_3".
 * @param monsterFields The `fields` object from the entity data. Expected
 *                      keys: hp, atk, def, gold, exp, tags, boss, monsterType.
 * @returns BattleResult describing the outcome.
 */
export function handleMonsterInteraction(
  state: GameState,
  entityId: string,
  sceneId: string,
  monsterFields: Record<string, any>
): BattleResult {
  // ── Build MonsterData from raw fields ─────────────────────────────
  const monster: MonsterData = {
    monsterType: monsterFields.monsterType ?? 'unknown',
    hp:   monsterFields.hp   ?? 0,
    atk:  monsterFields.atk  ?? 0,
    def:  monsterFields.def  ?? 0,
    gold: monsterFields.gold ?? 0,
    exp:  monsterFields.exp  ?? 0,
    tags: monsterFields.tags ?? '',
    boss: monsterFields.boss ?? false,
  };

  const hasCross = state.specialItems.has('cross');

  // ── Run deterministic combat ──────────────────────────────────────
  const result = calculateCombat(
    state.atk,
    state.def,
    monster.hp,
    monster.atk,
    monster.def,
    hasCross,
    monster.tags
  );

  // ── Cannot hurt the monster at all ────────────────────────────────
  if (!result.canWin) {
    return {
      won: false,
      damage: 0,
      goldGained: 0,
      expGained: 0,
      message: `${formatName(monster.monsterType)} is invincible! You cannot deal any damage.`,
    };
  }

  // ── Player would die (damage >= current HP) ───────────────────────
  if (result.damage >= state.hp) {
    return {
      won: false,
      damage: 0,
      goldGained: 0,
      expGained: 0,
      message: `${formatName(monster.monsterType)} is too strong! You would lose ${result.damage} HP.`,
    };
  }

  // ── Victory — apply damage and rewards ────────────────────────────
  const damageDealt = result.damage;
  const goldReward  = monster.gold;
  const expReward   = monster.exp;

  state.hp   -= damageDealt;
  state.gold += goldReward;
  state.exp  += expReward;

  // Mark entity as removed so it won't reappear when revisiting the floor
  removeEntity(state, sceneId, entityId);

  // Build a descriptive result message
  const parts: string[] = [`Defeated ${formatName(monster.monsterType)}!`];
  if (damageDealt > 0) parts.push(`Lost ${damageDealt} HP.`);
  if (goldReward  > 0) parts.push(`+${goldReward} Gold.`);
  if (expReward   > 0) parts.push(`+${expReward} Exp.`);

  return {
    won: true,
    damage: damageDealt,
    goldGained: goldReward,
    expGained: expReward,
    message: parts.join(' '),
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * Format a monster type string for display.
 * "slime_green" → "Slime Green", "skeleton" → "Skeleton"
 */
function formatName(monsterType: string): string {
  return monsterType
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
