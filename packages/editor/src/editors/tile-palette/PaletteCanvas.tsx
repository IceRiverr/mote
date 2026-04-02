import { useRef, useEffect, useCallback } from "preact/hooks";
import { tilesets, tilesetImages, currentMap } from "../../store/project";
import {
  activeTilesetId,
  brushTiles,
  brushWidth,
  brushHeight,
} from "../../store/selection";
import { getTileSrcRect } from "../../data/TileSet";

const DISPLAY_TILE = 32; // display size per tile in palette

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

    if (!ts || !img) {
      ctx.fillStyle = "var(--text-secondary)";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("点击「导入」添加瓦片集", w / 2, h / 2);
      return;
    }

    // Draw tiles
    ctx.imageSmoothingEnabled = false;
    for (let r = 0; r < ts.rows; r++) {
      for (let c = 0; c < ts.columns; c++) {
        const localId = r * ts.columns + c;
        const src = getTileSrcRect(ts, localId);
        ctx.drawImage(
          img,
          src.sx, src.sy, src.sw, src.sh,
          c * DISPLAY_TILE, r * DISPLAY_TILE, DISPLAY_TILE, DISPLAY_TILE
        );
      }
    }

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.1)";
    ctx.lineWidth = 1;
    for (let c = 0; c <= ts.columns; c++) {
      ctx.beginPath();
      ctx.moveTo(c * DISPLAY_TILE, 0);
      ctx.lineTo(c * DISPLAY_TILE, ts.rows * DISPLAY_TILE);
      ctx.stroke();
    }
    for (let r = 0; r <= ts.rows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * DISPLAY_TILE);
      ctx.lineTo(ts.columns * DISPLAY_TILE, r * DISPLAY_TILE);
      ctx.stroke();
    }

    // Selection highlight
    const bt = brushTiles.value;
    if (bt.length > 0) {
      // Find the selected tile range in this tileset
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
            startCol * DISPLAY_TILE,
            startRow * DISPLAY_TILE,
            brushWidth.value * DISPLAY_TILE,
            brushHeight.value * DISPLAY_TILE
          );
        }
      }
    }
  }, []);

  // Redraw on relevant signal changes
  useEffect(() => {
    draw();
  }, [
    activeTilesetId.value,
    tilesets.value,
    tilesetImages.value,
    brushTiles.value,
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
    const col = Math.floor((clientX - rect.left) / DISPLAY_TILE);
    const row = Math.floor((clientY - rect.top) / DISPLAY_TILE);
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
      style={{ width: "100%", height: "100%", overflow: "auto", cursor: "pointer" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
    >
      <canvas ref={canvasRef} style={{ display: "block" }} />
    </div>
  );
}
