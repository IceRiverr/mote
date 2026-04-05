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

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Maximum lane index (0-based, inclusive). */
const MAX_LANE = 4;

/** How often (seconds) AI re-evaluates its target lane. */
const LANE_CHANGE_INTERVAL_MIN = 1.5;
const LANE_CHANGE_INTERVAL_MAX = 4.0;

/** Vertical pixel distance within which the AI will try to attack the player. */
const ATTACK_RANGE_PX = 64;

/** Lateral lane tolerance for attacks (must be within this many lanes). */
const ATTACK_LANE_RANGE = 1.5;

/** Attack cooldown in seconds. */
const ATTACK_COOLDOWN = 2.0;

/** Natural friction deceleration (km/h per second). */
const FRICTION_DECEL = 10;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function randomBetween(a: number, b: number): number {
  return a + Math.random() * (b - a);
}

// ---------------------------------------------------------------------------
// Script
// ---------------------------------------------------------------------------

/**
 * AI controller for opponent motorcycles.
 *
 * Each opponent has attributes set via entity fields (maxSpeed, acceleration,
 * handling, aggressiveness, skillLevel, color, riderName).
 *
 * Core behaviours:
 *  1. Rubber-banding — speed adjusts relative to the player to keep races
 *     competitive.
 *  2. Lane management — periodically changes lanes to dodge traffic and
 *     hazards, or to approach the player for combat.
 *  3. Combat — attacks the player when close enough, with probability
 *     governed by the aggressiveness stat.
 *  4. Crash recovery — mirrors the player crash system.
 */
export default class OpponentAIScript implements ScriptLifecycle {
  private entity: Entity;
  private ctx: RoadRashContext;

  /** Time until the next lane re-evaluation. */
  private laneChangeTimer: number;

  /** AI attack cooldown timer. */
  private attackCooldown = 0;

  /** Starting world Y for distance calculation. */
  private startY = 0;
  private initialised = false;

  /** Track whether the opponent has finished the race. */
  private finished = false;

  constructor(entity: Entity, engine: unknown) {
    this.entity = entity;
    this.ctx = engine as RoadRashContext;
    this.laneChangeTimer = randomBetween(LANE_CHANGE_INTERVAL_MIN, LANE_CHANGE_INTERVAL_MAX);
  }

  // -----------------------------------------------------------------------
  // Main update
  // -----------------------------------------------------------------------

