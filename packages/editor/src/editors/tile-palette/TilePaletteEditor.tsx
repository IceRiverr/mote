import { registerEditor } from "../registry";
import { PaletteHeader } from "./PaletteHeader";
import { PaletteCanvas } from "./PaletteCanvas";
import { RedoPanel } from "./RedoPanel";

function TilePaletteEditor({ areaId }: { areaId: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <PaletteHeader />
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <PaletteCanvas />
        <RedoPanel />
      </div>
    </div>
  );
}

registerEditor({
  id: "tile_palette",
  name: "瓦片面板",
  icon: "🎨",
  component: TilePaletteEditor,
});

export { TilePaletteEditor };
