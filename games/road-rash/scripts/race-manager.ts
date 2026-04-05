import type { Entity } from '@mote/engine';
import { CollisionSystem } from '@mote/engine';
import type { ScriptLifecycle, AABB } from '@mote/engine';
import type { RoadRashContext } from '../src/engine-context';
import {
  kmhToPxPerSec,
  laneToWorldX,
  worldYToRow,
  rowToWorldY,
  TILE_SIZE,
} from './physics';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Countdown length in seconds (3-2-1-GO). */
const COUNTDOWN_SECONDS = 4;

/** Time between traffic spawn attempts (seconds). */
const TRAFFIC_SPAWN_INTERVAL = 2.0;

/** How far ahead (in pixels) to spawn traffic relative to the player. */
const TRAFFIC_SPAWN_AHEAD = 800;

/** How far behind (pixels) before traffic is recycled. */
const TRAFFIC_RECYCLE_BEHIND = 600;

/** Maximum simultaneous traffic entities. */
const MAX_TRAFFIC = 12;

/** Vehicle types and their corresponding sprite directions. */
const VEHICLE_TYPES = ['sedan', 'truck', 'bus', 'van'] as const;

/** Maximum lane index. */
const MAX_LANE = 4;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomChoice<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------------
// Script
// ---------------------------------------------------------------------------

/**
 * Race lifecycle manager.
 *
 * Attached to an invisible "race-controller" entity, this script orchestrates:
 * 1. Pre-race countdown
 * 2. Active-race traffic spawning, position tracking, collision dispatch
 * 3. Finish-line detection and result display
 */
export default class RaceManagerScript implements ScriptLifecycle {
  private entity: Entity;
  private ctx: RoadRashContext;

  /** Timer for traffic spawn rhythm. */
  private trafficSpawnTimer = 0;

  /** Set of entity-id pairs that have already collided this frame, to avoid duplicates. */
  private collisionPairsThisFrame = new Set<string>();

  /** Finish order: array of rider name / templateId as they cross the line. */
  private finishOrder: string[] = [];

  /** Whether we already showed the result screen. */
  private resultShown = false;

  constructor(entity: Entity, engine: unknown) {
    this.entity = entity;
    this.ctx = engine as RoadRashContext;
  }

  // -----------------------------------------------------------------------
  // Main update
  // -----------------------------------------------------------------------

  update(dt: number): void {
    const raceState = this.ctx.raceState;
    if (!raceState) return;

    // =================================================================
    // PHASE 1 — Countdown
    // =================================================================
    if (!raceState.started) {
      let cd = this.entity.getField<number>('countdown') ?? COUNTDOWN_SECONDS;
      cd -= dt;
      this.entity.setField('countdown', cd);

      // Show countdown number (or GO!)
      this.ctx.showCountdown(cd);

      if (cd <= 0) {
        raceState.started = true;
        this.entity.setField('raceStarted', true);
      }
      return;
    }

    // =================================================================
    // PHASE 3 — Already finished
    // =================================================================
    if (raceState.finished) {
      return;
    }

    // =================================================================
    // PHASE 2 — Active race
    // =================================================================
    raceState.raceTime += dt;
    this.entity.setField('raceTime', raceState.raceTime);

    // --- Traffic spawning / recycling ---
    this.manageTraffic(dt);

    // --- Position ranking ---
    this.updatePositions();

    // --- Collision detection ---
    this.runCollisions();

    // --- Finish line checks ---
    this.checkFinish();
  }

  // -----------------------------------------------------------------------
  // Traffic management
  // -----------------------------------------------------------------------

