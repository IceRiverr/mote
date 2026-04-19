// ═══════════════════════════════════════════════════════════════
// viewport-mode.ts — 视口编辑模式与工具状态
// ═══════════════════════════════════════════════════════════════

import { signal, computed } from "@preact/signals";

// ── 编辑模式 ─────────────────────────────────────────────────

export type EditMode = "entity" | "brush";

export const editMode = signal<EditMode>("entity");

/** 实体模式工具 */
export type EntityTool = "select" | "move";

/** 笔刷模式工具 */
export type BrushTool = "brush" | "eraser" | "eyedropper" | "rect-select";

// ── 各模式下的工具 signal ────────────────────────────────────

export const entityTool = signal<EntityTool>("select");
export const brushTool = signal<BrushTool>("brush");

// ── 工具定义 ─────────────────────────────────────────────────

export const ENTITY_TOOLS: Array<{
  id: EntityTool;
  label: string;
  icon: string;
  shortcut: string;
}> = [
  { id: "select", label: "选择", icon: "↖", shortcut: "V" },
  { id: "move", label: "移动", icon: "✋", shortcut: "G" },
];

export const BRUSH_TOOLS: Array<{
  id: BrushTool;
  label: string;
  icon: string;
  shortcut: string;
}> = [
  { id: "brush", label: "笔刷", icon: "✏️", shortcut: "B" },
  { id: "eraser", label: "橡皮", icon: "🧹", shortcut: "E" },
  { id: "eyedropper", label: "吸管", icon: "💉", shortcut: "I" },
  { id: "rect-select", label: "框选", icon: "▭", shortcut: "M" },
];

// ── 计算属性 ─────────────────────────────────────────────────

/** 当前活动工具 ID（用于显示） */
export const activeToolId = computed(() =>
  editMode.value === "entity" ? entityTool.value : brushTool.value
);

/** 当前活动工具标签 */
export const activeToolLabel = computed(() => {
  if (editMode.value === "entity") {
    return ENTITY_TOOLS.find((t) => t.id === entityTool.value)?.label ?? "";
  }
  return BRUSH_TOOLS.find((t) => t.id === brushTool.value)?.label ?? "";
});

/** 当前模式标签 */
export const editModeLabel = computed(() =>
  editMode.value === "entity" ? "实体" : "笔刷"
);



// ── 瞬态状态清除回调注册 ─────────────────────────────────────

const transientClearCallbacks: Array<() => void> = [];

/** 注册模式切换时的瞬态状态清除回调（由 ViewportCanvas 调用） */
export function onEditModeChange(cb: () => void): () => void {
  transientClearCallbacks.push(cb);
  return () => {
    const i = transientClearCallbacks.indexOf(cb);
    if (i >= 0) transientClearCallbacks.splice(i, 1);
  };
}

function clearTransientState() {
  for (const cb of transientClearCallbacks) {
    try {
      cb();
    } catch {
      // ignore
    }
  }
}

// ── 模式切换 ─────────────────────────────────────────────────

export function setEditMode(mode: EditMode): void {
  if (editMode.value === mode) return;
  clearTransientState();
  editMode.value = mode;
}

export function toggleEditMode(): void {
  setEditMode(editMode.value === "entity" ? "brush" : "entity");
}

export function setEntityTool(tool: EntityTool): void {
  entityTool.value = tool;
}

export function setBrushTool(tool: BrushTool): void {
  brushTool.value = tool;
}

// ── 快捷键分发 ───────────────────────────────────────────────

export function handleViewportShortcut(key: string): boolean {
  const mode = editMode.value;

  if (key === "Tab") {
    toggleEditMode();
    return true;
  }

  if (mode === "entity") {
    const tool = ENTITY_TOOLS.find(
      (t) => t.shortcut.toLowerCase() === key.toLowerCase()
    );
    if (tool) {
      setEntityTool(tool.id);
      return true;
    }
  }

  if (mode === "brush") {
    const tool = BRUSH_TOOLS.find(
      (t) => t.shortcut.toLowerCase() === key.toLowerCase()
    );
    if (tool) {
      setBrushTool(tool.id);
      return true;
    }
  }

  return false;
}
