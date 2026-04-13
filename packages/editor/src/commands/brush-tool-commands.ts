// ═══════════════════════════════════════════════════════════════
// brush-tool-commands.ts - Brush 工具的 Command
// 支持多 tile 笔刷、连续绘制、填充等
// ═══════════════════════════════════════════════════════════════

import type { Command } from "../store/history";
import { currentScene, bumpVersion, getEntity } from "../store/scene";
import { gridIndex } from "../store/gridIndex";
import type { SceneEntity } from "../data/Scene";
import { createSceneEntity } from "../data/Scene";

// ═══════════════════════════════════════════════════════════════
// PaintBrushCommand - 多格笔刷绘制命令
// ═══════════════════════════════════════════════════════════════

interface PaintRecord {
  gridX: number;
  gridY: number;
  layer: number;
  oldEntity: SceneEntity | null;
  newEntity: SceneEntity | null;
}

export class PaintBrushCommand implements Command {
  readonly label: string;
  private records: PaintRecord[] = [];
  private executed = false;

  constructor(label = "绘制") {
    this.label = label;
  }

  addRecord(
    gridX: number,
    gridY: number,
    layer: number,
    oldEntity: SceneEntity | null,
    newEntity: SceneEntity | null,
  ): void {
    const existingIndex = this.records.findIndex(
      r => r.gridX === gridX && r.gridY === gridY && r.layer === layer
    );

    if (existingIndex >= 0) {
      this.records[existingIndex].newEntity = newEntity;
    } else {
      this.records.push({
        gridX,
        gridY,
        layer,
        oldEntity: oldEntity ? { ...oldEntity } : null,
        newEntity,
      });
    }
  }

  hasChanges(): boolean {
    for (const record of this.records) {
      const oldId = record.oldEntity?.id;
      const newId = record.newEntity?.id;
      if (oldId !== newId) return true;
    }
    return false;
  }

  getStats(): { added: number; removed: number; replaced: number } {
    let added = 0, removed = 0, replaced = 0;
    for (const record of this.records) {
      if (!record.oldEntity && record.newEntity) added++;
      else if (record.oldEntity && !record.newEntity) removed++;
      else if (record.oldEntity && record.newEntity && record.oldEntity.id !== record.newEntity.id) {
        replaced++;
      }
    }
    return { added, removed, replaced };
  }

  execute(): void {
    const scene = currentScene.value;
    if (!scene) return;

    if (this.executed) {
      // Redo 路径
      for (const record of this.records) {
        if (record.oldEntity) {
          scene.entities = scene.entities.filter(e => e.id !== record.oldEntity!.id);
          gridIndex.deleteByEntityId(record.oldEntity.id);
        }
        if (record.newEntity) {
          scene.entities.push({ ...record.newEntity });
          gridIndex.set(record.gridX, record.gridY, record.layer, record.newEntity.id);
        }
      }
      bumpVersion();
    }

    this.executed = true;
  }

  undo(): void {
    const scene = currentScene.value;
    if (!scene) return;

    for (const record of this.records) {
      if (record.newEntity) {
        scene.entities = scene.entities.filter(e => e.id !== record.newEntity!.id);
        gridIndex.delete(record.gridX, record.gridY, record.layer);
      }
      if (record.oldEntity) {
        scene.entities.push({ ...record.oldEntity });
        gridIndex.set(record.gridX, record.gridY, record.layer, record.oldEntity.id);
      }
    }

    bumpVersion();
  }
}

// ═══════════════════════════════════════════════════════════════
// EraseCommand - 擦除命令
// ═══════════════════════════════════════════════════════════════

export class EraseCommand implements Command {
  readonly label: string;
  private erasedEntities: Array<{ entity: SceneEntity; gridX: number; gridY: number; layer: number }> = [];

  constructor(
    centerGridX: number,
    centerGridY: number,
    brushSize: number,
    targetLayer: number,
    gridSize: number,
    label = "擦除"
  ) {
    this.label = label;

    const radius = Math.floor(brushSize / 2);
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const gridX = centerGridX + dx;
        const gridY = centerGridY + dy;

        const entityId = gridIndex.get(gridX, gridY, targetLayer);
        if (entityId) {
          const entity = getEntity(entityId);
          if (entity) {
            this.erasedEntities.push({
              entity: { ...entity },
              gridX,
              gridY,
              layer: targetLayer,
            });
          }
        }
      }
    }
  }

  hasChanges(): boolean {
    return this.erasedEntities.length > 0;
  }

  execute(): void {
    const scene = currentScene.value;
    if (!scene || this.erasedEntities.length === 0) return;

    const erasedIds = new Set(this.erasedEntities.map(e => e.entity.id));
    scene.entities = scene.entities.filter(e => !erasedIds.has(e.id));
    
    for (const { gridX, gridY, layer } of this.erasedEntities) {
      gridIndex.delete(gridX, gridY, layer);
    }

    bumpVersion();
  }

  undo(): void {
    const scene = currentScene.value;
    if (!scene || this.erasedEntities.length === 0) return;

    for (const { entity, gridX, gridY, layer } of this.erasedEntities) {
      scene.entities.push(entity);
      gridIndex.set(gridX, gridY, layer, entity.id);
    }

    bumpVersion();
  }
}

