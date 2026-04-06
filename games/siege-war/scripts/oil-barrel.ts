// ---------------------------------------------------------------------------
// scripts/oil-barrel.ts — Oil facility
// ---------------------------------------------------------------------------

import type { Entity } from '@mote/engine';
import type { ScriptLifecycle } from '@mote/engine';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const POUR_DURATION = 2.0;       // seconds to pour oil
const TRANSPORT_SPEED = 35;      // px/s
const ARRIVAL_THRESHOLD = 8;

type OilState = 'standby' | 'pouring' | 'transporting' | 'empty';

// ---------------------------------------------------------------------------
// Script
// ---------------------------------------------------------------------------

export default class OilBarrelScript implements ScriptLifecycle {
  private entity: Entity;
  private engine: unknown;

  private pourTimer = 0;

  constructor(entity: Entity, engine: unknown) {
    this.entity = entity;
    this.engine = engine;
  }

  update(dt: number): void {
    const state = (this.entity.getField<string>('oilState') ?? 'standby') as OilState;

    switch (state) {
      case 'standby':
        this.handleStandby();
        break;
      case 'pouring':
        this.handlePouring(dt);
        break;
      case 'transporting':
        this.handleTransporting(dt);
        break;
      case 'empty':
        // No action — awaits resupply or removal
        this.entity.setFrame('oil_empty');
        break;
    }
  }

  // -----------------------------------------------------------------------
  // State handlers
  // -----------------------------------------------------------------------

  private handleStandby(): void {
    const cmd = this.entity.getField<string>('currentCommand') ?? '';
    if (cmd === 'pour') {
      this.entity.setField('oilState', 'pouring');
      this.pourTimer = 0;
      this.entity.setFrame('oil_pouring');
    } else if (cmd === 'transport') {
      this.entity.setField('oilState', 'transporting');
      this.entity.setFrame('oil_transport');
    }
  }

  private handlePouring(dt: number): void {
    this.pourTimer += dt;
    this.entity.setFrame('oil_pouring');

    if (this.pourTimer >= POUR_DURATION) {
      // Spawn oil puddle and then fire at wall base
      const ctx = this.engine as Record<string, unknown>;
      const spawner = ctx['spawner'] as {
        spawn?: (template: string, x: number, y: number, fields?: Record<string, unknown>) => Entity;
      } | undefined;

      if (spawner?.spawn) {
        // Oil effect below the wall
        const wallBaseY = this.entity.y + (this.entity.height ?? 32) + 16;
        spawner.spawn('fire-effect', this.entity.x, wallBaseY, {
          entityType: 'fire_effect',
          duration: 12,
        });
      }

      // Play audio
      const audio = ctx['audio'] as { play?: (key: string) => void } | undefined;
      audio?.play?.('sfx_oil_pour');

      this.entity.setField('oilState', 'empty');
      this.entity.setField('currentCommand', '');
      this.entity.setFrame('oil_empty');
    }
  }

  private handleTransporting(dt: number): void {
    const tx = this.entity.getField<number>('targetX') ?? this.entity.x;
    const ty = this.entity.getField<number>('targetY') ?? this.entity.y;
    const dx = tx - this.entity.x;
    const dy = ty - this.entity.y;
    const len = Math.sqrt(dx * dx + dy * dy);

    if (len < ARRIVAL_THRESHOLD) {
      this.entity.setField('oilState', 'standby');
      this.entity.setField('currentCommand', '');
      this.entity.setFrame('oil_standby');
      return;
    }

    this.entity.x += (dx / len) * TRANSPORT_SPEED * dt;
    this.entity.y += (dy / len) * TRANSPORT_SPEED * dt;
    this.entity.setFrame('oil_transport');
  }
}
