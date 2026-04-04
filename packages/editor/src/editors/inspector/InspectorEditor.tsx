import { registerEditor } from "../registry";
import { MapPropsPanel } from "./panels/MapPropsPanel";
import { LayersPanel } from "./panels/LayersPanel";
import { ExportPanel } from "./panels/ExportPanel";
import { EntityPanel } from "./panels/EntityPanel";

function InspectorEditor({ areaId }: { areaId: string }) {
  return (
    <div style={{ height: "100%", overflow: "auto" }}>
      <MapPropsPanel />
      <LayersPanel />
      <EntityPanel />
      <ExportPanel />
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
