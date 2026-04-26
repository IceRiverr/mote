// ═══════════════════════════════════════════════════════════════
// SpriteEditorCanvas.tsx — Core canvas for the unified Sprite
// Editor. Supports Grid view (tile-palette style) and List view
// (thumbnail grid style), with collider overlay rendering.
// ═══════════════════════════════════════════════════════════════

import { useRef, useEffect, useState } from 'preact/hooks';
import { effect } from '@preact/signals';
import type { SpriteSheet, FrameData } from '../../data/SpriteSheet';
import { drawColliderOverlay } from './ColliderOverlay';
import { FrameContextMenu } from './FrameContextMenu';
import {
  activeSpriteSheetId,
  activeSpriteSheet,
  activeSpriteSheetImage,
  spriteEditorMode,
  editorMode,
  colliderTool,
  showColliderOverlay,
  spriteEditorZoom,
  spriteFilterText,
  selectedFrameIds,
  editorCam,
  filteredFrames,
  spriteSheets,
  stepZoom,
  setFrameCollider,
  statusBarMessage,
} from './state';
import { COLLIDER_PRESETS } from '../../data/Collider';

// ── Grid layout helpers ───────────────────────────────────────

interface GridInfo {
  cols: number;
  rows: number;
  frameW: number;
  frameH: number;
  cellW: number;
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
  innerPad: number;
}

function getListLayout(containerW: number, frameCount: number, zoom: number): ListLayout {
  const baseCellSize = 96; // Increased from 64 for better visibility
  const cellSize = Math.max(48, Math.round(baseCellSize * zoom));
  const padding = 8; // Increased padding
  const cols = Math.max(1, Math.floor((containerW + padding) / (cellSize + padding)));
  const rows = Math.ceil(frameCount / cols);
  const innerPad = 8; // Padding inside cell for thumbnail
  const thumbSize = cellSize - innerPad * 2;
  return { cols, cellSize, thumbSize, padding, rows, innerPad };
}

// ── Context menu state ────────────────────────────────────────

interface CtxMenuState {
  x: number;
  y: number;
  frameId: string;
  sheetId: string;
}

type FrameEntry = { id: string; frame: FrameData };

// ── Component ─────────────────────────────────────────────────

