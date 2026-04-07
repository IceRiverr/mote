// ═══════════════════════════════════════════════════════════════
// SpriteEditorToolbar.tsx — Blender-style left toolbar
// Shows tools for the CURRENT mode only (mode switch is in header)
// ═══════════════════════════════════════════════════════════════

import {
  editorMode,
  colliderTool,
  selectedFrameIds,
  setFrameCollider,
  MODE_NAMES,
  TOOL_NAMES,
  ColliderTool,
  activeSpriteSheet,
  toolbarVisible,
} from './state';
import { COLLIDER_PRESETS } from '../../data/Collider';

// ── Tool Button Component ─────────────────────────────────────

interface ToolButtonProps {
  tool: ColliderTool;
  active: boolean;
  onClick: () => void;
  disabled?: boolean;
}

function ToolButton({ tool, active, onClick, disabled }: ToolButtonProps) {
  const info = TOOL_NAMES[tool];
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={`${info.name} - ${info.desc}`}
      style={{
        width: 32,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: active ? 'var(--accent)' : 'transparent',
        border: 'none',
        borderRadius: 4,
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: active ? '#fff' : disabled ? 'var(--text-secondary)' : 'var(--text-secondary)',
        fontSize: 14,
        opacity: disabled ? 0.4 : 1,
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={(e) => {
        if (!active && !disabled) {
          (e.currentTarget as HTMLElement).style.background = 'var(--bg-input)';
          (e.currentTarget as HTMLElement).style.color = 'var(--text-bright)';
        }
      }}
      onMouseLeave={(e) => {
        if (!active && !disabled) {
          (e.currentTarget as HTMLElement).style.background = 'transparent';
          (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
        }
      }}
    >
      {info.icon}
    </button>
  );
}

// ── Current Mode Display ──────────────────────────────────────

function CurrentModeDisplay() {
  const mode = editorMode.value;
  const modeColor = mode === 'select' ? 'var(--accent)' :
                    mode === 'collider' ? '#e06060' :
                    '#60c060';
  
  return (
    <div
      style={{
        padding: '6px 4px',
        marginBottom: 12,
        borderBottom: `2px solid ${modeColor}`,
        fontSize: 10,
        fontWeight: 'bold',
        color: modeColor,
        textAlign: 'center',
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}
    >
      {MODE_NAMES[mode]}
    </div>
  );
}

// ── Apply to Selection Button ─────────────────────────────────

function ApplyToSelectionButton() {
  const selected = selectedFrameIds.value;
  const sheet = activeSpriteSheet.value;
  const tool = colliderTool.value;
  
  if (selected.length === 0 || !sheet) return null;
  
  const handleApply = () => {
    let shapes;
    switch (tool) {
      case 'full': shapes = COLLIDER_PRESETS.full; break;
      case 'halfTop': shapes = COLLIDER_PRESETS.halfTop; break;
      case 'halfBottom': shapes = COLLIDER_PRESETS.halfBottom; break;
      case 'slopeNE': shapes = COLLIDER_PRESETS.slopeNE; break;
      case 'slopeNW': shapes = COLLIDER_PRESETS.slopeNW; break;
      case 'slopeSE': shapes = COLLIDER_PRESETS.slopeSE; break;
      case 'slopeSW': shapes = COLLIDER_PRESETS.slopeSW; break;
      case 'eraser': shapes = undefined; break;
      default: return;
    }
    
    selected.forEach(frameId => {
      setFrameCollider(sheet.id, frameId, shapes);
    });
  };
  
  const isEraser = tool === 'eraser';
  
  return (
    <button
      onClick={handleApply}
      style={{
        marginTop: 8,
        padding: '6px 8px',
        background: isEraser ? 'rgba(220, 60, 60, 0.2)' : 'var(--accent)',
        border: `1px solid ${isEraser ? 'rgba(220, 60, 60, 0.5)' : 'var(--accent)'}`,
        borderRadius: 4,
        cursor: 'pointer',
        color: isEraser ? '#e06060' : '#fff',
        fontSize: 10,
        fontWeight: 'bold',
        width: '100%',
      }}
    >
      {isEraser ? '删除' : '应用'} ({selected.length})
    </button>
  );
}

// ── Collider Tools Section ────────────────────────────────────

function ColliderTools() {
  const presetTools: ColliderTool[] = ['full', 'halfTop', 'halfBottom', 'slopeNE', 'slopeNW', 'slopeSE', 'slopeSW'];
  const drawTools: ColliderTool[] = ['rect', 'circle', 'polygon', 'eraser'];
  
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Presets */}
      <div>
        <div
          style={{
            fontSize: 9,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            marginBottom: 6,
            letterSpacing: 0.5,
          }}
        >
          预设
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {presetTools.map((tool) => (
            <ToolButton
              key={tool}
              tool={tool}
              active={colliderTool.value === tool}
              onClick={() => {
                colliderTool.value = tool;
              }}
            />
          ))}
        </div>
      </div>
      
      {/* Draw Tools */}
      <div>
        <div
          style={{
            fontSize: 9,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            marginBottom: 6,
            letterSpacing: 0.5,
          }}
        >
          绘制 (即将推出)
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
          {drawTools.map((tool) => (
            <ToolButton
              key={tool}
              tool={tool}
              active={colliderTool.value === tool}
              disabled={true}
              onClick={() => {
                // TODO: Enable when draw mode is implemented
              }}
            />
          ))}
        </div>
      </div>
      
      <ApplyToSelectionButton />
    </div>
  );
}

// ── Select Mode Tools ─────────────────────────────────────────

function SelectTools() {
  // Select mode doesn't need specific tools - just select in canvas
  // The help text is shown in the status bar and header tooltip
  return (
    <div style={{ fontSize: 10, color: 'var(--text-secondary)', padding: '4px', textAlign: 'center' }}>
      <div style={{ opacity: 0.6, fontStyle: 'italic' }}>
        在画布中
        <br />
        点击选择
      </div>
    </div>
  );
}

// ── Tag Mode Tools ────────────────────────────────────────────

function TagTools() {
  return (
    <div style={{ fontSize: 11, color: 'var(--text-secondary)', padding: '4px' }}>
      <div style={{ marginBottom: 8, fontWeight: 'bold' }}>标签编辑</div>
      <div style={{ fontSize: 10, lineHeight: 1.6 }}>
        <div>选择帧后在右侧面板编辑标签</div>
      </div>
    </div>
  );
}

// ── Main Toolbar Component ────────────────────────────────────
// Note: Empty state is handled in SpriteEditor.tsx
// This component is only rendered when there IS content

export function SpriteEditorToolbar() {
  const mode = editorMode.value;
  
  return (
    <div
      style={{
        width: 48,
        minWidth: 48,
        background: 'var(--bg-sidebar)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        padding: '8px 4px',
        overflowY: 'auto',
      }}
    >
      {/* Current Mode Display (read-only, mode switch is in header) */}
      <CurrentModeDisplay />
      
      {/* Mode-specific tools */}
      {mode === 'select' && <SelectTools />}
      {mode === 'collider' && <ColliderTools />}
      {mode === 'tag' && <TagTools />}
      

    </div>
  );
}
