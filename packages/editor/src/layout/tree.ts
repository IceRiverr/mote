import { LayoutNode, AreaNode, SplitNode } from './types';

let nextId = 1;
function genId(prefix: string) {
  return `${prefix}_${nextId++}`;
}

export function mapNode(
  root: LayoutNode,
  fn: (node: LayoutNode) => LayoutNode | null
): LayoutNode {
  const result = fn(root);
  if (result !== null) return result;
  if (root.type === 'area') return root;
  return {
    ...root,
    children: [
      mapNode(root.children[0], fn),
      mapNode(root.children[1], fn),
    ],
  } as SplitNode;
}

export function splitArea(
  root: LayoutNode,
  areaId: string,
  direction: 'horizontal' | 'vertical',
  ratio = 0.5
): LayoutNode {
  return mapNode(root, (node) => {
    if (node.type === 'area' && node.id === areaId) {
      const newArea: AreaNode = { type: 'area', id: genId('area'), editorType: node.editorType };
      const split: SplitNode = {
        type: 'split',
        id: genId('split'),
        direction,
        ratio,
        children: [{ ...node }, newArea],
      };
      return split;
    }
    return null;
  });
}

export function resizeSplit(
  root: LayoutNode,
  splitId: string,
  newRatio: number
): LayoutNode {
  const clamped = Math.max(0.1, Math.min(0.9, newRatio));
  return mapNode(root, (node) => {
    if (node.type === 'split' && node.id === splitId) {
      return { ...node, ratio: clamped };
    }
    return null;
  });
}

export function setEditorType(
  root: LayoutNode,
  areaId: string,
  editorType: string
): LayoutNode {
  return mapNode(root, (node) => {
    if (node.type === 'area' && node.id === areaId) {
      return { ...node, editorType };
    }
    return null;
  });
}

export function collectAreas(root: LayoutNode): AreaNode[] {
  if (root.type === 'area') return [root];
  return [
    ...collectAreas(root.children[0]),
    ...collectAreas(root.children[1]),
  ];
}

export function findArea(root: LayoutNode, areaId: string): AreaNode | null {
  if (root.type === 'area') return root.id === areaId ? root : null;
  return findArea(root.children[0], areaId) || findArea(root.children[1], areaId);
}
