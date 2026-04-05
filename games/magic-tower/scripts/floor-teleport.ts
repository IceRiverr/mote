/**
 * floor-teleport.ts
 * Floor teleport system for Magic Tower.
 * Allows the player to teleport to any previously visited floor
 * once they've acquired the teleporter_item special item.
 */

import { GameState } from './game-state';

/**
 * Get the list of visited floor numbers, sorted ascending.
 *
 * @param state - Current game state.
 * @returns Sorted array of floor numbers the player has visited.
 */
export function getVisitedFloors(state: GameState): number[] {
  return Array.from(state.visitedFloors).sort((a, b) => a - b);
}

/**
 * Teleport the player to a previously visited floor.
 * The player is placed at the stair_down position of the target floor,
 * or at the default starting position (6, 11) for floor 1.
 *
 * @param state - Current game state (will update floor and currentScene).
 * @param floorNum - The floor number to teleport to.
 * @returns An object with the target scene ID and grid coordinates.
 */
export function teleportToFloor(
  state: GameState,
  floorNum: number
): { targetFloor: string; targetX: number; targetY: number } {
  const targetFloor = `floor-${floorNum}`;

  // Default positions: floor 1 uses starting position, others use center
  // The actual stair_down position will be resolved by main.ts when loading the scene
  let targetX = 6;
  let targetY = 11;

  if (floorNum > 1) {
    // For non-starting floors, default to center; main.ts will search for
    // stair_down entity to find the exact position after loading the scene.
    targetX = 6;
    targetY = 6;
  }

  // Update state
  state.floor = floorNum;
  state.currentScene = targetFloor;

  return {
    targetFloor,
    targetX,
    targetY,
  };
}
