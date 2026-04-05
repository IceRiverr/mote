/**
 * item-pickup.ts — Item Pickup Handler
 *
 * Resolves what happens when the player walks into an item entity.
 * Covers all item categories:
 *   - Keys        (yellow / blue / red)
 *   - Potions     (small = +200 HP, large = +500 HP)
 *   - Gems        (red = ATK+, blue = DEF+)
 *   - Equipment   (iron sword/shield, holy sword/shield)
 *   - Special     (monster book, holy cross, teleporter, star)
 *   - Generic     (fallback using hpBonus / atkBonus / defBonus / goldBonus fields)
 */

import { GameState, removeEntity } from './game-state';

// ─── Types ────────────────────────────────────────────────────────────

export interface PickupResult {
  /** Whether the item was successfully picked up. */
  picked: boolean;
  /** Human-readable message for the UI. */
  message: string;
}

// ─── Equipment Stat Tables ────────────────────────────────────────────

const EQUIPMENT_ATK: Record<string, number> = {
  sword_iron: 10,
  sword_holy: 20,
};

const EQUIPMENT_DEF: Record<string, number> = {
  shield_iron: 10,
  shield_holy: 20,
};

// ─── Special Item Identifiers ─────────────────────────────────────────

const SPECIAL_ITEMS: ReadonlySet<string> = new Set([
  'monster_book',
  'cross',
  'teleporter_item',
  'star',
]);

// ─── Key Helpers (operate on plain GameState fields) ──────────────────

