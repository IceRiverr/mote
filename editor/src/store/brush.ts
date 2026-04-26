// ═══════════════════════════════════════════════════════════════
// brush.ts - 笔刷状态管理
// 
// 设计原则：prefabPath 是相对于 assetsDir 的 .mote-prefab.json 文件路径
// ═══════════════════════════════════════════════════════════════

import { signal, computed } from "@preact/signals";
import type { Prefab } from "../data/Prefab";

// ═══════════════════════════════════════════════════════════════
// 笔刷状态
// ═══════════════════════════════════════════════════════════════

/** 笔刷单元格定义 */
export interface BrushCell {
  /** Prefab 文件路径（相对于 assets/） */
  prefabPath: string;
  /** X 偏移（以网格为单位） */
  offsetX: number;
  /** Y 偏移（以网格为单位） */
  offsetY: number;
}

/** 笔刷模式 */
export type BrushMode = "paint" | "erase" | "fill" | "eyedropper";

/** 当前笔刷模式 */
export const brushMode = signal<BrushMode>("paint");

/** 笔刷图案（多 tile 支持） */
export const brushPattern = signal<BrushCell[]>([
  { prefabPath: "", offsetX: 0, offsetY: 0 },
]);

/** 笔刷尺寸（1 = 1x1, 2 = 2x2, 3 = 3x3） */
export const brushSize = signal(1);

/** 当前选中的 Prefab 路径（单格笔刷用） */
export const activePrefabPath = signal<string | null>(null);

/** 当前目标层 */
export const targetLayer = signal<number>(0);

/** 是否启用连续绘制 */
export const continuousPainting = signal(true);

/** 笔刷预览透明度 */
export const brushPreviewAlpha = signal(0.5);

// ═══════════════════════════════════════════════════════════════
// 计算属性
// ═══════════════════════════════════════════════════════════════

/** 笔刷宽度（格数） */
export const brushWidth = computed(() => {
  const pattern = brushPattern.value;
  if (pattern.length === 0) return 1;
  const maxX = Math.max(...pattern.map(c => c.offsetX));
  const minX = Math.min(...pattern.map(c => c.offsetX));
  return maxX - minX + 1;
});

/** 笔刷高度（格数） */
export const brushHeight = computed(() => {
  const pattern = brushPattern.value;
  if (pattern.length === 0) return 1;
  const maxY = Math.max(...pattern.map(c => c.offsetY));
  const minY = Math.min(...pattern.map(c => c.offsetY));
  return maxY - minY + 1;
});

/** 笔刷是否有效 */
export const isBrushValid = computed(() => {
  return brushPattern.value.length > 0 && 
         brushPattern.value.some(c => c.prefabPath !== "");
});

// ═══════════════════════════════════════════════════════════════
// 笔刷操作
// ═══════════════════════════════════════════════════════════════

/**
 * 设置单格笔刷（最简单的笔刷）
 */
export function setSinglePrefabBrush(prefabPath: string): void {
  activePrefabPath.value = prefabPath;
  brushPattern.value = [
    { prefabPath, offsetX: 0, offsetY: 0 },
  ];
  brushSize.value = 1;
}

/**
 * 创建矩形笔刷
 */
export function setRectBrush(prefabPath: string, width: number, height: number): void {
  activePrefabPath.value = prefabPath;
  const pattern: BrushCell[] = [];
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      pattern.push({ prefabPath, offsetX: x, offsetY: y });
    }
  }
  
  brushPattern.value = pattern;
  brushSize.value = Math.max(width, height);
}

/**
 * 创建圆形笔刷
 */
export function setCircleBrush(prefabPath: string, radius: number): void {
  activePrefabPath.value = prefabPath;
  const pattern: BrushCell[] = [];
  const r2 = radius * radius;
  
  for (let y = -radius; y <= radius; y++) {
    for (let x = -radius; x <= radius; x++) {
      if (x * x + y * y <= r2) {
        pattern.push({ prefabPath, offsetX: x, offsetY: y });
      }
    }
  }
  
  brushPattern.value = pattern;
  brushSize.value = radius * 2 + 1;
}

