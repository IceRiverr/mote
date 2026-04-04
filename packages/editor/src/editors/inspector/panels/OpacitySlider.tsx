import { useRef, useState, useCallback } from "preact/hooks";

/**
 * Blender-style opacity slider: drag to adjust, click value to type.
 * Range: 0% ~ 100%, maps to 0.0 ~ 1.0.
 */
export function OpacitySlider({
  value,
  onChange,
  disabled = false,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [dragging, setDragging] = useState(false);

  const pct = Math.round(value * 100);

  const calcValue = useCallback(
    (clientX: number) => {
      const track = trackRef.current;
      if (!track) return value;
      const rect = track.getBoundingClientRect();
      const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      return Math.round(ratio * 100) / 100;
    },
    [value]
  );

  const onPointerDown = (e: PointerEvent) => {
    if (disabled || editing) return;
    e.preventDefault();
    setDragging(true);
    const v = calcValue(e.clientX);
    onChange(v);

    const onMove = (ev: PointerEvent) => {
      onChange(calcValue(ev.clientX));
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const startEdit = () => {
    if (disabled) return;
    setEditValue(String(pct));
    setEditing(true);
    requestAnimationFrame(() => {
      const input = trackRef.current?.querySelector("input");
      input?.select();
    });
  };

  const commitEdit = () => {
    setEditing(false);
    const v = parseInt(editValue);
    if (!isNaN(v)) {
      onChange(Math.max(0, Math.min(100, v)) / 100);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 6,
        opacity: disabled ? 0.4 : 1,
        padding: "4px 0",
      }}
    >
      <span
        style={{
          fontSize: 10,
          color: "var(--text-secondary)",
          width: 36,
          flexShrink: 0,
        }}
      >
        透明度
      </span>
      <div
        ref={trackRef}
        onPointerDown={onPointerDown}
        style={{
          flex: 1,
          height: 18,
          background: "var(--bg-input)",
          borderRadius: 3,
          position: "relative",
          cursor: disabled ? "default" : dragging ? "ew-resize" : "ew-resize",
          overflow: "hidden",
          border: "1px solid var(--border)",
        }}
      >
        {/* Fill bar */}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${pct}%`,
            background: "var(--accent)",
            opacity: 0.35,
            borderRadius: "2px 0 0 2px",
            pointerEvents: "none",
          }}
        />
        {/* Value display / input */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {editing ? (
            <input
              type="text"
              value={editValue}
              onInput={(e) =>
                setEditValue((e.target as HTMLInputElement).value)
              }
              onKeyDown={(e) => {
                if (e.key === "Enter") commitEdit();
                if (e.key === "Escape") setEditing(false);
              }}
              onBlur={commitEdit}
              style={{
                width: 36,
                height: 14,
                fontSize: 10,
                fontFamily: "monospace",
                textAlign: "center",
                padding: 0,
                border: "none",
                background: "transparent",
                color: "var(--text-bright)",
                outline: "none",
              }}
            />
          ) : (
            <span
              onDblClick={(e) => {
                e.stopPropagation();
                startEdit();
              }}
              style={{
                fontSize: 10,
                fontFamily: "monospace",
                color: "var(--text)",
                fontWeight: 500,
                pointerEvents: "auto",
                cursor: "text",
                userSelect: "none",
              }}
            >
              {pct}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
