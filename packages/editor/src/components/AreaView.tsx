import type { AreaNode, Rect } from "../layout/types";
import { getEditor } from "../editors/registry";

interface Props {
  area: AreaNode;
  rect: Rect;
}

export function AreaView({ area, rect }: Props) {
  const def = getEditor(area.editorType);
  const Component = def?.component;

  return (
    <div
      style={{
        position: "absolute",
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        background: "var(--bg-area)",
        borderRadius: 0,
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {Component ? (
        <Component areaId={area.id} />
      ) : (
        <div style={{ padding: 16, color: "var(--text-secondary)" }}>
          Unknown: {area.editorType}
        </div>
      )}
    </div>
  );
}
