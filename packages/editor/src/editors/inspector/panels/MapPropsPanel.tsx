import { currentMap, bumpMapVersion } from "../../../store/project";
import { executeCommand } from "../../../store/history";
import { SetMapNameCommand, ResizeMapCommand } from "../../../commands/map-props";
import { PanelShell } from "./PanelShell";

export function MapPropsPanel() {
  const map = currentMap.value;

  return (
    <PanelShell title="地图属性">
      <Row label="名称">
        <input
          type="text"
          value={map.name}
          onChange={(e) => {
            const name = (e.target as HTMLInputElement).value;
            executeCommand(new SetMapNameCommand(name));
          }}
          style={{ width: "100%" }}
        />
      </Row>
      <Row label="尺寸">
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <input
            type="number"
            value={map.width}
            min={1}
            max={500}
            style={{ width: 50 }}
            onChange={(e) => {
              const w = parseInt((e.target as HTMLInputElement).value) || 1;
              if (w !== map.width) {
                executeCommand(new ResizeMapCommand(w, map.height));
              }
            }}
          />
          <span>×</span>
          <input
            type="number"
            value={map.height}
            min={1}
            max={500}
            style={{ width: 50 }}
            onChange={(e) => {
              const h = parseInt((e.target as HTMLInputElement).value) || 1;
              if (h !== map.height) {
                executeCommand(new ResizeMapCommand(map.width, h));
              }
            }}
          />
          <span style={{ color: "var(--text-secondary)" }}>瓦片</span>
        </div>
      </Row>
      <Row label="瓦片大小">
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <input
            type="number"
            value={map.tileWidth}
            min={1}
            max={256}
            style={{ width: 50 }}
            onChange={(e) => {
              currentMap.value = {
                ...map,
                tileWidth:
                  parseInt((e.target as HTMLInputElement).value) || 16,
              };
              bumpMapVersion();
            }}
          />
          <span>×</span>
          <input
            type="number"
            value={map.tileHeight}
            min={1}
            max={256}
            style={{ width: 50 }}
            onChange={(e) => {
              currentMap.value = {
                ...map,
                tileHeight:
                  parseInt((e.target as HTMLInputElement).value) || 16,
              };
              bumpMapVersion();
            }}
          />
          <span style={{ color: "var(--text-secondary)" }}>px</span>
        </div>
      </Row>
    </PanelShell>
  );
}

function Row({ label, children }: { label: string; children: any }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        marginBottom: 4,
        gap: 8,
      }}
    >
      <span
        style={{
          width: 56,
          flexShrink: 0,
          color: "var(--text-secondary)",
          fontSize: 11,
        }}
      >
        {label}
      </span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}
