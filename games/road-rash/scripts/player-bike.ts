import type { Entity } from '@mote/engine';
import type { ScriptLifecycle } from '@mote/engine';
import type { RoadRashContext } from '../src/engine-context';
import {
  kmhToPxPerSec,
  interpolateLane,
  laneToWorldX,
  worldYToRow,
  rowToWorldY,
  LANE_WIDTH,
} from './physics';
import { WEAPONS, performAttack, recoverFromCrash, triggerCrash } from './combat';
import { getEffectiveStats } from './bike-data';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Crash duration in seconds before the player can resume riding. */
const CRASH_DURATION = 3.0;

/** Nitro drain rate (units per second while active). */
const NITRO_DRAIN_RATE = 25;

/** Nitro speed multiplier (applied to maxSpeed). */
const NITRO_SPEED_MULT = 1.3;

/** Braking deceleration multiplier relative to acceleration. */
const BRAKE_MULT = 2.0;

/** Natural friction deceleration (km/h per second) when not accelerating. */
const FRICTION_DECEL = 15;

/** Attack animation display time in seconds. */
const ATTACK_ANIM_DURATION = 0.35;

/** Maximum number of lanes (0..4). */
const MAX_LANE = 4;

// ---------------------------------------------------------------------------
// Script
// ---------------------------------------------------------------------------

/**
 * Player motorcycle controller.
 *
 * Reads input actions from the RoadRashContext (via InputManager) and drives
 * all player-specific logic: acceleration, braking, lane changes, attacks,
 * nitro boost, crash handling, and sprite-frame selection.
 */
export default class PlayerBikeScript implements ScriptLifecycle {
  private entity: Entity;
  private ctx: RoadRashContext;

  /** Tracks time remaining on the attack animation. */
  private attackAnimTimer = 0;

  /** Which side the last attack went toward ('left' | 'right' | ''). */
  private attackSide: 'left' | 'right' | '' = '';

  /** The starting worldY when the race began, used to compute distance. */
  private startY = 0;

  /** Whether this script has initialised start position. */
  private initialised = false;

  constructor(entity: Entity, engine: unknown) {
    this.entity = entity;
    this.ctx = engine as RoadRashContext;
  }

  // -----------------------------------------------------------------------
  // Main update
  // -----------------------------------------------------------------------

