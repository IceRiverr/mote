// ═══════════════════════════════════════════════════════════════
// FrameContextMenu.tsx — Unified right-click context menu
// for sprite frames with collider presets, tags, and properties.
// ═══════════════════════════════════════════════════════════════

import { useEffect, useRef, useState } from 'preact/hooks';
import type { ColliderShape } from '../../data/Collider';
import { COLLIDER_PRESETS } from '../../data/Collider';
import type { ColliderData } from '../../data/Collider';
import { spriteSheets, activeSpriteSheet } from './state';
import type { SpriteSheet, FrameData } from '../../data/SpriteSheet';

// ── Types ─────────────────────────────────────────────────────

interface Props {
  x: number;
  y: number;
  frameId: string;
  sheetId: string;
  onClose: () => void;
}

/**
 * Extended frame data stored alongside FrameData.
 * This mirrors the structure that will be in the unified SpriteSheet store.
 * For now, we store it in a side-map on the sheet object via a type assertion.
 */
interface FrameExtraData {
  collider?: ColliderData;
  tags?: string[];
  properties?: Record<string, unknown>;
}

// ── Frame data helpers ────────────────────────────────────────

/**
 * Get extra data for a frame. We store this in a `frameExtra` map
 * on the SpriteSheet object, cast as needed.
 */
function getFrameExtra(sheet: SpriteSheet, frameId: string): FrameExtraData {
  const extra = (sheet as any).frameExtra as Record<string, FrameExtraData> | undefined;
  return extra?.[frameId] ?? {};
}

function setFrameExtra(sheetId: string, frameId: string, data: FrameExtraData): void {
  spriteSheets.value = spriteSheets.value.map((sheet) => {
    if (sheet.id !== sheetId) return sheet;
    const prev = ((sheet as any).frameExtra ?? {}) as Record<string, FrameExtraData>;
    const updated = { ...prev, [frameId]: { ...prev[frameId], ...data } };
    return { ...sheet, frameExtra: updated } as any;
  });
}

function updateFrameCollider(
  sheetId: string,
  frameId: string,
  collider: ColliderData | undefined,
): void {
  spriteSheets.value = spriteSheets.value.map((sheet) => {
    if (sheet.id !== sheetId) return sheet;
    const prev = ((sheet as any).frameExtra ?? {}) as Record<string, FrameExtraData>;
    const oldData = prev[frameId] ?? {};
    let newData: FrameExtraData;
    if (collider) {
      newData = { ...oldData, collider };
    } else {
      const { collider: _, ...rest } = oldData;
      newData = rest;
    }
    const updated = { ...prev, [frameId]: newData };
    return { ...sheet, frameExtra: updated } as any;
  });
}

function updateFrameTags(sheetId: string, frameId: string, tags: string[]): void {
  setFrameExtra(sheetId, frameId, { tags: tags.length > 0 ? tags : undefined });
}

// ── Menu item style helpers ───────────────────────────────────

const menuItemBase: Record<string, string | number> = {
  padding: '6px 10px',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  fontSize: '11px',
  color: 'var(--text-primary)',
  background: 'transparent',
  border: 'none',
  width: '100%',
  textAlign: 'left',
};

// ── Component ─────────────────────────────────────────────────

