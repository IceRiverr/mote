/**
 * ProjectileSystem — 投射物管理系统
 * 负责投射物的创建、抛物线弹道更新、着弹检测、AOE 伤害、特效触发与回收。
 *
 * 弹道公式:
 *   给定起点 (sx, sy) → 终点 (tx, ty):
 *     dx = tx - sx,  dy = ty - sy
 *     t  = |dx| / 200          (飞行时间基于水平距离)
 *     vx = dx / t
 *     vy = (dy - 0.5 * g * t²) / t
 *   每帧更新:
 *     x  += vx * dt
 *     vy += gravity * dt
 *     y  += vy * dt
 *     rotation = atan2(vy, vx)
 */

// ── Types ────────────────────────────────────────────────────────────────

/** Projectile type determines sprite, trail, and impact effect. */
export type ProjectileType =
  | 'arrow'
  | 'fire_arrow'
  | 'stone'
  | 'oil_pot'
  | 'trebuchet_stone'
  | 'crossbow_bolt';

/** Trail point for rendering projectile trails (fire arrows, etc.). */
export interface TrailPoint {
  x: number;
  y: number;
  alpha: number;     // fades over time
  age: number;       // seconds since creation
}

/** A single in-flight projectile. */
export interface Projectile {
  id: number;
  entity: unknown | null;     // optional mote Entity reference for sprite rendering
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  type: ProjectileType;
  damage: number;
  aoeRadius: number;
  side: 'attacker' | 'defender';
  rotation: number;
  trail: TrailPoint[];
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  active: boolean;
}

/** Lightweight entity-like interface used for AOE damage checks. */
export interface DamageableEntity {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  getField<T>(name: string): T;
  setField(name: string, value: unknown): void;
}

/** Callback to resolve ground height at a given world-x. */
export type GetGroundY = (worldX: number) => number;

/** Impact event payload emitted when a projectile lands. */
export interface ImpactEvent {
  projectileId: number;
  type: ProjectileType;
  x: number;
  y: number;
  damage: number;
  aoeRadius: number;
  side: 'attacker' | 'defender';
}

/** Listener signature for impact events. */
export type ImpactListener = (event: ImpactEvent) => void;

/** Listener signature for effect-spawn requests. */
export type EffectSpawnListener = (type: 'fire' | 'dust' | 'explosion', x: number, y: number) => void;

/** Resolver that returns damageable entities within a given radius. */
export type GetEntitiesInRadius = (x: number, y: number, radius: number) => DamageableEntity[];

// ── ProjectileSystem ─────────────────────────────────────────────────────

export class ProjectileSystem {
  /** All live projectiles. */
  active: Projectile[] = [];

  /** Default gravity in px/s^2. */
  readonly gravity: number = 400;

  /** Monotonically increasing ID counter. */
  private nextId: number = 1;

  /** Pool of recycled projectile objects to reduce GC pressure. */
  private pool: Projectile[] = [];

  /** Max trail points per projectile. */
  private readonly maxTrailPoints: number = 12;

  /** Trail point spawn interval in seconds. */
  private readonly trailInterval: number = 0.03;

  /** Accumulated trail timer per projectile (keyed by id). */
  private trailTimers: Map<number, number> = new Map();

  // ── External callbacks (set by game context) ───────────────────────

  /** Resolve ground height at world-x. Defaults to a flat y=600 ground. */
  getGroundY: GetGroundY = () => 600;

  /** Resolve entities within an AOE radius. Defaults to empty. */
  getEntitiesInRadius: GetEntitiesInRadius = () => [];

  /** Impact event listeners. */
  private impactListeners: ImpactListener[] = [];

  /** Effect-spawn listeners (bridge to EffectSystem). */
  private effectSpawnListeners: EffectSpawnListener[] = [];

  // ── Event subscription ────────────────────────────────────────────

  onImpact(listener: ImpactListener): void {
    this.impactListeners.push(listener);
  }

  onEffectSpawn(listener: EffectSpawnListener): void {
    this.effectSpawnListeners.push(listener);
  }

  private emitImpact(event: ImpactEvent): void {
    for (const listener of this.impactListeners) {
      listener(event);
    }
  }

