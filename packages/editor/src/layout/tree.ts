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

/** Find the nearest area in a subtree from a specific edge */
function findNearestArea(node: LayoutNode, fromEdge: 'start' | 'end'): AreaNode | null {
  if (node.type === 'area') return node;
  const childIndex = fromEdge === 'start' ? 0 : 1;
  return findNearestArea(node.children[childIndex], fromEdge);
}

/** Check if a node contains any areas */
function containsArea(node: LayoutNode): boolean {
  if (node.type === 'area') return true;
  return containsArea(node.children[0]) || containsArea(node.children[1]);
}

/** Merge an area with its sibling - keeps the target area, removes/adjusts sibling
 * If sibling is an area: sibling is removed, target expands
 * If sibling is a split: the nearest area in sibling is removed, target expands into that space
 */
export function mergeArea(
  root: LayoutNode,
  areaId: string
): LayoutNode {
  const parentInfo = findParent(root, areaId);
  if (!parentInfo) return root;

  const { node: parent, index } = parentInfo;
  const siblingIndex = index === 0 ? 1 : 0;
  const sibling = parent.children[siblingIndex];

  // If sibling is an area, simple merge: replace parent with target area
  if (sibling.type === 'area') {
    const targetArea = parent.children[index];
    function simpleReplace(node: LayoutNode): LayoutNode {
      if (node.type === 'split' && node.id === parent.id) {
        return targetArea;
      }
      if (node.type === 'area') return node;
      return {
        ...node,
        children: [simpleReplace(node.children[0]), simpleReplace(node.children[1])] as [LayoutNode, LayoutNode],
      };
    }
    return simpleReplace(root);
  }

  // Sibling is a split - we need to remove the nearest area from sibling
  // and let target area take that space
  // For index=0 (target on left/top), remove first area from sibling (leftmost/topmost)
  // For index=1 (target on right/bottom), remove last area from sibling (rightmost/bottommost)
  const edgeToRemove: 'start' | 'end' = index === 0 ? 'start' : 'end';

  function removeNearestArea(node: LayoutNode, edge: 'start' | 'end'): LayoutNode | null {
    if (node.type === 'area') {
      // Found the area to remove
      return null;
    }
    const childIndex = edge === 'start' ? 0 : 1;
    const otherIndex = edge === 'start' ? 1 : 0;
    const result = removeNearestArea(node.children[childIndex], edge);
    
    if (result === null) {
      // This child was removed, promote the other child
      return node.children[otherIndex];
    } else {
      // Child was modified, return updated split
      if (edge === 'start') {
        const newChildren: [LayoutNode, LayoutNode] = [result, node.children[otherIndex]];
        return { ...node, children: newChildren };
      } else {
        const newChildren: [LayoutNode, LayoutNode] = [node.children[otherIndex], result];
        return { ...node, children: newChildren };
      }
    }
  }

  const modifiedSibling = removeNearestArea(sibling, edgeToRemove);
  
  // If sibling became null or empty, just return target
  if (!modifiedSibling || !containsArea(modifiedSibling)) {
    const targetArea = parent.children[index];
    function removeParent(node: LayoutNode): LayoutNode {
      if (node.type === 'split' && node.id === parent.id) {
        return targetArea;
      }
      if (node.type === 'area') return node;
      return {
        ...node,
        children: [removeParent(node.children[0]), removeParent(node.children[1])] as [LayoutNode, LayoutNode],
      };
    }
    return removeParent(root);
  }

  // Type assertion: modifiedSibling is LayoutNode (not null)
  const validSibling = modifiedSibling as LayoutNode;

  // Replace sibling with modified version
  function replaceSibling(node: LayoutNode): LayoutNode {
    if (node.type === 'split' && node.id === parent.id) {
      const newChildren: [LayoutNode, LayoutNode] = index === 0
        ? [node.children[0], validSibling]
        : [validSibling, node.children[1]];
      return { ...node, children: newChildren };
    }
    if (node.type === 'area') return node;
    return {
      ...node,
      children: [replaceSibling(node.children[0]), replaceSibling(node.children[1])] as [LayoutNode, LayoutNode],
    };
  }

  return replaceSibling(root);
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
