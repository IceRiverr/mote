// ═══════════════════════════════════════════════════════════════
// App.tsx - 主应用入口
// ═══════════════════════════════════════════════════════════════

// Register ALL editors
import "./editors/viewport/register";
import "./editors/inspector/register";
import "./editors/sprite-editor/register";
import "./editors/assets/register";
import "./editors/scene-tree/register";
import "./editors/console/register";
import "./editors/prefab-browser/register";

import { useEffect, useState } from "preact/hooks";
import { LayoutRoot } from "./components/LayoutRoot";
import { WelcomeScreen } from "./components/WelcomeScreen";
import { MenuBar } from "./components/MenuBar";
import { StatusBar } from "./components/StatusBar";
import { undo, redo } from "./store/history";
import { activeTool, type ToolType } from "./store/selection";
import { loadBuiltinEntityDefs } from "./store/entityDefs";
import {
  isProjectLoaded,
  initializeProjectStore,
  saveCurrentProject,
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
  const [showWelcome, setShowWelcome] = useState(true);

  // Initialize on mount
  useEffect(() => {
    initializeProjectStore();
    loadBuiltinEntityDefs();
  }, []);

  // Listen for project loaded state
  useEffect(() => {
    if (isProjectLoaded.value) {
      setShowWelcome(false);
    }
  }, [isProjectLoaded.value]);

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

      // Ctrl+Z / Cmd+Z -> Undo
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === "z") {
        e.preventDefault();
        undo();
        return;
      }

      // Ctrl+Shift+Z / Cmd+Shift+Z -> Redo
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "Z") {
        e.preventDefault();
        redo();
        return;
      }

      // Ctrl+Y / Cmd+Y -> Redo (alternative)
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

  // Show welcome screen
  if (showWelcome) {
    return (
      <WelcomeScreen
        onProjectOpened={() => setShowWelcome(false)}
      />
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100%",
      }}
    >
      <MenuBar
        onRequestWelcome={() => setShowWelcome(true)}
      />
      <div style={{ flex: 1, position: "relative", overflow: "hidden" }}>
        <LayoutRoot />
      </div>
      <StatusBar />
    </div>
  );
}
