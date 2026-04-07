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

/** Find parent split node of a given area */
export function findParent(root: LayoutNode, areaId: string): { node: SplitNode; index: 0 | 1 } | null {
  if (root.type === 'area') return null;
  
  for (let i = 0; i < 2; i++) {
    const child = root.children[i];
    if (child.type === 'area' && child.id === areaId) {
      return { node: root, index: i as 0 | 1 };
    }
    const found = findParent(child, areaId);
    if (found) return found;
  }
  return null;
}

/** Check if drag from corner should merge with adjacent panel instead of splitting */
export function shouldMerge(
  parentInfo: { node: SplitNode; index: 0 | 1 } | null,
  corner: import('./types').Corner,
  direction: 'horizontal' | 'vertical'
): boolean {
  if (!parentInfo) return false;
  
  const { node: parent, index } = parentInfo;
  const isFirstChild = index === 0;
  
  // Merge when drag direction points toward the sibling
  if (parent.direction === 'vertical' && direction === 'vertical') {
    // Vertical split: children are [left, right]
    // Left child (index=0): tr/br corners drag right → merge to right
    // Right child (index=1): tl/bl corners drag left → merge to left
    const isLeftCorner = corner === 'tl' || corner === 'bl';
    const isRightCorner = corner === 'tr' || corner === 'br';
    if (isFirstChild && isRightCorner) return true; // Left panel drag right
    if (!isFirstChild && isLeftCorner) return true; // Right panel drag left
  }
  
  if (parent.direction === 'horizontal' && direction === 'horizontal') {
    // Horizontal split: children are [top, bottom]
    // Top child (index=0): bl/br corners drag down → merge to bottom
    // Bottom child (index=1): tl/tr corners drag up → merge to top
    const isTopCorner = corner === 'tl' || corner === 'tr';
    const isBottomCorner = corner === 'bl' || corner === 'br';
    if (isFirstChild && isBottomCorner) return true; // Top panel drag down
    if (!isFirstChild && isTopCorner) return true; // Bottom panel drag up
  }
  
  return false;
}

/** Merge an area with its sibling - keeps the target area, removes sibling */
export function mergeArea(
  root: LayoutNode,
  areaId: string
): LayoutNode {
  const parentInfo = findParent(root, areaId);
  if (!parentInfo) return root; // Can't merge root or orphan

  const { node: parent, index } = parentInfo;
  const targetArea = parent.children[index]; // Keep this

  // Replace parent with target area (removing the sibling)
  function replaceParent(node: LayoutNode): LayoutNode {
    if (node.type === 'split' && node.id === parent.id) {
      return targetArea;
    }
    if (node.type === 'area') return node;
    return {
      ...node,
      children: [replaceParent(node.children[0]), replaceParent(node.children[1])] as [LayoutNode, LayoutNode],
    };
  }

  return replaceParent(root);
}

/** Split an area from a specific corner with a direction */
export function splitAreaFromCorner(
  root: LayoutNode,
  areaId: string,
  corner: import('./types').Corner,
  direction: 'horizontal' | 'vertical',
  ratio = 0.5
): LayoutNode {
  // Find the source area to inherit editorType
  const sourceArea = findArea(root, areaId);
  const editorType = sourceArea?.editorType ?? 'viewport';
  const newArea: AreaNode = { type: 'area', id: genId('area'), editorType };
  
  // Always create a new split node replacing the target area
  return mapNode(root, (node) => {
    if (node.type === 'area' && node.id === areaId) {
      // Determine child order based on corner and direction
      // The split always creates: first child (ratio), second child (1-ratio)
      // direction='horizontal': split is horizontal line, children are top/bottom
      // direction='vertical': split is vertical line, children are left/right
      let children: [LayoutNode, LayoutNode];
      
      if (direction === 'horizontal') {
        // Horizontal split: children are [top, bottom]
        // ratio is height of top child
        // tl/tr (drag from top) = keep original on top, new on bottom
        // bl/br (drag from bottom) = new on top, original on bottom
        const isTopCorner = corner === 'tl' || corner === 'tr';
        children = isTopCorner 
          ? [{ ...node }, newArea]   // [original, new] - original keeps top portion
          : [newArea, { ...node }]; // [new, original] - original moves to bottom
      } else {
        // Vertical split: children are [left, right]
        // ratio is width of left child
        // tl/bl (drag from left) = keep original on left, new on right
        // tr/br (drag from right) = new on left, original on right
        const isLeftCorner = corner === 'tl' || corner === 'bl';
        children = isLeftCorner
          ? [{ ...node }, newArea]   // [original, new] - original keeps left portion
          : [newArea, { ...node }]; // [new, original] - original moves to right
      }
      
      const split: SplitNode = {
        type: 'split',
        id: genId('split'),
        direction,
        ratio: Math.max(0.1, Math.min(0.9, ratio)),
        children,
      };
      return split;
    }
    return null;
  });
}
