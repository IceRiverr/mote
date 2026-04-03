import { useRef } from "preact/hooks";
import {
  tilesets,
  tilesetImages,
  currentMap,
  bumpMapVersion,
  lastImportedTilesetId,
  importTileSetFromFiles,
} from "../../store/project";
import {
  activeTilesetId,
  displayScale,
  displayScaleLocked,
  DISPLAY_SCALE_STEPS,
  formatDisplayScale,
} from "../../store/selection";
import { createTileSet } from "../../data/TileSet";
import { popoverOpen } from "./TileSetPopover";

let tsUid = 0;

export function PaletteHeader() {
  const fileRef = useRef<HTMLInputElement>(null);
  const ts = activeTilesetId.value
    ? tilesets.value.find((t) => t.id === activeTilesetId.value) ?? null
    : null;

  const handleImport = () => {
    fileRef.current?.click();
  };

  const handleFile = (e: Event) => {
    const files = Array.from((e.target as HTMLInputElement).files ?? []);
    if (files.length === 0) return;

    const jsonFile = files.find((f) => f.name.endsWith(".json"));
    const imageFile = files.find((f) => !f.name.endsWith(".json"));

    if (jsonFile && imageFile) {
      importTileSetFromFiles(jsonFile, imageFile).catch(console.error);
      (e.target as HTMLInputElement).value = "";
      return;
    }

    const file = files[0];
    if (!file || !file.type.startsWith("image/")) return;

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const name = file.name.replace(/\.[^.]+$/, "");
      const id = `ts_${++tsUid}`;

      const tsNew = createTileSet(id, name, url, img.width, img.height, 16, 16, 0, 0);
      tilesets.value = [...tilesets.value, tsNew];

      const newImages = new Map(tilesetImages.value);
      newImages.set(id, img);
      tilesetImages.value = newImages;

      activeTilesetId.value = id;

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

      if (!displayScaleLocked.value) {
        displayScale.value = Math.max(1, Math.round(32 / tsNew.tileWidth));
      }

      lastImportedTilesetId.value = id;
    };
    img.src = url;
    (e.target as HTMLInputElement).value = "";
  };

  const hasActiveTileset = activeTilesetId.value !== null;
  const scale = displayScale.value;

  const stepScale = (dir: -1 | 1) => {
    const idx = DISPLAY_SCALE_STEPS.indexOf(scale);
    let nextIdx: number;
    if (idx === -1) {
      nextIdx = DISPLAY_SCALE_STEPS.findIndex((s) => s > scale);
      if (dir === -1) nextIdx = Math.max(0, nextIdx - 1);
      if (nextIdx === -1) nextIdx = DISPLAY_SCALE_STEPS.length - 1;
    } else {
      nextIdx = Math.max(0, Math.min(DISPLAY_SCALE_STEPS.length - 1, idx + dir));
    }
    displayScale.value = DISPLAY_SCALE_STEPS[nextIdx];
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
        gap: 4,
        flexShrink: 0,
      }}
    >
      {/* TileSet selector */}
      <select
        value={activeTilesetId.value ?? ""}
        onChange={(e) => {
          activeTilesetId.value = (e.target as HTMLSelectElement).value || null;
        }}
        style={{ flex: 1, minWidth: 0 }}
      >
        {tilesets.value.length === 0 && <option value="">（无瓦片集）</option>}
        {tilesets.value.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name} ({t.columns}×{t.rows})
          </option>
        ))}
      </select>

      {/* Tile size + scale info */}
      {ts && (
        <span
          style={{
            fontSize: 10,
            color: "var(--text-secondary)",
            whiteSpace: "nowrap",
            fontFamily: "monospace",
          }}
        >
          {ts.tileWidth}×{ts.tileHeight}
        </span>
      )}

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

      {/* Inline scale control */}
      <div style={{ display: "flex", alignItems: "center", gap: 1 }}>
        <button
          onClick={() => stepScale(-1)}
          style={{ width: 18, height: 20, padding: 0, fontSize: 11 }}
          title="缩小显示比例"
        >−</button>
        <span
          style={{
            minWidth: 20,
            textAlign: "center",
            fontSize: 10,
            fontFamily: "monospace",
            color: "var(--text-bright)",
          }}
        >
          {formatDisplayScale(scale)}
        </span>
        <button
          onClick={() => stepScale(1)}
          style={{ width: 18, height: 20, padding: 0, fontSize: 11 }}
          title="放大显示比例"
        >+</button>
      </div>

      {/* Import */}
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
