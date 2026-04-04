import { registerEditor } from "../registry";
import { SpritePanelHeader } from "./SpritePanelHeader";
import { SpritePanelCanvas } from "./SpritePanelCanvas";
import { activeAtlasId, activeFrameId } from "../../store/atlas";
import { activeTool, activeEntityDefId } from "../../store/selection";
import { BUILTIN_ENTITY_DEFS } from "../../data/TileMap";
import type { SpriteFrame } from "../../data/SpriteAtlas";

function SpritePanelEditor({ areaId }: { areaId: string }) {
  const handleFrameSelect = (frame: SpriteFrame) => {
    // When a frame is selected, auto-activate the entity tool
    // and pick a sprite-bound entity def if available
    const atlasId = activeAtlasId.value;
    if (!atlasId) return;

    // Find an EntityDef that's bound to this atlas, or use the first sprite-capable one
    const defWithAtlas = BUILTIN_ENTITY_DEFS.find(
      (d) => d.spriteAtlasId === atlasId
    );
    if (defWithAtlas) {
      activeEntityDefId.value = defWithAtlas.id;
      activeTool.value = "entity";
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        position: "relative",
      }}
    >
      <SpritePanelHeader />
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <SpritePanelCanvas onFrameSelect={handleFrameSelect} />
      </div>
      <SpritePanelFooter />
    </div>
  );
}

/** Status bar showing selected frame details */
function SpritePanelFooter() {
  const frameId = activeFrameId.value;
  if (!frameId) return null;

  return (
    <div
      style={{
        height: 22,
        borderTop: "1px solid #333",
        background: "#252525",
        display: "flex",
        alignItems: "center",
        padding: "0 8px",
        fontSize: 10,
        color: "#888",
        flexShrink: 0,
        gap: 8,
      }}
    >
      <span>已选: <span style={{ color: "#aaa" }}>{frameId}</span></span>
    </div>
  );
}

registerEditor({
  id: "sprite-panel",
  name: "Sprite 面板",
  icon: "🖼",
  component: SpritePanelEditor,
});

export { SpritePanelEditor };