  update(dt: number): void {
    // Lazy-initialise the start position on first tick
    if (!this.initialised) {
      this.startY = this.entity.y;
      this.initialised = true;
    }

    const raceState = this.ctx.raceState;
    if (!raceState || !raceState.started) {
      // Race not started yet — keep bike stationary
      this.updateFrame();
      return;
    }

    // ---------------------------------------------------------------
    // Crash recovery
    // ---------------------------------------------------------------
    if (this.entity.getField<boolean>('crashed')) {
      const recovered = recoverFromCrash(this.entity, dt);
      if (recovered) {
        // Reset health to a small amount so the player can keep going
        const durability = this.entity.getField<number>('durability') ?? 100;
        if ((this.entity.getField<number>('health') ?? 0) <= 0) {
          this.entity.setField('health', Math.round(durability * 0.3));
        }
      }
      this.updateFrame();
      return;
    }

    // ---------------------------------------------------------------
    // Read input
    // ---------------------------------------------------------------
    const input = (this.ctx as unknown as Record<string, unknown>).input as {
      action(name: string): { down: boolean; pressed: boolean; released: boolean };
    };
    if (!input) return;

    const accel = input.action('Accelerate');
    const brake = input.action('Brake');
    const steerL = input.action('SteerLeft');
    const steerR = input.action('SteerRight');
    const atkL = input.action('AttackLeft');
    const atkR = input.action('AttackRight');
    const nitroBtn = input.action('Nitro');

    // ---------------------------------------------------------------
    // Bike stats (may include upgrades)
    // ---------------------------------------------------------------
    const bikeType = this.entity.getField<string>('bikeType') ?? 'street';
    const upgrades = this.ctx.state?.upgrades ?? {};
    const stats = getEffectiveStats(bikeType, upgrades);

    const maxSpeed = stats.maxSpeed;
    const acceleration = stats.acceleration;
    const handling = stats.handling;

    // ---------------------------------------------------------------
    // Nitro
    // ---------------------------------------------------------------
    let nitroActive = this.entity.getField<boolean>('nitroActive') ?? false;
    let nitroFuel = this.entity.getField<number>('nitro') ?? 0;

    if (nitroBtn.down && nitroFuel > 0) {
      nitroActive = true;
      nitroFuel = Math.max(0, nitroFuel - NITRO_DRAIN_RATE * dt);
    } else {
      nitroActive = false;
    }
    this.entity.setField('nitroActive', nitroActive);
    this.entity.setField('nitro', nitroFuel);

    const effectiveMax = nitroActive ? maxSpeed * NITRO_SPEED_MULT : maxSpeed;

    // ---------------------------------------------------------------
    // Speed (acceleration / braking / friction)
    // ---------------------------------------------------------------
    let speed = this.entity.getField<number>('currentSpeed') ?? 0;

    if (accel.down) {
      speed += acceleration * dt;
    } else if (brake.down) {
      speed -= acceleration * BRAKE_MULT * dt;
    } else {
      // Natural friction slow-down
      speed -= FRICTION_DECEL * dt;
    }

    speed = Math.max(0, Math.min(effectiveMax, speed));
    this.entity.setField('currentSpeed', speed);

    // ---------------------------------------------------------------
    // Lane steering
    // ---------------------------------------------------------------
    let targetLane = this.entity.getField<number>('targetLane') ?? 2;

    if (steerL.pressed) {
      targetLane = Math.max(0, targetLane - 1);
    }
    if (steerR.pressed) {
      targetLane = Math.min(MAX_LANE, targetLane + 1);
    }
    this.entity.setField('targetLane', targetLane);

    // Smooth interpolation toward target lane
    const currentLane = this.entity.getField<number>('lane') ?? 2;
    const { lane: newLane, progress } = interpolateLane(
      currentLane,
      targetLane,
      handling,
      dt,
    );
    this.entity.setField('lane', newLane);
    this.entity.setField('laneProgress', progress);

    // Convert lane to world-X
    const trackCfg = this.ctx.trackConfig;
    const roadCenter = trackCfg ? trackCfg.defaultRoadCenter : 10;
    this.entity.x = laneToWorldX(newLane, roadCenter);

    // ---------------------------------------------------------------
    // Position (world Y decreases as the player races forward)
    // ---------------------------------------------------------------
    const speedPx = kmhToPxPerSec(speed);
    this.entity.y -= speedPx * dt;

    // ---------------------------------------------------------------
    // Distance tracking (rows traveled from start)
    // ---------------------------------------------------------------
    const distancePx = this.startY - this.entity.y;
    const distanceRows = Math.max(0, Math.floor(distancePx / 32));
    this.entity.setField('distance', distanceRows);

    // Sync to raceState
    if (raceState) {
      raceState.playerDistance = distanceRows;
      raceState.playerSpeed = speed;
      raceState.playerHealth = this.entity.getField<number>('health') ?? 0;
      raceState.playerNitro = nitroFuel;
      raceState.playerWeapon = this.entity.getField<string>('weapon') ?? 'fist';
    }

    // ---------------------------------------------------------------
    // Attack
    // ---------------------------------------------------------------
    let cooldown = this.entity.getField<number>('attackCooldown') ?? 0;
    cooldown = Math.max(0, cooldown - dt);
    this.entity.setField('attackCooldown', cooldown);

    if (this.attackAnimTimer > 0) {
      this.attackAnimTimer -= dt;
      if (this.attackAnimTimer <= 0) {
        this.attackSide = '';
        this.entity.setField('attackAnim', '');
      }
    }

    if (cooldown <= 0) {
      if (atkL.pressed) {
        this.doAttack('left');
      } else if (atkR.pressed) {
        this.doAttack('right');
      } else if (this.ctx.attackRequested === 'right') {
        this.doAttack('right');
        this.ctx.attackRequested = null; // consume the request
      } else if (this.ctx.attackRequested === 'left') {
        this.doAttack('left');
        this.ctx.attackRequested = null; // consume the request
      }
    }

    // ---------------------------------------------------------------
    // Health check — trigger crash if at zero
    // ---------------------------------------------------------------
    const hp = this.entity.getField<number>('health') ?? 0;
    if (hp <= 0 && !this.entity.getField<boolean>('crashed')) {
      triggerCrash(this.entity);
      this.ctx.damageFlash();
    }

    // ---------------------------------------------------------------
    // Sprite frame
    // ---------------------------------------------------------------
    this.updateFrame();
  }

