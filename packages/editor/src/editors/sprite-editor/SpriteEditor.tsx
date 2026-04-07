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
  selectedFrameIds,
  activeFrame,
  editorMode,
  toggleEditorMode,
  toolbarVisible,
  propertiesPanelVisible,
  currentModeHelp,
  statusBarMessage,
  MODE_NAMES,
} from './state';

// ═══════════════════════════════════════════════════════════════
// Status Bar — Blender style bottom bar with context help
// ═══════════════════════════════════════════════════════════════

function SpriteEditorFooter() {
  const sheet = activeSpriteSheet.value;
  const selected = selectedFrameIds.value;
  const frame = activeFrame.value;
  const mode = editorMode.value;
  const help = currentModeHelp.value;
  const status = statusBarMessage.value;

  return (
    <div
      style={{
        height: 24,
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-header)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        fontSize: 11,
        color: 'var(--text-secondary)',
        flexShrink: 0,
        gap: 16,
      }}
    >
      {/* Mode indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '2px 8px',
          background: mode === 'select' ? 'rgba(74, 144, 217, 0.15)' :
                     mode === 'collider' ? 'rgba(220, 60, 60, 0.15)' :
                     'rgba(100, 200, 100, 0.15)',
          borderRadius: 3,
          color: mode === 'select' ? 'var(--accent)' :
                 mode === 'collider' ? '#e06060' :
                 '#60c060',
          fontWeight: 'bold',
        }}
      >
        {MODE_NAMES[mode]}
      </div>

      {/* Selection info */}
      {selected.length > 1 ? (
        <span>
          已选: <span style={{ color: 'var(--text-bright)' }}>{selected.length} 帧</span>
        </span>
      ) : frame ? (
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--text-bright)' }}>{frame.id}</span>
          <span style={{ fontFamily: 'monospace', opacity: 0.7 }}>
            {frame.frame.w}×{frame.frame.h}
          </span>
        </span>
      ) : sheet ? (
        <span>{Object.keys(sheet.frames).length} 帧</span>
      ) : (
        <span>—</span>
      )}

      {/* Status message */}
      {status && status !== '就绪' && (
        <span style={{ color: 'var(--text-bright)' }}>{status}</span>
      )}

      {/* Help text - right aligned */}
      <div style={{ flex: 1 }} />
      <span style={{ opacity: 0.6, fontSize: 10 }}>{help}</span>
    </div>
  );
}

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
        case 'Tab':
          e.preventDefault();
          toggleEditorMode();
          break;
        case '1':
          editorMode.value = 'select';
          statusBarMessage.value = '已切换到: 选择模式';
          break;
        case '2':
          editorMode.value = 'collider';
          statusBarMessage.value = '已切换到: 碰撞编辑';
          break;
        case '3':
          editorMode.value = 'tag';
          statusBarMessage.value = '已切换到: 标签编辑';
          break;
        case 't':
        case 'T':
          toolbarVisible.value = !toolbarVisible.value;
          statusBarMessage.value = toolbarVisible.value ? '显示工具栏 (T)' : '隐藏工具栏 (T)';
          break;
        case 'n':
        case 'N':
          propertiesPanelVisible.value = !propertiesPanelVisible.value;
          statusBarMessage.value = propertiesPanelVisible.value ? '显示属性面板 (N)' : '隐藏属性面板 (N)';
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
      {/* Top Header */}
      <SpriteEditorHeader />

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
          // Blender-style 3-column layout with content
          <>
            {/* Left: Toolbar (T-Panel) — visible based on toolbarVisible signal */}
            {toolbarVisible.value && <SpriteEditorToolbar />}

            {/* Center: Canvas (Viewport) */}
            <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>
              <SpriteEditorCanvas />
              
              {/* Toggle buttons when panels are hidden */}
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

      {/* Bottom: Status Bar */}
      <SpriteEditorFooter />
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
});

export { SpriteEditor };
