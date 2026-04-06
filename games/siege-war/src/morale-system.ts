/**
 * MoraleSystem -- 士气系统
 *
 * Morale is the core victory/defeat condition in Siege War:
 * - Defender morale = 0 --> 开城投降 (open gates, surrender)
 * - Attacker morale = 0 --> 撤围 (lift siege, retreat)
 *
 * Two tiers of morale:
 * 1. **Global morale** (per side): affects the entire army. Triggers game end.
 * 2. **Unit morale** (per unit ID): affects individual unit behavior.
 *    Units with morale < 20 may rout (溃散) if no officer is present.
 *
 * Design reference: PRD section 6.3
 * - Wall breached: defender morale drops sharply
 * - Wave repelled: defender morale recovers
 * - Heavy casualties: attacker morale drops
 * - Officer killed: unit morale plummets, global morale drops moderately
 * - Officers stabilize nearby unit morale
 */

import { EventEmitter } from './command-system';

// ── Morale Events ───────────────────────────────────────────────────────────

/**
 * Events that cause morale changes.
 * Each event has specific delta values defined in MORALE_DELTAS.
 */
export enum MoraleEvent {
  /** A wall segment was breached (城墙被破). */
  WallBreached     = 'wall_breached',
  /** An attack wave was repelled (击退攻势). */
  WaveRepelled     = 'wave_repelled',
  /** Heavy casualties suffered in a short period (重大伤亡). */
  HeavyCasualties  = 'heavy_casualties',
  /** An officer was killed (军官阵亡). */
  OfficerKilled    = 'officer_killed',
  /** The main gate was breached (城门被破). */
  GateBreached     = 'gate_breached',
  /** A sortie mission succeeded (出城突袭成功). */
  SortieSuccess    = 'sortie_success',
  /** A tunnel reached its target successfully (地道成功). */
  TunnelSuccess    = 'tunnel_success',
  /** A tunnel was discovered and destroyed (地道失败). */
  TunnelFailed     = 'tunnel_failed',
}

/**
 * Morale delta configuration for each event.
 * Positive = morale gain, negative = morale loss.
 * `defender` and `attacker` deltas are applied to the respective sides.
 */
interface MoraleDelta {
  defender: number;
  attacker: number;
  /** Optional per-unit delta for the directly affected unit. */
  unitDelta?: number;
}

/**
 * Predefined morale impact values for each event type.
 * Tuned to match PRD descriptions.
 */
const MORALE_DELTAS: Record<MoraleEvent, MoraleDelta> = {
  [MoraleEvent.WallBreached]: {
    defender: -15,    // Defender morale drops sharply
    attacker: +10,    // Attacker gains confidence
    unitDelta: -10,   // Nearby defender units are shaken
  },
  [MoraleEvent.WaveRepelled]: {
    defender: +8,     // Defender rallies
    attacker: -6,     // Attacker discouraged
  },
  [MoraleEvent.HeavyCasualties]: {
    defender: 0,      // Depends on which side; applied via params
    attacker: -12,    // Default: attacker suffers
    unitDelta: -15,   // Unit that took casualties is demoralized
  },
  [MoraleEvent.OfficerKilled]: {
    defender: -5,     // Moderate global impact
    attacker: -5,     // Same for either side
    unitDelta: -25,   // Devastating to the officer's own unit
  },
  [MoraleEvent.GateBreached]: {
    defender: -20,    // Major psychological blow
    attacker: +15,    // Massive attacker boost
    unitDelta: -15,   // Gate defenders are shaken
  },
  [MoraleEvent.SortieSuccess]: {
    defender: +10,    // Bold success lifts spirits
    attacker: -8,     // Attacker surprised and demoralized
  },
  [MoraleEvent.TunnelSuccess]: {
    defender: -12,    // Unexpected threat from underground
    attacker: +10,    // Tunnel engineers celebrate
  },
  [MoraleEvent.TunnelFailed]: {
    defender: +5,     // Relief
    attacker: -8,     // Wasted effort and lives
    unitDelta: -20,   // Tunnel crew morale crushed
  },
};

