import { useEffect, useRef } from 'preact/hooks';
import { containerSize, layoutComputed, layoutTree } from '../store/layout';
import { AreaView } from './AreaView';
import { SplitHandle } from './SplitHandle';
import { collectAreas } from '../layout/tree';

export function LayoutRoot() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      containerSize.value = { x: 0, y: 0, w: width, h: height };
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const { areas, splits } = layoutComputed.value;
  const areaNodes = collectAreas(layoutTree.value);

  return (
    <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {areaNodes.map((node) => {
        const rect = areas.get(node.id);
        if (!rect) return null;
        return <AreaView key={node.id} areaId={node.id} editorType={node.editorType} rect={rect} />;
      })}
      {splits.map((s) => (
        <SplitHandle key={s.splitId} splitInfo={s} />
      ))}
    </div>
  );
}
