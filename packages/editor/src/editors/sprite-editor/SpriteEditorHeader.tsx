// ═══════════════════════════════════════════════════════════════
// SpriteEditorHeader.tsx — Blender-style top toolbar
// Includes sheet selector, mode selector, zoom controls, and import
// ═══════════════════════════════════════════════════════════════

import { useRef, useState } from 'preact/hooks';
import {
  spriteSheets,
  spriteSheetImages,
  activeSpriteSheetId,
  activeSpriteSheet,
  spriteEditorMode,
  spriteEditorZoom,
  spriteFilterText,
  selectedFrameIds,
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
import {
  importGridSpriteSheet,
  importPackedSpriteSheet,
  importXmlSpriteSheet,
  importLooseSpriteSheet,
} from '../../data/sprite-sheet-import';
import { addSpriteSheet } from '../../store/spriteSheet';

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
// Import Popover
// ═══════════════════════════════════════════════════════════════

type ImportMode = 'tilesheet' | 'packed' | 'xml' | 'loose';

function ImportPopover({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<ImportMode>('tilesheet');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tileW, setTileW] = useState(16);
  const [tileH, setTileH] = useState(16);
  const [margin, setMargin] = useState(0);
  const [spacing, setSpacing] = useState(0);
  const fileRef = useRef<HTMLInputElement>(null);

  const acceptMap: Record<ImportMode, string> = {
    tilesheet: '.png,.jpg,.jpeg,.webp,.gif',
    packed: '.json,.png,.jpg,.jpeg,.webp',
    xml: '.xml,.txt,.png,.jpg,.jpeg,.webp',
    loose: '.png,.jpg,.jpeg,.webp,.gif',
  };

  const doImport = async () => {
    const files = Array.from(fileRef.current?.files ?? []);
    if (files.length === 0) {
      setError('请选择文件');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      if (mode === 'tilesheet') {
        const imgFile = files.find((f) => /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name));
        if (!imgFile) throw new Error('未找到图片文件');
        const { sheet, img } = await importGridSpriteSheet(imgFile, tileW, tileH, margin, spacing);
        addSpriteSheet(sheet, img);
      } else if (mode === 'packed') {
        const jsonFile = files.find((f) => f.name.endsWith('.json'));
        const imgFile = files.find((f) => /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name));
        if (!jsonFile || !imgFile) throw new Error('需要 JSON + 图片文件');
        const { sheet, img } = await importPackedSpriteSheet(jsonFile, imgFile);
        addSpriteSheet(sheet, img);
      } else if (mode === 'xml') {
        const xmlFile = files.find((f) => /\.(xml|txt)$/i.test(f.name));
        const imgFile = files.find((f) => /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name));
        if (!xmlFile || !imgFile) throw new Error('需要 XML + 图片文件');
        const { sheet, img } = await importXmlSpriteSheet(xmlFile, imgFile);
        addSpriteSheet(sheet, img);
      } else {
        const imgFiles = files.filter((f) => /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name));
        if (imgFiles.length < 2) throw new Error('至少需要 2 张图片');
        const { sheet, img } = await importLooseSpriteSheet(imgFiles);
        addSpriteSheet(sheet, img);
      }
      onDone();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const tabStyle = (m: ImportMode): Record<string, any> => ({
    flex: 1,
    fontSize: 10,
    padding: '3px 0',
    border: '1px solid var(--border)',
    borderRadius: 3,
    cursor: 'pointer',
    background: mode === m ? 'var(--accent)' : 'transparent',
    color: mode === m ? '#fff' : 'var(--text-secondary)',
  });

  const labels: Record<ImportMode, string> = {
    tilesheet: '网格',
    packed: 'JSON',
    xml: 'XML',
    loose: '散图',
  };

  const hints: Record<ImportMode, string> = {
    tilesheet: '选择等距网格 sprite sheet 图片',
    packed: '选择 TexturePacker JSON + PNG',
    xml: '选择 Sparrow/Starling XML + PNG',
    loose: '选择多张 PNG，自动打包成图集',
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        right: 0,
        zIndex: 100,
        background: '#2a2a2a',
        borderBottom: '2px solid var(--accent)',
        padding: 8,
        boxShadow: '0 4px 12px rgba(0,0,0,0.5)',
      }}
    >
      <div style={{ display: 'flex', gap: 2, marginBottom: 6 }}>
        {(['tilesheet', 'packed', 'xml', 'loose'] as ImportMode[]).map((m) => (
          <button key={m} onClick={() => setMode(m)} style={tabStyle(m)}>
            {labels[m]}
          </button>
        ))}
      </div>
      <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>
        {hints[mode]}
      </div>
      <input
        ref={fileRef}
        type="file"
        multiple={mode !== 'tilesheet'}
        accept={acceptMap[mode]}
        style={{ fontSize: 10, marginBottom: 4, width: '100%' }}
      />
      {mode === 'tilesheet' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '4px 0' }}>
          <NumLabel label="W" value={tileW} onChange={setTileW} />
          <NumLabel label="H" value={tileH} onChange={setTileH} />
          <NumLabel label="M" value={margin} onChange={setMargin} />
          <NumLabel label="S" value={spacing} onChange={setSpacing} />
        </div>
      )}
      {error && (
        <div style={{ fontSize: 10, color: '#e06060', margin: '4px 0' }}>{error}</div>
      )}
      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        <button
          onClick={doImport}
          disabled={loading}
          style={{
            flex: 1,
            fontSize: 11,
            padding: '4px 0',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 3,
            cursor: loading ? 'wait' : 'pointer',
          }}
        >
          {loading ? '导入中…' : '导入'}
        </button>
        <button
          onClick={onDone}
          style={{
            fontSize: 11,
            padding: '4px 8px',
            background: 'transparent',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 3,
            cursor: 'pointer',
          }}
        >
          取消
        </button>
      </div>
    </div>
  );
}

function NumLabel({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <label style={{ fontSize: 10, display: 'flex', alignItems: 'center', gap: 2 }}>
      {label}
      <input
        type="number"
        value={value}
        onInput={(e) => onChange(parseInt((e.target as HTMLInputElement).value) || 0)}
        style={{
          width: 44,
          height: 20,
          fontSize: 11,
          padding: '0 3px',
          border: '1px solid var(--border)',
          borderRadius: 2,
          background: 'var(--bg-input)',
          color: 'var(--text-bright)',
          outline: 'none',
        }}
      />
    </label>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Header Component
// ═══════════════════════════════════════════════════════════════

export function SpriteEditorHeader() {
  const [showImport, setShowImport] = useState(false);
  const sheet = activeSpriteSheet.value;
  const sheets = spriteSheets.value;
  const mode = spriteEditorMode.value;
  const zoom = spriteEditorZoom.value;
  const colliderMode = editorMode.value === 'collider';
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
          onClick={() => setShowImport(!showImport)}
          style={{
            fontSize: 11,
            padding: '3px 10px',
            height: 24,
            background: showImport ? 'var(--accent)' : 'transparent',
            color: showImport ? '#fff' : 'var(--text-primary)',
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

      {/* ── Import Popover ── */}
      {showImport && <ImportPopover onDone={() => setShowImport(false)} />}
    </div>
  );
}
