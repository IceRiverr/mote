// ═══════════════════════════════════════════════════════════════
// AssetView.tsx - Content Browser 右侧资产视图（Grid + List）
// ═══════════════════════════════════════════════════════════════

import { useState, useCallback } from 'preact/hooks';
import { AssetCard } from './AssetCard';
import { ContextMenu } from './ContextMenu';
import {
  visibleAssets,
  selectedAssetPaths,
  selectedFolderPath,
  searchQuery,
  viewMode,
  listSortBy,
  listSortAsc,
  getAssetIcon,
  renameAsset,
  deleteAsset,
  sortAssets,
  previewedPrefabPath,
  openAssetInSpriteEditor,
  openImageInSpriteEditor,
  loadSceneFromPath,
} from '../../store/contentBrowser';
import type { AssetNode } from '../../store/contentBrowser';
import { setSinglePrefabBrush } from '../../store/brush';
import { activeTool } from '../../store/selection';
import { layoutTree } from '../../store/layout';
import { openEditorForResource } from '../../layout/tree';

interface AssetViewProps {
  areaId: string;
}

export function AssetView({ areaId }: AssetViewProps) {
  const assets = visibleAssets.value;
  const [menuState, setMenuState] = useState<{
    x: number;
    y: number;
    asset: AssetNode;
  } | null>(null);

  const closeMenu = useCallback(() => setMenuState(null), []);

  if (assets.length === 0) {
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
        }}
      >
        <span style={{ fontSize: 24, opacity: 0.3 }}>📂</span>
        <span>暂无资源</span>
      </div>
    );
  }

  return (
    <div
      style={{ flex: 1, overflow: 'hidden', position: 'relative' }}
      onClick={closeMenu}
    >
      {viewMode.value === 'grid' ? (
        <GridView assets={assets} areaId={areaId} onContextMenu={setMenuState} />
      ) : (
        <ListView assets={assets} areaId={areaId} onContextMenu={setMenuState} />
      )}

      {menuState && (
        <ContextMenu
          x={menuState.x}
          y={menuState.y}
          items={buildMenuItems(menuState.asset, areaId, closeMenu)}
          onClose={closeMenu}
        />
      )}
    </div>
  );
}

// ── Grid View ──────────────────────────────────────────────────────────────

function GridView({
  assets,
  areaId,
  onContextMenu,
}: {
  assets: AssetNode[];
  areaId: string;
  onContextMenu: (state: { x: number; y: number; asset: AssetNode }) => void;
}) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))',
        gap: '4px',
        padding: '8px',
        overflow: 'auto',
        height: '100%',
        alignContent: 'start',
      }}
    >
      {assets.map((asset) => (
        <AssetCard
          key={asset.id}
          asset={asset}
          isSelected={selectedAssetPaths.value.includes(asset.path)}
          onClick={() => handleAssetClick(asset)}
          onDoubleClick={() => handleAssetDoubleClick(asset, areaId)}
          onContextMenu={(e) => {
            e.preventDefault();
            onContextMenu({ x: e.clientX, y: e.clientY, asset });
          }}
        />
      ))}
    </div>
  );
}

// ── List View ──────────────────────────────────────────────────────────────

