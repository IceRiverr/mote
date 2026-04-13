import { useRef, useState } from "preact/hooks";
import {
  activeTool,
  viewportZoom,
  viewportZoomLocked,
  TOOLS,
  setTool,
  type ToolType,
} from "../../store/selection";

export function ViewportHeader() {
  const zoom = viewportZoom.value;
  const locked = viewportZoomLocked.value;
  const isInteger = Math.abs(zoom - Math.round(zoom)) < 0.01;
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const formatZoom = (z: number) => {
    if (z === Math.floor(z)) return z.toFixed(0);
    return z.toFixed(1);
  };

  const commitEdit = () => {
    setEditing(false);
    const v = parseFloat(editValue);
    if (!isNaN(v) && v >= 0.25 && v <= 16) {
      window.dispatchEvent(
        new CustomEvent("mote-set-viewport-zoom", { detail: { zoom: v } })
      );
    }
  };

  const startEdit = () => {
    setEditValue(formatZoom(zoom));
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.select());
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
        gap: 2,
        flexShrink: 0,
      }}
    >
      {TOOLS.map((t) => (
        <button
          key={t.id}
          title={`${t.label} (${t.shortcut})`}
          onClick={() => setTool(t.id)}
          style={{
            background:
              activeTool.value === t.id ? "var(--accent)" : "transparent",
            border: "none",
            borderRadius: 3,
            padding: "2px 8px",
            cursor: "pointer",
            fontSize: t.id === "select" ? 16 : 14,
            fontWeight: t.id === "select" ? 700 : 400,
          }}
        >
          {t.icon}
        </button>
      ))}

      <div style={{ flex: 1 }} />

      {/* Zoom input / display */}
      <span
        style={{
          fontSize: 11,
          fontFamily: "monospace",
          marginRight: 2,
          color: "var(--text-secondary)",
        }}
      >
        ×
      </span>
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={editValue}
          onInput={(e) => setEditValue((e.target as HTMLInputElement).value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitEdit();
            if (e.key === "Escape") setEditing(false);
          }}
          onBlur={commitEdit}
          style={{
            width: 40,
            height: 20,
            fontSize: 11,
            fontFamily: "monospace",
            textAlign: "center",
            padding: "0 2px",
            border: "1px solid var(--accent)",
            borderRadius: 3,
            background: "var(--bg-input)",
            color: "var(--text-bright)",
            outline: "none",
          }}
        />
      ) : (
        <span
          onClick={startEdit}
          title="点击输入精确缩放值 (0.25 ~ 16)"
          style={{
            fontSize: 11,
            color: isInteger ? "var(--accent)" : "var(--text-secondary)",
            fontWeight: isInteger ? 600 : 400,
            fontFamily: "monospace",
            cursor: "text",
            padding: "1px 4px",
            borderRadius: 3,
            border: "1px solid transparent",
            minWidth: 28,
            textAlign: "center",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor =
              "var(--border)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.borderColor = "transparent";
          }}
        >
          {formatZoom(zoom)}
        </span>
      )}

      {/* Lock button */}
      <button
        onClick={() => {
          viewportZoomLocked.value = !locked;
        }}
        title={locked ? "解锁缩放" : "锁定缩放"}
        style={{
          background: locked ? "var(--accent)" : "transparent",
          border: locked
            ? "1px solid var(--accent)"
            : "1px solid var(--border)",
          borderRadius: 3,
          padding: "1px 5px",
          cursor: "pointer",
          fontSize: 12,
          lineHeight: 1,
          color: locked ? "#fff" : "var(--text-secondary)",
          marginLeft: 2,
        }}
      >
        {locked ? "🔒" : "🔓"}
      </button>
    </div>
  );
}
