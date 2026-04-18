// ═══════════════════════════════════════════════════════════════
// App.tsx - 主应用入口
// ═══════════════════════════════════════════════════════════════

// Register ALL editors
import "./editors/viewport/register";
import "./editors/inspector/register";
import "./editors/sprite-editor/register";
import "./editors/scene-tree/register";
import "./editors/console/register";
import "./editors/content-browser/register";

import { useEffect } from "preact/hooks";
import { LayoutRoot } from "./components/LayoutRoot";
import { MenuBar } from "./components/MenuBar";
import { StatusBar } from "./components/StatusBar";
import { activeTool, type ToolType } from "./store/selection";
import { loadBuiltinEntityDefs } from "./store/entityDefs";
import {
  initializeProjectStore,
  saveCurrentProject,
  createInMemoryProject,
} from "./project";

const TOOL_SHORTCUTS: Record<string, ToolType> = {
  v: "select",
  b: "brush",
  e: "eraser",
  g: "fill",
  i: "eyedropper",
  n: "entity",
};

export function App() {
  // Initialize on mount - auto create in-memory project
  useEffect(() => {
    initializeProjectStore();
    loadBuiltinEntityDefs();
    // Auto create an in-memory project so editor opens directly
    createInMemoryProject();
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Skip if focused on input/select/textarea
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA") return;

      // Ctrl+S -> Save
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        saveCurrentProject();
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
      <MenuBar />
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <LayoutRoot />
      </div>
      <StatusBar />
    </div>
  );
}
