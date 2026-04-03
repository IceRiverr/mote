import {
  hoverTile,
  viewportZoom,
  viewportZoomLocked,
} from "../../store/selection";
import { activeLayer } from "../../store/project";

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
      <span>
        {tile ? `瓦片 (${tile.x}, ${tile.y})` : "—"}
      </span>
      {layer && (
        <span>
          图层: {layer.name}
          {layer.locked ? " 🔒" : ""}
        </span>
      )}
      <div style={{ flex: 1 }} />
      <span style={{ opacity: 0.6 }}>
        {locked ? "缩放已锁定" : "滚轮缩放 · 1-6整数 · Home居中"}
      </span>
    </div>
  );
}