  // -----------------------------------------------------------------------
  // Combat helper
  // -----------------------------------------------------------------------

  private doAttack(side: 'left' | 'right'): void {
    const weaponId = this.entity.getField<string>('weapon') ?? 'fist';
    const weapon = WEAPONS[weaponId] ?? WEAPONS['fist'];

    // Find nearest opponent on the correct side within range
    const myLane = this.entity.getField<number>('lane') ?? 2;
    const myY = this.entity.y;
    let bestTarget: Entity | null = null;
    let bestDist = Infinity;

    for (const opp of this.ctx.opponents) {
      if (opp.getField<boolean>('crashed')) continue;
      const oppLane = opp.getField<number>('lane') ?? 0;
      const laneDiff = oppLane - myLane;

      // Left attack targets opponents in lanes to the left (lower number)
      if (side === 'left' && laneDiff >= 0) continue;
      if (side === 'right' && laneDiff <= 0) continue;

      // Must be within vertical range (pixels)
      const yDist = Math.abs(opp.y - myY);
      if (yDist > weapon.range * 32) continue;

      // Must be within 1-2 lanes
      if (Math.abs(laneDiff) > 2) continue;

      if (yDist < bestDist) {
        bestDist = yDist;
        bestTarget = opp;
      }
    }

    if (bestTarget) {
      performAttack(this.entity, bestTarget, weapon);
    }

    // Set cooldown and animation regardless of hit
    this.entity.setField('attackCooldown', weapon.cooldown);
    this.attackSide = side;
    this.attackAnimTimer = ATTACK_ANIM_DURATION;
    this.entity.setField('attackAnim', side);
  }

  // -----------------------------------------------------------------------
  // Sprite frame selection
  // -----------------------------------------------------------------------

  private updateFrame(): void {
    const crashed = this.entity.getField<boolean>('crashed');
    const nitroActive = this.entity.getField<boolean>('nitroActive');

    if (crashed) {
      // Alternate between two crash frames
      const timer = this.entity.getField<number>('crashTimer') ?? 0;
      const idx = Math.floor(timer * 3) % 2;
      this.entity.setFrame(idx === 0 ? 'player_crash_1' : 'player_crash_2', 'bikes');
      return;
    }

    if (this.attackSide === 'left') {
      this.entity.setFrame('player_attack_left', 'bikes');
      return;
    }
    if (this.attackSide === 'right') {
      this.entity.setFrame('player_attack_right', 'bikes');
      return;
    }

    if (nitroActive) {
      this.entity.setFrame('player_nitro', 'bikes');
      return;
    }

    // Lean based on lane-change progress
    const lane = this.entity.getField<number>('lane') ?? 2;
    const target = this.entity.getField<number>('targetLane') ?? 2;
    const diff = target - lane;

    if (diff < -0.15) {
      this.entity.setFrame('player_lean_left', 'bikes');
    } else if (diff > 0.15) {
      this.entity.setFrame('player_lean_right', 'bikes');
    } else {
      this.entity.setFrame('player_up', 'bikes');
    }
  }
}
