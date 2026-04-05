/**
 * teleporter.ts
 * Handles teleporter pad interactions in Magic Tower.
 * Teleporter pads transport the player to a specific floor and position.
 */

import { GameState } from './game-state';

export interface TeleportResult {
  targetFloor: string;
  targetX: number;
  targetY: number;
}

/**
 * Process a teleporter entity and determine where the player should be sent.
 *
 * @param fields - The entity fields from the teleporter entity.
 * @returns A TeleportResult with the destination floor and coordinates.
 */
const TILE_SIZE = 32;

export function handleTeleport(fields: Record<string, any>): TeleportResult {
  const targetFloor = fields.targetFloor || 'floor-1';
  // Target coordinates are in pixels, convert to grid
  const targetX = typeof fields.targetX === 'number' ? Math.floor(fields.targetX / TILE_SIZE) : 6;
  const targetY = typeof fields.targetY === 'number' ? Math.floor(fields.targetY / TILE_SIZE) : 6;

  return {
    targetFloor,
    targetX,
    targetY,
  };
}
