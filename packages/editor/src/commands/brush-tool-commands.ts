// ═══════════════════════════════════════════════════════════════
// brush-tool-commands.ts - Brush 工具的 Command
// 支持多 tile 笔刷、连续绘制、填充等
// ═══════════════════════════════════════════════════════════════

import type { Command } from "../store/history";
import { currentScene, bumpVersion, getEntity } from "../store/scene";
import { gridIndex, getEntityLayer } from "../store/gridIndex";
import { prefabs } from "../store/prefabs";
import type { SceneEntity } from "../data/Scene";
import { createSceneEntity } from "../data/Scene";
import type { BrushCell } from "../store/brush";

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

  /**
   * 添加绘制记录
   */
  addRecord(
    gridX: number,
    gridY: number,
    layer: number,
    oldEntity: SceneEntity | null,
    newPrefabId: string | null,
    gridSize: number
  ): void {
    // 检查是否已有相同位置的记录
    const existingIndex = this.records.findIndex(
      r => r.gridX === gridX && r.gridY === gridY && r.layer === layer
    );

    const worldX = gridX * gridSize;
    const worldY = gridY * gridSize;

    const newEntity = newPrefabId
      ? createSceneEntity(newPrefabId, worldX, worldY)
      : null;

    if (existingIndex >= 0) {
      // 更新最终值，保留原始值
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

  /**
   * 检查是否有实际变更
   */
  hasChanges(): boolean {
    for (const record of this.records) {
      const oldId = record.oldEntity?.id;
      const newId = record.newEntity?.id;
      if (oldId !== newId) return true;
    }
    return false;
  }

  /**
   * 获取统计信息
   */
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
      // Redo 路径：重新应用所有变更
      for (const record of this.records) {
        // 删除旧实体
        if (record.oldEntity) {
          scene.entities = scene.entities.filter(e => e.id !== record.oldEntity!.id);
        }
        // 添加新实体
        if (record.newEntity) {
          scene.entities.push({ ...record.newEntity });
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
      // 删除新实体
      if (record.newEntity) {
        scene.entities = scene.entities.filter(e => e.id !== record.newEntity!.id);
      }
      // 恢复旧实体
      if (record.oldEntity) {
        scene.entities.push({ ...record.oldEntity });
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
  private gridSize: number;

  constructor(
    centerGridX: number,
    centerGridY: number,
    brushSize: number,
    targetLayer: number,
    gridSize: number,
    label = "擦除"
  ) {
    this.label = label;
    this.gridSize = gridSize;

    const scene = currentScene.value;
    if (!scene) return;

    const radius = Math.floor(brushSize / 2);

    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const gridX = centerGridX + dx;
        const gridY = centerGridY + dy;

        // 找到该位置的实体
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

    bumpVersion();
  }

  undo(): void {
    const scene = currentScene.value;
    if (!scene || this.erasedEntities.length === 0) return;

    for (const { entity } of this.erasedEntities) {
      scene.entities.push(entity);
    }

    bumpVersion();
  }
}

// ═══════════════════════════════════════════════════════════════
// FloodFillCommand - 填充命令
// ═══════════════════════════════════════════════════════════════

export class FloodFillCommand implements Command {
  readonly label = "填充";
  private filledGrids: Array<{ gridX: number; gridY: number; oldEntity: SceneEntity | null }> = [];
  private newPrefabId: string;
  private targetLayer: number;
  private gridSize: number;
  private startX: number;
  private startY: number;

  constructor(
    startGridX: number,
    startGridY: number,
    newPrefabId: string,
    targetLayer: number,
    gridSize: number
  ) {
    this.startX = startGridX;
    this.startY = startGridY;
    this.newPrefabId = newPrefabId;
    this.targetLayer = targetLayer;
    this.gridSize = gridSize;

    this.calculateFill();
  }

  private calculateFill(): void {
    const scene = currentScene.value;
    if (!scene) return;

    // BFS 填充
    const visited = new Set<string>();
    const queue: Array<{ x: number; y: number }> = [{ x: this.startX, y: this.startY }];

    // 获取起始位置的参考实体
    const startEntityId = gridIndex.get(this.startX, this.startY, this.targetLayer);
    const startEntity = startEntityId ? getEntity(startEntityId) : null;
    const startPrefabId = startEntity?.prefab ?? null;

    while (queue.length > 0) {
      const { x, y } = queue.shift()!;
      const key = `${x},${y}`;

      if (visited.has(key)) continue;
      visited.add(key);

      // 检查边界
      const worldX = x * this.gridSize;
      const worldY = y * this.gridSize;
      if (worldX < 0 || worldX >= scene.width || worldY < 0 || worldY >= scene.height) {
        continue;
      }

      // 检查是否匹配（相同 prefab 或都为空）
      const entityId = gridIndex.get(x, y, this.targetLayer);
      const entity = entityId ? getEntity(entityId) : null;
      const prefabId = entity?.prefab ?? null;

      if (prefabId !== startPrefabId) continue;

      // 记录填充
      this.filledGrids.push({
        gridX: x,
        gridY: y,
        oldEntity: entity ? { ...entity } : null,
      });

      // 加入邻居
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

    for (const { gridX, gridY, oldEntity } of this.filledGrids) {
      // 删除旧实体
      if (oldEntity) {
        scene.entities = scene.entities.filter(e => e.id !== oldEntity.id);
      }

      // 创建新实体
      const worldX = gridX * this.gridSize;
      const worldY = gridY * this.gridSize;
      const newEntity = createSceneEntity(this.newPrefabId, worldX, worldY);
      scene.entities.push(newEntity);
    }

    bumpVersion();
  }

  undo(): void {
    const scene = currentScene.value;
    if (!scene || this.filledGrids.length === 0) return;

    const newIds = new Set<string>();

    for (const { oldEntity } of this.filledGrids) {
      // 删除新创建的实体
      if (oldEntity) {
        newIds.add(oldEntity.id);
      }
    }

    // 先删除所有新实体
    scene.entities = scene.entities.filter(e => !newIds.has(e.id));

    // 恢复旧实体
    for (const { oldEntity } of this.filledGrids) {
      if (oldEntity) {
        scene.entities.push(oldEntity);
      }
    }

    bumpVersion();
  }
}

// ═══════════════════════════════════════════════════════════════
// PickPrefabCommand - 吸取工具（不产生历史记录，但为了统一接口）
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