// ═══════════════════════════════════════════════════════════════
// FloodFillCommand - 填充命令
// ═══════════════════════════════════════════════════════════════

export class FloodFillCommand implements Command {
  readonly label = "填充";
  private filledGrids: Array<{
    gridX: number;
    gridY: number;
    oldEntity: SceneEntity | null;
    newEntity: SceneEntity;
  }> = [];

  constructor(
    startGridX: number,
    startGridY: number,
    newPrefabId: string,
    private targetLayer: number,
    private gridSize: number
  ) {
    this.calculateFill(startGridX, startGridY, newPrefabId);
  }

  private calculateFill(startX: number, startY: number, newPrefabId: string): void {
    const scene = currentScene.value;
    if (!scene) return;

    const visited = new Set<string>();
    const queue: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];

    const startEntityId = gridIndex.get(startX, startY, this.targetLayer);
    const startEntity = startEntityId ? getEntity(startEntityId) : null;
    const startPrefabId = startEntity?.prefab ?? null;

    while (queue.length > 0) {
      const { x, y } = queue.shift()!;
      const key = `${x},${y}`;

      if (visited.has(key)) continue;
      visited.add(key);

      const worldX = x * this.gridSize;
      const worldY = y * this.gridSize;
      if (worldX < 0 || worldX >= scene.width || worldY < 0 || worldY >= scene.height) {
        continue;
      }

      const entityId = gridIndex.get(x, y, this.targetLayer);
      const entity = entityId ? getEntity(entityId) : null;
      const prefabId = entity?.prefab ?? null;

      if (prefabId !== startPrefabId) continue;

      const newEntity = createSceneEntity(newPrefabId, worldX, worldY);
      this.filledGrids.push({
        gridX: x,
        gridY: y,
        oldEntity: entity ? { ...entity } : null,
        newEntity,
      });

      queue.push({ x: x + 1, y });
      queue.push({ x: x - 1, y });
      queue.push({ x, y: y + 1 });
      queue.push({ x, y: y - 1 });
    }
  }

  hasChanges(): boolean {
    return this.filledGrids.length > 0;
  }

  execute(): void {
    const scene = currentScene.value;
    if (!scene || this.filledGrids.length === 0) return;

    for (const { gridX, gridY, oldEntity, newEntity } of this.filledGrids) {
      if (oldEntity) {
        scene.entities = scene.entities.filter(e => e.id !== oldEntity.id);
        gridIndex.delete(gridX, gridY, this.targetLayer);
      }

      scene.entities.push(newEntity);
      gridIndex.set(gridX, gridY, this.targetLayer, newEntity.id);
    }

    bumpVersion();
  }

  undo(): void {
    const scene = currentScene.value;
    if (!scene || this.filledGrids.length === 0) return;

    for (const { newEntity } of this.filledGrids) {
      scene.entities = scene.entities.filter(e => e.id !== newEntity.id);
      gridIndex.deleteByEntityId(newEntity.id);
    }

    for (const { gridX, gridY, oldEntity } of this.filledGrids) {
      if (oldEntity) {
        scene.entities.push(oldEntity);
        gridIndex.set(gridX, gridY, this.targetLayer, oldEntity.id);
      }
    }

    bumpVersion();
  }
}

// ═══════════════════════════════════════════════════════════════
// PickPrefabResult - 吸取工具结果
// ═══════════════════════════════════════════════════════════════

export class PickPrefabResult {
  prefabId: string | null = null;
  layer: number = 0;
}

export function pickPrefab(gridX: number, gridY: number, layer: number): PickPrefabResult {
  const result = new PickPrefabResult();

  const entityId = gridIndex.get(gridX, gridY, layer);
  if (entityId) {
    const entity = getEntity(entityId);
    if (entity) {
      result.prefabId = entity.prefab;
      result.layer = layer;
    }
  }

  return result;
}
