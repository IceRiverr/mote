/**
 * entity-spawner.ts — Dynamic entity creation, recycling, and spatial queries.
 *
 * Extends the road-rash EntitySpawner pattern with siege-war specific features:
 *  - spawnWithScript() for script attachment (soldiers, siege engines, etc.)
 *  - getByType() for filtering entities by type field (archer, wall-segment, etc.)
 *  - getInRadius() for AOE queries (projectile impacts, listening pots)
 *  - getByField() for arbitrary field-value filtering
 *  - getVisible() for camera-frustum culling during rendering
 *
 * Entity pool keyed by templateId for efficient reuse of recycled entities.
 */

import { Entity, SceneManager, ScriptRuntime } from '@mote/engine';
import type { EntityInstanceRuntime, ScriptLifecycle } from '@mote/engine';
import type { BattlefieldCamera } from './battlefield-camera';

/** Script class constructor type for spawnWithScript. */
export type ScriptClass = new (entity: Entity, engine: unknown) => ScriptLifecycle;

export class EntitySpawner {
  private sceneManager: SceneManager;
  private scriptRuntime: ScriptRuntime;
  private engine: unknown;

  /** Active (in-use) entities, keyed by their unique ID. */
  private activeEntities: Map<string, Entity> = new Map();

  /** Object pool: recycled entities grouped by templateId. */
  private pool: Map<string, Entity[]> = new Map();

  /** Monotonically increasing counter for unique entity IDs. */
  private nextId = 1;

  constructor(
    sceneManager: SceneManager,
    scriptRuntime: ScriptRuntime,
    engine: unknown,
  ) {
    this.sceneManager = sceneManager;
    this.scriptRuntime = scriptRuntime;
    this.engine = engine;
  }

  // ── Core spawn / recycle ────────────────────────────────────────────────

  /**
   * Spawn an entity from a template definition.
   *
   * If the pool has a recycled entity of the same template, reuse it.
   * Otherwise, create a new Entity from the definition.
   *
   * @param templateId - Entity definition ID (e.g. "soldier", "wall-segment")
   * @param x - World X position
   * @param y - World Y position
   * @param fields - Optional field overrides
   * @returns The spawned Entity
   */
  spawn(
    templateId: string,
    x: number,
    y: number,
    fields?: Record<string, unknown>,
  ): Entity {
    const def = this.sceneManager.getEntityDef(templateId);
    if (!def) {
      throw new Error(`EntitySpawner: unknown entity template "${templateId}"`);
    }

    // Try to reuse from pool
    const pooled = this.pool.get(templateId);
    if (pooled && pooled.length > 0) {
      const entity = pooled.pop()!;

      // Reset position and size
      entity.x = x;
      entity.y = y;
      entity.width = def.width;
      entity.height = def.height;
      entity.visible = true;

      // Reset fields to defaults from definition, then apply overrides
      for (const fieldDef of def.fields) {
        entity.setField(fieldDef.id, fieldDef.default);
      }
      if (fields) {
        for (const [key, value] of Object.entries(fields)) {
          entity.setField(key, value);
        }
      }

      // Reset sprite frame to default
      if (def.sprite) {
        entity.setFrame(def.sprite.frameId, def.sprite.sheetId);
      }

      this.activeEntities.set(entity.id, entity);
      return entity;
    }

    // Create new entity with a minimal EntityInstanceRuntime
    const uniqueId = `spawned_${templateId}_${this.nextId++}`;

    // Build fields map: start with defaults, apply overrides
    const fieldValues: Record<string, unknown> = {};
    for (const fieldDef of def.fields) {
      fieldValues[fieldDef.id] = fieldDef.default;
    }
    if (fields) {
      for (const [key, value] of Object.entries(fields)) {
        fieldValues[key] = value;
      }
    }

    const instanceRuntime: EntityInstanceRuntime = {
      id: uniqueId,
      template: templateId,
      name: `${def.name}_${this.nextId}`,
      x,
      y,
      width: def.width,
      height: def.height,
      fields: fieldValues,
    };

    const entity = new Entity(instanceRuntime, def, this.sceneManager);
    this.activeEntities.set(entity.id, entity);
    return entity;
  }

