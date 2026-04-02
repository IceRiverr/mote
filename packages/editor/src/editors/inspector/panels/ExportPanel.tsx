import { currentMap, tilesets } from "../../../store/project";
import { exportTileMap, downloadJson } from "../../../data/export";
import { PanelShell } from "./PanelShell";

export function ExportPanel() {
  const handleExport = () => {
    const map = currentMap.value;
    const tsMap = new Map(tilesets.value.map((t) => [t.id, t]));
    const data = exportTileMap(map, tsMap);
    downloadJson(data);
  };

  return (
    <PanelShell title="导出">
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ color: "var(--text-secondary)", fontSize: 11 }}>
          导出为 .weichen.json 格式，可直接用于游戏引擎加载
        </div>
        <button onClick={handleExport} style={{ width: "100%" }}>
          导出地图数据
        </button>
      </div>
    </PanelShell>
  );
}