  private emitEffectSpawn(type: 'fire' | 'dust' | 'explosion', x: number, y: number): void {
    for (const listener of this.effectSpawnListeners) {
      listener(type, x, y);
    }
  }

  // ── Launch ────────────────────────────────────────────────────────

  /**
   * Create and launch a new projectile along a parabolic arc from
   * (startX, startY) to (targetX, targetY).
   */
  launch(
    type: ProjectileType,
    startX: number,
    startY: number,
    targetX: number,
    targetY: number,
    damage: number,
    aoeRadius: number,
    side: 'attacker' | 'defender',
  ): Projectile {
    const proj = this.acquire();

    proj.id = this.nextId++;
    proj.entity = null;
    proj.x = startX;
    proj.y = startY;
    proj.type = type;
    proj.damage = damage;
    proj.aoeRadius = aoeRadius;
    proj.side = side;
    proj.startX = startX;
    proj.startY = startY;
    proj.targetX = targetX;
    proj.targetY = targetY;
    proj.active = true;
    proj.trail = [];
    proj.gravity = this.gravity;

    // ── Calculate initial velocity for parabolic arc ─────────────
    const dx = targetX - startX;
    const dy = targetY - startY;

    // Flight time proportional to horizontal distance.
    // Clamp minimum to avoid division-by-zero on very close shots.
    const t = Math.max(Math.abs(dx) / 200, 0.15);

    proj.vx = dx / t;
    // Solve: dy = vy*t + 0.5*g*t^2  =>  vy = (dy - 0.5*g*t^2) / t
    proj.vy = (dy - 0.5 * this.gravity * t * t) / t;
    proj.rotation = Math.atan2(proj.vy, proj.vx);

    this.active.push(proj);
    this.trailTimers.set(proj.id, 0);

    return proj;
  }

  // ── Update ────────────────────────────────────────────────────────

