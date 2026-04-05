/**
 * physics.ts — Physics utility module for Road Rash 2D.
 *
 * NOT a ScriptLifecycle class. Exports named functions and constants
 * for speed conversion, lane interpolation, and coordinate transforms.
 *
 * Design constants:
 * - 1 tile = 32px ≈ 3m real-world
 * - 100 km/h ≈ 296 px/s  (100 * 1000m / 3600s / 3m * 32px ≈ 296.3 px/s)
 * - Lane width = 3 tiles = 96px
 */

// ── Constants ───────────────────────────────────────────────────────────────

/** Conversion factor: pixels per second for each km/h. */
export const SPEED_SCALE = 296 / 100; // 2.96 px/s per km/h

/** Tile size in pixels. */
export const TILE_SIZE = 32;

/** Width of one lane in pixels (3 tiles). */
export const LANE_WIDTH = 96; // 3 * 32

/** Width of one lane in tiles. */
export const LANE_WIDTH_TILES = 3;

/** Total number of lanes. */
export const NUM_LANES = 5;

/** Total road width in tiles (5 lanes * 3 tiles each). */
export const ROAD_WIDTH_TILES = NUM_LANES * LANE_WIDTH_TILES; // 15

/** Gravity-like deceleration when no throttle (km/h per second). */
export const COAST_DECEL = 20;

/** Braking deceleration (km/h per second). */
export const BRAKE_DECEL = 80;

/** Nitro speed bonus (km/h added to max speed while active). */
export const NITRO_BONUS = 40;

/** Nitro drain rate (units per second out of 100). */
export const NITRO_DRAIN = 25;

// ── Speed conversions ───────────────────────────────────────────────────────

/**
 * Convert km/h to pixels per second.
 */
export function kmhToPxPerSec(kmh: number): number {
  return kmh * SPEED_SCALE;
}

/**
 * Convert pixels per second to km/h.
 */
export function pxPerSecToKmh(pxps: number): number {
  return pxps / SPEED_SCALE;
}

/**
 * Calculate how many pixels to move this frame given speed in km/h.
 *
 * @param kmh - Current speed in km/h
 * @param dt - Delta time in seconds
 * @returns Distance in pixels to travel this frame
 */
export function speedToPxPerFrame(kmh: number, dt: number): number {
  return kmh * SPEED_SCALE * dt;
}

// ── Lane interpolation ──────────────────────────────────────────────────────

/**
 * Smoothly interpolate between the current visual lane and the target lane.
 * Used for smooth lane-change animations.
 *
 * @param current - Current visual lane position (fractional)
 * @param target - Target lane (integer 0-4)
 * @param handling - Handling stat: lane changes per second (e.g. 6)
 * @param dt - Delta time in seconds
 * @returns Updated lane position and progress (0..1 where 1 = arrived)
 */
export function interpolateLane(
  current: number,
  target: number,
  handling: number,
  dt: number,
): { lane: number; progress: number } {
  const diff = target - current;

  if (Math.abs(diff) < 0.01) {
    // Close enough — snap to target
    return { lane: target, progress: 1.0 };
  }

  // Move toward target at `handling` lanes per second
  const step = handling * dt;
  const move = Math.sign(diff) * Math.min(step, Math.abs(diff));
  const newLane = current + move;

  // Calculate progress: how close are we (0 = just started, 1 = arrived)
  const remaining = Math.abs(target - newLane);
  const total = Math.abs(target - current) + Math.abs(move);
  const progress = total > 0 ? 1 - remaining / Math.max(remaining + Math.abs(move), 0.001) : 1;

  return { lane: newLane, progress: Math.min(1, progress) };
}

// ── Lane-to-world coordinate conversion ─────────────────────────────────────

/**
 * Convert a lane number (0-4, can be fractional) to a world X pixel position.
 * Returns the X position of the left edge of an entity centered in the lane.
 *
 * @param lane - Lane number (0-4, can be fractional for smooth lane changes)
 * @param roadCenterCol - The road center tile column for this row
 * @returns World X in pixels
 */
export function laneToWorldX(lane: number, roadCenterCol: number): number {
  const halfRoad = Math.floor(ROAD_WIDTH_TILES / 2); // 7
  const roadLeftCol = roadCenterCol - halfRoad;

  // Each lane is LANE_WIDTH_TILES tiles wide
  // Lane center is at: roadLeftCol + lane * LANE_WIDTH_TILES + LANE_WIDTH_TILES/2
  const laneCenterX =
    (roadLeftCol + lane * LANE_WIDTH_TILES + LANE_WIDTH_TILES * 0.5) * TILE_SIZE;

  return laneCenterX;
}

