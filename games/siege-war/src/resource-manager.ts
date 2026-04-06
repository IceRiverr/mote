/**
 * ResourceManager -- 资源管理系统
 *
 * Manages the five resource types for both attacker and defender sides:
 * Gold (金币), Wood (木材), Stone (石材), Oil (火油), Food (粮食).
 *
 * Responsibilities:
 * - Track current resource levels
 * - Validate and execute resource spending (canAfford / spend)
 * - Apply per-round consumption (food for troops, oil decay, etc.)
 * - Apply skill-based modifiers to resource gains
 *
 * Design notes from PRD section 6:
 * - Gold: recruitment / bribery
 * - Wood: siege engines / defensive structures
 * - Stone: wall repair / trebuchet ammo
 * - Oil: fire attacks (defender-primary, attacker via capture)
 * - Food: troop sustenance per round; starvation = morale drain
 */

import { EventEmitter } from './command-system';

// ── Resource Types ──────────────────────────────────────────────────────────

export enum ResourceType {
  Gold  = 'gold',
  Wood  = 'wood',
  Stone = 'stone',
  Oil   = 'oil',
  Food  = 'food',
}

/**
 * A snapshot of all five resource values.
 * All values are non-negative numbers.
 */
export interface ResourceState {
  gold: number;
  wood: number;
  stone: number;
  oil: number;
  food: number;
}

/**
 * Per-round consumption configuration.
 * Different for attacker vs defender.
 */
export interface ConsumptionConfig {
  /** Food consumed per soldier per round. */
  foodPerSoldier: number;
  /** Oil evaporation/usage per round (defender only). */
  oilDecayPerRound: number;
  /** Wood consumed for maintaining siege engines per round (attacker only). */
  woodMaintenancePerRound: number;
}

/**
 * Skill modifiers that affect resource gains.
 */
export interface SkillModifiers {
  /** Resource gain multiplier (e.g., 屯田 = 1.2 for food). */
  foodGainMultiplier: number;
  /** Gold income multiplier (e.g., 理财 = 1.15). */
  goldGainMultiplier: number;
  /** Stone gathering multiplier. */
  stoneGainMultiplier: number;
  /** Wood gathering multiplier. */
  woodGainMultiplier: number;
  /** Oil production multiplier. */
  oilGainMultiplier: number;
}

/** Default skill modifiers (no bonuses). */
const DEFAULT_SKILL_MODIFIERS: SkillModifiers = {
  foodGainMultiplier: 1.0,
  goldGainMultiplier: 1.0,
  stoneGainMultiplier: 1.0,
  woodGainMultiplier: 1.0,
  oilGainMultiplier: 1.0,
};

/** Default per-round consumption for defender. */
const DEFENDER_CONSUMPTION: ConsumptionConfig = {
  foodPerSoldier: 0.5,
  oilDecayPerRound: 2,
  woodMaintenancePerRound: 0,
};

/** Default per-round consumption for attacker. */
const ATTACKER_CONSUMPTION: ConsumptionConfig = {
  foodPerSoldier: 0.6,       // Attacker troops eat slightly more (supply line stress)
  oilDecayPerRound: 0,
  woodMaintenancePerRound: 5, // Siege engine upkeep
};

// ── ResourceManager ─────────────────────────────────────────────────────────

/**
 * ResourceManager tracks and manipulates the five resource types for one side
 * of the battle.
 *
 * Events emitted:
 * - `resource:changed`    -- any resource value changed ({ type, oldValue, newValue })
 * - `resource:depleted`   -- a resource hit zero ({ type })
 * - `resource:insufficient` -- a spend attempt failed ({ costs, available })
 */
export class ResourceManager {
  /** Current resource levels. */
  private resources: ResourceState;

  /** Active skill modifiers affecting resource gains. */
  private skillModifiers: SkillModifiers;

  /** Event bus for cross-system notifications. */
  public readonly events: EventEmitter = new EventEmitter();

