// ---------------------------------------------------------------------------
// scripts/barbican-trap.ts — Barbican gate control
// ---------------------------------------------------------------------------

import type { Entity } from '@mote/engine';
import type { ScriptLifecycle } from '@mote/engine';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GATE_CLOSE_SPEED = 2.0;    // seconds to fully close
const TRAP_DETECT_RADIUS = 64;   // pixels — area inside the barbican

type GateState = 'open' | 'closing' | 'closed';

// ---------------------------------------------------------------------------
// Script
// ---------------------------------------------------------------------------

export default class BarbicanTrapScript implements ScriptLifecycle {
  private entity: Entity;
  private engine: unknown;

  private closeTimer = 0;

  constructor(entity: Entity, engine: unknown) {
    this.entity = entity;
    this.engine = engine;
  }

  update(dt: number): void {
    const gateState = (this.entity.getField<string>('gateState') ?? 'open') as GateState;

    switch (gateState) {
      case 'open':
        this.handleOpen();
        break;
      case 'closing':
        this.handleClosing(dt);
        break;
      case 'closed':
        this.handleClosed();
        break;
    }
  }

  // -----------------------------------------------------------------------
  // State handlers
  // -----------------------------------------------------------------------

  private handleOpen(): void {
    const cmd = this.entity.getField<string>('currentCommand') ?? '';
    if (cmd === 'trap') {
      this.entity.setField('gateState', 'closing');
      this.closeTimer = 0;
      this.entity.setFrame('gate_closing');

      // Play gate sound
      const ctx = this.engine as Record<string, unknown>;
      const audio = ctx['audio'] as { play?: (key: string) => void } | undefined;
      audio?.play?.('sfx_gate_close');
    } else {
      this.entity.setFrame('gate_intact');
    }
  }

  private handleClosing(dt: number): void {
    this.closeTimer += dt;
    this.entity.setFrame('gate_closing');

    if (this.closeTimer >= GATE_CLOSE_SPEED) {
      this.entity.setField('gateState', 'closed');
      this.entity.setField('currentCommand', '');
      this.entity.setFrame('gate_intact');
      this.countTrapped();
    }
  }

  private handleClosed(): void {
    // Count trapped enemies each frame (some may die)
    this.countTrapped();
    this.entity.setFrame('gate_intact');
  }

  // -----------------------------------------------------------------------
  // Trapped enemy counting
  // -----------------------------------------------------------------------

  private countTrapped(): void {
    const ctx = this.engine as Record<string, unknown>;
    const entityManager = ctx['entityManager'] as {
      getInRadius?: (x: number, y: number, r: number) => Entity[];
    } | undefined;
    if (!entityManager?.getInRadius) return;

    const inside = entityManager.getInRadius(this.entity.x, this.entity.y, TRAP_DETECT_RADIUS);
    let trappedCount = 0;

    for (const e of inside) {
      const side = e.getField<string>('side') ?? '';
      const hp = e.getField<number>('hpCurrent') ?? 0;
      if (side === 'attacker' && hp > 0) {
        trappedCount++;
      }
    }

    this.entity.setField('trappedCount', trappedCount);

    // Emit event if enemies are trapped
    if (trappedCount > 0) {
      const events = ctx['events'] as {
        emit?: (name: string, data: unknown) => void;
      } | undefined;
      events?.emit?.('barbican:trapped', {
        barbicanId: this.entity.id,
        count: trappedCount,
        x: this.entity.x,
        y: this.entity.y,
      });
    }
  }
}
