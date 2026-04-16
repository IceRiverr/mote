// ═══════════════════════════════════════════════════════════════
// Scene.ts - 基于 Entity 的场景定义
// 完全移除 TileLayer，所有内容都是 Prefab 实例
// ═══════════════════════════════════════════════════════════════

/**
 * 场景中的实体实例
 */
export interface SceneEntity {
  /** 实体唯一 ID */
  id: string;
  
  /** 引用的 Prefab 文件路径（相对于 assets/） */
  prefab: string;
  
  /** 显示名称覆盖（可选） */
  name?: string;
  
  /** 父实体 ID（可选，null 表示根节点） */
  parent?: string | null;
  
  /** 组件属性覆盖（可选） */
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
  /** 场景 ID */
  id: string;
  
  /** 场景名称 */
  name: string;
  
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
 */
export function createSceneEntity(
  prefabPath: string,
  x: number,
  y: number,
  options?: {
    id?: string;
    name?: string;
    parent?: string | null;
    rotation?: number;
    scaleX?: number;
    scaleY?: number;
    overrides?: Record<string, any>;
  }
): SceneEntity {
  const overrides: Record<string, any> = options?.overrides ? { ...options.overrides } : {};
  
  // Transform 覆盖统一放入 overrides
  const transform: Record<string, number> = {};
  if (x !== 0) transform.x = x;
  if (y !== 0) transform.y = y;
  if (options?.rotation !== undefined && options.rotation !== 0) transform.rotation = options.rotation;
  if (options?.scaleX !== undefined && options.scaleX !== 1) transform.scaleX = options.scaleX;
  if (options?.scaleY !== undefined && options.scaleY !== 1) transform.scaleY = options.scaleY;
  
  if (Object.keys(transform).length > 0) {
    overrides.Transform = { ...overrides.Transform, ...transform };
  }
  
  return {
    id: options?.id || generateEntityId(),
    prefab: prefabPath,
    name: options?.name,
    parent: options?.parent ?? null,
    overrides: Object.keys(overrides).length > 0 ? overrides : undefined,
    visible: true,
  };
}

// ═══════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════

let entityIdCounter = 0;

/**
 * 生成唯一的实体 ID
 */
function generateEntityId(): string {
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
 * 获取实体的 Transform 值（从 overrides 读取，提供默认值）
 */
export function getEntityTransform(entity: SceneEntity): {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
} {
  const t = entity.overrides?.Transform;
  return {
    x: t?.x ?? 0,
    y: t?.y ?? 0,
    rotation: t?.rotation ?? 0,
    scaleX: t?.scaleX ?? 1,
    scaleY: t?.scaleY ?? 1,
  };
}

/**
 * 设置实体的 Transform 值（写入 overrides）
 */
export function setEntityTransform(
  entity: SceneEntity,
  transform: Partial<{ x: number; y: number; rotation: number; scaleX: number; scaleY: number }>
): void {
  entity.overrides = entity.overrides || {};
  entity.overrides.Transform = {
    ...(entity.overrides.Transform || {}),
    ...transform,
  };
}

/**
 * 验证场景数据是否有效
 */
export function validateScene(scene: any): scene is Scene {
  if (!scene || typeof scene !== 'object') return false;
  if (!scene.id || typeof scene.id !== 'string') return false;
  if (!scene.name || typeof scene.name !== 'string') return false;
  if (typeof scene.width !== 'number') return false;
  if (typeof scene.height !== 'number') return false;
  if (!Array.isArray(scene.entities)) return false;
  
  return true;
}

/**
 * 验证实体数据是否有效
 */
export function validateEntity(entity: any): entity is SceneEntity {
  if (!entity || typeof entity !== 'object') return false;
  if (!entity.id || typeof entity.id !== 'string') return false;
  if (!entity.prefab || typeof entity.prefab !== 'string') return false;
  
  return true;
}

/**
 * 克隆实体（生成新的 ID）
 */
export function cloneEntity(entity: SceneEntity, newX?: number, newY?: number): SceneEntity {
  const overrides = entity.overrides ? { ...entity.overrides } : {};
  if (newX !== undefined || newY !== undefined) {
    overrides.Transform = { ...overrides.Transform };
    if (newX !== undefined) overrides.Transform.x = newX;
    if (newY !== undefined) overrides.Transform.y = newY;
  }
  return {
    ...entity,
    id: generateEntityId(),
    overrides: Object.keys(overrides).length > 0 ? overrides : undefined,
  };
}

/**
 * 将网格坐标转换为世界坐标
 */
export function gridToWorld(gridX: number, gridY: number, gridSize: number): { x: number; y: number } {
  return {
    x: gridX * gridSize,
    y: gridY * gridSize,
  };
}

/**
 * 将世界坐标对齐到网格
 */
export function snapToGrid(worldX: number, worldY: number, gridSize: number): { x: number; y: number } {
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
    entities: scene.entities.map(e => ({
      id: e.id,
      prefab: e.prefab,
      name: e.name,
      parent: e.parent,
      overrides: e.overrides,
    })),
  };
}
