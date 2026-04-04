import { useRef, useEffect, useCallback, useState } from "preact/hooks";
import { signal } from "@preact/signals";
import {
  spriteAtlases,
  atlasImages,
  activeAtlasId,
  activeFrameId,
  activeAtlas,
} from "../../store/atlas";
import { activeEntityDefId } from "../../store/selection";
import type { SpriteAtlas, SpriteFrame } from "../../data/SpriteAtlas";

// ---- Internal signals for canvas state ----
const panelCam = signal({ x: 0, y: 0 });
const panelZoom = signal(1);

/** Search / filter term */
export const spriteFilterText = signal("");

interface Props {
  /** Callback when a frame is selected */
  onFrameSelect?: (frame: SpriteFrame) => void;
}

export function SpritePanelCanvas({ onFrameSelect }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoverIdx = useRef<number>(-1);
  const [tooltip, setTooltip] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);

  // ---- Derived data ----
  const getFilteredFrames = useCallback((): SpriteFrame[] => {
    const atlas = activeAtlas.value;
    if (!atlas) return [];
    const q = spriteFilterText.value.toLowerCase().trim();
    if (!q) return atlas.frames;
    return atlas.frames.filter(
      (f) =>
        f.name.toLowerCase().includes(q) ||
        f.id.toLowerCase().includes(q) ||
        (f.tags && f.tags.some((t) => t.toLowerCase().includes(q)))
    );
  }, []);

  /** Compute grid layout parameters based on container width */
  const getGridLayout = useCallback(
    (
      containerW: number,
      frames: SpriteFrame[]
    ): {
      cols: number;
      cellSize: number;
      thumbSize: number;
      padding: number;
      rows: number;
    } => {
      const zoom = panelZoom.value;
      const baseCellSize = 64;
      const cellSize = Math.max(32, Math.round(baseCellSize * zoom));
      const padding = 4;
      const cols = Math.max(1, Math.floor((containerW + padding) / (cellSize + padding)));
      const rows = Math.ceil(frames.length / cols);
      const thumbSize = cellSize - 8; // inner thumbnail with padding
      return { cols, cellSize, thumbSize, padding, rows };
    },
    []
  );

  // ---- Drawing ----
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const atlas = activeAtlas.value;
    const img = atlas ? atlasImages.value.get(atlas.id) : null;
    const frames = getFilteredFrames();
    const cam = panelCam.value;

    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = container.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + "px";
    canvas.style.height = h + "px";
    const ctx = canvas.getContext("2d")!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;

    if (!atlas) {
      ctx.fillStyle = "#888";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("在检查器面板中导入 Sprite Atlas", w / 2, h / 2);
      return;
    }

    if (frames.length === 0) {
      ctx.fillStyle = "#888";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(
        spriteFilterText.value ? "未找到匹配帧" : "图集无帧",
        w / 2,
        h / 2
      );
      return;
    }

    const { cols, cellSize, thumbSize, padding, rows } = getGridLayout(
      w,
      frames
    );

    ctx.save();
    ctx.translate(-cam.x, -cam.y);

    const selectedFrameId = activeFrameId.value;

    for (let i = 0; i < frames.length; i++) {
      const frame = frames[i];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = col * (cellSize + padding);
      const cy = row * (cellSize + padding);

      // Cell background
      const isSelected = frame.id === selectedFrameId;
      const isHovered = i === hoverIdx.current;

      if (isSelected) {
        ctx.fillStyle = "rgba(74, 144, 217, 0.35)";
        ctx.fillRect(cx, cy, cellSize, cellSize);
        ctx.strokeStyle = "rgba(74, 144, 217, 0.9)";
        ctx.lineWidth = 2;
        ctx.strokeRect(cx + 1, cy + 1, cellSize - 2, cellSize - 2);
      } else if (isHovered) {
        ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
        ctx.fillRect(cx, cy, cellSize, cellSize);
        ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
        ctx.lineWidth = 1;
        ctx.strokeRect(cx + 0.5, cy + 0.5, cellSize - 1, cellSize - 1);
      } else {
        ctx.fillStyle = "rgba(255, 255, 255, 0.03)";
        ctx.fillRect(cx, cy, cellSize, cellSize);
      }

      // Draw frame thumbnail
      if (img) {
        const innerPad = 4;
        const drawArea = thumbSize;
        // Fit frame into drawArea while maintaining aspect ratio
        const scale = Math.min(
          drawArea / frame.width,
          drawArea / frame.height,
          1
        );
        const dw = frame.width * scale;
        const dh = frame.height * scale;
        const dx = cx + innerPad + (drawArea - dw) / 2;
        const dy = cy + innerPad + (drawArea - dh) / 2;

        if (frame.rotated) {
          ctx.save();
          ctx.translate(dx + dw / 2, dy + dh / 2);
          ctx.rotate(-Math.PI / 2);
          ctx.drawImage(
            img,
            frame.x,
            frame.y,
            frame.height,
            frame.width,
            -dh / 2,
            -dw / 2,
            dh,
            dw
          );
          ctx.restore();
        } else {
          ctx.drawImage(
            img,
            frame.x,
            frame.y,
            frame.width,
            frame.height,
            dx,
            dy,
            dw,
            dh
          );
        }
      }

      // Frame name (truncated)
      if (cellSize >= 48) {
        ctx.fillStyle = "#bbb";
        ctx.font = "9px sans-serif";
        ctx.textAlign = "center";
        const label =
          frame.name.length > 10
            ? frame.name.slice(0, 9) + "…"
            : frame.name;
        ctx.fillText(label, cx + cellSize / 2, cy + cellSize - 2);
      }
    }

    ctx.restore();

    // Bottom overflow fade
    const totalH = rows * (cellSize + padding) - cam.y;
    if (totalH > h) {
      const grad = ctx.createLinearGradient(0, h - 20, 0, h);
      grad.addColorStop(0, "rgba(30,30,30,0)");
      grad.addColorStop(1, "rgba(30,30,30,0.8)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, h - 20, w, 20);
    }
  }, []);

  // Redraw on relevant signal changes
  useEffect(() => {
    draw();
  }, [
    activeAtlasId.value,
    activeFrameId.value,
    spriteAtlases.value,
    atlasImages.value,
    spriteFilterText.value,
    panelCam.value,
    panelZoom.value,
  ]);

  // Resize observer
  useEffect(() => {
    const el = containerRef.current!;
    const ro = new ResizeObserver(() => draw());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Reset camera when atlas changes
  useEffect(() => {
    panelCam.value = { x: 0, y: 0 };
    panelZoom.value = 1;
  }, [activeAtlasId.value]);

  // ---- Hit testing ----
  const screenToIndex = (clientX: number, clientY: number): number => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return -1;
    const frames = getFilteredFrames();
    if (frames.length === 0) return -1;

    const rect = canvas.getBoundingClientRect();
    const cam = panelCam.value;
    const w = container.clientWidth;
    const { cols, cellSize, padding } = getGridLayout(w, frames);

    const x = clientX - rect.left + cam.x;
    const y = clientY - rect.top + cam.y;
    const col = Math.floor(x / (cellSize + padding));
    const row = Math.floor(y / (cellSize + padding));
    if (col < 0 || col >= cols || row < 0) return -1;

    // Check we're inside the cell, not in padding
    const cellX = x - col * (cellSize + padding);
    const cellY = y - row * (cellSize + padding);
    if (cellX > cellSize || cellY > cellSize) return -1;

    const idx = row * cols + col;
    return idx < frames.length ? idx : -1;
  };

  // ---- Event handlers ----
  const onPointerDown = (e: PointerEvent) => {
    // Middle-click or Alt+click → pan
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      const startCam = { ...panelCam.value };
      const startX = e.clientX;
      const startY = e.clientY;
      const onMove = (ev: PointerEvent) => {
        panelCam.value = {
          x: Math.max(0, startCam.x - (ev.clientX - startX)),
          y: Math.max(0, startCam.y - (ev.clientY - startY)),
        };
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      return;
    }

    // Left click → select frame
    if (e.button === 0) {
      const idx = screenToIndex(e.clientX, e.clientY);
      if (idx < 0) return;
      const frames = getFilteredFrames();
      const frame = frames[idx];
      activeFrameId.value = frame.id;
      onFrameSelect?.(frame);
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    const idx = screenToIndex(e.clientX, e.clientY);
    if (idx !== hoverIdx.current) {
      hoverIdx.current = idx;
      draw();
      // Update tooltip
      if (idx >= 0) {
        const frames = getFilteredFrames();
        const frame = frames[idx];
        const rect = containerRef.current!.getBoundingClientRect();
        setTooltip({
          text: `${frame.name}  (${frame.width}×${frame.height})`,
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      } else {
        setTooltip(null);
      }
    } else if (idx >= 0) {
      const rect = containerRef.current!.getBoundingClientRect();
      setTooltip((prev) =>
        prev
          ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top }
          : prev
      );
    }
  };

  const onPointerLeave = () => {
    if (hoverIdx.current >= 0) {
      hoverIdx.current = -1;
      draw();
    }
    setTooltip(null);
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Zoom
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      panelZoom.value = Math.min(4, Math.max(0.25, panelZoom.value + delta));
    } else {
      // Scroll
      const cam = panelCam.value;
      panelCam.value = { ...cam, y: Math.max(0, cam.y + e.deltaY) };
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        cursor: "pointer",
        position: "relative",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onWheel={onWheel}
    >
      <canvas
        ref={canvasRef}
        style={{ display: "block", imageRendering: "pixelated" }}
      />
      {tooltip && (
        <div
          style={{
            position: "absolute",
            left: tooltip.x + 12,
            top: tooltip.y - 28,
            background: "rgba(0,0,0,0.85)",
            color: "#ddd",
            fontSize: 11,
            padding: "3px 8px",
            borderRadius: 4,
            pointerEvents: "none",
            whiteSpace: "nowrap",
            zIndex: 10,
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  );
}
