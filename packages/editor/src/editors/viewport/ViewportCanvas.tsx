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
  showGrid,
  gridColor,
  activeEntityDefId,
  selectedEntityId,
} from "../../store/selection";
import { tileSelection } from "../../store/tileSelection";
import { executeCommand } from "../../store/history";
import { PaintTilesCommand } from "../../commands/paint";
import { MoveSelectionCommand } from "../../commands/selection";
import { AddEntityCommand, MoveEntityCommand } from "../../commands/entity";
import { activeEntityLayer } from "../../store/project";

import { resolveGid, isTileLayer, isEntityLayer, getEntityDef } from "../../data/TileMap";
import type { EntityInstance } from "../../data/TileMap";
import { getTileSrcRect } from "../../data/TileSet";

/** Camera: x,y = world coordinate at viewport top-left. zoom = scale factor. */
const camera = signal({ x: 0, y: 0, zoom: 1 });
const needsCenter = signal(true);

// --- Selection drag state (module-level so draw() can access) ---

/** Box-select drag: start and current tile coords */
const selectDragStart = signal<{ x: number; y: number } | null>(null);
const selectDragEnd = signal<{ x: number; y: number } | null>(null);

/** Move-selection drag state */
const moveDragOrigin = signal<{ x: number; y: number } | null>(null);
const moveDragOffset = signal<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

