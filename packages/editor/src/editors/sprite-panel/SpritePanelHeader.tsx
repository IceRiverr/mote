import {
  spriteAtlases,
  activeAtlasId,
  activeFrameId,
  activeAtlas,
  activeFrame,
} from "../../store/atlas";
import { spriteFilterText } from "./SpritePanelCanvas";

export function SpritePanelHeader() {
  const atlas = activeAtlas.value;
  const frame = activeFrame.value;
  const atlases = spriteAtlases.value;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        borderBottom: "1px solid #333",
        background: "#2a2a2a",
        flexShrink: 0,
      }}
    >
      {/* Top row: atlas selector + frame count */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "4px 8px",
          height: 28,
        }}
      >
        <select
          value={activeAtlasId.value ?? ""}
          onChange={(e) => {
            const v = (e.target as HTMLSelectElement).value;
            activeAtlasId.value = v || null;
            activeFrameId.value = null;
          }}
          style={{
            flex: 1,
            height: 22,
            background: "#1e1e1e",
            color: "#ccc",
            border: "1px solid #444",
            borderRadius: 3,
            fontSize: 11,
            paddingLeft: 4,
          }}
        >
          {atlases.length === 0 && (
            <option value="">（无图集）</option>
          )}
          {atlases.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({a.frames.length} 帧)
            </option>
          ))}
        </select>

        {atlas && (
          <span
            style={{
              fontSize: 10,
              color: "#777",
              whiteSpace: "nowrap",
            }}
          >
            {atlas.imageWidth}×{atlas.imageHeight}
          </span>
        )}
      </div>

      {/* Second row: search input + selected frame info */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "2px 8px 4px",
          height: 26,
        }}
      >
        <input
          type="text"
          placeholder="搜索帧名…"
          value={spriteFilterText.value}
          onInput={(e) => {
            spriteFilterText.value = (e.target as HTMLInputElement).value;
          }}
          style={{
            flex: 1,
            height: 20,
            background: "#1e1e1e",
            color: "#ccc",
            border: "1px solid #444",
            borderRadius: 3,
            fontSize: 11,
            paddingLeft: 6,
          }}
        />
        {frame && (
          <span
            style={{
              fontSize: 10,
              color: "#aaa",
              whiteSpace: "nowrap",
              maxWidth: 140,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={`${frame.name} (${frame.width}×${frame.height})`}
          >
            {frame.name} {frame.width}×{frame.height}
          </span>
        )}
      </div>
    </div>
  );
}
