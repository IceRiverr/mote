// ═══════════════════════════════════════════════════════════════
// state.ts — Sprite Editor UI state signals (Blender-style)
// ═══════════════════════════════════════════════════════════════

import { signal, computed } from '@preact/signals';
import type { SpriteSheet, FrameData } from '../../data/SpriteSheet';
import type { ColliderShape } from '../../data/Collider';

// ── Re-export store signals ───────────────────────────────────

export {
  spriteSheets,
  spriteSheetImages,
  activeSpriteSheetId,
  selectedFrameIds,
  activeSpriteSheet,
  setFrameCollider,
  setFrameTags,
} from '../../store/spriteSheet';

// Import for local use in computed signals
import {
  spriteSheetImages,
  activeSpriteSheetId,
  activeSpriteSheet,
  selectedFrameIds,
} from '../../store/spriteSheet';

// ═══════════════════════════════════════════════════════════════
// Blender-Style Editor Modes
// ═══════════════════════════════════════════════════════════════

/** Editor interaction mode - Blender style */
export type EditorMode = 'select' | 'collider' | 'tag';

export const editorMode = signal<EditorMode>('select');

/** Collider tool for collider mode */
export type ColliderTool = 'rect' | 'circle' | 'polygon' | 'eraser' | 'full' | 'halfTop' | 'halfBottom' | 'slopeNE' | 'slopeNW' | 'slopeSE' | 'slopeSW';

export const colliderTool = signal<ColliderTool>('full');

/** Whether to always show collider overlay (Blender viewport overlay style) */
export const showColliderOverlay = signal(true);

// ═══════════════════════════════════════════════════════════════
// Legacy compatibility (to be removed)
// ═══════════════════════════════════════════════════════════════

/** @deprecated Use editorMode === 'collider' instead */
export const colliderEditMode = computed(() => editorMode.value === 'collider');

// ═══════════════════════════════════════════════════════════════
// UI State
// ═══════════════════════════════════════════════════════════════

/** View mode: grid (tile-palette style) or list (sprite-panel style) */
export const spriteEditorMode = signal<'grid' | 'list'>('grid');

/** Display zoom level */
export const spriteEditorZoom = signal(2);

/** Search / filter text for frame names */
export const spriteFilterText = signal('');

/** Camera pan offset for the editor canvas */
export const editorCam = signal({ x: 0, y: 0 });

/** Whether the Properties panel (N-Panel) is visible */
export const propertiesPanelVisible = signal(true);

/** Whether the Toolbar (T-Panel) is visible */
export const toolbarVisible = signal(true);

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

// ═══════════════════════════════════════════════════════════════
// Mode & Tool Helpers (Blender-style)
// ═══════════════════════════════════════════════════════════════

export const MODE_NAMES: Record<EditorMode, string> = {
  select: '选择模式',
  collider: '碰撞编辑',
  tag: '标签编辑',
};

export const TOOL_NAMES: Record<ColliderTool, { name: string; icon: string; desc: string }> = {
  rect: { name: '矩形', icon: '▭', desc: '绘制矩形碰撞体 (R)' },
  circle: { name: '圆形', icon: '○', desc: '绘制圆形碰撞体 (C)' },
  polygon: { name: '多边形', icon: '⬡', desc: '绘制多边形碰撞体 (P)' },
  eraser: { name: '擦除', icon: '⌫', desc: '删除碰撞体 (X)' },
  full: { name: '完整', icon: '▪', desc: '完整矩形碰撞体 (1)' },
  halfTop: { name: '上半', icon: '▰', desc: '上半部分碰撞体 (2)' },
  halfBottom: { name: '下半', icon: '▰', desc: '下半部分碰撞体 (3)' },
  slopeNE: { name: '斜坡NE', icon: '◿', desc: '东北方向斜坡 (4)' },
  slopeNW: { name: '斜坡NW', icon: '◸', desc: '西北方向斜坡 (5)' },
  slopeSE: { name: '斜坡SE', icon: '◹', desc: '东南方向斜坡 (6)' },
  slopeSW: { name: '斜坡SW', icon: '◺', desc: '西南方向斜坡 (7)' },
};

/** Status bar message - Blender style hint system */
export const statusBarMessage = signal<string>('就绪');

/** Toggle editor mode (Tab key behavior) */
export function toggleEditorMode(): void {
  const modes: EditorMode[] = ['select', 'collider', 'tag'];
  const idx = modes.indexOf(editorMode.value);
  editorMode.value = modes[(idx + 1) % modes.length];
  statusBarMessage.value = `已切换到: ${MODE_NAMES[editorMode.value]}`;
}

/** Set editor mode directly */
export function setEditorMode(mode: EditorMode): void {
  editorMode.value = mode;
  statusBarMessage.value = `已切换到: ${MODE_NAMES[mode]}`;
}

/** Get help text for current mode */
export const currentModeHelp = computed(() => {
  switch (editorMode.value) {
    case 'select':
      return '左键: 选择 | Ctrl+左键: 多选 | Shift+左键: 范围 | 中键: 平移 | Tab: 切换模式';
    case 'collider':
      return `${TOOL_NAMES[colliderTool.value].desc} | 左键: 应用到帧 | 中键: 平移 | Tab: 切换模式 | N: 属性面板`;
    case 'tag':
      return '左键: 选择帧并编辑标签 | Tab: 切换模式';
    default:
      return '';
  }
});
