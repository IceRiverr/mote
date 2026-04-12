// ═══════════════════════════════════════════════════════════════
// SceneTreeEditor.tsx — PLACEHOLDER for new architecture
// 
// Original SceneTreeEditor has been disabled during migration.
// This will be replaced with Entity-based scene tree view.
// ═══════════════════════════════════════════════════════════════

import { registerEditor } from "../registry";

function SceneTreeEditor({ areaId }: { areaId: string }) {
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
        Rebuilding for Entity-based architecture
      </div>
    </div>
  );
}

registerEditor({
  id: "scene-tree",
  name: "Scene Tree",
  icon: "🌳",
  component: SceneTreeEditor,
});

export { SceneTreeEditor };