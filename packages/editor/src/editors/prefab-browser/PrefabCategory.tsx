// ═══════════════════════════════════════════════════════════════
// PrefabCategory.tsx - Prefab 分类折叠组件
// ═══════════════════════════════════════════════════════════════

import { useState } from "preact/hooks";
import type { Prefab } from "../../data/Prefab";
import { PrefabCard } from "./PrefabCard";
import { spawnPrefab } from "../../store/scene";
import { activePrefabPath } from "../../store/brush";

interface PrefabCategoryProps {
  name: string;
  entries: Array<{ path: string; prefab: Prefab }>;
  defaultExpanded?: boolean;
}

export function PrefabCategory({
  name,
  entries,
  defaultExpanded = true,
}: PrefabCategoryProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (entries.length === 0) return null;

  return (
    <div style={{ borderBottom: "1px solid #333" }}>
      {/* 分类标题 */}
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          padding: "8px 12px",
          cursor: "pointer",
          userSelect: "none",
          fontSize: "12px",
          fontWeight: 600,
          color: "#999",
          textTransform: "uppercase",
          letterSpacing: "0.5px",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.background = "#2a2a2a";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLDivElement).style.background = "transparent";
        }}
      >
        <span
          style={{
            transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            transition: "transform 0.15s",
            fontSize: "10px",
          }}
        >
          ▶
        </span>
        <span style={{ flex: 1 }}>{name}</span>
        <span
          style={{
            fontSize: "11px",
            color: "#666",
            fontWeight: "normal",
          }}
        >
          {entries.length}
        </span>
      </div>

      {/* Prefab 网格 */}
      {expanded && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(64px, 1fr))",
            gap: "4px",
            padding: "8px",
          }}
        >
          {entries.map(({ path, prefab }) => (
            <PrefabCard
              key={path}
              path={path}
              prefab={prefab}
              isActive={activePrefabPath.value === path}
              onDoubleClick={() => {
                // 双击在场景中心创建
                spawnPrefab(path, 320, 240);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                // TODO: 显示右键菜单
                console.log("Context menu for", path);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
