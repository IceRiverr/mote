// ---------------------------------------------------------------------------
// scripts/listening-pot.ts — Listening pot detection script
// ---------------------------------------------------------------------------

import type { Entity } from '@mote/engine';
import type { ScriptLifecycle } from '@mote/engine';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PULSE_SPEED = 3.0;       // pulses per second at max intensity
const PULSE_MIN_ALPHA = 0.3;
const PULSE_MAX_ALPHA = 1.0;

// ---------------------------------------------------------------------------
// Script
// ---------------------------------------------------------------------------

export default class ListeningPotScript implements ScriptLifecycle {
  private entity: Entity;
  private engine: unknown;

  private pulsePhase = 0;

  constructor(entity: Entity, engine: unknown) {
    this.entity = entity;
    this.engine = engine;
  }

  update(dt: number): void {
    const ctx = this.engine as Record<string, unknown>;
    const listeningPotSystem = ctx['listeningPotSystem'] as {
      getSignals?: () => Array<{
        potId: string;
        intensity: number;
        direction: number;
        active: boolean;
      }>;
    } | undefined;

    if (!listeningPotSystem?.getSignals) {
      this.entity.setField('signalActive', false);
      return;
    }

    // Find the signal matching this pot entity
    const potId = this.entity.id;
    const signals = listeningPotSystem.getSignals();
    const mySignal = signals.find(s => s.potId === potId);

    if (!mySignal || !mySignal.active) {
      this.entity.setField('signalIntensity', 0);
      this.entity.setField('signalDirection', 0);
      this.entity.setField('signalActive', false);
      this.entity.setFrame('listening_pot_tile');
      return;
    }

    // Update entity fields from system signal data
    this.entity.setField('signalIntensity', mySignal.intensity);
    this.entity.setField('signalDirection', mySignal.direction);
    this.entity.setField('signalActive', true);

    // Visual feedback: pulse icon based on intensity
    const pulseRate = PULSE_SPEED * (mySignal.intensity / 3);
    this.pulsePhase += pulseRate * dt * Math.PI * 2;
    if (this.pulsePhase > Math.PI * 2) this.pulsePhase -= Math.PI * 2;

    const alpha = PULSE_MIN_ALPHA +
      (PULSE_MAX_ALPHA - PULSE_MIN_ALPHA) * (0.5 + 0.5 * Math.sin(this.pulsePhase));
    this.entity.setField('pulseAlpha', alpha);

    // Switch frame based on intensity level
    switch (mySignal.intensity) {
      case 3:
        this.entity.setFrame('suspicious_certain');
        break;
      case 2:
        this.entity.setFrame('suspicious_high');
        break;
      case 1:
        this.entity.setFrame('suspicious_med');
        break;
      default:
        this.entity.setFrame('listening_pot_tile');
        break;
    }
  }
}
