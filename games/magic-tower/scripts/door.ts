/**
 * door.ts — Door Interaction Handler
 *
 * Called when the player bumps into a door entity.
 * Checks whether the player holds the required key, consumes it,
 * and marks the door as removed from the scene.
 */

import { GameState, removeEntity } from './game-state';

// ─── Types ────────────────────────────────────────────────────────────

export interface DoorResult {
  /** Whether the door was successfully opened. */
  opened: boolean;
  /** Human-readable message for the UI. */
  message: string;
}

// ─── Key Helpers (operate on plain GameState fields) ──────────────────

function hasKey(state: GameState, color: string): boolean {
  switch (color) {
    case 'yellow': return state.yellowKeys > 0;
    case 'blue':   return state.blueKeys > 0;
    case 'red':    return state.redKeys > 0;
    default:       return false;
  }
}

function useKey(state: GameState, color: string): boolean {
  if (!hasKey(state, color)) return false;
  switch (color) {
    case 'yellow': state.yellowKeys--; break;
    case 'blue':   state.blueKeys--;   break;
    case 'red':    state.redKeys--;     break;
    default: return false;
  }
  return true;
}

// ─── Handler ──────────────────────────────────────────────────────────

/**
 * Attempt to open a door.
 *
 * @param state    Global game state (mutated on success: key consumed, entity removed).
 * @param entityId Unique id of the door entity.
 * @param sceneId  Scene (floor) identifier, e.g. "floor_5".
 * @param color    Door colour: 'yellow' | 'blue' | 'red' | 'iron'.
 * @returns DoorResult describing the outcome.
 */
export function handleDoorInteraction(
  state: GameState,
  entityId: string,
  sceneId: string,
  color: string
): DoorResult {
  const c = color.toLowerCase();

  // ── Iron doors require a special event / boss kill, not a key ─────
  if (c === 'iron') {
    return {
      opened: false,
      message: 'This iron door cannot be opened with a key.',
    };
  }

  // ── Validate colour is one we track keys for ─────────────────────
  if (c !== 'yellow' && c !== 'blue' && c !== 'red') {
    return {
      opened: false,
      message: `Unknown door type: ${color}.`,
    };
  }

  // ── Check the player has the right key ────────────────────────────
  if (!hasKey(state, c)) {
    return {
      opened: false,
      message: `You need a ${keyDisplayName(c)} to open this door.`,
    };
  }

  // ── Consume the key and remove the door entity ────────────────────
  useKey(state, c);
  removeEntity(state, sceneId, entityId);

  return {
    opened: true,
    message: `Used a ${keyDisplayName(c)}. Door opened!`,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────

/** Human-friendly display name for a key colour. */
function keyDisplayName(color: string): string {
  switch (color) {
    case 'yellow': return 'Yellow Key';
    case 'blue':   return 'Blue Key';
    case 'red':    return 'Red Key';
    default:       return `${color.charAt(0).toUpperCase() + color.slice(1)} Key`;
  }
}
