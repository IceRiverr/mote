import type { SplitInfo } from "../layout/types";
import { layoutTree } from "../store/layout";
import { resizeSplit } from "../layout/tree";
import { useDrag } from "../hooks/useDrag";
import { HANDLE_SIZE } from "../layout/rect";
import { useRef } from "preact/hooks";

interface Props {
  info: SplitInfo;
}

export function SplitHandle({ info }: Props) {
  const { id, direction, ratio, rect } = info;
  const isVertical = direction === "vertical";
  const startRatio = useRef(ratio);

  const { onPointerDown } = useDrag({
    onStart: () => {
      startRatio.current = ratio;
      document.body.style.cursor = isVertical ? "col-resize" : "row-resize";
    },
    onMove: (_e, { dx, dy }) => {
      const delta = isVertical ? dx : dy;
      const total = isVertical ? rect.width : rect.height;
      if (total === 0) return;
      const newRatio = startRatio.current + delta / total;
      layoutTree.value = resizeSplit(layoutTree.value, id, newRatio);
    },
    onEnd: () => {
      document.body.style.cursor = "";
    },
  });

  const style = isVertical
    ? {
        left: rect.x + rect.width * ratio - HANDLE_SIZE / 2,
        top: rect.y,
        width: HANDLE_SIZE,
        height: rect.height,
        cursor: "col-resize" as const,
      }
    : {
        left: rect.x,
        top: rect.y + rect.height * ratio - HANDLE_SIZE / 2,
        width: rect.width,
        height: HANDLE_SIZE,
        cursor: "row-resize" as const,
      };

  return (
    <div
      onPointerDown={onPointerDown}
      style={{
        position: "absolute",
        ...style,
        zIndex: 100,
        background: "transparent",
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = "var(--handle-hover)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = "transparent";
      }}
    />
  );
}
