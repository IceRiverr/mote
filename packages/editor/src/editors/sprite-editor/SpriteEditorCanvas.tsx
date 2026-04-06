// ═══════════════════════════════════════════════════════════════
// SpriteEditorCanvas.tsx — Core canvas for the unified Sprite
// Editor. Supports Grid view (tile-palette style) and List view
// (thumbnail grid style), with collider overlay rendering.
// ═══════════════════════════════════════════════════════════════

import { useRef, useEffect, useCallback, useState } from 'preact/hooks';
import type { SpriteSheet, FrameData } from '../../data/SpriteSheet';
import { drawColliderOverlay, drawColliderBadge } from './ColliderOverlay';
import { FrameContextMenu } from './FrameContextMenu';
import {
  activeSpriteSheetId,
  activeSpriteSheet,
  activeSpriteSheetImage,
  spriteEditorMode,
  colliderEditMode,
  spriteEditorZoom,
  spriteFilterText,
  selectedFrameIds,
  editorCam,
  filteredFrames,
  spriteSheets,
  stepZoom,
} from './state';

// ── Grid layout helpers ───────────────────────────────────────

interface GridInfo {
  /** Number of columns in the source image grid */
  cols: number;
  /** Number of rows in the source image grid */
  rows: number;
  /** Width of each frame in source pixels */
  frameW: number;
  /** Height of each frame in source pixels */
  frameH: number;
  /** Displayed cell width (frameW * zoom) */
  cellW: number;
  /** Displayed cell height (frameH * zoom) */
  cellH: number;
}

function getGridInfo(sheet: SpriteSheet, zoom: number): GridInfo | null {
  const frameEntries = Object.values(sheet.frames);
  if (frameEntries.length === 0) return null;
  const f0 = frameEntries[0];
  const frameW = f0.w;
  const frameH = f0.h;
  if (frameW <= 0 || frameH <= 0) return null;
  const cols = Math.max(1, Math.floor(sheet.imageWidth / frameW));
  const rows = Math.max(1, Math.ceil(frameEntries.length / cols));
  return {
    cols,
    rows,
    frameW,
    frameH,
    cellW: Math.max(1, Math.round(frameW * zoom)),
    cellH: Math.max(1, Math.round(frameH * zoom)),
  };
}

// ── List layout helpers ───────────────────────────────────────

interface ListLayout {
  cols: number;
  cellSize: number;
  thumbSize: number;
  padding: number;
  rows: number;
}

function getListLayout(containerW: number, frameCount: number, zoom: number): ListLayout {
  const baseCellSize = 64;
  const cellSize = Math.max(32, Math.round(baseCellSize * zoom));
  const padding = 4;
  const cols = Math.max(1, Math.floor((containerW + padding) / (cellSize + padding)));
  const rows = Math.ceil(frameCount / cols);
  const thumbSize = cellSize - 8;
  return { cols, cellSize, thumbSize, padding, rows };
}

// ── Context menu state ────────────────────────────────────────

interface CtxMenuState {
  x: number;
  y: number;
  frameId: string;
  sheetId: string;
}

// ── Frame entry type (from filteredFrames) ────────────────────

type FrameEntry = { id: string; frame: FrameData };

// ── Component ─────────────────────────────────────────────────