export function SpriteEditorCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const hoverIdx = useRef<number>(-1);
  const selDragStart = useRef<number | null>(null);
  const isPanning = useRef(false);
  const [ctxMenu, setCtxMenu] = useState<CtxMenuState | null>(null);
  const [tooltip, setTooltip] = useState<{ text: string; x: number; y: number } | null>(null);
  const [renderTick, setRenderTick] = useState(0);

  // Force re-render when signals change using effect
  useEffect(() => {
    const dispose = effect(() => {
      // Access all signals to track dependencies
      spriteSheets.value;
      spriteEditorMode.value;
      spriteEditorZoom.value;
      editorMode.value;
      colliderTool.value;
      showColliderOverlay.value;
      spriteFilterText.value;
      selectedFrameIds.value;
      editorCam.value;
      activeSpriteSheetId.value;
      
      setRenderTick(t => t + 1);
    });
    return dispose;
  }, []);

  // Draw function
  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const sheet = activeSpriteSheet.value;
    const img = activeSpriteSheetImage.value;
    const mode = spriteEditorMode.value;
    const zoom = spriteEditorZoom.value;
    const cam = editorCam.value;
    const frames = filteredFrames.value;
    const selected = selectedFrameIds.value;

    // Use new state system
    const showColliders = showColliderOverlay.value || editorMode.value === 'collider';

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
      ctx.fillText('点击「导入」添加精灵图集', w / 2, h / 2);
      return;
    }

    if (frames.length === 0) {
      ctx.fillStyle = '#888';
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        spriteFilterText.value ? '未找到匹配帧' : '图集无帧',
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
  }, [renderTick]);

  // Resize handler
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setRenderTick(t => t + 1));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Reset camera on sheet change
  useEffect(() => {
    editorCam.value = { x: 0, y: 0 };
    hoverIdx.current = -1;
  }, [activeSpriteSheetId.value]);

  // ── Apply collider tool to frame ────────────────────────────
  const applyColliderTool = (frameId: string) => {
    const sheet = activeSpriteSheet.value;
    if (!sheet) return;
    
    const tool = colliderTool.value;
    let shapes;
    
    switch (tool) {
      case 'full': shapes = COLLIDER_PRESETS.full; break;
      case 'halfTop': shapes = COLLIDER_PRESETS.halfTop; break;
      case 'halfBottom': shapes = COLLIDER_PRESETS.halfBottom; break;
      case 'slopeNE': shapes = COLLIDER_PRESETS.slopeNE; break;
      case 'slopeNW': shapes = COLLIDER_PRESETS.slopeNW; break;
      case 'slopeSE': shapes = COLLIDER_PRESETS.slopeSE; break;
      case 'slopeSW': shapes = COLLIDER_PRESETS.slopeSW; break;
      case 'eraser': shapes = undefined; break;
      default: return;
    }
    
    setFrameCollider(sheet.id, frameId, shapes);
    statusBarMessage.value = `已${shapes ? '添加' : '移除'}碰撞体: ${frameId}`;
  };

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

    // Collider overlays (draw BEFORE hover/selection so they appear underneath)
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
          false,
        );
      }
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

    // Selection highlight (draw LAST so it's on top)
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
    const { cols, cellSize, thumbSize, padding, innerPad } = layout;
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

      // Calculate thumbnail draw area (same logic for both image and collider)
      // Scale to fill the available area (upscale small images, downscale large ones)
      const drawArea = thumbSize;
      const thumbScale = Math.min(drawArea / fd.w, drawArea / fd.h);
      const thumbW = fd.w * thumbScale;
      const thumbH = fd.h * thumbScale;
      const thumbX = cx + innerPad + (drawArea - thumbW) / 2;
      const thumbY = cy + innerPad + (drawArea - thumbH) / 2;

      // Draw frame thumbnail
      if (img) {
        if (fd.rotated) {
          ctx.save();
          ctx.translate(thumbX + thumbW / 2, thumbY + thumbH / 2);
          ctx.rotate(-Math.PI / 2);
          ctx.drawImage(img, fd.x, fd.y, fd.h, fd.w, -thumbH / 2, -thumbW / 2, thumbH, thumbW);
          ctx.restore();
        } else {
          ctx.drawImage(img, fd.x, fd.y, fd.w, fd.h, thumbX, thumbY, thumbW, thumbH);
        }
      }

      // Collider overlay (drawn in thumbnail area, not full cell)
      if (showColliders && entry.frame.collider && entry.frame.collider.length > 0) {
        drawColliderOverlay(ctx, entry.frame.collider, thumbX, thumbY, thumbW, thumbH, false);
      }

      // Frame name label (positioned below thumbnail area)
      if (cellSize >= 64) {
        ctx.fillStyle = '#bbb';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'center';
        const label = entry.id.length > 12 ? entry.id.slice(0, 11) + '…' : entry.id;
        ctx.fillText(label, cx + cellSize / 2, cy + cellSize - 6);
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
    if (ctxMenu) {
      setCtxMenu(null);
      return;
    }

    // Pan with middle mouse or Alt+Left (Blender-style)
    if (e.button === 1 || (e.button === 0 && e.altKey)) {
      e.preventDefault();
      isPanning.current = true;
      const container = containerRef.current;
      if (container) container.style.cursor = 'grabbing';

      const startCam = { ...editorCam.value };
      const startX = e.clientX;
      const startY = e.clientY;
      const onMove = (ev: PointerEvent) => {
        editorCam.value = {
          x: startCam.x - (ev.clientX - startX),
          y: startCam.y - (ev.clientY - startY),
        };
      };
      const onUp = () => {
        isPanning.current = false;
        if (container) {
          container.style.cursor = editorMode.value === 'collider' ? 'crosshair' : 'grab';
        }
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
      };
      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      return;
    }

    if (e.button === 0) {
      const idx = screenToIndex(e.clientX, e.clientY);
      
      // Click on empty area
      if (idx < 0) {
        if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
          selectedFrameIds.value = [];
        }
        return;
      }
      
      const frames = filteredFrames.value;
      const entry = frames[idx];
      selDragStart.current = idx;

      // Collider mode: apply collider tool on click
      if (editorMode.value === 'collider') {
        applyColliderTool(entry.id);
        // Also select the frame
        if (!e.ctrlKey && !e.metaKey && !e.shiftKey) {
          selectedFrameIds.value = [entry.id];
        }
        return;
      }

      // Selection logic
      if (e.shiftKey) {
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
    if (idx !== hoverIdx.current) {
      hoverIdx.current = idx;
      setRenderTick(t => t + 1);
      if (idx >= 0) {
        const frames = filteredFrames.value;
        const entry = frames[idx];
        const rect = containerRef.current!.getBoundingClientRect();
        
        // Add tool hint when in collider mode
        let text = `${entry.id}  (${entry.frame.w}×${entry.frame.h})`;
        if (editorMode.value === 'collider') {
          text += ' — 点击应用';
        }
        
        setTooltip({
          text,
          x: e.clientX - rect.left,
          y: e.clientY - rect.top,
        });
      } else {
        setTooltip(null);
      }
    } else if (idx >= 0 && tooltip) {
      const rect = containerRef.current!.getBoundingClientRect();
      setTooltip((prev) => prev ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top } : prev);
    }
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
    if (!isPanning.current) {
      const container = containerRef.current;
      if (container) {
        container.style.cursor = editorMode.value === 'collider' ? 'crosshair' : 'grab';
      }
    }
  };

  const onPointerLeave = () => {
    if (hoverIdx.current >= 0) {
      hoverIdx.current = -1;
      setRenderTick(t => t + 1);
    }
    setTooltip(null);
  };

  const onContextMenu = (e: MouseEvent) => {
    e.preventDefault();
    const idx = screenToIndex(e.clientX, e.clientY);
    const sheet = activeSpriteSheet.value;
    if (idx < 0 || !sheet) return;
    const frames = filteredFrames.value;
    const entry = frames[idx];
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

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey || e.metaKey) {
      stepZoom(e.deltaY > 0 ? -1 : 1);
    } else {
      const cam = editorCam.value;
      if (e.shiftKey) {
        editorCam.value = { ...cam, x: cam.x + e.deltaY };
      } else {
        editorCam.value = { ...cam, y: cam.y + e.deltaY };
      }
    }
  };

  const onMouseDown = (e: MouseEvent) => {
    // Prevent browser default middle-click scroll behavior
    if (e.button === 1) {
      e.preventDefault();
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        cursor: editorMode.value === 'collider' ? 'crosshair' : 'grab',
        imageRendering: 'pixelated',
        position: 'relative',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onContextMenu={onContextMenu}
      onWheel={onWheel}
      onMouseDown={onMouseDown}
    >
      <canvas ref={canvasRef} style={{ display: 'block', imageRendering: 'pixelated' }} />
      {tooltip && (
        <div style={{ position: 'absolute', left: tooltip.x + 12, top: tooltip.y - 28, background: 'rgba(0,0,0,0.85)', color: '#ddd', fontSize: 11, padding: '3px 8px', borderRadius: 4, pointerEvents: 'none', whiteSpace: 'nowrap', zIndex: 10 }}>
          {tooltip.text}
        </div>
      )}
      {ctxMenu && (
        <FrameContextMenu x={ctxMenu.x} y={ctxMenu.y} frameId={ctxMenu.frameId} sheetId={ctxMenu.sheetId} onClose={() => setCtxMenu(null)} />
      )}
    </div>
  );
}
