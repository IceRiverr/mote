import { useRef } from 'preact/hooks';
import { SplitInfo } from '../layout/types';
import { layoutTree } from '../store/layout';
import { resizeSplit } from '../layout/tree';
import { useDrag } from '../hooks/useDrag';

interface Props {
  splitInfo: SplitInfo;
}

export function SplitHandle({ splitInfo }: Props) {
  const { splitId, direction, rect, parentBounds } = splitInfo;
  const handleRef = useRef<HTMLDivElement>(null);

  const { onPointerDown } = useDrag({
    onMove(e) {
      // Get the layout container (grandparent of the handle)
      const container = handleRef.current?.parentElement;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();

      // Convert clientX/Y to layout-local coordinates, then compute ratio
      let ratio: number;
      if (direction === 'horizontal') {
        const localY = e.clientY - containerRect.top;
        ratio = (localY - parentBounds.y) / parentBounds.h;
      } else {
        const localX = e.clientX - containerRect.left;
        ratio = (localX - parentBounds.x) / parentBounds.w;
      }
      layoutTree.value = resizeSplit(layoutTree.value, splitId, ratio);
    },
  });

  return (
    <div
      ref={handleRef}
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
