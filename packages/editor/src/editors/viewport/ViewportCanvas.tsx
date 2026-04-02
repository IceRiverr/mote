import { useRef, useEffect, useCallback } from "preact/hooks";
import { signal } from "@preact/signals";
import {
  currentMap,
  tilesets,
  tilesetImages,
  activeLayerId,
  activeLayer,
  mapVersion,
  bumpMapVersion,
} from "../../store/project";
import {
  activeTool,
  brushTiles,
  brushWidth,
  brushHeight,
  hoverTile,
} from "../../store/selection";
import { resolveGid } from "../../data/TileMap";
import { getTileSrcRect } from "../../data/TileSet";

const camera = signal({ x: 0, y: 0, zoom: 1 });

export function ViewportCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPainting = useRef(false);
  const paintedCells = useRef<Set<string>>(new Set());

  // --- Resize ---
  useEffect(() => {
    const el = containerRef.current!;
    const canvas = canvasRef.current!;
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = el.clientWidth * dpr;
      canvas.height = el.clientHeight * dpr;
      canvas.style.width = el.clientWidth + "px";
      canvas.style.height = el.clientHeight + "px";
      draw();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // --- Redraw on state change ---
  useEffect(() => {
    draw();
  }, [
    mapVersion.value,
    camera.value,
    hoverTile.value,
    activeTool.value,
    activeLayerId.value,
    brushTiles.value,
  ]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const map = currentMap.value;
    const { x: camX, y: camY, zoom } = camera.value;
    const tw = map.tileWidth * zoom;
    const th = map.tileHeight * zoom;

    ctx.save();
    ctx.translate(-camX, -camY);

    // Draw layers
    const images = tilesetImages.value;
    const tsMap = new Map(tilesets.value.map((t) => [t.id, t]));

    for (const layer of map.layers) {
      if (!layer.visible) continue;
      const isActive = layer.id === activeLayerId.value;
      ctx.globalAlpha = layer.opacity * (isActive ? 1 : 0.4);

      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          const gid = layer.data[y * map.width + x];
          if (gid === 0) continue;

          const resolved = resolveGid(map, gid);
          if (!resolved) continue;

          const ts = tsMap.get(resolved.tilesetId);
          const img = images.get(resolved.tilesetId);
          if (!ts || !img) continue;

          const src = getTileSrcRect(ts, resolved.localId);
          ctx.drawImage(
            img,
            src.sx, src.sy, src.sw, src.sh,
            x * tw, y * th, tw, th
          );
        }
      }
    }

    ctx.globalAlpha = 1;

    // Grid
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= map.width; x++) {
      ctx.beginPath();
      ctx.moveTo(x * tw, 0);
      ctx.lineTo(x * tw, map.height * th);
      ctx.stroke();
    }
    for (let y = 0; y <= map.height; y++) {
      ctx.beginPath();
      ctx.moveTo(0, y * th);
      ctx.lineTo(map.width * tw, y * th);
      ctx.stroke();
    }

    // Map border
    ctx.strokeStyle = "rgba(74,144,217,0.5)";
    ctx.lineWidth = 2;
    ctx.strokeRect(0, 0, map.width * tw, map.height * th);

    // Brush preview
    const hover = hoverTile.value;
    if (hover && activeTool.value === "brush" && brushTiles.value.length > 0) {
      ctx.globalAlpha = 0.5;
      const bw = brushWidth.value;
      const bh = brushHeight.value;
      for (let by = 0; by < bh; by++) {
        for (let bx = 0; bx < bw; bx++) {
          const gid = brushTiles.value[by * bw + bx];
          if (gid === 0) continue;
          const resolved = resolveGid(currentMap.value, gid);
          if (!resolved) continue;
          const ts = tsMap.get(resolved.tilesetId);
          const img = images.get(resolved.tilesetId);
          if (!ts || !img) continue;
          const src = getTileSrcRect(ts, resolved.localId);
          ctx.drawImage(
            img,
            src.sx, src.sy, src.sw, src.sh,
            (hover.x + bx) * tw, (hover.y + by) * th, tw, th
          );
        }
      }
      ctx.globalAlpha = 1;
    }

    // Hover highlight
    if (hover) {
      ctx.strokeStyle = "rgba(255,255,255,0.4)";
      ctx.lineWidth = 1;
      ctx.strokeRect(hover.x * tw, hover.y * th, tw, th);
    }

    ctx.restore();
  }, []);

  // --- Mouse → tile coord ---
  const screenToTile = useCallback(
    (clientX: number, clientY: number) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      const map = currentMap.value;
      const { x: camX, y: camY, zoom } = camera.value;
      const mx = clientX - rect.left + camX;
      const my = clientY - rect.top + camY;
      const tx = Math.floor(mx / (map.tileWidth * zoom));
      const ty = Math.floor(my / (map.tileHeight * zoom));
      if (tx < 0 || ty < 0 || tx >= map.width || ty >= map.height) return null;
      return { x: tx, y: ty };
    },
    []
  );

  // --- Paint a single tile ---
  const paintAt = useCallback(
    (x: number, y: number) => {
      const map = currentMap.value;
      const layer = activeLayer.value;
      if (!layer || layer.locked) return;

      const tool = activeTool.value;
      const idx = y * map.width + x;

      if (tool === "brush") {
        const bt = brushTiles.value;
        if (bt.length === 0) return;
        const bw = brushWidth.value;
        const bh = brushHeight.value;
        for (let by = 0; by < bh; by++) {
          for (let bx = 0; bx < bw; bx++) {
            const tx = x + bx;
            const ty = y + by;
            if (tx >= map.width || ty >= map.height) continue;
            layer.data[ty * map.width + tx] = bt[by * bw + bx];
          }
        }
      } else if (tool === "eraser") {
        layer.data[idx] = 0;
      } else if (tool === "fill") {
        floodFill(layer.data, map.width, map.height, x, y, bt());
      } else if (tool === "eyedropper") {
        const gid = layer.data[idx];
        if (gid > 0) {
          brushTiles.value = [gid];
          brushWidth.value = 1;
          brushHeight.value = 1;
          activeTool.value = "brush";
        }
      }
      bumpMapVersion();
    },
    []
  );

  function bt() {
    return brushTiles.value.length > 0 ? brushTiles.value[0] : 0;
  }

  // --- Pointer handlers ---
  const onPointerDown = (e: PointerEvent) => {
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      // Middle-click or Alt+click → pan
      const startCam = { ...camera.value };
      const startX = e.clientX;
      const startY = e.clientY;
      const onMove = (e: PointerEvent) => {
        camera.value = {
          ...startCam,
          x: startCam.x - (e.clientX - startX),
          y: startCam.y - (e.clientY - startY),
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

    if (e.button === 0) {
      isPainting.current = true;
      paintedCells.current.clear();
      const tile = screenToTile(e.clientX, e.clientY);
      if (tile) {
        const key = `${tile.x},${tile.y}`;
        paintedCells.current.add(key);
        paintAt(tile.x, tile.y);
      }
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    const tile = screenToTile(e.clientX, e.clientY);
    hoverTile.value = tile;

    if (isPainting.current && tile) {
      const key = `${tile.x},${tile.y}`;
      if (!paintedCells.current.has(key)) {
        paintedCells.current.add(key);
        paintAt(tile.x, tile.y);
      }
    }
  };

  const onPointerUp = () => {
    isPainting.current = false;
  };

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.25, Math.min(8, camera.value.zoom * delta));
    camera.value = { ...camera.value, zoom: newZoom };
  };

  return (
    <div
      ref={containerRef}
      style={{ width: "100%", height: "100%", cursor: "crosshair" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => { hoverTile.value = null; }}
      onWheel={onWheel}
    >
      <canvas ref={canvasRef} style={{ display: "block" }} />
    </div>
  );
}

/** Simple flood fill */
function floodFill(
  data: number[],
  w: number,
  h: number,
  sx: number,
  sy: number,
  newGid: number
) {
  const target = data[sy * w + sx];
  if (target === newGid) return;
  const stack = [[sx, sy]];
  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const idx = y * w + x;
    if (data[idx] !== target) continue;
    data[idx] = newGid;
    stack.push([x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]);
  }
}
