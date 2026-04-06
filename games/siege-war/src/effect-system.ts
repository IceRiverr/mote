/**
 * EffectSystem — Visual effects management
 *
 * Manages all transient visual effects: fire, smoke, dust, explosions,
 * blood splatter, arrow trails, and oil pouring. Each effect has frame-based
 * animation, alpha decay, optional position drift, and a fixed duration.
 *
 * Fire effects can probabilistically spread to adjacent flammable tiles.
 * Smoke drifts upward. Explosions expand and fade. Oil pours downward.
 */

// ── Types ────────────────────────────────────────────────────────────────

/** Visual effect type determines animation behavior and rendering. */
export type EffectType =
  | 'fire'
  | 'smoke'
  | 'dust'
  | 'explosion'
  | 'blood'
  | 'arrow_trail'
  | 'oil_pour';

/** A single active visual effect instance. */
export interface Effect {
  /** Unique identifier. */
  id: number;
  /** Effect type — determines animation and rendering behavior. */
  type: EffectType;
  /** World position X. */
  x: number;
  /** World position Y. */
  y: number;
  /** Current animation frame index (0-based). */
  frame: number;
  /** Total number of animation frames for this effect type. */
  maxFrames: number;
  /** Elapsed time since creation (seconds). */
  elapsed: number;
  /** Total duration before the effect is recycled (seconds). */
  duration: number;
  /** Optional damage-per-second (fire effects). */
  damage?: number;
  /** Optional probability (0-1) of spreading to adjacent tiles each second (fire). */
  spreadChance?: number;
  /** Current alpha/opacity (1.0 = fully opaque, decays over time). */
  alpha: number;
  /** Current scale multiplier (used for explosions expanding). */
  scale: number;
  /** Velocity X for drifting effects (smoke). */
  vx: number;
  /** Velocity Y for drifting effects (smoke rises, oil falls). */
  vy: number;
  /** Whether this effect is still active. */
  active: boolean;
  /** Start X for line-based effects (arrow_trail). */
  startX?: number;
  /** Start Y for line-based effects (arrow_trail). */
  startY?: number;
  /** End X for line-based effects (arrow_trail). */
  endX?: number;
  /** End Y for line-based effects (arrow_trail). */
  endY?: number;
}

/** Position descriptor for flammable tiles near a fire. */
export interface FlammableTile {
  x: number;
  y: number;
  /** Whether this tile is currently on fire already. */
  onFire: boolean;
}

// ── Default durations and frame counts per effect type ────────────────

const EFFECT_DEFAULTS: Record<
  EffectType,
  { maxFrames: number; duration: number }
> = {
  fire:        { maxFrames: 8, duration: 4.0 },
  smoke:       { maxFrames: 6, duration: 2.5 },
  dust:        { maxFrames: 4, duration: 0.6 },
  explosion:   { maxFrames: 8, duration: 1.0 },
  blood:       { maxFrames: 4, duration: 0.8 },
  arrow_trail: { maxFrames: 1, duration: 0.4 },
  oil_pour:    { maxFrames: 6, duration: 3.0 },
};

// ── EffectSystem ─────────────────────────────────────────────────────────

export class EffectSystem {
  /** All currently active effects. */
  active: Effect[] = [];

  /** Monotonically increasing ID counter. */
  private nextId: number = 1;

  /** Pool of recycled Effect objects. */
  private pool: Effect[] = [];

  /** Fire spread check interval accumulator (seconds). */
  private fireSpreadTimer: number = 0;

  /** How often to check fire spread (seconds). */
  private readonly fireSpreadInterval: number = 0.5;

  /** External callback: get flammable tiles near a position. */
  getNearbyFlammable: (x: number, y: number, radius: number) => FlammableTile[] =
    () => [];

  /** External callback: notify that a fire has spread to a new tile. */
  onFireSpread: (x: number, y: number) => void = () => {};

  // ── Spawn methods ─────────────────────────────────────────────────

  /**
   * Spawn a fire effect. Fire has frame animation, can deal damage over time,
   * and may spread to adjacent flammable tiles.
   */
  spawnFire(x: number, y: number, duration?: number, damage?: number): Effect {
    const defaults = EFFECT_DEFAULTS.fire;
    const effect = this.acquire();

    effect.id = this.nextId++;
    effect.type = 'fire';
    effect.x = x;
    effect.y = y;
    effect.frame = 0;
    effect.maxFrames = defaults.maxFrames;
    effect.elapsed = 0;
    effect.duration = duration ?? defaults.duration;
    effect.damage = damage ?? 5;
    effect.spreadChance = 0.15;
    effect.alpha = 1.0;
    effect.scale = 1.0;
    effect.vx = 0;
    effect.vy = 0;
    effect.active = true;
    effect.startX = undefined;
    effect.startY = undefined;
    effect.endX = undefined;
    effect.endY = undefined;

    this.active.push(effect);
    return effect;
  }

