import type { LeafNode } from "../core/area-tree.js";
import { useLayout } from "../core/layout-state.js";
import { AreaHeader } from "./AreaHeader.js";
import { CornerHandle } from "./CornerHandle.js";
import { ViewportEditor } from "../editors/ViewportEditor.js";
import { SceneTreeEditor } from "../editors/SceneTreeEditor.js";
import { InspectorEditor } from "../editors/InspectorEditor.js";
import { AssetBrowserEditor } from "../editors/AssetBrowserEditor.js";

interface AreaPanelProps {
  node: LeafNode;
}

export function AreaPanel({ node }: AreaPanelProps) {
  const layout = useLayout();

  const renderEditor = () => {
    switch (node.editorType) {
      case "viewport":
        return <ViewportEditor />;
      case "scene-tree":
        return <SceneTreeEditor />;
      case "inspector":
        return <InspectorEditor />;
      case "asset-browser":
        return <AssetBrowserEditor />;
      case "tilemap":
        return <div class="empty-state">Tilemap Editor (WIP)</div>;
      case "console":
        return <div class="empty-state">Console (WIP)</div>;
      case "code":
        return <div class="empty-state">Code Editor (WIP)</div>;
      default:
        return <div class="empty-state">Unknown Editor</div>;
    }
  };

  return (
    <div class="area-panel">
      <AreaHeader 
        editorType={node.editorType}
        onChangeType={(type) => layout.setEditorType(node.id, type)}
      />
      <div class="area-panel__content">
        {renderEditor()}
      </div>
      {/* Four corner handles for splitting/merging */}
      <CornerHandle corner="tl" areaId={node.id} />
      <CornerHandle corner="tr" areaId={node.id} />
      <CornerHandle corner="bl" areaId={node.id} />
      <CornerHandle corner="br" areaId={node.id} />
    </div>
  );
}
