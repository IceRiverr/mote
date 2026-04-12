// ═══════════════════════════════════════════════════════════════
// scene.ts - Scene 状态管理
// ═══════════════════════════════════════════════════════════════

import { signal, computed } from '@preact/signals';
import type { Scene, SceneEntity, GridSettings } from '../data/Scene';
import { createScene, createSceneEntity, snapToGrid } from '../data/Scene';

// ═══════════════════════════════════════════════════════════════
// 状态
// ═══════════════════════════════════════════════════════════════

/** 当前场景 */
export const currentScene = signal<Scene | null>(null);

/** 场景版本（用于触发重渲染） */
export const sceneVersion = signal(0);

/** 选中的实体 ID 集合 */
export const selectedEntityIds = signal<Set<string>>(new Set());

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
  selectedEntityIds.value = new Set();
  bumpVersion();
}

/**
 * 创建新场景
 */
export function newScene(width: number = 640, height: number = 480): void {
  const scene = createScene(
    `scene_${Date.now()}`,
    'Untitled',
    width,
    height
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
 */
export function spawnPrefab(
  prefabId: string,
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
  
  // 网格吸附
  if (snapEnabled.value && currentScene.value.grid.snap) {
    const snapped = snapToGrid(x, y, currentScene.value.grid.size);
    x = snapped.x;
    y = snapped.y;
  }
  
  const entity = createSceneEntity(prefabId, x, y, options);
  addEntity(entity);
  
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
  // 网格吸附
  if (snapEnabled.value && currentScene.value?.grid.snap) {
    const snapped = snapToGrid(x, y, currentScene.value.grid.size);
    x = snapped.x;
    y = snapped.y;
  }
  
  return updateEntity(entityId, { x, y });
}

// ═══════════════════════════════════════════════════════════════
// 选择操作
// ═══════════════════════════════════════════════════════════════

/**
 * 选中单个实体
 */
export function selectEntity(entityId: string): void {
  selectedEntityIds.value = new Set([entityId]);
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
    .filter(e => e.x >= minX && e.x <= maxX && e.y >= minY && e.y <= maxY)
    .map(e => e.id);
  
  selectedEntityIds.value = new Set(ids);
  bumpVersion();
}

/**
 * 清除选择
 */
export function clearSelection(): void {
  selectedEntityIds.value = new Set();
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
    const dx = entity.x - x;
    const dy = entity.y - y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist <= tolerance) {
      return entity;
    }
  }
  
  return undefined;
}
