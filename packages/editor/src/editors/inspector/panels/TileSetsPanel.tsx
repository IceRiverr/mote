import { tilesets } from "../../../store/project";
import { activeTilesetId } from "../../../store/selection";
import { PanelShell } from "./PanelShell";

export function TileSetsPanel() {
  return (
    <PanelShell title="瓦片集">
      {tilesets.value.length === 0 ? (
        <div style={{ color: "var(--text-secondary)", fontSize: 11, padding: "4px 0" }}>
          在左侧瓦片面板中点击「导入」添加瓦片集
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {tilesets.value.map((ts) => (
            <div
              key={ts.id}
              onClick={() => { activeTilesetId.value = ts.id; }}
              style={{
                display: "flex",
                alignItems: "center",
                height: 24,
                padding: "0 6px",
                borderRadius: 3,
                cursor: "pointer",
                background:
                  activeTilesetId.value === ts.id
                    ? "var(--selection)"
                    : "transparent",
                fontSize: 11,
              }}
            >
              <span style={{ flex: 1 }}>{ts.name}</span>
              <span style={{ color: "var(--text-secondary)" }}>
                {ts.tileWidth}×{ts.tileHeight} ({ts.tileCount})
              </span>
            </div>
          ))}
        </div>
      )}
    </PanelShell>
  );
}
