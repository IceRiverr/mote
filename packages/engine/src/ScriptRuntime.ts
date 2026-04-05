// ═════════════════════════════════════════════════════════════════════════════
// ScriptRuntime — dynamic script loading and lifecycle management for entities
// ═════════════════════════════════════════════════════════════════════════════

import type { Entity } from './Entity.js';

// ── Script lifecycle interface ────────────────────────────────────────────────

/**
 * Scripts attached to entities implement some or all of these hooks.
 * A script class default-exports a constructor that receives (entity, engine).
 */
export interface ScriptLifecycle {
  /** Called every frame with the delta time in seconds. */
  update?(dt: number): void;
  /** Called on the first frame the entity collides with another entity. */
  onCollisionEnter?(other: Entity): void;
  /** Called on the first frame after a collision pair separates. */
  onCollisionExit?(other: Entity): void;
  /** Called when another entity (typically the player) interacts with this entity. */
  onInteract?(player: Entity): void;
  /** Called when the entity is removed from the scene or the scene is unloaded. */
  onDestroy?(): void;
}

// ── ScriptRuntime ─────────────────────────────────────────────────────────────

/**
 * Manages script class loading, instantiation, and per-frame lifecycle dispatch.
 *
 * Usage:
 *   const runtime = new ScriptRuntime();
 *   await runtime.bindScript(entity, '/scripts/npc.ts', engineRef);
 *   // Each frame:
 *   runtime.updateAll(dt);
 */
export class ScriptRuntime {
  /**
   * Cache of loaded script constructors keyed by canonical path.
   * Avoids redundant dynamic imports.
   */
  private scriptCache = new Map<
    string,
    new (entity: Entity, engine: unknown) => ScriptLifecycle
  >();

  /** Active script instances keyed by entity ID. */
  private activeScripts = new Map<string, ScriptLifecycle>();

  // ── Loading ─────────────────────────────────────────────────────────────

  /**
   * Dynamically import a script module and cache its default export class.
   * The module must `export default class ... { constructor(entity, engine) { ... } }`
   */
  async loadScript(
    path: string,
  ): Promise<new (entity: Entity, engine: unknown) => ScriptLifecycle> {
    const cached = this.scriptCache.get(path);
    if (cached) return cached;

    try {
      // Use @vite-ignore so Vite does not try to statically analyse the import
      const module = await (import(/* @vite-ignore */ path) as Promise<any>);
      const ScriptClass = module.default;

      if (typeof ScriptClass !== 'function') {
        throw new Error(
          `Script "${path}" does not export a default class / constructor function`,
        );
      }

      this.scriptCache.set(path, ScriptClass);
      return ScriptClass;
    } catch (err) {
      console.error(`[ScriptRuntime] Failed to load script: ${path}`, err);
      throw err;
    }
  }

  // ── Binding ─────────────────────────────────────────────────────────────

  /**
   * Load a script (if not cached) and instantiate it for the given entity.
   * Returns the script instance, or null if loading failed.
   */
  async bindScript(
    entity: Entity,
    scriptPath: string,
    engine: unknown,
  ): Promise<ScriptLifecycle | null> {
    try {
      const ScriptClass = await this.loadScript(scriptPath);
      const instance = new ScriptClass(entity, engine);
      this.activeScripts.set(entity.id, instance);
      return instance;
    } catch {
      return null;
    }
  }

  // ── Per-frame dispatch ──────────────────────────────────────────────────

  /** Call `update(dt)` on every active script. */
  updateAll(dt: number): void {
    for (const script of this.activeScripts.values()) {
      if (script.update) {
        try {
          script.update(dt);
        } catch (err) {
          console.error('[ScriptRuntime] Error in script update:', err);
        }
      }
    }
  }

  // ── Collision notifications ─────────────────────────────────────────────

  /** Notify a script that its entity just started colliding with `other`. */
  notifyCollisionEnter(entityId: string, other: Entity): void {
    const script = this.activeScripts.get(entityId);
    if (script?.onCollisionEnter) {
      try {
        script.onCollisionEnter(other);
      } catch (err) {
        console.error('[ScriptRuntime] Error in onCollisionEnter:', err);
      }
    }
  }

  /** Notify a script that its entity just stopped colliding with `other`. */
  notifyCollisionExit(entityId: string, other: Entity): void {
    const script = this.activeScripts.get(entityId);
    if (script?.onCollisionExit) {
      try {
        script.onCollisionExit(other);
      } catch (err) {
        console.error('[ScriptRuntime] Error in onCollisionExit:', err);
      }
    }
  }

  /** Notify a script that its entity was interacted with by `player`. */
  notifyInteract(entityId: string, player: Entity): void {
    const script = this.activeScripts.get(entityId);
    if (script?.onInteract) {
      try {
        script.onInteract(player);
      } catch (err) {
        console.error('[ScriptRuntime] Error in onInteract:', err);
      }
    }
  }

  // ── Cleanup ─────────────────────────────────────────────────────────────

  /** Destroy a single entity's script, calling its onDestroy hook. */
  destroyScript(entityId: string): void {
    const script = this.activeScripts.get(entityId);
    if (script) {
      try {
        script.onDestroy?.();
      } catch (err) {
        console.error('[ScriptRuntime] Error in onDestroy:', err);
      }
      this.activeScripts.delete(entityId);
    }
  }

  /** Destroy all active scripts. Called on scene unload. */
  destroyAll(): void {
    for (const [_id, script] of this.activeScripts) {
      try {
        script.onDestroy?.();
      } catch (err) {
        console.error('[ScriptRuntime] Error in onDestroy:', err);
      }
    }
    this.activeScripts.clear();
  }

  // ── Queries ─────────────────────────────────────────────────────────────

  /** Get the script instance bound to an entity, if any. */
  getScript(entityId: string): ScriptLifecycle | undefined {
    return this.activeScripts.get(entityId);
  }

  /** Check if an entity has an active script. */
  hasScript(entityId: string): boolean {
    return this.activeScripts.has(entityId);
  }

  /** Number of active script instances. */
  get activeCount(): number {
    return this.activeScripts.size;
  }
}