function ListView({
  assets,
  areaId,
  onContextMenu,
}: {
  assets: AssetNode[];
  areaId: string;
  onContextMenu: (state: { x: number; y: number; asset: AssetNode }) => void;
}) {
  const sorted = sortAssets(assets, listSortBy.value, listSortAsc.value);
  const sortIcon = listSortAsc.value ? '▲' : '▼';

  const toggleSort = (field: 'name' | 'type') => {
    if (listSortBy.value === field) {
      listSortAsc.value = !listSortAsc.value;
    } else {
      listSortBy.value = field;
      listSortAsc.value = true;
    }
  };

  return (
    <div style={{ overflow: 'auto', height: '100%' }}>
      {/* 表头 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: '5px 12px',
          borderBottom: '1px solid var(--border)',
          fontSize: 10,
          fontWeight: 600,
          color: 'var(--text-secondary)',
          position: 'sticky',
          top: 0,
          background: 'var(--bg-panel)',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        <span
          style={{
            flex: 1,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
          onClick={() => toggleSort('name')}
        >
          名称 {listSortBy.value === 'name' ? sortIcon : ''}
        </span>
        <span
          style={{
            width: 80,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 4,
          }}
          onClick={() => toggleSort('type')}
        >
          类型 {listSortBy.value === 'type' ? sortIcon : ''}
        </span>
      </div>

      {sorted.map((asset) => {
        const isSelected = selectedAssetPaths.value.includes(asset.path);
        return (
          <div
            key={asset.id}
            onClick={() => handleAssetClick(asset)}
            onDblClick={() => handleAssetDoubleClick(asset, areaId)}
            onContextMenu={(e) => {
              e.preventDefault();
              onContextMenu({ x: e.clientX, y: e.clientY, asset });
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '5px 12px',
              gap: 8,
              cursor: 'pointer',
              fontSize: 11,
              background: isSelected ? 'var(--selection)' : 'transparent',
              borderBottom: '1px solid rgba(255,255,255,0.03)',
            }}
            onMouseEnter={(e) => {
              if (!isSelected) {
                (e.currentTarget as HTMLDivElement).style.background =
                  'rgba(255,255,255,0.04)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isSelected) {
                (e.currentTarget as HTMLDivElement).style.background =
                  'transparent';
              }
            }}
          >
            <span style={{ fontSize: 13 }}>{getAssetIcon(asset.type)}</span>
            <span
              style={{
                flex: 1,
                color: isSelected
                  ? 'var(--text-bright)'
                  : 'var(--text-primary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {asset.name}
            </span>
            <span
              style={{
                width: 80,
                color: 'var(--text-secondary)',
                textTransform: 'capitalize',
              }}
            >
              {asset.type === 'unknown' ? '文件' : asset.type}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Handlers ───────────────────────────────────────────────────────────────

function handleAssetClick(asset: AssetNode) {
  // ① 所有资源：选中
  selectedAssetPaths.value = [asset.path];

  // ② Prefab 特殊逻辑：仅在 Brush 模式下才更新笔刷
  if (asset.type === 'prefab' && activeTool.value === 'brush') {
    setSinglePrefabBrush(asset.path);
  }

  // ③ TODO: Properties 面板刷新（阶段 2 实现）
}

async function handleAssetDoubleClick(asset: AssetNode, areaId: string) {
  switch (asset.type) {
    case 'folder': {
      // 进入文件夹
      selectedFolderPath.value = asset.path;
      searchQuery.value = '';
      break;
    }

    case 'prefab': {
      // 打开 Prefab Preview 面板（Reuse-or-Split）
      previewedPrefabPath.value = asset.path;
      const result = openEditorForResource(layoutTree.value, areaId, 'prefab-preview');
      layoutTree.value = result.layout;
      break;
    }

    case 'sprite': {
      // 打开 Sprite Editor
      const ok = await openAssetInSpriteEditor(asset.path);
      if (!ok) {
        alert('打开 Sprite Editor 失败，请检查文件格式');
        return;
      }
      const result = openEditorForResource(layoutTree.value, areaId, 'sprite-editor');
      layoutTree.value = result.layout;
      break;
    }

    case 'image': {
      // 用默认 grid 参数打开 Sprite Editor（导入模式）
      const ok = await openImageInSpriteEditor(asset.path);
      if (!ok) {
        alert('打开 Sprite Editor 失败，请检查图片文件');
        return;
      }
      const result = openEditorForResource(layoutTree.value, areaId, 'sprite-editor');
      layoutTree.value = result.layout;
      break;
    }

    case 'scene': {
      // 加载场景到 Viewport
      const ok = await loadSceneFromPath(asset.path);
      if (!ok) {
        alert('加载场景失败，请检查文件格式');
      }
      break;
    }

    case 'script':
    case 'audio':
    case 'tilemap':
    case 'unknown':
    default: {
      // 暂不处理
      break;
    }
  }
}

// ── Context Menu Builder ───────────────────────────────────────────────────

function buildMenuItems(
  asset: AssetNode,
  _areaId: string,
  onClose: () => void
): Array<{ label: string; action: () => void; danger?: boolean; separator?: boolean }> {
  // 右键菜单只保留文件管理操作，不包含任何"打开"相关的菜单项（P2 原则）
  const items: Array<{ label: string; action: () => void; danger?: boolean; separator?: boolean }> = [
    {
      label: '✏️ 重命名',
      action: () => {
        const newName = prompt('新名称:', asset.name);
        if (newName && newName !== asset.name) {
          renameAsset(asset.path, newName);
        }
      },
    },
    {
      label: '🗑️ 删除',
      action: () => {
        if (confirm(`确定要删除 "${asset.name}" 吗？`)) {
          deleteAsset(asset.path);
          if (selectedAssetPaths.value.includes(asset.path)) {
            selectedAssetPaths.value = [];
          }
        }
      },
      danger: true,
    },
  ];

  return items;
}
