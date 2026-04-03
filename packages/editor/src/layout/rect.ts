import { LayoutNode, Rect, RectMap, SplitInfo } from './types';

export const HANDLE_SIZE = 4;

export function computeRects(
  node: LayoutNode,
  bounds: Rect,
  areas: RectMap,
  splits: SplitInfo[]
): void {
  if (node.type === 'area') {
    areas.set(node.id, { ...bounds });
    return;
  }

  const { direction, ratio, children, id } = node;

  if (direction === 'horizontal') {
    const splitY = bounds.y + Math.round(bounds.h * ratio);
    const topH = splitY - bounds.y - HANDLE_SIZE / 2;
    const bottomY = splitY + HANDLE_SIZE / 2;
    const bottomH = bounds.y + bounds.h - bottomY;

    splits.push({
      splitId: id,
      direction: 'horizontal',
      rect: { x: bounds.x, y: splitY - HANDLE_SIZE / 2, w: bounds.w, h: HANDLE_SIZE },
      parentBounds: { ...bounds },
    });

    computeRects(children[0], { x: bounds.x, y: bounds.y, w: bounds.w, h: topH }, areas, splits);
    computeRects(children[1], { x: bounds.x, y: bottomY, w: bounds.w, h: bottomH }, areas, splits);
  } else {
    const splitX = bounds.x + Math.round(bounds.w * ratio);
    const leftW = splitX - bounds.x - HANDLE_SIZE / 2;
    const rightX = splitX + HANDLE_SIZE / 2;
    const rightW = bounds.x + bounds.w - rightX;

    splits.push({
      splitId: id,
      direction: 'vertical',
      rect: { x: splitX - HANDLE_SIZE / 2, y: bounds.y, w: HANDLE_SIZE, h: bounds.h },
      parentBounds: { ...bounds },
    });

    computeRects(children[0], { x: bounds.x, y: bounds.y, w: leftW, h: bounds.h }, areas, splits);
    computeRects(children[1], { x: rightX, y: bounds.y, w: rightW, h: bounds.h }, areas, splits);
  }
}
