// ═══════════════════════════════════════════════════════════════
// state.ts — Sprite Editor UI state signals
// ═══════════════════════════════════════════════════════════════

import { signal, computed } from '@preact/signals';
import type { SpriteSheet, FrameData } from '../../data/SpriteSheet';

// ── Re-export store signals ───────────────────────────────────
// Data-level signals live in the real store; we re-export them
// so existing imports from this module keep working.

export {
  spriteSheets,
  spriteSheetImages,
  activeSpriteSheetId,
  selectedFrameIds,
  activeSpriteSheet,
} from '../../store/spriteSheet';

// Import for local use in computed signals
import {
  spriteSheetImages,
  activeSpriteSheetId,
  activeSpriteSheet,
  selectedFrameIds,
} from '../../store/spriteSheet';

// ── UI-only State ─────────────────────────────────────────────

/** View mode: grid (tile-palette style) or list (sprite-panel style) */
export const spriteEditorMode = signal<'grid' | 'list'>('grid');

/** Whether collider editing overlay is active */
export const colliderEditMode = signal(false);

/** Display zoom level */
export const spriteEditorZoom = signal(2);

/** Search / filter text for frame names */
export const spriteFilterText = signal('');

/** Camera pan offset for the editor canvas */
export const editorCam = signal({ x: 0, y: 0 });

// ── Zoom helpers ──────────────────────────────────────────────

export const ZOOM_STEPS = [0.25, 0.5, 1, 1.5, 2, 3, 4, 6, 8];

export function stepZoom(dir: -1 | 1): void {
  const cur = spriteEditorZoom.value;
  const idx = ZOOM_STEPS.indexOf(cur);
  let nextIdx: number;
  if (idx === -1) {
    nextIdx = ZOOM_STEPS.findIndex((s) => s > cur);
    if (dir === -1) nextIdx = Math.max(0, nextIdx - 1);
    if (nextIdx === -1) nextIdx = ZOOM_STEPS.length - 1;
  } else {
    nextIdx = Math.max(0, Math.min(ZOOM_STEPS.length - 1, idx + dir));
  }
  spriteEditorZoom.value = ZOOM_STEPS[nextIdx];
}

export function formatZoom(z: number): string {
  if (z >= 1 && z === Math.floor(z)) return `${z}x`;
  return `${z}x`;
}

// ── Helpers ───────────────────────────────────────────────────

/** Convert a SpriteSheet's Record<string, FrameData> to a sorted array of entries. */
export function getAllFrameEntries(
  sheet: SpriteSheet,
): Array<{ id: string; frame: FrameData }> {
  return Object.entries(sheet.frames)
    .sort(([a], [b]) => a.localeCompare(b, undefined, { numeric: true }))
    .map(([id, frame]) => ({ id, frame }));
}

// ── Computed accessors ────────────────────────────────────────

/** The active sprite sheet's image */
export const activeSpriteSheetImage = computed((): HTMLImageElement | null => {
  const id = activeSpriteSheetId.value;
  if (!id) return null;
  return spriteSheetImages.value.get(id) ?? null;
});

/** Filtered frames based on search text */
export const filteredFrames = computed(
  (): Array<{ id: string; frame: FrameData }> => {
    const sheet = activeSpriteSheet.value;
    if (!sheet) return [];

    const entries = getAllFrameEntries(sheet);
    const q = spriteFilterText.value.toLowerCase().trim();
    if (!q) return entries;

    return entries.filter(
      ({ id, frame }) =>
        id.toLowerCase().includes(q) ||
        (frame.tags && frame.tags.some((t) => t.toLowerCase().includes(q))),
    );
  },
);

/** The first selected frame object (for single-select UI) */
export const activeFrame = computed(
  (): { id: string; frame: FrameData } | null => {
    const ids = selectedFrameIds.value;
    if (ids.length === 0) return null;
    const sheet = activeSpriteSheet.value;
    if (!sheet) return null;
    const frame = sheet.frames[ids[0]];
    if (!frame) return null;
    return { id: ids[0], frame };
  },
);
