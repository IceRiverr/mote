import { useRef, useEffect, useCallback } from "preact/hooks";
import { tilesets, tilesetImages, currentMap } from "../../store/project";
import {
  activeTilesetId,
  brushTiles,
  brushWidth,
  brushHeight,
  displayScale,
} from "../../store/selection";
import { getTileSrcRect } from "../../data/TileSet";

export function PaletteCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const selStart = useRef<{ col: number; row: number } | null>(null);
  const selEnd = useRef<{ col: number; row: number } | null>(null);

  const getTs = () => {
    const id = activeTilesetId.value;
    return id ? tilesets.value.find((t) => t.id === id) ?? null : null;
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;
    const ts = getTs();
    const img = ts ? tilesetImages.value.get(ts.id) : null;

    const scale = displayScale.value;
    const cellW = ts ? ts.tileWidth * scale : 32;
    const cellH = ts ? ts.tileHeight * scale : 32;

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

    // Pixel-perfect: disable smoothing
    ctx.imageSmoothingEnabled = false;

    if (!ts || !img) {
      ctx.fillStyle = "#888";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("点击「导入」添加瓦片集", w / 2, h / 2);
      return;
    }

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
            startCol * cellW,
            startRow * cellH,
            brushWidth.value * cellW,
            brushHeight.value * cellH
          );
          ctx.fillStyle = "rgba(74,144,217,0.2)";
          ctx.fillRect(
            startCol * cellW,
            startRow * cellH,
            brushWidth.value * cellW,
            brushHeight.value * cellH
          );
        }
      }
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
  ]);

  // Resize
  useEffect(() => {
    const el = containerRef.current!;
    const ro = new ResizeObserver(() => draw());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const screenToCell = (clientX: number, clientY: number) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    const ts = getTs();
    if (!ts) return null;
    const scale = displayScale.value;
    const cellW = ts.tileWidth * scale;
    const cellH = ts.tileHeight * scale;
    const col = Math.floor((clientX - rect.left) / cellW);
    const row = Math.floor((clientY - rect.top) / cellH);
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
  };

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    const cell = screenToCell(e.clientX, e.clientY);
    if (!cell) return;
    selStart.current = cell;
    selEnd.current = cell;
    commitSelection();
  };

  const onPointerMove = (e: PointerEvent) => {
    if (!(e.buttons & 1)) return;
    const cell = screenToCell(e.clientX, e.clientY);
    if (!cell || !selStart.current) return;
    selEnd.current = cell;
    commitSelection();
  };

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        overflow: "auto",
        cursor: "pointer",
        imageRendering: "pixelated",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
    >
      <canvas
        ref={canvasRef}
        style={{ display: "block", imageRendering: "pixelated" }}
      />
    </div>
  );
}
