// ═══════════════════════════════════════════════════════════════
// AssetCard.tsx - Content Browser 资产卡片（Grid 视图）
// ═══════════════════════════════════════════════════════════════

import type { AssetNode } from '../../store/contentBrowser';
import { getAssetIcon } from '../../store/contentBrowser';
import { getPrefab } from '../../store/prefabs';

interface AssetCardProps {
  asset: AssetNode;
  isSelected: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onContextMenu: (e: MouseEvent) => void;
}

export function AssetCard({
  asset,
  isSelected,
  onClick,
  onDoubleClick,
  onContextMenu,
}: AssetCardProps) {
  const icon = getAssetIcon(asset.type);

  // Prefab 特殊处理：尝试从 store 获取 Prefab 数据
  const prefab = asset.type === 'prefab' ? getPrefab(asset.path) : null;
  const hasSprite = prefab?.components.Sprite;
  const displayName = prefab?.name || asset.name;

  return (
    <div
      onClick={onClick}
      onDblClick={onDoubleClick}
      onContextMenu={onContextMenu}
      draggable
      onDragStart={(e) => {
        e.dataTransfer?.setData('application/mote-asset', asset.path);
        e.dataTransfer!.effectAllowed = 'copy';
      }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '4px',
        padding: '8px 6px',
        borderRadius: '4px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        minWidth: '64px',
        background: isSelected ? 'rgba(74, 144, 217, 0.2)' : 'transparent',
        border: isSelected ? '2px solid #4a90d9' : '2px solid transparent',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          (e.currentTarget as HTMLDivElement).style.background = '#3a3a3a';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          (e.currentTarget as HTMLDivElement).style.background = 'transparent';
        }
      }}
    >
      {/* 图标/缩略图区域 */}
      <div
        style={{
          width: '48px',
          height: '48px',
          background: '#2a2a2a',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          border: isSelected ? '2px solid #4a90d9' : '1px solid #444',
          boxShadow: isSelected ? '0 0 8px rgba(74, 144, 217, 0.5)' : 'none',
        }}
      >
        {asset.type === 'prefab' ? (
          <span style={{ fontSize: '24px', opacity: isSelected ? 1 : 0.7 }}>
            {hasSprite ? '🎨' : '📦'}
          </span>
        ) : (
          <span style={{ fontSize: '24px' }}>{icon}</span>
        )}
      </div>

      {/* 文件名（Prefab 优先使用 prefab.name） */}
      <span
        style={{
          fontSize: '11px',
          color: isSelected ? '#4a90d9' : '#ccc',
          textAlign: 'center',
          maxWidth: '72px',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontWeight: isSelected ? 600 : 400,
        }}
        title={displayName}
      >
        {displayName}
      </span>
    </div>
  );
}
