import { currentMap, bumpMapVersion } from "../../../store/project";
import { PanelShell } from "./PanelShell";

export function MapPropsPanel() {
  const map = currentMap.value;

  const set = (key: string, value: any) => {
    currentMap.value = { ...map, [key]: value };
    bumpMapVersion();
  };

  return (
    <PanelShell title="地图属性">
      <Row label="名称">
        <input
          type="text"
          value={map.name}
          onInput={(e) => set("name", (e.target as HTMLInputElement).value)}
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
              const newMap = { ...map, width: w };
              newMap.layers = newMap.layers.map((l) => {
                const newData = new Array(w * map.height).fill(0);
                for (let y = 0; y < map.height; y++) {
                  for (let x = 0; x < Math.min(w, map.width); x++) {
                    newData[y * w + x] = l.data[y * map.width + x] ?? 0;
                  }
                }
                return { ...l, data: newData };
              });
              currentMap.value = newMap;
              bumpMapVersion();
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
              const newMap = { ...map, height: h };
              newMap.layers = newMap.layers.map((l) => {
                const newData = new Array(map.width * h).fill(0);
                for (let y = 0; y < Math.min(h, map.height); y++) {
                  for (let x = 0; x < map.width; x++) {
                    newData[y * map.width + x] = l.data[y * map.width + x] ?? 0;
                  }
                }
                return { ...l, data: newData };
              });
              currentMap.value = newMap;
              bumpMapVersion();
            }}
          />
          <span style={{ color: "var(--text-secondary)" }}>瓦片</span>
        </div>
      </Row>
      <Row label="瓦片大小">
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          <input type="number" value={map.tileWidth} min={1} max={256} style={{ width: 50 }}
            onChange={(e) => set("tileWidth", parseInt((e.target as HTMLInputElement).value) || 16)} />
          <span>×</span>
          <input type="number" value={map.tileHeight} min={1} max={256} style={{ width: 50 }}
            onChange={(e) => set("tileHeight", parseInt((e.target as HTMLInputElement).value) || 16)} />
          <span style={{ color: "var(--text-secondary)" }}>px</span>
        </div>
      </Row>
    </PanelShell>
  );
}

function Row({ label, children }: { label: string; children: any }) {
  return (
    <div style={{ display: "flex", alignItems: "center", marginBottom: 4, gap: 8 }}>
      <span style={{ width: 56, flexShrink: 0, color: "var(--text-secondary)", fontSize: 11 }}>
        {label}
      </span>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  );
}