/** Entity being dragged (move) */
const entityDragId = signal<string | null>(null);
const entityDragStart = signal<{ x: number; y: number } | null>(null);
const entityDragOrigPos = signal<{ x: number; y: number } | null>(null);

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

  /** Whether we are currently box-selecting */
  const isBoxSelecting = useRef(false);
  /** Whether we are currently move-dragging a selection */
  const isMovingSelection = useRef(false);
  /** Whether tiles have been cut from layer during current move drag */
  const hasCutTiles = useRef(false);

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
      if (needsCenter.value && el.clientWidth > 0 && el.clientHeight > 0) {
        centerMap(true);
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

      // Escape clears selection
      if (e.key === "Escape" && tileSelection.value) {
        // If floating, drop tiles back to original position (discard move)
        if (tileSelection.value.tiles) {
          const sel = tileSelection.value;
          const map = currentMap.value;
          const layer = map.layers.find((l) => l.id === sel.layerId);
          if (layer && isTileLayer(layer)) {
            for (let r = 0; r < sel.h; r++) {
              for (let c = 0; c < sel.w; c++) {
                const tx = sel.x + c;
                const ty = sel.y + r;
                if (tx >= 0 && tx < map.width && ty >= 0 && ty < map.height) {
                  layer.data[ty * map.width + tx] = sel.tiles![r * sel.w + c];
                }
              }
            }
            bumpMapVersion();
          }
        }
        tileSelection.value = null;
        draw();
        return;
      }

      // N = entity tool
      if (e.key === "n" || e.key === "N") {
        e.preventDefault();
        activeTool.value = "entity";
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
    tileSelection.value,
    selectDragStart.value,
    selectDragEnd.value,
    moveDragOffset.value,
    showGrid.value,
    gridColor.value,
    selectedEntityId.value,
    entityDragId.value,
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
      if (!isTileLayer(layer)) continue;
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

    // Render entity layers
    for (const layer of map.layers) {
      if (!layer.visible) continue;
      if (!isEntityLayer(layer)) continue;
      ctx.globalAlpha = layer.opacity;

      // Sprite rendering temporarily disabled (old atlas system removed)
      // TODO: migrate to new spriteSheet system
      const aImages = new Map<string, HTMLImageElement>();
      const aList: any[] = [];

      for (const entity of layer.entities) {
        if (!entity.visible) continue;
        const def = getEntityDef(entity.defId);
        if (!def) continue;

        const ex = entity.x * zoom;
        const ey = entity.y * zoom;
        const ew = entity.width * zoom;
        const eh = entity.height * zoom;
        const isSelected = selectedEntityId.value === entity.id;

        // Try to render sprite
        const frameId = entity.spriteFrameId ?? def.spriteFrameId;
        const atlasId = def.spriteAtlasId;
        let drewSprite = false;

        if (atlasId && frameId) {
          const atlas = aList.find((a) => a.id === atlasId);
          const aImg = atlas ? aImages.get(atlas.id) : undefined;
          const frame = atlas?.frameMap.get(frameId);
          if (atlas && aImg && frame) {
            // Draw sprite
            const drawW = (def.shape === "rect" ? entity.width : frame.width) * zoom;
            const drawH = (def.shape === "rect" ? entity.height : frame.height) * zoom;
            const drawX = def.shape === "point" ? ex - drawW / 2 : ex;
            const drawY = def.shape === "point" ? ey - drawH / 2 : ey;
            ctx.drawImage(aImg, frame.x, frame.y, frame.width, frame.height, drawX, drawY, drawW, drawH);
            drewSprite = true;

            // Selection border
            if (isSelected) {
              ctx.strokeStyle = "#ffffff";
              ctx.lineWidth = 2;
              ctx.strokeRect(drawX - 1, drawY - 1, drawW + 2, drawH + 2);
            }
          }
        }

        if (!drewSprite) {
          // Fallback: draw shape gizmo
          if (def.shape === "rect") {
            ctx.fillStyle = def.color + "40";
            ctx.fillRect(ex, ey, ew, eh);
            ctx.strokeStyle = isSelected ? "#ffffff" : def.color;
            ctx.lineWidth = isSelected ? 2 : 1;
            ctx.strokeRect(ex, ey, ew, eh);
            ctx.fillStyle = def.color;
            ctx.font = `${Math.max(10, 12 * zoom)}px monospace`;
            ctx.fillText(entity.name || def.name, ex + 3 * zoom, ey + 12 * zoom);
          } else {
            const r = 8 * zoom;
            ctx.beginPath();
            ctx.arc(ex, ey, r, 0, Math.PI * 2);
            ctx.fillStyle = def.color + "80";
            ctx.fill();
            ctx.strokeStyle = isSelected ? "#ffffff" : def.color;
            ctx.lineWidth = isSelected ? 2 : 1;
            ctx.stroke();
            ctx.fillStyle = "#fff";
            ctx.font = `bold ${Math.max(10, 12 * zoom)}px monospace`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.fillText(def.icon, ex, ey);
            ctx.textAlign = "start";
            ctx.textBaseline = "alphabetic";
            ctx.fillStyle = def.color;
            ctx.font = `${Math.max(9, 10 * zoom)}px monospace`;
            ctx.fillText(entity.name || def.name, ex + r + 2, ey + 4 * zoom);
          }
        }
      }
    }

    ctx.globalAlpha = 1;

    // Grid
    if (showGrid.value) {
      ctx.strokeStyle = gridColor.value;
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

    // --- Selection visual feedback ---

    // Box-select drag preview (dashed rect while dragging)
    const ds = selectDragStart.value;
    const de = selectDragEnd.value;
    if (ds && de) {
      const rx = Math.min(ds.x, de.x);
      const ry = Math.min(ds.y, de.y);
      const rw = Math.abs(de.x - ds.x) + 1;
      const rh = Math.abs(de.y - ds.y) + 1;

      ctx.save();
      ctx.fillStyle = "rgba(74, 144, 217, 0.15)";
      ctx.fillRect(rx * tw, ry * th, rw * tw, rh * th);
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = "rgba(74, 144, 217, 0.8)";
      ctx.lineWidth = 2;
      ctx.strokeRect(rx * tw, ry * th, rw * tw, rh * th);
      ctx.setLineDash([]);
      ctx.restore();
    }

    // Active selection rect (after box-select or during move)
    const sel = tileSelection.value;
    if (sel) {
      const offDx = moveDragOffset.value.dx;
      const offDy = moveDragOffset.value.dy;
      const drawX = sel.x + offDx;
      const drawY = sel.y + offDy;

      // Draw floating tiles if cut
      if (sel.tiles) {
        ctx.save();
        ctx.globalAlpha = 0.85;
        for (let r = 0; r < sel.h; r++) {
          for (let c = 0; c < sel.w; c++) {
            const gid = sel.tiles[r * sel.w + c];
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
              (drawX + c) * tw,
              (drawY + r) * th,
              tw,
              th
            );
          }
        }
        ctx.globalAlpha = 1;
        ctx.restore();
      }

      // Dashed selection border
      ctx.save();
      ctx.fillStyle = "rgba(74, 144, 217, 0.1)";
      ctx.fillRect(drawX * tw, drawY * th, sel.w * tw, sel.h * th);
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = "rgba(74, 144, 217, 0.9)";
      ctx.lineWidth = 2;
      ctx.strokeRect(drawX * tw, drawY * th, sel.w * tw, sel.h * th);
      ctx.setLineDash([]);
      ctx.restore();
    }

    ctx.restore();
  }, []);

  // --- Mouse -> world pixel coord ---
  const screenToWorld = useCallback(
    (clientX: number, clientY: number) => {
      const rect = canvasRef.current!.getBoundingClientRect();
      const { x: camX, y: camY, zoom } = camera.value;
      const mx = clientX - rect.left + camX;
      const my = clientY - rect.top + camY;
      return { x: mx / zoom, y: my / zoom };
    },
    []
  );

  /** Find entity at world position */
  const findEntityAt = useCallback(
    (wx: number, wy: number): { layerId: string; entity: EntityInstance } | null => {
      const map = currentMap.value;
      // Search layers in reverse (top-most first)
      for (let i = map.layers.length - 1; i >= 0; i--) {
        const layer = map.layers[i];
        if (!layer.visible || layer.locked || !isEntityLayer(layer)) continue;
        for (let j = layer.entities.length - 1; j >= 0; j--) {
          const e = layer.entities[j];
          if (!e.visible) continue;
          const def = getEntityDef(e.defId);
          if (!def) continue;
          if (def.shape === "rect") {
            if (wx >= e.x && wx <= e.x + e.width && wy >= e.y && wy <= e.y + e.height) {
              return { layerId: layer.id, entity: e };
            }
          } else {
            // Point: hit test with radius 8px
            const dx = wx - e.x;
            const dy = wy - e.y;
            if (dx * dx + dy * dy <= 12 * 12) {
              return { layerId: layer.id, entity: e };
            }
          }
        }
      }
      return null;
    },
    []
  );

  // --- Mouse -> tile coord ---
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

  /** Check if a tile coord is inside the current selection */
  const isInsideSelection = useCallback(
    (tx: number, ty: number): boolean => {
      const sel = tileSelection.value;
      if (!sel) return false;
      return tx >= sel.x && tx < sel.x + sel.w && ty >= sel.y && ty < sel.y + sel.h;
    },
    []
  );

  // --- Paint (mutate data in-place + record into strokeCmd) ---
  const paintAt = useCallback((x: number, y: number) => {
    const map = currentMap.value;
    const layer = activeLayer.value;
    if (!layer || layer.locked || !isTileLayer(layer)) return;

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
    // Middle-click or Alt+click -> pan
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
      // ---- ENTITY TOOL ----
      if (activeTool.value === "entity") {
        const world = screenToWorld(e.clientX, e.clientY);

        // Check if clicking on an existing entity
        const hit = findEntityAt(world.x, world.y);
        if (hit) {
          // Select and start drag
          selectedEntityId.value = hit.entity.id;
          activeLayerId.value = hit.layerId;
          entityDragId.value = hit.entity.id;
          entityDragStart.value = { x: e.clientX, y: e.clientY };
          entityDragOrigPos.value = { x: hit.entity.x, y: hit.entity.y };
          return;
        }

        // Place new entity
        const defId = activeEntityDefId.value;
        const entLayer = activeEntityLayer.value;
        if (defId && entLayer) {
          const def = getEntityDef(defId);
          if (def) {
            // Snap to grid
            const map = currentMap.value;
            const snapX = Math.round(world.x / map.tileWidth) * map.tileWidth;
            const snapY = Math.round(world.y / map.tileHeight) * map.tileHeight;

            const newEntity = {
              id: `ent_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              defId: def.id,
              name: "",
              x: def.shape === "rect" ? snapX : snapX,
              y: def.shape === "rect" ? snapY : snapY,
              width: def.defaultWidth,
              height: def.defaultHeight,
              fieldValues: Object.fromEntries(
                def.fields.map((f) => [f.id, f.default])
              ),
              visible: true,
            };
            executeCommand(new AddEntityCommand(entLayer.id, newEntity));
            selectedEntityId.value = newEntity.id;
          }
        } else {
          selectedEntityId.value = null;
        }
        return;
      }

      // ---- SELECT TOOL ----
      if (activeTool.value === "select") {
        const tile = screenToTile(e.clientX, e.clientY);
        if (!tile) {
          // Click outside map: clear selection
          tileSelection.value = null;
          return;
        }

        // Check if clicking inside existing selection -> start move
        if (tileSelection.value && isInsideSelection(tile.x, tile.y)) {
          isMovingSelection.current = true;
          hasCutTiles.current = false;
          moveDragOrigin.value = { x: tile.x, y: tile.y };
          moveDragOffset.value = { dx: 0, dy: 0 };
          return;
        }

        // Otherwise start box-select
        isBoxSelecting.current = true;
        selectDragStart.value = { x: tile.x, y: tile.y };
        selectDragEnd.value = { x: tile.x, y: tile.y };
        // Clear any existing selection
        tileSelection.value = null;
        return;
      }

      // ---- Other tools (brush, eraser, fill, eyedropper) ----
      isPainting.current = true;
      paintedCells.current.clear();

      // Create a new stroke command
      const tool = activeTool.value;
      const label =
        tool === "brush"
          ? "\u7ed8\u5236 tile"
          : tool === "eraser"
          ? "\u64e6\u9664 tile"
          : tool === "fill"
          ? "\u586b\u5145 tile"
          : "\u5438\u53d6 tile";
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

    // Entity dragging
    if (entityDragId.value && entityDragStart.value && entityDragOrigPos.value) {
      const { x: camX, y: camY, zoom } = camera.value;
      const dx = (e.clientX - entityDragStart.value.x) / zoom;
      const dy = (e.clientY - entityDragStart.value.y) / zoom;
      const map = currentMap.value;
      // Snap to grid while dragging
      const newX = Math.round((entityDragOrigPos.value.x + dx) / map.tileWidth) * map.tileWidth;
      const newY = Math.round((entityDragOrigPos.value.y + dy) / map.tileHeight) * map.tileHeight;

      // Update entity position in-place for visual feedback
      currentMap.value = {
        ...map,
        layers: map.layers.map((l) => {
          if (!isEntityLayer(l)) return l;
          return {
            ...l,
            entities: l.entities.map((ent) =>
              ent.id === entityDragId.value ? { ...ent, x: newX, y: newY } : ent
            ),
          };
        }),
      };
      bumpMapVersion();
      return;
    }

    // Box-selecting: update drag end
    if (isBoxSelecting.current && tile) {
      selectDragEnd.value = { x: tile.x, y: tile.y };
      return;
    }

    // Moving selection
    if (isMovingSelection.current && tile && moveDragOrigin.value) {
      const sel = tileSelection.value;
      if (!sel) return;

      // First movement: cut tiles from layer
      if (!hasCutTiles.current) {
        hasCutTiles.current = true;
        const map = currentMap.value;
        const layer = map.layers.find((l) => l.id === sel.layerId);
        if (layer && isTileLayer(layer)) {
          const tiles: number[] = [];
          for (let r = 0; r < sel.h; r++) {
            for (let c = 0; c < sel.w; c++) {
              const tx = sel.x + c;
              const ty = sel.y + r;
              if (tx >= 0 && tx < map.width && ty >= 0 && ty < map.height) {
                const idx = ty * map.width + tx;
                tiles.push(layer.data[idx]);
                layer.data[idx] = 0;
              } else {
                tiles.push(0);
              }
            }
          }
          tileSelection.value = { ...sel, tiles };
          bumpMapVersion();
        }
      }

      const dx = tile.x - moveDragOrigin.value.x;
      const dy = tile.y - moveDragOrigin.value.y;
      moveDragOffset.value = { dx, dy };
      return;
    }

    // Painting
    if (isPainting.current && tile) {
      const key = `${tile.x},${tile.y}`;
      if (!paintedCells.current.has(key)) {
        paintedCells.current.add(key);
        paintAt(tile.x, tile.y);
      }
    }
  };

  const onPointerUp = () => {
    // Finish entity drag
    if (entityDragId.value && entityDragOrigPos.value) {
      const entId = entityDragId.value;
      const origPos = entityDragOrigPos.value;
      entityDragId.value = null;
      entityDragStart.value = null;
      entityDragOrigPos.value = null;

      // Find the entity's current position
      const map = currentMap.value;
      for (const layer of map.layers) {
        if (!isEntityLayer(layer)) continue;
        const ent = layer.entities.find((e) => e.id === entId);
        if (ent && (ent.x !== origPos.x || ent.y !== origPos.y)) {
          // Revert to original position, then execute command (so undo works)
          const finalX = ent.x;
          const finalY = ent.y;
          // Revert
          currentMap.value = {
            ...map,
            layers: map.layers.map((l) => {
              if (!isEntityLayer(l)) return l;
              return {
                ...l,
                entities: l.entities.map((e) =>
                  e.id === entId ? { ...e, x: origPos.x, y: origPos.y } : e
                ),
              };
            }),
          };
          executeCommand(new MoveEntityCommand(layer.id, entId, origPos.x, origPos.y, finalX, finalY));
          break;
        }
      }
      return;
    }

    // Finish box-select
    if (isBoxSelecting.current) {
      isBoxSelecting.current = false;
      const ds = selectDragStart.value;
      const de = selectDragEnd.value;
      if (ds && de) {
        const rx = Math.min(ds.x, de.x);
        const ry = Math.min(ds.y, de.y);
        const rw = Math.abs(de.x - ds.x) + 1;
        const rh = Math.abs(de.y - ds.y) + 1;

        // Single-click on same tile with no meaningful area = 1x1 selection
        // If area is at least 1x1 tile, create selection
        tileSelection.value = {
          x: rx,
          y: ry,
          w: rw,
          h: rh,
          tiles: null,
          layerId: activeLayerId.value,
        };
      }
      selectDragStart.value = null;
      selectDragEnd.value = null;
      return;
    }

    // Finish move-selection
    if (isMovingSelection.current) {
      isMovingSelection.current = false;
      const sel = tileSelection.value;
      const off = moveDragOffset.value;

      if (sel && sel.tiles && (off.dx !== 0 || off.dy !== 0)) {
        const map = currentMap.value;
        const sourceRect = { x: sel.x, y: sel.y, w: sel.w, h: sel.h };
        const destRect = { x: sel.x + off.dx, y: sel.y + off.dy, w: sel.w, h: sel.h };

        // sourceOldTiles = the tiles data we cut (already stored in sel.tiles)
        const sourceOldTiles = sel.tiles.slice();

        // Write tiles at dest
        const layer = map.layers.find((l) => l.id === sel.layerId);
        if (layer && isTileLayer(layer)) {
          for (let r = 0; r < sel.h; r++) {
            for (let c = 0; c < sel.w; c++) {
              const tx = destRect.x + c;
              const ty = destRect.y + r;
              if (tx >= 0 && tx < map.width && ty >= 0 && ty < map.height) {
                layer.data[ty * map.width + tx] = sel.tiles[r * sel.w + c];
              }
            }
          }
        }

        // Create command (data already mutated in-place)
        const cmd = new MoveSelectionCommand(
          sel.layerId,
          sourceRect,
          destRect,
          sel.tiles.slice(),
          sourceOldTiles,
        );
        executeCommand(cmd);

        // Update selection to new position, clear floating tiles
        tileSelection.value = {
          x: destRect.x,
          y: destRect.y,
          w: sel.w,
          h: sel.h,
          tiles: null,
          layerId: sel.layerId,
        };
        bumpMapVersion();
      } else if (sel && sel.tiles && off.dx === 0 && off.dy === 0) {
        // No actual move: put tiles back
        const map = currentMap.value;
        const layer = map.layers.find((l) => l.id === sel.layerId);
        if (layer && isTileLayer(layer)) {
          for (let r = 0; r < sel.h; r++) {
            for (let c = 0; c < sel.w; c++) {
              const tx = sel.x + c;
              const ty = sel.y + r;
              if (tx >= 0 && tx < map.width && ty >= 0 && ty < map.height) {
                layer.data[ty * map.width + tx] = sel.tiles[r * sel.w + c];
              }
            }
          }
          tileSelection.value = { ...sel, tiles: null };
          bumpMapVersion();
        }
      }

      moveDragOrigin.value = null;
      moveDragOffset.value = { dx: 0, dy: 0 };
      return;
    }

    // Finish painting
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

  // Determine cursor
  let cursor = "crosshair";
  if (activeTool.value === "entity") {
    cursor = activeEntityDefId.value ? "copy" : "default";
  } else if (activeTool.value === "select") {
    const sel = tileSelection.value;
    const hover = hoverTile.value;
    if (sel && hover && isInsideSelection(hover.x, hover.y)) {
      cursor = "move";
    } else {
      cursor = "crosshair";
    }
  }

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        cursor,
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
