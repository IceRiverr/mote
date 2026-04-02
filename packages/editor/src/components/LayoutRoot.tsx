import { useRef, useEffect } from "preact/hooks";
import { containerSize, layoutTree, layoutComputed } from "../store/layout";
import { collectAreas } from "../layout/tree";
import { AreaView } from "./AreaView";
import { SplitHandle } from "./SplitHandle";

export function LayoutRoot() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current!;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      containerSize.value = { width, height };
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const tree = layoutTree.value;
  const { areas: rectMap, splits } = layoutComputed.value;
  const areaNodes = collectAreas(tree);

  return (
    <div ref={ref} style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      {areaNodes.map((area) => {
        const rect = rectMap.get(area.id);
        return rect ? <AreaView key={area.id} area={area} rect={rect} /> : null;
      })}
      {splits.map((s) => (
        <SplitHandle key={s.id} info={s} />
      ))}
    </div>
  );
}
