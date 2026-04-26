// ═══════════════════════════════════════════════════════════════
// ContentBrowserHeader.tsx — 合并到 AreaView header 行的工具栏
// ═══════════════════════════════════════════════════════════════

import { useState } from 'preact/hooks';
import {
  searchQuery,
  typeFilter,
  viewMode,
  selectedFolderPath,
  scanAssets,
  createFolder,
  createPrefabFile,
} from '../../store/contentBrowser';

export function ContentBrowserHeader() {
  const [newMenuOpen, setNewMenuOpen] = useState(false);

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        flex: 1,
      }}
    >
      {/* 搜索框 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          flex: 1,
          background: 'var(--bg-input)',
          border: searchQuery.value.startsWith('/')
            ? '1px solid #4a90d9'
            : '1px solid var(--border)',
          borderRadius: 3,
          padding: '0 6px',
          height: 20,
          maxWidth: 240,
        }}
      >
        <span
          style={{
            fontSize: 10,
            color: searchQuery.value.startsWith('/')
              ? '#4a90d9'
              : 'var(--text-secondary)',
            marginRight: 4,
          }}
        >
          {searchQuery.value.startsWith('/') ? '🌐' : '🔍'}
        </span>
        <input
          type="text"
          placeholder="搜索资源... ( / 全局搜索 )"
          value={searchQuery.value}
          onInput={(e) => {
            searchQuery.value = (e.target as HTMLInputElement).value;
          }}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: 'var(--text-primary)',
            fontSize: 11,
            height: 18,
            padding: 0,
          }}
        />
        {searchQuery.value && (
          <button
            onClick={() => {
              searchQuery.value = '';
            }}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              fontSize: 10,
              padding: '0 2px',
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* 类型过滤器 */}
      <select
        value={typeFilter.value}
        onChange={(e) => {
          typeFilter.value = (e.target as HTMLSelectElement).value as any;
        }}
        style={{
          background: 'var(--bg-input)',
          color: 'var(--text-primary)',
          border: '1px solid var(--border)',
          borderRadius: 3,
          fontSize: 11,
          height: 20,
          outline: 'none',
        }}
      >
        <option value="all">全部</option>
        <option value="prefab">Prefab</option>
        <option value="image">图片</option>
        <option value="sprite">Sprite</option>
        <option value="scene">场景</option>
        <option value="script">脚本</option>
        <option value="folder">文件夹</option>
      </select>

      {/* 视图切换 */}
      <div style={{ display: 'flex', gap: 1 }}>
        <ViewToggle mode="grid" label="⊞" />
        <ViewToggle mode="list" label="☰" />
      </div>

      {/* 刷新 */}
      <button
        onClick={() => scanAssets()}
        title="刷新"
        style={{
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-secondary)',
          fontSize: 13,
          padding: '0 4px',
          lineHeight: 1,
        }}
      >
        🔄
      </button>

      {/* 新建 */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setNewMenuOpen(!newMenuOpen)}
          title="新建"
          style={{
            background: newMenuOpen
              ? 'var(--selection)'
              : 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: newMenuOpen
              ? 'var(--text-bright)'
              : 'var(--text-secondary)',
            fontSize: 16,
            padding: '0 4px',
            lineHeight: 1,
            borderRadius: 3,
          }}
        >
          ＋
        </button>

        {newMenuOpen && (
          <div
            style={{
              position: 'absolute',
              top: 24,
              right: 0,
              zIndex: 1000,
              background: 'var(--bg-header)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              padding: '4px 0',
              minWidth: 160,
              boxShadow: '0 4px 16px rgba(0,0,0,0.5)',
            }}
          >
            <MenuItem
              label="📁 新建文件夹"
              onClick={() => {
                const name = prompt('文件夹名称:', 'New Folder');
                if (name) {
                  createFolder(selectedFolderPath.value, name);
                }
                setNewMenuOpen(false);
              }}
            />
            <MenuItem
              label="📦 新建 Prefab"
              onClick={() => {
                const name = prompt('Prefab 名称:', 'New Prefab');
                if (name) {
                  createPrefabFile(selectedFolderPath.value, name);
                }
                setNewMenuOpen(false);
              }}
            />
            <div
              style={{
                height: 1,
                background: 'var(--border)',
                margin: '4px 0',
              }}
            />
            <MenuItem
              label="📥 导入文件..."
              onClick={() => {
                console.log('Import files to:', selectedFolderPath.value);
                setNewMenuOpen(false);
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}

// ── View Toggle ──────────────────────────────────────────────

function ViewToggle({ mode, label }: { mode: 'grid' | 'list'; label: string }) {
  const active = viewMode.value === mode;
  return (
    <button
      onClick={() => {
        viewMode.value = mode;
      }}
      style={{
        background: active ? 'var(--selection)' : 'transparent',
        border: '1px solid var(--border)',
        borderRadius: 3,
        color: active ? 'var(--text-bright)' : 'var(--text-secondary)',
        fontSize: 12,
        cursor: 'pointer',
        width: 22,
        height: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 0,
      }}
      title={mode === 'grid' ? 'Grid 视图' : 'List 视图'}
    >
      {label}
    </button>
  );
}

// ── MenuItem ─────────────────────────────────────────────────

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'var(--selection)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = 'transparent';
      }}
      style={{
        padding: '5px 12px',
        fontSize: 11,
        cursor: 'pointer',
        color: 'var(--text-primary)',
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </div>
  );
}
