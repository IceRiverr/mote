/**
 * lava.ts
 * Handles lava floor damage in Magic Tower.
 * When a player steps on a lava tile, they take a fixed amount of damage.
 */

import { GameState } from './game-state';

/**
 * Apply lava damage to the player.
 *
 * @param state - Current game state (hp will be reduced).
 * @param damage - Amount of HP to deduct.
 * @returns A message string describing the damage taken.
 */
export function handleLavaDamage(state: GameState, damage: number): string {
  const actualDamage = Math.min(damage, state.hp);
  state.hp -= actualDamage;

  if (state.hp <= 0) {
    state.hp = 0;
    return `你踩到了岩浆，受到 ${actualDamage} 点伤害！生命值归零！`;
  }

  return `你踩到了岩浆，受到 ${actualDamage} 点伤害！剩余HP: ${state.hp}`;
}