  update(dt: number): void {
    if (!this.initialised) {
      this.startY = this.entity.y;
      this.initialised = true;
    }

    const raceState = this.ctx.raceState;
    if (!raceState || !raceState.started) return;

    // Already crossed the finish?
    if (this.entity.getField<boolean>('finished')) return;

    // ---------------------------------------------------------------
    // Crash recovery
    // ---------------------------------------------------------------
    if (this.entity.getField<boolean>('crashed')) {
      const recovered = recoverFromCrash(this.entity, dt);
      if (recovered) {
        // Restore a sliver of health
        this.entity.setField('health', 30);
      }
      this.updateFrame();
      return;
    }

    // ---------------------------------------------------------------
    // Read entity fields
    // ---------------------------------------------------------------
    const maxSpeed = this.entity.getField<number>('maxSpeed') ?? 150;
    const acceleration = this.entity.getField<number>('acceleration') ?? 65;
    const handling = this.entity.getField<number>('handling') ?? 5;
    const aggressiveness = this.entity.getField<number>('aggressiveness') ?? 50;
    const skillLevel = this.entity.getField<number>('skillLevel') ?? 50;

    // ---------------------------------------------------------------
    // Rubber-banding
    // ---------------------------------------------------------------
    const playerDist = raceState.playerDistance;
    const myDistancePx = this.startY - this.entity.y;
    const myDistanceRows = Math.max(0, Math.floor(myDistancePx / 32));
    this.entity.setField('distance', myDistanceRows);

    const distanceDiff = playerDist - myDistanceRows; // positive = player ahead

    let speedMultiplier = 1.0;
    if (distanceDiff > 50) {
      // Player is ahead — catch up
      speedMultiplier = 1.0 + (distanceDiff - 50) * 0.003;
    } else if (distanceDiff < -50) {
      // Opponent is ahead — slow down a bit
      speedMultiplier = 1.0 - (-distanceDiff - 50) * 0.002;
    }
    speedMultiplier = clamp(speedMultiplier, 0.7, 1.4);

    // ---------------------------------------------------------------
    // Speed control
    // ---------------------------------------------------------------
    let speed = this.entity.getField<number>('currentSpeed') ?? 0;
    const targetSpeed = maxSpeed * speedMultiplier;

    if (speed < targetSpeed) {
      speed += acceleration * dt;
    } else {
      speed -= FRICTION_DECEL * dt;
    }
    speed = clamp(speed, 0, targetSpeed);
    this.entity.setField('currentSpeed', speed);

    // ---------------------------------------------------------------
    // Lane AI
    // ---------------------------------------------------------------
    this.laneChangeTimer -= dt;
    if (this.laneChangeTimer <= 0) {
      this.evaluateLane(skillLevel);
      this.laneChangeTimer = randomBetween(LANE_CHANGE_INTERVAL_MIN, LANE_CHANGE_INTERVAL_MAX);
    }

    // Smooth interpolation toward target lane
    const currentLane = this.entity.getField<number>('lane') ?? 2;
    const targetLane = this.entity.getField<number>('targetLane') ?? currentLane;
    const { lane: newLane } = interpolateLane(currentLane, targetLane, handling, dt);
    this.entity.setField('lane', newLane);

    // Convert to world X
    const trackCfg = this.ctx.trackConfig;
    const roadCenter = trackCfg ? trackCfg.defaultRoadCenter : 10;
    this.entity.x = laneToWorldX(newLane, roadCenter);

    // ---------------------------------------------------------------
    // Move forward
    // ---------------------------------------------------------------
    const speedPx = kmhToPxPerSec(speed);
    this.entity.y -= speedPx * dt;

    // ---------------------------------------------------------------
    // Combat AI
    // ---------------------------------------------------------------
    this.attackCooldown = Math.max(0, this.attackCooldown - dt);
    if (this.attackCooldown <= 0) {
      this.evaluateAttack(aggressiveness);
    }

    // ---------------------------------------------------------------
    // Finish line check
    // ---------------------------------------------------------------
    if (trackCfg) {
      const finishRow = trackCfg.finishLine;
      const currentRow = worldYToRow(this.entity.y);
      if (currentRow <= finishRow) {
        this.entity.setField('finished', true);
        this.finished = true;
      }
    }

    // ---------------------------------------------------------------
    // Health check
    // ---------------------------------------------------------------
    const hp = this.entity.getField<number>('health') ?? 100;
    if (hp <= 0 && !this.entity.getField<boolean>('crashed')) {
      triggerCrash(this.entity);
    }

    // ---------------------------------------------------------------
    // Sprite frame
    // ---------------------------------------------------------------
    this.updateFrame();
  }

  // -----------------------------------------------------------------------
  // Collision
  // -----------------------------------------------------------------------

  onCollisionEnter(other: Entity): void {
    // Traffic collision handled by traffic-vehicle script.
    // If another bike rams us, take some damage
    if (other.templateId === 'player-bike' || other.templateId === 'opponent-bike') {
      if (this.entity.getField<boolean>('crashed')) return;
      // Minor bump damage
      const hp = this.entity.getField<number>('health') ?? 100;
      this.entity.setField('health', Math.max(0, hp - 5));
    }
  }

  // -----------------------------------------------------------------------
  // Lane evaluation
  // -----------------------------------------------------------------------

  private evaluateLane(skillLevel: number): void {
    const currentLane = Math.round(this.entity.getField<number>('lane') ?? 2);
    let bestLane = currentLane;

    // Higher skill = better lane decisions
    const smartChoice = Math.random() * 100 < skillLevel;

    if (smartChoice) {
      // Try to avoid traffic ahead
      bestLane = this.findSafeLane(currentLane);

      // If the player is within a few rows, consider moving into an adjacent
      // lane for attack opportunities
      const player = this.ctx.player;
      if (player && !player.getField<boolean>('crashed')) {
        const yDist = Math.abs(player.y - this.entity.y);
        if (yDist < ATTACK_RANGE_PX * 3) {
          const playerLane = Math.round(player.getField<number>('lane') ?? 2);
          // Move one lane toward the player
          if (playerLane < currentLane && currentLane > 0) {
            bestLane = currentLane - 1;
          } else if (playerLane > currentLane && currentLane < MAX_LANE) {
            bestLane = currentLane + 1;
          }
        }
      }
    } else {
      // Random lane change
      const shift = Math.random() < 0.5 ? -1 : 1;
      bestLane = clamp(currentLane + shift, 0, MAX_LANE);
    }

    this.entity.setField('targetLane', bestLane);
  }

