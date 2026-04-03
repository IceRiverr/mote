import {
  tilesets,
  updateTileSetParams,
  removeTileSet,
} from "../../../store/project";
import { activeTilesetId } from "../../../store/selection";
import { PanelShell } from "./PanelShell";

export function TileSetsPanel() {
  return (
    <PanelShell title="瓦片集">
      {tilesets.value.length === 0 ? (
        <div
          style={{
            color: "var(--text-secondary)",
            fontSize: 11,
            padding: "4px 0",
          }}
        >
          在左侧瓦片面板中点击「导入」添加瓦片集
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {tilesets.value.map((ts) => {
            const isActive = activeTilesetId.value === ts.id;

            return (
              <div
                key={ts.id}
                style={{
                  background: isActive ? "var(--selection)" : "var(--bg-base)",
                  borderRadius: 4,
                  padding: "6px 8px",
                  cursor: "pointer",
                }}
                onClick={() => {
                  activeTilesetId.value = ts.id;
                }}
              >
                {/* Name + delete */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    marginBottom: 6,
                  }}
                >
                  <input
                    type="text"
                    value={ts.name}
                    onInput={(e) =>
                      updateTileSetParams(ts.id, {
                        name: (e.target as HTMLInputElement).value,
                      })
                    }
                    onClick={(e) => e.stopPropagation()}
                    style={{ flex: 1, minWidth: 0, fontSize: 11 }}
                  />
                  <button
                    title="删除瓦片集"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTileSet(ts.id);
                    }}
                    style={{
                      border: "none",
                      background: "transparent",
                      color: "var(--danger)",
                      cursor: "pointer",
                      padding: "0 4px",
                      fontSize: 11,
                      marginLeft: 4,
                    }}
                  >
                    ✕
                  </button>
                </div>

                {/* Tile size */}
                <Row label="瓦片">
                  <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                    <input
                      type="number"
                      value={ts.tileWidth}
                      min={1}
                      max={512}
                      style={{ width: 42 }}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        updateTileSetParams(ts.id, {
                          tileWidth: Math.max(
                            1,
                            parseInt((e.target as HTMLInputElement).value) || 1
                          ),
                        })
                      }
                    />
                    <span style={{ color: "var(--text-secondary)" }}>×</span>
                    <input
                      type="number"
                      value={ts.tileHeight}
                      min={1}
                      max={512}
                      style={{ width: 42 }}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        updateTileSetParams(ts.id, {
                          tileHeight: Math.max(
                            1,
                            parseInt((e.target as HTMLInputElement).value) || 1
                          ),
                        })
                      }
                    />
                    <span style={{ color: "var(--text-secondary)", fontSize: 10 }}>px</span>
                  </div>
                </Row>

                {/* Margin */}
                <Row label="边距">
                  <input
                    type="number"
                    value={ts.margin}
                    min={0}
                    max={128}
                    style={{ width: 42 }}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) =>
                      updateTileSetParams(ts.id, {
                        margin: Math.max(
                          0,
                          parseInt((e.target as HTMLInputElement).value) || 0
                        ),
                      })
                    }
                  />
                </Row>

                {/* Spacing */}
                <Row label="间距">
                  <input
                    type="number"
                    value={ts.spacing}
                    min={0}
                    max={128}
                    style={{ width: 42 }}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) =>
                      updateTileSetParams(ts.id, {
                        spacing: Math.max(
                          0,
                          parseInt((e.target as HTMLInputElement).value) || 0
                        ),
                      })
                    }
                  />
                </Row>

                {/* Computed info */}
                <div
                  style={{
                    marginTop: 4,
                    color: "var(--text-secondary)",
                    fontSize: 10,
                  }}
                >
                  {ts.columns}×{ts.rows} = {ts.tileCount} 瓦片 ·
                  原图 {ts.imageWidth}×{ts.imageHeight}px
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PanelShell>
  );
}

function Row({ label, children }: { label: string; children: any }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        marginBottom: 3,
        gap: 6,
      }}
    >
      <span
        style={{
          width: 30,
          flexShrink: 0,
          color: "var(--text-secondary)",
          fontSize: 10,
          textAlign: "right",
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}
