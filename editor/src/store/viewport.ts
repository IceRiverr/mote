// ═══════════════════════════════════════════════════════════════
// viewport.ts — 视口相机状态与坐标转换
// ═══════════════════════════════════════════════════════════════

import { signal } from "@preact/signals";

export interface ViewportCamera {
  x: number;    // 视口左边缘的世界 x（CSS 像素，缩放前）
  y: number;    // 视口顶边缘的世界 y（CSS 像素，缩放前）
  zoom: number; // 缩放因子（1 = 1:1）
}

export const viewportCamera = signal<ViewportCamera>({ x: 0, y: 0, zoom: 1 });
export const needsInitialCenter = signal(true);

/** 鼠标悬停时的世界坐标（由 ViewportCanvas 更新） */
export const hoverWorldPos = signal<{ x: number; y: number } | null>(null);

/** 视口显示偏好（尚未序列化） */
export const viewportSettings = signal({
  showGrid: true,
  showAxisGizmo: true,
  dimOutOfBounds: true,
  gridColor: "rgba(255, 255, 255, 0.08)",
  outOfBoundsColor: "rgba(0, 0, 0, 0.50)",
  axisGizmoSize: 60,
});

// ── 坐标转换 ─────────────────────────────────────────────────

/** 屏幕坐标 → 世界坐标 */
export function screenToWorld(
  screenX: number,
  screenY: number,
  rect: DOMRect,
  cam: ViewportCamera = viewportCamera.value,
): { x: number; y: number } {
  const x = screenX - rect.left + cam.x;
  const y = screenY - rect.top + cam.y;
  return {
    x: x / cam.zoom,
    y: y / cam.zoom,
  };
}

/** 世界坐标 → 屏幕坐标 */
export function worldToScreen(
  worldX: number,
  worldY: number,
  cam: ViewportCamera = viewportCamera.value,
): { x: number; y: number } {
  return {
    x: worldX * cam.zoom - cam.x,
    y: worldY * cam.zoom - cam.y,
  };
}

/** 世界坐标 → 网格坐标 */
export function worldToGrid(
  worldX: number,
  worldY: number,
  gridSize: number,
): { x: number; y: number } {
  return {
    x: Math.floor(worldX / gridSize),
    y: Math.floor(worldY / gridSize),
  };
}

// ── 相机操作 ─────────────────────────────────────────────────

/** 设置缩放，保持指定屏幕点对应的世界坐标不变 */
export function setZoomAt(
  newZoom: number,
  screenX: number,
  screenY: number,
  cam: ViewportCamera = viewportCamera.value,
): void {
  const worldX = (screenX + cam.x) / cam.zoom;
  const worldY = (screenY + cam.y) / cam.zoom;
  viewportCamera.value = {
    x: worldX * newZoom - screenX,
    y: worldY * newZoom - screenY,
    zoom: Math.max(0.1, Math.min(5, newZoom)),
  };
}

/** 直接设置缩放（用于页眉输入框） */
export function setZoom(newZoom: number): void {
  viewportCamera.value = {
    ...viewportCamera.value,
    zoom: Math.max(0.1, Math.min(5, newZoom)),
  };
}

/** 将相机居中到给定矩形 */
export function centerCameraOnRect(
  rectW: number,
  rectH: number,
  viewW: number,
  viewH: number,
): void {
  const cam = viewportCamera.value;
  viewportCamera.value = {
    x: (rectW * cam.zoom - viewW) / 2,
    y: (rectH * cam.zoom - viewH) / 2,
    zoom: cam.zoom,
  };
}
