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
}

export type RectMap = Map<string, Rect>;
