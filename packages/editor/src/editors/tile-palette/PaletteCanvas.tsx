import { useRef, useEffect, useCallback, useState } from "preact/hooks";
import { signal } from "@preact/signals";
import { tilesets, tilesetImages, currentMap } from "../../store/project";
import {
  activeTool,
  activeTilesetId,
  brushTiles,
  brushWidth,
  brushHeight,
  displayScale,
} from "../../store/selection";
import { getTileSrcRect } from "../../data/TileSet";
import type { TileSet } from "../../data/TileSet";
import { TileContextMenu } from "./TileContextMenu";

/** Palette camera for pan support */
const paletteCam = signal({ x: 0, y: 0 });

export function PaletteCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selStart = useRef<{ col: number; row: number } | null>(null);
  const selEnd = useRef<{ col: number; row: number } | null>(null);
  const hoverCell = useRef<{ col: number; row: number } | null>(null);

  // Context menu state
  const [ctxMenu, setCtxMenu] = useState<{
    x: number;
    y: number;
    localId: number;
    tilesetId: string;
  } | null>(null);

  const getTs = (): TileSet | null => {
    const id = activeTilesetId.value;
    return id ? tilesets.value.find((t) => t.id === id) ?? null : null;
  };

  const getCellSize = (ts: TileSet | null) => {
    const scale = displayScale.value;
    return {
      cellW: ts ? Math.max(1, Math.round(ts.tileWidth * scale)) : 32,
      cellH: ts ? Math.max(1, Math.round(ts.tileHeight * scale)) : 32,
    };
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ts = getTs();
    const img = ts ? tilesetImages.value.get(ts.id) : null;
    const { cellW, cellH } = getCellSize(ts);
    const cam = paletteCam.value;

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

    if (!ts || !img) {
      ctx.fillStyle = "#888";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("点击「导入」添加瓦片集", w / 2, h / 2);
      return;
    }

    ctx.save();
    ctx.translate(-cam.x, -cam.y);

    // Draw tiles
    for (let r = 0; r < ts.rows; r++) {
      for (let c = 0; c < ts.columns; c++) {
        const localId = r * ts.columns + c;
        const src = getTileSrcRect(ts, localId);
        ctx.drawImage(
          img,
          src.sx, src.sy, src.sw, src.sh,
          c * cellW, r * cellH, cellW, cellH
        );
      }
    }

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    for (let c = 0; c <= ts.columns; c++) {
      ctx.beginPath();
      ctx.moveTo(c * cellW + 0.5, 0);
      ctx.lineTo(c * cellW + 0.5, ts.rows * cellH);
      ctx.stroke();
    }
    for (let r = 0; r <= ts.rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * cellH + 0.5);
      ctx.lineTo(ts.columns * cellW, r * cellH + 0.5);
      ctx.stroke();
    }

    // Hover highlight
    const hover = hoverCell.current;
    if (hover && hover.col >= 0 && hover.col < ts.columns && hover.row >= 0 && hover.row < ts.rows) {
      ctx.fillStyle = "rgba(255,255,255,0.12)";
      ctx.fillRect(hover.col * cellW, hover.row * cellH, cellW, cellH);
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.lineWidth = 1;
      ctx.strokeRect(hover.col * cellW + 0.5, hover.row * cellH + 0.5, cellW - 1, cellH - 1);
    }

    // Selection highlight
    const bt = brushTiles.value;
    if (bt.length > 0) {
      const map = currentMap.value;
      const ref = map.tilesets.find((r) => r.tilesetId === ts.id);
      if (ref) {
        const firstLocal = bt[0] - ref.firstGid;
        if (firstLocal >= 0) {
          const startCol = firstLocal % ts.columns;
          const startRow = Math.floor(firstLocal / ts.columns);
          ctx.strokeStyle = "rgba(74,144,217,0.9)";
          ctx.lineWidth = 2;
          ctx.strokeRect(
            startCol * cellW, startRow * cellH,
            brushWidth.value * cellW, brushHeight.value * cellH
          );
          ctx.fillStyle = "rgba(74,144,217,0.2)";
          ctx.fillRect(
            startCol * cellW, startRow * cellH,
            brushWidth.value * cellW, brushHeight.value * cellH
          );
        }
      }
    }

    ctx.restore();

    // Bottom fade indicator (if content overflows)
    const totalH = ts.rows * cellH - cam.y;
    if (totalH > h) {
      const grad = ctx.createLinearGradient(0, h - 24, 0, h);
      grad.addColorStop(0, "rgba(30,30,30,0)");
      grad.addColorStop(1, "rgba(30,30,30,0.8)");
      ctx.fillStyle = grad;
      ctx.fillRect(0, h - 24, w, 24);
    }

    // Right fade indicator (if content overflows horizontally)
    const totalW = ts.columns * cellW - cam.x;
    if (totalW > w) {
      const grad = ctx.createLinearGradient(w - 24, 0, w, 0);
      grad.addColorStop(0, "rgba(30,30,30,0)");
      grad.addColorStop(1, "rgba(30,30,30,0.8)");
      ctx.fillStyle = grad;
      ctx.fillRect(w - 24, 0, 24, h);
    }
  }, []);

  // Redraw on signal changes
  useEffect(() => {
    draw();
  }, [
    activeTilesetId.value,
    tilesets.value,
    tilesetImages.value,
    brushTiles.value,
    displayScale.value,
    paletteCam.value,
  ]);

  // Resize
  useEffect(() => {
    const el = containerRef.current!;
    const ro = new ResizeObserver(() => draw());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Reset camera when tileset changes
  useEffect(() => {
    paletteCam.value = { x: 0, y: 0 };
  }, [activeTilesetId.value]);

  const screenToCell = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const ts = getTs();
    if (!ts) return null;
    const { cellW, cellH } = getCellSize(ts);
    const cam = paletteCam.value;
    const col = Math.floor((clientX - rect.left + cam.x) / cellW);
    const row = Math.floor((clientY - rect.top + cam.y) / cellH);
    if (col < 0 || row < 0 || col >= ts.columns || row >= ts.rows) return null;
    return { col, row };
  };

  const commitSelection = () => {
    const ts = getTs();
    const s = selStart.current;
    const e = selEnd.current;
    if (!ts || !s || !e) return;
    const map = currentMap.value;
    const ref = map.tilesets.find((r) => r.tilesetId === ts.id);
    if (!ref) return;

    const c1 = Math.min(s.col, e.col);
    const c2 = Math.max(s.col, e.col);
    const r1 = Math.min(s.row, e.row);
    const r2 = Math.max(s.row, e.row);
    const bw = c2 - c1 + 1;
    const bh = r2 - r1 + 1;
    const tiles: number[] = [];
    for (let r = r1; r <= r2; r++) {
      for (let c = c1; c <= c2; c++) {
        tiles.push(ref.firstGid + r * ts.columns + c);
      }
    }
    brushTiles.value = tiles;
    brushWidth.value = bw;
    brushHeight.value = bh;
    // Auto-switch to brush when selecting tiles
    activeTool.value = "brush";
  };

  const onPointerDown = (e: PointerEvent) => {
    // Close context menu on any click
    if (ctxMenu) {
      setCtxMenu(null);
      return;
    }

    // Middle-click or Alt+click → pan
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      const startCam = { ...paletteCam.value };
      const startX = e.clientX;
      const startY = e.clientY;
      const onMove = (ev: PointerEvent) => {
        paletteCam.value = {
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

    // Left click → select
    if (e.button === 0) {
      const cell = screenToCell(e.clientX, e.clientY);
      if (!cell) return;
      selStart.current = cell;
      selEnd.current = cell;
      commitSelection();
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    // Update hover
    const cell = screenToCell(e.clientX, e.clientY);
    const prev = hoverCell.current;
    if (cell?.col !== prev?.col || cell?.row !== prev?.row) {
      hoverCell.current = cell;
      draw();
    }

    // Drag select
    if (e.buttons & 1 && !(e.altKey)) {
      if (!cell || !selStart.current) return;
      selEnd.current = cell;
      commitSelection();
    }
  };

  const onPointerLeave = () => {
    if (hoverCell.current) {
      hoverCell.current = null;
      draw();
    }
  };

  // Right-click → context menu
  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    const cell = screenToCell(e.clientX, e.clientY);
    const ts = getTs();
    if (!cell || !ts) return;
    const localId = cell.row * ts.columns + cell.col;
    const rect = containerRef.current!.getBoundingClientRect();
    setCtxMenu({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      localId,
      tilesetId: ts.id,
    });
  };

  // Scroll → vertical scroll (shift+scroll → horizontal)
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const cam = paletteCam.value;
    if (e.shiftKey) {
      paletteCam.value = { ...cam, x: Math.max(0, cam.x + e.deltaY) };
    } else {
      paletteCam.value = { ...cam, y: Math.max(0, cam.y + e.deltaY) };
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
        imageRendering: "pixelated",
        position: "relative",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
      onContextMenu={onContextMenu}
      onWheel={onWheel}
    >
      <canvas
        ref={canvasRef}
        style={{ display: "block", imageRendering: "pixelated" }}
      />
      {ctxMenu && (
        <TileContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          localId={ctxMenu.localId}
          tilesetId={ctxMenu.tilesetId}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}
