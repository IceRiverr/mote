// ═══════════════════════════════════════════════════════════════
// brush-commands.ts - 笔刷绘制相关的 Command
// 适配新的 ECS 架构
// ═══════════════════════════════════════════════════════════════

import type { Command } from "../store/history";
import { currentScene, bumpVersion } from "../store/scene";
import { createSceneEntity, snapToGrid } from "../data/Scene";
import type { SceneEntity } from "../data/Scene";

// ═══════════════════════════════════════════════════════════════
// GridPaintRecord - 记录单个格子的变更
// ═══════════════════════════════════════════════════════════════

interface GridPaintRecord {
  /** 原始实体（null 表示原来是空的） */
  oldEntity: SceneEntity | null;
  /** 新实体（null 表示删除） */
  newEntity: SceneEntity | null;
}

// ═══════════════════════════════════════════════════════════════
// PaintEntitiesCommand - 笔刷绘制命令
// 
// 设计要点：
// 1. 增量快照：只记录变更的格子（Map<key, record>）
// 2. Stroke Batching：mouseDown→收集→mouseUp→提交
// 3. 首次执行优化：实时 mutate 保证即时反馈
// ═══════════════════════════════════════════════════════════════

export class PaintEntitiesCommand implements Command {
  readonly label: string;
  private changes = new Map<string, GridPaintRecord>();
  private executed = false;
  private gridSize: number;

  constructor(label = "绘制", gridSize = 32) {
    this.label = label;
    this.gridSize = gridSize;
  }

  /**
   * 记录单个格子的变更（绘制过程中调用）
   * @param gridX 网格 X 坐标
   * @param gridY 网格 Y 坐标
   * @param layer 层索引
   * @param oldEntity 该位置原来的实体
   * @param newPrefabId 新的 Prefab ID（null 表示擦除）
   * @param overrides 组件覆盖值
   */
  record(
    gridX: number,
    gridY: number,
    layer: number,
    oldEntity: SceneEntity | null,
    newPrefabId: string | null,
    overrides?: Record<string, any>
  ): void {
    const key = `${layer}|${gridX}|${gridY}`;
    
    if (!this.changes.has(key)) {
      // 首次记录：保存原始值
      const worldPos = snapToGrid(gridX * this.gridSize, gridY * this.gridSize, this.gridSize);
      
      this.changes.set(key, {
        oldEntity: oldEntity ? { ...oldEntity } : null,
        newEntity: newPrefabId 
          ? createSceneEntity(newPrefabId, worldPos.x, worldPos.y, { overrides })
          : null
      });
    } else {
      // 已存在：只更新最终值，保留原始值
      const record = this.changes.get(key)!;
      if (newPrefabId) {
        const worldPos = snapToGrid(gridX * this.gridSize, gridY * this.gridSize, this.gridSize);
        record.newEntity = createSceneEntity(newPrefabId, worldPos.x, worldPos.y, { overrides });
      } else {
        record.newEntity = null;
      }
    }
  }

  /**
   * 检查是否有实际变更（排除空操作）
   */
  hasChanges(): boolean {
    for (const [, record] of this.changes) {
      // 检查是否真的有变化（old ≠ new）
      if (record.oldEntity?.id !== record.newEntity?.id) {
        return true;
      }
    }
    return false;
  }

  /**
   * 获取变更统计
   */
  getStats(): { added: number; removed: number; replaced: number } {
    let added = 0, removed = 0, replaced = 0;
    for (const [, record] of this.changes) {
      if (!record.oldEntity && record.newEntity) added++;
      else if (record.oldEntity && !record.newEntity) removed++;
      else if (record.oldEntity && record.newEntity && record.oldEntity.id !== record.newEntity.id) replaced++;
    }
    return { added, removed, replaced };
  }

  /**
   * 执行/重做
   * 首次执行时数据已被实时修改，只需标记状态
   */
  execute(): void {
    if (this.executed) {
      // Redo 路径：重新应用变更
      const scene = currentScene.value;
      if (!scene) return;

      for (const [key, record] of this.changes) {
        const [layerStr, gridX, gridY] = key.split('|');
        const layer = parseInt(layerStr);

        // 删除旧实体
        if (record.oldEntity) {
          scene.entities = scene.entities.filter(e => e.id !== record.oldEntity!.id);
        }

        // 添加新实体
        if (record.newEntity) {
          // 确保位置正确
          const worldPos = snapToGrid(parseInt(gridX) * this.gridSize, parseInt(gridY) * this.gridSize, this.gridSize);
          const entity = { ...record.newEntity, x: worldPos.x, y: worldPos.y };
          scene.entities.push(entity);
        }
      }
      bumpVersion();
    }
    this.executed = true;
  }

  /**
   * 撤销
   */
  undo(): void {
    const scene = currentScene.value;
    if (!scene) return;

    for (const [key, record] of this.changes) {
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
// EraseEntitiesCommand - 擦除命令（简化版）
// ═══════════════════════════════════════════════════════════════

export class EraseEntitiesCommand implements Command {
  readonly label = "擦除";
  private erasedEntities: SceneEntity[] = [];
  private bounds: { x: number; y: number; w: number; h: number } | null = null;

  constructor(
    centerX: number,
    centerY: number,
    radius: number,
    gridSize: number = 32
  ) {
    const scene = currentScene.value;
    if (!scene) return;

    // 计算影响范围
    this.bounds = {
      x: centerX - radius,
      y: centerY - radius,
      w: radius * 2,
      h: radius * 2
    };

    // 记录在范围内的实体
    for (const entity of scene.entities) {
      const dx = entity.x - centerX;
      const dy = entity.y - centerY;
      if (Math.sqrt(dx * dx + dy * dy) <= radius) {
        this.erasedEntities.push({ ...entity });
      }
    }
  }

  execute(): void {
    const scene = currentScene.value;
    if (!scene || this.erasedEntities.length === 0) return;

    const erasedIds = new Set(this.erasedEntities.map(e => e.id));
    scene.entities = scene.entities.filter(e => !erasedIds.has(e.id));
    bumpVersion();
  }

  undo(): void {
    const scene = currentScene.value;
    if (!scene || this.erasedEntities.length === 0) return;

    scene.entities.push(...this.erasedEntities.map(e => ({ ...e })));
    bumpVersion();
  }
}