// ── Natural Morale Recovery / Decay Constants ───────────────────────────────

/** Points per second of natural morale recovery when above 30. */
const NATURAL_RECOVERY_RATE = 0.3;

/** Points per second of morale decay when food is depleted (starvation). */
const STARVATION_DECAY_RATE = 1.5;

/** Points per second that an officer stabilizes nearby unit morale. */
const OFFICER_STABILIZE_RATE = 0.8;

/** Morale threshold below which a unit may rout. */
const ROUT_THRESHOLD = 20;

/** Morale floor for units with an officer present (officer prevents total collapse). */
const OFFICER_MORALE_FLOOR = 15;

// ── MoraleSystem ────────────────────────────────────────────────────────────

/**
 * MoraleSystem tracks global army morale for both sides and per-unit morale
 * for individual squads. It provides the primary victory/defeat conditions.
 *
 * Events emitted:
 * - `morale:changed`         -- global morale changed ({ side, oldValue, newValue })
 * - `morale:unit_changed`    -- unit morale changed ({ unitId, oldValue, newValue })
 * - `morale:unit_rout`       -- unit started routing ({ unitId, morale })
 * - `morale:defender_defeat`  -- defender morale hit 0
 * - `morale:attacker_defeat`  -- attacker morale hit 0
 */
export class MoraleSystem {
  /** Global defender morale (0-100). */
  private defenderMorale: number = 100;

  /** Global attacker morale (0-100). */
  private attackerMorale: number = 100;

  /** Per-unit morale keyed by unit ID (0-100). */
  private unitMorale: Map<string, number> = new Map();

  /** Set of unit IDs that currently have a living officer. */
  private officerAliveUnits: Set<string> = new Set();

  /** Whether food is depleted for each side (triggers starvation decay). */
  private defenderStarving: boolean = false;
  private attackerStarving: boolean = false;

  /** Cross-system event bus. */
  public readonly events: EventEmitter = new EventEmitter();

  // ── Initialization ──────────────────────────────────────────────────────

  constructor(
    defenderMorale: number = 100,
    attackerMorale: number = 100,
  ) {
    this.defenderMorale = clamp(defenderMorale, 0, 100);
    this.attackerMorale = clamp(attackerMorale, 0, 100);
  }

  /**
   * Register a unit with initial morale (called when unit is spawned).
   */
  registerUnit(unitId: string, initialMorale: number = 80): void {
    this.unitMorale.set(unitId, clamp(initialMorale, 0, 100));
  }

  /**
   * Remove a unit from tracking (called when unit is destroyed/recycled).
   */
  unregisterUnit(unitId: string): void {
    this.unitMorale.delete(unitId);
    this.officerAliveUnits.delete(unitId);
  }

  // ── Event Application ───────────────────────────────────────────────────

  /**
   * Apply a morale event with optional parameters.
   *
   * @param event  - The morale event type
   * @param params - Optional overrides:
   *   - `side`: 'attacker'|'defender' -- which side is *affected* (for asymmetric events)
   *   - `unitId`: string -- specific unit affected (receives unitDelta)
   *   - `multiplier`: number -- scale the delta (e.g., 1.5 for critical breach)
   */
  applyEvent(
    event: MoraleEvent,
    params?: {
      side?: 'attacker' | 'defender';
      unitId?: string;
      multiplier?: number;
    },
  ): void {
    const delta = MORALE_DELTAS[event];
    const multiplier = params?.multiplier ?? 1.0;

    // Apply global morale changes
    // For HeavyCasualties and OfficerKilled, `params.side` determines who is affected
    if (params?.side === 'defender') {
      // Event primarily affects defender
      this.adjustDefenderMorale(delta.defender * multiplier);
      // Attacker gets the opposite-side effect (if any, the other side's delta)
      if (delta.attacker !== 0) {
        this.adjustAttackerMorale(delta.attacker * multiplier);
      }
    } else if (params?.side === 'attacker') {
      // Event primarily affects attacker
      this.adjustAttackerMorale(delta.attacker * multiplier);
      if (delta.defender !== 0) {
        this.adjustDefenderMorale(delta.defender * multiplier);
      }
    } else {
      // Default: apply both sides as defined
      this.adjustDefenderMorale(delta.defender * multiplier);
      this.adjustAttackerMorale(delta.attacker * multiplier);
    }

    // Apply per-unit morale delta if a specific unit is targeted
    if (params?.unitId && delta.unitDelta !== undefined) {
      const oldUnit = this.getUnitMorale(params.unitId);
      const newUnit = clamp(oldUnit + delta.unitDelta * multiplier, 0, 100);
      this.setUnitMorale(params.unitId, newUnit);
    }
  }

