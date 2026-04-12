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

/** 所有分类列表 */
export const categories = computed(() => {
  const cats = new Set<string>();
  for (const prefab of prefabs.value.values()) {
    cats.add(prefab.category);
  }
  return ['all', ...Array.from(cats).sort()];
});

/** 过滤后的 Prefab 列表 */
export const filteredPrefabs = computed(() => {
  const query = searchQuery.value.toLowerCase();
  const category = selectedCategory.value;
  
  const result: Prefab[] = [];
  
  for (const prefab of prefabs.value.values()) {
    // 分类过滤
    if (category !== 'all' && prefab.category !== category) {
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
  
  // 按分类和名称排序
  return result.sort((a, b) => {
    if (a.category !== b.category) {
      return a.category.localeCompare(b.category);
    }
    return a.name.localeCompare(b.name);
  });
});

/** 按分类分组的 Prefab */
export const prefabsByCategory = computed(() => {
  const groups = new Map<string, Prefab[]>();
  
  for (const prefab of filteredPrefabs.value) {
    const list = groups.get(prefab.category) || [];
    list.push(prefab);
    groups.set(prefab.category, list);
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
  const builtins: Prefab[] = [
    {
      id: 'empty',
      name: '空实体',
      category: 'system',
      components: {
        Transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
      },
    },
    // 环境 - 地板
    {
      id: 'floor_grass',
      name: '草地',
      category: 'environment',
      components: {
        Transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        Sprite: { atlas: 'tiny-dungeon', frame: 'frame_0', layer: 0, tint: '#ffffff', flipX: false, flipY: false, alpha: 1, visible: true },
      },
    },
    {
      id: 'floor_stone',
      name: '石砖',
      category: 'environment',
      components: {
        Transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        Sprite: { atlas: 'tiny-dungeon', frame: 'frame_12', layer: 0, tint: '#ffffff', flipX: false, flipY: false, alpha: 1, visible: true },
      },
    },
    {
      id: 'floor_wood',
      name: '木地板',
      category: 'environment',
      components: {
        Transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        Sprite: { atlas: 'tiny-dungeon', frame: 'frame_24', layer: 0, tint: '#ffffff', flipX: false, flipY: false, alpha: 1, visible: true },
      },
    },
    // 墙壁
    {
      id: 'wall_brick',
      name: '砖墙',
      category: 'walls',
      components: {
        Transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        Sprite: { atlas: 'tiny-dungeon', frame: 'frame_7', layer: 1, tint: '#ffffff', flipX: false, flipY: false, alpha: 1, visible: true },
        Collider: { shapes: [{ type: 'full' }], isTrigger: false, material: 'default', layer: 1, mask: 0xFFFFFFFF },
      },
    },
    {
      id: 'wall_corner',
      name: '墙角',
      category: 'walls',
      components: {
        Transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        Sprite: { atlas: 'tiny-dungeon', frame: 'frame_14', layer: 1, tint: '#ffffff', flipX: false, flipY: false, alpha: 1, visible: true },
        Collider: { shapes: [{ type: 'full' }], isTrigger: false, material: 'default', layer: 1, mask: 0xFFFFFFFF },
      },
    },
    // 角色
    {
      id: 'player',
      name: '玩家',
      category: 'characters',
      components: {
        Transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        Sprite: { atlas: 'tiny-dungeon', frame: 'frame_60', layer: 2, tint: '#ffffff', flipX: false, flipY: false, alpha: 1, visible: true },
        Collider: { shapes: [{ type: 'rect', width: 12, height: 12 }], isTrigger: false, material: 'default', layer: 2, mask: 0xFFFFFFFF },
      },
    },
    {
      id: 'goblin',
      name: '哥布林',
      category: 'characters',
      components: {
        Transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        Sprite: { atlas: 'tiny-dungeon', frame: 'frame_61', layer: 2, tint: '#ffffff', flipX: false, flipY: false, alpha: 1, visible: true },
        Collider: { shapes: [{ type: 'rect', width: 12, height: 12 }], isTrigger: false, material: 'default', layer: 2, mask: 0xFFFFFFFF },
      },
    },
    // 道具
    {
      id: 'potion_red',
      name: '红药水',
      category: 'items',
      components: {
        Transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        Sprite: { atlas: 'tiny-dungeon', frame: 'frame_80', layer: 1, tint: '#ffffff', flipX: false, flipY: false, alpha: 1, visible: true },
      },
    },
    {
      id: 'chest',
      name: '宝箱',
      category: 'items',
      components: {
        Transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
        Sprite: { atlas: 'tiny-dungeon', frame: 'frame_90', layer: 1, tint: '#ffffff', flipX: false, flipY: false, alpha: 1, visible: true },
      },
    },
  ];
  
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
