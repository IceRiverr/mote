import {
  hoverTile,
  viewportZoomLocked,
} from "../../store/selection";
import { activeLayer } from "../../store/project";
import { canUndo, canRedo, undoLabel, redoLabel, undo, redo } from "../../store/history";

export function ViewportFooter() {
  const tile = hoverTile.value;
  const layer = activeLayer.value;
  const locked = viewportZoomLocked.value;

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
      <span>{tile ? `瓦片 (${tile.x}, ${tile.y})` : "—"}</span>
      {layer && (
        <span>
          图层: {layer.name}
          {layer.locked ? " 🔒" : ""}
        </span>
      )}

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

      <div style={{ flex: 1 }} />
      <span style={{ opacity: 0.6 }}>
        {locked ? "缩放已锁定" : "Ctrl+Z 撤销 · Ctrl+Shift+Z 重做"}
      </span>
    </div>
  );
}
