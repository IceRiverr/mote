// ═══════════════════════════════════════════════════════════════
// ViewportTPanel.tsx — 浮空工具栏（T-Panel）
// Blender 风格：半透明毛玻璃面板悬浮在画布左上角
// ═══════════════════════════════════════════════════════════════

import {
  editMode,
  entityTool,
  ENTITY_TOOLS,
  setEntityTool,
  brushTool,
  BRUSH_TOOLS,
  setBrushTool,
} from "../../store/viewport-mode";

export function ViewportTPanel() {
  const mode = editMode.value;
  const tools = mode === "entity" ? ENTITY_TOOLS : BRUSH_TOOLS;
  const active = mode === "entity" ? entityTool.value : brushTool.value;

  const setTool = (id: string) => {
    if (mode === "entity") {
      setEntityTool(id as typeof entityTool.value);
    } else {
      setBrushTool(id as typeof brushTool.value);
    }
  };

  return (
    <div
      style={{
        position: "absolute",
        left: 8,
        top: 8,
        zIndex: 10,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        padding: "4px 2px",
        gap: 1,
        userSelect: "none",
        // 浮空半透明 + 毛玻璃
        background: "rgba(35, 35, 35, 0.72)",
        backdropFilter: "blur(10px)",
        WebkitBackdropFilter: "blur(10px)",
        borderRadius: 6,
        boxShadow: "0 4px 12px rgba(0,0,0,0.35), 0 0 0 1px rgba(255,255,255,0.05)",
      }}
    >
      {/* 工具按钮 */}
      {tools.map((tool) => {
        const isActive = active === tool.id;
        return (
          <button
            key={tool.id}
            title={`${tool.label} (${tool.shortcut})`}
            onClick={() => setTool(tool.id)}
            style={{
              width: 30,
              height: 30,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: "none",
              borderRadius: 4,
              // Blender 风格：激活=蓝色填充，非激活=透明
              background: isActive
                ? "rgba(74, 127, 194, 0.85)"
                : "transparent",
              color: isActive ? "#fff" : "#aaa",
              fontSize: 14,
              lineHeight: 1,
              cursor: "pointer",
              transition: "background 0.08s ease, color 0.08s ease",
            }}
            onMouseEnter={(e) => {
              const el = e.currentTarget;
              if (active !== tool.id) {
                el.style.background = "rgba(255,255,255,0.08)";
                el.style.color = "#ddd";
              }
            }}
            onMouseLeave={(e) => {
              const el = e.currentTarget;
              if (active !== tool.id) {
                el.style.background = "transparent";
                el.style.color = "#aaa";
              }
            }}
          >
            {tool.icon}
          </button>
        );
      })}
    </div>
  );
}


