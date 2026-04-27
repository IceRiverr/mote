// games/tiny-dungeon/src/systems/pickup.ts
// Update: 拾取系统

import type { World } from '@mote/engine';
import { Transform } from '@mote/engine';
import { PlayerTag, Health, Pickup } from '../components.js';
import { GameState } from '../resources.js';

const PICKUP_DISTANCE = 12;

export function pickupSystem(world: World, _dt: number): void {
  const state = world.getResource<GameState>('GameState');
  if (state?.paused) return;

  let playerEid: number | null = null;
  let playerTransform: Transform | null = null;
  let playerHealth: Health | null = null;

  for (const eid of world.query(PlayerTag, Transform, Health)) {
    playerEid = eid;
    playerTransform = world.get(eid, Transform);
    playerHealth = world.get(eid, Health);
    break;
  }

  if (!playerEid || !playerTransform || !playerHealth) return;

  for (const eid of world.query(Pickup, Transform)) {
    const pickup = world.get(eid, Pickup);
    const transform = world.get(eid, Transform);

    const dx = playerTransform.x - transform.x;
    const dy = playerTransform.y - transform.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < PICKUP_DISTANCE) {
      if (pickup.kind === 'heal') {
        playerHealth.current = Math.min(playerHealth.max, playerHealth.current + pickup.amount);
      }
      world.destroy(eid);
    }
  }
}