/**
 * Convert a world X pixel position to the nearest fractional lane number.
 *
 * @param worldX - World X position in pixels
 * @param roadCenterCol - The road center tile column for this row
 * @returns Fractional lane number (0.0 - 4.0)
 */
export function worldXToLane(worldX: number, roadCenterCol: number): number {
  const halfRoad = Math.floor(ROAD_WIDTH_TILES / 2);
  const roadLeftCol = roadCenterCol - halfRoad;
  const roadLeftX = roadLeftCol * TILE_SIZE;

  const relativeX = worldX - roadLeftX;
  const lane = relativeX / LANE_WIDTH - 0.5;

  return Math.max(0, Math.min(NUM_LANES - 1, lane));
}

// ── Row/Y conversion ────────────────────────────────────────────────────────

/**
 * Convert a world Y pixel position to a tile row number.
 */
export function worldYToRow(worldY: number): number {
  return Math.floor(worldY / TILE_SIZE);
}

/**
 * Convert a tile row number to a world Y pixel position (top edge of the row).
 */
export function rowToWorldY(row: number): number {
  return row * TILE_SIZE;
}

// ── Acceleration / deceleration ─────────────────────────────────────────────

/**
 * Apply acceleration to current speed, clamped to maxSpeed.
 *
 * @param currentSpeed - Current speed in km/h
 * @param acceleration - Acceleration rate in km/h per second
 * @param maxSpeed - Maximum speed in km/h
 * @param dt - Delta time in seconds
 * @returns New speed in km/h
 */
export function accelerate(
  currentSpeed: number,
  acceleration: number,
  maxSpeed: number,
  dt: number,
): number {
  const newSpeed = currentSpeed + acceleration * dt;
  return Math.min(newSpeed, maxSpeed);
}

/**
 * Apply deceleration (coast or brake) to current speed.
 *
 * @param currentSpeed - Current speed in km/h
 * @param deceleration - Deceleration rate in km/h per second
 * @param dt - Delta time in seconds
 * @returns New speed in km/h (minimum 0)
 */
export function decelerate(
  currentSpeed: number,
  deceleration: number,
  dt: number,
): number {
  const newSpeed = currentSpeed - deceleration * dt;
  return Math.max(0, newSpeed);
}

// ── Distance / position helpers ─────────────────────────────────────────────

/**
 * Calculate the distance traveled in rows from the start line.
 * Since the player starts at a high row number and races toward a low row number,
 * distance = startRow - currentRow.
 *
 * @param startRow - The start line row (e.g. 1450)
 * @param currentRow - Current row position
 * @returns Distance in rows traveled (positive = forward progress)
 */
export function distanceTraveled(startRow: number, currentRow: number): number {
  return startRow - currentRow;
}

/**
 * Check if a racer has crossed the finish line.
 *
 * @param currentRow - Current row position
 * @param finishRow - The finish line row (e.g. 50)
 * @returns true if the racer has crossed or reached the finish
 */
export function hasCrossedFinish(currentRow: number, finishRow: number): boolean {
  return currentRow <= finishRow;
}

// ── Collision helpers ───────────────────────────────────────────────────────

/**
 * Check if two entities are in adjacent lanes (within attack range).
 * Used for melee combat range checks.
 *
 * @param laneA - Lane of entity A
 * @param laneB - Lane of entity B
 * @returns true if lanes are adjacent (difference <= 1)
 */
export function areInAdjacentLanes(laneA: number, laneB: number): boolean {
  return Math.abs(Math.round(laneA) - Math.round(laneB)) <= 1;
}

/**
 * Check if two entities are alongside each other vertically
 * (their Y ranges overlap).
 *
 * @param yA - Y position of entity A
 * @param hA - Height of entity A
 * @param yB - Y position of entity B
 * @param hB - Height of entity B
 * @param tolerance - Extra tolerance in pixels
 * @returns true if entities overlap vertically
 */
export function areAlongside(
  yA: number,
  hA: number,
  yB: number,
  hB: number,
  tolerance = 16,
): boolean {
  return yA - tolerance < yB + hB && yA + hA + tolerance > yB;
}