  private manageTraffic(dt: number): void {
    const player = this.ctx.player;
    if (!player) return;

    const density = this.entity.getField<number>('trafficDensity') ?? 0.3;
    const trackCfg = this.ctx.trackConfig;
    const roadCenter = trackCfg ? trackCfg.defaultRoadCenter : 10;

    // Recycle traffic that is too far behind the player
    const toRecycle: Entity[] = [];
    for (const t of this.ctx.traffic) {
      if (t.y > player.y + TRAFFIC_RECYCLE_BEHIND) {
        toRecycle.push(t);
      }
      // Also recycle traffic that somehow got way ahead
      if (t.y < player.y - TRAFFIC_SPAWN_AHEAD * 1.5) {
        toRecycle.push(t);
      }
    }
    for (const t of toRecycle) {
      t.visible = false;
      this.ctx.spawner.recycle(t);
      const idx = this.ctx.traffic.indexOf(t);
      if (idx !== -1) this.ctx.traffic.splice(idx, 1);
    }

    // Spawn new traffic on a timer
    this.trafficSpawnTimer -= dt;
    if (this.trafficSpawnTimer <= 0) {
      this.trafficSpawnTimer = TRAFFIC_SPAWN_INTERVAL;

      if (this.ctx.traffic.length < MAX_TRAFFIC && Math.random() < density) {
        this.spawnTrafficVehicle(player, roadCenter);
      }
    }
  }

  private spawnTrafficVehicle(player: Entity, roadCenter: number): void {
    const lane = randomInt(0, MAX_LANE);
    const direction = Math.random() < 0.6 ? 'up' : 'down';
    const vehicleType = randomChoice(VEHICLE_TYPES);
    const speedKmh = direction === 'up' ? randomInt(40, 80) : randomInt(50, 90);

    // Spawn ahead of the player
    const spawnOffset = randomInt(400, TRAFFIC_SPAWN_AHEAD);
    const spawnY = player.y - spawnOffset;
    const spawnX = laneToWorldX(lane, roadCenter);

    const fields: Record<string, unknown> = {
      vehicleType,
      speed: speedKmh,
      direction,
      lane,
    };

    const trafficEntity = this.ctx.spawner.spawn('traffic-vehicle', spawnX, spawnY, fields);
    if (trafficEntity) {
      // Set the correct sprite frame
      const frameId = direction === 'up' ? `${vehicleType}_up` : `${vehicleType}_down`;
      trafficEntity.setFrame(frameId, 'vehicles');
      this.ctx.traffic.push(trafficEntity);
    }
  }

  // -----------------------------------------------------------------------
  // Position ranking
  // -----------------------------------------------------------------------

  private updatePositions(): void {
    const raceState = this.ctx.raceState;
    if (!raceState) return;

    const player = this.ctx.player;
    if (!player) return;

    // Collect all rider distances (lower Y = further ahead = more distance)
    const riders: { name: string; distance: number; isPlayer: boolean }[] = [];

    const playerDist = player.getField<number>('distance') ?? 0;
    riders.push({ name: 'Player', distance: playerDist, isPlayer: true });

    for (const opp of this.ctx.opponents) {
      const dist = opp.getField<number>('distance') ?? 0;
      riders.push({ name: opp.name, distance: dist, isPlayer: false });
    }

    // Sort by distance descending (most distance = best position)
    riders.sort((a, b) => b.distance - a.distance);

    // Find player position (1-based)
    const playerPos = riders.findIndex(r => r.isPlayer) + 1;
    raceState.playerPosition = playerPos;
    this.entity.setField('playerPosition', playerPos);

    // Store opponent distances for the race state
    raceState.opponentDistances = this.ctx.opponents.map(
      o => o.getField<number>('distance') ?? 0,
    );
  }

  // -----------------------------------------------------------------------
  // Collision detection
  // -----------------------------------------------------------------------

