// ═══════════════════════════════════════════════════════════════
// SpriteEditorHeader.tsx — Blender-style top toolbar
// Includes sheet selector, mode selector, zoom controls, and import
// ═══════════════════════════════════════════════════════════════

import { useState } from 'preact/hooks';
import { ImportDialog } from './ImportDialog';
import {
  spriteSheets,
  activeSpriteSheetId,
  selectedFrameIds,
  activeSpriteSheet,
  spriteEditorMode,
  spriteEditorZoom,
  spriteFilterText,
  editorCam,
  stepZoom,
  formatZoom,
  editorMode,
  setEditorMode,
  showColliderOverlay,
  propertiesPanelVisible,
  MODE_NAMES,
  EditorMode,
} from './state';

// ═══════════════════════════════════════════════════════════════
// Mode Selector — Blender-style dropdown with tooltips
// ═══════════════════════════════════════════════════════════════

const MODE_TOOLTIPS: Record<EditorMode, string> = {
  select: '选择模式: 左键选择, Ctrl多选, Shift范围, 中键平移 (快捷键: 1)',
  collider: '碰撞编辑: 选择工具后点击帧应用碰撞体 (快捷键: 2)',
  tag: '标签编辑: 选择帧后在属性面板编辑标签 (快捷键: 3)',
};

