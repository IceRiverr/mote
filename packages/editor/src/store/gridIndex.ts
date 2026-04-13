// ═══════════════════════════════════════════════════════════════
// gridIndex.ts - 空间索引，用于快速查找网格位置的实体
// ═══════════════════════════════════════════════════════════════

import { signal } from "@preact/signals";
import type { SceneEntity } from "../data/Scene";

// ═══════════════════════════════════════════════════════════════
// 配置
// ═══════════════════════════════════════════════════════════════

/** 默认网格大小 */
export const DEFAULT_GRID_SIZE = 32;

/** 当前网格大小 */
export const gridSize = signal<number>(DEFAULT_GRID_SIZE);

// ═══════════════════════════════════════════════════════════════
// GridIndex 类
// ═══════════════════════════════════════════════════════════════

export class GridIndex {
  /** key: "layer|gridX|gridY" -> entityId */
  private map = new Map<string, string>();
  
  /** 反向索引：entityId -> key（用于快速删除） */
  private reverseMap = new Map<string, string>();

  private gridSize: number;

  constructor(gridSize: number = DEFAULT_GRID_SIZE) {
    this.gridSize = gridSize;
  }

  // ═══════════════════════════════════════════════════════════════
  // 核心操作
  // ═══════════════════════════════════════════════════════════════

  /**
   * 设置网格位置的实体
   */
  set(gridX: number, gridY: number, layer: number, entityId: string): void {
    const key = this.makeKey(gridX, gridY, layer);
    
    // 如果该位置已有实体，先清除反向索引
    const oldEntityId = this.map.get(key);
    if (oldEntityId) {
      this.reverseMap.delete(oldEntityId);
    }
    
    // 设置新值
    this.map.set(key, entityId);
    this.reverseMap.set(entityId, key);
  }

  /**
   * 获取网格位置的实体 ID
   */
  get(gridX: number, gridY: number, layer: number): string | undefined {
    const key = this.makeKey(gridX, gridY, layer);
    return this.map.get(key);
  }

  /**
   * 删除网格位置的实体
   */
  delete(gridX: number, gridY: number, layer: number): boolean {
    const key = this.makeKey(gridX, gridY, layer);
    const entityId = this.map.get(key);
    
    if (entityId) {
      this.map.delete(key);
      this.reverseMap.delete(entityId);
      return true;
    }
    return false;
  }

  /**
   * 通过实体 ID 删除（用于知道 ID 但不知道位置时）
   */
  deleteByEntityId(entityId: string): boolean {
    const key = this.reverseMap.get(entityId);
    if (key) {
      this.map.delete(key);
      this.reverseMap.delete(entityId);
      return true;
    }
    return false;
  }

  /**
   * 获取某个网格位置的所有层实体
   */
  getAllAt(gridX: number, gridY: number): Array<{ layer: number; entityId: string }> {
    const results: Array<{ layer: number; entityId: string }> = [];
    const prefix = `${gridX}|${gridY}`;
    
    for (const [key, entityId] of this.map) {
      // key 格式: "layer|gridX|gridY"
      const parts = key.split('|');
      if (parts.length === 3) {
        const kgx = parseInt(parts[1]);
        const kgy = parseInt(parts[2]);
        if (kgx === gridX && kgy === gridY) {
          results.push({ layer: parseInt(parts[0]), entityId });
        }
      }
    }
    
    return results.sort((a, b) => a.layer - b.layer);
  }

  /**
   * 获取指定层在矩形区域内的所有实体
   */
  getInRect(
    x1: number, 
    y1: number, 
    x2: number, 
    y2: number, 
    layer: number
  ): string[] {
    const results: string[] = [];
    const minX = Math.min(x1, x2);
    const maxX = Math.max(x1, x2);
    const minY = Math.min(y1, y2);
    const maxY = Math.max(y1, y2);
    
    for (let x = minX; x <= maxX; x++) {
      for (let y = minY; y <= maxY; y++) {
        const entityId = this.get(x, y, layer);
        if (entityId) {
          results.push(entityId);
        }
      }
    }
    
    return results;
  }

  /**
   * 移动实体到新位置
   */
  move(
    oldX: number, 
    oldY: number, 
    oldLayer: number,
    newX: number, 
    newY: number, 
    newLayer: number
  ): boolean {
    const entityId = this.get(oldX, oldY, oldLayer);
    if (!entityId) return false;
    
    this.delete(oldX, oldY, oldLayer);
    this.set(newX, newY, newLayer, entityId);
    return true;
  }

  /**
   * 清空所有索引
   */
  clear(): void {
    this.map.clear();
    this.reverseMap.clear();
  }

  /**
   * 获取索引大小（用于调试）
   */
  size(): number {
    return this.map.size;
  }

  // ═══════════════════════════════════════════════════════════════
  // 批量操作
  // ═══════════════════════════════════════════════════════════════

  /**
   * 从场景实体列表重建索引
   */
  rebuildFromEntities(
    entities: SceneEntity[], 
    getLayer: (entity: SceneEntity) => number
  ): void {
    this.clear();
    
    for (const entity of entities) {
      const layer = getLayer(entity);
      const gridX = Math.floor(entity.x / this.gridSize);
      const gridY = Math.floor(entity.y / this.gridSize);
      this.set(gridX, gridY, layer, entity.id);
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 工具方法
  // ═══════════════════════════════════════════════════════════════

  private makeKey(gridX: number, gridY: number, layer: number): string {
    return `${layer}|${gridX}|${gridY}`;
  }

  /**
   * 世界坐标转网格坐标
   */
  worldToGrid(worldX: number, worldY: number): { x: number; y: number } {
    return {
      x: Math.floor(worldX / this.gridSize),
      y: Math.floor(worldY / this.gridSize),
    };
  }

  /**
   * 网格坐标转世界坐标（中心点）
   */
  gridToWorld(gridX: number, gridY: number): { x: number; y: number } {
    return {
      x: gridX * this.gridSize,
      y: gridY * this.gridSize,
    };
  }

  /**
   * 设置新的网格大小（会清空索引）
   */
  setGridSize(newSize: number): void {
    this.gridSize = newSize;
    this.clear();
  }

  /**
   * 获取当前网格大小
   */
  getGridSize(): number {
    return this.gridSize;
  }
}

// ═══════════════════════════════════════════════════════════════
// 全局实例
// ═══════════════════════════════════════════════════════════════

/** 全局 GridIndex 实例 */
export const gridIndex = new GridIndex(DEFAULT_GRID_SIZE);

// ═══════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════

/**
 * 从 Prefab 获取渲染层
 */
export function getEntityLayer(entity: SceneEntity, prefabs: Map<string, any>): number {
  const prefab = prefabs.get(entity.prefab);
  return prefab?.components?.Sprite?.layer ?? 0;
}

/**
 * 将实体位置对齐到网格
 */
export function snapToGrid(
  worldX: number, 
  worldY: number, 
  gridSizeValue: number = gridSize.value
): { x: number; y: number } {
  return {
    x: Math.round(worldX / gridSizeValue) * gridSizeValue,
    y: Math.round(worldY / gridSizeValue) * gridSizeValue,
  };
}
