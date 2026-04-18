// ═══════════════════════════════════════════════════════════════
// ContentBrowser.tsx - Content Browser 主组件
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect } from 'preact/hooks';
import { FolderTree } from './FolderTree';
import { AssetView } from './AssetView';
import { ContextMenu } from './ContextMenu';
import {
  assetTree,
  scanAssets,
  searchQuery,
  typeFilter,
  viewMode,
  selectedFolderPath,
  isGlobalSearch,
  createFolder,
  createPrefabFile,
} from '../../store/contentBrowser';
import { layoutTree } from '../../store/layout';
import { setEditorType } from '../../layout/tree';
import { currentProject } from '../../project';

export function ContentBrowser({ areaId }: { areaId: string }) {
  const [newMenuOpen, setNewMenuOpen] = useState(false);

  // 项目变化时自动扫描
  useEffect(() => {
    if (currentProject.value) {
      scanAssets();
    }
  }, [currentProject.value?.id]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'var(--bg-panel)',
        color: 'var(--text-primary)',
        fontSize: 13,
        overflow: 'hidden',
      }}
    >
      {/* ── 工具栏 ── */}
      <div
        style={{
          height: 32,
          display: 'flex',
          alignItems: 'center',
          padding: '0 8px',
          gap: 6,
          flexShrink: 0,
          borderBottom: '1px solid var(--border)',
          background: 'var(--panel-header)',
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
            height: 22,
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
              height: 20,
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
            height: 22,
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
          <button
            onClick={() => {
              viewMode.value = 'grid';
            }}
            style={{
              background:
                viewMode.value === 'grid'
                  ? 'var(--selection)'
                  : 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 3,
              color:
                viewMode.value === 'grid'
                  ? 'var(--text-bright)'
                  : 'var(--text-secondary)',
              fontSize: 12,
              cursor: 'pointer',
              width: 24,
              height: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
            title="Grid 视图"
          >
            ⊞
          </button>
          <button
            onClick={() => {
              viewMode.value = 'list';
            }}
            style={{
              background:
                viewMode.value === 'list'
                  ? 'var(--selection)'
                  : 'transparent',
              border: '1px solid var(--border)',
              borderRadius: 3,
              color:
                viewMode.value === 'list'
                  ? 'var(--text-bright)'
                  : 'var(--text-secondary)',
              fontSize: 12,
              cursor: 'pointer',
              width: 24,
              height: 22,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
            title="List 视图"
          >
            ☰
          </button>
        </div>

        {/* 刷新按钮 */}
        <button
          onClick={() => scanAssets()}
          title="刷新"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            fontSize: 14,
            padding: '0 4px',
            lineHeight: 1,
          }}
        >
          🔄
        </button>

        {/* 新建按钮 + 下拉菜单 */}
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
                top: 28,
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
                  // TODO: 导入文件
                  console.log('Import files to:', selectedFolderPath.value);
                  setNewMenuOpen(false);
                }}
              />
            </div>
          )}
        </div>
      </div>

      {/* ── 主体：左树右视图 ── */}
      <div
        style={{ display: 'flex', flex: 1, overflow: 'hidden' }}
        onClick={() => {
          if (newMenuOpen) setNewMenuOpen(false);
        }}
      >
        {/* 左侧 Folder Tree */}
        <div
          style={{
            width: 160,
            minWidth: 120,
            maxWidth: 300,
            borderRight: '1px solid var(--border)',
            overflow: 'auto',
            resize: 'horizontal',
          }}
        >
          <FolderTree nodes={assetTree.value} />
        </div>

        {/* 右侧 Asset View */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* 面包屑 + 搜索状态 */}
          <div
            style={{
              height: 24,
              display: 'flex',
              alignItems: 'center',
              padding: '0 12px',
              gap: 8,
              fontSize: 11,
              color: 'var(--text-secondary)',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
            }}
          >
            {isGlobalSearch.value ? (
              <span style={{ color: '#4a90d9' }}>
                🌐 全局搜索: "{searchQuery.value.slice(1)}"
              </span>
            ) : (
              <Breadcrumb />
            )}
          </div>

          {/* 资产视图 */}
          <AssetView areaId={areaId} />
        </div>
      </div>
    </div>
  );
}

// ── MenuItem ───────────────────────────────────────────────────────────────

function MenuItem({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
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

// ── Breadcrumb ─────────────────────────────────────────────────────────────

function Breadcrumb() {
  const path = selectedFolderPath.value;
  const parts = path.split('/').filter(Boolean);

  return (
    <>
      {parts.map((part, i) => (
        <span
          key={i}
          style={{ display: 'flex', alignItems: 'center', gap: 4 }}
        >
          {i > 0 && (
            <span style={{ color: 'var(--text-secondary)', opacity: 0.4 }}>
              /
            </span>
          )}
          <span
            style={{
              color:
                i === parts.length - 1
                  ? 'var(--text-bright)'
                  : 'var(--text-secondary)',
              cursor: i < parts.length - 1 ? 'pointer' : 'default',
            }}
            onClick={() => {
              if (i < parts.length - 1) {
                const newPath = parts.slice(0, i + 1).join('/');
                selectedFolderPath.value = newPath;
              }
            }}
          >
            {part}
          </span>
        </span>
      ))}
    </>
  );
}
