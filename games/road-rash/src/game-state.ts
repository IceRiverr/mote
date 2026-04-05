/**
 * game-state.ts — Game state management for Road Rash 2D.
 *
 * Holds the persistent game state (money, bike, upgrades) and
 * the per-race transient state (speed, position, health, etc.).
 */

// ── Race state (per-race, transient) ────────────────────────────────────────

export interface RaceState {
  /** Track identifier (e.g. "track-city"). */
  trackId: string;
  /** Whether the race has started (countdown finished). */
  started: boolean;
  /** Whether the race has finished (someone crossed the finish line). */
  finished: boolean;
  /** Countdown timer: 3..2..1..GO. Starts at 4, ticks down each second. 0 = GO. */
  countdown: number;
  /** Total elapsed race time in seconds. */
  raceTime: number;
  /** Player's current position in the race (1 = first, 6 = last). */
  playerPosition: number;
  /** Player's distance from start in tile rows. */
  playerDistance: number;
  /** Player's current speed in km/h. */
  playerSpeed: number;
  /** Player's current health (0 = crashed). */
  playerHealth: number;
  /** Player's nitro reserves (0-100). */
  playerNitro: number;
  /** Player's current weapon name. */
  playerWeapon: string;
  /** Distances of all racers (player + opponents) for ranking calculation. */
  opponentDistances: number[];
}

// ── Persistent game state ───────────────────────────────────────────────────

export interface GameState {
  /** Currently selected/loaded track ID. */
  currentTrack: string;
  /** Player's money (earned from races). */
  money: number;
  /** Player's bike type ("street", "sport", "cruiser", "superbike"). */
  bikeType: string;
  /** Upgrade levels: { speed: 0-5, acceleration: 0-5, handling: 0-5, durability: 0-5 }. */
  upgrades: Record<string, number>;
  /** Current race state, or null if not in a race. */
  raceState: RaceState | null;
}

// ── Factory functions ───────────────────────────────────────────────────────

/**
 * Create the initial persistent game state.
 * Player starts with the basic street bike and no upgrades.
 */
export function createInitialState(): GameState {
  return {
    currentTrack: 'track-city',
    money: 0,
    bikeType: 'street',
    upgrades: {
      speed: 0,
      acceleration: 0,
      handling: 0,
      durability: 0,
    },
    raceState: null,
  };
}

/**
 * Create a fresh race state for a given track.
 * All values are reset to starting defaults.
 */
export function createRaceState(trackId: string): RaceState {
  return {
    trackId,
    started: false,
    finished: false,
    countdown: 4,       // will tick down: 3, 2, 1, 0 (GO)
    raceTime: 0,
    playerPosition: 6,  // start last (6 racers: player + 5 opponents)
    playerDistance: 0,
    playerSpeed: 0,
    playerHealth: 100,
    playerNitro: 0,
    playerWeapon: 'fist',
    opponentDistances: [],
  };
}

// ── Utility functions ───────────────────────────────────────────────────────

/**
 * Calculate player position based on all racer distances.
 * Distance is measured from the start line toward the finish;
 * higher distance = closer to finish = better position.
 *
 * @param playerDistance - Player's distance from start (in rows traveled)
 * @param opponentDistances - Array of opponent distances
 * @returns Position number (1 = first place)
 */
export function calculatePosition(
  playerDistance: number,
  opponentDistances: number[],
): number {
  let position = 1;
  for (const oppDist of opponentDistances) {
    if (oppDist > playerDistance) {
      position++;
    }
  }
  return position;
}

/**
 * Get the ordinal suffix for a position number.
 * 1 -> "st", 2 -> "nd", 3 -> "rd", 4+ -> "th"
 */
export function positionSuffix(position: number): string {
  if (position === 1) return 'st';
  if (position === 2) return 'nd';
  if (position === 3) return 'rd';
  return 'th';
}

/**
 * Format race time in mm:ss.ms format.
 */
export function formatRaceTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const wholeSecs = Math.floor(secs);
  const ms = Math.floor((secs - wholeSecs) * 100);
  return `${mins.toString().padStart(2, '0')}:${wholeSecs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}

/**
 * Calculate remaining distance to the finish line in km.
 * 1 tile row = 32px ≈ 3m, so distance in km = rows * 3 / 1000.
 *
 * @param playerRow - Current player row
 * @param finishRow - Finish line row
 * @param startRow - Start line row
 * @returns Distance remaining in km (approximate)
 */
export function distanceToFinishKm(
  playerRow: number,
  finishRow: number,
  startRow: number,
): number {
  // Player races from startRow toward finishRow (decreasing row numbers)
  const totalRows = startRow - finishRow;
  const rowsTraveled = startRow - playerRow;
  const rowsRemaining = Math.max(0, totalRows - rowsTraveled);
  // Each row ≈ 3 meters
  return (rowsRemaining * 3) / 1000;
}

/**
 * Calculate money earned from a race based on finishing position.
 */
export function calculatePrize(position: number): number {
  const prizes: Record<number, number> = {
    1: 5000,
    2: 3000,
    3: 2000,
    4: 1000,
    5: 500,
    6: 0,
  };
  return prizes[position] ?? 0;
}
