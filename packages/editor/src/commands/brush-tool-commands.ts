// ═══════════════════════════════════════════════════════════════
// brush-tool-commands.ts - Brush 工具的 Command
// 支持多 tile 笔刷、连续绘制、填充等
// ═══════════════════════════════════════════════════════════════

import type { Command } from "../store/history";
import { currentScene, bumpVersion } from "../store/scene";
import { prefabs } from "../store/prefabs";
import type { SceneEntity } from "../data/Scene";
import { createSceneEntity } from "../data/Scene";

// ═══════════════════════════════════════════════════════════════
// 辅助函数：查找指定网格位置的实体
// ═══════════════════════════════════════════════════════════════

function findEntityAtGrid(
  gridX: number,
  gridY: number,
  layer: number,
  gridSize: number
): SceneEntity | undefined {
  const scene = currentScene.value;
  if (!scene) return undefined;

  const targetX = (gridX + 0.5) * gridSize;
  const targetY = (gridY + 0.5) * gridSize;

  for (let i = scene.entities.length - 1; i >= 0; i--) {
    const entity = scene.entities[i];
    const prefab = prefabs.value.get(entity.prefab);
    const entityLayer = prefab?.components?.Sprite?.layer ?? 0;
    if (entityLayer === layer && entity.transform.x === targetX && entity.transform.y === targetY) {
      return entity;
    }
  }
  return undefined;
}

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
      // Redo 路径：重新应用变更
      for (const record of this.records) {
        if (record.oldEntity) {
          scene.entities = scene.entities.filter(e => e.id !== record.oldEntity!.id);
        }
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
      if (record.newEntity) {
        scene.entities = scene.entities.filter(e => e.id !== record.newEntity!.id);
      }
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

        const entity = findEntityAtGrid(gridX, gridY, targetLayer, gridSize);
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
  private filledGrids: Array<{
    gridX: number;
    gridY: number;
    oldEntity: SceneEntity | null;
    newEntity: SceneEntity;
  }> = [];

  constructor(
    startGridX: number,
    startGridY: number,
    newPrefabPath: string,
    private targetLayer: number,
    private gridSize: number
  ) {
    this.calculateFill(startGridX, startGridY, newPrefabPath);
  }

  private calculateFill(startX: number, startY: number, newPrefabPath: string): void {
    const scene = currentScene.value;
    if (!scene) return;

    const visited = new Set<string>();
    const stack: Array<{ x: number; y: number }> = [{ x: startX, y: startY }];

    const startEntity = findEntityAtGrid(startX, startY, this.targetLayer, this.gridSize);
    const startPrefabId = startEntity?.prefab ?? null;

    while (stack.length > 0) {
      const { x, y } = stack.pop()!;
      const key = `${x},${y}`;

      if (visited.has(key)) continue;
      visited.add(key);

      const worldX = (x + 0.5) * this.gridSize;
      const worldY = (y + 0.5) * this.gridSize;
      if (worldX < 0 || worldX >= scene.width || worldY < 0 || worldY >= scene.height) {
        continue;
      }

      const entity = findEntityAtGrid(x, y, this.targetLayer, this.gridSize);
      const prefabId = entity?.prefab ?? null;

      if (prefabId !== startPrefabId) continue;

      const newEntity = createSceneEntity(newPrefabPath, { x: worldX, y: worldY });
      this.filledGrids.push({
        gridX: x,
        gridY: y,
        oldEntity: entity ? { ...entity } : null,
        newEntity,
      });

      stack.push({ x: x + 1, y });
      stack.push({ x: x - 1, y });
      stack.push({ x, y: y + 1 });
      stack.push({ x, y: y - 1 });
    }
  }

  hasChanges(): boolean {
    return this.filledGrids.length > 0;
  }

  execute(): void {
    const scene = currentScene.value;
    if (!scene || this.filledGrids.length === 0) return;

    for (const { oldEntity, newEntity } of this.filledGrids) {
      if (oldEntity) {
        scene.entities = scene.entities.filter(e => e.id !== oldEntity.id);
      }
      scene.entities.push(newEntity);
    }

    bumpVersion();
  }

  undo(): void {
    const scene = currentScene.value;
    if (!scene || this.filledGrids.length === 0) return;

    for (const { newEntity } of this.filledGrids) {
      scene.entities = scene.entities.filter(e => e.id !== newEntity.id);
    }

    for (const { oldEntity } of this.filledGrids) {
      if (oldEntity) {
        scene.entities.push(oldEntity);
      }
    }

    bumpVersion();
  }
}

// ═══════════════════════════════════════════════════════════════
// PickPrefabResult - 吸取工具结果
// ═══════════════════════════════════════════════════════════════

export class PickPrefabResult {
  prefabPath: string | null = null;
  layer: number = 0;
}

export function pickPrefab(gridX: number, gridY: number, layer: number, gridSize: number): PickPrefabResult {
  const result = new PickPrefabResult();

  const entity = findEntityAtGrid(gridX, gridY, layer, gridSize);
  if (entity) {
    result.prefabPath = entity.prefab;
    result.layer = layer;
  }

  return result;
}