  /**
   * Spawn a smoke effect. Smoke drifts upward with slight horizontal sway
   * and fades out over its duration.
   */
  spawnSmoke(x: number, y: number, duration?: number): Effect {
    const defaults = EFFECT_DEFAULTS.smoke;
    const effect = this.acquire();

    effect.id = this.nextId++;
    effect.type = 'smoke';
    effect.x = x;
    effect.y = y;
    effect.frame = 0;
    effect.maxFrames = defaults.maxFrames;
    effect.elapsed = 0;
    effect.duration = duration ?? defaults.duration;
    effect.damage = undefined;
    effect.spreadChance = undefined;
    effect.alpha = 0.7;
    effect.scale = 0.8;
    // Drift upward with slight random horizontal sway
    effect.vx = (Math.random() - 0.5) * 10;
    effect.vy = -30 - Math.random() * 20; // upward
    effect.active = true;
    effect.startX = undefined;
    effect.startY = undefined;
    effect.endX = undefined;
    effect.endY = undefined;

    this.active.push(effect);
    return effect;
  }

  /**
   * Spawn a dust cloud from impact. Short-lived, expands slightly.
   */
  spawnDust(x: number, y: number): Effect {
    const defaults = EFFECT_DEFAULTS.dust;
    const effect = this.acquire();

    effect.id = this.nextId++;
    effect.type = 'dust';
    effect.x = x;
    effect.y = y;
    effect.frame = 0;
    effect.maxFrames = defaults.maxFrames;
    effect.elapsed = 0;
    effect.duration = defaults.duration;
    effect.damage = undefined;
    effect.spreadChance = undefined;
    effect.alpha = 0.8;
    effect.scale = 0.5;
    effect.vx = 0;
    effect.vy = -5;
    effect.active = true;
    effect.startX = undefined;
    effect.startY = undefined;
    effect.endX = undefined;
    effect.endY = undefined;

    this.active.push(effect);
    return effect;
  }

  /**
   * Spawn an explosion effect (wall collapse, large projectile impact).
   * Expands rapidly and fades.
   */
  spawnExplosion(x: number, y: number): Effect {
    const defaults = EFFECT_DEFAULTS.explosion;
    const effect = this.acquire();

    effect.id = this.nextId++;
    effect.type = 'explosion';
    effect.x = x;
    effect.y = y;
    effect.frame = 0;
    effect.maxFrames = defaults.maxFrames;
    effect.elapsed = 0;
    effect.duration = defaults.duration;
    effect.damage = undefined;
    effect.spreadChance = undefined;
    effect.alpha = 1.0;
    effect.scale = 0.3; // starts small, grows
    effect.vx = 0;
    effect.vy = 0;
    effect.active = true;
    effect.startX = undefined;
    effect.startY = undefined;
    effect.endX = undefined;
    effect.endY = undefined;

    this.active.push(effect);
    return effect;
  }

  /**
   * Spawn a blood splatter effect. Quick, short-lived, no drift.
   */
  spawnBlood(x: number, y: number): Effect {
    const defaults = EFFECT_DEFAULTS.blood;
    const effect = this.acquire();

    effect.id = this.nextId++;
    effect.type = 'blood';
    effect.x = x;
    effect.y = y;
    effect.frame = 0;
    effect.maxFrames = defaults.maxFrames;
    effect.elapsed = 0;
    effect.duration = defaults.duration;
    effect.damage = undefined;
    effect.spreadChance = undefined;
    effect.alpha = 0.9;
    effect.scale = 0.6 + Math.random() * 0.4;
    effect.vx = 0;
    effect.vy = 0;
    effect.active = true;
    effect.startX = undefined;
    effect.startY = undefined;
    effect.endX = undefined;
    effect.endY = undefined;

    this.active.push(effect);
    return effect;
  }

  /**
   * Spawn an oil pour effect flowing down from the wall top.
   *
   * @param x          World-x of the pour point (wall top)
   * @param y          World-y of the wall top
   * @param wallHeight Height of the wall in pixels (oil flows this distance down)
   */
  spawnOilPour(x: number, y: number, wallHeight: number): Effect {
    const defaults = EFFECT_DEFAULTS.oil_pour;
    const effect = this.acquire();

    effect.id = this.nextId++;
    effect.type = 'oil_pour';
    effect.x = x;
    effect.y = y;
    effect.frame = 0;
    effect.maxFrames = defaults.maxFrames;
    effect.elapsed = 0;
    effect.duration = defaults.duration;
    effect.damage = 15;
    effect.spreadChance = undefined;
    effect.alpha = 0.9;
    effect.scale = 1.0;
    effect.vx = 0;
    // Oil flows downward — speed calculated to cover wall height over ~1 second
    effect.vy = Math.max(wallHeight, 50);
    effect.active = true;
    effect.startX = undefined;
    effect.startY = undefined;
    effect.endX = undefined;
    effect.endY = undefined;

    this.active.push(effect);
    return effect;
  }

