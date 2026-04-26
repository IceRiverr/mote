// ═══════════════════════════════════════════════════════════════
// scene.ts - Scene 状态管理
// ═══════════════════════════════════════════════════════════════

import { signal, computed } from '@preact/signals';
import type { Scene, SceneEntity, GridSettings } from '../data/Scene';
import { createScene, createSceneEntity, snapToGrid, snapToSize, getNextEntityName } from '../data/Scene';
import { registerPrefabInstance, unregisterPrefabInstance, prefabInstanceMap } from './engineSync';
import { derivePrefabId } from '../data/Prefab';

// ═══════════════════════════════════════════════════════════════
// 状态
// ═══════════════════════════════════════════════════════════════

/** 当前场景 */
export const currentScene = signal<Scene | null>(null);

/** 场景版本（用于触发重渲染） */
export const sceneVersion = signal(0);

/** 选中的实体 ID 集合 */
export const selectedEntityIds = signal<Set<string>>(new Set());

/** 最后选中的实体 ID（活动选择项，用于多选时的视觉层级） */
export const lastSelectedEntityId = signal<string | null>(null);

/** 当前悬停的实体 ID */
export const hoveredEntityId = signal<string | null>(null);

/** 网格吸附开关 */
export const snapEnabled = signal(true);

// ═══════════════════════════════════════════════════════════════
// 计算属性
// ═══════════════════════════════════════════════════════════════

/** 选中的实体列表 */
export const selectedEntities = computed(() => {
  const scene = currentScene.value;
  if (!scene) return [];
  
  return scene.entities.filter(e => selectedEntityIds.value.has(e.id));
});

/** 选中的单个实体（如果没有或多选则返回 null） */
export const singleSelectedEntity = computed(() => {
  const selected = selectedEntities.value;
  return selected.length === 1 ? selected[0] : null;
});

/** 当前网格设置 */
export const gridSettings = computed(() => {
  return currentScene.value?.grid ?? { enabled: true, size: 32, snap: true };
});

// ═══════════════════════════════════════════════════════════════
// 场景操作
// ═══════════════════════════════════════════════════════════════

/**
 * 加载场景
 */
export function loadScene(scene: Scene): void {
  currentScene.value = scene;

  // 重建 Prefab 实例映射
  prefabInstanceMap.value = new Map();
  for (const entity of scene.entities) {
    registerPrefabInstance(entity.id, entity.prefab);
  }

  selectedEntityIds.value = new Set();
  bumpVersion();
}

/**
 * 创建新场景
 */
export function newScene(): void {
  const scene = createScene(
    `scene_${Date.now()}`,
    'Untitled'
  );
  loadScene(scene);
}

/**
 * 清空当前场景
 */
export function clearScene(): void {
  if (!currentScene.value) return;
  
  currentScene.value = {
    ...currentScene.value,
    entities: [],
  };
  selectedEntityIds.value = new Set();
  bumpVersion();
}

/**
 * 更新场景属性
 */
export function updateScene(updates: Partial<Scene>): void {
  if (!currentScene.value) return;
  
  currentScene.value = {
    ...currentScene.value,
    ...updates,
  };
  bumpVersion();
}

// ═══════════════════════════════════════════════════════════════
// 实体操作
// ═══════════════════════════════════════════════════════════════

/**
 * 添加实体到场景
 */
export function addEntity(entity: SceneEntity): void {
  if (!currentScene.value) return;
  
  currentScene.value = {
    ...currentScene.value,
    entities: [...currentScene.value.entities, entity],
  };
  
  bumpVersion();
}

/**
 * 从 Prefab 实例化实体
 * @param prefabIdOrPath - PrefabId（如 "npcs/enemy"）或文件路径（如 "npcs/enemy.mote-prefab.json"）
 */
export function spawnPrefab(
  prefabIdOrPath: string,
  x: number,
  y: number,
  options?: {
    id?: string;
    name?: string;
    rotation?: number;
    scaleX?: number;
    scaleY?: number;
    overrides?: Record<string, any>;
  }
): SceneEntity | null {
  if (!currentScene.value) return null;

  // 兼容文件路径和 PrefabId：去掉扩展名得到标准 PrefabId
  const prefabId = prefabIdOrPath.endsWith('.mote-prefab.json')
    ? derivePrefabId(prefabIdOrPath)
    : prefabIdOrPath;

  // 网格吸附（使用独立的 snapSize，默认回退到 grid.size）
  if (snapEnabled.value && currentScene.value.grid.snap) {
    const snapSize = currentScene.value.grid.snapSize ?? currentScene.value.grid.size;
    const snapped = snapToSize(x, y, snapSize);
    x = snapped.x;
    y = snapped.y;
  }

  // 自动生成 name：基于同 prefab 实体的最大编号 + 1
  const name = options?.name ?? getNextEntityName(prefabId, currentScene.value.entities);

  const entity = createSceneEntity(prefabId, { x, y, rotation: options?.rotation, scaleX: options?.scaleX, scaleY: options?.scaleY }, { ...options, name });
  addEntity(entity);

  // 注册 Prefab 实例映射
  registerPrefabInstance(entity.id, prefabId);

  // 自动选中新创建的实体
  selectEntity(entity.id);

  return entity;
}

/**
 * 删除实体
 */
