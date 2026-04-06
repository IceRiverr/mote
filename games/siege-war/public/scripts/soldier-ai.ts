// ---------------------------------------------------------------------------
// scripts/soldier-ai.ts — Soldier autonomous AI
// ---------------------------------------------------------------------------

import type { Entity } from '@mote/engine';
import type { ScriptLifecycle } from '@mote/engine';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PANIC_MORALE_THRESHOLD = 20;
const FIRE_DETECT_RADIUS = 48;
const PROJECTILE_DODGE_RADIUS = 64;
const MELEE_ENGAGE_RADIUS = 28;
const COVER_SEEK_RADIUS = 80;
const FIRE_EXTINGUISH_RADIUS = 40;
const ANIM_FRAME_DURATION = 0.25;

type SoldierState =
  | 'idle'
  | 'moving'
  | 'firing'
  | 'melee'
  | 'routing'
  | 'covering'
  | 'extinguishing';

// ---------------------------------------------------------------------------
// Script
// ---------------------------------------------------------------------------

export default class SoldierAIScript implements ScriptLifecycle {
  private entity: Entity;
  private engine: unknown;

  private animTimer = 0;
  private animFrame = 0;
  private dodgeCooldown = 0;

  constructor(entity: Entity, engine: unknown) {
    this.entity = entity;
    this.engine = engine;
  }

  update(dt: number): void {
    const hp = this.entity.getField<number>('hpCurrent') ?? 0;
    if (hp <= 0) {
      this.entity.setField('state', 'dead');
      this.entity.setFrame('dead');
      return;
    }

    this.animTimer += dt;
    this.dodgeCooldown = Math.max(0, this.dodgeCooldown - dt);

    const morale = this.entity.getField<number>('morale') ?? 100;

    // Autonomous behaviour priority chain
    if (morale <= PANIC_MORALE_THRESHOLD) {
      this.panic(dt);
    } else if (this.isUnderFire()) {
      this.seekCover(dt);
    } else if (this.enemyOnWall()) {
      this.meleeCounter(dt);
    } else if (this.dodgeCooldown <= 0 && this.incomingProjectile()) {
      this.dodge(dt);
    } else if (this.nearbyFire()) {
      this.extinguishFire(dt);
    } else {
      this.executeCommand(dt);
    }

    this.updateFrame();
  }

  onCollisionEnter(other: Entity): void {
    const otherType = other.getField<string>('entityType') ?? '';
    if (otherType === 'projectile') {
      const dmg = other.getField<number>('damage') ?? 10;
      const def = this.entity.getField<number>('defense') ?? 0;
      const actual = Math.max(1, dmg - def);
      const hp = this.entity.getField<number>('hpCurrent') ?? 0;
      this.entity.setField('hpCurrent', Math.max(0, hp - actual));

      // Morale hit from taking damage
      const morale = this.entity.getField<number>('morale') ?? 100;
      this.entity.setField('morale', Math.max(0, morale - 3));
    }
  }

  // -----------------------------------------------------------------------
  // Autonomous behaviours
  // -----------------------------------------------------------------------

  private panic(dt: number): void {
    this.entity.setField('state', 'routing');
    const side = this.entity.getField<string>('side') ?? 'defender';
    // Route away from the front line
    const retreatDir = side === 'defender' ? 1 : -1;
    this.entity.x += retreatDir * 60 * dt;
  }

  private seekCover(dt: number): void {
    this.entity.setField('state', 'covering');
    // Move toward nearest battlement or obstacle
    const ctx = this.engine as Record<string, unknown>;
    const wallSegments = ctx['wallSegments'] as Entity[] | undefined;
    if (!wallSegments || wallSegments.length === 0) return;

    let nearest: Entity | null = null;
    let bestDist = Infinity;
    for (const seg of wallSegments) {
      const d = Math.abs(seg.x - this.entity.x) + Math.abs(seg.y - this.entity.y);
      if (d < bestDist && d < COVER_SEEK_RADIUS) {
        bestDist = d;
        nearest = seg;
      }
    }

    if (nearest) {
      const dx = nearest.x - this.entity.x;
      const dy = (nearest.y - 16) - this.entity.y; // slightly behind wall top
      const len = Math.sqrt(dx * dx + dy * dy);
      if (len > 4) {
        const speed = this.entity.getField<number>('moveSpeed') ?? 40;
        this.entity.x += (dx / len) * speed * dt;
        this.entity.y += (dy / len) * speed * dt;
      }
    }
  }