function ModeSelector() {
  const currentMode = editorMode.value;
  const modes: EditorMode[] = ['select', 'collider', 'tag'];
  
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        background: 'var(--bg-input)',
        border: '1px solid var(--border)',
        borderRadius: 3,
        padding: '2px',
      }}
    >
      {modes.map((mode) => (
        <button
          key={mode}
          onClick={() => setEditorMode(mode)}
          title={MODE_TOOLTIPS[mode]}
          style={{
            padding: '3px 10px',
            fontSize: 11,
            fontWeight: currentMode === mode ? 'bold' : 'normal',
            background: currentMode === mode ? 'var(--accent)' : 'transparent',
            color: currentMode === mode ? '#fff' : 'var(--text-secondary)',
            border: 'none',
            borderRadius: 2,
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
        >
          {MODE_NAMES[mode]}
        </button>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Header Component
// ═══════════════════════════════════════════════════════════════

export function SpriteEditorHeader() {
  const [showImportDialog, setShowImportDialog] = useState(false);
  const sheet = activeSpriteSheet.value;
  const sheets = spriteSheets.value;
  const mode = spriteEditorMode.value;
  const zoom = spriteEditorZoom.value;
  const hasContent = !!sheet;

  return (
    <div
      style={{
        background: 'var(--bg-header)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {/* ── Row 1: Sheet selector + Mode selector + Actions ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '0 8px',
          height: 36,
        }}
      >
        {/* SpriteSheet selector */}
        <select
          value={activeSpriteSheetId.value ?? ''}
          onChange={(e) => {
            const v = (e.target as HTMLSelectElement).value;
            activeSpriteSheetId.value = v || null;
            selectedFrameIds.value = [];
            editorCam.value = { x: 0, y: 0 };
          }}
          style={{
            width: 180,
            minWidth: 0,
            height: 24,
            fontSize: 11,
            background: 'var(--bg-input)',
            color: 'var(--text-bright)',
            border: '1px solid var(--border)',
            borderRadius: 3,
            outline: 'none',
          }}
        >
          {sheets.length === 0 && <option value="">(无图集)</option>}
          {sheets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.frames.length} 帧)
            </option>
          ))}
        </select>

        {/* Divider */}
        {hasContent && <div style={{ width: 1, height: 20, background: 'var(--border)' }} />}

        {/* Mode Selector — Blender style (only when has content) */}
        {hasContent && <ModeSelector />}

        {/* Divider */}
        {hasContent && <div style={{ width: 1, height: 20, background: 'var(--border)' }} />}

        {/* View Controls (only when has content) */}
        {hasContent && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            {/* Overlay toggle */}
            <button
              onClick={() => {
                showColliderOverlay.value = !showColliderOverlay.value;
              }}
              title={showColliderOverlay.value ? '隐藏碰撞体覆盖层' : '显示碰撞体覆盖层'}
              style={{
                padding: '3px 6px',
                fontSize: 11,
                background: showColliderOverlay.value ? 'rgba(220, 60, 60, 0.2)' : 'transparent',
                color: showColliderOverlay.value ? '#e06060' : 'var(--text-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 3,
                cursor: 'pointer',
              }}
            >
              ⬣
            </button>

            {/* View mode toggle */}
            <div
              style={{
                display: 'flex',
                border: '1px solid var(--border)',
                borderRadius: 3,
                overflow: 'hidden',
              }}
            >
              <button
                onClick={() => {
                  spriteEditorMode.value = 'grid';
                }}
                title="网格视图"
                style={{
                  padding: '3px 6px',
                  fontSize: 11,
                  background: mode === 'grid' ? 'var(--accent)' : 'transparent',
                  color: mode === 'grid' ? '#fff' : 'var(--text-secondary)',
                  border: 'none',
                  cursor: 'pointer',
                }}
              >
                ▦
              </button>
              <button
                onClick={() => {
                  spriteEditorMode.value = 'list';
                }}
                title="列表视图"
                style={{
                  padding: '3px 6px',
                  fontSize: 11,
                  background: mode === 'list' ? 'var(--accent)' : 'transparent',
                  color: mode === 'list' ? '#fff' : 'var(--text-secondary)',
                  border: 'none',
                  borderLeft: '1px solid var(--border)',
                  cursor: 'pointer',
                }}
              >
                ☰
              </button>
            </div>
          </div>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Zoom controls (only when has content) */}
        {hasContent && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <button
              onClick={() => stepZoom(-1)}
              style={{
                width: 20,
                height: 22,
                padding: 0,
                fontSize: 11,
                background: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '3px 0 0 3px',
                cursor: 'pointer',
              }}
              title="缩小"
            >
              −
            </button>
            <span
              style={{
                minWidth: 32,
                textAlign: 'center',
                fontSize: 10,
                fontFamily: 'monospace',
                color: 'var(--text-bright)',
                borderTop: '1px solid var(--border)',
                borderBottom: '1px solid var(--border)',
                height: 22,
                lineHeight: '22px',
              }}
            >
              {formatZoom(zoom)}
            </span>
            <button
              onClick={() => stepZoom(1)}
              style={{
                width: 20,
                height: 22,
                padding: 0,
                fontSize: 11,
                background: 'transparent',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '0 3px 3px 0',
                cursor: 'pointer',
              }}
              title="放大"
            >
              +
            </button>
          </div>
        )}

        {/* Properties Panel Toggle (only when has content) */}
        {hasContent && (
          <button
            onClick={() => {
              propertiesPanelVisible.value = !propertiesPanelVisible.value;
            }}
            title="属性面板 (N)"
            style={{
              padding: '3px 8px',
              fontSize: 11,
              background: propertiesPanelVisible.value ? 'var(--accent)' : 'transparent',
              color: propertiesPanelVisible.value ? '#fff' : 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            N
          </button>
        )}

        {/* Import */}
        <button
          onClick={() => setShowImportDialog(true)}
          style={{
            fontSize: 11,
            padding: '3px 10px',
            height: 24,
            background: showImportDialog ? 'var(--accent)' : 'transparent',
            color: showImportDialog ? '#fff' : 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: 3,
            cursor: 'pointer',
          }}
        >
          导入
        </button>
      </div>

      {/* ── Row 2: Search bar + Image dimensions (only when has content) ── */}
      {hasContent && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '0 8px 6px',
            height: 26,
          }}
        >
          <input
            type="text"
            placeholder="搜索帧名…"
            value={spriteFilterText.value}
            onInput={(e) => {
              spriteFilterText.value = (e.target as HTMLInputElement).value;
            }}
            style={{
              flex: 1,
              maxWidth: 200,
              height: 22,
              background: 'var(--bg-input)',
              color: 'var(--text-bright)',
              border: '1px solid var(--border)',
              borderRadius: 3,
              fontSize: 11,
              paddingLeft: 8,
              outline: 'none',
            }}
          />
          {spriteFilterText.value && (
            <button
              onClick={() => {
                spriteFilterText.value = '';
              }}
              style={{
                fontSize: 10,
                padding: '0 4px',
                height: 18,
                background: 'transparent',
                color: 'var(--text-secondary)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              ✕
            </button>
          )}

          {/* Image dimensions */}
          {sheet && (
            <span
              style={{
                fontSize: 10,
                color: 'var(--text-secondary)',
                whiteSpace: 'nowrap',
                fontFamily: 'monospace',
              }}
            >
              {sheet.imageWidth}×{sheet.imageHeight}
            </span>
          )}
        </div>
      )}

      {/* ── Import Dialog (Centered Modal) ── */}
      {showImportDialog && (
        <ImportDialog onClose={() => setShowImportDialog(false)} />
      )}
    </div>
  );
}
