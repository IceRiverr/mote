import { registerEditor } from "../registry";
import { EntityInspector } from "../../components/inspector/EntityInspector";

function InspectorEditor({ areaId }: { areaId: string }) {
  return (
    <div style={{ height: "100%", overflow: "auto", background: "#1e1e1e" }}>
      <EntityInspector />
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
