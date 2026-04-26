// ═══════════════════════════════════════════════════════════════
// prefabEditor.ts - Prefab Editor 编辑状态层
// ═══════════════════════════════════════════════════════════════

import { signal } from '@preact/signals';
import type { Prefab, PrefabId } from '../data/Prefab';
import { deepEqual } from '../utils/override-utils';

export interface EditingPrefab {
  /** Prefab 文件路径（相对于 assets/） */
  path: string;
  /** 运行时推导的 Prefab ID */
  prefabId: PrefabId;
  /** 当前可编辑的 draft */
  draft: Prefab;
  /** 原始 Prefab 快照（用于 undo/reset） */
  original: Prefab;
}

/** 当前正在编辑的 Prefab（null 表示无编辑中） */
export const editingPrefab = signal<EditingPrefab | null>(null);

/** 创建 draft */
export function createDraft(prefabId: PrefabId, path: string, prefab: Prefab): void {
  editingPrefab.value = {
    path,
    prefabId,
    draft: structuredClone(prefab),
    original: structuredClone(prefab),
  };
}

/** 丢弃 draft */
export function discardDraft(): void {
  editingPrefab.value = null;
}

/** 检查 draft 是否有变更 */
export function hasDraftChanges(): boolean {
  return getDraftChanges().length > 0;
}

/**
 * 获取 draft 与原始 Prefab 的差异列表（属性级）
 */
export function getDraftChanges(): Array<{
  component: string;
  property: string;
  oldValue: unknown;
  newValue: unknown;
}> {
  const current = editingPrefab.value;
  if (!current) return [];

  const changes: ReturnType<typeof getDraftChanges> = [];
  const { original, draft } = current;

  // 比较 name/tags 等元信息
  if (original.name !== draft.name) {
    changes.push({ component: '__meta__', property: 'name', oldValue: original.name, newValue: draft.name });
  }
  if (!deepEqual(original.tags, draft.tags)) {
    changes.push({ component: '__meta__', property: 'tags', oldValue: original.tags, newValue: draft.tags });
  }

  // 比较所有组件属性
  const allComponents = new Set([
    ...Object.keys(original.components),
    ...Object.keys(draft.components),
  ]);

  for (const compName of allComponents) {
    const origProps = original.components[compName] || {};
    const draftProps = draft.components[compName] || {};
    const allProps = new Set([...Object.keys(origProps), ...Object.keys(draftProps)]);

    for (const propName of allProps) {
      const oldVal = origProps[propName];
      const newVal = draftProps[propName];
      if (!deepEqual(oldVal, newVal)) {
        changes.push({ component: compName, property: propName, oldValue: oldVal, newValue: newVal });
      }
    }
  }

  return changes;
}

/**
 * 重置 draft 为原始状态
 */
export function resetDraft(): void {
  const current = editingPrefab.value;
  if (!current) return;
  editingPrefab.value = {
    ...current,
    draft: structuredClone(current.original),
  };
}
