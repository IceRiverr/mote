import { useRef, useCallback } from "preact/hooks";

interface DragCallbacks {
  onStart?: (e: PointerEvent) => void;
  onMove: (e: PointerEvent, delta: { dx: number; dy: number }) => void;
  onEnd?: (e: PointerEvent) => void;
}

export function useDrag(callbacks: DragCallbacks) {
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  const onPointerDown = useCallback((e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    cbRef.current.onStart?.(e);

    const onMove = (e: PointerEvent) => {
      cbRef.current.onMove(e, {
        dx: e.clientX - startX,
        dy: e.clientY - startY,
      });
    };

    const onUp = (e: PointerEvent) => {
      cbRef.current.onEnd?.(e);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, []);

  return { onPointerDown };
}
