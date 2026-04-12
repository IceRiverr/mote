// ═══════════════════════════════════════════════════════════════
// ViewportCanvas.tsx - 新的 Entity-based Viewport 渲染
// ═══════════════════════════════════════════════════════════════

import { useRef, useEffect, useCallback } from "preact/hooks";
import { signal } from "@preact/signals";
import {
  currentScene,
  sceneVersion,
  selectedEntityIds,
  selectEntity,
  selectEntitiesInRect,
  clearSelection,
  moveEntity,
  gridSettings,
  snapEnabled,
  findEntityAt,
} from "../../store/scene";
import { prefabs, getPrefab } from "../../store/prefabs";
import type { SceneEntity } from "../../data/Scene";

// ═══════════════════════════════════════════════════════════════
// 相机状态
// ═══════════════════════════════════════════════════════════════

interface Camera {
  x: number;
  y: number;
  zoom: number;
}

const camera = signal<Camera>({ x: 0, y: 0, zoom: 1 });
const needsCenter = signal(true);

// ═══════════════════════════════════════════════════════════════
// 拖拽状态
// ═══════════════════════════════════════════════════════════════

/** 是否正在平移相机 */
const isPanning = signal(false);
const panStart = signal<{ x: number; y: number } | null>(null);
const panStartCamera = signal<Camera | null>(null);

/** 是否正在框选 */
const isBoxSelecting = signal(false);
const boxSelectStart = signal<{ x: number; y: number } | null>(null);
const boxSelectCurrent = signal<{ x: number; y: number } | null>(null);

/** 是否正在移动 Entity */
const isMovingEntity = signal(false);
const moveStart = signal<{ x: number; y: number } | null>(null);
const moveEntitiesStart = signal<Map<string, { x: number; y: number }>>(new Map());

// ═══════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════

/** 设置缩放，保持指定屏幕点对应的世界坐标不变 */
function setZoomAt(newZoom: number, screenX: number, screenY: number) {
  const cam = camera.value;
  const worldX = (screenX + cam.x) / cam.zoom;
  const worldY = (screenY + cam.y) / cam.zoom;
  camera.value = {
    x: worldX * newZoom - screenX,
    y: worldY * newZoom - screenY,
    zoom: Math.max(0.1, Math.min(5, newZoom)),
  };
}

/** 屏幕坐标 → 世界坐标 */
function screenToWorld(screenX: number, screenY: number, rect: DOMRect): { x: number; y: number } {
  const cam = camera.value;
  const x = screenX - rect.left + cam.x;
  const y = screenY - rect.top + cam.y;
  return {
    x: x / cam.zoom,
    y: y / cam.zoom,
  };
}

/** 世界坐标 → 屏幕坐标 */
function worldToScreen(worldX: number, worldY: number): { x: number; y: number } {
  const cam = camera.value;
  return {
    x: worldX * cam.zoom - cam.x,
    y: worldY * cam.zoom - cam.y,
  };
}

// ═══════════════════════════════════════════════════════════════
// 主组件
// ═══════════════════════════════════════════════════════════════

