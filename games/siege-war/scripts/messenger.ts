// ---------------------------------------------------------------------------
// scripts/messenger.ts — Messenger unit movement
// ---------------------------------------------------------------------------

import type { Entity } from '@mote/engine';
import type { ScriptLifecycle } from '@mote/engine';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MESSENGER_SPEED = 120;   // px/s
const ARRIVAL_THRESHOLD = 6;   // pixels
const ANIM_FRAME_DURATION = 0.15;
const ANIM_FRAME_COUNT = 3;

// ---------------------------------------------------------------------------
// Script
// ---------------------------------------------------------------------------

export default class MessengerScript implements ScriptLifecycle {
  private entity: Entity;
  private engine: unknown;

  private animTimer = 0;
  private animFrame = 0;

  constructor(entity: Entity, engine: unknown) {
    this.entity = entity;
    this.engine = engine;
  }

  update(dt: number): void {
    const tx = this.entity.getField<number>('targetX') ?? this.entity.x;
    const ty = this.entity.getField<number>('targetY') ?? this.entity.y;

    const dx = tx - this.entity.x;
    const dy = ty - this.entity.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < ARRIVAL_THRESHOLD) {
      this.onArrival();
      return;
    }

    // Move toward target
    const nx = dx / dist;
    const ny = dy / dist;
    this.entity.x += nx * MESSENGER_SPEED * dt;
    this.entity.y += ny * MESSENGER_SPEED * dt;

    // Run animation cycling: run_0, run_1, run_2
    this.animTimer += dt;
    if (this.animTimer >= ANIM_FRAME_DURATION) {
      this.animTimer -= ANIM_FRAME_DURATION;
      this.animFrame = (this.animFrame + 1) % ANIM_FRAME_COUNT;
    }
    this.entity.setFrame(`messenger_run_${this.animFrame}`);
  }

  // -----------------------------------------------------------------------
  // Arrival handling
  // -----------------------------------------------------------------------

  private onArrival(): void {
    // Emit command delivered event
    const ctx = this.engine as Record<string, unknown>;
    const events = ctx['events'] as {
      emit?: (name: string, data: unknown) => void;
    } | undefined;

    const commandId = this.entity.getField<string>('commandId') ?? '';
    events?.emit?.('command:delivered', {
      commandId,
      messengerId: this.entity.id,
      x: this.entity.x,
      y: this.entity.y,
    });

    // Play acknowledgment sound
    const audio = ctx['audio'] as { play?: (key: string) => void } | undefined;
    audio?.play?.('sfx_acknowledge');

    // Recycle the messenger entity
    const spawner = ctx['spawner'] as { recycle?: (e: Entity) => void } | undefined;
    if (spawner?.recycle) {
      spawner.recycle(this.entity);
    } else {
      this.entity.visible = false;
    }
  }
}
