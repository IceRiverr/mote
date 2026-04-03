import { useEffect, useRef, useState } from "preact/hooks";
import { signal } from "@preact/signals";
import {
  tilesets,
  updateTileSetParams,
  removeTileSet,
} from "../../store/project";
import {
  activeTilesetId,
  displayScale,
  displayScaleLocked,
  DISPLAY_SCALE_STEPS,
  formatDisplayScale,
  parseDisplayScale,
} from "../../store/selection";
import { exportTileSet } from "../../data/export";

/** Controls whether the popover is visible */
export const popoverOpen = signal(false);

export function TileSetPopover() {
  const tsId = activeTilesetId.value;
  const ts = tsId ? tilesets.value.find((t) => t.id === tsId) ?? null : null;
  const panelRef = useRef<HTMLDivElement>(null);
  const locked = displayScaleLocked.value;
  const scale = displayScale.value;

  const [editingScale, setEditingScale] = useState(false);
  const [scaleInput, setScaleInput] = useState("");
  const scaleInputRef = useRef<HTMLInputElement>(null);

  // Dismiss on click outside
  useEffect(() => {
    if (!popoverOpen.value) return;
    const handler = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        popoverOpen.value = false;
      }
    };
    const timer = setTimeout(() => {
      window.addEventListener("pointerdown", handler);
    }, 100);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", handler);
    };
  }, [popoverOpen.value]);

  // Dismiss on Escape
  useEffect(() => {
    if (!popoverOpen.value) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") popoverOpen.value = false;
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [popoverOpen.value]);

  if (!popoverOpen.value || !ts) return null;

  const set = (field: string, raw: string) => {
    if (field === "name") {
      updateTileSetParams(ts.id, { name: raw });
    } else {
      const v = Math.max(field.startsWith("tile") ? 1 : 0, parseInt(raw) || 0);
      updateTileSetParams(ts.id, { [field]: v });
    }
  };

  const stepScale = (dir: -1 | 1) => {
    const idx = DISPLAY_SCALE_STEPS.indexOf(scale);
    let nextIdx: number;
    if (idx === -1) {
      // Find nearest step
      nextIdx = DISPLAY_SCALE_STEPS.findIndex((s) => s > scale);
      if (dir === -1) nextIdx = Math.max(0, nextIdx - 1);
      if (nextIdx === -1) nextIdx = DISPLAY_SCALE_STEPS.length - 1;
    } else {
      nextIdx = Math.max(0, Math.min(DISPLAY_SCALE_STEPS.length - 1, idx + dir));
    }
    displayScale.value = DISPLAY_SCALE_STEPS[nextIdx];
  };

  const startEditScale = () => {
    setScaleInput(formatDisplayScale(scale));
    setEditingScale(true);
    requestAnimationFrame(() => scaleInputRef.current?.select());
  };

  const commitScaleEdit = () => {
    setEditingScale(false);
    const v = parseDisplayScale(scaleInput);
    if (v !== null) {
      displayScale.value = v;
    }
  };

  return (
    <div
      ref={panelRef}
      style={{
        position: "absolute",
        top: 34,
        right: 4,
        width: 220,
        background: "#2a2a2a",
        border: "1px solid var(--border)",
        borderRadius: 6,
        boxShadow: "0 4px 16px rgba(0,0,0,0.4)",
        zIndex: 200,
        fontSize: 11,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "6px 10px",
          borderBottom: "1px solid var(--border)",
          background: "var(--panel-header)",
          fontWeight: 600,
          color: "var(--text-bright)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span>瓦片集属性</span>
        <button
          onClick={() => {
            popoverOpen.value = false;
          }}
          style={{
            background: "transparent",
            border: "none",
            color: "var(--text-secondary)",
            cursor: "pointer",
            fontSize: 13,
            padding: 0,
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>

      {/* Properties */}
      <div
        style={{
          padding: "8px 10px",
          display: "flex",
          flexDirection: "column",
          gap: 5,
        }}
      >
        <Field label="名称">
          <input
            type="text"
            value={ts.name}
            onInput={(e) => set("name", (e.target as HTMLInputElement).value)}
            style={{ width: "100%" }}
          />
        </Field>

        <div style={{ display: "flex", gap: 6 }}>
          <Field label="瓦片宽">
            <input
              type="number"
              value={ts.tileWidth}
              min={1}
              max={512}
              style={{ width: 48 }}
              onChange={(e) =>
                set("tileWidth", (e.target as HTMLInputElement).value)
              }
            />
          </Field>
          <Field label="瓦片高">
            <input
              type="number"
              value={ts.tileHeight}
              min={1}
              max={512}
              style={{ width: 48 }}
              onChange={(e) =>
                set("tileHeight", (e.target as HTMLInputElement).value)
              }
            />
          </Field>
        </div>

        <div style={{ display: "flex", gap: 6 }}>
          <Field label="外边距">
            <input
              type="number"
              value={ts.margin}
              min={0}
              max={128}
              style={{ width: 48 }}
              onChange={(e) =>
                set("margin", (e.target as HTMLInputElement).value)
              }
            />
          </Field>
          <Field label="间距">
            <input
              type="number"
              value={ts.spacing}
              min={0}
              max={128}
              style={{ width: 48 }}
              onChange={(e) =>
                set("spacing", (e.target as HTMLInputElement).value)
              }
            />
          </Field>
        </div>

        {/* Display scale with editable value + lock */}
        <Field label="显示比例">
          <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
            <button
              onClick={() => stepScale(-1)}
              disabled={locked}
              style={{
                width: 22,
                height: 22,
                padding: 0,
                opacity: locked ? 0.4 : 1,
                cursor: locked ? "not-allowed" : "pointer",
              }}
            >
              −
            </button>

            {editingScale ? (
              <input
                ref={scaleInputRef}
                type="text"
                value={scaleInput}
                onInput={(e) =>
                  setScaleInput((e.target as HTMLInputElement).value)
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitScaleEdit();
                  if (e.key === "Escape") setEditingScale(false);
                }}
                onBlur={commitScaleEdit}
                style={{
                  width: 36,
                  height: 20,
                  fontSize: 11,
                  textAlign: "center",
                  padding: "0 2px",
                  border: "1px solid var(--accent)",
                  borderRadius: 3,
                  background: "var(--bg-input)",
                  color: "var(--text-bright)",
                  outline: "none",
                  fontFamily: "monospace",
                }}
              />
            ) : (
              <span
                onClick={startEditScale}
                title="点击输入精确比例 (支持 1/4, 1/2, 0.5, 1~8)"
                style={{
                  minWidth: 32,
                  textAlign: "center",
                  cursor: "text",
                  padding: "1px 3px",
                  borderRadius: 3,
                  border: "1px solid transparent",
                  fontFamily: "monospace",
                  fontSize: 11,
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "var(--border)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.borderColor =
                    "transparent";
                }}
              >
                {formatDisplayScale(scale)}
              </span>
            )}

            <button
              onClick={() => stepScale(1)}
              disabled={locked}
              style={{
                width: 22,
                height: 22,
                padding: 0,
                opacity: locked ? 0.4 : 1,
                cursor: locked ? "not-allowed" : "pointer",
              }}
            >
              +
            </button>

            {/* Lock button */}
            <button
              onClick={() => {
                displayScaleLocked.value = !locked;
              }}
              title={locked ? "解锁比例 (导入时自动计算)" : "锁定比例 (导入时保持不变)"}
              style={{
                background: locked ? "var(--accent)" : "transparent",
                border: locked
                  ? "1px solid var(--accent)"
                  : "1px solid var(--border)",
                borderRadius: 3,
                padding: "1px 4px",
                cursor: "pointer",
                fontSize: 11,
                lineHeight: 1,
                color: locked ? "#fff" : "var(--text-secondary)",
                marginLeft: 2,
              }}
            >
              {locked ? "🔒" : "🔓"}
            </button>
          </div>
        </Field>

        {/* Stats */}
        <div
          style={{
            borderTop: "1px solid var(--border)",
            paddingTop: 6,
            marginTop: 2,
            color: "var(--text-secondary)",
            fontSize: 10,
          }}
        >
          {ts.columns}×{ts.rows} = {ts.tileCount} 瓦片 · 原图{" "}
          {ts.imageWidth}×{ts.imageHeight}px
          {ts.tileCount === 0 && (
            <div style={{ color: "var(--danger)", marginTop: 3 }}>
              ⚠ 当前参数无法切出瓦片
            </div>
          )}
        </div>

        {/* Actions */}
        <div
          style={{
            display: "flex",
            gap: 4,
            borderTop: "1px solid var(--border)",
            paddingTop: 6,
            marginTop: 2,
          }}
        >
          <button
            onClick={() => {
              exportTileSet(ts);
            }}
            style={{ flex: 1, fontSize: 10 }}
          >
            导出 TileSet
          </button>
          <button
            onClick={() => {
              removeTileSet(ts.id);
              popoverOpen.value = false;
            }}
            style={{
              flex: 1,
              fontSize: 10,
              color: "var(--danger)",
              borderColor: "var(--danger)",
            }}
          >
            删除
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: any }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <span
        style={{
          width: 42,
          flexShrink: 0,
          color: "var(--text-secondary)",
          fontSize: 10,
          textAlign: "right",
        }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}