  private meleeCounter(dt: number): void {
    this.entity.setField('state', 'melee');
    const ctx = this.engine as Record<string, unknown>;
    const entities = ctx['entityManager'] as { getInRadius?: (x: number, y: number, r: number) => Entity[] } | undefined;
    if (!entities || !entities.getInRadius) return;

    const nearby = entities.getInRadius(this.entity.x, this.entity.y, MELEE_ENGAGE_RADIUS);
    const mySide = this.entity.getField<string>('side') ?? 'defender';

    for (const e of nearby) {
      const eSide = e.getField<string>('side') ?? '';
      if (eSide && eSide !== mySide) {
        // Deal melee damage
        const atk = this.entity.getField<number>('attackPower') ?? 10;
        const eHp = e.getField<number>('hpCurrent') ?? 0;
        const eDef = e.getField<number>('defense') ?? 0;
        e.setField('hpCurrent', Math.max(0, eHp - Math.max(1, atk - eDef)));
        break; // One target per frame
      }
    }
  }

  private dodge(dt: number): void {
    this.entity.setField('state', 'moving');
    // Quick lateral movement to evade
    const dir = Math.random() < 0.5 ? -1 : 1;
    this.entity.x += dir * 80 * dt;
    this.dodgeCooldown = 1.0;
  }

