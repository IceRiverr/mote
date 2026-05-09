// engine/src/core/prefab.ts
// Prefab 定义、注册与实例化

import type { Prefab, SpawnConfig } from './types';

/**
 * 定义 Prefab 的辅助函数
 * 提供编译时类型检查，运行时原样返回
 *
 * ```ts
 * export const GoblinPrefab = definePrefab({
 *   id: 'goblin',
 *   components: {
 *     Transform: { x: 0, y: 0 },
 *     Stats: { hp: 30 },
 *   },
 * });
 * ```
 */
export function definePrefab(def: Prefab): Prefab {
  return def;
}

/**
 * Prefab 注册表 —— 存储和检索 Prefab 模板
 */
export class PrefabStore {
  private prefabs = new Map<string, Prefab>();

  /**
   * 注册 Prefab
   * @param id - 预制体唯一标识
   * @param prefab - 预制体定义（不含 id）
   */
  register(id: string, prefab: Prefab): void {
    if (this.prefabs.has(id)) {
      console.warn(`[PrefabStore] "${id}" already registered, overwriting`);
    }
    this.prefabs.set(id, prefab);
  }

  /**
   * 获取 Prefab
   */
  get(id: string): Prefab | undefined {
    return this.prefabs.get(id);
  }

  /**
   * 获取 Prefab（不存在则抛错）
   */
  getOrThrow(id: string): Prefab {
    const prefab = this.prefabs.get(id);
    if (!prefab) {
      throw new Error(`[PrefabStore] Prefab "${id}" not found`);
    }
    return prefab;
  }

  /**
   * 替换已有 Prefab 定义
   * 只影响后续 spawn，不影响已 spawn 的实例
   */
  replace(id: string, prefab: Prefab): void {
    if (!this.prefabs.has(id)) {
      throw new Error(`[PrefabStore] Prefab "${id}" not found, cannot replace`);
    }
    this.prefabs.set(id, prefab);
  }

  /**
   * 是否已注册
   */
  has(id: string): boolean {
    return this.prefabs.has(id);
  }

  /**
   * 所有已注册的 Prefab ID
   */
  ids(): string[] {
    return Array.from(this.prefabs.keys());
  }

  /**
   * 清空
   */
  clear(): void {
    this.prefabs.clear();
  }
}

/**
 * 深合并 Prefab 组件配置和 override
 * override 中存在的字段覆盖 base，不存在的保留 base
 * 使用 structuredClone 保证完全独立的深拷贝
 */
export function applyOverrides(base: SpawnConfig, overrides: SpawnConfig): SpawnConfig {
  const result: SpawnConfig = structuredClone(base);

  for (const key of Object.keys(overrides)) {
    if (result[key] && typeof result[key] === 'object' && overrides[key] && typeof overrides[key] === 'object') {
      // 组件已存在：深合并字段
      result[key] = { ...(result[key] as any), ...(structuredClone(overrides[key]) as any) };
    } else {
      // 新组件或 primitive 覆盖：深拷贝赋值
      result[key] = structuredClone(overrides[key]);
    }
  }

  return result;
}


