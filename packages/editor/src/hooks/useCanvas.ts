import { useRef, useEffect } from "preact/hooks";

/**
 * Manages a Canvas element with proper DPR scaling and resize handling.
 * Returns a ref to attach to a container div.
 * Calls `onDraw` whenever the canvas needs repainting.
 */
export function useCanvas(
  onDraw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void,
  deps: any[] = []
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let canvas = canvasRef.current;
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.style.display = "block";
      canvas.style.width = "100%";
      canvas.style.height = "100%";
      container.appendChild(canvas);
      canvasRef.current = canvas;
    }

    const ctx = canvas.getContext("2d")!;

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const w = container.clientWidth;
      const h = container.clientHeight;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      draw();
    };

    const draw = () => {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        ctx.clearRect(0, 0, w, h);
        onDraw(ctx, w, h);
      });
    };

    const ro = new ResizeObserver(() => resize());
    ro.observe(container);
    resize();

    return () => {
      ro.disconnect();
      cancelAnimationFrame(rafRef.current);
    };
  }, deps);

  return { containerRef, canvasRef };
}
