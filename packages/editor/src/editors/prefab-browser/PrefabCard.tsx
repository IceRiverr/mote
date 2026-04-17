// ═══════════════════════════════════════════════════════════════
// PrefabCard.tsx - Prefab 卡片组件（支持点击设为笔刷）
// ═══════════════════════════════════════════════════════════════

import type { Prefab } from "../../data/Prefab";
import { getPrefabThumbnail } from "../../data/Prefab";
import { activeTool } from "../../store/selection";
import { setSinglePrefabBrush, activePrefabPath } from "../../store/brush";

interface PrefabCardProps {
  path: string;
  prefab: Prefab;
  isActive?: boolean;
  onDoubleClick?: () => void;
  onContextMenu?: (e: MouseEvent) => void;
}

export function PrefabCard({
  path,
  prefab,
  isActive = false,
  onDoubleClick,
  onContextMenu,
}: PrefabCardProps) {
  const thumbnail = getPrefabThumbnail(prefab);
  const hasSprite = prefab.components.Sprite;

  const handleClick = () => {
    // 设为当前笔刷
    setSinglePrefabBrush(path);
    // 自动切换到笔刷工具
    if (activeTool.value !== "brush") {
      activeTool.value = "brush";
    }
  };

  return (
    <div
      onClick={handleClick}
      onDblClick={onDoubleClick}
      onContextMenu={onContextMenu}
      draggable
      onDragStart={(e) => {
        // 设置拖拽数据
        e.dataTransfer?.setData("application/mote-prefab", path);
        e.dataTransfer!.effectAllowed = "copy";
      }}
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "4px",
        padding: "8px",
        borderRadius: "4px",
        cursor: "pointer",
        transition: "all 0.15s",
        minWidth: "64px",
        background: isActive ? "rgba(74, 144, 217, 0.2)" : "transparent",
        border: isActive ? "2px solid #4a90d9" : "2px solid transparent",
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLDivElement).style.background = "#3a3a3a";
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLDivElement).style.background = "transparent";
        }
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
          border: isActive ? "2px solid #4a90d9" : "1px solid #444",
          boxShadow: isActive ? "0 0 8px rgba(74, 144, 217, 0.5)" : "none",
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
          <span style={{ fontSize: "24px", opacity: isActive ? 1 : 0.5 }}>
            {hasSprite ? "🎨" : "📦"}
          </span>
        )}
      </div>

      {/* 名称 */}
      <span
        style={{
          fontSize: "11px",
          color: isActive ? "#4a90d9" : "#ccc",
          textAlign: "center",
          maxWidth: "60px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontWeight: isActive ? 600 : 400,
        }}
        title={prefab.name}
      >
        {prefab.name}
      </span>

      {/* 选中标记 */}
      {isActive && (
        <div
          style={{
            position: "absolute",
            top: "4px",
            right: "4px",
            width: "12px",
            height: "12px",
            background: "#4a90d9",
            borderRadius: "50%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "8px",
            color: "#fff",
          }}
        >
          ✓
        </div>
      )}
    </div>
  );
}
