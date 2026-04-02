import { activeTool, type ToolType } from "../../store/selection";

const tools: { id: ToolType; label: string; icon: string }[] = [
  { id: "brush", label: "笔刷", icon: "✏️" },
  { id: "eraser", label: "橡皮", icon: "🧹" },
  { id: "fill", label: "填充", icon: "🪣" },
  { id: "eyedropper", label: "吸管", icon: "💉" },
];

export function ViewportHeader() {
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
      {tools.map((t) => (
        <button
          key={t.id}
          title={t.label}
          onClick={() => { activeTool.value = t.id; }}
          style={{
            background:
              activeTool.value === t.id
                ? "var(--accent)"
                : "transparent",
            border: "none",
            borderRadius: 3,
            padding: "2px 8px",
            cursor: "pointer",
            fontSize: 14,
          }}
        >
          {t.icon}
        </button>
      ))}
    </div>
  );
}
