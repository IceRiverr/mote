import { useRef, useEffect, useCallback } from "preact/hooks";
import { registerEditor } from "../registry";
import { ViewportCanvas } from "./ViewportCanvas";
import { ViewportHeader } from "./ViewportHeader";
import { ViewportFooter } from "./ViewportFooter";

function ViewportEditor({ areaId }: { areaId: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <ViewportHeader />
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <ViewportCanvas />
      </div>
      <ViewportFooter />
    </div>
  );
}

registerEditor({
  id: "viewport",
  name: "地图视口",
  icon: "🗺",
  component: ViewportEditor,
});

export { ViewportEditor };
