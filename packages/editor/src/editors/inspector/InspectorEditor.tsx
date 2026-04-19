import { registerEditor } from "../registry";
import { EntityInspector } from "../../components/inspector/EntityInspector";
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
      {/* Brush Palette - 唯一的 Prefab 选择和笔刷配置入口 */}
      <div style={{
        borderBottom: "1px solid var(--border)",
        flexShrink: 0,
      }}>
        <BrushPalette />
      </div>
      
      {/* Entity Inspector - 只在选中实体时显示属性 */}
      <div style={{ flex: 1, minHeight: 0 }}>
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
