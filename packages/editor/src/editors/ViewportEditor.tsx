/**
 * Viewport Editor - 场景视口
 * 
 * 集成 mote 引擎渲染，提供 2D 场景预览和编辑
 */

import { useEffect, useRef } from "preact/hooks";

export function ViewportEditor() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Initialize engine viewport
    // This will be integrated with @mote/engine
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        canvas.width = width;
        canvas.height = height;
      }
    });

    resizeObserver.observe(canvas.parentElement!);

    // Placeholder rendering
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const render = () => {
        ctx.fillStyle = "#1a1a2a";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        // Grid
        ctx.strokeStyle = "#2a2a3a";
        ctx.lineWidth = 1;
        const gridSize = 32;
        
        for (let x = 0; x < canvas.width; x += gridSize) {
          ctx.beginPath();
          ctx.moveTo(x, 0);
          ctx.lineTo(x, canvas.height);
          ctx.stroke();
        }
        
        for (let y = 0; y < canvas.height; y += gridSize) {
          ctx.beginPath();
          ctx.moveTo(0, y);
          ctx.lineTo(canvas.width, y);
          ctx.stroke();
        }

        // Placeholder text
        ctx.fillStyle = "#5a5a6a";
        ctx.font = "14px Inter, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(
          "Viewport - Engine integration WIP",
          canvas.width / 2,
          canvas.height / 2
        );

        requestAnimationFrame(render);
      };
      
      const rafId = requestAnimationFrame(render);
      return () => {
        cancelAnimationFrame(rafId);
        resizeObserver.disconnect();
      };
    }

    return () => resizeObserver.disconnect();
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        width: "100%",
        height: "100%",
        display: "block",
      }}
    />
  );
}
