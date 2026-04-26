// ═══════════════════════════════════════════════════════════════
// Prefab.ts - Prefab 类型定义和数据操作
// ═══════════════════════════════════════════════════════════════

import { ENGINE_VERSION } from '@mote/engine/core/version';

/** Prefab 文件格式版本（统一使用 Engine 版本） */
export const PREFAB_VERSION = ENGINE_VERSION;

/** Prefab 文件 kind */
export const PREFAB_KIND = 'prefab' as const;

/** Prefab 组件配置 */
export interface PrefabComponents {
  [componentName: string]: Record<string, any>;
}

/** 运行时推导的 Prefab ID（相对路径，不含扩展名） */
export type PrefabId = string;

/**
 * Prefab - 可复用的实体模板
 *
 * v2 格式变更：
 * - 删除文件内 id 字段，运行时由文件路径推导
 * - 增加 version / kind 字段用于文件自识别
 * - name 变为可选，默认使用文件名
 */
export interface Prefab {
  /** 文件格式版本 */
  version: string;

  /** 文件类型标识 */
  kind: typeof PREFAB_KIND;

  /** 显示名称（可选，默认用文件名） */
  name?: string;

  /** 分类标签，用于浏览器分组和过滤（可选） */
  tags?: string[];

  /** 组件模板（默认值） */
  components: PrefabComponents;

  /** 缩略图路径或 base64（可选） */
  thumbnail?: string;

  /** 描述（可选） */
  description?: string;
}

// ═══════════════════════════════════════════════════════════════
// 路径推导
// ═══════════════════════════════════════════════════════════════

const PREFAB_EXTENSION = '.mote-prefab.json';

/**
 * 从文件路径推导 Prefab ID
 * e.g. "assets/npcs/enemy.mote-prefab.json" → "npcs/enemy"
 *      "player.mote-prefab.json" → "player"
 */
export function derivePrefabId(relativePath: string): PrefabId {
  // 去掉开头的 assets/ 前缀（如果存在）
  let path = relativePath;
  if (path.startsWith('assets/')) {
    path = path.slice(7);
  }
  // 去掉扩展名
  if (path.endsWith(PREFAB_EXTENSION)) {
    path = path.slice(0, -PREFAB_EXTENSION.length);
  }
  return path;
}

/**
 * 从文件路径推导默认显示名
 * e.g. "assets/npcs/enemy.mote-prefab.json" → "enemy"
 */
export function derivePrefabName(relativePath: string): string {
  const id = derivePrefabId(relativePath);
  const lastSlash = id.lastIndexOf('/');
  return lastSlash >= 0 ? id.slice(lastSlash + 1) : id;
}

/**
 * 从 Prefab ID 推导文件路径
 * e.g. "npcs/enemy" → "npcs/enemy.mote-prefab.json"
 */
export function derivePrefabPath(prefabId: PrefabId): string {
  return `${prefabId}${PREFAB_EXTENSION}`;
}

// ═══════════════════════════════════════════════════════════════
// 工厂函数
// ═══════════════════════════════════════════════════════════════

/**
 * 创建空 Prefab
 */
export function createPrefab(
  name?: string,
  tags: string[] = [],
  components: PrefabComponents = {}
): Prefab {
  // 确保至少包含 Transform
  if (!components.Transform) {
    components.Transform = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };
  }

  return {
    version: PREFAB_VERSION,
    kind: PREFAB_KIND,
    name,
    tags,
    components,
  };
}

/**
 * 从 Sprite Frame 创建基础 Prefab
 */
export function createPrefabFromSprite(
  name: string,
  tags: string[],
  atlasPath: string,
  frameId: string,
  collider?: any
): Prefab {
  const components: PrefabComponents = {
    Transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    Sprite: {
      atlas: atlasPath,
      frame: frameId,
      layer: 0,
      tint: '#ffffff',
      flipX: false,
      flipY: false,
      alpha: 1,
      visible: true,
    },
  };

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
    version: PREFAB_VERSION,
    kind: PREFAB_KIND,
    name,
    tags,
    components,
  };
}

// ═══════════════════════════════════════════════════════════════
// 验证
// ═══════════════════════════════════════════════════════════════

/**
 * 验证 Prefab 是否有效（v2 格式）
 */
export function validatePrefab(prefab: any): prefab is Prefab {
  if (!prefab || typeof prefab !== 'object') return false;
  if (prefab.version !== PREFAB_VERSION) return false;
  if (prefab.kind !== PREFAB_KIND) return false;
  if (!prefab.components || typeof prefab.components !== 'object') return false;

  // 必须包含 Transform
  if (!prefab.components.Transform) return false;

  return true;
}

// ═══════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════

/**
 * 获取 Prefab 的显示名称（优先使用 name，回退到推导名）
 */
export function getPrefabDisplayName(prefab: Prefab, fallbackName?: string): string {
  return prefab.name || fallbackName || '(未命名)';
}

/**
 * 获取 Prefab 的缩略图（如有）
 */
export function getPrefabThumbnail(prefab: Prefab): string | undefined {
  if (prefab.thumbnail) return prefab.thumbnail;

  const sprite = prefab.components.Sprite;
  if (sprite?.atlas && sprite?.frame) {
    return `sprite:${sprite.atlas}:${sprite.frame}`;
  }

  return undefined;
}
