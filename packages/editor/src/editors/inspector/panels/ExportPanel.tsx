import { useRef } from "preact/hooks";
import { currentMap, tilesets, tilesetImages, importTileMapFromFile } from "../../../store/project";
import { exportStandalone, exportBundle } from "../../../data/export";
import { PanelShell } from "./PanelShell";

export function ExportPanel() {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleExportStandalone = () => {
    exportStandalone(currentMap.value, tilesets.value);
  };

  const handleExportBundle = () => {
    exportBundle(currentMap.value, tilesets.value, tilesetImages.value);
  };

  const handleImport = () => {
    fileRef.current?.click();
  };

  const handleFile = async (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      await importTileMapFromFile(file);
    } catch (err) {
      console.error("Import failed:", err);
      alert("导入失败: " + (err as Error).message);
    }
    (e.target as HTMLInputElement).value = "";
  };

  return (
    <PanelShell title="导入/导出">
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <div style={{ color: "var(--text-secondary)", fontSize: 10, marginBottom: 2 }}>
          导出为 .mote.json (引用外部 TileSet) 或 .mote-bundle.json (自包含)
        </div>

        <div style={{ display: "flex", gap: 4 }}>
          <button onClick={handleExportStandalone} style={{ flex: 1, fontSize: 10 }}>
            导出 (引用)
          </button>
          <button onClick={handleExportBundle} style={{ flex: 1, fontSize: 10 }}>
            导出 (打包)
          </button>
        </div>

        <div style={{
          borderTop: "1px solid var(--border)",
          paddingTop: 6,
          marginTop: 4,
        }}>
          <div style={{ color: "var(--text-secondary)", fontSize: 10, marginBottom: 4 }}>
            导入 .mote.json 或 .mote-bundle.json 地图文件
          </div>
          <button onClick={handleImport} style={{ width: "100%", fontSize: 10 }}>
            导入地图
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept=".json"
          style={{ display: "none" }}
          onChange={handleFile}
        />
      </div>
    </PanelShell>
  );
}
