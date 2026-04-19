import { useRef, useState } from "preact/hooks";
import {
  viewportZoomLocked,
} from "../../store/selection";
import {
  viewportCamera,
  setZoom,
} from "../../store/viewport";
import {
  editMode,
  setEditMode,
} from "../../store/viewport-mode";

export function ViewportHeader() {
  const zoom = viewportCamera.value.zoom;
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
      setZoom(v);
    }
  };

  const startEdit = () => {
    setEditValue(formatZoom(zoom));
    setEditing(true);
    requestAnimationFrame(() => inputRef.current?.select());
  };

  const mode = editMode.value;

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
      {/* ── 模式标签 ─────────────────────────── */}
      <div
        style={{
          display: "flex",
          gap: 2,
          background: "rgba(0,0,0,0.2)",
          borderRadius: 4,
          padding: 2,
        }}
      >
        <ModeTab
          label="实体"
          active={mode === "entity"}
          onClick={() => setEditMode("entity")}
        />
        <ModeTab
          label="笔刷"
          active={mode === "brush"}
          onClick={() => setEditMode("brush")}
        />
      </div>

      <div style={{ flex: 1 }} />

      {/* ── 缩放控件 ─────────────────────────── */}
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

// ── 模式标签按钮 ─────────────────────────────────────────────

function ModeTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        background: active ? "var(--accent)" : "transparent",
        border: "none",
        borderRadius: 3,
        padding: "2px 10px",
        cursor: "pointer",
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        color: active ? "#fff" : "var(--text-secondary)",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </button>
  );
}
