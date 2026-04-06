// ---------------------------------------------------------------------------
// scripts/siege-engine.ts — Siege engine behavior
// ---------------------------------------------------------------------------

import type { Entity } from '@mote/engine';
import type { ScriptLifecycle } from '@mote/engine';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MOVE_SPEED = 15;          // px/s (siege engines are slow)
const RELOAD_TIME_BASE = 8;     // seconds base reload
const ARRIVAL_THRESHOLD = 8;    // pixels
const OPERATE_ANIM_RATE = 0.4;  // seconds per frame

type EngineState = 'idle' | 'moving' | 'operating' | 'reloading' | 'destroyed';

// ---------------------------------------------------------------------------
// Script
// ---------------------------------------------------------------------------

export default class SiegeEngineScript implements ScriptLifecycle {
  private entity: Entity;
  private engine: unknown;

  private reloadTimer = 0;
  private animTimer = 0;
  private animFrame = 0;

  constructor(entity: Entity, engine: unknown) {
    this.entity = entity;
    this.engine = engine;
  }

  update(dt: number): void {
    const hp = this.entity.getField<number>('hp') ?? 0;
    if (hp <= 0) {
      this.entity.setField('engineState', 'destroyed');
      this.entity.setFrame('destroyed');
      return;
    }

    const state = (this.entity.getField<string>('engineState') ?? 'idle') as EngineState;

    switch (state) {
      case 'idle':
        this.handleIdle(dt);
        break;
      case 'moving':
        this.handleMoving(dt);
        break;
      case 'operating':
        this.handleOperating(dt);
        break;
      case 'reloading':
        this.handleReloading(dt);
        break;
      case 'destroyed':
        break;
    }

    this.updateFrame(state);
  }

  onCollisionEnter(other: Entity): void {
    const otherType = other.getField<string>('entityType') ?? '';
    if (otherType === 'projectile') {
      const dmg = other.getField<number>('damage') ?? 15;
      const hp = this.entity.getField<number>('hp') ?? 0;
      this.entity.setField('hp', Math.max(0, hp - dmg));
    }
  }

  // -----------------------------------------------------------------------
  // State handlers
  // -----------------------------------------------------------------------

  private handleIdle(_dt: number): void {
    const cmd = this.entity.getField<string>('currentCommand') ?? '';
    if (cmd === 'move') {
      this.entity.setField('engineState', 'moving');
    } else if (cmd === 'fire') {
      this.entity.setField('engineState', 'reloading');
      this.reloadTimer = 0;
    }
  }

  private handleMoving(dt: number): void {
    const tx = this.entity.getField<number>('targetX') ?? this.entity.x;
    const ty = this.entity.getField<number>('targetY') ?? this.entity.y;
    const dx = tx - this.entity.x;
    const dy = ty - this.entity.y;
    const len = Math.sqrt(dx * dx + dy * dy);

    if (len < ARRIVAL_THRESHOLD) {
      this.entity.setField('engineState', 'idle');
      this.entity.setField('currentCommand', '');
      return;
    }

    this.entity.x += (dx / len) * MOVE_SPEED * dt;
    this.entity.y += (dy / len) * MOVE_SPEED * dt;
  }

  private handleOperating(dt: number): void {
    // Fire the projectile
    const ctx = this.engine as Record<string, unknown>;
    const spawner = ctx['spawner'] as {
      spawn?: (template: string, x: number, y: number, fields?: Record<string, unknown>) => Entity;
    } | undefined;

    const tx = this.entity.getField<number>('targetX') ?? this.entity.x + 200;
    const ty = this.entity.getField<number>('targetY') ?? this.entity.y;
    const damage = this.entity.getField<number>('attackPower') ?? 30;
    const projType = this.entity.getField<string>('ammoType') ?? 'stone';

    spawner?.spawn?.('projectile', this.entity.x, this.entity.y - 16, {
      entityType: 'projectile',
      projectileType: projType,
      targetX: tx,
      targetY: ty,
      damage,
      aoeRadius: 48,
    });

    // After firing, enter reload
    this.entity.setField('engineState', 'reloading');
    this.reloadTimer = 0;
  }

  private handleReloading(dt: number): void {
    const reloadTime = this.entity.getField<number>('reloadTime') ?? RELOAD_TIME_BASE;
    this.reloadTimer += dt;

    if (this.reloadTimer >= reloadTime) {
      // Ready to fire
      const cmd = this.entity.getField<string>('currentCommand') ?? '';
      if (cmd === 'fire') {
        this.entity.setField('engineState', 'operating');
      } else {
        this.entity.setField('engineState', 'idle');
      }
    }
  }

  // -----------------------------------------------------------------------
  // Frame animation
  // -----------------------------------------------------------------------

  private updateFrame(state: EngineState): void {
    const engType = this.entity.getField<string>('siegeType') ?? 'trebuchet';

    switch (state) {
      case 'idle':
        this.entity.setFrame(`${engType}_idle`);
        break;
      case 'moving':
        this.animTimer += 1 / 60;
        if (this.animTimer >= OPERATE_ANIM_RATE) {
          this.animTimer = 0;
          this.animFrame = 1 - this.animFrame;
        }
        this.entity.setFrame(`${engType}_move_${this.animFrame}`);
        break;
      case 'operating':
        this.entity.setFrame(`${engType}_fire`);
        break;
      case 'reloading':
        this.entity.setFrame(`${engType}_reload`);
        break;
      case 'destroyed':
        this.entity.setFrame(`${engType}_destroyed`);
        break;
    }
  }
}
