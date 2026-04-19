// ═══════════════════════════════════════════════════════════════
// ViewportFooter.tsx — Updated for new architecture
// ═══════════════════════════════════════════════════════════════

import {
  hoverTile,
  viewportZoomLocked,
  showGrid,
} from "../../store/selection";
import { selectedEntityIds, currentScene } from "../../store/scene";
import { canUndo, canRedo, undoLabel, redoLabel, undo, redo } from "../../store/history";
import { editModeLabel, activeToolLabel } from "../../store/viewport-mode";
import { hoverWorldPos } from "../../store/viewport";

export function ViewportFooter() {
  const worldPos = hoverWorldPos.value;
  const tile = hoverTile.value;
  const locked = viewportZoomLocked.value;
  const gridOn = showGrid.value;
  const selectedCount = selectedEntityIds.value.size;
  const scene = currentScene.value;
  const entityCount = scene?.entities.length ?? 0;

  return (
    <div
      style={{
        height: 22,
        background: "var(--bg-header)",
        borderTop: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        padding: "0 8px",
        fontSize: 10,
        color: "var(--text-secondary)",
        gap: 12,
        flexShrink: 0,
      }}
    >
      {/* Position display */}
      <span>
        {worldPos
          ? `(${worldPos.x.toFixed(1)}, ${worldPos.y.toFixed(1)})`
          : "—"}
        {tile ? ` [${tile.x},${tile.y}]` : ""}
      </span>
      
      {/* Entity count */}
      <span>
        Entities: {entityCount}
        {selectedCount > 0 && ` (${selectedCount} selected)`}
      </span>

      {/* Undo / Redo buttons */}
      <div style={{ display: "flex", gap: 2, marginLeft: 4 }}>
        <button
          onClick={() => undo()}
          disabled={!canUndo.value}
          title={canUndo.value ? `撤销: ${undoLabel.value}` : "无可撤销操作"}
          style={{
            fontSize: 10,
            padding: "0 4px",
            height: 16,
            border: "1px solid var(--border)",
            borderRadius: 2,
            background: "transparent",
            color: canUndo.value ? "var(--text)" : "var(--text-secondary)",
            cursor: canUndo.value ? "pointer" : "default",
            opacity: canUndo.value ? 1 : 0.4,
          }}
        >
          ↶
        </button>
        <button
          onClick={() => redo()}
          disabled={!canRedo.value}
          title={canRedo.value ? `重做: ${redoLabel.value}` : "无可重做操作"}
          style={{
            fontSize: 10,
            padding: "0 4px",
            height: 16,
            border: "1px solid var(--border)",
            borderRadius: 2,
            background: "transparent",
            color: canRedo.value ? "var(--text)" : "var(--text-secondary)",
            cursor: canRedo.value ? "pointer" : "default",
            opacity: canRedo.value ? 1 : 0.4,
          }}
        >
          ↷
        </button>
      </div>

      {/* Mode + Tool display */}
      <span style={{ fontWeight: 600, color: "var(--text)" }}>
        {editModeLabel.value}
      </span>
      <span>·</span>
      <span>{activeToolLabel.value}</span>

      {/* Grid toggle */}
      <button
        onClick={() => { showGrid.value = !showGrid.value; }}
        title={gridOn ? "Hide grid" : "Show grid"}
        style={{
          fontSize: 10,
          padding: "0 5px",
          height: 16,
          border: "1px solid var(--border)",
          borderRadius: 2,
          background: gridOn ? "rgba(74, 144, 217, 0.25)" : "transparent",
          color: gridOn ? "var(--text)" : "var(--text-secondary)",
          cursor: "pointer",
          opacity: gridOn ? 1 : 0.5,
          display: "flex",
          alignItems: "center",
          gap: 3,
        }}
      >
        <span style={{ fontFamily: "monospace", fontWeight: "bold" }}>#</span>
        <span>{gridOn ? "Grid: On" : "Grid: Off"}</span>
      </button>

      <div style={{ flex: 1 }} />
      <span style={{ opacity: 0.6 }}>
        {locked ? "缩放已锁定" : "Ctrl+Z 撤销 · Ctrl+Shift+Z 重做"}
      </span>
    </div>
  );
}
