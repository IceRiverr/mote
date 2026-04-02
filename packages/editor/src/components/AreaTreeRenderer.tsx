import type { AreaNode } from "../core/area-tree.js";
import { SplitPane } from "./SplitPane.js";
import { AreaPanel } from "./AreaPanel.js";

interface AreaTreeRendererProps {
  node: AreaNode;
}

export function AreaTreeRenderer({ node }: AreaTreeRendererProps) {
  if (node.type === "leaf") {
    return <AreaPanel node={node} />;
  }

  return (
    <SplitPane node={node}>
      <AreaTreeRenderer node={node.first} />
      <AreaTreeRenderer node={node.second} />
    </SplitPane>
  );
}
