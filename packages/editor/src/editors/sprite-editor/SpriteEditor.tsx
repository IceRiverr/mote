// ═══════════════════════════════════════════════════════════════
// SpriteEditor.tsx — Blender-style sprite editor
// Layout: [Toolbar | Canvas | Properties] — only visible when content exists
// Modes: Select / Collider / Tag
// ═══════════════════════════════════════════════════════════════

import { useEffect } from 'preact/hooks';
import { registerEditor } from '../registry';
import { SpriteEditorHeader } from './SpriteEditorHeader';
import { SpriteEditorCanvas } from './SpriteEditorCanvas';
import { SpriteEditorToolbar } from './SpriteEditorToolbar';
import { SpriteEditorProperties, PropertiesToggleButton } from './SpriteEditorProperties';
import {
  activeSpriteSheet,
  editorMode,
  showColliderOverlay,
  toolbarVisible,
  propertiesPanelVisible,
} from './state';
import { isTemporarySpriteSheet } from '../../store/spriteSheet';

// ═══════════════════════════════════════════════════════════════
// Empty State — When no sprite sheet is loaded
// ═══════════════════════════════════════════════════════════════

function EmptyStateCanvas() {
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-canvas)',
        color: 'var(--text-secondary)',
        fontSize: 14,
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div style={{ marginBottom: 12, fontSize: 48, opacity: 0.3 }}>🎨</div>
        <div>点击右上角「导入」添加精灵图集</div>
        <div style={{ marginTop: 8, fontSize: 11, opacity: 0.6 }}>
          支持 PNG, JSON, XML 格式
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Keyboard Shortcuts Handler
// ═══════════════════════════════════════════════════════════════

function useKeyboardShortcuts() {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ignore if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      switch (e.key) {
        case '1':
          editorMode.value = 'select';
          showColliderOverlay.value = false;
          break;
        case '2':
          editorMode.value = 'collider';
          showColliderOverlay.value = true;
          break;
        case 't':
        case 'T':
          toolbarVisible.value = !toolbarVisible.value;
          break;
        case 'n':
        case 'N':
          propertiesPanelVisible.value = !propertiesPanelVisible.value;
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
}

// ═══════════════════════════════════════════════════════════════
// Main Editor — Blender-style layout
// ═══════════════════════════════════════════════════════════════

function SpriteEditor({ areaId }: { areaId: string }) {
  useKeyboardShortcuts();

  const sheet = activeSpriteSheet.value;
  const hasContent = !!sheet;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        position: 'relative',
      }}
    >
      {/* Temporary Import Banner */}
      {hasContent && isTemporarySpriteSheet.value && (
        <div
          style={{
            flexShrink: 0,
            padding: '6px 12px',
            background: 'rgba(244, 167, 66, 0.15)',
            borderBottom: '1px solid rgba(244, 167, 66, 0.3)',
            color: '#f4a742',
            fontSize: 11,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <span>
            📝 临时导入模式（16×16 grid）— 调整参数后可保存为 .mote-sprite.json
          </span>
          <button
            onClick={() => {
              // TODO: 导出为 .mote-sprite.json
              alert('TODO: 导出为 .mote-sprite.json');
            }}
            style={{
              background: 'rgba(244, 167, 66, 0.2)',
              color: '#f4a742',
              border: '1px solid rgba(244, 167, 66, 0.4)',
              borderRadius: 3,
              padding: '2px 8px',
              fontSize: 10,
              cursor: 'pointer',
            }}
          >
            导出 JSON
          </button>
        </div>
      )}

      {/* Main Content Area */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {hasContent ? (
          <>
            {/* Center: Canvas (Viewport) + Floating T-Panel */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              <SpriteEditorCanvas />
              {toolbarVisible.value && <SpriteEditorToolbar />}
              {!toolbarVisible.value && <ToolbarToggleButton />}
              {!propertiesPanelVisible.value && <PropertiesToggleButton />}
            </div>

            {/* Right: Properties (N-Panel) */}
            {propertiesPanelVisible.value && <SpriteEditorProperties />}
          </>
        ) : (
          // Empty state — only show canvas with prompt
          <EmptyStateCanvas />
        )}
      </div>

    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Toggle Buttons (shown when panels are hidden)
// ═══════════════════════════════════════════════════════════════

function ToolbarToggleButton() {
  return (
    <button
      onClick={() => {
        toolbarVisible.value = true;
      }}
      title="显示工具栏 (T)"
      style={{
        position: 'absolute',
        left: 8,
        top: 8,
        width: 28,
        height: 28,
        background: 'var(--bg-sidebar)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        cursor: 'pointer',
        color: 'var(--text-secondary)',
        fontSize: 12,
        zIndex: 10,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      T
    </button>
  );
}

// Re-export from properties panel for use in empty state
export { PropertiesToggleButton };

// ═══════════════════════════════════════════════════════════════
// Register
// ═══════════════════════════════════════════════════════════════

registerEditor({
  id: 'sprite-editor',
  name: '精灵编辑器',
  icon: '🎨',
  component: SpriteEditor,
  header: SpriteEditorHeader,
});

export { SpriteEditor };
