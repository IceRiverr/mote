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
  
  /** 引用的 Prefab ID */
  prefab: string;
  
  /** 显示名称覆盖（可选） */
  name?: string;
  
  /** X 坐标（像素） */
  x: number;
  
  /** Y 坐标（像素） */
  y: number;
  
  /** 旋转角度（度，可选） */
  rotation?: number;
  
  /** X 轴缩放（可选） */
  scaleX?: number;
  
  /** Y 轴缩放（可选） */
  scaleY?: number;
  
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
): SceneEntity {
  return {
    id: options?.id || generateEntityId(),
    prefab: prefabId,
    name: options?.name,
    x,
    y,
    rotation: options?.rotation,
    scaleX: options?.scaleX,
    scaleY: options?.scaleY,
    overrides: options?.overrides,
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
  if (typeof entity.x !== 'number') return false;
  if (typeof entity.y !== 'number') return false;
  
  return true;
}

/**
 * 克隆实体（生成新的 ID）
 */
export function cloneEntity(entity: SceneEntity, newX?: number, newY?: number): SceneEntity {
  return {
    ...entity,
    id: generateEntityId(),
    x: newX ?? entity.x,
    y: newY ?? entity.y,
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
      x: e.x,
      y: e.y,
      rotation: e.rotation,
      scaleX: e.scaleX,
      scaleY: e.scaleY,
      overrides: e.overrides,
    })),
  };
}
