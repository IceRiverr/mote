// ═══════════════════════════════════════════════════════════════
// prefabs.ts - Prefab 状态管理
// 
// 设计原则：以文件路径为唯一键，不依赖 id 唯一性
// ═══════════════════════════════════════════════════════════════

import { signal, computed, type Signal } from '@preact/signals';
import type { Prefab } from '../data/Prefab';

// ═══════════════════════════════════════════════════════════════
// 状态
// ═══════════════════════════════════════════════════════════════

/** 所有已加载的 Prefab: path -> Prefab */
export const prefabs = signal<Map<string, Prefab>>(new Map());

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
  
  const result: Array<{ path: string; prefab: Prefab }> = [];
  
  for (const [path, prefab] of prefabs.value) {
    // tag 过滤（匹配第一个 tag）
    if (tag !== 'all' && prefab.tags?.[0] !== tag) {
      continue;
    }
    
    // 搜索过滤
    if (query) {
      const searchText = `${prefab.id} ${prefab.name} ${prefab.description || ''} ${path}`.toLowerCase();
      if (!searchText.includes(query)) {
        continue;
      }
    }
    
    result.push({ path, prefab });
  }
  
  // 按首标签和名称排序
  return result.sort((a, b) => {
    const tagA = a.prefab.tags?.[0] ?? '';
    const tagB = b.prefab.tags?.[0] ?? '';
    if (tagA !== tagB) {
      return tagA.localeCompare(tagB);
    }
    return a.prefab.name.localeCompare(b.prefab.name);
  });
});

/** 按 tag 分组的 Prefab */
export const prefabsByTag = computed(() => {
  const groups = new Map<string, Array<{ path: string; prefab: Prefab }>>();
  
  for (const { path, prefab } of filteredPrefabs.value) {
    const tag = prefab.tags?.[0] ?? 'uncategorized';
    const list = groups.get(tag) || [];
    list.push({ path, prefab });
    groups.set(tag, list);
  }
  
  return groups;
});

// ═══════════════════════════════════════════════════════════════
// 操作
// ═══════════════════════════════════════════════════════════════

/**
 * 添加或更新 Prefab
 */
export function setPrefab(path: string, prefab: Prefab): void {
  prefabs.value = new Map([...prefabs.value, [path, prefab]]);
  bumpVersion();
}

/**
 * 批量添加 Prefab
 */
export function setPrefabs(entries: Array<{ path: string; prefab: Prefab }>): void {
  const map = new Map(prefabs.value);
  for (const { path, prefab } of entries) {
    map.set(path, prefab);
  }
  prefabs.value = map;
  bumpVersion();
}

/**
 * 删除 Prefab
 */
export function deletePrefab(path: string): boolean {
  if (!prefabs.value.has(path)) return false;
  
  const map = new Map(prefabs.value);
  map.delete(path);
  prefabs.value = map;
  bumpVersion();
  return true;
}

/**
 * 获取单个 Prefab
 */
export function getPrefab(path: string): Prefab | undefined {
  return prefabs.value.get(path);
}

/**
 * 检查 Prefab 是否存在
 */
export function hasPrefab(path: string): boolean {
  return prefabs.value.has(path);
}

/**
 * 生成唯一 ID（避免冲突）
 */
export function generateUniqueId(baseId: string): string {
  const existingIds = new Set<string>();
  for (const prefab of prefabs.value.values()) {
    existingIds.add(prefab.id);
  }
  
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
export async function savePrefabToDisk(path: string, prefab: Prefab): Promise<void> {
  console.log('TODO: Save prefab to disk', path);
}
