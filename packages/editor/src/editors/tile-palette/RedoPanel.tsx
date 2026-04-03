import { useEffect, useRef } from "preact/hooks";
import {
  tilesets,
  lastImportedTilesetId,
  updateTileSetParams,
} from "../../store/project";

/**
 * Redo Panel — Blender-style "Adjust Last Operation" panel.
 *
 * Appears at the bottom of TilePalette after a tileset import.
 * Non-modal: user can still interact with other Areas.
 * Dismisses on: click outside, Escape, or next import.
 */
export function RedoPanel() {
  const id = lastImportedTilesetId.value;
  const ts = id ? tilesets.value.find((t) => t.id === id) ?? null : null;
  const panelRef = useRef<HTMLDivElement>(null);

  // Dismiss on click outside this panel
  useEffect(() => {
    if (!id) return;
    const handler = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        lastImportedTilesetId.value = null;
      }
    };
    // Delay to avoid immediate dismiss from the import click
    const timer = setTimeout(() => {
      window.addEventListener("pointerdown", handler);
    }, 200);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", handler);
    };
  }, [id]);

  // Dismiss on Escape
  useEffect(() => {
    if (!id) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") lastImportedTilesetId.value = null;
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [id]);

  if (!ts) return null;

  const set = (field: string, raw: string) => {
    const v = Math.max(field === "name" ? 0 : (field.startsWith("tile") ? 1 : 0), parseInt(raw) || 0);
    if (field === "name") {
      updateTileSetParams(ts.id, { name: raw });
    } else {
      updateTileSetParams(ts.id, { [field]: v });
    }
  };

  return (
    <div
      ref={panelRef}
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        background: "#2a2a2a",
        borderTop: "2px solid var(--accent)",
        padding: "8px 10px",
        zIndex: 50,
        fontSize: 11,
        boxShadow: "0 -4px 12px rgba(0,0,0,0.3)",
      }}
    >
      {/* Title row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          marginBottom: 8,
          gap: 6,
        }}
      >
        <span style={{ color: "var(--accent)", fontSize: 10 }}>▶</span>
        <span style={{ color: "var(--text-bright)", fontWeight: 500 }}>
          导入瓦片集
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ color: "var(--text-secondary)", fontSize: 10 }}>
          {ts.columns}×{ts.rows} = {ts.tileCount} 瓦片
        </span>
      </div>

      {/* Fields */}
      <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
        <Field label="名称">
          <input
            type="text"
            value={ts.name}
            onInput={(e) => set("name", (e.target as HTMLInputElement).value)}
            style={{ width: "100%" }}
          />
        </Field>

        <div style={{ display: "flex", gap: 8 }}>
          <Field label="瓦片宽">
            <input
              type="number"
              value={ts.tileWidth}
              min={1}
              max={512}
              style={{ width: 52 }}
              onChange={(e) => set("tileWidth", (e.target as HTMLInputElement).value)}
            />
          </Field>
          <Field label="瓦片高">
            <input
              type="number"
              value={ts.tileHeight}
              min={1}
              max={512}
              style={{ width: 52 }}
              onChange={(e) => set("tileHeight", (e.target as HTMLInputElement).value)}
            />
          </Field>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <Field label="外边距">
            <input
              type="number"
              value={ts.margin}
              min={0}
              max={128}
              style={{ width: 52 }}
              onChange={(e) => set("margin", (e.target as HTMLInputElement).value)}
            />
          </Field>
          <Field label="间距">
            <input
              type="number"
              value={ts.spacing}
              min={0}
              max={128}
              style={{ width: 52 }}
              onChange={(e) => set("spacing", (e.target as HTMLInputElement).value)}
            />
          </Field>
        </div>
      </div>

      {ts.tileCount === 0 && (
        <div style={{ color: "var(--danger)", marginTop: 6, fontSize: 10 }}>
          ⚠ 当前参数无法切出瓦片，请调整
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ color: "var(--text-secondary)", fontSize: 10, width: 38, flexShrink: 0, textAlign: "right" }}>
        {label}
      </span>
      {children}
    </div>
  );
}
