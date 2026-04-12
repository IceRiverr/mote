// ═══════════════════════════════════════════════════════════════
// Prefab.ts - Prefab 类型定义和数据操作
// ═══════════════════════════════════════════════════════════════

/**
 * Prefab 组件配置
 */
export interface PrefabComponents {
  [componentName: string]: Record<string, any>;
}

/**
 * Prefab - 可复用的实体模板
 * 
 * 这是 Editor 和 ECS 共享的数据格式
 * JSON 文件直接对应 ECS 的 Prefab 定义
 */
export interface Prefab {
  /** 唯一标识符（snake_case） */
  id: string;
  
  /** 显示名称 */
  name: string;
  
  /** 分类，用于浏览器分组 */
  category: string;
  
  /** 组件配置 */
  components: PrefabComponents;
  
  /** 缩略图路径或 base64（可选） */
  thumbnail?: string;
  
  /** 描述（可选） */
  description?: string;
}

/**
 * 创建 Prefab 的工厂函数
 */
export function createPrefab(
  id: string,
  name: string,
  category: string = 'uncategorized',
  components: PrefabComponents = {}
): Prefab {
  // 确保至少包含 Transform
  if (!components.Transform) {
    components.Transform = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
  }
  
  return {
    id,
    name,
    category,
    components,
  };
}

/**
 * 从 Sprite Frame 创建基础 Prefab
 */
export function createPrefabFromSprite(
  id: string,
  name: string,
  category: string,
  atlasId: string,
  frameId: string,
  collider?: any
): Prefab {
  const components: PrefabComponents = {
    Transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    Sprite: {
      atlas: atlasId,
      frame: frameId,
      layer: 0,
      tint: '#ffffff',
      flipX: false,
      flipY: false,
      alpha: 1,
      visible: true,
    },
  };
  
  // 如果有碰撞数据，自动添加 Collider
  if (collider) {
    components.Collider = {
      shapes: collider,
      isTrigger: false,
      material: 'default',
      layer: 1,
      mask: 0xFFFFFFFF,
    };
  }
  
  return {
    id,
    name,
    category,
    components,
  };
}

/**
 * 验证 Prefab 是否有效
 */
export function validatePrefab(prefab: any): prefab is Prefab {
  if (!prefab || typeof prefab !== 'object') return false;
  if (!prefab.id || typeof prefab.id !== 'string') return false;
  if (!prefab.name || typeof prefab.name !== 'string') return false;
  if (!prefab.components || typeof prefab.components !== 'object') return false;
  
  // 必须包含 Transform
  if (!prefab.components.Transform) return false;
  
  return true;
}

/**
 * 获取 Prefab 的显示名称（优先使用 name，回退到 id）
 */
export function getPrefabDisplayName(prefab: Prefab): string {
  return prefab.name || prefab.id;
}

/**
 * 获取 Prefab 的缩略图（如有）
 */
export function getPrefabThumbnail(prefab: Prefab): string | undefined {
  // 如果有显式 thumbnail，使用它
  if (prefab.thumbnail) return prefab.thumbnail;
  
  // 否则尝试从 Sprite 组件推断
  const sprite = prefab.components.Sprite;
  if (sprite?.atlas && sprite?.frame) {
    // 返回一个标识符，让 UI 层去加载实际图像
    return `sprite:${sprite.atlas}:${sprite.frame}`;
  }
  
  return undefined;
}
