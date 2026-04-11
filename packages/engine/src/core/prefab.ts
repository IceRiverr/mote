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
   */
  register(prefab: Prefab): void {
    if (this.prefabs.has(prefab.id)) {
      console.warn(`[PrefabStore] "${prefab.id}" already registered, overwriting`);
    }
    this.prefabs.set(prefab.id, prefab);
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
 */
export function mergeSpawnConfig(base: SpawnConfig, overrides: SpawnConfig): SpawnConfig {
  const result: SpawnConfig = {};

  // 复制 base 的所有组件
  for (const key of Object.keys(base)) {
    result[key] = { ...(base[key] as any) };
  }

  // 合并 overrides
  for (const key of Object.keys(overrides)) {
    if (result[key]) {
      // 组件已存在：浅合并字段
      Object.assign(result[key] as any, overrides[key]);
    } else {
      // 新组件：直接赋值
      result[key] = { ...(overrides[key] as any) };
    }
  }

  return result;
}
