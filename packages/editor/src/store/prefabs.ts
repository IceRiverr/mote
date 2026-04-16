// ═══════════════════════════════════════════════════════════════
// prefabs.ts - Prefab 状态管理
// ═══════════════════════════════════════════════════════════════

import { signal, computed, type Signal } from '@preact/signals';
import type { Prefab } from '../data/Prefab';

// ═══════════════════════════════════════════════════════════════
// 状态
// ═══════════════════════════════════════════════════════════════

/** 所有已加载的 Prefab */
export const prefabs = signal<Map<string, Prefab>>(new Map());

/** 搜索关键词 */
export const searchQuery = signal('');

/** 当前选中的分类 */
export const selectedCategory = signal<string>('all');

/** Prefab 版本（用于触发重渲染） */
export const prefabVersion = signal(0);

// ═══════════════════════════════════════════════════════════════
// 计算属性
// ═══════════════════════════════════════════════════════════════

/** 所有分类列表（从 tags 的第一项提取） */
export const categories = computed(() => {
  const cats = new Set<string>();
  for (const prefab of prefabs.value.values()) {
    const tag = prefab.tags?.[0];
    if (tag) cats.add(tag);
  }
  return ['all', ...Array.from(cats).sort()];
});

/** 过滤后的 Prefab 列表 */
export const filteredPrefabs = computed(() => {
  const query = searchQuery.value.toLowerCase();
  const category = selectedCategory.value;
  
  const result: Prefab[] = [];
  
  for (const prefab of prefabs.value.values()) {
    // 分类过滤（匹配第一个 tag）
    if (category !== 'all' && prefab.tags?.[0] !== category) {
      continue;
    }
    
    // 搜索过滤
    if (query) {
      const searchText = `${prefab.id} ${prefab.name} ${prefab.description || ''}`.toLowerCase();
      if (!searchText.includes(query)) {
        continue;
      }
    }
    
    result.push(prefab);
  }
  
  // 按首标签和名称排序
  return result.sort((a, b) => {
    const tagA = a.tags?.[0] ?? '';
    const tagB = b.tags?.[0] ?? '';
    if (tagA !== tagB) {
      return tagA.localeCompare(tagB);
    }
    return a.name.localeCompare(b.name);
  });
});

/** 按分类分组的 Prefab */
export const prefabsByCategory = computed(() => {
  const groups = new Map<string, Prefab[]>();
  
  for (const prefab of filteredPrefabs.value) {
    const tag = prefab.tags?.[0] ?? 'uncategorized';
    const list = groups.get(tag) || [];
    list.push(prefab);
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
export function setPrefab(prefab: Prefab): void {
  prefabs.value = new Map([...prefabs.value, [prefab.id, prefab]]);
  bumpVersion();
}

/**
 * 批量添加 Prefab
 */
export function setPrefabs(newPrefabs: Prefab[]): void {
  const map = new Map(prefabs.value);
  for (const prefab of newPrefabs) {
    map.set(prefab.id, prefab);
  }
  prefabs.value = map;
  bumpVersion();
}

/**
 * 删除 Prefab
 */
export function deletePrefab(id: string): boolean {
  if (!prefabs.value.has(id)) return false;
  
  const map = new Map(prefabs.value);
  map.delete(id);
  prefabs.value = map;
  bumpVersion();
  return true;
}

/**
 * 获取单个 Prefab
 */
export function getPrefab(id: string): Prefab | undefined {
  return prefabs.value.get(id);
}

/**
 * 检查 Prefab 是否存在
 */
export function hasPrefab(id: string): boolean {
  return prefabs.value.has(id);
}

/**
 * 生成唯一 ID（避免冲突）
 */
export function generateUniqueId(baseId: string): string {
  if (!prefabs.value.has(baseId)) return baseId;
  
  let counter = 2;
  let newId = `${baseId}_${counter}`;
  while (prefabs.value.has(newId)) {
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

// ═══════════════════════════════════════════════════════════════
// 内置 Prefab
// ═══════════════════════════════════════════════════════════════

/**
 * 加载内置的基础 Prefab
 */
export function loadBuiltinPrefabs(): void {
  // 清空所有预制 Prefab
  const builtins: Prefab[] = [];
  
  setPrefabs(builtins);
}

// ═══════════════════════════════════════════════════════════════
// 文件系统操作（后续实现）
// ═══════════════════════════════════════════════════════════════

/**
 * 从文件系统加载所有 Prefab
 * TODO: 实现文件扫描和加载
 */
export async function loadPrefabsFromDisk(): Promise<void> {
  // 暂时加载内置 Prefab
  loadBuiltinPrefabs();
}

/**
 * 保存 Prefab 到文件系统
 * TODO: 实现文件保存
 */
export async function savePrefabToDisk(prefab: Prefab): Promise<void> {
  console.log('TODO: Save prefab to disk', prefab.id);
}
