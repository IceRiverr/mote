/**
 * stair.ts — Stair Transition Handler
 *
 * Called when the player steps onto a staircase entity.
 * Returns the target floor and spawn position so the main game loop
 * can load the corresponding scene and reposition the player.
 */

import { GameState } from './game-state';

// ─── Types ────────────────────────────────────────────────────────────

export interface StairResult {
  /** Target floor / scene identifier (e.g. "floor_2"). */
  targetFloor: string;
  /** Grid X where the player should appear on the new floor. */
  targetX: number;
  /** Grid Y where the player should appear on the new floor. */
  targetY: number;
}

// ─── Handler ──────────────────────────────────────────────────────────

/**
 * Process a stair interaction.
 *
 * Expected fields on the stair entity:
 *   - targetFloor  (string):  scene id to transition to, e.g. "floor_3"
 *   - targetX      (number):  spawn grid X on the target floor
 *   - targetY      (number):  spawn grid Y on the target floor
 *   - direction?   (string):  'up' | 'down' — used to infer floor number
 *                              when targetFloor is not explicitly set.
 *
 * The function mutates GameState:
 *   - state.floor         → updated to the new floor number
 *   - state.playerX / Y   → set to the spawn position
 *   - state.visitedFloors → new floor is added
 *
 * @param state  Global game state.
 * @param fields Entity field map from the scene data.
 * @returns StairResult describing the destination.
 */
export function handleStairInteraction(
  state: GameState,
  fields: Record<string, any>
): StairResult {
  // ── Determine target floor ────────────────────────────────────────
  let targetFloor: string;

  if (fields.targetFloor !== undefined && fields.targetFloor !== null) {
    // Explicit target floor id
    targetFloor = String(fields.targetFloor);
  } else {
    // Infer from direction: up stair → floor + 1, down stair → floor − 1
    const direction: string = (fields.direction ?? 'up').toLowerCase();
    const delta = direction === 'down' ? -1 : 1;
    const newFloorNum = Math.max(1, state.floor + delta); // floor 0 doesn't exist
    targetFloor = `floor_${newFloorNum}`;
  }

  // ── Determine spawn position ──────────────────────────────────────
  // Default to bottom-centre of the grid if not specified (common Magic Tower convention).
  const targetX: number = fields.targetX ?? 6;
  const targetY: number = fields.targetY ?? 11;

  // ── Update game state ─────────────────────────────────────────────
  const floorNum = parseFloorNumber(targetFloor);
  if (floorNum !== null) {
    state.floor = floorNum;
    state.visitedFloors.add(floorNum);
  }

  state.playerX = targetX;
  state.playerY = targetY;

  return { targetFloor, targetX, targetY };
}

// ─── Helpers ──────────────────────────────────────────────────────────

/**
 * Extract the numeric floor number from a floor id like "floor_7".
 * Returns null if the format doesn't match.
 */
function parseFloorNumber(floorId: string): number | null {
  const match = floorId.match(/floor_(\d+)/);
  return match ? parseInt(match[1], 10) : null;
}
