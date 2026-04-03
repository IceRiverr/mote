import { hoverTile, viewportZoom } from "../../store/selection";
import { activeLayer } from "../../store/project";

export function ViewportFooter() {
  const tile = hoverTile.value;
  const layer = activeLayer.value;
  const zoom = viewportZoom.value;
  const isInteger = Math.abs(zoom - Math.round(zoom)) < 0.01;

  return (
    <div
      style={{
        height: 22,
        background: "var(--bg-header)",
        borderTop: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        padding: "0 8px",
        gap: 16,
        flexShrink: 0,
        color: "var(--text-secondary)",
        fontSize: 11,
      }}
    >
      <span>坐标: {tile ? `${tile.x}, ${tile.y}` : "—"}</span>
      <span>图层: {layer?.name ?? "—"}</span>
      <div style={{ flex: 1 }} />
      <span style={{ fontSize: 10, opacity: 0.6 }}>
        滚轮缩放 · 1-6整数 · Home居中
      </span>
    </div>
  );
}