  /**
   * Spawn an arrow volley trail — a line-based effect from start to end.
   * Very short-lived, rendered as a streak.
   */
  spawnArrowTrail(startX: number, startY: number, endX: number, endY: number): Effect {
    const defaults = EFFECT_DEFAULTS.arrow_trail;
    const effect = this.acquire();

    effect.id = this.nextId++;
    effect.type = 'arrow_trail';
    // Position at midpoint for culling/sorting
    effect.x = (startX + endX) / 2;
    effect.y = (startY + endY) / 2;
    effect.frame = 0;
    effect.maxFrames = defaults.maxFrames;
    effect.elapsed = 0;
    effect.duration = defaults.duration;
    effect.damage = undefined;
    effect.spreadChance = undefined;
    effect.alpha = 0.6;
    effect.scale = 1.0;
    effect.vx = 0;
    effect.vy = 0;
    effect.active = true;
    effect.startX = startX;
    effect.startY = startY;
    effect.endX = endX;
    effect.endY = endY;

    this.active.push(effect);
    return effect;
  }

  // ── Update ────────────────────────────────────────────────────────

  /**
   * Advance all active effects by dt seconds.
   * Handles: frame animation, alpha decay, position drift (smoke/oil),
   * scale changes (explosion/dust), and fire spread checks.
   */
  update(dt: number): void {
    // ── Fire spread check (throttled) ────────────────────────────
    this.fireSpreadTimer += dt;
    const shouldCheckSpread = this.fireSpreadTimer >= this.fireSpreadInterval;
    if (shouldCheckSpread) {
      this.fireSpreadTimer -= this.fireSpreadInterval;
    }

    // ── Update each effect ───────────────────────────────────────
    for (let i = this.active.length - 1; i >= 0; i--) {
      const effect = this.active[i];
      if (!effect.active) {
        this.active.splice(i, 1);
        continue;
      }

      effect.elapsed += dt;

      // ── Duration expiry ────────────────────────────────────────
      if (effect.elapsed >= effect.duration) {
        this.recycle(effect);
        this.active.splice(i, 1);
        continue;
      }

      // ── Progress ratio (0→1) ──────────────────────────────────
      const progress = effect.elapsed / effect.duration;

      // ── Frame animation ────────────────────────────────────────
      // Distribute frames evenly across the duration
      if (effect.maxFrames > 1) {
        const frameDuration = effect.duration / effect.maxFrames;
        effect.frame = Math.min(
          effect.maxFrames - 1,
          Math.floor(effect.elapsed / frameDuration),
        );
      }

      // ── Type-specific behavior ─────────────────────────────────
      switch (effect.type) {
        case 'fire':
          this.updateFire(effect, dt, progress, shouldCheckSpread);
          break;
        case 'smoke':
          this.updateSmoke(effect, dt, progress);
          break;
        case 'dust':
          this.updateDust(effect, dt, progress);
          break;
        case 'explosion':
          this.updateExplosion(effect, dt, progress);
          break;
        case 'blood':
          this.updateBlood(effect, dt, progress);
          break;
        case 'arrow_trail':
          this.updateArrowTrail(effect, dt, progress);
          break;
        case 'oil_pour':
          this.updateOilPour(effect, dt, progress);
          break;
      }
    }
  }

  // ── Per-type update behaviors ─────────────────────────────────────

  private updateFire(
    effect: Effect,
    dt: number,
    progress: number,
    checkSpread: boolean,
  ): void {
    // Fire flickers — alpha oscillates slightly
    effect.alpha = 0.8 + Math.sin(effect.elapsed * 8) * 0.2;

    // Fire fades out in the last 25% of its duration
    if (progress > 0.75) {
      effect.alpha *= 1 - (progress - 0.75) / 0.25;
    }

    // Scale pulses slightly
    effect.scale = 1.0 + Math.sin(effect.elapsed * 6) * 0.1;

    // Fire generates smoke above it periodically
    // (handled via spawn; callers can hook into this pattern)

    // Fire spread check
    if (checkSpread && effect.spreadChance && effect.spreadChance > 0) {
      this.checkFireSpread(effect, this.getNearbyFlammable(effect.x, effect.y, 48));
    }
  }