  /**
   * Scan traffic ahead and find a lane that is not blocked.
   */
  private findSafeLane(currentLane: number): number {
    const traffic = this.ctx.traffic;
    const myY = this.entity.y;
    const lookAhead = 200; // pixels

    // Check each lane for obstacles
    const blocked: boolean[] = [false, false, false, false, false];
    for (const t of traffic) {
      if (!t.visible) continue;
      const tY = t.y;
      // Only look at traffic ahead (lower Y)
      if (tY > myY || tY < myY - lookAhead) continue;
      const tLane = t.getField<number>('lane') ?? 2;
      const laneIdx = clamp(Math.round(tLane), 0, MAX_LANE);
      blocked[laneIdx] = true;
    }

    // Prefer current lane if safe
    if (!blocked[currentLane]) return currentLane;

    // Otherwise pick nearest unblocked
    for (let offset = 1; offset <= MAX_LANE; offset++) {
      if (currentLane - offset >= 0 && !blocked[currentLane - offset]) {
        return currentLane - offset;
      }
      if (currentLane + offset <= MAX_LANE && !blocked[currentLane + offset]) {
        return currentLane + offset;
      }
    }

    return currentLane; // All blocked, stay put
  }

  // -----------------------------------------------------------------------
  // Combat evaluation
  // -----------------------------------------------------------------------

  private evaluateAttack(aggressiveness: number): void {
    const player = this.ctx.player;
    if (!player || player.getField<boolean>('crashed')) return;

    const myY = this.entity.y;
    const pY = player.y;
    const yDist = Math.abs(pY - myY);

    if (yDist > ATTACK_RANGE_PX) return;

    const myLane = this.entity.getField<number>('lane') ?? 2;
    const pLane = player.getField<number>('lane') ?? 2;
    const laneDist = Math.abs(pLane - myLane);

    if (laneDist > ATTACK_LANE_RANGE) return;

    // Probability check based on aggressiveness (0-100)
    if (Math.random() * 100 > aggressiveness) return;

    // Determine attack side relative to the AI
    const side = pLane < myLane ? 'left' : 'right';

    const weaponId = this.entity.getField<string>('weapon') ?? 'fist';
    const weapon = WEAPONS[weaponId] ?? WEAPONS['fist'];
    performAttack(this.entity, player, weapon);

    // Damage flash for player
    this.ctx.damageFlash();

    this.attackCooldown = ATTACK_COOLDOWN;

    // Brief attack animation for this frame
    const color = this.entity.getField<string>('color') ?? 'red';
    const frameId = `opponent_${color}_attack_${side}`;
    this.entity.setFrame(frameId, 'bikes');
  }

  // -----------------------------------------------------------------------
  // Sprite frame
  // -----------------------------------------------------------------------

  private updateFrame(): void {
    const color = this.entity.getField<string>('color') ?? 'red';
    const crashed = this.entity.getField<boolean>('crashed');

    if (crashed) {
      this.entity.setFrame(`opponent_${color}_crash`, 'bikes');
      return;
    }

    // Lean based on lane delta
    const lane = this.entity.getField<number>('lane') ?? 2;
    const target = this.entity.getField<number>('targetLane') ?? lane;
    const diff = target - lane;

    if (diff < -0.15) {
      this.entity.setFrame(`opponent_${color}_lean_left`, 'bikes');
    } else if (diff > 0.15) {
      this.entity.setFrame(`opponent_${color}_lean_right`, 'bikes');
    } else {
      this.entity.setFrame(`opponent_${color}_up`, 'bikes');
    }
  }
}
