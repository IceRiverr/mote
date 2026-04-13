// ═══════════════════════════════════════════════════════════════
// scene-commands.ts - 场景实体相关的 Command
// 适配新的 ECS 架构（SceneEntity）
// ═══════════════════════════════════════════════════════════════

import type { Command } from "../store/history";
import { currentScene, bumpVersion } from "../store/scene";
import type { SceneEntity } from "../data/Scene";
import { createSceneEntity, snapToGrid } from "../data/Scene";

// ═══════════════════════════════════════════════════════════════
// AddEntityCommand - 添加实体
// ═══════════════════════════════════════════════════════════════

export class AddEntityCommand implements Command {
  readonly label = "添加实体";
  private entity: SceneEntity;

  constructor(prefabId: string, x: number, y: number, options?: {
    rotation?: number;
    scaleX?: number;
    scaleY?: number;
    overrides?: Record<string, any>;
  }) {
    this.entity = createSceneEntity(prefabId, x, y, options);
  }

  getEntityId(): string {
    return this.entity.id;
  }

  execute(): void {
    const scene = currentScene.value;
    if (!scene) return;
    
    scene.entities.push(this.entity);
    bumpVersion();
  }

  undo(): void {
    const scene = currentScene.value;
    if (!scene) return;
    
    scene.entities = scene.entities.filter(e => e.id !== this.entity.id);
    bumpVersion();
  }
}

// ═══════════════════════════════════════════════════════════════
// RemoveEntityCommand - 删除实体
// ═══════════════════════════════════════════════════════════════

export class RemoveEntityCommand implements Command {
  readonly label = "删除实体";
  private entity: SceneEntity | null = null;
  private entityId: string;

  constructor(entityId: string) {
    this.entityId = entityId;
    
    const scene = currentScene.value;
    if (scene) {
      this.entity = scene.entities.find(e => e.id === entityId) ?? null;
    }
  }

  execute(): void {
    if (!this.entity) return;
    
    const scene = currentScene.value;
    if (!scene) return;
    
    scene.entities = scene.entities.filter(e => e.id !== this.entityId);
    bumpVersion();
  }

  undo(): void {
    if (!this.entity) return;
    
    const scene = currentScene.value;
    if (!scene) return;
    
    scene.entities.push(this.entity);
    bumpVersion();
  }
}

// ═══════════════════════════════════════════════════════════════
// MoveEntityCommand - 移动单个实体
// ═══════════════════════════════════════════════════════════════

export class MoveEntityCommand implements Command {
  readonly label = "移动实体";
  private entityId: string;
  private oldX: number;
  private oldY: number;
  private newX: number;
  private newY: number;

  constructor(entityId: string, newX: number, newY: number) {
    this.entityId = entityId;
    this.newX = newX;
    this.newY = newY;
    
    const scene = currentScene.value;
    const entity = scene?.entities.find(e => e.id === entityId);
    this.oldX = entity?.x ?? newX;
    this.oldY = entity?.y ?? newY;
  }

  execute(): void {
    this.apply(this.newX, this.newY);
  }

  undo(): void {
    this.apply(this.oldX, this.oldY);
  }

  private apply(x: number, y: number): void {
    const scene = currentScene.value;
    if (!scene) return;
    
    const entity = scene.entities.find(e => e.id === this.entityId);
    if (entity) {
      entity.x = x;
      entity.y = y;
      bumpVersion();
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// MoveEntitiesCommand - 批量移动实体（用于框选移动）
// ═══════════════════════════════════════════════════════════════

export class MoveEntitiesCommand implements Command {
  readonly label = "移动实体";
  private moves: Array<{
    id: string;
    oldX: number;
    oldY: number;
    newX: number;
    newY: number;
  }>;

  constructor(
    entityIds: string[],
    deltaX: number,
    deltaY: number
  ) {
    const scene = currentScene.value;
    this.moves = [];
    
    for (const id of entityIds) {
      const entity = scene?.entities.find(e => e.id === id);
      if (entity) {
        this.moves.push({
          id,
          oldX: entity.x,
          oldY: entity.y,
          newX: entity.x + deltaX,
          newY: entity.y + deltaY
        });
      }
    }
  }

  execute(): void {
    this.apply(move => ({ x: move.newX, y: move.newY }));
  }

  undo(): void {
    this.apply(move => ({ x: move.oldX, y: move.oldY }));
  }

  private apply(fn: (m: typeof this.moves[0]) => { x: number; y: number }): void {
    const scene = currentScene.value;
    if (!scene) return;
    
    for (const move of this.moves) {
      const entity = scene.entities.find(e => e.id === move.id);
      if (entity) {
        const pos = fn(move);
        entity.x = pos.x;
        entity.y = pos.y;
      }
    }
    bumpVersion();
  }
}

// ═══════════════════════════════════════════════════════════════
// UpdateEntityCommand - 更新实体属性（通用）
// ═══════════════════════════════════════════════════════════════

export class UpdateEntityCommand implements Command {
  readonly label: string;
  private entityId: string;
  private oldValues: Partial<SceneEntity>;
  private newValues: Partial<SceneEntity>;

  constructor(
    entityId: string,
    newValues: Partial<SceneEntity>,
    label = "更新实体"
  ) {
    this.label = label;
    this.entityId = entityId;
    this.newValues = newValues;
    
    const scene = currentScene.value;
    const entity = scene?.entities.find(e => e.id === entityId);
    
    // 保存原始值
    this.oldValues = {};
    if (entity) {
      for (const key of Object.keys(newValues) as Array<keyof SceneEntity>) {
        this.oldValues[key] = entity[key] as any;
      }
    }
  }

  execute(): void {
    this.apply(this.newValues);
  }

  undo(): void {
    this.apply(this.oldValues);
  }

  private apply(values: Partial<SceneEntity>): void {
    const scene = currentScene.value;
    if (!scene) return;
    
    const entity = scene.entities.find(e => e.id === this.entityId);
    if (entity) {
      Object.assign(entity, values);
      bumpVersion();
    }
  }
}