  private runCollisions(): void {
    this.collisionPairsThisFrame.clear();

    // Gather visible collidable entities
    const boxes: { id: string; aabb: AABB }[] = [];

    const addEntity = (e: Entity) => {
      if (!e.visible) return;
      if (e.templateId === 'race-controller') return;
      const bounds = e.getBounds();
      if (bounds) {
        boxes.push({ id: e.id, aabb: bounds });
      }
    };

    for (const e of this.ctx.entities) {
      addEntity(e);
    }
    for (const t of this.ctx.traffic) {
      addEntity(t);
    }

    if (boxes.length < 2) return;

    const pairs = CollisionSystem.broadPhase(boxes);
    for (const [idA, idB] of pairs) {
      // Avoid duplicate notifications
      const key = idA < idB ? `${idA}|${idB}` : `${idB}|${idA}`;
      if (this.collisionPairsThisFrame.has(key)) continue;
      this.collisionPairsThisFrame.add(key);

      const entityA = this.findEntity(idA);
      const entityB = this.findEntity(idB);
      if (!entityA || !entityB) continue;

      // Narrow phase AABB test
      if (CollisionSystem.testAABB(entityA.getBounds(), entityB.getBounds())) {
        this.ctx.scriptRuntime.notifyCollisionEnter(idA, entityB);
        this.ctx.scriptRuntime.notifyCollisionEnter(idB, entityA);
      }
    }
  }

  private findEntity(id: string): Entity | undefined {
    return (
      this.ctx.entities.find(e => e.id === id) ??
      this.ctx.traffic.find(e => e.id === id)
    );
  }

  // -----------------------------------------------------------------------
  // Finish line
  // -----------------------------------------------------------------------

  private checkFinish(): void {
    const raceState = this.ctx.raceState;
    if (!raceState || raceState.finished) return;

    const trackCfg = this.ctx.trackConfig;
    if (!trackCfg) return;

    const finishRow = trackCfg.finishLine;
    const player = this.ctx.player;

    // Track opponents finishing
    for (const opp of this.ctx.opponents) {
      if (opp.getField<boolean>('finished') && !this.finishOrder.includes(opp.name)) {
        this.finishOrder.push(opp.name);
      }
    }

    // Check player finish
    if (player) {
      const playerRow = worldYToRow(player.y);
      if (playerRow <= finishRow && !this.finishOrder.includes('Player')) {
        this.finishOrder.push('Player');
        this.endRace();
      }
    }

    // If all opponents finished and player hasn't, show result after a grace period
    if (
      this.finishOrder.length >= this.ctx.opponents.length &&
      !this.finishOrder.includes('Player') &&
      !this.resultShown
    ) {
      // Give the player a few more seconds then force end
      // (handled via the player finishing or the race timing out)
    }
  }

  private endRace(): void {
    if (this.resultShown) return;
    this.resultShown = true;

    const raceState = this.ctx.raceState;
    if (!raceState) return;

    raceState.finished = true;
    this.entity.setField('raceFinished', true);

    const playerPosition = this.finishOrder.indexOf('Player') + 1;
    const totalRacers = this.ctx.opponents.length + 1;

    // Format race time
    const totalSeconds = raceState.raceTime;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = (totalSeconds % 60).toFixed(1);
    const timeStr = `${minutes}:${seconds.padStart(4, '0')}`;

    // Build results string
    const suffixes = ['st', 'nd', 'rd', 'th', 'th', 'th'];
    const posStr = `${playerPosition}${suffixes[playerPosition - 1] || 'th'}`;

    let title: string;
    if (playerPosition <= 3) {
      title = `${posStr} PLACE — YOU WIN!`;
    } else {
      title = `${posStr} PLACE — RACE OVER`;
    }

    let details = `Time: ${timeStr}<br/>`;
    details += `Position: ${posStr} of ${totalRacers}<br/>`;
    details += `<br/>Finish Order:<br/>`;
    for (let i = 0; i < this.finishOrder.length; i++) {
      const s = `${i + 1}${suffixes[i] || 'th'}`;
      details += `${s} — ${this.finishOrder[i]}<br/>`;
    }

    this.ctx.showResult(title, details);
  }
}
