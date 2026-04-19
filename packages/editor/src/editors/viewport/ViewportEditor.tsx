import { registerEditor } from "../registry";
import { ViewportHeader } from "./ViewportHeader";
import { ViewportCanvas } from "./ViewportCanvas";
import { ViewportTPanel } from "./ViewportTPanel";

function ViewportEditor({ areaId }: { areaId: string }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
    >
      <div style={{ flex: 1, overflow: "hidden", position: "relative" }}>
        <ViewportTPanel />
        <ViewportCanvas />
      </div>
    </div>
  );
}

registerEditor({
  id: "viewport",
  name: "视口",
  icon: "🗺",
  component: ViewportEditor,
  header: ViewportHeader,
});

export { ViewportEditor };