  /**
   * Spawn an entity and bind a script class to it.
   * Used for entities that need AI/behavior (soldiers, siege engines, projectiles).
   *
   * If the entity definition has a built-in scriptPath, that is used.
   * Otherwise the provided scriptClass is instantiated and bound directly.
   *
   * @param templateId - Entity definition ID
   * @param x - World X position
   * @param y - World Y position
   * @param scriptClass - Script constructor to bind
   * @param fields - Optional field overrides
   * @returns The spawned Entity (script is bound synchronously via class)
   */
  spawnWithScript(
    templateId: string,
    x: number,
    y: number,
    scriptClass: ScriptClass,
    fields?: Record<string, unknown>,
  ): Entity {
    const entity = this.spawn(templateId, x, y, fields);

    // Instantiate the script and bind it to the entity via ScriptRuntime
    const scriptInstance = new scriptClass(entity, this.engine);
    (this.scriptRuntime as any).activeScripts.set(entity.id, scriptInstance);

    return entity;
  }

  /**
   * Spawn an entity and bind its script using the definition's scriptPath.
   * Returns a promise since script loading is async.
   *
   * @param templateId - Entity definition ID
   * @param x - World X position
   * @param y - World Y position
   * @param fields - Optional field overrides
   * @returns Promise resolving to the spawned Entity
   */
  async spawnWithDefinitionScript(
    templateId: string,
    x: number,
    y: number,
    fields?: Record<string, unknown>,
  ): Promise<Entity> {
    const entity = this.spawn(templateId, x, y, fields);
    const def = this.sceneManager.getEntityDef(templateId);
    if (def?.scriptPath) {
      await this.scriptRuntime.bindScript(entity, def.scriptPath, this.engine);
    }
    return entity;
  }

  /**
   * Recycle an entity back into the pool.
   * Hides it, destroys its script (if any), and makes it available for reuse.
   */
  recycle(entity: Entity): void {
    entity.visible = false;

    // Destroy the script if one was bound
    if (this.scriptRuntime.hasScript(entity.id)) {
      this.scriptRuntime.destroyScript(entity.id);
    }

    this.activeEntities.delete(entity.id);

    // Add to pool by template
    const templateId = entity.templateId;
    let poolList = this.pool.get(templateId);
    if (!poolList) {
      poolList = [];
      this.pool.set(templateId, poolList);
    }
    poolList.push(entity);
  }

  // ── Query: by ID ────────────────────────────────────────────────────────

  /**
   * Get an active entity by its unique ID.
   */
  getById(id: string): Entity | undefined {
    return this.activeEntities.get(id);
  }

  // ── Query: by template ──────────────────────────────────────────────────

  /**
   * Get all currently active entities, optionally filtered by templateId.
   */
  getActive(templateId?: string): Entity[] {
    if (!templateId) {
      return Array.from(this.activeEntities.values());
    }
    const result: Entity[] = [];
    for (const entity of this.activeEntities.values()) {
      if (entity.templateId === templateId) {
        result.push(entity);
      }
    }
    return result;
  }

  // ── Query: by entity type field ─────────────────────────────────────────

  /**
   * Get all active entities whose "entityType" field matches the given type.
   * Entity types include: "soldier", "archer", "siege_engine", "projectile",
   * "wall_segment", "structure", "effect", etc.
   *
   * @param entityType - Value to match against the "entityType" field
   * @returns Array of matching entities
   */
  getByType(entityType: string): Entity[] {
    const result: Entity[] = [];
    for (const entity of this.activeEntities.values()) {
      if (entity.getField<string>('entityType') === entityType) {
        result.push(entity);
      }
    }
    return result;
  }

  // ── Query: spatial radius (AOE) ─────────────────────────────────────────