/**
 * 从图案创建笔刷（用于复杂形状）
 */
export function setPatternBrush(cells: BrushCell[]): void {
  brushPattern.value = cells;
  
  // 计算尺寸
  if (cells.length > 0) {
    const maxX = Math.max(...cells.map(c => c.offsetX));
    const minX = Math.min(...cells.map(c => c.offsetX));
    const maxY = Math.max(...cells.map(c => c.offsetY));
    const minY = Math.min(...cells.map(c => c.offsetY));
    brushSize.value = Math.max(maxX - minX, maxY - minY) + 1;
  }
}

/**
 * 旋转笔刷 90 度
 */
export function rotateBrush(): void {
  brushPattern.value = brushPattern.value.map(cell => ({
    ...cell,
    offsetX: -cell.offsetY,
    offsetY: cell.offsetX,
  }));
}

/**
 * 水平翻转笔刷
 */
export function flipBrushHorizontal(): void {
  brushPattern.value = brushPattern.value.map(cell => ({
    ...cell,
    offsetX: -cell.offsetX,
  }));
}

/**
 * 垂直翻转笔刷
 */
export function flipBrushVertical(): void {
  brushPattern.value = brushPattern.value.map(cell => ({
    ...cell,
    offsetY: -cell.offsetY,
  }));
}

/**
 * 清除笔刷
 */
export function clearBrush(): void {
  brushPattern.value = [];
  activePrefabPath.value = null;
}

/**
 * 设置笔刷模式
 */
export function setBrushMode(mode: BrushMode): void {
  brushMode.value = mode;
}

/**
 * 设置目标层
 */
export function setTargetLayer(layer: number): void {
  targetLayer.value = layer;
}

// ═══════════════════════════════════════════════════════════════
// 笔刷预览
// ═══════════════════════════════════════════════════════════════

/**
 * 获取笔刷在世界坐标下的预览位置
 */
export function getBrushPreviewPositions(
  worldX: number, 
  worldY: number, 
  gridSize: number
): Array<{ x: number; y: number; prefabPath: string }> {
  const baseX = Math.floor(worldX / gridSize) * gridSize;
  const baseY = Math.floor(worldY / gridSize) * gridSize;
  
  return brushPattern.value.map(cell => ({
    x: baseX + cell.offsetX * gridSize,
    y: baseY + cell.offsetY * gridSize,
    prefabPath: cell.prefabPath,
  }));
}

/**
 * 获取笔刷影响的网格坐标
 */
export function getBrushGridPositions(
  gridX: number, 
  gridY: number
): Array<{ x: number; y: number; prefabPath: string }> {
  return brushPattern.value.map(cell => ({
    x: gridX + cell.offsetX,
    y: gridY + cell.offsetY,
    prefabPath: cell.prefabPath,
  }));
}

// ═══════════════════════════════════════════════════════════════
// 预定义笔刷
// ═══════════════════════════════════════════════════════════════

/** 常用笔刷尺寸 */
export const BRUSH_SIZES = [1, 2, 3, 4, 5, 8, 10];

/** 预定义层 */
export const LAYERS = [
  { id: -100, name: "parallax", label: "远景", color: "#4a7c59" },
  { id: 0, name: "background", label: "背景", color: "#8b7355" },
  { id: 10, name: "decoration", label: "装饰", color: "#f4a742" },
  { id: 20, name: "collision", label: "碰撞体", color: "#d4574a" },
  { id: 30, name: "object", label: "物件", color: "#4a90d9" },
  { id: 40, name: "character", label: "角色", color: "#9b59b6" },
  { id: 50, name: "foreground", label: "前景", color: "#2ecc71" },
  { id: 100, name: "ui", label: "UI", color: "#666666" },
];

/** 获取层信息 */
export function getLayerById(id: number) {
  return LAYERS.find(l => l.id === id) ?? LAYERS[1];
}

/** 获取层名称 */
export function getLayerLabel(id: number): string {
  return getLayerById(id).label;
}
