import { signal } from "@preact/signals";

export type ToolType = "select" | "brush" | "eraser" | "fill" | "eyedropper" | "entity";

export const activeTool = signal<ToolType>("brush");

/** Currently selected tile GIDs forming the brush */
export const brushTiles = signal<number[]>([]);
export const brushWidth = signal(1);
export const brushHeight = signal(1);

/** Which tileset is shown in the palette */
export const activeTilesetId = signal<string | null>(null);

/** Hovered tile coord in the viewport */
export const hoverTile = signal<{ x: number; y: number } | null>(null);

/**
 * Editor display scale for TilePalette.
 * Supports fractional values like 0.25, 0.5, 1, 2, 4, 8.
 * Controls tile display size: displaySize = tileWidth * displayScale.
 */
export const displayScale = signal(1);

/** Whether TilePalette display scale is locked (prevents auto-calculation on import) */
export const displayScaleLocked = signal(false);

/** Current viewport zoom level */
export const viewportZoom = signal(1);

/** Whether viewport zoom is locked (prevents scroll/keyboard zoom) */
export const viewportZoomLocked = signal(false);

/** Whether to show the tile grid in the viewport */
export const showGrid = signal(true);

/** Grid line color */
export const gridColor = signal("rgba(255, 255, 255, 0.08)");

/**
 * Predefined scale steps for TilePalette.
 * Includes fractional (1/4, 1/2) and integer (1-8) values.
 */
export const DISPLAY_SCALE_STEPS = [0.25, 0.5, 1, 2, 3, 4, 5, 6, 7, 8];

/** Format display scale as human-readable string: 0.25->"1/4", 0.5->"1/2", 2->"2" */
export function formatDisplayScale(v: number): string {
  if (v === 0.25) return "1/4";
  if (v === 0.5) return "1/2";
  return String(v);
}

/** Parse user input string to display scale number. Supports "1/4", "0.25", "2", etc. */
export function parseDisplayScale(raw: string): number | null {
  const s = raw.trim();
  const fracMatch = s.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fracMatch) {
    const num = parseInt(fracMatch[1]);
    const den = parseInt(fracMatch[2]);
    if (den === 0) return null;
    const val = num / den;
    if (val >= 0.25 && val <= 8) return val;
    return null;
  }
  const val = parseFloat(s);
  if (isNaN(val) || val < 0.25 || val > 8) return null;
  return val;
}

// ═══════════════════════════════════════════════════════════════
// 工具切换
// ═══════════════════════════════════════════════════════════════

/** 工具定义 */
export const TOOLS: { id: ToolType; label: string; icon: string; shortcut: string }[] = [
  { id: "select", label: "选择", icon: "↖", shortcut: "V" },
  { id: "brush", label: "笔刷", icon: "✏️", shortcut: "B" },
  { id: "eraser", label: "橡皮", icon: "🧹", shortcut: "E" },
  { id: "fill", label: "填充", icon: "🪣", shortcut: "G" },
  { id: "eyedropper", label: "吸管", icon: "💉", shortcut: "I" },
  { id: "entity", label: "实体", icon: "◇", shortcut: "N" },
];

/** 设置当前工具 */
export function setTool(tool: ToolType): void {
  activeTool.value = tool;
}

/** 通过快捷键切换工具 */
export function setToolByShortcut(key: string): boolean {
  const tool = TOOLS.find(t => t.shortcut.toLowerCase() === key.toLowerCase());
  if (tool) {
    activeTool.value = tool.id;
    return true;
  }
  return false;
}

