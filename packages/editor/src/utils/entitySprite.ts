// ═══════════════════════════════════════════════════════════════
// entitySprite.ts — 解析实体的精灵显示数据
// 桥接 prefabs + spriteSheets stores
// ═══════════════════════════════════════════════════════════════

import type { SceneEntity } from "../data/Scene";
import { getPrefab } from "../store/prefabs";
import { getSpriteSheet, spriteSheetImages, spriteSheets } from "../store/spriteSheet";
import type { FrameData } from "../data/SpriteSheet";

/**
 * 从可能的 atlas 路径中提取 sheet id
 * e.g. "sprites/tiny-dungeon.mote-sprite.json" → "tiny-dungeon"
 */
function extractSheetId(raw: string): string | null {
  // 去掉路径前缀
  const name = raw.replace(/^.*[\\/]/, '');
  // 去掉 .mote-sprite.json 后缀
  if (name.endsWith('.mote-sprite.json')) {
    return name.slice(0, -'.mote-sprite.json'.length);
  }
  // 尝试其他常见后缀
  if (name.endsWith('.json')) {
    return name.slice(0, -'.json'.length);
  }
  return name;
}

export interface ResolvedSprite {
  image: HTMLImageElement | null;
  frame: { x: number; y: number; w: number; h: number } | null;
  rotated: boolean;
}

/**
 * 解析实体对应的精灵图片和帧矩形
 * 
 * 流程：entity.prefab → Prefab.components.Sprite → atlas + frame
 * → spriteSheetImages[atlas] + spriteSheets[atlas].frames[frame]
 */
export function resolveEntitySprite(entity: SceneEntity): ResolvedSprite {
  const prefab = getPrefab(entity.prefab);
  if (!prefab) {
    console.warn('[resolveEntitySprite] prefab not found:', entity.prefab);
    return { image: null, frame: null, rotated: false };
  }

  const sprite = prefab.components.Sprite as
    | {
        atlas?: string;
        frame?: string;
        visible?: boolean;
      }
    | undefined;

  if (!sprite || sprite.visible === false) {
    console.warn('[resolveEntitySprite] no Sprite component or invisible:', entity.prefab);
    return { image: null, frame: null, rotated: false };
  }

  const rawAtlas = sprite.atlas;
  const frameId = sprite.frame;
  if (!rawAtlas || !frameId) {
    console.warn('[resolveEntitySprite] missing atlas/frame:', { rawAtlas, frameId, prefab: entity.prefab });
    return { image: null, frame: null, rotated: false };
  }

  // 尝试多种 atlas 键格式：
  // 1. 原始值（可能是 sheet.id）
  // 2. 去掉路径和 .mote-sprite.json 后缀的文件名
  // 3. 遍历所有 sheets，按 name / id / jsonPath 匹配
  const possibleAtlasIds = [rawAtlas, extractSheetId(rawAtlas)];

  let image: HTMLImageElement | null = null;
  let sheet: ReturnType<typeof getSpriteSheet> = undefined;
  let frameData: FrameData | undefined;

  for (const atlasId of possibleAtlasIds) {
    if (!atlasId) continue;
    image = spriteSheetImages.value.get(atlasId) ?? null;
    sheet = getSpriteSheet(atlasId) ?? undefined;
    frameData = sheet?.frames[frameId];
    if (image && frameData) break;
  }

  // 回退 3：按 sheet.name / sheet.id 遍历匹配
  if (!frameData) {
    const extractedName = extractSheetId(rawAtlas);
    for (const s of spriteSheets.value) {
      if (s.id === rawAtlas || s.name === extractedName || s.name === rawAtlas) {
        sheet = s;
        frameData = s.frames[frameId];
        if (frameData) {
          image = spriteSheetImages.value.get(s.id) ?? null;
          break;
        }
      }
    }
  }

  if (!frameData) {
    console.warn('[resolveEntitySprite] frame not found:', {
      prefab: entity.prefab,
      rawAtlas,
      frameId,
      availableSheets: spriteSheets.value.map(s => ({ id: s.id, name: s.name })),
      availableImages: Array.from(spriteSheetImages.value.keys()),
    });
    return { image, frame: null, rotated: false };
  }

  return {
    image,
    frame: {
      x: frameData.x,
      y: frameData.y,
      w: frameData.w,
      h: frameData.h,
    },
    rotated: frameData.rotated ?? false,
  };
}

/**
 * 获取实体在视口中的显示尺寸
 * 
 * 优先使用精灵帧的原始尺寸，无法解析时回退到 fallbackSize
 */
export function getEntityDisplaySize(
  entity: SceneEntity,
  fallbackSize: number,
): { w: number; h: number } {
  const resolved = resolveEntitySprite(entity);
  if (resolved.frame) {
    return { w: resolved.frame.w, h: resolved.frame.h };
  }
  return { w: fallbackSize, h: fallbackSize };
}
