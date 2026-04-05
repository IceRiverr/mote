// ═══════════════════════════════════════════════════════════════
// SpriteEditorHeader.tsx — Top toolbar for the Sprite Editor.
// Includes sheet selector, size info, search, view mode toggle,
// collider mode toggle, zoom controls, and import button.
// ═══════════════════════════════════════════════════════════════

import { useRef, useState } from 'preact/hooks';
import {
  spriteSheets,
  spriteSheetImages,
  activeSpriteSheetId,
  activeSpriteSheet,
  spriteEditorMode,
  colliderEditMode,
  spriteEditorZoom,
  spriteFilterText,
  selectedFrameIds,
  editorCam,
  stepZoom,
  formatZoom,
} from './state';
import {
  importTileSheetAtlas,
  importPackedAtlas,
  importXmlAtlas,
  importLooseFiles,
} from '../../data/atlas-import';

// ── Import Popover ────────────────────────────────────────────

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
        await importTileSheetAtlas(imgFile, tileW, tileH, margin, spacing);
      } else if (mode === 'packed') {
        const jsonFile = files.find((f) => f.name.endsWith('.json'));
        const imgFile = files.find((f) => /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name));
        if (!jsonFile || !imgFile) throw new Error('需要 JSON + 图片文件');
        await importPackedAtlas(jsonFile, imgFile);
      } else if (mode === 'xml') {
        const xmlFile = files.find((f) => /\.(xml|txt)$/i.test(f.name));
        const imgFile = files.find((f) => /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name));
        if (!xmlFile || !imgFile) throw new Error('需要 XML + 图片文件');
        await importXmlAtlas(xmlFile, imgFile);
      } else {
        const imgFiles = files.filter((f) => /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name));
        if (imgFiles.length < 2) throw new Error('至少需要 2 张图片');
        await importLooseFiles(imgFiles);
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
          {loading ? '导入中\u2026' : '导入'}
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

// ── Main Header Component ─────────────────────────────────────

export function SpriteEditorHeader() {
  const [showImport, setShowImport] = useState(false);
  const sheet = activeSpriteSheet.value;
  const sheets = spriteSheets.value;
  const mode = spriteEditorMode.value;
  const colliderOn = colliderEditMode.value;
  const zoom = spriteEditorZoom.value;

  return (
    <div
      style={{
        background: 'var(--bg-header)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
        position: 'relative',
      }}
    >
      {/* ── Row 1: Sheet selector + info + actions ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '0 8px',
          height: 32,
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
            flex: 1,
            minWidth: 0,
            height: 22,
            fontSize: 11,
            background: 'var(--bg-input)',
            color: 'var(--text-bright)',
            border: '1px solid var(--border)',
            borderRadius: 3,
            outline: 'none',
          }}
        >
          {sheets.length === 0 && <option value="">(\u65E0\u56FE\u96C6)</option>}
          {sheets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.frames.length} \u5E27)
            </option>
          ))}
        </select>

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
            {sheet.imageWidth}\u00D7{sheet.imageHeight}
          </span>
        )}

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
            title="\u7F51\u683C\u89C6\u56FE"
            style={{
              padding: '2px 6px',
              fontSize: 11,
              background: mode === 'grid' ? 'var(--accent)' : 'transparent',
              color: mode === 'grid' ? '#fff' : 'var(--text-secondary)',
              border: 'none',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            {'\u25A6'}
          </button>
          <button
            onClick={() => {
              spriteEditorMode.value = 'list';
            }}
            title="\u5217\u8868\u89C6\u56FE"
            style={{
              padding: '2px 6px',
              fontSize: 11,
              background: mode === 'list' ? 'var(--accent)' : 'transparent',
              color: mode === 'list' ? '#fff' : 'var(--text-secondary)',
              border: 'none',
              borderLeft: '1px solid var(--border)',
              cursor: 'pointer',
              lineHeight: 1,
            }}
          >
            {'\u2630'}
          </button>
        </div>

        {/* Collider edit mode toggle */}
        <button
          onClick={() => {
            colliderEditMode.value = !colliderEditMode.value;
          }}
          title={colliderOn ? '\u9000\u51FA\u78B0\u649E\u7F16\u8F91\u6A21\u5F0F' : '\u8FDB\u5165\u78B0\u649E\u7F16\u8F91\u6A21\u5F0F'}
          style={{
            padding: '2px 6px',
            fontSize: 11,
            background: colliderOn ? 'rgba(220, 60, 60, 0.3)' : 'transparent',
            color: colliderOn ? '#e06060' : 'var(--text-secondary)',
            border: colliderOn ? '1px solid rgba(220, 60, 60, 0.5)' : '1px solid var(--border)',
            borderRadius: 3,
            cursor: 'pointer',
            lineHeight: 1,
          }}
        >
          {'\u2B23'}
        </button>

        {/* Zoom controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <button
            onClick={() => stepZoom(-1)}
            style={{
              width: 18,
              height: 20,
              padding: 0,
              fontSize: 11,
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '3px 0 0 3px',
              cursor: 'pointer',
            }}
            title="\u7F29\u5C0F"
          >
            {'\u2212'}
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
              height: 20,
              lineHeight: '20px',
            }}
          >
            {formatZoom(zoom)}
          </span>
          <button
            onClick={() => stepZoom(1)}
            style={{
              width: 18,
              height: 20,
              padding: 0,
              fontSize: 11,
              background: 'transparent',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '0 3px 3px 0',
              cursor: 'pointer',
            }}
            title="\u653E\u5927"
          >
            +
          </button>
        </div>

        {/* Import */}
        <button
          onClick={() => setShowImport(!showImport)}
          style={{
            fontSize: 11,
            padding: '2px 8px',
            height: 22,
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

      {/* ── Row 2: Search bar ── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          padding: '0 8px 4px',
          height: 24,
        }}
      >
        <input
          type="text"
          placeholder="\u641C\u7D22\u5E27\u540D\u2026"
          value={spriteFilterText.value}
          onInput={(e) => {
            spriteFilterText.value = (e.target as HTMLInputElement).value;
          }}
          style={{
            flex: 1,
            height: 20,
            background: 'var(--bg-input)',
            color: 'var(--text-bright)',
            border: '1px solid var(--border)',
            borderRadius: 3,
            fontSize: 11,
            paddingLeft: 6,
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
            {'\u2715'}
          </button>
        )}
      </div>

      {/* ── Import Popover ── */}
      {showImport && <ImportPopover onDone={() => setShowImport(false)} />}
    </div>
  );
}
