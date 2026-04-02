/**
 * App - 编辑器主应用
 */

import { layoutState } from "./core/layout-state.js";
import { GlobalMenuBar } from "./components/GlobalMenuBar.js";
import { AreaTreeRenderer } from "./components/AreaTreeRenderer.js";
import "./index.css";

export function App() {
  // Subscribe to layout changes
  const root = layoutState.root;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <GlobalMenuBar />
      <div style={{ flex: 1, overflow: "hidden" }}>
        <AreaTreeRenderer node={root.value} />
      </div>
    </div>
  );
}
