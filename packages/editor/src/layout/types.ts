export type SplitDirection = "horizontal" | "vertical";

export interface AreaNode {
  id: string;
  type: "area";
  editorType: string;
}

export interface SplitNode {
  id: string;
  type: "split";
  direction: SplitDirection;
  ratio: number;
  children: [LayoutNode, LayoutNode];
}

export type LayoutNode = AreaNode | SplitNode;

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type RectMap = Map<string, Rect>;

/** Collected split info for rendering handles */
export interface SplitInfo {
  id: string;
  direction: SplitDirection;
  ratio: number;
  rect: Rect; // the parent rect this split divides
}