export function ViewportCanvas() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // ═══════════════════════════════════════════════════════════════
  // 初始化
  // ═══════════════════════════════════════════════════════════════

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
      if (needsCenter.value) {
        centerCamera();
        needsCenter.value = false;
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

    const cam = camera.value;
    const vw = container.clientWidth;
    const vh = container.clientHeight;

    camera.value = {
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

    const cam = camera.value;

    // 应用相机变换
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    ctx.scale(cam.zoom, cam.zoom);

    // 绘制网格
    drawGrid(ctx, scene.width, scene.height, scene.grid.size);

    // 绘制场景边界
    ctx.strokeStyle = "#4a90d9";
    ctx.lineWidth = 2 / cam.zoom;
    ctx.strokeRect(0, 0, scene.width, scene.height);

    // 绘制所有 Entity
    for (const entity of scene.entities) {
      drawEntity(ctx, entity, selectedEntityIds.value.has(entity.id));
    }

    // 绘制框选框
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

    ctx.restore();
  }, []);

  // ═══════════════════════════════════════════════════════════════
  // 绘制网格
  // ═══════════════════════════════════════════════════════════════

  function drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number, size: number) {
    if (!gridSettings.value.enabled) return;

    const cam = camera.value;
    ctx.strokeStyle = gridSettings.value.color || "rgba(255, 255, 255, 0.1)";
    ctx.lineWidth = 1 / cam.zoom;

    // 计算可见区域
    const startX = Math.floor(cam.x / cam.zoom / size) * size;
    const startY = Math.floor(cam.y / cam.zoom / size) * size;
    const endX = startX + (ctx.canvas.width / cam.zoom) + size * 2;
    const endY = startY + (ctx.canvas.height / cam.zoom) + size * 2;

    ctx.beginPath();
    
    // 垂直线
    for (let x = startX; x <= Math.min(endX, width); x += size) {
      ctx.moveTo(x, Math.max(0, startY));
      ctx.lineTo(x, Math.min(height, endY));
    }
    
    // 水平线
    for (let y = startY; y <= Math.min(endY, height); y += size) {
      ctx.moveTo(Math.max(0, startX), y);
      ctx.lineTo(Math.min(width, endX), y);
    }
    
    ctx.stroke();
  }

  // ═══════════════════════════════════════════════════════════════
  // 绘制 Entity
  // ═══════════════════════════════════════════════════════════════

  function drawEntity(ctx: CanvasRenderingContext2D, entity: SceneEntity, isSelected: boolean) {
    const prefab = getPrefab(entity.prefab);
    if (!prefab) return;

    const cam = camera.value;
    
    ctx.save();
    
    // 应用 Entity 变换
    ctx.translate(entity.x, entity.y);
    ctx.rotate((entity.rotation || 0) * Math.PI / 180);
    ctx.scale(entity.scaleX || 1, entity.scaleY || 1);

    // 绘制 Sprite（如果有）
    const sprite = prefab.components.Sprite;
    if (sprite?.visible !== false) {
      // TODO: 实际从 Atlas 加载图像并绘制
      // 现在先用色块代替
      ctx.fillStyle = getPrefabColor(prefab.category);
      ctx.fillRect(-8, -8, 16, 16);
      
      // 绘制图标/首字母
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${12 / cam.zoom}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(prefab.name.charAt(0).toUpperCase(), 0, 0);
    }

    // 绘制选中框
    if (isSelected) {
      ctx.strokeStyle = "#4a90d9";
      ctx.lineWidth = 2 / cam.zoom;
      ctx.strokeRect(-10, -10, 20, 20);
      
      // 绘制中心点
      ctx.fillStyle = "#4a90d9";
      ctx.beginPath();
      ctx.arc(0, 0, 3 / cam.zoom, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  }

  // 根据分类获取颜色
  function getPrefabColor(category: string): string {
    const colors: Record<string, string> = {
      environment: "#4a7c59",
      walls: "#8b7355",
      characters: "#d4574a",
      items: "#f4a742",
      system: "#666",
    };
    return colors[category] || "#4a90d9";
  }

  // ═══════════════════════════════════════════════════════════════
  // 事件处理
  // ═══════════════════════════════════════════════════════════════

  const onPointerDown = (e: PointerEvent) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const worldPos = screenToWorld(e.clientX, e.clientY, rect);

    // 中键或空格+左键：平移相机
    if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
      isPanning.value = true;
      panStart.value = { x: e.clientX, y: e.clientY };
      panStartCamera.value = { ...camera.value };
      return;
    }

    // 左键：选择或移动
    if (e.button === 0) {
      // 查找点击的 Entity
      const clickedEntity = findEntityAt(worldPos.x, worldPos.y, 16);

      if (clickedEntity) {
        // 选中 Entity
        if (!e.ctrlKey) {
          selectEntity(clickedEntity.id);
        } else {
          // Ctrl+点击：切换选中
          // TODO: toggle selection
        }

        // 开始移动
        isMovingEntity.value = true;
        moveStart.value = worldPos;
        moveEntitiesStart.value = new Map(
          selectedEntityIds.value.size > 0
            ? Array.from(selectedEntityIds.value).map(id => {
                const entity = currentScene.value?.entities.find(e => e.id === id);
                return [id, entity ? { x: entity.x, y: entity.y } : { x: 0, y: 0 }];
              })
            : [[clickedEntity.id, { x: clickedEntity.x, y: clickedEntity.y }]]
        );
      } else {
        // 点击空白处：开始框选
        if (!e.ctrlKey) {
          clearSelection();
        }
        isBoxSelecting.value = true;
        boxSelectStart.value = worldPos;
        boxSelectCurrent.value = worldPos;
      }
    }
  };

  const onPointerMove = (e: PointerEvent) => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const worldPos = screenToWorld(e.clientX, e.clientY, rect);

    // 平移相机
    if (isPanning.value && panStart.value && panStartCamera.value) {
      const dx = e.clientX - panStart.value.x;
      const dy = e.clientY - panStart.value.y;
      camera.value = {
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

    // 移动 Entity
    if (isMovingEntity.value && moveStart.value) {
      const dx = worldPos.x - moveStart.value.x;
      const dy = worldPos.y - moveStart.value.y;

      for (const [id, startPos] of moveEntitiesStart.value) {
        moveEntity(id, startPos.x + dx, startPos.y + dy);
      }
      draw();
    }
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

    // 结束移动
    if (isMovingEntity.value) {
      isMovingEntity.value = false;
      moveStart.value = null;
      moveEntitiesStart.value = new Map();
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
    const newZoom = camera.value.zoom * factor;
    
    setZoomAt(newZoom, mouseX, mouseY);
    draw();
  };

  // 键盘快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // F: 适配场景
      if (e.key === "f" || e.key === "F") {
        centerCamera();
        draw();
      }
      
      // Delete: 删除选中
      if (e.key === "Delete" || e.key === "Backspace") {
        // TODO: delete selected entities
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
        cursor: isPanning.value ? "grabbing" : "default",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      onWheel={onWheel}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: "block",
        }}
      />
    </div>
  );
}
