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
  getEntity,
  bumpVersion,
  spawnPrefab,
} from "../../store/scene";
import { prefabs, getPrefab } from "../../store/prefabs";
import { openSpawnMenu, closeSpawnMenu, spawnMenuOpen, spawnMenuPos, spawnWorldPos } from "../../store/spawnMenu";
import { SpawnMenu } from "../../components/SpawnMenu";
import { layerVisibility, isLayerVisible } from "../../editors/inspector/panels/LayerPanel";
import { activeTool, setToolByShortcut } from "../../store/selection";
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
import { createSceneEntity, getNextEntityName } from "../../data/Scene";
import { derivePrefabId } from "../../data/Prefab";

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

  const targetX = gridX * gridSize;
  const targetY = gridY * gridSize;

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
} from "../../commands";
import {
  PaintBrushCommand,
  EraseCommand,
  FloodFillCommand,
  pickPrefab,
} from "../../commands/brush-tool-commands";

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

/** 世界坐标 → 网格坐标 */
function worldToGrid(worldX: number, worldY: number, gridSize: number): { x: number; y: number } {
  return {
    x: Math.floor(worldX / gridSize),
    y: Math.floor(worldY / gridSize),
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

/** 获取当前工具的光标样式 */
function getCursorStyle(): string {
  if (isPanning.value) return "grabbing";
  
  switch (activeTool.value) {
    case "select": return "default";
    case "brush": return "crosshair";
    case "eraser": return "cell";
    case "fill": return "pointer";
    case "eyedropper": return "copy";
    case "entity": return "copy";
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
  
  const moveCommandRef = useRef<MoveEntitiesCommand | null>(null);
  
  /** 记录最后一次鼠标位置（屏幕坐标），用于 Shift+A 菜单位置 */
  const lastMousePosRef = useRef<{ x: number; y: number } | null>(null);

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
    const gridSize = scene.grid.size;

    // 应用相机变换
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    ctx.scale(cam.zoom, cam.zoom);

    // 绘制网格
    drawGrid(ctx, scene.width, scene.height, gridSize);

    // 绘制场景边界
    ctx.strokeStyle = "#4a90d9";
    ctx.lineWidth = 2 / cam.zoom;
    ctx.strokeRect(0, 0, scene.width, scene.height);

    // 绘制所有 Entity（按层排序，过滤不可见层）
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
      drawEntity(ctx, entity, selectedEntityIds.value.has(entity.id));
    }

    // 绘制笔刷预览
    if (hoverGridPos.value && (activeTool.value === "brush" || activeTool.value === "eraser")) {
      drawBrushPreview(ctx, hoverGridPos.value.x, hoverGridPos.value.y, gridSize);
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
  // 绘制笔刷预览
  // ═══════════════════════════════════════════════════════════════

  function drawBrushPreview(ctx: CanvasRenderingContext2D, gridX: number, gridY: number, gridSize: number) {
    const cam = camera.value;
    
    if (activeTool.value === "brush" && activePrefabPath.value) {
      // 绘制笔刷图案预览
      const positions = getBrushGridPositions(gridX, gridY);
      
      ctx.save();
      ctx.globalAlpha = 0.5;
      
      for (const pos of positions) {
        const worldX = pos.x * gridSize;
        const worldY = pos.y * gridSize;
        
        // 绘制半透明白色边框
        ctx.strokeStyle = "#4a90d9";
        ctx.lineWidth = 2 / cam.zoom;
        ctx.strokeRect(worldX, worldY, gridSize, gridSize);
        
        // 填充浅色
        ctx.fillStyle = "rgba(74, 144, 217, 0.2)";
        ctx.fillRect(worldX, worldY, gridSize, gridSize);
      }
      
      ctx.restore();
    } else if (activeTool.value === "eraser") {
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
    }
  }

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
    
    const t = entity.transform;
    
    // 应用 Entity 变换
    ctx.translate(t.x, t.y);
    ctx.rotate(t.rotation * Math.PI / 180);
    ctx.scale(t.scaleX, t.scaleY);

    // 绘制 Sprite（如果有）
    const sprite = prefab.components.Sprite;
    if (sprite?.visible !== false) {
      // TODO: 实际从 Atlas 加载图像并绘制
      // 现在先用色块代替
      ctx.fillStyle = getPrefabColor(prefab.tags?.[0] ?? '');
      ctx.fillRect(-8, -8, 16, 16);
      
      // 绘制图标/首字母
      ctx.fillStyle = "#fff";
      ctx.font = `bold ${12 / cam.zoom}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText((prefab.name || '?').charAt(0).toUpperCase(), 0, 0);
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

      // 创建新实体（和 Command 中保持一致）
      const newEntity = createSceneEntity(
        pos.prefabPath,
        { x: pos.x * gridSize, y: pos.y * gridSize },
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
      activeTool.value = "brush";
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
      panStartCamera.value = { ...camera.value };
      return;
    }

    // 左键：根据当前工具处理
    if (e.button === 0) {
      const tool = activeTool.value;
      
      switch (tool) {
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
          
        case "fill":
          fillAt(gridPos.x, gridPos.y, scene.grid.size);
          draw();
          break;
          
        case "eyedropper":
          eyedropperAt(gridPos.x, gridPos.y, scene.grid.size);
          draw();
          break;
          
        case "select":
        default:
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
                    const entity = getEntity(id);
                    const t = entity ? entity.transform : { x: 0, y: 0 };
                    return [id, { x: t.x, y: t.y }];
                  })
                : (() => {
                    return [[clickedEntity.id, { x: clickedEntity.transform.x, y: clickedEntity.transform.y }]];
                  })()
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
          break;
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
      return;
    }
    
    // 笔刷连续绘制
    if (isPainting.value && (activeTool.value === "brush" || activeTool.value === "eraser")) {
      if (activeTool.value === "brush") {
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

    // 结束移动 - 提交 MoveEntitiesCommand
    if (isMovingEntity.value && moveStart.value) {
      const worldPos = screenToWorld(e.clientX, e.clientY, rect);
      const dx = worldPos.x - moveStart.value.x;
      const dy = worldPos.y - moveStart.value.y;
      
      // 只有真正移动了才提交命令
      if (dx !== 0 || dy !== 0) {
        const entityIds = Array.from(moveEntitiesStart.value.keys());
        
        // 先恢复原位（因为实时预览已经 mutate 了数据）
        for (const [id, startPos] of moveEntitiesStart.value) {
          const entity = getEntity(id);
          if (entity) {
            entity.transform = { ...entity.transform, x: startPos.x, y: startPos.y };
          }
        }
        
        // 提交 Command（会再次执行到目标位置）
        executeCommand(new MoveEntitiesCommand(entityIds, dx, dy));
        draw();
      }
      
      isMovingEntity.value = false;
      moveStart.value = null;
      moveEntitiesStart.value = new Map();
      moveCommandRef.current = null;
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
    const newZoom = camera.value.zoom * factor;
    
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

      // 工具快捷键 (V, B, E, G, I, N)
      if (setToolByShortcut(e.key)) {
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
