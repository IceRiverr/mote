import { registerEditor } from "../registry";
import { MapPropsPanel } from "./panels/MapPropsPanel";
import { LayersPanel } from "./panels/LayersPanel";
import { ExportPanel } from "./panels/ExportPanel";

function InspectorEditor({ areaId }: { areaId: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          height: 32,
          background: "var(--bg-header)",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          padding: "0 8px",
          flexShrink: 0,
        }}
      >
        <span style={{ color: "var(--text-secondary)" }}>属性</span>
      </div>
      <div style={{ flex: 1, overflow: "auto", padding: 0 }}>
        <MapPropsPanel />
        <LayersPanel />
        <ExportPanel />
      </div>
    </div>
  );
}

registerEditor({
  id: "inspector",
  name: "属性",
  icon: "⚙️",
  component: InspectorEditor,
});

export { InspectorEditor };
