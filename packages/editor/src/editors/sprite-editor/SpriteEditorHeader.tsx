// ═══════════════════════════════════════════════════════════════
// SpriteEditorHeader.tsx — AreaView header 行工具栏
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
  showColliderOverlay,
} from './state';
import {
  isFileSystemAccessSupported,
  exportSpriteSheetWithPicker,
  saveSpriteSheetToProject,
} from '../../data/fs-access';
import { currentProject } from '../../store/project';

export function SpriteEditorHeader() {
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [exporting, setExporting] = useState(false);
  const sheet = activeSpriteSheet.value;
  const sheets = spriteSheets.value;
  const mode = spriteEditorMode.value;
  const zoom = spriteEditorZoom.value;
  const hasContent = !!sheet;
  const currentMode = editorMode.value;

  const handleExport = async () => {
    if (!sheet) return;
    setExporting(true);
    try {
      const project = currentProject.value;
      if (project) {
        await saveSpriteSheetToProject(project, sheet);
      } else if (isFileSystemAccessSupported()) {
        await exportSpriteSheetWithPicker(sheet);
      } else {
        alert('请先打开一个项目，或启用文件系统访问 API');
      }
    } catch (e: any) {
      if (e.name !== 'AbortError') {
        alert('导出失败：' + e.message);
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flex: 1,
      }}
    >
      {/* 图集选择 */}
      <select
        value={activeSpriteSheetId.value ?? ''}
        onChange={(e) => {
          const v = (e.target as HTMLSelectElement).value;
          activeSpriteSheetId.value = v || null;
          selectedFrameIds.value = [];
          editorCam.value = { x: 0, y: 0 };
        }}
        style={{
          width: 140,
          minWidth: 0,
          height: 20,
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
            {s.name}
          </option>
        ))}
      </select>

      {hasContent && (
        <>
          {/* 碰撞编辑开关（同时控制显示） */}
          <button
            onClick={() => {
              const isCollider = editorMode.value === 'collider';
              editorMode.value = isCollider ? 'select' : 'collider';
              showColliderOverlay.value = !isCollider;
            }}
            title={editorMode.value === 'collider' ? '退出碰撞编辑' : '进入碰撞编辑'}
            style={{
              padding: '1px 5px',
              fontSize: 10,
              background: editorMode.value === 'collider' ? 'rgba(220, 60, 60, 0.2)' : 'transparent',
              color: editorMode.value === 'collider' ? '#e06060' : 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 3,
              cursor: 'pointer',
            }}
          >
            ⬡
          </button>

          {/* 缩放 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <button
              onClick={() => stepZoom(-1)}
              style={zoomBtnStyle('left')}
              title="缩小"
            >
              −
            </button>
            <span
              style={{
                minWidth: 28,
                textAlign: 'center',
                fontSize: 10,
                fontFamily: 'monospace',
                color: 'var(--text-bright)',
                borderTop: '1px solid var(--border)',
                borderBottom: '1px solid var(--border)',
                height: 18,
                lineHeight: '18px',
              }}
            >
              {formatZoom(zoom)}
            </span>
            <button
              onClick={() => stepZoom(1)}
              style={zoomBtnStyle('right')}
              title="放大"
            >
              +
            </button>
          </div>

        </>
      )}

      <div style={{ flex: 1 }} />

      {/* 导入 */}
      <button
        onClick={() => setShowImportDialog(true)}
        style={{
          fontSize: 11,
          padding: '1px 8px',
          height: 20,
          background: showImportDialog ? 'var(--accent)' : 'transparent',
          color: showImportDialog ? '#fff' : 'var(--text-primary)',
          border: '1px solid var(--border)',
          borderRadius: 3,
          cursor: 'pointer',
        }}
      >
        导入
      </button>

      {/* 导出 */}
      {hasContent && (
        <button
          onClick={handleExport}
          disabled={exporting}
          style={{
            fontSize: 11,
            padding: '1px 8px',
            height: 20,
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 3,
            cursor: exporting ? 'not-allowed' : 'pointer',
            opacity: exporting ? 0.7 : 1,
          }}
        >
          {exporting ? '…' : '导出'}
        </button>
      )}

      {/* 导入弹窗 */}
      {showImportDialog && (
        <ImportDialog onClose={() => setShowImportDialog(false)} />
      )}
    </div>
  );
}

// ── Zoom Button Style ────────────────────────────────────────

function zoomBtnStyle(side: 'left' | 'right') {
  return {
    width: 18,
    height: 18,
    padding: 0,
    fontSize: 10,
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
    borderRadius: side === 'left' ? '3px 0 0 3px' : '0 3px 3px 0',
    cursor: 'pointer',
  } as any;
}