  /**
   * Advance all active projectiles by dt seconds.
   * Updates position, velocity (gravity), rotation, trail, and checks impact.
   */
  update(dt: number): void {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const proj = this.active[i];
      if (!proj.active) {
        this.active.splice(i, 1);
        continue;
      }

      // ── Physics integration ────────────────────────────────────
      proj.x += proj.vx * dt;
      proj.vy += proj.gravity * dt;
      proj.y += proj.vy * dt;

      // ── Rotation follows velocity direction ────────────────────
      proj.rotation = Math.atan2(proj.vy, proj.vx);

      // ── Trail ──────────────────────────────────────────────────
      this.updateTrail(proj, dt);

      // ── Ground collision ───────────────────────────────────────
      if (this.checkImpact(proj, this.getGroundY)) {
        this.handleImpact(proj);
        this.active.splice(i, 1);
        continue;
      }

      // ── Safety: off-screen culling (projectile went way too far) ─
      if (proj.y > 2000 || proj.x < -500 || proj.x > 10000) {
        this.recycle(proj);
        this.active.splice(i, 1);
      }
    }
  }

  // ── Trail management ──────────────────────────────────────────────

  private updateTrail(proj: Projectile, dt: number): void {
    // Only fire arrows and oil pots leave visible trails
    if (proj.type !== 'fire_arrow' && proj.type !== 'oil_pot') return;

    const timer = (this.trailTimers.get(proj.id) ?? 0) + dt;
    this.trailTimers.set(proj.id, timer);

    if (timer >= this.trailInterval) {
      this.trailTimers.set(proj.id, 0);
      proj.trail.push({ x: proj.x, y: proj.y, alpha: 1.0, age: 0 });

      // Cap trail length
      if (proj.trail.length > this.maxTrailPoints) {
        proj.trail.shift();
      }
    }

    // Age and fade existing trail points
    for (let t = proj.trail.length - 1; t >= 0; t--) {
      const pt = proj.trail[t];
      pt.age += dt;
      pt.alpha = Math.max(0, 1.0 - pt.age / 0.5); // fade over 0.5s
      if (pt.alpha <= 0) {
        proj.trail.splice(t, 1);
      }
    }
  }

  // ── Impact detection ──────────────────────────────────────────────

  /**
   * Check whether the projectile has hit (or passed through) the ground.
   */
  checkImpact(proj: Projectile, getGroundY: GetGroundY): boolean {
    const groundY = getGroundY(proj.x);
    return proj.y >= groundY;
  }

  /**
   * Handle impact: snap to ground, apply AOE damage, emit events, spawn effects.
   * Called internally when checkImpact returns true.
   */
  private handleImpact(proj: Projectile): void {
    // Snap y to ground level for visual consistency
    const groundY = this.getGroundY(proj.x);
    proj.y = groundY;

    this.applyImpact(proj);
  }

  /**
   * Public impact handler — apply AOE damage, emit impact event, create effects.
   * Can also be called directly if an external system detects a collision
   * (e.g., hitting a wall segment before reaching the ground).
   */
  applyImpact(proj: Projectile): void {
    // ── AOE damage ───────────────────────────────────────────────
    if (proj.aoeRadius > 0) {
      const targets = this.getEntitiesInRadius(proj.x, proj.y, proj.aoeRadius);
      for (const target of targets) {
        // Skip friendly fire (same side check via entity field)
        const targetSide = target.getField<string>('side');
        if (targetSide === proj.side) continue;

        const dx = target.x + target.width / 2 - proj.x;
        const dy = target.y + target.height / 2 - proj.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // Linear damage falloff from center to edge of AOE
        const falloff = Math.max(0, 1 - dist / proj.aoeRadius);
        const appliedDamage = proj.damage * falloff;

        if (appliedDamage > 0) {
          const currentHp = target.getField<number>('hp') ?? 0;
          target.setField('hp', Math.max(0, currentHp - appliedDamage));
        }
      }
    } else {
      // Single-target damage (non-AOE projectiles like arrows)
      const targets = this.getEntitiesInRadius(proj.x, proj.y, 16);
      if (targets.length > 0) {
        const closest = targets[0];
        const targetSide = closest.getField<string>('side');
        if (targetSide !== proj.side) {
          const currentHp = closest.getField<number>('hp') ?? 0;
          closest.setField('hp', Math.max(0, currentHp - proj.damage));
        }
      }
    }

    // ── Emit impact event ────────────────────────────────────────
    this.emitImpact({
      projectileId: proj.id,
      type: proj.type,
      x: proj.x,
      y: proj.y,
      damage: proj.damage,
      aoeRadius: proj.aoeRadius,
      side: proj.side,
    });

    // ── Spawn visual effect based on type ────────────────────────
    switch (proj.type) {
      case 'fire_arrow':
      case 'oil_pot':
        this.emitEffectSpawn('fire', proj.x, proj.y);
        break;
      case 'trebuchet_stone':
        this.emitEffectSpawn('explosion', proj.x, proj.y);
        break;
      case 'stone':
      case 'arrow':
      case 'crossbow_bolt':
      default:
        this.emitEffectSpawn('dust', proj.x, proj.y);
        break;
    }

    // ── Recycle ──────────────────────────────────────────────────
    this.recycle(proj);
  }

  // ── Query ─────────────────────────────────────────────────────────

  /** Return all currently active projectiles for rendering. */
  getActive(): Projectile[] {
    return this.active;
  }

  /** Get active projectile count. */
  getCount(): number {
    return this.active.length;
  }

  // ── Object pool ───────────────────────────────────────────────────

  /** Deactivate a projectile and return it to the pool. */
  recycle(proj: Projectile): void {
    proj.active = false;
    proj.entity = null;
    proj.trail.length = 0;
    this.trailTimers.delete(proj.id);
    this.pool.push(proj);
  }

  /** Acquire a projectile from the pool or create a fresh one. */
  private acquire(): Projectile {
    if (this.pool.length > 0) {
      return this.pool.pop()!;
    }
    return {
      id: 0,
      entity: null,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      gravity: this.gravity,
      type: 'arrow',
      damage: 0,
      aoeRadius: 0,
      side: 'attacker',
      rotation: 0,
      trail: [],
      startX: 0,
      startY: 0,
      targetX: 0,
      targetY: 0,
      active: false,
    };
  }

  /** Clear all projectiles (e.g., on level reset). */
  clear(): void {
    for (const proj of this.active) {
      this.recycle(proj);
    }
    this.active.length = 0;
  }
}
