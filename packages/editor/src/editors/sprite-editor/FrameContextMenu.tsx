// ═══════════════════════════════════════════════════════════════
// FrameContextMenu.tsx — Simplified context menu
// Collider editing moved to toolbar/properties panel (Blender-style)
// This menu now only provides quick actions and navigation
// ═══════════════════════════════════════════════════════════════

import { useEffect, useRef } from 'preact/hooks';
import {
  activeSpriteSheet,
  selectedFrameIds,
  editorMode,
  setEditorMode,
} from './state';

// ── Types ─────────────────────────────────────────────────────

interface Props {
  x: number;
  y: number;
  frameId: string;
  sheetId: string;
  onClose: () => void;
}

// ── Component ─────────────────────────────────────────────────

export function FrameContextMenu({ x, y, frameId, sheetId, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const sheet = activeSpriteSheet.value;

  // Click outside to close
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

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  if (!sheet) return null;

  const frame = sheet.frames[frameId];
  if (!frame) return null;

  const frameKeys = Object.keys(sheet.frames);
  const frameIndex = frameKeys.indexOf(frameId);

  // Menu position clamping
  const menuStyle: Record<string, any> = {
    position: 'absolute',
    left: Math.min(x, 200),
    top: y,
    minWidth: 160,
    background: '#2a2a2a',
    border: '1px solid var(--border)',
    borderRadius: 5,
    boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
    zIndex: 300,
    fontSize: 11,
  };

  const MenuItem = ({ 
    icon, 
    label, 
    shortcut,
    onClick,
    active = false,
  }: { 
    icon: string; 
    label: string; 
    shortcut?: string;
    onClick: () => void;
    active?: boolean;
  }) => (
    <button
      onClick={() => {
        onClick();
        onClose();
      }}
      style={{
        padding: '6px 12px',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 11,
        color: active ? 'var(--accent)' : 'var(--text-primary)',
        background: 'transparent',
        border: 'none',
        width: '100%',
        textAlign: 'left',
        fontWeight: active ? 'bold' : 'normal',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'var(--bg-input)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'transparent';
      }}
    >
      <span style={{ width: 16, textAlign: 'center', fontSize: 12 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {shortcut && (
        <span style={{ fontSize: 9, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
          {shortcut}
        </span>
      )}
    </button>
  );

  return (
    <div ref={ref} style={menuStyle} onClick={(e) => e.stopPropagation()}>
      {/* Header */}
      <div
        style={{
          padding: '6px 12px',
          borderBottom: '1px solid var(--border)',
          color: 'var(--text-secondary)',
          fontSize: 10,
          fontFamily: 'monospace',
        }}
      >
        {frameId}
        <span style={{ marginLeft: 8, opacity: 0.6 }}>#{frameIndex}</span>
      </div>

      {/* Quick mode switch */}
      <MenuItem
        icon="↖"
        label="选择模式"
        shortcut="1"
        active={editorMode.value === 'select'}
        onClick={() => {
          setEditorMode('select');
          selectedFrameIds.value = [frameId];
        }}
      />
      
      <MenuItem
        icon="⬣"
        label="碰撞编辑"
        shortcut="2"
        active={editorMode.value === 'collider'}
        onClick={() => {
          setEditorMode('collider');
          selectedFrameIds.value = [frameId];
        }}
      />
      
      <MenuItem
        icon="🏷"
        label="标签编辑"
        shortcut="3"
        active={editorMode.value === 'tag'}
        onClick={() => {
          setEditorMode('tag');
          selectedFrameIds.value = [frameId];
        }}
      />

      {/* Divider */}
      <div style={{ borderTop: '1px solid var(--border)', margin: '4px 0' }} />

      {/* Frame info */}
      <div
        style={{
          padding: '8px 12px',
          fontSize: 10,
          color: 'var(--text-secondary)',
        }}
      >
        <div>位置: ({frame.x}, {frame.y})</div>
        <div>尺寸: {frame.w}×{frame.h}</div>
        {frame.collider && frame.collider.length > 0 && (
          <div style={{ color: '#e06060', marginTop: 4 }}>
            ⬣ 有碰撞体 ({frame.collider.length} 形状)
          </div>
        )}
        {frame.tags && frame.tags.length > 0 && (
          <div style={{ color: '#60c060', marginTop: 4 }}>
            🏷 {frame.tags.join(', ')}
          </div>
        )}
      </div>
    </div>
  );
}
