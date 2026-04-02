import type { LayoutNode, AreaNode, SplitNode, SplitDirection } from "./types";

let _uid = 0;
export const uid = (prefix = "id") => `${prefix}_${++_uid}`;

/** Deep-map every node in the tree */
export function mapNode(
  node: LayoutNode,
  fn: (n: LayoutNode) => LayoutNode
): LayoutNode {
  const mapped = fn(node);
  if (mapped.type === "split") {
    return {
      ...mapped,
      children: [
        mapNode(mapped.children[0], fn),
        mapNode(mapped.children[1], fn),
      ],
    } as SplitNode;
  }
  return mapped;
}

/** Find an area node by ID */
export function findArea(
  node: LayoutNode,
  id: string
): AreaNode | null {
  if (node.type === "area") return node.id === id ? node : null;
  return findArea(node.children[0], id) || findArea(node.children[1], id);
}

/** Collect all area nodes */
export function collectAreas(node: LayoutNode): AreaNode[] {
  if (node.type === "area") return [node];
  return [
    ...collectAreas(node.children[0]),
    ...collectAreas(node.children[1]),
  ];
}

/** Split an area into two */
export function splitArea(
  root: LayoutNode,
  targetId: string,
  direction: SplitDirection,
  ratio = 0.5
): LayoutNode {
  return mapNode(root, (node) => {
    if (node.type !== "area" || node.id !== targetId) return node;
    const newArea: AreaNode = {
      id: uid("area"),
      type: "area",
      editorType: node.editorType,
    };
    const split: SplitNode = {
      id: uid("split"),
      type: "split",
      direction,
      ratio,
      children: [{ ...node }, newArea],
    };
    return split;
  });
}

/** Resize a split node */
export function resizeSplit(
  root: LayoutNode,
  splitId: string,
  newRatio: number
): LayoutNode {
  const clamped = Math.max(0.1, Math.min(0.9, newRatio));
  return mapNode(root, (node) => {
    if (node.id !== splitId || node.type !== "split") return node;
    return { ...node, ratio: clamped };
  });
}

/** Change the editor type of an area */
export function setEditorType(
  root: LayoutNode,
  areaId: string,
  editorType: string
): LayoutNode {
  return mapNode(root, (node) => {
    if (node.type !== "area" || node.id !== areaId) return node;
    return { ...node, editorType };
  });
}
