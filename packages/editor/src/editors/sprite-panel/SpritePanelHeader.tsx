import { useState, useRef } from "preact/hooks";
import {
  spriteAtlases,
  activeAtlasId,
  activeFrameId,
  activeAtlas,
  activeFrame,
  removeAtlas,
} from "../../store/atlas";
import {
  importTileSheetAtlas,
  importPackedAtlas,
  importXmlAtlas,
  importLooseFiles,
} from "../../data/atlas-import";
import { spriteFilterText } from "./SpritePanelCanvas";

type ImportMode = "tilesheet" | "packed" | "xml" | "loose";

export function SpritePanelHeader() {
  const atlas = activeAtlas.value;
  const frame = activeFrame.value;
  const atlases = spriteAtlases.value;
  const [showImport, setShowImport] = useState(false);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 0,
        borderBottom: "1px solid #333",
        background: "#2a2a2a",
        flexShrink: 0,
        position: "relative",
      }}
    >
      {/* Top row: atlas selector + info + actions */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          padding: "0 8px",
          height: 32,
        }}
      >
        <select
          value={activeAtlasId.value ?? ""}
          onChange={(e) => {
            const v = (e.target as HTMLSelectElement).value;
            activeAtlasId.value = v || null;
            activeFrameId.value = null;
          }}
          style={{ flex: 1, minWidth: 0 }}
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
              color: "var(--text-secondary)",
              whiteSpace: "nowrap",
              fontFamily: "monospace",
            }}
          >
            {atlas.imageWidth}×{atlas.imageHeight}
          </span>
        )}

        {/* Delete active atlas */}
        {atlas && (
          <button
            onClick={() => removeAtlas(atlas.id)}
            title="删除当前图集"
            style={{
              background: "transparent",
              border: "none",
              borderRadius: 3,
              padding: "2px 5px",
              cursor: "pointer",
              fontSize: 13,
              lineHeight: 1,
              color: "var(--text-secondary)",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#e06060"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
          >✕</button>
        )}

        {/* Import button */}
        <button
          onClick={() => setShowImport(!showImport)}
          style={{
            background: showImport ? "var(--accent)" : undefined,
            color: showImport ? "#fff" : undefined,
          }}
        >导入</button>
      </div>

      {/* Second row: search */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "0 8px 4px",
          height: 24,
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

      {/* Import popover */}
      {showImport && (
        <ImportPopover onDone={() => setShowImport(false)} />
      )}
    </div>
  );
}

// ============================================================
// Import Popover — appears below header, matches tile palette style
// ============================================================
function ImportPopover({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<ImportMode>("xml");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tilesheet params
  const [tileW, setTileW] = useState(16);
  const [tileH, setTileH] = useState(16);
  const [margin, setMargin] = useState(0);
  const [spacing, setSpacing] = useState(0);

  const fileRef = useRef<HTMLInputElement>(null);

  const acceptMap: Record<ImportMode, string> = {
    tilesheet: ".png,.jpg,.jpeg,.webp,.gif",
    packed: ".json,.png,.jpg,.jpeg,.webp",
    xml: ".xml,.txt,.png,.jpg,.jpeg,.webp",
    loose: ".png,.jpg,.jpeg,.webp,.gif",
  };

  const doImport = async () => {
    const files = Array.from(fileRef.current?.files ?? []);
    if (files.length === 0) { setError("请选择文件"); return; }

    setLoading(true);
    setError(null);
    try {
      if (mode === "tilesheet") {
        const imgFile = files.find((f) => /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name));
        if (!imgFile) throw new Error("未找到图片文件");
        await importTileSheetAtlas(imgFile, tileW, tileH, margin, spacing);
      } else if (mode === "packed") {
        const jsonFile = files.find((f) => f.name.endsWith(".json"));
        const imgFile = files.find((f) => /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name));
        if (!jsonFile || !imgFile) throw new Error("需要 JSON + 图片文件");
        await importPackedAtlas(jsonFile, imgFile);
      } else if (mode === "xml") {
        const xmlFile = files.find((f) => /\.(xml|txt)$/i.test(f.name));
        const imgFile = files.find((f) => /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name));
        if (!xmlFile || !imgFile) throw new Error("需要 XML + 图片文件");
        await importXmlAtlas(xmlFile, imgFile);
      } else {
        const imgFiles = files.filter((f) => /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name));
        if (imgFiles.length < 2) throw new Error("至少需要 2 张图片");
        await importLooseFiles(imgFiles);
      }
      onDone();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const tabStyle = (m: ImportMode) => ({
    flex: 1 as const,
    fontSize: 10,
    padding: "3px 0",
    border: "1px solid var(--border)" as const,
    borderRadius: 3,
    cursor: "pointer" as const,
    background: mode === m ? "var(--accent)" : "transparent",
    color: mode === m ? "#fff" : "var(--text-secondary)",
  });

  const numInput = (value: number, onChange: (v: number) => void) => ({
    type: "number" as const,
    value,
    onInput: (e: Event) => onChange(parseInt((e.target as HTMLInputElement).value) || 0),
    style: {
      width: 44,
      height: 20,
      fontSize: 11,
      padding: "0 3px",
      border: "1px solid var(--border)",
      borderRadius: 2,
      background: "var(--bg-input)",
      color: "var(--text-bright)",
      outline: "none",
    },
  });

  const labels: Record<ImportMode, string> = {
    tilesheet: "网格",
    packed: "JSON",
    xml: "XML",
    loose: "散图",
  };

  const hints: Record<ImportMode, string> = {
    tilesheet: "选择等距网格 sprite sheet 图片",
    packed: "选择 TexturePacker JSON + PNG",
    xml: "选择 Sparrow/Starling XML + PNG",
    loose: "选择多张 PNG，自动打包成图集",
  };

  return (
    <div
      style={{
        position: "absolute",
        top: "100%",
        left: 0,
        right: 0,
        zIndex: 100,
        background: "#2a2a2a",
        borderBottom: "2px solid var(--accent)",
        padding: "8px",
        boxShadow: "0 4px 12px rgba(0,0,0,0.5)",
      }}
    >
      {/* Mode tabs */}
      <div style={{ display: "flex", gap: 2, marginBottom: 6 }}>
        {(["tilesheet", "packed", "xml", "loose"] as ImportMode[]).map((m) => (
          <button key={m} onClick={() => setMode(m)} style={tabStyle(m)}>
            {labels[m]}
          </button>
        ))}
      </div>

      {/* Hint */}
      <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 4 }}>
        {hints[mode]}
      </div>

      {/* File input */}
      <input
        ref={fileRef}
        type="file"
        multiple={mode !== "tilesheet"}
        accept={acceptMap[mode]}
        style={{ fontSize: 10, marginBottom: 4, width: "100%" }}
      />

      {/* Grid params */}
      {mode === "tilesheet" && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", margin: "4px 0" }}>
          <label style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 2 }}>
            W <input {...numInput(tileW, setTileW)} />
          </label>
          <label style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 2 }}>
            H <input {...numInput(tileH, setTileH)} />
          </label>
          <label style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 2 }}>
            M <input {...numInput(margin, setMargin)} />
          </label>
          <label style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 2 }}>
            S <input {...numInput(spacing, setSpacing)} />
          </label>
        </div>
      )}

      {error && (
        <div style={{ fontSize: 10, color: "#e06060", margin: "4px 0" }}>{error}</div>
      )}

      {/* Action buttons */}
      <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
        <button
          onClick={doImport}
          disabled={loading}
          style={{
            flex: 1,
            fontSize: 11,
            padding: "4px 0",
            background: "var(--accent)",
            color: "#fff",
            border: "none",
            borderRadius: 3,
            cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "导入中…" : "导入"}
        </button>
        <button
          onClick={onDone}
          style={{
            fontSize: 11,
            padding: "4px 8px",
            background: "transparent",
            color: "var(--text-secondary)",
            border: "1px solid var(--border)",
            borderRadius: 3,
            cursor: "pointer",
          }}
        >
          取消
        </button>
      </div>
    </div>
  );
}