export function removeEntity(entityId: string): boolean {
  if (!currentScene.value) return false;
  
  const index = currentScene.value.entities.findIndex(e => e.id === entityId);
  if (index === -1) return false;
  
  currentScene.value = {
    ...currentScene.value,
    entities: currentScene.value.entities.filter(e => e.id !== entityId),
  };
  
  // 从选中列表移除
  if (selectedEntityIds.value.has(entityId)) {
    const newSet = new Set(selectedEntityIds.value);
    newSet.delete(entityId);
    selectedEntityIds.value = newSet;
  }

  // 注销 Prefab 实例映射
  unregisterPrefabInstance(entityId);

  bumpVersion();
  return true;
}

/**
 * 更新实体
 */
export function updateEntity(entityId: string, updates: Partial<SceneEntity>): boolean {
  if (!currentScene.value) return false;
  
  const index = currentScene.value.entities.findIndex(e => e.id === entityId);
  if (index === -1) return false;
  
  const updatedEntities = [...currentScene.value.entities];
  updatedEntities[index] = {
    ...updatedEntities[index],
    ...updates,
  };
  
  currentScene.value = {
    ...currentScene.value,
    entities: updatedEntities,
  };
  
  bumpVersion();
  return true;
}

/**
 * 移动实体
 */
export function moveEntity(entityId: string, x: number, y: number): boolean {
  if (!currentScene.value) return false;
  
  // 网格吸附（使用独立的 snapSize，默认回退到 grid.size）
  if (snapEnabled.value && currentScene.value.grid.snap) {
    const snapSize = currentScene.value.grid.snapSize ?? currentScene.value.grid.size;
    const snapped = snapToSize(x, y, snapSize);
    x = snapped.x;
    y = snapped.y;
  }

  const entity = currentScene.value.entities.find(e => e.id === entityId);
  if (!entity) return false;
  
  entity.transform = { ...entity.transform, x, y };
  bumpVersion();
  return true;
}

// ═══════════════════════════════════════════════════════════════
// 选择操作
// ═══════════════════════════════════════════════════════════════

/**
 * 选中单个实体
 */
export function selectEntity(entityId: string): void {
  selectedEntityIds.value = new Set([entityId]);
  lastSelectedEntityId.value = entityId;
}

/**
 * 切换实体选中状态
 */
export function toggleEntitySelection(entityId: string): void {
  const newSet = new Set(selectedEntityIds.value);
  if (newSet.has(entityId)) {
    newSet.delete(entityId);
  } else {
    newSet.add(entityId);
  }
  selectedEntityIds.value = newSet;
}

/**
 * 多选实体（追加）
 */
export function addToSelection(entityId: string): void {
  const newSet = new Set(selectedEntityIds.value);
  newSet.add(entityId);
  selectedEntityIds.value = newSet;
  lastSelectedEntityId.value = entityId;
}

/**
 * 框选实体
 */
export function selectEntitiesInRect(x1: number, y1: number, x2: number, y2: number): void {
  if (!currentScene.value) return;
  
  const minX = Math.min(x1, x2);
  const maxX = Math.max(x1, x2);
  const minY = Math.min(y1, y2);
  const maxY = Math.max(y1, y2);
  
  const ids = currentScene.value.entities
    .filter(e => {
      return e.transform.x >= minX && e.transform.x <= maxX && e.transform.y >= minY && e.transform.y <= maxY;
    })
    .map(e => e.id);
  
  selectedEntityIds.value = new Set(ids);
  lastSelectedEntityId.value = ids[ids.length - 1] ?? null;
  bumpVersion();
}

/**
 * 清除选择
 */
export function clearSelection(): void {
  selectedEntityIds.value = new Set();
  lastSelectedEntityId.value = null;
}

/**
 * 全选
 */
export function selectAll(): void {
  if (!currentScene.value) return;
  selectedEntityIds.value = new Set(currentScene.value.entities.map(e => e.id));
}

// ═══════════════════════════════════════════════════════════════
// 网格操作
// ═══════════════════════════════════════════════════════════════

/**
 * 更新网格设置
 */
export function updateGrid(updates: Partial<GridSettings>): void {
  if (!currentScene.value) return;
  
  currentScene.value = {
    ...currentScene.value,
    grid: {
      ...currentScene.value.grid,
      ...updates,
    },
  };
  bumpVersion();
}

/**
 * 切换网格吸附
 */
export function toggleSnap(): void {
  snapEnabled.value = !snapEnabled.value;
}

// ═══════════════════════════════════════════════════════════════
// 保存/加载
// ═══════════════════════════════════════════════════════════════

import { getSceneFS } from '../fs/SceneFS';

/**
 * 保存当前场景
 */
export async function saveScene(): Promise<boolean> {
  if (!currentScene.value) return false;
  
  const sceneFS = getSceneFS();
  return await sceneFS.save(currentScene.value);
}

// ═══════════════════════════════════════════════════════════════
// 工具
// ═══════════════════════════════════════════════════════════════

/**
 * 触发版本更新
 */
export function bumpVersion(): void {
  sceneVersion.value++;
}

/**
 * 获取实体
 */
export function getEntity(entityId: string): SceneEntity | undefined {
  return currentScene.value?.entities.find(e => e.id === entityId);
}

/**
 * 查找在指定位置的实体（用于点击选择）
 */
export function findEntityAt(x: number, y: number, tolerance: number = 8): SceneEntity | undefined {
  if (!currentScene.value) return undefined;
  
  // 从后往前找（上层优先）
  const entities = [...currentScene.value.entities].reverse();
  
  for (const entity of entities) {
    // 简单的距离检测（后续可改进为使用 Collider）
    const dx = entity.transform.x - x;
    const dy = entity.transform.y - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist <= tolerance) {
      return entity;
    }
  }
  
  return undefined;
}