  constructor(initial?: Partial<ResourceState>) {
    this.resources = {
      gold: initial?.gold ?? 100,
      wood: initial?.wood ?? 100,
      stone: initial?.stone ?? 100,
      oil: initial?.oil ?? 50,
      food: initial?.food ?? 200,
    };
    this.skillModifiers = { ...DEFAULT_SKILL_MODIFIERS };
  }

  // ── Query ───────────────────────────────────────────────────────────────

  /**
   * Check whether the current resources can cover a set of costs.
   */
  canAfford(costs: Partial<ResourceState>): boolean {
    if (costs.gold !== undefined && this.resources.gold < costs.gold) return false;
    if (costs.wood !== undefined && this.resources.wood < costs.wood) return false;
    if (costs.stone !== undefined && this.resources.stone < costs.stone) return false;
    if (costs.oil !== undefined && this.resources.oil < costs.oil) return false;
    if (costs.food !== undefined && this.resources.food < costs.food) return false;
    return true;
  }

  /**
   * Attempt to spend resources. Returns false if insufficient (no partial spend).
   */
  spend(costs: Partial<ResourceState>): boolean {
    if (!this.canAfford(costs)) {
      this.events.emit('resource:insufficient', {
        costs,
        available: this.getSnapshot(),
      });
      return false;
    }

    if (costs.gold !== undefined) this.adjustResource(ResourceType.Gold, -costs.gold);
    if (costs.wood !== undefined) this.adjustResource(ResourceType.Wood, -costs.wood);
    if (costs.stone !== undefined) this.adjustResource(ResourceType.Stone, -costs.stone);
    if (costs.oil !== undefined) this.adjustResource(ResourceType.Oil, -costs.oil);
    if (costs.food !== undefined) this.adjustResource(ResourceType.Food, -costs.food);

    return true;
  }

  /**
   * Add resources (income, loot, supply delivery).
   * Applies active skill modifiers to the amounts.
   */
  earn(amounts: Partial<ResourceState>): void {
    if (amounts.gold !== undefined) {
      this.adjustResource(
        ResourceType.Gold,
        amounts.gold * this.skillModifiers.goldGainMultiplier,
      );
    }
    if (amounts.wood !== undefined) {
      this.adjustResource(
        ResourceType.Wood,
        amounts.wood * this.skillModifiers.woodGainMultiplier,
      );
    }
    if (amounts.stone !== undefined) {
      this.adjustResource(
        ResourceType.Stone,
        amounts.stone * this.skillModifiers.stoneGainMultiplier,
      );
    }
    if (amounts.oil !== undefined) {
      this.adjustResource(
        ResourceType.Oil,
        amounts.oil * this.skillModifiers.oilGainMultiplier,
      );
    }
    if (amounts.food !== undefined) {
      this.adjustResource(
        ResourceType.Food,
        amounts.food * this.skillModifiers.foodGainMultiplier,
      );
    }
  }

  /**
   * Get the current value of a single resource type.
   */
  getResource(type: ResourceType): number {
    return this.resources[type];
  }

  /**
   * Directly set a resource value (for level initialization, cheats, etc.).
   */
  setResource(type: ResourceType, value: number): void {
    const clamped = Math.max(0, value);
    const oldValue = this.resources[type];
    this.resources[type] = clamped;
    if (oldValue !== clamped) {
      this.events.emit('resource:changed', { type, oldValue, newValue: clamped });
      if (clamped === 0 && oldValue > 0) {
        this.events.emit('resource:depleted', { type });
      }
    }
  }

  /**
   * Get a read-only snapshot of all resource values.
   */
  getSnapshot(): Readonly<ResourceState> {
    return { ...this.resources };
  }

  // ── Per-Round Consumption ───────────────────────────────────────────────

