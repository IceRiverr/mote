import { SplitInfo } from '../layout/types';
import { containerSize, layoutTree } from '../store/layout';
import { resizeSplit } from '../layout/tree';
import { useDrag } from '../hooks/useDrag';

interface Props {
  splitInfo: SplitInfo;
}

export function SplitHandle({ splitInfo }: Props) {
  const { splitId, direction, rect } = splitInfo;

  const { onPointerDown } = useDrag({
    onMove(e) {
      const bounds = containerSize.value;
      let ratio: number;
      if (direction === 'horizontal') {
        ratio = (e.clientY - bounds.y) / bounds.h;
      } else {
        ratio = (e.clientX - bounds.x) / bounds.w;
      }
      layoutTree.value = resizeSplit(layoutTree.value, splitId, ratio);
    },
  });

  return (
    <div
      onPointerDown={onPointerDown as any}
      style={{
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
        cursor: direction === 'horizontal' ? 'row-resize' : 'col-resize',
        background: '#111',
        zIndex: 10,
      }}
    />
  );
}
