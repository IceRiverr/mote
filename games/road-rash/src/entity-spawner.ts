/**
 * entity-spawner.ts — Dynamic entity creation and recycling with object pool.
 *
 * The spawner creates Entity instances from entity definitions, assigns
 * unique IDs, and manages an object pool for efficient reuse.
 *
 * Traffic vehicles and pickups do NOT get scripts bound (too expensive).
 * Only bikes (player and opponents) should have scripts bound separately.
 */

import { Entity, SceneManager, ScriptRuntime } from '@mote/engine';
import type { EntityInstanceRuntime } from '@mote/engine';

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

  /**
   * Spawn an entity from a template definition.
   *
   * If the pool has a recycled entity of the same template, reuse it.
   * Otherwise, create a new Entity from the definition.
   *
   * @param templateId - Entity definition ID (e.g. "traffic-vehicle", "weapon-pickup")
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
   * Spawn an entity and also bind its script (for bikes that need AI/control).
   * Returns a promise since script loading is async.
   */
  async spawnWithScript(
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

  /**
   * Get an active entity by its unique ID.
   */
  getById(id: string): Entity | undefined {
    return this.activeEntities.get(id);
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
}