  /**
   * Apply automatic per-round resource consumption.
   *
   * Called at the start of each round by PhaseManager.
   *
   * @param side     - 'attacker' or 'defender'
   * @param soldiers - Number of alive soldiers (for food calculation)
   * @returns Object indicating which resources were depleted this round
   */
  consumePerRound(
    side: 'attacker' | 'defender',
    soldiers: number = 50,
  ): { foodDepleted: boolean; oilDepleted: boolean } {
    const config = side === 'defender' ? DEFENDER_CONSUMPTION : ATTACKER_CONSUMPTION;

    // Food consumption: proportional to army size
    const foodCost = config.foodPerSoldier * soldiers;
    const hadFood = this.resources.food > 0;
    this.adjustResource(ResourceType.Food, -foodCost);
    const foodDepleted = hadFood && this.resources.food <= 0;

    // Oil decay (defender only)
    let oilDepleted = false;
    if (config.oilDecayPerRound > 0) {
      const hadOil = this.resources.oil > 0;
      this.adjustResource(ResourceType.Oil, -config.oilDecayPerRound);
      oilDepleted = hadOil && this.resources.oil <= 0;
    }

    // Wood maintenance for siege engines (attacker only)
    if (config.woodMaintenancePerRound > 0) {
      this.adjustResource(ResourceType.Wood, -config.woodMaintenancePerRound);
    }

    if (foodDepleted) {
      this.events.emit('resource:depleted', { type: ResourceType.Food });
    }
    if (oilDepleted) {
      this.events.emit('resource:depleted', { type: ResourceType.Oil });
    }

    return { foodDepleted, oilDepleted };
  }

  // ── Skill Modifiers ─────────────────────────────────────────────────────

  /**
   * Apply skill-based modifiers to resource gain rates.
   *
   * Known skills from the design doc:
   * - 屯田 (Field Cultivation): food gain +20%
   * - 理财 (Financial Management): gold gain +15%
   * - 采石 (Quarrying): stone gain +20%
   * - 伐木 (Logging): wood gain +20%
   * - 炼油 (Oil Refining): oil gain +25%
   */
  applySkillModifiers(skills: Set<string>): void {
    // Reset to defaults first
    this.skillModifiers = { ...DEFAULT_SKILL_MODIFIERS };

    if (skills.has('屯田')) {
      this.skillModifiers.foodGainMultiplier = 1.2;
    }
    if (skills.has('理财')) {
      this.skillModifiers.goldGainMultiplier = 1.15;
    }
    if (skills.has('采石')) {
      this.skillModifiers.stoneGainMultiplier = 1.2;
    }
    if (skills.has('伐木')) {
      this.skillModifiers.woodGainMultiplier = 1.2;
    }
    if (skills.has('炼油')) {
      this.skillModifiers.oilGainMultiplier = 1.25;
    }
  }

  /**
   * Get the current active skill modifiers (for UI display).
   */
  getSkillModifiers(): Readonly<SkillModifiers> {
    return { ...this.skillModifiers };
  }

  /**
   * Reset all resources to given initial values (level restart).
   */
  reset(initial?: Partial<ResourceState>): void {
    this.resources = {
      gold: initial?.gold ?? 100,
      wood: initial?.wood ?? 100,
      stone: initial?.stone ?? 100,
      oil: initial?.oil ?? 50,
      food: initial?.food ?? 200,
    };
    this.skillModifiers = { ...DEFAULT_SKILL_MODIFIERS };
  }

  // ── Internal ────────────────────────────────────────────────────────────

  /**
   * Adjust a resource by a delta amount (positive = gain, negative = spend).
   * Clamps to >= 0. Emits change/depletion events.
   */
  private adjustResource(type: ResourceType, delta: number): void {
    const oldValue = this.resources[type];
    const newValue = Math.max(0, oldValue + delta);
    this.resources[type] = newValue;

    if (oldValue !== newValue) {
      this.events.emit('resource:changed', { type, oldValue, newValue });
      if (newValue === 0 && oldValue > 0) {
        this.events.emit('resource:depleted', { type });
      }
    }
  }
}
