import { useRef } from "preact/hooks";
import {
  tilesets,
  tilesetImages,
  currentMap,
  bumpMapVersion,
  lastImportedTilesetId,
} from "../../store/project";
import { activeTilesetId } from "../../store/selection";
import { createTileSet } from "../../data/TileSet";

let tsUid = 0;

export function PaletteHeader() {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = () => {
    fileRef.current?.click();
  };

  const handleFile = (e: Event) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const name = file.name.replace(/\.[^.]+$/, "");
      const id = `ts_${++tsUid}`;

      // Import with defaults — user refines via Redo Panel / Inspector
      const ts = createTileSet(id, name, url, img.width, img.height, 16, 16, 0, 0);
      tilesets.value = [...tilesets.value, ts];

      const newImages = new Map(tilesetImages.value);
      newImages.set(id, img);
      tilesetImages.value = newImages;

      activeTilesetId.value = id;

      // Auto-add to current map's tileset refs
      const map = currentMap.value;
      const maxGid = map.tilesets.reduce((max, ref) => {
        const t = tilesets.value.find((t) => t.id === ref.tilesetId);
        return Math.max(max, ref.firstGid + (t?.tileCount ?? 0));
      }, 1);
      currentMap.value = {
        ...map,
        tilesets: [...map.tilesets, { tilesetId: id, firstGid: maxGid }],
      };
      bumpMapVersion();

      // Trigger Redo Panel
      lastImportedTilesetId.value = id;
    };
    img.src = url;
    (e.target as HTMLInputElement).value = "";
  };

  return (
    <div
      style={{
        height: 32,
        background: "var(--bg-header)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        padding: "0 8px",
        gap: 8,
        flexShrink: 0,
      }}
    >
      <select
        value={activeTilesetId.value ?? ""}
        onChange={(e) => {
          activeTilesetId.value = (e.target as HTMLSelectElement).value || null;
        }}
        style={{ flex: 1, minWidth: 0 }}
      >
        {tilesets.value.length === 0 && <option value="">（无瓦片集）</option>}
        {tilesets.value.map((ts) => (
          <option key={ts.id} value={ts.id}>
            {ts.name} ({ts.columns}×{ts.rows})
          </option>
        ))}
      </select>
      <button onClick={handleImport}>导入</button>
      <input
        ref={fileRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp"
        style={{ display: "none" }}
        onChange={handleFile}
      />
    </div>
  );
}