  // ── Per-Frame Update ────────────────────────────────────────────────────

  /**
   * Called once per frame to apply natural morale recovery/decay.
   *
   * @param dt - Delta time in seconds.
   */
  update(dt: number): void {
    // Global morale: natural recovery toward 50 (equilibrium)
    this.defenderMorale = this.tickGlobalMorale(
      this.defenderMorale,
      this.defenderStarving,
      dt,
    );
    this.attackerMorale = this.tickGlobalMorale(
      this.attackerMorale,
      this.attackerStarving,
      dt,
    );

    // Per-unit morale: officer stabilization and natural drift
    for (const [unitId, morale] of this.unitMorale) {
      let newMorale = morale;
      const hasOfficer = this.officerAliveUnits.has(unitId);

      if (hasOfficer) {
        // Officer present: slowly pull unit morale toward global average
        // and enforce a floor to prevent total collapse
        const globalAvg = (this.defenderMorale + this.attackerMorale) / 2;
        const target = Math.max(OFFICER_MORALE_FLOOR, globalAvg);
        if (newMorale < target) {
          newMorale = Math.min(target, newMorale + OFFICER_STABILIZE_RATE * dt);
        }
      } else {
        // No officer: slow natural recovery if above 30, slow decay if below 30
        if (newMorale > 30 && newMorale < 80) {
          // Mild drift toward 50
          const drift = newMorale > 50 ? -0.1 : 0.1;
          newMorale += drift * dt;
        } else if (newMorale < 30) {
          // Below 30 with no officer: continue slow decay
          newMorale -= 0.2 * dt;
        }
      }

      newMorale = clamp(newMorale, 0, 100);
      if (newMorale !== morale) {
        this.unitMorale.set(unitId, newMorale);
      }
    }

    // Check defeat conditions
    if (this.defenderMorale <= 0) {
      this.events.emit('morale:defender_defeat');
    }
    if (this.attackerMorale <= 0) {
      this.events.emit('morale:attacker_defeat');
    }
  }

  // ── Unit Morale Accessors ───────────────────────────────────────────────

  /**
   * Get morale for a specific unit. Returns 50 (neutral) if unregistered.
   */
  getUnitMorale(unitId: string): number {
    return this.unitMorale.get(unitId) ?? 50;
  }

  /**
   * Directly set morale for a specific unit.
   */
  setUnitMorale(unitId: string, value: number): void {
    const clamped = clamp(value, 0, 100);
    const oldValue = this.unitMorale.get(unitId) ?? 50;
    this.unitMorale.set(unitId, clamped);
    if (oldValue !== clamped) {
      this.events.emit('morale:unit_changed', {
        unitId,
        oldValue,
        newValue: clamped,
      });
    }
  }

  // ── Global Morale Accessors ─────────────────────────────────────────────

  getDefenderMorale(): number {
    return this.defenderMorale;
  }

  getAttackerMorale(): number {
    return this.attackerMorale;
  }

  setDefenderMorale(value: number): void {
    this.defenderMorale = clamp(value, 0, 100);
  }

  setAttackerMorale(value: number): void {
    this.attackerMorale = clamp(value, 0, 100);
  }

  // ── Victory / Defeat Conditions ─────────────────────────────────────────

  /**
   * Defender morale <= 0 means the city surrenders (开城投降).
   */
  isDefenderDefeated(): boolean {
    return this.defenderMorale <= 0;
  }

  /**
   * Attacker morale <= 0 means the siege is lifted (撤围).
   */
  isAttackerDefeated(): boolean {
    return this.attackerMorale <= 0;
  }

