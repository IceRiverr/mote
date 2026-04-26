// ═══════════════════════════════════════════════════════════════
// frameToPrefab.ts - 从 Sprite Frame 生成 Prefab
// ═══════════════════════════════════════════════════════════════

import type { Prefab, PrefabComponents } from '../data/Prefab';
import { PREFAB_VERSION, PREFAB_KIND } from '../data/Prefab';

/**
 * Sprite Frame 数据（来自 .mote-sprite.json）
 */
export interface SpriteFrame {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  collider?: ColliderShape[];
}

/**
 * 碰撞体形状（复用自 Collider.ts）
 */
export type ColliderShape = 
  | { type: 'rect'; width: number; height: number; offsetX?: number; offsetY?: number }
  | { type: 'circle'; radius: number; offsetX?: number; offsetY?: number }
  | { type: 'point' }
  | { type: 'full' };

/**
 * Sprite Atlas 数据
 */
export interface SpriteAtlas {
  id: string;
  name: string;
  image: string;
  frames: SpriteFrame[];
}

/**
 * 生成 Prefab 的配置选项
 */
export interface GeneratePrefabOptions {
  /** ID 前缀（批量生成时使用） */
  prefix?: string;
  /** 标签列表 */
  tags?: string[];
  /** 是否自动添加 Collider（如果 frame 有 collider 数据） */
  autoCollider?: boolean;
}

/**
 * 从单个 Frame 生成 Prefab
 */
export function generatePrefabFromFrame(
  frame: SpriteFrame,
  atlas: SpriteAtlas,
  options: GeneratePrefabOptions = {}
): Prefab {
  const { prefix, tags = ['from-sprite'], autoCollider = true } = options;
  
  // 生成名称
  const frameNum = frame.id.replace('frame_', '');
  const name = prefix 
    ? `${prefix} ${frameNum}`
    : `${atlas.name} ${frame.id}`;
  
  // 构建组件
  const components: PrefabComponents = {
    Transform: {
      x: 0,
      y: 0,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
    },
    Sprite: {
      atlas: atlas.id,
      frame: frame.id,
      layer: 0,
      tint: '#ffffff',
      flipX: false,
      flipY: false,
      alpha: 1,
      visible: true,
    },
  };
  
  // 自动添加 Collider（如果 frame 有定义且用户选择启用）
  if (autoCollider && frame.collider && frame.collider.length > 0) {
    components.Collider = {
      shapes: frame.collider,
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

/**
 * 从多个 Frame 批量生成 Prefab
 */
export function generatePrefabsFromFrames(
  frames: SpriteFrame[],
  atlas: SpriteAtlas,
  options: GeneratePrefabOptions = {}
): Prefab[] {
  return frames.map((frame, index) => {
    // 为每个 frame 生成序号
    const num = (index + 1).toString().padStart(2, '0');
    const frameOptions: GeneratePrefabOptions = {
      ...options,
      prefix: options.prefix || atlas.id,
    };
    
    return generatePrefabFromFrame(frame, atlas, frameOptions);
  });
}

/**
 * 加载 Sprite Atlas JSON 文件
 */
export async function loadSpriteAtlas(path: string): Promise<SpriteAtlas> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load sprite atlas: ${path}`);
  }
  
  const data = await response.json();
  
  // 验证格式
  if (data.type !== 'mote-sprite') {
    throw new Error(`Invalid sprite atlas format: ${path}`);
  }
  
  return {
    id: data.id,
    name: data.name,
    image: data.image,
    frames: data.frames,
  };
}

/**
 * 建议的 Prefab ID（检查冲突并返回可用 ID）
 */
export function suggestPrefabId(
  baseId: string,
  existingIds: Set<string>
): string {
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
 * 解析 sprite 引用字符串
 * 格式: "atlasId:frameId"
 */
export function parseSpriteRef(ref: string): { atlas: string; frame: string } | null {
  const parts = ref.split(':');
  if (parts.length !== 2) return null;
  return { atlas: parts[0], frame: parts[1] };
}

/**
 * 构建 sprite 引用字符串
 */
export function buildSpriteRef(atlas: string, frame: string): string {
  return `${atlas}:${frame}`;
}
