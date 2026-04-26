// ═══════════════════════════════════════════════════════════════
// prefabs.ts - Prefab 状态管理
//
// 设计原则：以 PrefabId（推导路径）为键
// ═══════════════════════════════════════════════════════════════

import { signal, computed, type Signal } from '@preact/signals';
import type { Prefab, PrefabId } from '../data/Prefab';
import { getPrefabDisplayName, derivePrefabId } from '../data/Prefab';

// ═══════════════════════════════════════════════════════════════
// 状态
// ═══════════════════════════════════════════════════════════════

/** 所有已加载的 Prefab: PrefabId -> Prefab */
export const prefabs = signal<Map<PrefabId, Prefab>>(new Map());

/** PrefabId -> 文件路径的映射（用于反向查找） */
export const prefabIdToPath = signal<Map<PrefabId, string>>(new Map());

/** 搜索关键词 */
export const searchQuery = signal('');

/** 当前选中的 tag 过滤器 */
export const selectedTag = signal<string>('all');

/** Prefab 版本（用于触发重渲染） */
export const prefabVersion = signal(0);

// ═══════════════════════════════════════════════════════════════
// 计算属性
// ═══════════════════════════════════════════════════════════════

/** 所有 tag 列表（从 tags 的第一项提取） */
export const allTags = computed(() => {
  const tags = new Set<string>();
  for (const prefab of prefabs.value.values()) {
    const tag = prefab.tags?.[0];
    if (tag) tags.add(tag);
  }
  return ['all', ...Array.from(tags).sort()];
});

/** 过滤后的 Prefab 列表 */
export const filteredPrefabs = computed(() => {
  const query = searchQuery.value.toLowerCase();
  const tag = selectedTag.value;

  const result: Array<{ prefabId: PrefabId; prefab: Prefab; path: string }> = [];

  for (const [prefabId, prefab] of prefabs.value) {
    // tag 过滤（匹配第一个 tag）
    if (tag !== 'all' && prefab.tags?.[0] !== tag) {
      continue;
    }

    // 搜索过滤
    if (query) {
      const path = prefabIdToPath.value.get(prefabId) || '';
      const searchText = `${prefab.name || ''} ${prefab.description || ''} ${path}`.toLowerCase();
      if (!searchText.includes(query)) {
        continue;
      }
    }

    result.push({ prefabId, prefab, path: prefabIdToPath.value.get(prefabId) || '' });
  }

  // 按首标签和名称排序
  return result.sort((a, b) => {
    const tagA = a.prefab.tags?.[0] ?? '';
    const tagB = b.prefab.tags?.[0] ?? '';
    if (tagA !== tagB) {
      return tagA.localeCompare(tagB);
    }
    return (a.prefab.name || a.prefabId).localeCompare(b.prefab.name || b.prefabId);
  });
});

/** 按 tag 分组的 Prefab */
export const prefabsByTag = computed(() => {
  const groups = new Map<string, Array<{ prefabId: PrefabId; prefab: Prefab; path: string }>>();

  for (const item of filteredPrefabs.value) {
    const tag = item.prefab.tags?.[0] ?? 'uncategorized';
    const list = groups.get(tag) || [];
    list.push(item);
    groups.set(tag, list);
  }

  return groups;
});

// ═══════════════════════════════════════════════════════════════
// 操作
// ═══════════════════════════════════════════════════════════════

/**
 * 添加或更新 Prefab（同时记录路径映射）
 */
export function setPrefab(prefabId: PrefabId, prefab: Prefab, path?: string): void {
  prefabs.value = new Map([...prefabs.value, [prefabId, prefab]]);
  if (path) {
    prefabIdToPath.value = new Map([...prefabIdToPath.value, [prefabId, path]]);
  }
  bumpVersion();
}

/**
 * 批量添加 Prefab
 */
export function setPrefabs(entries: Array<{ prefabId: PrefabId; prefab: Prefab; path?: string }>): void {
  const map = new Map(prefabs.value);
  const pathMap = new Map(prefabIdToPath.value);
  for (const { prefabId, prefab, path } of entries) {
    map.set(prefabId, prefab);
    if (path) pathMap.set(prefabId, path);
  }
  prefabs.value = map;
  prefabIdToPath.value = pathMap;
  bumpVersion();
}

/**
 * 删除 Prefab
 */
export function deletePrefab(prefabId: PrefabId): boolean {
  if (!prefabs.value.has(prefabId)) return false;

  const map = new Map(prefabs.value);
  const pathMap = new Map(prefabIdToPath.value);
  map.delete(prefabId);
  pathMap.delete(prefabId);
  prefabs.value = map;
  prefabIdToPath.value = pathMap;
  bumpVersion();
  return true;
}

/**
 * 获取单个 Prefab
 */
export function getPrefab(prefabId: PrefabId): Prefab | undefined {
  return prefabs.value.get(prefabId);
}

/**
 * 获取 Prefab 的文件路径
 */
export function getPrefabPath(prefabId: PrefabId): string | undefined {
  return prefabIdToPath.value.get(prefabId);
}

/**
 * 检查 Prefab 是否存在
 */
export function hasPrefab(prefabId: PrefabId): boolean {
  return prefabs.value.has(prefabId);
}

/**
 * 生成唯一 ID（避免冲突）——基于 PrefabId
 */
export function generateUniquePrefabId(baseId: string): string {
  const existingIds = new Set<string>(prefabs.value.keys());

  if (!existingIds.has(baseId)) return baseId;

  let counter = 2;
  let newId = `${baseId}_${counter}`;
  while (existingIds.has(newId)) {
    counter++;
    newId = `${baseId}_${counter}`;
  }
  return newId;
}

/**
 * 清空所有 Prefab
 */
export function clearPrefabs(): void {
  prefabs.value = new Map();
  prefabIdToPath.value = new Map();
  bumpVersion();
}

/**
 * 触发版本更新（强制重渲染）
 */
export function bumpVersion(): void {
  prefabVersion.value++;
}

/**
 * 加载内置的基础 Prefab
 */
export function loadBuiltinPrefabs(): void {
  clearPrefabs();
}

// ═══════════════════════════════════════════════════════════════
// 文件系统操作（后续实现）
// ═══════════════════════════════════════════════════════════════

/**
 * 从文件系统加载所有 Prefab
 * TODO: 实现文件扫描和加载
 */
export async function loadPrefabsFromDisk(): Promise<void> {
  loadBuiltinPrefabs();
}

/**
 * 保存 Prefab 到文件系统
 * TODO: 实现文件保存
 */
export async function savePrefabToDisk(prefabId: PrefabId, prefab: Prefab): Promise<void> {
  console.log('TODO: Save prefab to disk', prefabId);
}
