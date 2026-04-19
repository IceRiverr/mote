// ═══════════════════════════════════════════════════════════════
// AssetCard.tsx - Content Browser 资产卡片（Grid 视图）
// ═══════════════════════════════════════════════════════════════

import type { AssetNode } from '../../store/contentBrowser';
import { getAssetIcon, getAssetTypeLabel } from '../../store/contentBrowser';
import { getPrefab } from '../../store/prefabs';
import { derivePrefabId } from '../../data/Prefab';
import { PrefabThumbnail } from '../prefab-preview/PrefabThumbnail';

interface AssetCardProps {
  asset: AssetNode;
  isSelected: boolean;
  onClick: () => void;
  onDoubleClick: () => void;
  onContextMenu: (e: MouseEvent) => void;
}

/** 卡片固定尺寸（和 GridView 的 grid-template-columns 保持一致） */
const CARD_W = 72;
const THUMB_SIZE = 48;

export function AssetCard({
  asset,
  isSelected,
  onClick,
  onDoubleClick,
  onContextMenu,
}: AssetCardProps) {
  const icon = getAssetIcon(asset.type);

  // Prefab 特殊处理：尝试从 store 获取 Prefab 数据
  const prefab = asset.type === 'prefab' ? getPrefab(derivePrefabId(asset.path)) : null;
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
        padding: '4px',
        width: `${CARD_W}px`,
        borderRadius: '6px',
        cursor: 'pointer',
        transition: 'all 0.15s',
        background: isSelected ? 'rgba(74, 144, 217, 0.12)' : '#2a2a2a',
        border: isSelected ? '2px solid #4a90d9' : '2px solid transparent',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          (e.currentTarget as HTMLDivElement).style.background = '#353535';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          (e.currentTarget as HTMLDivElement).style.background = '#2a2a2a';
        }
      }}
    >
      {/* 缩略图区域 — Blender 风格：占满卡片上部 */}
      <div
        style={{
          width: `${THUMB_SIZE}px`,
          height: `${THUMB_SIZE}px`,
          background: '#222',
          borderRadius: '4px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          border: '1px solid #333',
        }}
      >
        {asset.type === 'prefab' && prefab && hasSprite ? (
          <PrefabThumbnail prefab={prefab} size={THUMB_SIZE} />
        ) : (
          <span style={{ fontSize: '22px', opacity: 0.7 }}>{icon}</span>
        )}
      </div>

      {/* 底部信息区 */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '2px',
          width: '100%',
        }}
      >
        {/* 资源名称 */}
        <span
          style={{
            fontSize: '10px',
            color: isSelected ? '#8ec4ff' : '#bbb',
            textAlign: 'center',
            width: '100%',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            fontWeight: isSelected ? 600 : 400,
            lineHeight: 1.3,
          }}
          title={displayName}
        >
          {displayName}
        </span>

        {/* 类型标签 */}
        <span
          style={{
            fontSize: '9px',
            color: '#666',
            textTransform: 'uppercase',
            letterSpacing: '0.3px',
            lineHeight: 1,
          }}
        >
          {getAssetTypeLabel(asset.type)}
        </span>
      </div>
    </div>
  );
}
