import { useLayout } from "../core/layout-state.js";

interface CornerHandleProps {
  corner: "tl" | "tr" | "bl" | "br";
  areaId: string;
}

export function CornerHandle({ corner, areaId }: CornerHandleProps) {
  const layout = useLayout();

  const handlePointerDown = (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.clientX;
    const startY = e.clientY;

    const handlePointerMove = (e: PointerEvent) => {
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);

      // Minimum drag distance to trigger
      if (absDx < 20 && absDy < 20) return;

      // Determine direction
      const isHorizontal = absDx > absDy;
      
      // Determine if inward based on corner
      const inwardH = (corner === "tl" || corner === "bl") ? dx > 0 : dx < 0;
      const inwardV = (corner === "tl" || corner === "tr") ? dy > 0 : dy < 0;
      const isInward = isHorizontal ? inwardH : inwardV;

      if (isInward) {
        // Split
        const direction = isHorizontal ? "horizontal" : "vertical";
        layout.split(areaId, direction);
      } else {
        // Merge - remove this area
        layout.remove(areaId);
      }

      cleanup();
    };

    const handlePointerUp = () => {
      cleanup();
    };

    const cleanup = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  };

  return (
    <div
      class={`corner-handle ${corner}`}
      onPointerDown={handlePointerDown}
      title="Drag inward to split, outward to merge"
    />
  );
}
