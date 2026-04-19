// ═══════════════════════════════════════════════════════════════
// override-utils.ts - Inspector Override 追踪工具
// ═══════════════════════════════════════════════════════════════

import type { Prefab } from '../data/Prefab';
import type { SceneEntity } from '../data/Scene';

/**
 * 深度比较两个值是否相等
 * 支持 primitive、数组、对象（不含 function/Symbol/DOM 节点）
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return false;
  if (typeof a !== typeof b) return false;

  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    for (let i = 0; i < a.length; i++) {
      if (!deepEqual(a[i], b[i])) return false;
    }
    return true;
  }

  if (typeof a === 'object' && typeof b === 'object') {
    const keysA = Object.keys(a as object);
    const keysB = Object.keys(b as object);
    if (keysA.length !== keysB.length) return false;
    for (const key of keysA) {
      if (!keysB.includes(key)) return false;
      if (!deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])) return false;
    }
    return true;
  }

  return false;
}

/**
 * 计算 override 值
 * - 若 instanceValue 与 prefabValue 相等（deepEqual），返回 undefined（应删除 override）
 * - 若不同，返回 instanceValue 的深拷贝
 */
export function computeOverride(prefabValue: unknown, instanceValue: unknown): unknown {
  if (deepEqual(prefabValue, instanceValue)) return undefined;
  return structuredClone(instanceValue);
}

/**
 * 解析某个属性的 override 状态
 * @returns value - 当前应显示的值；isOverride - 是否来自 overrides
 */
export function resolveOverrideStatus(
  prefab: Prefab,
  entity: SceneEntity,
  componentName: string,
  propertyName: string
): { value: unknown; isOverride: boolean } {
  const prefabValue = prefab.components[componentName]?.[propertyName];
  const overrideValue = entity.overrides?.[componentName]?.[propertyName];

  if (overrideValue !== undefined) {
    return { value: structuredClone(overrideValue), isOverride: true };
  }

  return { value: structuredClone(prefabValue), isOverride: false };
}

/**
 * 计算实体的完整 overrides 中，哪些字段应该保留/删除
 * 用于 Inspector 的 onChange 处理器：修改属性后自动维护 overrides
 */
export function rebuildOverrides(
  prefab: Prefab,
  entity: SceneEntity,
  componentName: string,
  propertyName: string,
  newValue: unknown
): SceneEntity['overrides'] {
  const prefabValue = prefab.components[componentName]?.[propertyName];
  const currentOverrides = entity.overrides ? structuredClone(entity.overrides) : {};

  if (!currentOverrides[componentName]) {
    currentOverrides[componentName] = {};
  }

  if (deepEqual(prefabValue, newValue)) {
    // 与 Prefab 默认值相同：删除 override
    delete currentOverrides[componentName][propertyName];
    // 若该组件下无其他 override，删除整个组件 override
    if (Object.keys(currentOverrides[componentName]).length === 0) {
      delete currentOverrides[componentName];
    }
  } else {
    // 与默认值不同：写入 override
    currentOverrides[componentName][propertyName] = structuredClone(newValue);
  }

  return Object.keys(currentOverrides).length > 0 ? currentOverrides : undefined;
}
