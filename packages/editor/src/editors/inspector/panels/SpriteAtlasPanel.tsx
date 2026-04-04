import { useState, useRef } from "preact/hooks";
import { PanelShell } from "./PanelShell";
import { spriteAtlases, activeAtlasId, activeFrameId, atlasImages, removeAtlas } from "../../../store/atlas";
import type { SpriteAtlas, SpriteFrame } from "../../../data/SpriteAtlas";
import { importTileSheetAtlas, importPackedAtlas, importLooseFiles, detectAtlasImportMode } from "../../../data/atlas-import";

type ImportMode = "tilesheet" | "packed" | "loose";

export function SpriteAtlasPanel() {
  const atlases = spriteAtlases.value;
  const [showImport, setShowImport] = useState(false);

  const importBtn = (
    <button
      onClick={(e) => { e.stopPropagation(); setShowImport(!showImport); }}
      title="\u5bfc\u5165 Sprite Atlas"
      style={{
        background: "transparent", border: "none", cursor: "pointer",
        color: "var(--text-secondary)", fontSize: 14, padding: "0 4px", lineHeight: 1,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-bright)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
    >
      \uff0b
    </button>
  );

  return (
    <PanelShell title="Sprite Atlas" headerRight={importBtn}>
      {showImport && <ImportWizard onDone={() => setShowImport(false)} />}

      {atlases.length === 0 && !showImport && (
        <div style={{ fontSize: 10, color: "var(--text-secondary)", fontStyle: "italic", padding: "4px 0" }}>
          \u672a\u5bfc\u5165\u56fe\u96c6\u3002\u70b9\u51fb \uff0b \u5f00\u59cb\u5bfc\u5165\u3002
        </div>
      )}

      {/* Atlas list */}
      {atlases.map((atlas) => (
        <AtlasRow key={atlas.id} atlas={atlas} />
      ))}

      {/* Frame grid for active atlas */}
      <ActiveAtlasFrames />
    </PanelShell>
  );
}

// ============================================================
// Atlas row
// ============================================================
function AtlasRow({ atlas }: { atlas: SpriteAtlas }) {
  const isActive = activeAtlasId.value === atlas.id;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={() => { activeAtlasId.value = atlas.id; }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex", alignItems: "center", gap: 6, height: 24, padding: "0 4px",
        background: isActive ? "var(--selection)" : hovered ? "rgba(255,255,255,0.04)" : "transparent",
        borderLeft: isActive ? "2px solid var(--accent)" : "2px solid transparent",
        borderRadius: 2, cursor: "pointer", fontSize: 11,
      }}
    >
      <span style={{ fontSize: 9, color: "var(--text-secondary)", flexShrink: 0 }}>
        {atlas.sourceType === "tilesheet" ? "\u25a6" : atlas.sourceType === "packed" ? "\u25a3" : "\u25a4"}
      </span>
      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {atlas.name}
      </span>
      <span style={{ fontSize: 9, color: "var(--text-secondary)" }}>
        {atlas.frames.length}f
      </span>
      {(hovered || isActive) && (
        <button
          onClick={(e) => { e.stopPropagation(); removeAtlas(atlas.id); }}
          style={{
            background: "transparent", border: "none", cursor: "pointer",
            fontSize: 10, color: "var(--text-secondary)", padding: 0, lineHeight: 1,
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = "#e06060"; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)"; }}
        >
          \u2715
        </button>
      )}
    </div>
  );
}

// ============================================================
// Frame grid for active atlas
// ============================================================
function ActiveAtlasFrames() {
  const atlasId = activeAtlasId.value;
  if (!atlasId) return null;

  const atlas = spriteAtlases.value.find((a) => a.id === atlasId);
  if (!atlas) return null;

  const img = atlasImages.value.get(atlasId);
  if (!img) return null;

  const maxFramesShown = 60;
  const framesToShow = atlas.frames.slice(0, maxFramesShown);
  const thumbSize = 32;

  return (
    <div style={{ marginTop: 6, borderTop: "1px solid var(--border)", paddingTop: 4 }}>
      <div style={{ fontSize: 10, color: "var(--text-secondary)", marginBottom: 4 }}>
        {atlas.frames.length} frames
        {atlas.frames.length > maxFramesShown && ` (showing first ${maxFramesShown})`}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 2 }}>
        {framesToShow.map((frame) => {
          const isSelected = activeFrameId.value === frame.id;
          return (
            <FrameThumb
              key={frame.id}
              frame={frame}
              img={img}
              size={thumbSize}
              selected={isSelected}
              onClick={() => { activeFrameId.value = frame.id; }}
            />
          );
        })}
      </div>
    </div>
  );
}

function FrameThumb({ frame, img, size, selected, onClick }: {
  frame: SpriteFrame;
  img: HTMLImageElement;
  size: number;
  selected: boolean;
  onClick: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Draw the frame thumbnail
  const drawThumb = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.imageSmoothingEnabled = false;

    // Fit frame into thumb
    const scale = Math.min(size / frame.width, size / frame.height) * 0.85;
    const dw = frame.width * scale;
    const dh = frame.height * scale;
    const dx = (size - dw) / 2;
    const dy = (size - dh) / 2;

    ctx.drawImage(img, frame.x, frame.y, frame.width, frame.height, dx, dy, dw, dh);
  };

  // Draw on mount and when frame/img changes
  if (canvasRef.current) drawThumb();

  return (
    <canvas
      ref={(el) => {
        (canvasRef as any).current = el;
        if (el) requestAnimationFrame(drawThumb);
      }}
      onClick={onClick}
      title={frame.name}
      style={{
        width: size, height: size,
        border: selected ? "2px solid var(--accent)" : "1px solid var(--border)",
        borderRadius: 2,
        cursor: "pointer",
        imageRendering: "pixelated",
        background: selected ? "var(--accent)" + "20" : "transparent",
      }}
    />
  );
}

