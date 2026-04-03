import { registerEditor } from "../registry";
import { PanelShell } from "./panels/PanelShell";
import { MapPropsPanel } from "./panels/MapPropsPanel";
import { LayersPanel } from "./panels/LayersPanel";
import { ExportPanel } from "./panels/ExportPanel";

function InspectorEditor({ areaId }: { areaId: string }) {
  return (
    <div style={{ height: "100%", overflow: "auto" }}>
      <PanelShell title="地图属性" defaultOpen>
        <MapPropsPanel />
      </PanelShell>
      <PanelShell title="图层" defaultOpen>
        <LayersPanel />
      </PanelShell>
      <PanelShell title="导入/导出" defaultOpen>
        <ExportPanel />
      </PanelShell>
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