  private updateSmoke(effect: Effect, dt: number, progress: number): void {
    // Drift upward with horizontal sway
    effect.x += effect.vx * dt;
    effect.y += effect.vy * dt;

    // Add slight horizontal oscillation (wind)
    effect.vx += (Math.random() - 0.5) * 5 * dt;
    effect.vx = Math.max(-15, Math.min(15, effect.vx)); // clamp sway

    // Expand as it rises
    effect.scale = 0.8 + progress * 0.8;

    // Fade out linearly
    effect.alpha = 0.7 * (1 - progress);
  }

  private updateDust(effect: Effect, _dt: number, progress: number): void {
    // Expand quickly, then fade
    effect.scale = 0.5 + progress * 1.5;
    effect.alpha = 0.8 * (1 - progress);
  }

  private updateExplosion(effect: Effect, _dt: number, progress: number): void {
    // Expand rapidly
    if (progress < 0.3) {
      // Fast expansion phase
      effect.scale = 0.3 + (progress / 0.3) * 1.7;
    } else {
      // Slow settle
      effect.scale = 2.0 + (progress - 0.3) * 0.3;
    }

    // Bright at start, fades after peak
    if (progress < 0.2) {
      effect.alpha = 1.0;
    } else {
      effect.alpha = 1.0 * (1 - (progress - 0.2) / 0.8);
    }
  }

  private updateBlood(effect: Effect, _dt: number, progress: number): void {
    // Quick splatter: stays opaque briefly, then fades
    if (progress < 0.3) {
      effect.alpha = 0.9;
    } else {
      effect.alpha = 0.9 * (1 - (progress - 0.3) / 0.7);
    }
  }

  private updateArrowTrail(effect: Effect, _dt: number, progress: number): void {
    // Simple linear fade
    effect.alpha = 0.6 * (1 - progress);
  }

  private updateOilPour(effect: Effect, dt: number, progress: number): void {
    // Oil flows downward
    effect.y += effect.vy * dt;

    // Scale widens slightly as it falls (spreads)
    effect.scale = 1.0 + progress * 0.3;

    // Alpha stays high until last 20%
    if (progress > 0.8) {
      effect.alpha = 0.9 * (1 - (progress - 0.8) / 0.2);
    } else {
      effect.alpha = 0.9;
    }
  }

  // ── Fire spread logic ─────────────────────────────────────────────

  /**
   * Probability-based fire spread: for each nearby flammable tile that
   * is not already on fire, roll against spreadChance to ignite it.
   */
  checkFireSpread(effect: Effect, nearbyFlammable: FlammableTile[]): void {
    if (!effect.spreadChance || effect.spreadChance <= 0) return;
    if (nearbyFlammable.length === 0) return;

    for (const tile of nearbyFlammable) {
      if (tile.onFire) continue;

      // Roll for spread
      if (Math.random() < effect.spreadChance) {
        // Spawn a new fire at the adjacent tile
        this.spawnFire(
          tile.x,
          tile.y,
          effect.duration * 0.8, // slightly shorter than parent
          effect.damage,
        );
        // Notify external systems
        this.onFireSpread(tile.x, tile.y);

        // Mark tile as on fire so we don't ignite it again this cycle
        tile.onFire = true;
      }
    }
  }

  // ── Query ─────────────────────────────────────────────────────────

  /** Return all currently active effects for rendering. */
  getActive(): Effect[] {
    return this.active;
  }

  /** Get active effect count. */
  getCount(): number {
    return this.active.length;
  }

  /** Get all active fire effects (useful for fire-damage-over-time checks). */
  getActiveFires(): Effect[] {
    return this.active.filter((e) => e.type === 'fire' && e.active);
  }

  // ── Object pool ───────────────────────────────────────────────────

  /** Deactivate an effect and return it to the pool. */
  recycle(effect: Effect): void {
    effect.active = false;
    this.pool.push(effect);
  }

  /** Acquire an effect from the pool or create a fresh one. */
  private acquire(): Effect {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return {
      id: 0,
      type: 'dust',
      x: 0,
      y: 0,
      frame: 0,
      maxFrames: 1,
      elapsed: 0,
      duration: 1,
      damage: undefined,
      spreadChance: undefined,
      alpha: 1,
      scale: 1,
      vx: 0,
      vy: 0,
      active: false,
      startX: undefined,
      startY: undefined,
      endX: undefined,
      endY: undefined,
    };
  }

  /** Clear all effects (e.g., on level reset). */
  clear(): void {
    for (const effect of this.active) {
      this.recycle(effect);
    }
    this.active.length = 0;
    this.fireSpreadTimer = 0;
  }
}
