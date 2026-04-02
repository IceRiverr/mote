/**
 * @mote/editor - Blender 风格的 2D 游戏编辑器
 */

export type { EditorType, AreaNode, LeafNode, SplitNode } from "./core/area-tree.js";
export { 
  EDITOR_TYPES, 
  createDefaultLayout,
  createLeaf,
  createSplit,
} from "./core/area-tree.js";
export { LayoutState, layoutState } from "./core/layout-state.js";

// Components
export { AreaPanel } from "./components/AreaPanel.js";
export { AreaHeader } from "./components/AreaHeader.js";
export { AreaTreeRenderer } from "./components/AreaTreeRenderer.js";
export { SplitPane } from "./components/SplitPane.js";
export { CornerHandle } from "./components/CornerHandle.js";
export { CollapsibleSection } from "./components/CollapsibleSection.js";

// Editors
export {
  ViewportEditor,
  SceneTreeEditor,
  InspectorEditor,
  AssetBrowserEditor,
} from "./editors/index.js";

// App entry
export { App } from "./app.js";
