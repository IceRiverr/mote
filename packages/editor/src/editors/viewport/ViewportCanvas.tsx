// ═══════════════════════════════════════════════════════════════
// ViewportCanvas.tsx - 新的 Entity-based Viewport 渲染
// ═══════════════════════════════════════════════════════════════

import { useRef, useEffect, useCallback } from "preact/hooks";
import { signal, useSignalEffect } from "@preact/signals";
import {
  currentScene,
  sceneVersion,
  selectedEntityIds,
  lastSelectedEntityId,
  selectEntity,
  toggleEntitySelection,
  selectEntitiesInRect,
  clearSelection,
  gridSettings,
  snapEnabled,
  findEntityAt,
  getEntity,
  bumpVersion,
  spawnPrefab,
} from "../../store/scene";
import { prefabs, getPrefab } from "../../store/prefabs";
import { openSpawnMenu, closeSpawnMenu, spawnMenuOpen, spawnMenuPos, spawnWorldPos } from "../../store/spawnMenu";
import { SpawnMenu } from "../../components/SpawnMenu";
import { layerVisibility, isLayerVisible } from "../../editors/inspector/panels/LayerPanel";
import { onEditModeChange, handleViewportShortcut, editMode, entityTool, brushTool, setBrushTool } from "../../store/viewport-mode";
import {
  viewportCamera,
  needsInitialCenter,
  hoverWorldPos,
  screenToWorld,
  worldToScreen,
  worldToGrid,
  setZoomAt,
  type ViewportCamera,
} from "../../store/viewport";
import { spriteSheets, spriteSheetImages } from "../../store/spriteSheet";
import { 
  brushPattern, 
  brushSize, 
  targetLayer, 
  activePrefabPath,
  getBrushGridPositions,
  setSinglePrefabBrush,
  brushMode,
  BrushMode,
} from "../../store/brush";
import type { SceneEntity } from "../../data/Scene";
import { createSceneEntity, getNextEntityName, snapToSize } from "../../data/Scene";
import { derivePrefabId } from "../../data/Prefab";
import { resolveEntitySprite, getEntityDisplaySize, resolvePrefabSprite } from "../../utils/entitySprite";

// ═══════════════════════════════════════════════════════════════
// 辅助函数：查找指定网格位置的实体
// ═══════════════════════════════════════════════════════════════

function findEntityAtGrid(
  gridX: number,
  gridY: number,
  layer: number,
  gridSize: number
): SceneEntity | undefined {
  const scene = currentScene.value;
  if (!scene) return undefined;

  const targetX = (gridX + 0.5) * gridSize;
  const targetY = (gridY + 0.5) * gridSize;

  for (let i = scene.entities.length - 1; i >= 0; i--) {
    const entity = scene.entities[i];
    const p = prefabs.value.get(entity.prefab);
    const entityLayer = p?.components?.Sprite?.layer ?? 0;
    if (entityLayer === layer && entity.transform.x === targetX && entity.transform.y === targetY) {
      return entity;
    }
  }
  return undefined;
}
import {
  executeCommand,
  undo,
  redo,
} from "../../store/history";
import {
  MoveEntitiesCommand,
  RemoveEntityCommand,
  DuplicateEntitiesCommand,
  type MoveRecord,
} from "../../commands";
import {
  PaintBrushCommand,
  EraseCommand,
  FloodFillCommand,
  pickPrefab,
} from "../../commands/brush-tool-commands";

// 相机状态已迁移到 store/viewport.ts

// ═══════════════════════════════════════════════════════════════
// 拖拽状态
// ═══════════════════════════════════════════════════════════════

/** 是否正在平移相机 */
const isPanning = signal(false);
const panStart = signal<{ x: number; y: number } | null>(null);
const panStartCamera = signal<ViewportCamera | null>(null);

/** 是否正在框选 */
const isBoxSelecting = signal(false);
const boxSelectStart = signal<{ x: number; y: number } | null>(null);
const boxSelectCurrent = signal<{ x: number; y: number } | null>(null);

/** rect-select 网格矩形选择（笔刷模式） */
const isRectSelecting = signal(false);
const rectSelectStartGrid = signal<{ x: number; y: number } | null>(null);
const rectSelectEndGrid = signal<{ x: number; y: number } | null>(null);

/** 是否正在移动 Entity */
const isMovingEntity = signal(false);
const moveStart = signal<{ x: number; y: number } | null>(null);
const moveEntitiesStart = signal<Map<string, { x: number; y: number }>>(new Map());

// ═══════════════════════════════════════════════════════════════
// 笔刷状态
// ═══════════════════════════════════════════════════════════════

/** 是否正在绘制 */
const isPainting = signal(false);
/** 当前笔刷命令 */
const currentBrushCmd = signal<PaintBrushCommand | null>(null);
/** 已绘制的格子（防止重复绘制） */
const paintedCells = signal<Set<string>>(new Set());
/** 当前悬停的网格坐标 */
const hoverGridPos = signal<{ x: number; y: number } | null>(null);

// ═══════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════



/** 获取当前工具的光标样式 */
function getCursorStyle(): string {
  if (isPanning.value) return "grabbing";

  if (editMode.value === "entity") {
    switch (entityTool.value) {
      case "select": return "default";
      case "move": return "move";
      default: return "default";
    }
  }

  switch (brushTool.value) {
    case "brush": return "crosshair";
    case "eraser": return "cell";
    case "eyedropper": return "copy";
    case "rect-select": return "crosshair";
    default: return "default";
  }
}

// ═══════════════════════════════════════════════════════════════
// 主组件
// ═══════════════════════════════════════════════════════════════

