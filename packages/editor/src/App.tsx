import { LayoutRoot } from "./components/LayoutRoot";

// Register all editors (side effects)
import "./editors/viewport/ViewportEditor";
import "./editors/tile-palette/TilePaletteEditor";
import "./editors/inspector/InspectorEditor";

export function App() {
  return (
    <div style={{ width: "100vw", height: "100vh", display: "flex", flexDirection: "column" }}>
      {/* Global top bar */}
      <div
        style={{
          height: 36,
          background: "#1a1a1a",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "center",
          padding: "0 12px",
          gap: 12,
          flexShrink: 0,
        }}
      >
        <span style={{ fontWeight: 700, color: "var(--accent)", fontSize: 13, letterSpacing: 1 }}>
          微尘 EDITOR
        </span>
        <span style={{ color: "var(--text-secondary)", fontSize: 11 }}>
          Tilemap 工作区
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ color: "var(--text-secondary)", fontSize: 10 }}>v0.1.0</span>
      </div>

      {/* Layout area */}
      <div style={{ flex: 1, position: "relative" }}>
        <LayoutRoot />
      </div>
    </div>
  );
}
