// ═══════════════════════════════════════════════════════════════
// SpriteEditorEditor.tsx — Main component for the unified
// Sprite Editor, combining tile-palette and sprite-panel
// functionality into a single editor.
// ═══════════════════════════════════════════════════════════════

import { registerEditor } from '../registry';
import { SpriteEditorHeader } from './SpriteEditorHeader';
import { SpriteEditorCanvas } from './SpriteEditorCanvas';
import {
  activeSpriteSheet,
  selectedFrameIds,
  activeFrame,
  colliderEditMode,
  spriteEditorMode,
} from './state';

// ── Footer ────────────────────────────────────────────────────

function SpriteEditorFooter() {
  const sheet = activeSpriteSheet.value;
  const selected = selectedFrameIds.value;
  const frame = activeFrame.value;
  const colliderOn = colliderEditMode.value;
  const mode = spriteEditorMode.value;

  return (
    <div
      style={{
        height: 22,
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-header)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 8px',
        fontSize: 10,
        color: 'var(--text-secondary)',
        flexShrink: 0,
        gap: 12,
      }}
    >
      {/* Selection info */}
      {selected.length > 1 ? (
        <span>
          {'\u5DF2\u9009'}: <span style={{ color: 'var(--text-bright)' }}>{selected.length} \u5E27</span>
        </span>
      ) : frame ? (
        <span>
          {'\u5DF2\u9009'}: <span style={{ color: 'var(--text-bright)' }}>{frame.id}</span>
          <span style={{ marginLeft: 6, fontFamily: 'monospace' }}>
            {frame.frame.w}{'\u00D7'}{frame.frame.h}
          </span>
        </span>
      ) : (
        <span>{'\u2014'}</span>
      )}

      {/* Sheet frame count */}
      {sheet && (
        <span style={{ fontFamily: 'monospace' }}>
          {Object.keys(sheet.frames).length} {'\u5E27'}
        </span>
      )}

      {/* Status indicators */}
      <div style={{ flex: 1 }} />

      {colliderOn && (
        <span style={{ color: '#e06060' }}>
          {'\u2B23'} {'\u78B0\u649E\u7F16\u8F91\u4E2D'}
        </span>
      )}

      <span style={{ opacity: 0.5 }}>
        {mode === 'grid' ? '\u7F51\u683C' : '\u5217\u8868'}
      </span>
    </div>
  );
}

// ── Main Editor ───────────────────────────────────────────────

function SpriteEditorEditor({ areaId }: { areaId: string }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        position: 'relative',
      }}
    >
      <SpriteEditorHeader />
      <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
        <SpriteEditorCanvas />
      </div>
      <SpriteEditorFooter />
    </div>
  );
}

// ── Register ──────────────────────────────────────────────────

registerEditor({
  id: 'sprite-editor',
  name: '\u7CBE\u7075\u7F16\u8F91\u5668',
  icon: '\uD83C\uDFA8',
  component: SpriteEditorEditor,
});

export { SpriteEditorEditor };