export function ViewportCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ═══════════════════════════════════════════════════════════════
  // 当前 stroke 的 Command（用于移动操作）
  // ═══════════════════════════════════════════════════════════════
  

  
  /** 记录最后一次鼠标位置（屏幕坐标），用于 Shift+A 菜单位置 */
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);

  // ═══════════════════════════════════════════════════════════════
  // 初始化
  // ═══════════════════════════════════════════════════════════════

  // 注册模式切换时的瞬态状态清除
  useEffect(() => {
    return onEditModeChange(() => {
      isPanning.value = false;
      panStart.value = null;
      panStartCamera.value = null;
      isBoxSelecting.value = false;
      boxSelectStart.value = null;
      boxSelectCurrent.value = null;
      isRectSelecting.value = false;
      rectSelectStartGrid.value = null;
      rectSelectEndGrid.value = null;
      isMovingEntity.value = false;
      moveStart.value = null;
      moveEntitiesStart.value = new Map();
      isPainting.value = false;
      currentBrushCmd.value = null;
      paintedCells.value = new Set();
      hoverGridPos.value = null;
    });
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // 设置 canvas 尺寸
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = container.clientWidth * dpr;
      canvas.height = container.clientHeight * dpr;
      canvas.style.width = container.clientWidth + "px";
      canvas.style.height = container.clientHeight + "px";
      
      // 首次居中
      if (needsInitialCenter.value) {
        centerCamera();
        needsInitialCenter.value = false;
      }
      
      draw();
    };

    const ro = new ResizeObserver(resize);
    ro.observe(container);
    resize();

    return () => ro.disconnect();
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // 居中相机
  // ═══════════════════════════════════════════════════════════════

  const centerCamera = useCallback(() => {
    const container = containerRef.current;
    const scene = currentScene.value;
    if (!container || !scene) return;

    const cam = viewportCamera.value;
    const vw = container.clientWidth;
    const vh = container.clientHeight;

    viewportCamera.value = {
      x: (scene.width * cam.zoom - vw) / 2,
      y: (scene.height * cam.zoom - vh) / 2,
      zoom: cam.zoom,
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // 渲染
  // ═══════════════════════════════════════════════════════════════

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    const scene = currentScene.value;
    if (!canvas || !container || !scene) return;

    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const w = canvas.width / dpr;
    const h = canvas.height / dpr;

    // 重置变换
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    
    // 清空背景
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(0, 0, w, h);

    const cam = viewportCamera.value;
    const gridSize = scene.grid.size;

    // 应用相机变换
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    ctx.scale(cam.zoom, cam.zoom);

    // 1. 场景区域内背景（略亮于外部）
    ctx.fillStyle = "#1e1e1e";
    ctx.fillRect(0, 0, scene.width, scene.height);

    // 2. 边界外变暗（evenodd 挖空场景区域）
    drawOutOfBounds(ctx, scene.width, scene.height, cam, w, h);

    // 3. 网格（裁剪到场景边界）+ 中心轴
    drawGrid(ctx, scene.width, scene.height, gridSize);

    // 4. 场景边界
    ctx.strokeStyle = "#4a90d9";
    ctx.lineWidth = 2 / cam.zoom;
    ctx.strokeRect(0, 0, scene.width, scene.height);

    // 5. 绘制所有 Entity（按层排序，过滤不可见层）
    const sortedEntities = [...scene.entities]
      .filter(entity => {
        const layer = getPrefab(entity.prefab)?.components.Sprite?.layer ?? 0;
        return isLayerVisible(layer);
      })
      .sort((a, b) => {
        const layerA = getPrefab(a.prefab)?.components.Sprite?.layer ?? 0;
        const layerB = getPrefab(b.prefab)?.components.Sprite?.layer ?? 0;
        // 同层按 Y 坐标排序（顶视角遮挡）
        return layerA - layerB || a.transform.y - b.transform.y;
      });
    
    for (const entity of sortedEntities) {
      const isSelected = selectedEntityIds.value.has(entity.id);
      const isLastSelected = isSelected && lastSelectedEntityId.value === entity.id;
      drawEntity(ctx, entity, isSelected, isLastSelected);
    }

    // 6. 笔刷预览
    if (hoverGridPos.value && editMode.value === "brush" && (brushTool.value === "brush" || brushTool.value === "eraser" || brushTool.value === "rect-select")) {
      drawBrushPreview(ctx, hoverGridPos.value.x, hoverGridPos.value.y, gridSize);
    }

    // 7. 框选框
    if (isBoxSelecting.value && boxSelectStart.value && boxSelectCurrent.value) {
      const x1 = boxSelectStart.value.x;
      const y1 = boxSelectStart.value.y;
      const x2 = boxSelectCurrent.value.x;
      const y2 = boxSelectCurrent.value.y;
      
      ctx.fillStyle = "rgba(74, 144, 217, 0.2)";
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      
      ctx.strokeStyle = "#4a90d9";
      ctx.lineWidth = 1 / cam.zoom;
      ctx.setLineDash([5 / cam.zoom, 5 / cam.zoom]);
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      ctx.setLineDash([]);
    }

    // 8. rect-select 网格矩形高亮
    if (isRectSelecting.value && rectSelectStartGrid.value && rectSelectEndGrid.value) {
      const x1 = Math.min(rectSelectStartGrid.value.x, rectSelectEndGrid.value.x) * gridSize;
      const y1 = Math.min(rectSelectStartGrid.value.y, rectSelectEndGrid.value.y) * gridSize;
      const x2 = (Math.max(rectSelectStartGrid.value.x, rectSelectEndGrid.value.x) + 1) * gridSize;
      const y2 = (Math.max(rectSelectStartGrid.value.y, rectSelectEndGrid.value.y) + 1) * gridSize;
      ctx.save();
      ctx.fillStyle = "rgba(244, 167, 66, 0.15)";
      ctx.fillRect(x1, y1, x2 - x1, y2 - y1);
      ctx.strokeStyle = "#f4a742";
      ctx.lineWidth = 1 / cam.zoom;
      ctx.setLineDash([4 / cam.zoom, 4 / cam.zoom]);
      ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
      ctx.setLineDash([]);
      ctx.restore();
    }

    // 9. 原点标记（世界空间）
    drawOriginMarker(ctx, cam);

    ctx.restore();

    // 9. 轴向指示器（屏幕空间）
    drawAxisGizmo(ctx, 48);
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // 绘制笔刷预览
  // ═══════════════════════════════════════════════════════════════

  function drawBrushPreview(ctx: CanvasRenderingContext2D, gridX: number, gridY: number, gridSize: number) {
    const cam = viewportCamera.value;

    if (brushTool.value === "brush") {
      const positions = getBrushGridPositions(gridX, gridY);

      for (const pos of positions) {
        const worldX = pos.x * gridSize;
        const worldY = pos.y * gridSize;

        // 优先绘制真实精灵幽灵（以网格中心为原点，与实体放置对齐）
        const resolved = resolvePrefabSprite(pos.prefabPath);
        if (resolved.image && resolved.frame) {
          ctx.save();
          ctx.globalAlpha = 0.5;
          ctx.imageSmoothingEnabled = false;
          const { x: sx, y: sy, w: sw, h: sh } = resolved.frame;
          const dw = sw;
          const dh = sh;
          const cx = worldX + gridSize / 2;
          const cy = worldY + gridSize / 2;
          if (resolved.rotated) {
            ctx.save();
            ctx.translate(cx, cy);
            ctx.rotate(-Math.PI / 2);
            ctx.drawImage(resolved.image, sx, sy, sw, sh, -dh / 2, -dw / 2, dh, dw);
            ctx.restore();
          } else {
            ctx.drawImage(resolved.image, sx, sy, sw, sh, cx - dw / 2, cy - dh / 2, dw, dh);
          }
          ctx.restore();
        } else {
          // 精灵未加载时回退到半透明网格框
          ctx.save();
          ctx.globalAlpha = 0.5;
          ctx.strokeStyle = "#4a90d9";
          ctx.lineWidth = 2 / cam.zoom;
          ctx.fillStyle = "rgba(74, 144, 217, 0.2)";
          ctx.strokeRect(worldX, worldY, gridSize, gridSize);
          ctx.fillRect(worldX, worldY, gridSize, gridSize);
          ctx.restore();
        }
      }
    } else if (brushTool.value === "eraser") {
      // 绘制橡皮擦预览（红色框）
      const size = brushSize.value;
      const halfSize = Math.floor(size / 2);

      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.strokeStyle = "#d4574a";
      ctx.lineWidth = 2 / cam.zoom;
      ctx.fillStyle = "rgba(212, 87, 74, 0.2)";

      for (let dy = -halfSize; dy <= halfSize; dy++) {
        for (let dx = -halfSize; dx <= halfSize; dx++) {
          const worldX = (gridX + dx) * gridSize;
          const worldY = (gridY + dy) * gridSize;
          ctx.strokeRect(worldX, worldY, gridSize, gridSize);
          ctx.fillRect(worldX, worldY, gridSize, gridSize);
        }
      }

      ctx.restore();
    } else if (brushTool.value === "rect-select") {
      // rect-select 悬停高亮当前网格单元格
      ctx.save();
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = "rgba(244, 167, 66, 0.3)";
      ctx.fillRect(gridX * gridSize, gridY * gridSize, gridSize, gridSize);
      ctx.strokeStyle = "#f4a742";
      ctx.lineWidth = 1 / cam.zoom;
      ctx.strokeRect(gridX * gridSize + 0.5, gridY * gridSize + 0.5, gridSize - 1, gridSize - 1);
      ctx.restore();
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 绘制边界外变暗
  // ═══════════════════════════════════════════════════════════════

  function drawOutOfBounds(
    ctx: CanvasRenderingContext2D,
    sceneW: number,
    sceneH: number,
    cam: ViewportCamera,
    viewW: number,
    viewH: number,
  ) {
    const visibleLeft = cam.x / cam.zoom;
    const visibleTop = cam.y / cam.zoom;
    const visibleW = viewW / cam.zoom;
    const visibleH = viewH / cam.zoom;

    ctx.save();
    ctx.beginPath();
    // 外矩形（整个可视世界区域，留足余量）
    ctx.rect(visibleLeft - 500, visibleTop - 500, visibleW + 1000, visibleH + 1000);
    // 内矩形（场景区域），evenodd 会挖空
    ctx.rect(0, 0, sceneW, sceneH);
    ctx.fillStyle = "rgba(0, 0, 0, 0.50)";
    ctx.fill("evenodd");
    ctx.restore();
  }

  // ═══════════════════════════════════════════════════════════════
  // 绘制网格
  // ═══════════════════════════════════════════════════════════════

  function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, size: number) {
    if (!gridSettings.value.enabled) return;

    const cam = viewportCamera.value;

    ctx.save();
    // 裁剪到场景边界，确保网格不越界
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.clip();

    // 普通网格线（极淡）
    ctx.strokeStyle = "rgba(255, 255, 255, 0.04)";
    ctx.lineWidth = 1 / cam.zoom;

    // 计算可见区域
    const startX = Math.floor(cam.x / cam.zoom / size) * size;
    const startY = Math.floor(cam.y / cam.zoom / size) * size;
    const endX = startX + (ctx.canvas.width / cam.zoom) + size * 2;
    const endY = startY + (ctx.canvas.height / cam.zoom) + size * 2;

    ctx.beginPath();
    for (let x = startX; x <= endX; x += size) {
      ctx.moveTo(x, Math.max(0, startY));
      ctx.lineTo(x, Math.min(height, endY));
    }
    for (let y = startY; y <= endY; y += size) {
      ctx.moveTo(Math.max(0, startX), y);
      ctx.lineTo(Math.min(width, endX), y);
    }
    ctx.stroke();

    // 世界中心轴（略粗、略明显）
    // X 轴：红色水平线（沿 y=0）
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(width, 0);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 1.5 / cam.zoom;
    ctx.stroke();

    // Y 轴：绿色垂直线（沿 x=0）
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, height);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    ctx.lineWidth = 1.5 / cam.zoom;
    ctx.stroke();

    ctx.restore();
  }

  // ═══════════════════════════════════════════════════════════════
  // 绘制原点标记（世界空间）
  // ═══════════════════════════════════════════════════════════════

  function drawOriginMarker(ctx: CanvasRenderingContext2D, cam: ViewportCamera) {
    // 在世界 (0,0) 绘制一个小十字 + "0" 标签
    const markerSize = 8 / cam.zoom;
    const labelOffset = 10 / cam.zoom;

    ctx.save();

    // 十字
    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 1 / cam.zoom;
    ctx.beginPath();
    ctx.moveTo(-markerSize, 0);
    ctx.lineTo(markerSize, 0);
    ctx.moveTo(0, -markerSize);
    ctx.lineTo(0, markerSize);
    ctx.stroke();

    // 圆环
    ctx.beginPath();
    ctx.arc(0, 0, markerSize / 2, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
    ctx.stroke();

    // 标签 "0"
    ctx.fillStyle = "rgba(255, 255, 255, 0.6)";
    ctx.font = `bold ${10 / cam.zoom}px monospace`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText("0", labelOffset, labelOffset);

    ctx.restore();
  }

  // ═══════════════════════════════════════════════════════════════
  // 绘制轴向指示器（屏幕空间，左下角）
  // ═══════════════════════════════════════════════════════════════

  function drawAxisGizmo(ctx: CanvasRenderingContext2D, size: number) {
    const dpr = window.devicePixelRatio || 1;
    const viewW = ctx.canvas.width / dpr;
    const viewH = ctx.canvas.height / dpr;
    const padding = 16;
    const cx = padding + size / 2;
    const cy = viewH - padding - size / 2;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0); // 屏幕空间

    // X 轴箭头（红色，向右）
    ctx.strokeStyle = "#e06060";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + size * 0.65, cy);
    ctx.stroke();
    // X 箭头头部
    ctx.beginPath();
    ctx.moveTo(cx + size * 0.65, cy - 4);
    ctx.lineTo(cx + size * 0.85, cy);
    ctx.lineTo(cx + size * 0.65, cy + 4);
    ctx.fillStyle = "#e06060";
    ctx.fill();

    // Y 轴箭头（绿色，向上 —— 视觉上的"World Up"）
    ctx.strokeStyle = "#60c060";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx, cy - size * 0.65);
    ctx.stroke();
    // Y 箭头头部
    ctx.beginPath();
    ctx.moveTo(cx - 4, cy - size * 0.65);
    ctx.lineTo(cx, cy - size * 0.85);
    ctx.lineTo(cx + 4, cy - size * 0.65);
    ctx.fillStyle = "#60c060";
    ctx.fill();

    ctx.restore();
  }

  // ═══════════════════════════════════════════════════════════════
  // 绘制 Entity
  // ═══════════════════════════════════════════════════════════════

  function drawEntity(ctx: CanvasRenderingContext2D, entity: SceneEntity, isSelected: boolean, isLastSelected: boolean) {
    const prefab = getPrefab(entity.prefab);
    if (!prefab) return;

    const cam = viewportCamera.value;
    const t = entity.transform;

    // 解析精灵（图片 + 帧矩形）
    const resolved = resolveEntitySprite(entity);
    const displaySize = getEntityDisplaySize(entity, currentScene.value?.grid.size ?? 32);

    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.rotate(t.rotation * Math.PI / 180);
    ctx.scale(t.scaleX, t.scaleY);

    // 关闭图像平滑（像素风）
    ctx.imageSmoothingEnabled = false;

    // 绘制 Sprite（优先真实图片）
    const sprite = prefab.components.Sprite as { visible?: boolean } | undefined;
    if (sprite?.visible !== false) {
      if (resolved.image && resolved.frame) {
        const { x: sx, y: sy, w: sw, h: sh } = resolved.frame;
        const dw = sw;
        const dh = sh;

        if (resolved.rotated) {
          // rotated 90° CW：交换宽高并旋转绘制
          ctx.save();
          ctx.rotate(-Math.PI / 2);
          ctx.drawImage(resolved.image, sx, sy, sw, sh, -dh / 2, -dw / 2, dh, dw);
          ctx.restore();
        } else {
          // 正常绘制：以中心为原点
          ctx.drawImage(resolved.image, sx, sy, sw, sh, -dw / 2, -dh / 2, dw, dh);
        }
      } else {
        // 回退：精灵未加载时绘制网格大小的占位矩形
        const fw = displaySize.w;
        const fh = displaySize.h;
        ctx.fillStyle = getPrefabColor(prefab.tags?.[0] ?? '');
        ctx.fillRect(-fw / 2, -fh / 2, fw, fh);

        // 绘制图标/首字母
        ctx.fillStyle = "#fff";
        ctx.font = `bold ${12 / cam.zoom}px sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText((prefab.name || '?').charAt(0).toUpperCase(), 0, 0);
      }
    }

    // 绘制选中框（恰好贴合精灵尺寸 + 多选视觉层级）
    if (isSelected) {
      // 使用精灵实际绘制的尺寸（与 drawImage 一致）
      const selW = resolved.frame ? resolved.frame.w : displaySize.w;
      const selH = resolved.frame ? resolved.frame.h : displaySize.h;

      if (isLastSelected) {
        // 活动选择项：最亮橙色，2px
        ctx.strokeStyle = "#ffbb5c";
        ctx.lineWidth = 2 / cam.zoom;
        ctx.strokeRect(-selW / 2, -selH / 2, selW, selH);

        // 轴心点
        ctx.fillStyle = "#ffbb5c";
        ctx.beginPath();
        ctx.arc(0, 0, 3 / cam.zoom, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // 非活动选择项：较深橙色，1px
        ctx.strokeStyle = "#c4802a";
        ctx.lineWidth = 1 / cam.zoom;
        ctx.strokeRect(-selW / 2, -selH / 2, selW, selH);

        // 轴心点（更小更淡）
        ctx.fillStyle = "#c4802a";
        ctx.beginPath();
        ctx.arc(0, 0, 2 / cam.zoom, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }

  // 根据分类获取颜色
  function getPrefabColor(tag: string): string {
    const colors: Record<string, string> = {
      environment: "#4a7c59",
      walls: "#8b7355",
      characters: "#d4574a",
      items: "#f4a742",
      system: "#666",
    };
    return colors[tag] || "#4a90d9";
  }

  // ═══════════════════════════════════════════════════════════════
  // 笔刷绘制
  // ═══════════════════════════════════════════════════════════════

  function paintAt(gridX: number, gridY: number, gridSize: number): void {
    if (!currentScene.value) return;
    
    const layer = targetLayer.value;
    const prefabPath = activePrefabPath.value;
    
    if (!prefabPath) return;
    
    // 获取笔刷覆盖的所有格子
    const positions = getBrushGridPositions(gridX, gridY);
    
    for (const pos of positions) {
      const cellKey = `${pos.x},${pos.y}`;
      
      // 防止在同一 stroke 中重复绘制
      if (paintedCells.value.has(cellKey)) continue;
      paintedCells.value.add(cellKey);
      
      // 检查该位置是否已有实体
      const existingEntity = findEntityAtGrid(pos.x, pos.y, layer, gridSize);
      
      // 生成带编号的 name
      const pid = pos.prefabPath.endsWith('.mote-prefab.json')
        ? derivePrefabId(pos.prefabPath)
        : pos.prefabPath;
      const name = getNextEntityName(pid, currentScene.value.entities);

      // 创建新实体（放置到网格中心，与 drawEntity 的中心绘制对齐）
      const newEntity = createSceneEntity(
        pos.prefabPath,
        { x: (pos.x + 0.5) * gridSize, y: (pos.y + 0.5) * gridSize },
        { name }
      );
      
      // 记录到命令
      if (currentBrushCmd.value) {
        currentBrushCmd.value.addRecord(
          pos.x, 
          pos.y, 
          layer, 
          existingEntity ?? null, 
          newEntity
        );
      }
      
      // 实时更新（首次执行优化）
      if (existingEntity) {
        // 替换现有实体
        currentScene.value.entities = currentScene.value.entities.filter(
          e => e.id !== existingEntity.id
        );
      }
      
      // 添加到场景
      currentScene.value.entities.push(newEntity);
    }
    
    bumpVersion();
  }

  function eraseAt(gridX: number, gridY: number, gridSize: number): void {
    if (!currentScene.value) return;
    
    const layer = targetLayer.value;
    const size = brushSize.value;
    const halfSize = Math.floor(size / 2);
    
    for (let dy = -halfSize; dy <= halfSize; dy++) {
      for (let dx = -halfSize; dx <= halfSize; dx++) {
        const x = gridX + dx;
        const y = gridY + dy;
        const cellKey = `${x},${y}`;
        
        if (paintedCells.value.has(cellKey)) continue;
        paintedCells.value.add(cellKey);
        
        const entity = findEntityAtGrid(x, y, layer, gridSize);
        if (entity && currentBrushCmd.value) {
          (currentBrushCmd.value as PaintBrushCommand).addRecord(
            x, y, layer, entity, null
          );
          
          // 实时删除
          currentScene.value.entities = currentScene.value.entities.filter(
            e => e.id !== entity.id
          );
        }
      }
    }
    
    bumpVersion();
  }

  function fillAt(gridX: number, gridY: number, gridSize: number): void {
    const prefabPath = activePrefabPath.value;
    if (!prefabPath) return;
    
    const cmd = new FloodFillCommand(gridX, gridY, prefabPath, targetLayer.value, gridSize);
    
    if (cmd.hasChanges()) {
      executeCommand(cmd);
    }
  }

  function eyedropperAt(gridX: number, gridY: number, gridSize: number): void {
    const layer = targetLayer.value;
    const result = pickPrefab(gridX, gridY, layer, gridSize);
    
    if (result.prefabPath) {
      setSinglePrefabBrush(result.prefabPath);
      targetLayer.value = result.layer;
      // 切换回笔刷工具
      setBrushTool("brush");
    }
  }

  // ═══════════════════════════════════════════════════════════════
  // 事件处理
  // ═══════════════════════════════════════════════════════════════

  const onPointerDown = (e: PointerEvent) => {
    // Spawn Menu 打开时点击空白处关闭
    if (spawnMenuOpen.value) {
      closeSpawnMenu();
      return;
    }

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const worldPos = screenToWorld(e.clientX, e.clientY, rect);
    const scene = currentScene.value;
    
    if (!scene) return;
    
    const gridPos = worldToGrid(worldPos.x, worldPos.y, scene.grid.size);

    // 中键或空格+左键：平移相机
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      isPanning.value = true;
      panStart.value = { x: e.clientX, y: e.clientY };
      panStartCamera.value = { ...viewportCamera.value };
      return;
    }

    // 左键：根据当前模式处理
    if (e.button === 0) {
      if (editMode.value === "brush") {
        const bt = brushTool.value;
        switch (bt) {
          case "brush":
            if (!activePrefabPath.value) return;
            isPainting.value = true;
            paintedCells.value = new Set();
            currentBrushCmd.value = new PaintBrushCommand("绘制");
            paintAt(gridPos.x, gridPos.y, scene.grid.size);
            draw();
            break;

          case "eraser":
            isPainting.value = true;
            paintedCells.value = new Set();
            currentBrushCmd.value = new PaintBrushCommand("擦除");
            eraseAt(gridPos.x, gridPos.y, scene.grid.size);
            draw();
            break;

          case "eyedropper":
            eyedropperAt(gridPos.x, gridPos.y, scene.grid.size);
            draw();
            break;

          case "rect-select":
            if (!e.ctrlKey) clearSelection();
            isRectSelecting.value = true;
            rectSelectStartGrid.value = { x: gridPos.x, y: gridPos.y };
            rectSelectEndGrid.value = { x: gridPos.x, y: gridPos.y };
            draw();
            break;
        }
      } else {
        // entity 模式
        const et = entityTool.value;
        const clickedEntity = findEntityAt(worldPos.x, worldPos.y, 16);

        if (et === "move") {
          // move 工具：无论点击哪里，只要有选中的实体就直接移动
          if (selectedEntityIds.value.size > 0) {
            isMovingEntity.value = true;
            moveStart.value = worldPos;
            moveEntitiesStart.value = new Map(
              Array.from(selectedEntityIds.value).map(id => {
                const entity = getEntity(id);
                const t = entity ? entity.transform : { x: 0, y: 0 };
                return [id, { x: t.x, y: t.y }];
              })
            );
          }
          // 点击空白且无选中：什么都不做
          draw();
        } else {
          // select 工具（Blender 风格）
          // 点击实体 = 选中 + 准备移动
          // 点击空白 = 框选
          if (clickedEntity) {
            if (e.ctrlKey) {
              toggleEntitySelection(clickedEntity.id);
            } else if (!selectedEntityIds.value.has(clickedEntity.id)) {
              // 点击未选中的实体：单选它
              selectEntity(clickedEntity.id);
            } else {
              // 点击已选中的实体：保持多选，只更新活动项
              lastSelectedEntityId.value = clickedEntity.id;
            }

            // 准备移动（所有已选实体）
            isMovingEntity.value = true;
            moveStart.value = worldPos;
            moveEntitiesStart.value = new Map(
              Array.from(selectedEntityIds.value).map(id => {
                const entity = getEntity(id);
                const t = entity ? entity.transform : { x: 0, y: 0 };
                return [id, { x: t.x, y: t.y }];
              })
            );
          } else {
            if (!e.ctrlKey) clearSelection();
            isBoxSelecting.value = true;
            boxSelectStart.value = worldPos;
            boxSelectCurrent.value = worldPos;
          }
          draw();
        }
      }
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    lastMousePosRef.current = { x: e.clientX, y: e.clientY };
    const worldPos = screenToWorld(e.clientX, e.clientY, rect);
    const scene = currentScene.value;
    
    if (!scene) return;
    
    const gridPos = worldToGrid(worldPos.x, worldPos.y, scene.grid.size);
    hoverGridPos.value = gridPos;
    hoverWorldPos.value = worldPos;

    // 平移相机
    if (isPanning.value && panStart.value && panStartCamera.value) {
      const dx = e.clientX - panStart.value.x;
      const dy = e.clientY - panStart.value.y;
      viewportCamera.value = {
        x: panStartCamera.value.x - dx,
        y: panStartCamera.value.y - dy,
        zoom: panStartCamera.value.zoom,
      };
      draw();
      return;
    }

    // 框选
    if (isBoxSelecting.value && boxSelectStart.value) {
      boxSelectCurrent.value = worldPos;
      draw();
      return;
    }

    // rect-select 网格矩形选择
    if (isRectSelecting.value && rectSelectStartGrid.value) {
      rectSelectEndGrid.value = gridPos;
      draw();
      return;
    }

    // 移动 Entity（直接设置 transform，实时吸附）
    if (isMovingEntity.value && moveStart.value) {
      const dx = worldPos.x - moveStart.value.x;
      const dy = worldPos.y - moveStart.value.y;
      const snapSize =
        snapEnabled.value && scene.grid.snap
          ? scene.grid.snapSize ?? scene.grid.size
          : null;

      for (const [id, startPos] of moveEntitiesStart.value) {
        let nx = startPos.x + dx;
        let ny = startPos.y + dy;
        if (snapSize !== null) {
          const s = snapToSize(nx, ny, snapSize);
          nx = s.x;
          ny = s.y;
        }
        const entity = getEntity(id);
        if (entity) {
          entity.transform = { ...entity.transform, x: nx, y: ny };
        }
      }
      draw();
      return;
    }
    
    // 笔刷连续绘制
    if (isPainting.value && editMode.value === "brush" && (brushTool.value === "brush" || brushTool.value === "eraser")) {
      if (brushTool.value === "brush") {
        paintAt(gridPos.x, gridPos.y, scene.grid.size);
      } else {
        eraseAt(gridPos.x, gridPos.y, scene.grid.size);
      }
      draw();
      return;
    }
    
    // 仅更新预览
    draw();
  };

  const onPointerUp = (e: PointerEvent) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();

    // 结束平移
    if (isPanning.value) {
      isPanning.value = false;
      panStart.value = null;
      panStartCamera.value = null;
      return;
    }

    // 结束框选
    if (isBoxSelecting.value && boxSelectStart.value && boxSelectCurrent.value) {
      const x1 = Math.min(boxSelectStart.value.x, boxSelectCurrent.value.x);
      const y1 = Math.min(boxSelectStart.value.y, boxSelectCurrent.value.y);
      const x2 = Math.max(boxSelectStart.value.x, boxSelectCurrent.value.x);
      const y2 = Math.max(boxSelectStart.value.y, boxSelectCurrent.value.y);
      
      selectEntitiesInRect(x1, y1, x2, y2);
      
      isBoxSelecting.value = false;
      boxSelectStart.value = null;
      boxSelectCurrent.value = null;
      draw();
      return;
    }

    // 结束 rect-select 网格矩形选择
    if (isRectSelecting.value && rectSelectStartGrid.value && rectSelectEndGrid.value) {
      const gx1 = Math.min(rectSelectStartGrid.value.x, rectSelectEndGrid.value.x);
      const gy1 = Math.min(rectSelectStartGrid.value.y, rectSelectEndGrid.value.y);
      const gx2 = Math.max(rectSelectStartGrid.value.x, rectSelectEndGrid.value.x);
      const gy2 = Math.max(rectSelectStartGrid.value.y, rectSelectEndGrid.value.y);

      const gridSz = currentScene.value?.grid.size ?? 32;
      const wx1 = gx1 * gridSz;
      const wy1 = gy1 * gridSz;
      const wx2 = (gx2 + 1) * gridSz;
      const wy2 = (gy2 + 1) * gridSz;

      selectEntitiesInRect(wx1, wy1, wx2, wy2);

      isRectSelecting.value = false;
      rectSelectStartGrid.value = null;
      rectSelectEndGrid.value = null;
      draw();
      return;
    }

    // 结束移动 - 提交 MoveEntitiesCommand
    if (isMovingEntity.value && moveStart.value) {
      const moves: MoveRecord[] = [];
      for (const [id, startPos] of moveEntitiesStart.value) {
        const entity = getEntity(id);
        if (entity) {
          moves.push({
            id,
            oldX: startPos.x,
            oldY: startPos.y,
            newX: entity.transform.x,
            newY: entity.transform.y,
          });
        }
      }

      // 只有真正移动了才提交命令
      const hasMoved = moves.some((m) => m.oldX !== m.newX || m.oldY !== m.newY);
      if (hasMoved) {
        executeCommand(new MoveEntitiesCommand(moves));
        draw();
      }

      isMovingEntity.value = false;
      moveStart.value = null;
      moveEntitiesStart.value = new Map();

      return;
    }
    
    // 结束笔刷绘制
    if (isPainting.value) {
      isPainting.value = false;
      
      const cmd = currentBrushCmd.value;
      currentBrushCmd.value = null;
      paintedCells.value = new Set();
      
      if (cmd && cmd.hasChanges()) {
        executeCommand(cmd);
      }
      
      return;
    }
  };

  // 鼠标离开画布：只在绘制过程中结束绘制
  const onPointerLeave = () => {
    if (isPainting.value) {
      onPointerUp({} as PointerEvent);
    }
  };

  // 滚轮缩放
  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    const newZoom = viewportCamera.value.zoom * factor;
    
    setZoomAt(newZoom, mouseX, mouseY);
    draw();
  };

  // 键盘快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // 忽略重复按键（长按自动重复）
      if (e.repeat) return;

      // 忽略输入框中的按键
      if (
        (e.target as HTMLElement).tagName === "INPUT" ||
        (e.target as HTMLElement).tagName === "TEXTAREA"
      ) {
        return;
      }

      // Spawn Menu 打开时，ViewportCanvas 不处理其他快捷键
      if (spawnMenuOpen.value) return;

      // Shift+A: Spawn Menu（Blender 风格快速添加）
      if (e.shiftKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        const container = containerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        let screenX: number;
        let screenY: number;

        if (lastMousePosRef.current) {
          screenX = lastMousePosRef.current.x - rect.left;
          screenY = lastMousePosRef.current.y - rect.top;
        } else {
          screenX = rect.width / 2;
          screenY = rect.height / 2;
        }

        const worldPos = screenToWorld(
          lastMousePosRef.current ? lastMousePosRef.current.x : rect.left + rect.width / 2,
          lastMousePosRef.current ? lastMousePosRef.current.y : rect.top + rect.height / 2,
          rect
        );

        // 边界调整，避免菜单溢出 viewport
        const MENU_W = 280;
        const MENU_H = 360;
        if (screenX + MENU_W > rect.width) screenX = rect.width - MENU_W - 8;
        if (screenY + MENU_H > rect.height) screenY = rect.height - MENU_H - 8;
        if (screenX < 0) screenX = 8;
        if (screenY < 0) screenY = 8;

        openSpawnMenu(screenX, screenY, worldPos.x, worldPos.y);
        return;
      }

      // 视口快捷键：Tab 切换模式，各模式工具快捷键
      if (handleViewportShortcut(e.key)) {
        e.preventDefault();
        draw();
        return;
      }

      // F: 适配场景
      if (e.key === "f" || e.key === "F") {
        e.preventDefault();
        centerCamera();
        draw();
        return;
      }
      
      // 数字键 1-6: 缩放
      if (!e.ctrlKey && !e.metaKey && /^[1-6]$/.test(e.key)) {
        e.preventDefault();
        const zoom = parseInt(e.key);
        setZoomAt(zoom, containerRef.current!.clientWidth / 2, containerRef.current!.clientHeight / 2);
        draw();
        return;
      }
      
      // Home: 适配视图
      if (e.key === "Home") {
        e.preventDefault();
        centerCamera();
        draw();
        return;
      }
      
      // Ctrl+Z: 撤销
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
        draw();
        return;
      }
      
      // Ctrl+Shift+Z 或 Ctrl+Y: 重做
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        redo();
        draw();
        return;
      }
      
      // Shift+D: 复制选中实体（Blender 风格）
      if (e.shiftKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === "d") {
        e.preventDefault();
        const selectedIds = Array.from(selectedEntityIds.value);
        if (selectedIds.length === 0) return;

        const scene = currentScene.value;
        if (!scene) return;

        const entities = selectedIds
          .map(id => scene.entities.find(e => e.id === id))
          .filter((e): e is SceneEntity => !!e);

        if (entities.length === 0) return;

        const cmd = new DuplicateEntitiesCommand(entities);
        executeCommand(cmd);

        // 选中新克隆的实体
        const cloneIds = cmd.getCloneIds();
        selectedEntityIds.value = new Set(cloneIds);
        lastSelectedEntityId.value = cloneIds[cloneIds.length - 1] ?? null;

        // 计算鼠标世界位置（用于将克隆体整体偏移到鼠标附近）
        const container = containerRef.current;
        let mouseWorldPos = { x: 0, y: 0 };
        if (container && lastMousePosRef.current) {
          const rect = container.getBoundingClientRect();
          mouseWorldPos = screenToWorld(
            lastMousePosRef.current.x,
            lastMousePosRef.current.y,
            rect
          );
        }

        // 将克隆体整体偏移到鼠标附近（保持相对位置）
        const firstOld = entities[0].transform;
        let targetX = mouseWorldPos.x;
        let targetY = mouseWorldPos.y;
        // 考虑吸附
        const snapSize =
          snapEnabled.value && scene.grid.snap
            ? scene.grid.snapSize ?? scene.grid.size
            : null;
        if (snapSize !== null) {
          const s = snapToSize(targetX, targetY, snapSize);
          targetX = s.x;
          targetY = s.y;
        }
        const offsetX = targetX - firstOld.x;
        const offsetY = targetY - firstOld.y;

        for (const id of cloneIds) {
          const entity = getEntity(id);
          if (entity) {
            entity.transform = {
              ...entity.transform,
              x: entity.transform.x + offsetX,
              y: entity.transform.y + offsetY,
            };
          }
        }

        // 立即进入移动模式（以鼠标为锚点，克隆体跟随鼠标）
        isMovingEntity.value = true;
        moveStart.value = { x: targetX, y: targetY };
        moveEntitiesStart.value = new Map(
          cloneIds.map(id => {
            const entity = getEntity(id);
            return [id, { x: entity?.transform.x ?? 0, y: entity?.transform.y ?? 0 }];
          })
        );

        draw();
        return;
      }

      // Delete: 删除选中
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        const selectedIds = Array.from(selectedEntityIds.value);
        if (selectedIds.length > 0) {
          // 为每个选中的实体创建删除命令
          for (const id of selectedIds) {
            executeCommand(new RemoveEntityCommand(id));
          }
          clearSelection();
          draw();
        }
        return;
      }
      
      // Ctrl+A: 全选
      if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        // TODO: select all
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // 监听 scene 变化重绘
  useEffect(() => {
    draw();
  }, [sceneVersion.value]);

  // 监听场景变化（grid.size 等编辑器设置）自动重绘
  useSignalEffect(() => {
    const _ = currentScene.value;
    draw();
  });

  // 监听相机变化自动重绘（支持外部 zoom 修改后即时刷新）
  useSignalEffect(() => {
    const _ = viewportCamera.value;
    draw();
  });

  // 监听 SpriteSheet 加载完成自动重绘
  useSignalEffect(() => {
    const _ = spriteSheets.value;
    const __ = spriteSheetImages.value;
    draw();
  });

  // ═══════════════════════════════════════════════════════════════
  // 拖放：从 Content Browser 拖入 Prefab
  // ═══════════════════════════════════════════════════════════════

  const onDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = 'copy';
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    const prefabPath = e.dataTransfer?.getData('application/mote-asset');
    if (!prefabPath || !prefabPath.endsWith('.mote-prefab.json')) return;

    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const worldPos = screenToWorld(e.clientX, e.clientY, rect);

    const prefabId = derivePrefabId(prefabPath);
    spawnPrefab(prefabId, worldPos.x, worldPos.y);
    draw();
  };

  // ═══════════════════════════════════════════════════════════════
  // 渲染
  // ═══════════════════════════════════════════════════════════════

  return (
    <div
      ref={containerRef}
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        cursor: getCursorStyle(),
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onWheel={onWheel}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
        }}
      />

      {spawnMenuOpen.value && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none',
            zIndex: 50,
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: spawnMenuPos.value.x,
              top: spawnMenuPos.value.y,
              pointerEvents: 'auto',
            }}
          >
            <SpawnMenu
              onSelect={(path) => {
                spawnPrefab(path, spawnWorldPos.value.x, spawnWorldPos.value.y);
                closeSpawnMenu();
                draw();
              }}
              onClose={() => {
                closeSpawnMenu();
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
