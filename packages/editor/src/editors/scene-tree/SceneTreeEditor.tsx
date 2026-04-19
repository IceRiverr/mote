// ═══════════════════════════════════════════════════════════════
// SceneTreeEditor.tsx — 场景实体层级树
// ═══════════════════════════════════════════════════════════════

import { registerEditor } from "../registry";
import {
  currentScene,
  sceneVersion,
  selectedEntityIds,
  selectEntity,
  toggleEntitySelection,
  clearSelection,
} from "../../store/scene";
import { getPrefab } from "../../store/prefabs";

function SceneTreeEditor({ areaId }: { areaId: string }) {
  // 订阅 sceneVersion，确保 entities 变化时重渲染
  const _version = sceneVersion.value;
  const scene = currentScene.value;

  if (!scene || scene.entities.length === 0) {
    return (
      <div style={{
        height: "100%",
        padding: "20px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "#666",
        fontSize: 13,
      }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🌳</div>
        <div>Scene Tree</div>
        <div style={{ fontSize: 11, marginTop: 8, opacity: 0.6 }}>
          {scene ? "场景中暂无实体" : "未加载场景"}
        </div>
      </div>
    );
  }

  return (
    <div style={{
      height: "100%",
      overflow: "auto",
      fontSize: 12,
      padding: "4px 0",
    }}>
      {scene.entities.map((entity) => {
        const isSelected = selectedEntityIds.value.has(entity.id);
        const prefab = getPrefab(entity.prefab);
        const icon = prefab?.tags?.[0] ? getTagIcon(prefab.tags[0]) : "📦";

        return (
          <div
            key={entity.id}
            onClick={(e: MouseEvent) => {
              if (e.ctrlKey || e.metaKey) {
                toggleEntitySelection(entity.id);
              } else {
                selectEntity(entity.id);
              }
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 12px",
              cursor: "pointer",
              background: isSelected ? "var(--accent)" : "transparent",
              color: isSelected ? "#fff" : "var(--text)",
              borderLeft: isSelected ? "2px solid #4a90d9" : "2px solid transparent",
              userSelect: "none",
            }}
            onMouseEnter={(e: MouseEvent) => {
              if (!isSelected) {
                (e.currentTarget as HTMLElement).style.background = "var(--hover)";
              }
            }}
            onMouseLeave={(e: MouseEvent) => {
              if (!isSelected) {
                (e.currentTarget as HTMLElement).style.background = "transparent";
              }
            }}
          >
            <span style={{ fontSize: 14, opacity: 0.8 }}>{icon}</span>
            <span style={{
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}>
              {entity.name}
            </span>
            <span style={{
              fontSize: 10,
              opacity: 0.5,
              fontFamily: "monospace",
              flexShrink: 0,
            }}>
              {Math.round(entity.transform.x)}, {Math.round(entity.transform.y)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function getTagIcon(tag: string): string {
  const icons: Record<string, string> = {
    environment: "🌲",
    walls: "🧱",
    characters: "🧙",
    items: "🗡️",
    system: "⚙️",
  };
  return icons[tag] || "📦";
}

registerEditor({
  id: "scene-tree",
  name: "Scene Tree",
  icon: "🌳",
  component: SceneTreeEditor,
});

export { SceneTreeEditor };