  /**
   * Get all active entities within a radius of a world point.
   * Used for AOE damage (projectile impacts), listening pot detection,
   * and proximity-based queries.
   *
   * @param x - World X center of the search circle
   * @param y - World Y center of the search circle
   * @param radius - Search radius in world pixels
   * @returns Array of entities within the radius, sorted by distance (nearest first)
   */
  getInRadius(x: number, y: number, radius: number): Entity[] {
    const radiusSq = radius * radius;
    const result: Array<{ entity: Entity; distSq: number }> = [];

    for (const entity of this.activeEntities.values()) {
      if (!entity.visible) continue;

      // Use entity center for distance calculation
      const ecx = entity.x + entity.width * 0.5;
      const ecy = entity.y + entity.height * 0.5;
      const dx = ecx - x;
      const dy = ecy - y;
      const distSq = dx * dx + dy * dy;

      if (distSq <= radiusSq) {
        result.push({ entity, distSq });
      }
    }

    // Sort by distance (nearest first) for damage falloff calculations
    result.sort((a, b) => a.distSq - b.distSq);
    return result.map((r) => r.entity);
  }

  // ── Query: by field value ───────────────────────────────────────────────

  /**
   * Filter active entities by an arbitrary field name and value.
   * Useful for queries like "all entities on side=defender" or "all entities
   * with state=idle".
   *
   * @param fieldName - Entity field name to check
   * @param value - Expected field value (strict equality)
   * @returns Array of matching entities
   */
  getByField(fieldName: string, value: unknown): Entity[] {
    const result: Entity[] = [];
    for (const entity of this.activeEntities.values()) {
      if (entity.getField(fieldName) === value) {
        result.push(entity);
      }
    }
    return result;
  }

  // ── Query: camera visibility ────────────────────────────────────────────

  /**
   * Get all active entities that are visible in the camera's viewport.
   * Uses AABB culling via BattlefieldCamera.isVisible().
   * Results are sorted by Y coordinate for correct draw order (painter's algorithm).
   *
   * @param camera - The BattlefieldCamera to cull against
   * @returns Array of visible entities, sorted by Y for draw order
   */
  getVisible(camera: BattlefieldCamera): Entity[] {
    const result: Entity[] = [];

    for (const entity of this.activeEntities.values()) {
      if (!entity.visible) continue;
      if (camera.isVisible(entity.x, entity.y, entity.width, entity.height)) {
        result.push(entity);
      }
    }

    // Sort by Y for painter's algorithm (entities further up drawn first)
    result.sort((a, b) => a.y - b.y);
    return result;
  }

  // ── Bulk operations ─────────────────────────────────────────────────────

  /**
   * Recycle all active entities matching a predicate.
   *
   * @param predicate - Function returning true for entities to recycle
   * @returns Number of entities recycled
   */
  recycleWhere(predicate: (entity: Entity) => boolean): number {
    const toRecycle: Entity[] = [];
    for (const entity of this.activeEntities.values()) {
      if (predicate(entity)) {
        toRecycle.push(entity);
      }
    }
    for (const entity of toRecycle) {
      this.recycle(entity);
    }
    return toRecycle.length;
  }

  /**
   * Recycle all active entities and clear pools.
   */
  clear(): void {
    // Destroy all scripts first
    for (const entity of this.activeEntities.values()) {
      if (this.scriptRuntime.hasScript(entity.id)) {
        this.scriptRuntime.destroyScript(entity.id);
      }
      entity.visible = false;
    }
    this.activeEntities.clear();
    this.pool.clear();
  }

  // ── Stats ───────────────────────────────────────────────────────────────

  /**
   * Number of currently active entities.
   */
  get activeCount(): number {
    return this.activeEntities.size;
  }

  /**
   * Number of entities sitting in pools (available for reuse).
   */
  get pooledCount(): number {
    let count = 0;
    for (const list of this.pool.values()) {
      count += list.length;
    }
    return count;
  }

  /**
   * Get pool and active counts broken down by templateId.
   * Useful for debugging and performance monitoring.
   */
  getStats(): Map<string, { active: number; pooled: number }> {
    const stats = new Map<string, { active: number; pooled: number }>();

    // Count active entities by template
    for (const entity of this.activeEntities.values()) {
      const tid = entity.templateId;
      const s = stats.get(tid) ?? { active: 0, pooled: 0 };
      s.active++;
      stats.set(tid, s);
    }

    // Count pooled entities by template
    for (const [tid, list] of this.pool) {
      const s = stats.get(tid) ?? { active: 0, pooled: 0 };
      s.pooled = list.length;
      stats.set(tid, s);
    }

    return stats;
  }
}
