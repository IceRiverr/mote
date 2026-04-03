import { useCallback, useRef } from 'preact/hooks';

interface DragCallbacks {
  onStart?: (e: PointerEvent) => void;
  onMove?: (e: PointerEvent) => void;
  onEnd?: (e: PointerEvent) => void;
}

export function useDrag(callbacks: DragCallbacks) {
  const cbRef = useRef(callbacks);
  cbRef.current = callbacks;

  const onPointerDown = useCallback((e: PointerEvent) => {
    e.preventDefault();
    const target = e.currentTarget as HTMLElement;
    target.setPointerCapture(e.pointerId);
    cbRef.current.onStart?.(e);

    const onMove = (ev: PointerEvent) => {
      cbRef.current.onMove?.(ev);
    };
    const onUp = (ev: PointerEvent) => {
      target.releasePointerCapture(ev.pointerId);
      target.removeEventListener('pointermove', onMove as EventListener);
      target.removeEventListener('pointerup', onUp as EventListener);
      cbRef.current.onEnd?.(ev);
    };
    target.addEventListener('pointermove', onMove as EventListener);
    target.addEventListener('pointerup', onUp as EventListener);
  }, []);

  return { onPointerDown };
}
