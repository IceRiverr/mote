import { useState, useCallback, useRef } from "preact/hooks";
import type { SplitDirection, SplitNode } from "../core/area-tree.js";
import { useLayout } from "../core/layout-state.js";

interface SplitPaneProps {
  node: SplitNode;
  children: [preact.ComponentChild, preact.ComponentChild];
}

export function SplitPane({ node, children }: SplitPaneProps) {
  const layout = useLayout();
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const handlePointerDown = useCallback((e: PointerEvent) => {
    e.preventDefault();
    setIsDragging(true);
    
    const startPos = node.direction === "horizontal" ? e.clientX : e.clientY;
    const container = containerRef.current;
    if (!container) return;
    
    const containerSize = node.direction === "horizontal" 
      ? container.offsetWidth 
      : container.offsetHeight;
    const startRatio = node.ratio;

    const handlePointerMove = (e: PointerEvent) => {
      const currentPos = node.direction === "horizontal" ? e.clientX : e.clientY;
      const delta = currentPos - startPos;
      const newRatio = startRatio + delta / containerSize;
      layout.setRatio(node, Math.max(0.1, Math.min(0.9, newRatio)));
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
  }, [node, layout]);

  const isHorizontal = node.direction === "horizontal";
  const firstSize = `${node.ratio * 100}%`;
  const secondSize = `${(1 - node.ratio) * 100}%`;

  return (
    <div
      ref={containerRef}
      class={`split-pane ${node.direction}`}
      style={{ 
        width: "100%", 
        height: "100%",
        pointerEvents: isDragging ? "none" : undefined 
      }}
    >
      <div 
        class="split-pane__pane" 
        style={{ 
          [isHorizontal ? "width" : "height"]: firstSize 
        }}
      >
        {children[0]}
      </div>
      <div 
        class="split-pane__divider"
        onPointerDown={handlePointerDown}
      />
      <div 
        class="split-pane__pane" 
        style={{ 
          [isHorizontal ? "width" : "height"]: secondSize,
          flex: 1
        }}
      >
        {children[1]}
      </div>
    </div>
  );
}
