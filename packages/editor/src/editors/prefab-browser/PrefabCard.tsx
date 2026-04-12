// ═══════════════════════════════════════════════════════════════
// PrefabCard.tsx - Prefab 卡片组件
// ═══════════════════════════════════════════════════════════════

import type { Prefab } from "../../data/Prefab";
import { getPrefabThumbnail } from "../../data/Prefab";

interface PrefabCardProps {
  prefab: Prefab;
  onClick?: () => void;
  onDoubleClick?: () => void;
  onContextMenu?: (e: MouseEvent) => void;
}

export function PrefabCard({
  prefab,
  onClick,
  onDoubleClick,
  onContextMenu,
}: PrefabCardProps) {
  const thumbnail = getPrefabThumbnail(prefab);
  const hasSprite = prefab.components.Sprite;

  return (
    <div
      onClick={onClick}
      onDblClick={onDoubleClick}
      onContextMenu={onContextMenu}
      draggable
      onDragStart={(e) => {
        // 设置拖拽数据
        e.dataTransfer?.setData("application/mote-prefab", prefab.id);
        e.dataTransfer!.effectAllowed = "copy";
      }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "4px",
        padding: "8px",
        borderRadius: "4px",
        cursor: "grab",
        transition: "background 0.15s",
        minWidth: "64px",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "#3a3a3a";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = "transparent";
      }}
    >
      {/* 缩略图区域 */}
      <div
        style={{
          width: "48px",
          height: "48px",
          background: "#2a2a2a",
          borderRadius: "4px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          border: "1px solid #444",
        }}
      >
        {thumbnail?.startsWith("sprite:") ? (
          // Sprite 缩略图 - 实际项目中需要从 Atlas 加载
          <div
            style={{
              width: "100%",
              height: "100%",
              background: "#3a3a3a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "20px",
            }}
          >
            🖼️
          </div>
        ) : (
          // 默认图标
          <span style={{ fontSize: "24px", opacity: 0.5 }}>
            {hasSprite ? "🎨" : "📦"}
          </span>
        )}
      </div>

      {/* 名称 */}
      <span
        style={{
          fontSize: "11px",
          color: "#ccc",
          textAlign: "center",
          maxWidth: "60px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={prefab.name}
      >
        {prefab.name}
      </span>
    </div>
  );
}
