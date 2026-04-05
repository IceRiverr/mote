/**
 * event-trigger.ts
 * Global event system for Magic Tower.
 * Events are fired by event_trigger entities when the player walks over them.
 * Other systems (like trigger walls) can check if an event has been fired.
 */

import { GameState, removeEntity } from './game-state';

/** Global set of all fired event IDs. Persists for the session. */
export const firedEvents: Set<string> = new Set();

/**
 * Fire an event, adding it to the global fired set.
 * @param eventId - The event identifier to fire.
 */
export function fireEvent(eventId: string): void {
  if (eventId) {
    firedEvents.add(eventId);
  }
}

/**
 * Check whether a specific event has been fired.
 * @param eventId - The event identifier to check.
 * @returns true if the event has been fired.
 */
export function isEventFired(eventId: string): boolean {
  return firedEvents.has(eventId);
}

/**
 * Handle an event trigger entity when the player steps on it.
 *
 * @param state - Current game state.
 * @param entityId - The unique instance ID of this event trigger entity.
 * @param sceneId - The scene this entity belongs to.
 * @param fields - The entity fields (event, once, param).
 * @returns A message string if the event was fired (or null if already handled).
 */
export function handleEventTrigger(
  state: GameState,
  entityId: string,
  sceneId: string,
  fields: Record<string, any>
): string | null {
  const eventId = fields.event || '';
  const once = fields.once !== false; // default true
  const param = fields.param || '';

  // No event configured
  if (!eventId) {
    return null;
  }

  // If this is a one-time trigger and event already fired, do nothing
  if (once && isEventFired(eventId)) {
    return null;
  }

  // Fire the event
  fireEvent(eventId);

  // If one-time trigger, remove this entity so it doesn't fire again
  if (once) {
    removeEntity(state, sceneId, entityId);
  }

  // Return a message based on the param, or a generic confirmation
  if (param) {
    return param;
  }

  return `事件 [${eventId}] 已触发！`;
}
