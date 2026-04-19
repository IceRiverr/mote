// ═══════════════════════════════════════════════════════════════
// spriteSheet.ts — SpriteSheet store (replaces atlas.ts)
// Manages loaded sprite sheets, frame selection, and CRUD ops
// ═══════════════════════════════════════════════════════════════

import { signal, computed } from '@preact/signals';
import type { SpriteSheet, FrameData } from '../data/SpriteSheet';
import type { ColliderShape } from '../data/Collider';

/** All loaded sprite sheets */
export const spriteSheets = signal<SpriteSheet[]>([]);

/** SpriteSheet image cache: sheet.id -> HTMLImageElement */
export const spriteSheetImages = signal<Map<string, HTMLImageElement>>(new Map());

/** Currently active sprite sheet ID */
export const activeSpriteSheetId = signal<string | null>(null);

/** Currently selected frame ID(s) */
export const selectedFrameIds = signal<string[]>([]);

/** Whether the active sprite sheet is a temporary import (from image file, not .mote-sprite.json) */
export const isTemporarySpriteSheet = signal(false);

/** Get the active sprite sheet */
export const activeSpriteSheet = computed((): SpriteSheet | null => {
  const id = activeSpriteSheetId.value;
  if (!id) return null;
  return spriteSheets.value.find(s => s.id === id) ?? null;
});

// ── CRUD operations ───────────────────────────────────────────

export function addSpriteSheet(sheet: SpriteSheet, img: HTMLImageElement): void {
  // 去重：替换已有相同 id 的 sheet，避免重复 key
  const filtered = spriteSheets.value.filter(s => s.id !== sheet.id);
  spriteSheets.value = [...filtered, sheet];
  const newImages = new Map(spriteSheetImages.value);
  newImages.set(sheet.id, img);
  spriteSheetImages.value = newImages;
  // Note: 不自动设为 active，由调用方决定是否激活显示
}

export function removeSpriteSheet(id: string): void {
  spriteSheets.value = spriteSheets.value.filter(s => s.id !== id);
  const newImages = new Map(spriteSheetImages.value);
  newImages.delete(id);
  spriteSheetImages.value = newImages;
  if (activeSpriteSheetId.value === id) {
    activeSpriteSheetId.value = spriteSheets.value[0]?.id ?? null;
  }
}

export function updateSpriteSheet(id: string, updater: (sheet: SpriteSheet) => SpriteSheet): void {
  spriteSheets.value = spriteSheets.value.map(s => s.id === id ? updater(s) : s);
}

/** Update a single frame's data */
export function updateFrame(sheetId: string, frameId: string, patch: Partial<FrameData>): void {
  updateSpriteSheet(sheetId, sheet => ({
    ...sheet,
    frames: {
      ...sheet.frames,
      [frameId]: { ...sheet.frames[frameId], ...patch },
    },
  }));
}

/** Set collider on a frame */
export function setFrameCollider(sheetId: string, frameId: string, collider: ColliderShape[] | undefined): void {
  console.log('[setFrameCollider]', sheetId, frameId, collider);
  updateSpriteSheet(sheetId, sheet => {
    const frame = sheet.frames[frameId];
    if (!frame) {
      console.log('[setFrameCollider] frame not found:', frameId);
      return sheet;
    }
    const newFrame = { ...frame };
    if (collider) {
      newFrame.collider = collider;
    } else {
      delete newFrame.collider;
    }
    console.log('[setFrameCollider] updated frame:', newFrame);
    return { ...sheet, frames: { ...sheet.frames, [frameId]: newFrame } };
  });
}

/** Set tags on a frame */
export function setFrameTags(sheetId: string, frameId: string, tags: string[]): void {
  updateFrame(sheetId, frameId, { tags: tags.length > 0 ? tags : undefined });
}

/** Find SpriteSheet by id */
export function getSpriteSheet(id: string): SpriteSheet | undefined {
  return spriteSheets.value.find(s => s.id === id);
}

/** Look up a frame across all sheets by "sheetId:frameId" reference */
export function resolveFrameRef(ref: string): { sheet: SpriteSheet; frame: FrameData; frameId: string } | null {
  const [sheetId, frameId] = ref.split(':');
  const sheet = spriteSheets.value.find(s => s.id === sheetId);
  if (!sheet || !frameId) return null;
  const frame = sheet.frames[frameId];
  if (!frame) return null;
  return { sheet, frame, frameId };
}
