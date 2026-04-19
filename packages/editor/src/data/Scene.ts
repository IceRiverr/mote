// ═══════════════════════════════════════════════════════════════
// Scene.ts - 基于 Entity 的场景定义（v2 格式）
// ═══════════════════════════════════════════════════════════════

import type { Prefab, PrefabId } from './Prefab';
import { derivePrefabId } from './Prefab';
import { applyOverrides } from '@mote/engine/core/prefab';
import { ENGINE_VERSION } from '@mote/engine/core/version';

/** Scene 文件格式版本（统一使用 Engine 版本） */
export const SCENE_VERSION = ENGINE_VERSION;

/** Scene 文件 kind */
export const SCENE_KIND = 'scene' as const;

/**
 * 场景中的实体实例
 *
 * v2 格式变更：
 * - 新增独立 transform 字段（不再是 override 的一部分）
 * - prefab 字段改为 PrefabId（推导路径）
 * - overrides 仅存储非 Transform 组件的差异
 */
export interface SceneEntity {
  /** 运行时唯一 ID（仅内存中使用，不序列化到文件） */
  id: string;

  /** 引用 Prefab 的推导 ID（相对路径不含扩展名） */
  prefab: PrefabId;

  /** 显示名称（用于 SceneTree，可编辑，序列化到文件） */
  name: string;

  /** 父实体 ID（可选，null 表示根节点） */
  parent?: string | null;

  /** 实例固有 Transform（不是 override） */
  transform: {
    x: number;
    y: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
  };

  /** 组件属性覆盖（仅非 Transform 组件的差异） */
  overrides?: {
    [componentName: string]: Record<string, any>;
  };

  /** 是否可见（可选，默认 true） */
  visible?: boolean;
}

/**
 * 网格设置
 */
export interface GridSettings {
  /** 是否启用网格 */
  enabled: boolean;

  /** 网格大小（像素） */
  size: number;

  /** 是否吸附到网格 */
  snap: boolean;

  /** 网格颜色（CSS 颜色） */
  color?: string;
}

/**
 * 场景定义
 */
export interface Scene {
  /** 场景格式版本 */
  version: string;

  /** 文件类型标识 */
  kind: typeof SCENE_KIND;

  /** 场景 ID */
  id: string;

  /** 场景名称 */
  name: string;

  /** 场景文件路径（相对于 assets/） */
  path?: string;

  /** 场景宽度（像素） */
  width: number;

  /** 场景高度（像素） */
  height: number;

  /** 网格设置 */
  grid: GridSettings;

  /** 场景中的所有实体 */
  entities: SceneEntity[];
}

// ═══════════════════════════════════════════════════════════════
// 工厂函数
// ═══════════════════════════════════════════════════════════════

/**
 * 创建新场景
 */
export function createScene(
  id: string,
  name: string,
  width: number = 640,
  height: number = 480
): Scene {
  return {
    version: SCENE_VERSION,
    kind: SCENE_KIND,
    id,
    name,
    width,
    height,
    grid: {
      enabled: true,
      size: 32,
      snap: true,
      color: 'rgba(255, 255, 255, 0.2)',
    },
    entities: [],
  };
}

/**
 * 从 Prefab 创建实体
 * @param prefabIdOrPath - PrefabId（如 "npcs/enemy"）或文件路径（如 "npcs/enemy.mote-prefab.json"）
 */
export function createSceneEntity(
  prefabIdOrPath: PrefabId | string,
  transform: {
    x: number;
    y: number;
    rotation?: number;
    scaleX?: number;
    scaleY?: number;
  },
  options?: {
    name?: string;
    parent?: string | null;
    overrides?: Record<string, Record<string, any>>;
  }
): SceneEntity {
  // 兼容文件路径：去掉扩展名得到标准 PrefabId
  const prefabId = prefabIdOrPath.endsWith('.mote-prefab.json')
    ? derivePrefabId(prefabIdOrPath)
    : prefabIdOrPath;

  return {
    id: generateEntityId(),
    prefab: prefabId,
    name: options?.name ?? prefabId,
    parent: options?.parent ?? null,
    transform: {
      x: transform.x,
      y: transform.y,
      rotation: transform.rotation ?? 0,
      scaleX: transform.scaleX ?? 1,
      scaleY: transform.scaleY ?? 1,
    },
    overrides:
      options?.overrides && Object.keys(options.overrides).length > 0
        ? structuredClone(options.overrides)
        : undefined,
    visible: true,
  };
}

