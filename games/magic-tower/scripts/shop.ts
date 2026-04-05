/**
 * shop.ts
 * Shop system for Magic Tower.
 * Provides options to buy HP, ATK, or DEF upgrades using gold.
 */

import { GameState } from './game-state';

export interface ShopOption {
  label: string;
  stat: string;
  price: number;
  amount: number;
  canAfford: boolean;
}

/**
 * Get the available shop options based on the shop entity's configured fields.
 * Each shop NPC can have different prices and amounts for HP/ATK/DEF.
 *
 * @param state - Current game state (used to check gold).
 * @param fields - The entity fields from the shop entity (priceHP, amountHP, etc.).
 * @returns Array of three ShopOption entries.
 */
export function getShopOptions(state: GameState, fields: Record<string, any>): ShopOption[] {
  const priceHP = fields.priceHP ?? 25;
  const amountHP = fields.amountHP ?? 800;
  const priceATK = fields.priceATK ?? 25;
  const amountATK = fields.amountATK ?? 4;
  const priceDEF = fields.priceDEF ?? 25;
  const amountDEF = fields.amountDEF ?? 4;

  return [
    {
      label: `生命+${amountHP} (${priceHP}金币)`,
      stat: 'hp',
      price: priceHP,
      amount: amountHP,
      canAfford: state.gold >= priceHP,
    },
    {
      label: `攻击+${amountATK} (${priceATK}金币)`,
      stat: 'atk',
      price: priceATK,
      amount: amountATK,
      canAfford: state.gold >= priceATK,
    },
    {
      label: `防御+${amountDEF} (${priceDEF}金币)`,
      stat: 'def',
      price: priceDEF,
      amount: amountDEF,
      canAfford: state.gold >= priceDEF,
    },
  ];
}

/**
 * Purchase a shop item, deducting gold and applying the stat boost.
 *
 * @param state - Current game state (will be mutated).
 * @param option - The shop option to purchase.
 * @returns true if purchase succeeded, false if player can't afford it.
 */
export function purchaseShopItem(state: GameState, option: ShopOption): boolean {
  if (state.gold < option.price) {
    return false;
  }

  state.gold -= option.price;

  switch (option.stat) {
    case 'hp':
      state.hp += option.amount;
      break;
    case 'atk':
      state.atk += option.amount;
      break;
    case 'def':
      state.def += option.amount;
      break;
    default:
      // Unknown stat, refund gold
      state.gold += option.price;
      return false;
  }

  return true;
}
