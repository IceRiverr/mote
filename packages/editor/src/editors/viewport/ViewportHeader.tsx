import { useRef, useState } from "preact/hooks";
import {
  viewportZoomLocked,
  showGrid,
} from "../../store/selection";
import {
  viewportCamera,
  setZoom,
} from "../../store/viewport";
import {
  editMode,
  setEditMode,
} from "../../store/viewport-mode";
import { snapEnabled, currentScene, toggleSnap } from "../../store/scene";

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
        display: "flex",
        alignItems: "center",
        gap: 8,
        flex: 1,
      }}
    >
      {/* ── 左侧：模式选择 ─────────────────────────── */}
      <select
        value={mode}
        onChange={(e) => setEditMode((e.target as HTMLSelectElement).value as "entity" | "brush")}
        style={{
          fontSize: 12,
          height: 22,
          padding: "0 6px",
          border: "1px solid var(--border)",
          borderRadius: 3,
          background: "var(--bg-header)",
          color: "var(--text)",
          cursor: "pointer",
          outline: "none",
        }}
      >
        <option value="entity">实体</option>
        <option value="brush">笔刷</option>
      </select>

      {/* ── 中间：Grid / Snap 控制组 ─────────────────── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 12,
        }}
      >
        {/* Grid 组 */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <MiniToggle
            active={showGrid.value}
            onClick={() => { showGrid.value = !showGrid.value; }}
            title={showGrid.value ? "隐藏网格 (Ctrl+G)" : "显示网格 (Ctrl+G)"}
          >
            #
          </MiniToggle>
          {showGrid.value && currentScene.value && (
            <SizeSelect
              value={currentScene.value.grid.size}
              options={[8, 16, 32, 64, 128]}
              onChange={(size) => {
                const scene = currentScene.value;
                if (!scene) return;
                currentScene.value = {
                  ...scene,
                  grid: { ...scene.grid, size },
                };
                const oldSnap = scene.grid.snapSize;
                if (oldSnap === undefined || oldSnap === scene.grid.size) {
                  currentScene.value = {
                    ...currentScene.value,
                    grid: { ...currentScene.value.grid, snapSize: size },
                  };
                }
              }}
            />
          )}
        </div>

        {/* Snap 组 */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <MiniToggle
            active={snapEnabled.value}
            onClick={toggleSnap}
            title={snapEnabled.value ? "禁用吸附 (Ctrl+Shift+G)" : "启用吸附 (Ctrl+Shift+G)"}
          >
            🧲
          </MiniToggle>
          {snapEnabled.value && currentScene.value && (
            <SizeSelect
              value={currentScene.value.grid.snapSize ?? currentScene.value.grid.size}
              options={[1, 2, 4, 8, 16, 32, 64]}
              onChange={(size) => {
                const scene = currentScene.value;
                if (!scene) return;
                currentScene.value = {
                  ...scene,
                  grid: { ...scene.grid, snapSize: size },
                };
              }}
            />
          )}
        </div>
      </div>

      {/* ── 右侧：缩放控件 ─────────────────────────── */}
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

// ── 迷你切换按钮 ─────────────────────────────────────────────

function MiniToggle({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  children?: any;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: 26,
        height: 22,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "none",
        borderRadius: 3,
        background: active ? "rgba(244, 167, 66, 0.35)" : "transparent",
        color: active ? "#f4a742" : "#777",
        fontSize: 11,
        lineHeight: 1,
        cursor: "pointer",
        transition: "background 0.08s ease, color 0.08s ease",
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget;
        if (!active) {
          el.style.background = "rgba(255,255,255,0.08)";
          el.style.color = "#bbb";
        }
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget;
        if (!active) {
          el.style.background = "transparent";
          el.style.color = "#777";
        }
      }}
    >
      {children}
    </button>
  );
}

// ── 紧凑尺寸选择器 ───────────────────────────────────────────

function SizeSelect({
  label,
  value,
  options,
  onChange,
}: {
  label?: string;
  value: number;
  options: number[];
  onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
      {label && (
        <span style={{ fontSize: 10, color: "var(--text-secondary)" }}>
          {label}
        </span>
      )}
      <select
        value={value}
        onChange={(e) => onChange(parseInt((e.target as HTMLSelectElement).value, 10))}
        style={{
          fontSize: 10,
          height: 18,
          padding: "0 2px",
          border: "1px solid var(--border)",
          borderRadius: 2,
          background: "var(--bg-header)",
          color: "var(--text-secondary)",
          cursor: "pointer",
          outline: "none",
        }}
      >
        {options.map((opt) => (
          <option key={opt} value={opt}>
            {opt}px
          </option>
        ))}
      </select>
    </div>
  );
}
