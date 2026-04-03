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
  viewportZoom,
  viewportZoomLocked,
} from "../../store/selection";
import { executeCommand } from "../../store/history";
import { PaintTilesCommand } from "../../commands/paint";
import { resolveGid } from "../../data/TileMap";
import { getTileSrcRect } from "../../data/TileSet";

/** Camera: x,y = world coordinate at viewport top-left. zoom = scale factor. */
const camera = signal({ x: 0, y: 0, zoom: 1 });
const needsCenter = signal(true);

/** Set zoom preserving a world point at a screen position */
function setZoomAt(newZoom: number, screenX: number, screenY: number) {
  const cam = camera.value;
  const worldX = (screenX + cam.x) / cam.zoom;
  const worldY = (screenY + cam.y) / cam.zoom;
  camera.value = {
    x: worldX * newZoom - screenX,
    y: worldY * newZoom - screenY,
    zoom: newZoom,
  };
  viewportZoom.value = newZoom;
}

/** Set zoom preserving viewport center */
function setZoomCenter(newZoom: number, vw: number, vh: number) {
  setZoomAt(newZoom, vw / 2, vh / 2);
}

export function ViewportCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isPainting = useRef(false);
  const paintedCells = useRef<Set<string>>(new Set());
  /** Current stroke command, created on mouse-down, committed on mouse-up */
  const strokeCmd = useRef<PaintTilesCommand | null>(null);

  // --- Center the map in viewport ---
  const centerMap = useCallback((fitToView = false) => {
    const el = containerRef.current;
    if (!el) return;
    const map = currentMap.value;
    const vw = el.clientWidth;
    const vh = el.clientHeight;
    const mapPxW = map.width * map.tileWidth;
    const mapPxH = map.height * map.tileHeight;

    let zoom = camera.value.zoom;
    if (fitToView) {
      zoom = Math.min(vw / mapPxW, vh / mapPxH) * 0.9;
      zoom = Math.max(0.25, zoom);
    }

    camera.value = {
      x: (mapPxW * zoom - vw) / 2,
      y: (mapPxH * zoom - vh) / 2,
      zoom,
    };
    viewportZoom.value = zoom;
  }, []);

  // --- Resize handler ---
  useEffect(() => {
    const el = containerRef.current!;
    const canvas = canvasRef.current!;
    const ro = new ResizeObserver(() => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = el.clientWidth * dpr;
      canvas.height = el.clientHeight * dpr;
      canvas.style.width = el.clientWidth + "px";
      canvas.style.height = el.clientHeight + "px";
      if (needsCenter.value) {
        centerMap();
        needsCenter.value = false;
      }
      draw();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // --- Listen for external zoom set (from ViewportHeader input) ---
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && typeof detail.zoom === "number") {
        const el = containerRef.current;
        if (!el) return;
        setZoomCenter(detail.zoom, el.clientWidth, el.clientHeight);
        draw();
      }
    };
    window.addEventListener("mote-set-viewport-zoom", handler);
    return () =>
      window.removeEventListener("mote-set-viewport-zoom", handler);
  }, []);

  // --- Keyboard: number keys 1-6 for integer zoom, Home for fit ---
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement).tagName === "INPUT" ||
        (e.target as HTMLElement).tagName === "SELECT"
      )
        return;

      if (e.key === "Home") {
        e.preventDefault();
        centerMap(true);
        draw();
        return;
      }

      if (viewportZoomLocked.value) return;

      const num = parseInt(e.key);
      if (num >= 1 && num <= 6) {
        e.preventDefault();
        const el = containerRef.current;
        if (!el) return;
        setZoomCenter(num, el.clientWidth, el.clientHeight);
        draw();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
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

    ctx.imageSmoothingEnabled = false;

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
      ctx.globalAlpha = layer.opacity;

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
            src.sx,
            src.sy,
            src.sw,
            src.sh,
            x * tw,
            y * th,
            tw,
            th
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
            src.sx,
            src.sy,
            src.sw,
            src.sh,
            (hover.x + bx) * tw,
            (hover.y + by) * th,
            tw,
            th
          );
        }
      }
      ctx.globalAlpha = 1;
    }

    // Eraser preview
    if (hover && activeTool.value === "eraser") {
      ctx.fillStyle = "rgba(217, 74, 74, 0.3)";
      ctx.fillRect(hover.x * tw, hover.y * th, tw, th);
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

  // --- Paint (mutate data in-place + record into strokeCmd) ---
  const paintAt = useCallback((x: number, y: number) => {
    const map = currentMap.value;
    const layer = activeLayer.value;
    if (!layer || layer.locked) return;

    const tool = activeTool.value;
    const cmd = strokeCmd.current;

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
          const idx = ty * map.width + tx;
          const oldGid = layer.data[idx];
          const newGid = bt[by * bw + bx];
          if (oldGid !== newGid) {
            layer.data[idx] = newGid;
            cmd?.record(idx, oldGid, newGid);
          }
        }
      }
    } else if (tool === "eraser") {
      const idx = y * map.width + x;
      const oldGid = layer.data[idx];
      if (oldGid !== 0) {
        layer.data[idx] = 0;
        cmd?.record(idx, oldGid, 0);
      }
    } else if (tool === "fill") {
      const fillGid = brushTiles.value.length > 0 ? brushTiles.value[0] : 0;
      floodFillWithRecord(layer.data, map.width, map.height, x, y, fillGid, cmd);
    } else if (tool === "eyedropper") {
      const idx = y * map.width + x;
      const gid = layer.data[idx];
      if (gid > 0) {
        brushTiles.value = [gid];
        brushWidth.value = 1;
        brushHeight.value = 1;
        activeTool.value = "brush";
      }
    }
    bumpMapVersion();
  }, []);

  // --- Pointer handlers ---
  const onPointerDown = (e: PointerEvent) => {
    // Middle-click or Alt+click → pan
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      const startCam = { ...camera.value };
      const startX = e.clientX;
      const startY = e.clientY;
      const onMove = (ev: PointerEvent) => {
        camera.value = {
          ...startCam,
          x: startCam.x - (ev.clientX - startX),
          y: startCam.y - (ev.clientY - startY),
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

      // Create a new stroke command
      const tool = activeTool.value;
      const label =
        tool === "brush"
          ? "绘制 tile"
          : tool === "eraser"
          ? "擦除 tile"
          : tool === "fill"
          ? "填充 tile"
          : "吸取 tile";
      strokeCmd.current = new PaintTilesCommand(activeLayerId.value, label);

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
    if (isPainting.current) {
      isPainting.current = false;
      // Commit the stroke command if there were actual changes
      const cmd = strokeCmd.current;
      if (cmd && cmd.hasChanges()) {
        // Data is already mutated in-place; executeCommand will just push to stack
        executeCommand(cmd);
      }
      strokeCmd.current = null;
    }
  };

  // --- Mouse-position zoom ---
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (viewportZoomLocked.value) return;

    const cam = camera.value;
    const rect = canvasRef.current!.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = Math.max(0.25, Math.min(16, cam.zoom * factor));
    setZoomAt(newZoom, mouseX, mouseY);
  };

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        cursor: "crosshair",
        imageRendering: "pixelated",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={() => {
        hoverTile.value = null;
      }}
      onWheel={onWheel}
    >
      <canvas
        ref={canvasRef}
        style={{ display: "block", imageRendering: "pixelated" }}
      />
    </div>
  );
}

/** Flood fill that also records changes into a PaintTilesCommand */
function floodFillWithRecord(
  data: number[],
  w: number,
  h: number,
  sx: number,
  sy: number,
  newGid: number,
  cmd: PaintTilesCommand | null
) {
  const target = data[sy * w + sx];
  if (target === newGid) return;
  const stack = [[sx, sy]];
  while (stack.length > 0) {
    const [x, y] = stack.pop()!;
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const idx = y * w + x;
    if (data[idx] !== target) continue;
    const oldGid = data[idx];
    data[idx] = newGid;
    cmd?.record(idx, oldGid, newGid);
    stack.push([x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]);
  }
}
