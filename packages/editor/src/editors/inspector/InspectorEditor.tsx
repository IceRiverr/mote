import { registerEditor } from "../registry";
import { EntityInspector } from "../../components/inspector/EntityInspector";
import { LayerPanel } from "./panels/LayerPanel";
import { BrushPalette } from "./panels/BrushPalette";

function InspectorEditor({ areaId }: { areaId: string }) {
  return (
    <div style={{ 
      height: "100%", 
      overflow: "auto", 
      background: "var(--bg-panel)",
      display: "flex",
      flexDirection: "column",
    }}>
      {/* Brush Palette */}
      <div style={{
        borderBottom: "1px solid var(--border)",
      }}>
        <BrushPalette />
      </div>
      
      {/* Layer Panel */}
      <div style={{
        borderBottom: "1px solid var(--border)",
      }}>
        <LayerPanel />
      </div>
      
      {/* Entity Inspector */}
      <div style={{ flex: 1 }}>
        <EntityInspector />
      </div>
    </div>
  );
}

registerEditor({
  id: "inspector",
  name: "属性",
  icon: "⚙",
  component: InspectorEditor,
});

export { InspectorEditor };
