import "./editors/tile-palette/register";
import "./editors/viewport/register";
import "./editors/inspector/register";

import { useEffect } from "preact/hooks";
import { LayoutRoot } from "./components/LayoutRoot";
import { undo, redo } from "./store/history";
import { activeTool, type ToolType } from "./store/selection";

const TOOL_SHORTCUTS: Record<string, ToolType> = {
  v: "select",
  b: "brush",
  e: "eraser",
  g: "fill",
  i: "eyedropper",
};

export function App() {
  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if focused on input/select/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;

      // Ctrl+Z / Cmd+Z → Undo
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        undo();
        return;
      }

      // Ctrl+Shift+Z / Cmd+Shift+Z → Redo
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "Z") {
        e.preventDefault();
        redo();
        return;
      }

      // Ctrl+Y / Cmd+Y → Redo (alternative)
      if ((e.ctrlKey || e.metaKey) && e.key === "y") {
        e.preventDefault();
        redo();
        return;
      }

      // Tool shortcuts (single key, no modifiers)
      if (!e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
        const tool = TOOL_SHORTCUTS[e.key.toLowerCase()];
        if (tool) {
          e.preventDefault();
          activeTool.value = tool;
          return;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
      }}
    >
      <div
        style={{
          height: 32,
          background: "#2a2a2a",
          borderBottom: "1px solid #111",
          display: "flex",
          alignItems: "center",
          paddingLeft: 12,
          fontWeight: 600,
          fontSize: 13,
          color: "#aaa",
          flexShrink: 0,
        }}
      >
        Mote Editor — 微尘
      </div>
      <div style={{ flex: 1, position: "relative" }}>
        <LayoutRoot />
      </div>
    </div>
  );
}