// ============================================================
// Import Wizard
// ============================================================
function ImportWizard({ onDone }: { onDone: () => void }) {
  const [mode, setMode] = useState<ImportMode>("tilesheet");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tilesheet params
  const [tileW, setTileW] = useState(16);
  const [tileH, setTileH] = useState(16);
  const [margin, setMargin] = useState(0);
  const [spacing, setSpacing] = useState(0);

  const fileRef = useRef<HTMLInputElement>(null);

  const doImport = async () => {
    const files = Array.from(fileRef.current?.files ?? []);
    if (files.length === 0) { setError("\u8bf7\u9009\u62e9\u6587\u4ef6"); return; }

    setLoading(true);
    setError(null);
    try {
      if (mode === "tilesheet") {
        const imgFile = files.find((f) => /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name));
        if (!imgFile) throw new Error("\u672a\u627e\u5230\u56fe\u7247\u6587\u4ef6");
        await importTileSheetAtlas(imgFile, tileW, tileH, margin, spacing);
      } else if (mode === "packed") {
        const jsonFile = files.find((f) => f.name.endsWith(".json"));
        const imgFile = files.find((f) => /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name));
        if (!jsonFile || !imgFile) throw new Error("\u9700\u8981 JSON + \u56fe\u7247\u6587\u4ef6");
        await importPackedAtlas(jsonFile, imgFile);
      } else {
        const imgFiles = files.filter((f) => /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name));
        if (imgFiles.length < 2) throw new Error("\u81f3\u5c11\u9700\u8981 2 \u5f20\u56fe\u7247");
        await importLooseFiles(imgFiles);
      }
      onDone();
    } catch (e: any) {
      setError(e.message ?? String(e));
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: 50, height: 20, fontSize: 11, padding: "0 4px",
    border: "1px solid var(--border)", borderRadius: 2,
    background: "var(--bg-input)", color: "var(--text-bright)", outline: "none",
  };

  return (
    <div style={{ marginBottom: 8, padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
      {/* Mode tabs */}
      <div style={{ display: "flex", gap: 2, marginBottom: 6 }}>
        {(["tilesheet", "packed", "loose"] as ImportMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            style={{
              flex: 1, fontSize: 10, padding: "3px 0", border: "1px solid var(--border)",
              borderRadius: 3, cursor: "pointer",
              background: mode === m ? "var(--accent)" : "transparent",
              color: mode === m ? "#fff" : "var(--text-secondary)",
            }}
          >
            {m === "tilesheet" ? "\u7f51\u683c" : m === "packed" ? "\u56fe\u96c6 JSON" : "\u6563\u56fe"}
          </button>
        ))}
      </div>

      {/* File input */}
      <input
        ref={fileRef}
        type="file"
        multiple={mode !== "tilesheet"}
        accept={mode === "packed" ? ".json,.png,.jpg,.jpeg,.webp" : ".png,.jpg,.jpeg,.webp,.gif"}
        style={{ fontSize: 10, marginBottom: 4, width: "100%" }}
      />

      {/* Grid params (tilesheet mode) */}
      {mode === "tilesheet" && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4, marginBottom: 4 }}>
          <label style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 2 }}>
            W <input type="number" value={tileW} onInput={(e) => setTileW(parseInt((e.target as HTMLInputElement).value) || 16)} style={inputStyle} />
          </label>
          <label style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 2 }}>
            H <input type="number" value={tileH} onInput={(e) => setTileH(parseInt((e.target as HTMLInputElement).value) || 16)} style={inputStyle} />
          </label>
          <label style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 2 }}>
            M <input type="number" value={margin} onInput={(e) => setMargin(parseInt((e.target as HTMLInputElement).value) || 0)} style={inputStyle} />
          </label>
          <label style={{ fontSize: 10, display: "flex", alignItems: "center", gap: 2 }}>
            S <input type="number" value={spacing} onInput={(e) => setSpacing(parseInt((e.target as HTMLInputElement).value) || 0)} style={inputStyle} />
          </label>
        </div>
      )}

      {mode === "packed" && (
        <div style={{ fontSize: 10, color: "var(--text-secondary)", margin: "4px 0" }}>
          \u9009\u62e9 TexturePacker \u5bfc\u51fa\u7684 JSON + PNG \u6587\u4ef6
        </div>
      )}

      {mode === "loose" && (
        <div style={{ fontSize: 10, color: "var(--text-secondary)", margin: "4px 0" }}>
          \u9009\u62e9\u591a\u5f20 PNG \u6587\u4ef6\uff0c\u81ea\u52a8\u6253\u5305\u6210\u56fe\u96c6
        </div>
      )}

      {error && (
        <div style={{ fontSize: 10, color: "#e06060", margin: "4px 0" }}>{error}</div>
      )}

      <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
        <button
          onClick={doImport}
          disabled={loading}
          style={{
            flex: 1, fontSize: 11, padding: "4px 0",
            background: "var(--accent)", color: "#fff", border: "none",
            borderRadius: 3, cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "\u5bfc\u5165\u4e2d..." : "\u5bfc\u5165"}
        </button>
        <button
          onClick={onDone}
          style={{
            fontSize: 11, padding: "4px 8px",
            background: "transparent", color: "var(--text-secondary)",
            border: "1px solid var(--border)", borderRadius: 3, cursor: "pointer",
          }}
        >
          \u53d6\u6d88
        </button>
      </div>
    </div>
  );
}