function addKey(state: GameState, color: string, count: number = 1): void {
  switch (color) {
    case 'yellow': state.yellowKeys += count; break;
    case 'blue':   state.blueKeys += count;   break;
    case 'red':    state.redKeys += count;     break;
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────

/**
 * Process an item pickup.
 *
 * The `fields` object should contain at least `itemType` (string) and
 * any type-specific data (color, amount, stat, value, etc.).
 *
 * @param state    Global game state (mutated on successful pickup).
 * @param entityId Unique id of the item entity.
 * @param sceneId  Scene (floor) identifier, e.g. "floor_2".
 * @param fields   Entity field map from the scene data.
 * @returns PickupResult describing the outcome.
 */
export function handleItemPickup(
  state: GameState,
  entityId: string,
  sceneId: string,
  fields: Record<string, any>
): PickupResult {
  const itemType: string = (fields.itemType ?? '').toLowerCase();

  if (!itemType) {
    return { picked: false, message: 'Unknown item.' };
  }

  // Dispatch to the appropriate sub-handler
  let result: PickupResult;

  if (itemType.startsWith('key_') || itemType === 'key') {
    result = handleKey(state, fields);
  } else if (itemType.startsWith('potion_') || itemType === 'potion') {
    result = handlePotion(state, fields);
  } else if (itemType.startsWith('gem_') || itemType === 'gem') {
    result = handleGem(state, fields);
  } else if (isEquipment(itemType)) {
    result = handleEquipment(state, itemType);
  } else if (SPECIAL_ITEMS.has(itemType)) {
    result = handleSpecialItem(state, itemType);
  } else {
    result = handleGenericItem(state, fields);
  }

  // Mark the entity as removed if pickup succeeded
  if (result.picked) {
    removeEntity(state, sceneId, entityId);
  }

  return result;
}

// ─── Category Sub-Handlers ────────────────────────────────────────────

/**
 * Key pickup.
 * Expected fields: color ('yellow' | 'blue' | 'red'), count? (default 1).
 */
function handleKey(state: GameState, fields: Record<string, any>): PickupResult {
  const color: string = (fields.color ?? 'yellow').toLowerCase();
  const count: number = fields.count ?? 1;

  addKey(state, color, count);

  const colorName = color.charAt(0).toUpperCase() + color.slice(1);
  const plural = count > 1 ? 's' : '';
  return {
    picked: true,
    message: `Picked up ${count > 1 ? count + ' ' : ''}${colorName} Key${plural}.`,
  };
}

/**
 * Potion pickup.
 * Expected fields: amount? (HP to restore), potionType? ('small' | 'large').
 *
 * Defaults: small = +200, large = +500. In Magic Tower potions have no cap —
 * HP can exceed maxHp.
 */
function handlePotion(state: GameState, fields: Record<string, any>): PickupResult {
  const potionType: string = (fields.potionType ?? 'small').toLowerCase();

  // Determine HP amount: explicit field takes priority, else derive from type
  let amount: number;
  if (fields.amount !== undefined) {
    amount = fields.amount;
  } else {
    amount = potionType === 'large' ? 500 : 200;
  }

  state.hp += amount;

  const label = potionType === 'large' ? 'Large Potion' : 'Small Potion';
  return {
    picked: true,
    message: `Used ${label}. HP +${amount}.`,
  };
}

/**
 * Gem pickup.
 * Expected fields: stat ('atk' | 'def'), value (stat increase, default 3).
 */
function handleGem(state: GameState, fields: Record<string, any>): PickupResult {
  const stat: string = (fields.stat ?? 'atk').toLowerCase();
  const value: number = fields.value ?? 3;

  if (stat === 'atk') {
    state.atk += value;
    return { picked: true, message: `Picked up Red Gem. ATK +${value}.` };
  }

  if (stat === 'def') {
    state.def += value;
    return { picked: true, message: `Picked up Blue Gem. DEF +${value}.` };
  }

  return { picked: false, message: 'Unknown gem type.' };
}

/**
 * Equipment pickup. Permanently boosts ATK or DEF.
 */
function handleEquipment(state: GameState, itemType: string): PickupResult {
  const atkBonus = EQUIPMENT_ATK[itemType] ?? 0;
  const defBonus = EQUIPMENT_DEF[itemType] ?? 0;

  const parts: string[] = [];
  if (atkBonus > 0) {
    state.atk += atkBonus;
    parts.push(`ATK +${atkBonus}`);
  }
  if (defBonus > 0) {
    state.def += defBonus;
    parts.push(`DEF +${defBonus}`);
  }

  return {
    picked: true,
    message: `Equipped ${equipmentDisplayName(itemType)}! ${parts.join(', ')}.`,
  };
}

/**
 * Special / unique item pickup. Each can only be collected once.
 */
function handleSpecialItem(state: GameState, itemType: string): PickupResult {
  // Guard against duplicate collection
  if (state.specialItems.has(itemType)) {
    return { picked: false, message: 'You already have this item.' };
  }

  state.specialItems.add(itemType);

  switch (itemType) {
    case 'monster_book':
      return {
        picked: true,
        message: 'Obtained Monster Book! Press M to view monster info.',
      };
    case 'cross':
      return {
        picked: true,
        message: 'Obtained Holy Cross! Bonus damage against undead monsters.',
      };
    case 'teleporter_item':
      return {
        picked: true,
        message: 'Obtained Teleporter! Press T to teleport between visited floors.',
      };
    case 'star':
      return {
        picked: true,
        message: 'Obtained the Star of Destiny! You can now challenge the final boss.',
      };
    default:
      return {
        picked: true,
        message: `Obtained special item: ${itemType}.`,
      };
  }
}

/**
 * Generic / fallback item handler.
 * Tries to apply bonus fields: hpBonus, atkBonus, defBonus, goldBonus.
 */
function handleGenericItem(state: GameState, fields: Record<string, any>): PickupResult {
  const parts: string[] = [];

  if (fields.hpBonus && typeof fields.hpBonus === 'number') {
    state.hp += fields.hpBonus;
    parts.push(`HP +${fields.hpBonus}`);
  }
  if (fields.atkBonus && typeof fields.atkBonus === 'number') {
    state.atk += fields.atkBonus;
    parts.push(`ATK +${fields.atkBonus}`);
  }
  if (fields.defBonus && typeof fields.defBonus === 'number') {
    state.def += fields.defBonus;
    parts.push(`DEF +${fields.defBonus}`);
  }
  if (fields.goldBonus && typeof fields.goldBonus === 'number') {
    state.gold += fields.goldBonus;
    parts.push(`Gold +${fields.goldBonus}`);
  }

  if (parts.length === 0) {
    return { picked: false, message: 'Cannot pick up this item.' };
  }

  return {
    picked: true,
    message: `Picked up item. ${parts.join(', ')}.`,
  };
}

// ─── Utility Functions ────────────────────────────────────────────────

/** Check whether an itemType is a known equipment piece. */
function isEquipment(itemType: string): boolean {
  return itemType in EQUIPMENT_ATK || itemType in EQUIPMENT_DEF;
}

/** Human-readable equipment name. */
function equipmentDisplayName(itemType: string): string {
  switch (itemType) {
    case 'sword_iron':  return 'Iron Sword';
    case 'shield_iron': return 'Iron Shield';
    case 'sword_holy':  return 'Holy Sword';
    case 'shield_holy': return 'Holy Shield';
    default:            return itemType;
  }
}
