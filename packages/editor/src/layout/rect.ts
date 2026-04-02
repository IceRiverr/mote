import type { LayoutNode, Rect, RectMap, SplitInfo } from "./types";

export const HANDLE_SIZE = 4;

export function computeRects(
  node: LayoutNode,
  rect: Rect,
  areas: RectMap = new Map(),
  splits: SplitInfo[] = []
): { areas: RectMap; splits: SplitInfo[] } {
  if (node.type === "area") {
    areas.set(node.id, rect);
    return { areas, splits };
  }

  const { direction, ratio, children, id } = node;
  const half = HANDLE_SIZE / 2;

  splits.push({ id, direction, ratio, rect });

  if (direction === "vertical") {
    const splitX = rect.x + rect.width * ratio;
    computeRects(
      children[0],
      { x: rect.x, y: rect.y, width: splitX - half - rect.x, height: rect.height },
      areas,
      splits
    );
    computeRects(
      children[1],
      { x: splitX + half, y: rect.y, width: rect.x + rect.width - splitX - half, height: rect.height },
      areas,
      splits
    );
  } else {
    const splitY = rect.y + rect.height * ratio;
    computeRects(
      children[0],
      { x: rect.x, y: rect.y, width: rect.width, height: splitY - half - rect.y },
      areas,
      splits
    );
    computeRects(
      children[1],
      { x: rect.x, y: splitY + half, width: rect.width, height: rect.y + rect.height - splitY - half },
      areas,
      splits
    );
  }

  return { areas, splits };
}
