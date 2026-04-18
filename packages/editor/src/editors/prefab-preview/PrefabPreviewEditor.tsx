// ═══════════════════════════════════════════════════════════════
// PrefabPreviewEditor.tsx — 轻量 Prefab 预览面板
// ═══════════════════════════════════════════════════════════════

import { registerEditor } from '../registry';
import { previewedPrefabPath } from '../../store/contentBrowser';
import { getPrefab } from '../../store/prefabs';
import { spawnPrefab } from '../../store/scene';
import { PrefabThumbnail } from './PrefabThumbnail';
import type { Prefab } from '../../data/Prefab';

const TAG_COLORS: Record<string, string> = {
  environment: '#4a7c59',
  walls: '#8b7355',
  characters: '#d4574a',
  items: '#f4a742',
  system: '#666',
};

function getTagColor(tag?: string): string {
  return (tag && TAG_COLORS[tag]) || '#4a90d9';
}

/** 渲染组件属性的可折叠列表 */
function ComponentDetails({ name, data }: { name: string; data: Record<string, any> }) {
  const entries = Object.entries(data).filter(([k]) => k !== 'type');
  if (entries.length === 0) return null;

  return (
    <div style={{ marginTop: 4 }}>
      {entries.map(([key, value]) => {
        const formatted = formatValue(value);
        return (
          <div
            key={key}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              gap: 8,
              padding: '2px 0',
              fontSize: 10,
              color: 'var(--text-secondary)',
              fontFamily: 'monospace',
            }}
          >
            <span style={{ opacity: 0.7, flexShrink: 0 }}>{key}</span>
            <span
              style={{
                color: 'var(--text-primary)',
                textAlign: 'right',
                wordBreak: 'break-all',
                minWidth: 0,
              }}
              title={formatted}
            >
              {formatted}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'boolean') return v ? 'true' : 'false';
  if (typeof v === 'number') {
    if (v === 0) return '0';
    // 保留最多2位小数，去除末尾0（但保留整数位）
    const s = v.toFixed(2);
    return s.replace(/\.00$/, '').replace(/(\d)0$/, '$1');
  }
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return `[${v.length}]`;
  if (typeof v === 'object') return '{…}';
  return String(v);
}

function PrefabPreviewEditor({ areaId }: { areaId: string }) {
  const path = previewedPrefabPath.value;
  const prefab = path ? getPrefab(path) : null;

  if (!prefab) {
    return (
      <div
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--text-secondary)',
          fontSize: 12,
          gap: 8,
          padding: 20,
        }}
      >
        <span style={{ fontSize: 32, opacity: 0.3 }}>📦</span>
        <span>请在 Content Browser 中双击 Prefab 进行预览</span>
      </div>
    );
  }

  const tag = prefab.tags?.[0];
  const componentEntries = Object.entries(prefab.components);

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'auto',
        padding: 10,
        gap: 8,
        fontSize: 12,
        color: 'var(--text-primary)',
      }}
    >
      {/* 缩略图 + 基础信息（横向布局） */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        {/* 缩略图 */}
        <div
          style={{
            width: 64,
            height: 64,
            minWidth: 64,
            background: '#2a2a2a',
            borderRadius: 4,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid var(--border)',
            overflow: 'hidden',
          }}
        >
          <PrefabThumbnail prefab={prefab} size={60} />
        </div>

        {/* 名称 / ID / Tag */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-bright)', lineHeight: 1.3 }}>
            {prefab.name}
          </div>
          <div style={{ color: 'var(--text-secondary)', fontSize: 10, fontFamily: 'monospace' }}>
            {prefab.id}
          </div>
          {tag && (
            <span
              style={{
                display: 'inline-flex',
                alignSelf: 'flex-start',
                fontSize: 9,
                color: getTagColor(tag),
                background: `${getTagColor(tag)}18`,
                padding: '1px 5px',
                borderRadius: 3,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginTop: 2,
              }}
            >
              {tag}
            </span>
          )}
        </div>
      </div>

      {/* 路径 */}
      <div
        style={{
          color: 'var(--text-secondary)',
          fontSize: 9,
          wordBreak: 'break-all',
          opacity: 0.6,
          fontFamily: 'monospace',
          lineHeight: 1.4,
        }}
      >
        {path}
      </div>

      {/* 分隔线 */}
      <div style={{ height: 1, background: 'var(--border)', margin: '2px 0' }} />

      {/* 组件列表 */}
      <div style={{ fontWeight: 600, fontSize: 10, color: 'var(--text-secondary)', marginBottom: 2 }}>
        组件 ({componentEntries.length})
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {componentEntries.map(([name, data]) => (
          <ComponentCard key={name} name={name} data={data} />
        ))}
      </div>

      {/* 底部间距 */}
      <div style={{ height: 8 }} />

      {/* 实例化按钮 */}
      <button
        onClick={() => {
          if (path) {
            spawnPrefab(path, 320, 240);
          }
        }}
        style={{
          width: '100%',
          padding: '8px 12px',
          background: '#4a90d9',
          color: '#fff',
          border: 'none',
          borderRadius: 4,
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = '#5aa0e9';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = '#4a90d9';
        }}
      >
        🎯 实例化到场景 (320, 240)
      </button>
    </div>
  );
}

function ComponentCard({ name, data }: { name: string; data: Record<string, any> }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 4,
        padding: '6px 8px',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ color: '#4a90d9', fontSize: 8 }}>●</span>
        <span style={{ fontWeight: 600, fontSize: 11 }}>{name}</span>
      </div>
      <ComponentDetails name={name} data={data} />
    </div>
  );
}

registerEditor({
  id: 'prefab-preview',
  name: 'Prefab 预览',
  icon: '📦',
  component: PrefabPreviewEditor,
});

export { PrefabPreviewEditor };