export function FrameContextMenu({ x, y, frameId, sheetId, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [editingTags, setEditingTags] = useState(false);

  const sheet = spriteSheets.value.find((s) => s.id === sheetId);
  if (!sheet) return null;

  const frame = sheet.frames[frameId];
  if (!frame) return null;

  const extra = getFrameExtra(sheet, frameId);
  const collider = extra.collider;
  const tags = extra.tags ?? [];
  const properties = extra.properties ?? {};
  const hasCollider = collider && collider.shapes.length > 0;
  const isOneWay = collider?.oneWay ?? false;

  // Determine frame grid position (for grid-sourced sheets)
  const frameKeys = Object.keys(sheet.frames);
  const frameIndex = frameKeys.indexOf(frameId);
  const gridCols = sheet.slicing.mode === 'grid'
    ? Math.floor(sheet.imageWidth / (frame.w || 1))
    : 0;
  const gridRow = gridCols > 0 ? Math.floor(frameIndex / gridCols) : -1;
  const gridCol = gridCols > 0 ? frameIndex % gridCols : -1;

  // ── Click outside to close ──
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      window.addEventListener('pointerdown', handler);
    }, 50);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointerdown', handler);
    };
  }, []);

  // ── Escape to close ──
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // ── Collider actions ──
  const setColliderPreset = (shapes: ColliderShape[]) => {
    updateFrameCollider(sheetId, frameId, { shapes, oneWay: isOneWay });
  };

  const clearCollider = () => {
    updateFrameCollider(sheetId, frameId, undefined);
  };

  const toggleOneWay = () => {
    if (collider) {
      updateFrameCollider(sheetId, frameId, { ...collider, oneWay: !isOneWay });
    } else {
      // Enable one-way with a full collider
      updateFrameCollider(sheetId, frameId, {
        shapes: [{ type: 'full' }],
        oneWay: true,
      });
    }
  };

  // ── Tag editing ──
  const [tagInput, setTagInput] = useState(tags.join(', '));

  const commitTags = () => {
    const newTags = tagInput
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    updateFrameTags(sheetId, frameId, newTags);
    setEditingTags(false);
  };

  // ── Check if a preset is the current collider ──
  const isPresetActive = (presetShapes: ColliderShape[]): boolean => {
    if (!collider || collider.shapes.length !== presetShapes.length) return false;
    return JSON.stringify(collider.shapes) === JSON.stringify(presetShapes);
  };

  // ── Position clamping ──
  // Prevent menu from going off-screen
  const menuStyle: Record<string, any> = {
    position: 'absolute',
    left: Math.min(x, 200),
    top: y,
    minWidth: 190,
    maxHeight: 400,
    overflowY: 'auto',
    background: '#2a2a2a',
    border: '1px solid var(--border)',
    borderRadius: 5,
    boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
    zIndex: 300,
    fontSize: 11,
  };

  return (
    <div ref={ref} style={menuStyle}>
      {/* ── Header ── */}
      <div
        style={{
          padding: '5px 10px',
          borderBottom: '1px solid var(--border)',
          color: 'var(--text-secondary)',
          fontSize: 10,
          fontFamily: 'monospace',
        }}
      >
        帧 "{frameId}"
        {gridCol >= 0 ? ` (${gridCol},${gridRow})` : ` #${frameIndex}`}
      </div>

      {/* ── Collider section ── */}
      <div
        style={{
          padding: '4px 10px 2px',
          color: 'var(--text-secondary)',
          fontSize: 10,
          fontWeight: 'bold',
        }}
      >
        碰撞体
      </div>

      {/* Full Tile */}
      <MenuItem
        icon={isPresetActive(COLLIDER_PRESETS.full) ? '\u25A0' : '\u25A1'}
        label="Full Tile"
        active={isPresetActive(COLLIDER_PRESETS.full)}
        onClick={() => setColliderPreset(COLLIDER_PRESETS.full)}
      />

      {/* Half Top */}
      <MenuItem
        icon={isPresetActive(COLLIDER_PRESETS.halfTop) ? '\u25AC' : '\u25AD'}
        label="Half Top"
        active={isPresetActive(COLLIDER_PRESETS.halfTop)}
        onClick={() => setColliderPreset(COLLIDER_PRESETS.halfTop)}
      />

      {/* Half Bottom */}
      <MenuItem
        icon={isPresetActive(COLLIDER_PRESETS.halfBottom) ? '\u25AC' : '\u25AD'}
        label="Half Bottom"
        active={isPresetActive(COLLIDER_PRESETS.halfBottom)}
        onClick={() => setColliderPreset(COLLIDER_PRESETS.halfBottom)}
      />

      {/* Slope NE */}
      <MenuItem
        icon="\u2571"
        label="Slope NE"
        active={isPresetActive(COLLIDER_PRESETS.slopeNE)}
        onClick={() => setColliderPreset(COLLIDER_PRESETS.slopeNE)}
      />

      {/* Slope NW */}
      <MenuItem
        icon="\u2572"
        label="Slope NW"
        active={isPresetActive(COLLIDER_PRESETS.slopeNW)}
        onClick={() => setColliderPreset(COLLIDER_PRESETS.slopeNW)}
      />

      {/* Slope SE */}
      <MenuItem
        icon="\u2571"
        label="Slope SE"
        active={isPresetActive(COLLIDER_PRESETS.slopeSE)}
        onClick={() => setColliderPreset(COLLIDER_PRESETS.slopeSE)}
      />

      {/* Slope SW */}
      <MenuItem
        icon="\u2572"
        label="Slope SW"
        active={isPresetActive(COLLIDER_PRESETS.slopeSW)}
        onClick={() => setColliderPreset(COLLIDER_PRESETS.slopeSW)}
      />

      {/* Custom Rect (stub) */}
      <MenuItem
        icon="\u2B21"
        label="Custom Rect..."
        disabled
        onClick={() => {}}
      />

      {/* Clear */}
      <MenuItem
        icon="\u2715"
        label="Clear"
        danger={hasCollider}
        disabled={!hasCollider}
        onClick={clearCollider}
      />

      {/* ── Separator ── */}
      <div style={{ borderTop: '1px solid var(--border)', margin: '2px 0' }} />

      {/* ── One-Way Platform ── */}
      <MenuItem
        icon={isOneWay ? '\u2611' : '\u2610'}
        label="One-Way Platform"
        active={isOneWay}
        onClick={toggleOneWay}
      />

      {/* ── Separator ── */}
      <div style={{ borderTop: '1px solid var(--border)', margin: '2px 0' }} />

      {/* ── Tags ── */}
      <div style={{ padding: '6px 10px' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: 10, marginBottom: 4 }}>
          标签
        </div>
        {editingTags ? (
          <div style={{ display: 'flex', gap: 3 }}>
            <input
              type="text"
              value={tagInput}
              onInput={(e) => setTagInput((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitTags();
                if (e.key === 'Escape') setEditingTags(false);
              }}
              style={{
                flex: 1,
                fontSize: 10,
                height: 20,
                background: 'var(--bg-input)',
                color: 'var(--text-bright)',
                border: '1px solid var(--border)',
                borderRadius: 2,
                padding: '0 4px',
                outline: 'none',
              }}
              autoFocus
            />
            <button
              onClick={commitTags}
              style={{
                fontSize: 10,
                height: 20,
                padding: '0 6px',
                background: 'var(--accent)',
                color: '#fff',
                border: 'none',
                borderRadius: 2,
                cursor: 'pointer',
              }}
            >
              {'\u2713'}
            </button>
          </div>
        ) : (
          <div
            onClick={() => {
              setTagInput(tags.join(', '));
              setEditingTags(true);
            }}
            style={{
              cursor: 'pointer',
              minHeight: 18,
              padding: '2px 4px',
              borderRadius: 3,
              border: '1px solid var(--border)',
              fontSize: 10,
              color: tags.length > 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
            }}
          >
            {tags.length > 0 ? tags.join(', ') : '点击添加标签\u2026'}
          </div>
        )}
      </div>

      {/* ── Properties ── */}
      {Object.keys(properties).length > 0 && (
        <div
          style={{
            padding: '6px 10px',
            borderTop: '1px solid var(--border)',
            fontSize: 10,
            color: 'var(--text-secondary)',
          }}
        >
          属性: {Object.keys(properties).length} 项
        </div>
      )}
    </div>
  );
}

// ── MenuItem sub-component ────────────────────────────────────

interface MenuItemProps {
  icon: string;
  label: string;
  active?: boolean;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function MenuItem({ icon, label, active, danger, disabled, onClick }: MenuItemProps) {
  return (
    <div
      onClick={disabled ? undefined : onClick}
      style={{
        padding: '5px 10px 5px 16px',
        cursor: disabled ? 'default' : 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        color: disabled
          ? 'var(--text-secondary)'
          : danger
            ? 'var(--danger)'
            : active
              ? 'var(--accent)'
              : 'var(--text-primary)',
        opacity: disabled ? 0.5 : 1,
        background: 'transparent',
      }}
      onMouseEnter={(e) => {
        if (!disabled) (e.currentTarget as HTMLElement).style.background = 'var(--bg-input)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'transparent';
      }}
    >
      <span style={{ width: 14, textAlign: 'center', fontSize: 12 }}>{icon}</span>
      <span>{label}</span>
      {active && !disabled && (
        <span style={{ marginLeft: 'auto', fontSize: 9, opacity: 0.6 }}>{'\u2713'}</span>
      )}
    </div>
  );
}