export function SpriteEditorCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoverIdx = useRef<number>(-1);
  const selDragStart = useRef<number | null>(null);

  const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null);
  const [tooltip, setTooltip] = useState<{
    text: string;
    x: number;
    y: number;
  } | null>(null);

  // ── Drawing ─────────────────────────────────────────────────

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const sheet = activeSpriteSheet.value;
    const img = activeSpriteSheetImage.value;
    const mode = spriteEditorMode.value;
    const zoom = spriteEditorZoom.value;
    const cam = editorCam.value;
    const showColliders = colliderEditMode.value;
    const frames = filteredFrames.value;
    const selected = selectedFrameIds.value;

    const dpr = window.devicePixelRatio || 1;
    const w = container.clientWidth;
    const h = container.clientHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    const ctx = canvas.getContext('2d')!;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = false;

    if (!sheet) {
      ctx.fillStyle = '#888';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('\u70B9\u51FB\u300C\u5BFC\u5165\u300D\u6DFB\u52A0\u7CBE\u7075\u56FE\u96C6', w / 2, h / 2);
      return;
    }

    if (frames.length === 0) {
      ctx.fillStyle = '#888';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        spriteFilterText.value ? '\u672A\u627E\u5230\u5339\u914D\u5E27' : '\u56FE\u96C6\u65E0\u5E27',
        w / 2,
        h / 2,
      );
      return;
    }

    if (mode === 'grid') {
      drawGridView(ctx, sheet, img, frames, selected, cam, zoom, w, h, showColliders);
    } else {
      drawListView(ctx, sheet, img, frames, selected, cam, zoom, w, h, showColliders);
    }
  }, []);

  // ── Grid View drawing ───────────────────────────────────────

  function drawGridView(
    ctx: CanvasRenderingContext2D,
    sheet: SpriteSheet,
    img: HTMLImageElement | null,
    frames: FrameEntry[],
    selected: string[],
    cam: { x: number; y: number },
    zoom: number,
    viewW: number,
    viewH: number,
    showColliders: boolean,
  ): void {
    const grid = getGridInfo(sheet, zoom);
    if (!grid) return;
    const { cols, cellW, cellH } = grid;
    const totalRows = Math.ceil(frames.length / cols);

    ctx.save();
    ctx.translate(-cam.x, -cam.y);

    // Draw frame images
    if (img) {
      for (let i = 0; i < frames.length; i++) {
        const entry = frames[i];
        const col = i % cols;
        const row = Math.floor(i / cols);
        ctx.drawImage(
          img,
          entry.frame.x, entry.frame.y, entry.frame.w, entry.frame.h,
          col * cellW, row * cellH, cellW, cellH,
        );
      }
    }

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 1;
    for (let c = 0; c <= cols; c++) {
      ctx.beginPath();
      ctx.moveTo(c * cellW + 0.5, 0);
      ctx.lineTo(c * cellW + 0.5, totalRows * cellH);
      ctx.stroke();
    }
    for (let r = 0; r <= totalRows; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * cellH + 0.5);
      ctx.lineTo(cols * cellW, r * cellH + 0.5);
      ctx.stroke();
    }

    // Hover highlight
    const hover = hoverIdx.current;
    if (hover >= 0 && hover < frames.length) {
      const hc = hover % cols;
      const hr = Math.floor(hover / cols);
      ctx.fillStyle = 'rgba(255,255,255,0.12)';
      ctx.fillRect(hc * cellW, hr * cellH, cellW, cellH);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 1;
      ctx.strokeRect(hc * cellW + 0.5, hr * cellH + 0.5, cellW - 1, cellH - 1);
    }

    // Selection highlight
    const selectedSet = new Set(selected);
    for (let i = 0; i < frames.length; i++) {
      if (!selectedSet.has(frames[i].id)) continue;
      const sc = i % cols;
      const sr = Math.floor(i / cols);
      ctx.strokeStyle = 'rgba(74,144,217,0.9)';
      ctx.lineWidth = 2;
      ctx.strokeRect(sc * cellW, sr * cellH, cellW, cellH);
      ctx.fillStyle = 'rgba(74,144,217,0.2)';
      ctx.fillRect(sc * cellW, sr * cellH, cellW, cellH);
    }

    // Collider overlays
    if (showColliders) {
      for (let i = 0; i < frames.length; i++) {
        const entry = frames[i];
        if (!entry.frame.collider || entry.frame.collider.length === 0) continue;
        const col = i % cols;
        const row = Math.floor(i / cols);
        drawColliderOverlay(
          ctx,
          entry.frame.collider,
          col * cellW, row * cellH,
          cellW, cellH,
          false, // oneWay not yet supported in FrameData
        );
      }
    } else {
      // Draw small badges for frames that have colliders
      for (let i = 0; i < frames.length; i++) {
        const entry = frames[i];
        if (!entry.frame.collider || entry.frame.collider.length === 0) continue;
        const col = i % cols;
        const row = Math.floor(i / cols);
        drawColliderBadge(
          ctx,
          col * cellW, row * cellH,
          cellW, cellH,
          false, // oneWay not yet supported in FrameData
        );
      }
    }

    ctx.restore();

    // Bottom fade
    const totalH = totalRows * cellH - cam.y;
    if (totalH > viewH) {
      const grad = ctx.createLinearGradient(0, viewH - 24, 0, viewH);
      grad.addColorStop(0, 'rgba(30,30,30,0)');
      grad.addColorStop(1, 'rgba(30,30,30,0.8)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, viewH - 24, viewW, 24);
    }

    // Right fade
    const totalW = cols * cellW - cam.x;
    if (totalW > viewW) {
      const grad = ctx.createLinearGradient(viewW - 24, 0, viewW, 0);
      grad.addColorStop(0, 'rgba(30,30,30,0)');
      grad.addColorStop(1, 'rgba(30,30,30,0.8)');
      ctx.fillStyle = grad;
      ctx.fillRect(viewW - 24, 0, 24, viewH);
    }
  }

  // ── List View drawing ───────────────────────────────────────

  function drawListView(
    ctx: CanvasRenderingContext2D,
    sheet: SpriteSheet,
    img: HTMLImageElement | null,
    frames: FrameEntry[],
    selected: string[],
    cam: { x: number; y: number },
    zoom: number,
    viewW: number,
    viewH: number,
    showColliders: boolean,
  ): void {
    const layout = getListLayout(viewW, frames.length, zoom);
    const { cols, cellSize, thumbSize, padding } = layout;
    const selectedSet = new Set(selected);

    ctx.save();
    ctx.translate(-cam.x, -cam.y);

    for (let i = 0; i < frames.length; i++) {
      const entry = frames[i];
      const fd = entry.frame;
      const col = i % cols;
      const row = Math.floor(i / cols);
      const cx = col * (cellSize + padding);
      const cy = row * (cellSize + padding);

      const isSelected = selectedSet.has(entry.id);
      const isHovered = i === hoverIdx.current;

      // Cell background
      if (isSelected) {
        ctx.fillStyle = 'rgba(74, 144, 217, 0.35)';
        ctx.fillRect(cx, cy, cellSize, cellSize);
        ctx.strokeStyle = 'rgba(74, 144, 217, 0.9)';
        ctx.lineWidth = 2;
        ctx.strokeRect(cx + 1, cy + 1, cellSize - 2, cellSize - 2);
      } else if (isHovered) {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.fillRect(cx, cy, cellSize, cellSize);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.lineWidth = 1;
        ctx.strokeRect(cx + 0.5, cy + 0.5, cellSize - 1, cellSize - 1);
      } else {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.fillRect(cx, cy, cellSize, cellSize);
      }

      // Draw frame thumbnail
      if (img) {
        const innerPad = 4;
        const drawArea = thumbSize;
        const scale = Math.min(drawArea / fd.w, drawArea / fd.h, 1);
        const dw = fd.w * scale;
        const dh = fd.h * scale;
        const dx = cx + innerPad + (drawArea - dw) / 2;
        const dy = cy + innerPad + (drawArea - dh) / 2;

        if (fd.rotated) {
          ctx.save();
          ctx.translate(dx + dw / 2, dy + dh / 2);
          ctx.rotate(-Math.PI / 2);
          ctx.drawImage(
            img,
            fd.x, fd.y, fd.h, fd.w,
            -dh / 2, -dw / 2, dh, dw,
          );
          ctx.restore();
        } else {
          ctx.drawImage(
            img,
            fd.x, fd.y, fd.w, fd.h,
            dx, dy, dw, dh,
          );
        }
      }

      // Collider overlay or badge
      if (showColliders) {
        if (entry.frame.collider && entry.frame.collider.length > 0) {
          drawColliderOverlay(
            ctx,
            entry.frame.collider,
            cx, cy,
            cellSize, cellSize,
            false, // oneWay not yet supported in FrameData
          );
        }
      } else {
        if (entry.frame.collider && entry.frame.collider.length > 0) {
          drawColliderBadge(ctx, cx, cy, cellSize, cellSize, false);
        }
      }

      // Frame name label
      if (cellSize >= 48) {
        ctx.fillStyle = '#bbb';
        ctx.font = '9px sans-serif';
        ctx.textAlign = 'center';
        const label = entry.id.length > 10
          ? entry.id.slice(0, 9) + '\u2026'
          : entry.id;
        ctx.fillText(label, cx + cellSize / 2, cy + cellSize - 2);
      }
    }

    ctx.restore();

    // Bottom fade
    const totalH = layout.rows * (cellSize + padding) - cam.y;
    if (totalH > viewH) {
      const grad = ctx.createLinearGradient(0, viewH - 20, 0, viewH);
      grad.addColorStop(0, 'rgba(30,30,30,0)');
      grad.addColorStop(1, 'rgba(30,30,30,0.8)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, viewH - 20, viewW, 20);
    }
  }

  // ── Redraw on signal changes ────────────────────────────────

  useEffect(() => {
    draw();
  }, [
    activeSpriteSheetId.value,
    spriteSheets.value,
    spriteEditorMode.value,
    spriteEditorZoom.value,
    colliderEditMode.value,
    spriteFilterText.value,
    selectedFrameIds.value,
    editorCam.value,
  ]);

  // ── ResizeObserver ──────────────────────────────────────────

  useEffect(() => {
    const el = containerRef.current!;
    const ro = new ResizeObserver(() => draw());
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Reset camera on sheet change ───────────────────────────

  useEffect(() => {
    editorCam.value = { x: 0, y: 0 };
    hoverIdx.current = -1;
  }, [activeSpriteSheetId.value]);

  // ── Hit testing ─────────────────────────────────────────────

  const screenToIndex = (clientX: number, clientY: number): number => {
    const container = containerRef.current;
    const canvas = canvasRef.current;
    if (!container || !canvas) return -1;
    const sheet = activeSpriteSheet.value;
    if (!sheet) return -1;
    const frames = filteredFrames.value;
    if (frames.length === 0) return -1;

    const rect = canvas.getBoundingClientRect();
    const cam = editorCam.value;
    const zoom = spriteEditorZoom.value;
    const mode = spriteEditorMode.value;
    const mx = clientX - rect.left + cam.x;
    const my = clientY - rect.top + cam.y;

    if (mode === 'grid') {
      const grid = getGridInfo(sheet, zoom);
      if (!grid) return -1;
      const col = Math.floor(mx / grid.cellW);
      const row = Math.floor(my / grid.cellH);
      if (col < 0 || col >= grid.cols || row < 0) return -1;
      const idx = row * grid.cols + col;
      return idx < frames.length ? idx : -1;
    } else {
      const w = container.clientWidth;
      const layout = getListLayout(w, frames.length, zoom);
      const col = Math.floor(mx / (layout.cellSize + layout.padding));
      const row = Math.floor(my / (layout.cellSize + layout.padding));
      if (col < 0 || col >= layout.cols || row < 0) return -1;
      const cellX = mx - col * (layout.cellSize + layout.padding);
      const cellY = my - row * (layout.cellSize + layout.padding);
      if (cellX > layout.cellSize || cellY > layout.cellSize) return -1;
      const idx = row * layout.cols + col;
      return idx < frames.length ? idx : -1;
    }
  };

  // ── Pointer events ──────────────────────────────────────────

  const onPointerDown = (e: PointerEvent) => {
    // Close context menu on any click
    if (ctxMenu) {
      setCtxMenu(null);
      return;
    }

    // Middle-click or Alt+left-click -> pan
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      const startCam = { ...editorCam.value };
      const startX = e.clientX;
      const startY = e.clientY;
      const onMove = (ev: PointerEvent) => {
        editorCam.value = {
          x: Math.max(0, startCam.x - (ev.clientX - startX)),
          y: Math.max(0, startCam.y - (ev.clientY - startY)),
        };
      };
      const onUp = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      return;
    }

    // Left click -> select
    if (e.button === 0) {
      const idx = screenToIndex(e.clientX, e.clientY);
      if (idx < 0) {
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
          selectedFrameIds.value = [];
        }
        return;
      }
      const frames = filteredFrames.value;
      const entry = frames[idx];
      selDragStart.current = idx;

      if (e.shiftKey) {
        // Range select: from first selected to current
        const currentSelected = selectedFrameIds.value;
        if (currentSelected.length > 0) {
          const firstIdx = frames.findIndex((f) => f.id === currentSelected[0]);
          if (firstIdx >= 0) {
            const lo = Math.min(firstIdx, idx);
            const hi = Math.max(firstIdx, idx);
            selectedFrameIds.value = frames.slice(lo, hi + 1).map((f) => f.id);
          } else {
            selectedFrameIds.value = [entry.id];
          }
        } else {
          selectedFrameIds.value = [entry.id];
        }
      } else if (e.ctrlKey || e.metaKey) {
        // Toggle select
        const cur = selectedFrameIds.value;
        if (cur.includes(entry.id)) {
          selectedFrameIds.value = cur.filter((id) => id !== entry.id);
        } else {
          selectedFrameIds.value = [...cur, entry.id];
        }
      } else {
        selectedFrameIds.value = [entry.id];
      }
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    const idx = screenToIndex(e.clientX, e.clientY);

    // Update hover
    if (idx !== hoverIdx.current) {
      hoverIdx.current = idx;
      draw();

      // Tooltip
      if (idx >= 0) {
        const frames = filteredFrames.value;
        const entry = frames[idx];
        const rect = containerRef.current!.getBoundingClientRect();
        setTooltip({
          text: `${entry.id}  (${entry.frame.w}\u00D7${entry.frame.h})`,
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      } else {
        setTooltip(null);
      }
    } else if (idx >= 0 && tooltip) {
      const rect = containerRef.current!.getBoundingClientRect();
      setTooltip((prev) =>
        prev
          ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top }
          : prev,
      );
    }

    // Drag selection (left button, no alt)
    if ((e.buttons & 1) && !e.altKey && selDragStart.current !== null) {
      if (idx >= 0 && idx !== selDragStart.current) {
        const frames = filteredFrames.value;
        const lo = Math.min(selDragStart.current, idx);
        const hi = Math.max(selDragStart.current, idx);
        selectedFrameIds.value = frames.slice(lo, hi + 1).map((f) => f.id);
      }
    }
  };

  const onPointerUp = () => {
    selDragStart.current = null;
  };

  const onPointerLeave = () => {
    if (hoverIdx.current >= 0) {
      hoverIdx.current = -1;
      draw();
    }
    setTooltip(null);
  };

  // ── Right-click -> context menu ─────────────────────────────

  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    const idx = screenToIndex(e.clientX, e.clientY);
    const sheet = activeSpriteSheet.value;
    if (idx < 0 || !sheet) return;
    const frames = filteredFrames.value;
    const entry = frames[idx];

    // Ensure the right-clicked frame is selected
    if (!selectedFrameIds.value.includes(entry.id)) {
      selectedFrameIds.value = [entry.id];
    }

    const rect = containerRef.current!.getBoundingClientRect();
    setCtxMenu({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      frameId: entry.id,
      sheetId: sheet.id,
    });
  };

  // ── Wheel -> scroll / zoom ──────────────────────────────────

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      // Zoom
      const dir: -1 | 1 = e.deltaY > 0 ? -1 : 1;
      stepZoom(dir);
    } else {
      // Scroll
      const cam = editorCam.value;
      if (e.shiftKey) {
        editorCam.value = { ...cam, x: Math.max(0, cam.x + e.deltaY) };
      } else {
        editorCam.value = { ...cam, y: Math.max(0, cam.y + e.deltaY) };
      }
    }
  };

  // ── Render ──────────────────────────────────────────────────

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        cursor: 'pointer',
        imageRendering: 'pixelated',
        position: 'relative',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onContextMenu={onContextMenu}
      onWheel={onWheel}
    >
      <canvas
        ref={canvasRef}
        style={{ display: 'block', imageRendering: 'pixelated' }}
      />

      {/* Tooltip */}
      {tooltip && (
        <div
          style={{
            position: 'absolute',
            left: tooltip.x + 12,
            top: tooltip.y - 28,
            background: 'rgba(0,0,0,0.85)',
            color: '#ddd',
            fontSize: 11,
            padding: '3px 8px',
            borderRadius: 4,
            pointerEvents: 'none',
            whiteSpace: 'nowrap',
            zIndex: 10,
          }}
        >
          {tooltip.text}
        </div>
      )}

      {/* Context menu */}
      {ctxMenu && (
        <FrameContextMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          frameId={ctxMenu.frameId}
          sheetId={ctxMenu.sheetId}
          onClose={() => setCtxMenu(null)}
        />
      )}
    </div>
  );
}
