import { useRef } from "preact/hooks";
import {
  tilesets,
  tilesetImages,
  currentMap,
  bumpMapVersion,
  lastImportedTilesetId,
  importTileSetFromFiles,
} from "../../store/project";
import { activeTilesetId, displayScale } from "../../store/selection";
import { createTileSet } from "../../data/TileSet";
import { popoverOpen } from "./TileSetPopover";

let tsUid = 0;

export function PaletteHeader() {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleImport = () => {
    fileRef.current?.click();
  };

  const handleFile = (e: Event) => {
    const files = Array.from((e.target as HTMLInputElement).files ?? []);
    if (files.length === 0) return;

    // Check if it's a JSON tileset import
    const jsonFile = files.find((f) => f.name.endsWith(".json"));
    const imageFile = files.find((f) => !f.name.endsWith(".json"));

    if (jsonFile && imageFile) {
      // Import from .mote-tileset.json + image
      importTileSetFromFiles(jsonFile, imageFile).catch(console.error);
      (e.target as HTMLInputElement).value = "";
      return;
    }

    // Regular image import
    const file = files[0];
    if (!file || !file.type.startsWith("image/")) return;

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const name = file.name.replace(/\.[^.]+$/, "");
      const id = `ts_${++tsUid}`;

      const ts = createTileSet(id, name, url, img.width, img.height, 16, 16, 0, 0);
      tilesets.value = [...tilesets.value, ts];

      const newImages = new Map(tilesetImages.value);
      newImages.set(id, img);
      tilesetImages.value = newImages;

      activeTilesetId.value = id;

      // Auto-add to current map
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

      // Update display scale based on tile size
      displayScale.value = Math.max(1, Math.round(32 / ts.tileWidth));

      // Trigger Redo Panel
      lastImportedTilesetId.value = id;
    };
    img.src = url;
    (e.target as HTMLInputElement).value = "";
  };

  const hasActiveTileset = activeTilesetId.value !== null;

  return (
    <div
      style={{
        height: 32,
        background: "var(--bg-header)",
        borderBottom: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        padding: "0 8px",
        gap: 6,
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

      {/* Settings popover toggle */}
      {hasActiveTileset && (
        <button
          onClick={() => { popoverOpen.value = !popoverOpen.value; }}
          title="瓦片集属性"
          style={{
            background: popoverOpen.value ? "var(--accent)" : "transparent",
            border: "none",
            borderRadius: 3,
            padding: "2px 5px",
            cursor: "pointer",
            fontSize: 13,
            lineHeight: 1,
          }}
        >⚙</button>
      )}

      <button onClick={handleImport}>导入</button>
      <input
        ref={fileRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp,.json"
        multiple
        style={{ display: "none" }}
        onChange={handleFile}
      />
    </div>
  );
}
