// ═══════════════════════════════════════════════════════════════
// SpriteEditorToolbar.tsx — 浮空工具栏（T-Panel）
// Blender 风格：半透明毛玻璃面板悬浮在画布左上角
// ═══════════════════════════════════════════════════════════════

import {
  editorMode,
  colliderTool,
  selectedFrameIds,
  setFrameCollider,
  TOOL_NAMES,
  ColliderTool,
  activeSpriteSheet,
} from './state';
import { COLLIDER_PRESETS } from '../../data/Collider';

// ── Preset Tool Button ───────────────────────────────────────

function PresetButton({ tool }: { tool: ColliderTool }) {
  const info = TOOL_NAMES[tool];
  const active = colliderTool.value === tool;

  return (
    <button
      onClick={() => {
        colliderTool.value = tool;
      }}
      title={`${info.name} (${info.desc})`}
      style={{
        width: 30,
        height: 30,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        border: 'none',
        borderRadius: 4,
        background: active
          ? 'rgba(74, 127, 194, 0.85)'
          : 'transparent',
        color: active ? '#fff' : '#aaa',
        fontSize: 14,
        lineHeight: 1,
        cursor: 'pointer',
        transition: 'background 0.08s ease, color 0.08s ease',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        if (!active) {
          el.style.background = 'rgba(255,255,255,0.08)';
          el.style.color = '#ddd';
        }
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        if (!active) {
          el.style.background = 'transparent';
          el.style.color = '#aaa';
        }
      }}
    >
      {info.icon}
    </button>
  );
}

// ── Apply Button ─────────────────────────────────────────────

function ApplyButton() {
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

    selected.forEach((frameId) => {
      setFrameCollider(sheet.id, frameId, shapes);
    });
  };

  const isEraser = tool === 'eraser';

  return (
    <button
      onClick={handleApply}
      style={{
        marginTop: 4,
        padding: '4px 2px',
        background: isEraser ? 'rgba(220, 60, 60, 0.2)' : 'rgba(74, 127, 194, 0.35)',
        border: 'none',
        borderRadius: 4,
        cursor: 'pointer',
        color: isEraser ? '#e06060' : '#4a90d9',
        fontSize: 9,
        fontWeight: 'bold',
        width: '100%',
      }}
    >
      {isEraser ? '删除' : '应用'}
      <br />
      {selected.length}
    </button>
  );
}

// ── Collider Tools ───────────────────────────────────────────

function ColliderTools() {
  const presets: ColliderTool[] = [
    'full', 'halfTop', 'halfBottom',
    'slopeNE', 'slopeNW', 'slopeSE', 'slopeSW',
    'eraser',
  ];

  return (
    <>
      {presets.map((tool) => (
        <PresetButton key={tool} tool={tool} />
      ))}
      <ApplyButton />
    </>
  );
}

// ── Main Component — Floating T-Panel ────────────────────────

export function SpriteEditorToolbar() {
  const mode = editorMode.value;

  // Select / Tag 模式没有工具按钮，不显示 T-Panel
  if (mode !== 'collider') return null;

  return (
    <div
      style={{
        position: 'absolute',
        left: 8,
        top: 8,
        zIndex: 10,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '4px 2px',
        gap: 1,
        userSelect: 'none',
        background: 'rgba(35, 35, 35, 0.72)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderRadius: 6,
        boxShadow: '0 4px 12px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.05)',
      }}
    >
      <ColliderTools />
    </div>
  );
}
