import { LAYER_COLORS } from "../../../data/TileMap";

/**
 * Inline color tag picker popover.
 * Shows a row of color circles. Click to select, click outside to close.
 */
export function ColorTagPopover({
  currentColor,
  onSelect,
  onClose,
}: {
  currentColor?: string;
  onSelect: (colorId: string) => void;
  onClose: () => void;
}) {
  return (
    <div
      onClick={(e) => e.stopPropagation()}
      style={{
        position: "absolute",
        left: 0,
        top: "100%",
        zIndex: 100,
        background: "var(--bg-panel)",
        border: "1px solid var(--border)",
        borderRadius: 4,
        padding: "4px 6px",
        display: "flex",
        gap: 4,
        alignItems: "center",
        boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
        whiteSpace: "nowrap",
      }}
    >
      {LAYER_COLORS.map((c) => (
        <div
          key={c.id}
          title={c.label}
          onClick={() => {
            onSelect(c.id);
            onClose();
          }}
          style={{
            width: 14,
            height: 14,
            borderRadius: "50%",
            background: c.hex,
            cursor: "pointer",
            border:
              currentColor === c.id
                ? "2px solid var(--text-bright)"
                : "2px solid transparent",
            boxSizing: "border-box",
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  );
}
