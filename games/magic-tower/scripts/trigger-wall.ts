/**
 * trigger-wall.ts
 * Handles trigger walls in Magic Tower.
 * Trigger walls are walls that disappear when a specific event has been fired.
 */

import { GameState, removeEntity } from './game-state';
import { isEventFired } from './event-trigger';

/**
 * Check if a trigger wall should disappear, and if so, remove it.
 *
 * @param state - Current game state.
 * @param entityId - The unique instance ID of this trigger wall entity.
 * @param sceneId - The scene this entity belongs to.
 * @param fields - The entity fields (triggerEvent, disappearOnTrigger).
 * @returns true if the wall was removed (event was fired and disappearOnTrigger is true),
 *          false otherwise (wall remains solid).
 */
export function handleTriggerWall(
  state: GameState,
  entityId: string,
  sceneId: string,
  fields: Record<string, any>
): boolean {
  const triggerEvent = fields.triggerEvent || '';
  const disappearOnTrigger = fields.disappearOnTrigger !== false; // default true

  // If no trigger event is configured, wall never disappears
  if (!triggerEvent) {
    return false;
  }

  // Check if the required event has been fired
  if (!isEventFired(triggerEvent)) {
    return false;
  }

  // Event has been fired - remove wall if configured to disappear
  if (disappearOnTrigger) {
    removeEntity(state, sceneId, entityId);
    return true;
  }

  return false;
}
