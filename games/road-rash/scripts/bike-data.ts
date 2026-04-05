/**
 * bike-data.ts — Bike configurations and upgrade system for Road Rash 2D.
 *
 * NOT a ScriptLifecycle class. Exports named types, constants, and functions
 * for bike stats and the upgrade calculation system.
 *
 * Bikes:
 *   street   — balanced starter bike
 *   sport    — fast but fragile
 *   cruiser  — slow, tough, great handling
 *   superbike — fastest, hardest to control, glass cannon
 */

// ── Bike stats interface ────────────────────────────────────────────────────

export interface BikeStats {
  /** Maximum speed in km/h. */
  maxSpeed: number;
  /** Acceleration in km/h per second. */
  acceleration: number;
  /** Handling: lane changes per second. */
  handling: number;
  /** Durability: maximum health points. */
  durability: number;
  /** Base sprite frame prefix (e.g. "player", "sport", "cruiser", "superbike"). */
  sprite: string;
}

// ── Base bike configurations ────────────────────────────────────────────────

export const BIKES: Record<string, BikeStats> = {
  street: {
    maxSpeed: 160,
    acceleration: 70,
    handling: 6,
    durability: 100,
    sprite: 'player',
  },
  sport: {
    maxSpeed: 200,
    acceleration: 90,
    handling: 5,
    durability: 80,
    sprite: 'sport',
  },
  cruiser: {
    maxSpeed: 140,
    acceleration: 60,
    handling: 7,
    durability: 130,
    sprite: 'cruiser',
  },
  superbike: {
    maxSpeed: 220,
    acceleration: 100,
    handling: 4,
    durability: 70,
    sprite: 'superbike',
  },
};

// ── Upgrade system ──────────────────────────────────────────────────────────

/**
 * Per-level upgrade bonuses for each stat.
 * Each upgrade level adds this much to the base stat.
 */
const UPGRADE_BONUSES: Record<string, number> = {
  speed: 8,          // +8 km/h per level
  acceleration: 5,   // +5 km/h/s per level
  handling: 0.4,     // +0.4 lane changes/s per level
  durability: 10,    // +10 HP per level
};

/** Maximum upgrade level for each stat. */
export const MAX_UPGRADE_LEVEL = 5;

/**
 * Cost to purchase an upgrade at a given level (1-indexed).
 * Costs increase exponentially.
 */
export function getUpgradeCost(currentLevel: number): number {
  if (currentLevel >= MAX_UPGRADE_LEVEL) return Infinity;
  const baseCost = 1000;
  const nextLevel = currentLevel + 1;
  return baseCost * nextLevel * nextLevel;
}

/**
 * Calculate effective bike stats after applying upgrades.
 *
 * @param bikeType - Bike type key ("street", "sport", etc.)
 * @param upgrades - Current upgrade levels { speed: 0-5, acceleration: 0-5, handling: 0-5, durability: 0-5 }
 * @returns Final BikeStats with upgrades applied
 */
export function getEffectiveStats(
  bikeType: string,
  upgrades: Record<string, number>,
): BikeStats {
  const base = BIKES[bikeType];
  if (!base) {
    // Unknown bike type — fall back to street
    return { ...BIKES['street'] };
  }

  const speedLevel = Math.min(upgrades['speed'] ?? 0, MAX_UPGRADE_LEVEL);
  const accelLevel = Math.min(upgrades['acceleration'] ?? 0, MAX_UPGRADE_LEVEL);
  const handlingLevel = Math.min(upgrades['handling'] ?? 0, MAX_UPGRADE_LEVEL);
  const durabilityLevel = Math.min(upgrades['durability'] ?? 0, MAX_UPGRADE_LEVEL);

  return {
    maxSpeed: base.maxSpeed + speedLevel * UPGRADE_BONUSES['speed'],
    acceleration: base.acceleration + accelLevel * UPGRADE_BONUSES['acceleration'],
    handling: base.handling + handlingLevel * UPGRADE_BONUSES['handling'],
    durability: base.durability + durabilityLevel * UPGRADE_BONUSES['durability'],
    sprite: base.sprite,
  };
}

// ── Bike info helpers ───────────────────────────────────────────────────────

/**
 * Get all available bike type keys.
 */
export function getBikeTypes(): string[] {
  return Object.keys(BIKES);
}

/**
 * Get base stats for a bike type (no upgrades).
 */
export function getBaseStats(bikeType: string): BikeStats | undefined {
  return BIKES[bikeType] ? { ...BIKES[bikeType] } : undefined;
}

/**
 * Get the sprite frame ID for a bike in its upright/forward position.
 *
 * @param bikeType - Bike type key
 * @returns Frame ID in the "bikes" sprite sheet (e.g. "player_up", "sport_up")
 */
export function getBikeFrameId(bikeType: string): string {
  const bike = BIKES[bikeType];
  if (!bike) return 'player_up';
  return `${bike.sprite}_up`;
}

/**
 * Get the lean frame ID for a bike turning in a direction.
 *
 * @param bikeType - Bike type key
 * @param direction - "left" or "right"
 * @returns Frame ID (e.g. "player_lean_left")
 */
export function getLeanFrameId(bikeType: string, direction: 'left' | 'right'): string {
  const bike = BIKES[bikeType];
  if (!bike) return `player_lean_${direction}`;
  return `${bike.sprite}_lean_${direction}`;
}

/**
 * Calculate the purchase price for a bike.
 */
export function getBikePrice(bikeType: string): number {
  const prices: Record<string, number> = {
    street: 0,       // starter, free
    sport: 10000,
    cruiser: 8000,
    superbike: 25000,
  };
  return prices[bikeType] ?? 0;
}

// ── Opponent stat scaling ───────────────────────────────────────────────────

/**
 * Generate opponent bike stats with slight randomization based on
 * skill level and aggressiveness from the track config.
 *
 * @param maxSpeed - Base max speed from track config
 * @param acceleration - Base acceleration from track config
 * @param skillLevel - Skill level 0-100 (affects consistency)
 * @param aggressiveness - Aggressiveness 0-100 (affects attack frequency)
 * @returns Effective stats for the opponent
 */
export function getOpponentStats(
  maxSpeed: number,
  acceleration: number,
  skillLevel: number,
  aggressiveness: number,
): {
  maxSpeed: number;
  acceleration: number;
  handling: number;
  attackChance: number;
  laneChangeFrequency: number;
} {
  // Skill level influences stat consistency (higher skill = closer to max)
  const skillFactor = skillLevel / 100;

  // Slight randomization: +/- 5% of base stats
  const variance = 0.05;
  const speedMod = 1 + (Math.random() * 2 - 1) * variance * (1 - skillFactor);
  const accelMod = 1 + (Math.random() * 2 - 1) * variance * (1 - skillFactor);

  // Handling derived from skill (5-8 range)
  const handling = 5 + skillFactor * 3;

  // Attack chance per second (0.0 to 0.5 based on aggressiveness)
  const attackChance = (aggressiveness / 100) * 0.5;

  // Lane change frequency: more aggressive riders change lanes more often
  const laneChangeFrequency = 0.5 + (aggressiveness / 100) * 1.5;

  return {
    maxSpeed: Math.round(maxSpeed * speedMod),
    acceleration: Math.round(acceleration * accelMod),
    handling,
    attackChance,
    laneChangeFrequency,
  };
}
