/**
 * Combat system for Road Rash 2D.
 *
 * Handles melee attacks between riders, crash triggering, and crash recovery.
 */

import type { Entity } from '@mote/engine';

// ---------------------------------------------------------------------------
// Weapon data
// ---------------------------------------------------------------------------

export interface WeaponData {
  /** Display name. */
  name: string;
  /** Damage dealt per hit. */
  damage: number;
  /** Attack reach in tile-widths (multiplied by 32 for pixels). */
  range: number;
  /** Minimum seconds between attacks. */
  cooldown: number;
  /** Lateral knockback in lane-fractions applied to the target. */
  knockback: number;
}

export const WEAPONS: Record<string, WeaponData> = {
  fist: {
    name: 'Fist',
    damage: 8,
    range: 1.2,
    cooldown: 0.6,
    knockback: 0.15,
  },
  chain: {
    name: 'Chain',
    damage: 15,
    range: 2.0,
    cooldown: 0.8,
    knockback: 0.25,
  },
  bat: {
    name: 'Bat',
    damage: 20,
    range: 1.5,
    cooldown: 1.0,
    knockback: 0.4,
  },
  pipe: {
    name: 'Pipe',
    damage: 18,
    range: 1.8,
    cooldown: 0.9,
    knockback: 0.3,
  },
};

// ---------------------------------------------------------------------------
// Attack execution
// ---------------------------------------------------------------------------

/**
 * Perform a melee attack from `attacker` against `target` using `weapon`.
 *
 * @returns `true` if the hit was successful (target was within range and not
 *          already crashed).
 */
export function performAttack(
  attacker: Entity,
  target: Entity,
  weapon: WeaponData,
): boolean {
  // Cannot attack a crashed rider
  if (target.getField<boolean>('crashed')) return false;

  // Range check (vertical distance in pixels)
  const dy = Math.abs(attacker.y - target.y);
  if (dy > weapon.range * 32) return false;

  // Apply damage
  const currentHealth = target.getField<number>('health') ?? 100;
  const newHealth = Math.max(0, currentHealth - weapon.damage);
  target.setField('health', newHealth);

  // Apply knockback — push target lane toward the outside
  const targetLane = target.getField<number>('lane') ?? 2;
  const attackerLane = attacker.getField<number>('lane') ?? 2;
  const direction = targetLane >= attackerLane ? 1 : -1;
  const newTargetLane = Math.max(0, Math.min(4, targetLane + direction * weapon.knockback));
  target.setField('lane', newTargetLane);
  target.setField('targetLane', Math.round(newTargetLane));

  // Small speed loss on the target
  const speed = target.getField<number>('currentSpeed') ?? 0;
  target.setField('currentSpeed', Math.max(0, speed * 0.9));

  // Crash if health depleted
  if (newHealth <= 0) {
    triggerCrash(target);
  }

  return true;
}

// ---------------------------------------------------------------------------
// Crash system
// ---------------------------------------------------------------------------

/** Duration of crash state in seconds. */
const CRASH_DURATION = 3.0;

/**
 * Check whether the entity should enter a crash state (health <= 0 and not
 * already crashed).
 */
export function checkCrash(entity: Entity): boolean {
  const health = entity.getField<number>('health') ?? 0;
  const crashed = entity.getField<boolean>('crashed') ?? false;
  return health <= 0 && !crashed;
}

/**
 * Put an entity into the crash state: speed drops to zero, crash timer starts,
 * and the `crashed` field is set.
 */
export function triggerCrash(entity: Entity): void {
  entity.setField('crashed', true);
  entity.setField('crashTimer', CRASH_DURATION);
  entity.setField('currentSpeed', 0);
}

/**
 * Tick crash recovery. Returns `true` when the crash timer has elapsed and
 * the entity has recovered (fields are reset).
 *
 * Call this every frame while `entity.getField('crashed')` is true.
 */
export function recoverFromCrash(entity: Entity, dt: number): boolean {
  let timer = entity.getField<number>('crashTimer') ?? 0;
  timer -= dt;
  entity.setField('crashTimer', timer);

  if (timer <= 0) {
    entity.setField('crashed', false);
    entity.setField('crashTimer', 0);
    return true;
  }
  return false;
}
