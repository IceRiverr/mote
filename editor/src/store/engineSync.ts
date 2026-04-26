// ═══════════════════════════════════════════════════════════════
// engineSync.ts - Prefab 实例与 Engine 的同步基础设施
//
// 当前 Editor 尚未接入 Engine World 运行时，此模块预留接口。
// 当 Viewport 接入 Engine 渲染后，通过此映射维护 SceneEntity ↔ Engine Entity 关系。
// ═══════════════════════════════════════════════════════════════

import { signal } from '@preact/signals';
import type { PrefabId } from '../data/Prefab';

/** Scene Entity ID → PrefabId 映射（用于 Prefab 保存后定位受影响实例） */
export const prefabInstanceMap = signal<Map<string, PrefabId>>(new Map());

/**
 * 注册 Prefab 实例映射
 * 在 spawnPrefab / 场景加载时调用
 */
export function registerPrefabInstance(sceneEntityId: string, prefabId: PrefabId): void {
  prefabInstanceMap.value = new Map([...prefabInstanceMap.value, [sceneEntityId, prefabId]]);
}

/**
 * 注销 Prefab 实例映射
 * 在 removeEntity / 场景卸载时调用
 */
export function unregisterPrefabInstance(sceneEntityId: string): void {
  const map = new Map(prefabInstanceMap.value);
  map.delete(sceneEntityId);
  prefabInstanceMap.value = map;
}

/**
 * 获取引用指定 Prefab 的所有 Scene Entity ID
 */
export function getInstancesOfPrefab(prefabId: PrefabId): string[] {
  const result: string[] = [];
  for (const [entityId, pid] of prefabInstanceMap.value) {
    if (pid === prefabId) result.push(entityId);
  }
  return result;
}

/**
 * Prefab 保存后同步到 Engine World
 *
 * TODO: 接入 Engine World 后实现完整逻辑：
 * 1. 通过 getInstancesOfPrefab(prefabId) 找到所有受影响实例
 * 2. 对每个 Engine entity，重新 applyOverrides(prefab.components, entity.overrides)
 * 3. 通过 ComponentRegistry 获取 ComponentClass
 * 4. world.get(eid, cls) 获取组件引用，Object.assign 更新字段
 */
export function syncPrefabToEngine(prefabId: PrefabId): void {
  const instanceIds = getInstancesOfPrefab(prefabId);
  if (instanceIds.length === 0) return;

  console.log(`[EngineSync] Prefab "${prefabId}" saved, ${instanceIds.length} instances need sync (Engine World not connected yet)`);

  // Engine World 接入后取消下面的 return 并实现完整同步
  // const world = getEngineWorld();
  // if (!world) return;
  // const prefab = getPrefab(prefabId);
  // if (!prefab) return;
  // for (const sceneEntityId of instanceIds) {
  //   const engineEid = sceneToEngineIdMap.get(sceneEntityId);
  //   if (!engineEid) continue;
  //   const entity = getEntity(sceneEntityId);
  //   if (!entity) continue;
  //   const merged = resolveEntityComponents(entity, prefab);
  //   for (const [compName, data] of Object.entries(merged)) {
  //     const cls = ComponentRegistry.get(compName);
  //     if (!cls) continue;
  //     if (world.has(engineEid, cls)) {
  //       const comp = world.get(engineEid, cls);
  //       Object.assign(comp, data);
  //     } else {
  //       world.add(engineEid, cls, data);
  //     }
  //   }
  // }
}
