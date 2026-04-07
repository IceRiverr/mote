export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface AreaNode {
  type: 'area';
  id: string;
  editorType: string;
}

export interface SplitNode {
  type: 'split';
  id: string;
  direction: 'horizontal' | 'vertical';
  ratio: number;
  children: [LayoutNode, LayoutNode];
}

export type LayoutNode = AreaNode | SplitNode;

export interface SplitInfo {
  splitId: string;
  direction: 'horizontal' | 'vertical';
  rect: Rect;
  /** Parent bounds — needed to calculate ratio correctly for nested splits */
  parentBounds: Rect;
}

export type RectMap = Map<string, Rect>;

/** Corner positions for area splitting */
export type Corner = 'tl' | 'tr' | 'bl' | 'br';