// ═══════════════════════════════════════════════════════════════
// 组件解析
// ═══════════════════════════════════════════════════════════════

/**
 * 计算实体的完整组件数据（Prefab 默认值 + overrides）
 * 返回深拷贝后的 merged 数据，保证引用隔离
 */
export function resolveEntityComponents(
  entity: SceneEntity,
  prefab: Prefab
): Record<string, Record<string, any>> {
  return applyOverrides(prefab.components, entity.overrides ?? {}) as Record<string, Record<string, any>>;
}

// ═══════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════

let entityIdCounter = 0;

/**
 * 生成唯一的实体 ID
 */
/**
 * 生成唯一的运行时实体 ID
 * 注意：仅用于内存中的编辑器状态，不序列化到文件
 */
export function generateEntityId(): string {
  entityIdCounter++;
  return `e_${Date.now().toString(36)}_${entityIdCounter.toString(36)}`;
}

/**
 * 重置实体 ID 计数器（用于测试）
 */
export function resetEntityIdCounter(): void {
  entityIdCounter = 0;
}

/**
 * 生成下一个 entity 名称（基于同 prefab 实体的最大编号 + 1）
 * 例如：已有 prefab_1, prefab_9 → 返回 prefab_10
 */
export function getNextEntityName(prefabId: PrefabId, entities: SceneEntity[]): string {
  let maxNum = 0;
  const regex = new RegExp(`^${prefabId}_(\\d+)$`);

  for (const e of entities) {
    if (e.prefab !== prefabId) continue;
    const match = e.name.match(regex);
    if (match) {
      const num = parseInt(match[1], 10);
      if (num > maxNum) maxNum = num;
    }
  }

  return `${prefabId}_${maxNum + 1}`;
}

/**
 * 验证场景数据是否有效（v2）
 */
export function validateScene(scene: any): scene is Scene {
  if (!scene || typeof scene !== 'object') return false;
  if (scene.version !== SCENE_VERSION) return false;
  if (scene.kind !== SCENE_KIND) return false;
  if (!scene.id || typeof scene.id !== 'string') return false;
  if (!scene.name || typeof scene.name !== 'string') return false;
  if (typeof scene.width !== 'number') return false;
  if (typeof scene.height !== 'number') return false;
  if (!Array.isArray(scene.entities)) return false;

  // 逐个验证 entity（新格式严格要求）
  for (const e of scene.entities) {
    if (!validateEntity(e)) return false;
  }

  return true;
}

/**
 * 验证实体数据是否有效
 */
export function validateEntity(entity: any): entity is SceneEntity {
  if (!entity || typeof entity !== 'object') return false;
  if (!entity.prefab || typeof entity.prefab !== 'string') return false;
  if (!entity.name || typeof entity.name !== 'string') return false;
  if (!entity.transform || typeof entity.transform !== 'object') return false;
  if (typeof entity.transform.x !== 'number') return false;
  if (typeof entity.transform.y !== 'number') return false;

  return true;
}

/**
 * 克隆实体（生成新的 ID，可选调整位置）
 */
export function cloneEntity(
  entity: SceneEntity,
  newTransform?: Partial<SceneEntity['transform']>
): SceneEntity {
  return {
    ...entity,
    id: generateEntityId(),
    name: `${entity.name}_copy`,
    transform: newTransform
      ? { ...entity.transform, ...newTransform }
      : { ...entity.transform },
    overrides: entity.overrides ? structuredClone(entity.overrides) : undefined,
  };
}

/**
 * 将网格坐标转换为世界坐标
 */
export function gridToWorld(
  gridX: number,
  gridY: number,
  gridSize: number
): { x: number; y: number } {
  return {
    x: gridX * gridSize,
    y: gridY * gridSize,
  };
}

/**
 * 将世界坐标对齐到网格
 */
export function snapToGrid(
  worldX: number,
  worldY: number,
  gridSize: number
): { x: number; y: number } {
  return {
    x: Math.round(worldX / gridSize) * gridSize,
    y: Math.round(worldY / gridSize) * gridSize,
  };
}

/**
 * 导出为 ECS 可用的 JSON 格式
 */
export function exportToECS(scene: Scene): object {
  return {
    id: scene.id,
    name: scene.name,
    bounds: {
      width: scene.width,
      height: scene.height,
    },
    entities: scene.entities.map((e) => ({
      prefab: e.prefab,
      name: e.name,
      parent: e.parent,
      transform: e.transform,
      overrides: e.overrides,
    })),
  };
}