  // ── Officer Effects ─────────────────────────────────────────────────────

  /**
   * Set whether an officer is alive for a given unit.
   *
   * When alive:
   * - Unit morale is stabilized (won't drop below OFFICER_MORALE_FLOOR)
   * - Natural recovery is faster
   *
   * When killed:
   * - Unit morale decays faster
   * - Unit may rout if morale < 20
   */
  applyOfficerEffect(unitId: string, officerAlive: boolean): void {
    if (officerAlive) {
      this.officerAliveUnits.add(unitId);
    } else {
      this.officerAliveUnits.delete(unitId);
    }
  }

  /**
   * Check whether a unit meets rout conditions.
   *
   * A unit routs (溃散) when:
   * 1. Its morale is below the ROUT_THRESHOLD (20), AND
   * 2. It has no living officer to keep order.
   *
   * Routed units abandon their position and flee toward the rear.
   */
  checkRoutCondition(unitId: string): boolean {
    const morale = this.getUnitMorale(unitId);
    const hasOfficer = this.officerAliveUnits.has(unitId);

    if (morale < ROUT_THRESHOLD && !hasOfficer) {
      this.events.emit('morale:unit_rout', { unitId, morale });
      return true;
    }
    return false;
  }

  // ── Starvation Flag ─────────────────────────────────────────────────────

  /**
   * Set starvation state for a side (called by ResourceManager when food = 0).
   * Starvation causes accelerated morale decay.
   */
  setStarvation(side: 'attacker' | 'defender', starving: boolean): void {
    if (side === 'defender') {
      this.defenderStarving = starving;
    } else {
      this.attackerStarving = starving;
    }
  }

  // ── Reset ───────────────────────────────────────────────────────────────

  /**
   * Reset the entire morale system (level restart).
   */
  reset(defenderMorale: number = 100, attackerMorale: number = 100): void {
    this.defenderMorale = clamp(defenderMorale, 0, 100);
    this.attackerMorale = clamp(attackerMorale, 0, 100);
    this.unitMorale.clear();
    this.officerAliveUnits.clear();
    this.defenderStarving = false;
    this.attackerStarving = false;
  }

  // ── Internal ────────────────────────────────────────────────────────────

  /**
   * Tick global morale for one side.
   * - Natural recovery: slowly pulls morale toward 50 when above 30.
   * - Starvation: accelerated decay when food is depleted.
   */
  private tickGlobalMorale(
    current: number,
    starving: boolean,
    dt: number,
  ): number {
    let morale = current;

    if (starving) {
      // Starvation: constant morale drain
      morale -= STARVATION_DECAY_RATE * dt;
    } else if (morale < 50) {
      // Below equilibrium: slow natural recovery
      morale += NATURAL_RECOVERY_RATE * dt;
    } else if (morale > 80) {
      // Above 80: very slow decay back toward equilibrium (overconfidence fades)
      morale -= NATURAL_RECOVERY_RATE * 0.3 * dt;
    }

    return clamp(morale, 0, 100);
  }

  /**
   * Adjust defender morale by a delta, clamped to [0, 100].
   * Emits morale:changed event.
   */
  private adjustDefenderMorale(delta: number): void {
    const old = this.defenderMorale;
    this.defenderMorale = clamp(old + delta, 0, 100);
    if (old !== this.defenderMorale) {
      this.events.emit('morale:changed', {
        side: 'defender',
        oldValue: old,
        newValue: this.defenderMorale,
      });
    }
  }

  /**
   * Adjust attacker morale by a delta, clamped to [0, 100].
   * Emits morale:changed event.
   */
  private adjustAttackerMorale(delta: number): void {
    const old = this.attackerMorale;
    this.attackerMorale = clamp(old + delta, 0, 100);
    if (old !== this.attackerMorale) {
      this.events.emit('morale:changed', {
        side: 'attacker',
        oldValue: old,
        newValue: this.attackerMorale,
      });
    }
  }
}

// ── Utility ─────────────────────────────────────────────────────────────────

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