  private extinguishFire(dt: number): void {
    this.entity.setField('state', 'extinguishing');
    const ctx = this.engine as Record<string, unknown>;
    const entities = ctx['entityManager'] as { getInRadius?: (x: number, y: number, r: number) => Entity[] } | undefined;
    if (!entities || !entities.getInRadius) return;

    const fires = entities.getInRadius(this.entity.x, this.entity.y, FIRE_EXTINGUISH_RADIUS);
    for (const f of fires) {
      if (f.getField<string>('entityType') === 'fire_effect') {
        // Move toward fire
        const dx = f.x - this.entity.x;
        const dy = f.y - this.entity.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len > 8) {
          const speed = this.entity.getField<number>('moveSpeed') ?? 40;
          this.entity.x += (dx / len) * speed * dt;
          this.entity.y += (dy / len) * speed * dt;
        } else {
          // Reduce fire duration
          const dur = f.getField<number>('duration') ?? 0;
          f.setField('duration', Math.max(0, dur - dt * 3));
        }
        break;
      }
    }
  }

  // -----------------------------------------------------------------------
  // Command execution
  // -----------------------------------------------------------------------

  private executeCommand(dt: number): void {
    const cmd = this.entity.getField<string>('currentCommand') ?? '';
    const state = this.entity.getField<string>('state') ?? 'idle';

    switch (cmd) {
      case 'move': {
        this.entity.setField('state', 'moving');
        const tx = this.entity.getField<number>('targetX') ?? this.entity.x;
        const ty = this.entity.getField<number>('targetY') ?? this.entity.y;
        const dx = tx - this.entity.x;
        const dy = ty - this.entity.y;
        const len = Math.sqrt(dx * dx + dy * dy);
        if (len < 4) {
          this.entity.setField('currentCommand', '');
          this.entity.setField('state', 'idle');
        } else {
          const speed = this.entity.getField<number>('moveSpeed') ?? 40;
          this.entity.x += (dx / len) * speed * dt;
          this.entity.y += (dy / len) * speed * dt;
        }
        break;
      }
      case 'fire': {
        this.entity.setField('state', 'firing');
        // Firing is handled by the projectile system externally;
        // the script just maintains the firing state and animation.
        break;
      }
      case 'hold':
        this.entity.setField('state', 'idle');
        break;
      default:
        if (state !== 'idle') {
          this.entity.setField('state', 'idle');
        }
        break;
    }
  }

  // -----------------------------------------------------------------------
  // Detection helpers
  // -----------------------------------------------------------------------

  private isUnderFire(): boolean {
    const ctx = this.engine as Record<string, unknown>;
    const projectiles = ctx['projectileSystem'] as { getActive?: () => Entity[] } | undefined;
    if (!projectiles || !projectiles.getActive) return false;

    for (const p of projectiles.getActive()) {
      const dx = p.x - this.entity.x;
      const dy = p.y - this.entity.y;
      if (dx * dx + dy * dy < COVER_SEEK_RADIUS * COVER_SEEK_RADIUS) return true;
    }
    return false;
  }

  private enemyOnWall(): boolean {
    const ctx = this.engine as Record<string, unknown>;
    const entities = ctx['entityManager'] as { getInRadius?: (x: number, y: number, r: number) => Entity[] } | undefined;
    if (!entities || !entities.getInRadius) return false;

    const mySide = this.entity.getField<string>('side') ?? 'defender';
    const nearby = entities.getInRadius(this.entity.x, this.entity.y, MELEE_ENGAGE_RADIUS);
    for (const e of nearby) {
      const eSide = e.getField<string>('side') ?? '';
      if (eSide && eSide !== mySide) return true;
    }
    return false;
  }

  private incomingProjectile(): boolean {
    const ctx = this.engine as Record<string, unknown>;
    const projectiles = ctx['projectileSystem'] as { getActive?: () => Entity[] } | undefined;
    if (!projectiles || !projectiles.getActive) return false;

    for (const p of projectiles.getActive()) {
      const dx = p.x - this.entity.x;
      const dy = p.y - this.entity.y;
      if (dx * dx + dy * dy < PROJECTILE_DODGE_RADIUS * PROJECTILE_DODGE_RADIUS) {
        // Check if projectile is heading toward us (vy > 0 means falling)
        return true;
      }
    }
    return false;
  }

  private nearbyFire(): boolean {
    const ctx = this.engine as Record<string, unknown>;
    const entities = ctx['entityManager'] as { getInRadius?: (x: number, y: number, r: number) => Entity[] } | undefined;
    if (!entities || !entities.getInRadius) return false;

    const nearby = entities.getInRadius(this.entity.x, this.entity.y, FIRE_DETECT_RADIUS);
    for (const e of nearby) {
      if (e.getField<string>('entityType') === 'fire_effect') return true;
    }
    return false;
  }

  // -----------------------------------------------------------------------
  // Animation frame selection
  // -----------------------------------------------------------------------

  private updateFrame(): void {
    const state = this.entity.getField<string>('state') ?? 'idle';
    const unitType = this.entity.getField<string>('unitType') ?? 'archer';
    const frameIdx = this.animTimer > ANIM_FRAME_DURATION
      ? (this.animFrame = 1 - this.animFrame, this.animTimer = 0, this.animFrame)
      : this.animFrame;

    switch (state) {
      case 'idle':
        this.entity.setFrame(`${unitType}_idle_${frameIdx}`);
        break;
      case 'firing':
        this.entity.setFrame(`${unitType}_fire_${frameIdx % 3}`);
        break;
      case 'moving':
        this.entity.setFrame(`${unitType}_walk_${frameIdx}`);
        break;
      case 'melee':
        this.entity.setFrame(`${unitType}_melee_${frameIdx}`);
        break;
      case 'routing':
        this.entity.setFrame(`${unitType}_walk_${frameIdx}`);
        break;
      case 'covering':
        this.entity.setFrame(`${unitType}_cover`);
        break;
      case 'extinguishing':
        this.entity.setFrame(`${unitType}_walk_${frameIdx}`);
        break;
      case 'dead':
        this.entity.setFrame(`${unitType}_dead`);
        break;
      default:
        this.entity.setFrame(`${unitType}_idle_0`);
        break;
    }
  }
}
