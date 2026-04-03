import { useEffect, useRef, useState } from "preact/hooks";
import { tilesets } from "../../store/project";
import type { TileSet, TileData } from "../../data/TileSet";

interface Props {
  x: number;
  y: number;
  localId: number;
  tilesetId: string;
  onClose: () => void;
}

export function TileContextMenu({ x, y, localId, tilesetId, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);

  const ts = tilesets.value.find((t) => t.id === tilesetId);
  if (!ts) return null;

  const tileData: TileData = ts.tileData?.[localId] ?? {};
  const hasCollision = tileData.collision ?? false;
  const tags = tileData.tags ?? [];

  // Click outside to close
  useEffect(() => {
    const handler = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const timer = setTimeout(() => {
      window.addEventListener("pointerdown", handler);
    }, 50);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("pointerdown", handler);
    };
  }, []);

  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const updateTileData = (patch: Partial<TileData>) => {
    const newData = { ...tileData, ...patch };
    const newTileData = { ...ts.tileData, [localId]: newData };
    // Mutate tileset's tileData and trigger re-render
    tilesets.value = tilesets.value.map((t) =>
      t.id === tilesetId ? { ...t, tileData: newTileData } : t
    );
  };

  const toggleCollision = () => {
    updateTileData({ collision: !hasCollision });
  };

  const [tagInput, setTagInput] = useState(tags.join(", "));

  const commitTags = () => {
    const newTags = tagInput
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    updateTileData({ tags: newTags });
    setEditing(false);
  };

  return (
    <div
      ref={ref}
      style={{
        position: "absolute",
        left: Math.min(x, 180), // prevent overflow
        top: y,
        minWidth: 160,
        background: "#2a2a2a",
        border: "1px solid var(--border)",
        borderRadius: 5,
        boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
        zIndex: 300,
        fontSize: 11,
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "5px 10px",
          borderBottom: "1px solid var(--border)",
          color: "var(--text-secondary)",
          fontSize: 10,
          fontFamily: "monospace",
        }}
      >
        瓦片 #{localId} ({localId % ts.columns}, {Math.floor(localId / ts.columns)})
      </div>

      {/* Collision toggle */}
      <div
        onClick={toggleCollision}
        style={{
          padding: "6px 10px",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: 6,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.background = "var(--bg-input)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }}
      >
        <span style={{ width: 16, textAlign: "center" }}>
          {hasCollision ? "✅" : "⬜"}
        </span>
        <span>碰撞体</span>
      </div>

      {/* Tags */}
      <div
        style={{
          padding: "6px 10px",
          borderTop: "1px solid var(--border)",
        }}
      >
        <div
          style={{
            color: "var(--text-secondary)",
            fontSize: 10,
            marginBottom: 4,
          }}
        >
          标签
        </div>
        {editing ? (
          <div style={{ display: "flex", gap: 3 }}>
            <input
              type="text"
              value={tagInput}
              onInput={(e) => setTagInput((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitTags();
                if (e.key === "Escape") setEditing(false);
              }}
              style={{ flex: 1, fontSize: 10, height: 20 }}
              autoFocus
            />
            <button onClick={commitTags} style={{ fontSize: 10, height: 20, padding: "0 6px" }}>
              ✓
            </button>
          </div>
        ) : (
          <div
            onClick={() => setEditing(true)}
            style={{
              cursor: "pointer",
              minHeight: 18,
              padding: "2px 4px",
              borderRadius: 3,
              border: "1px solid var(--border)",
              fontSize: 10,
              color: tags.length > 0 ? "var(--text-primary)" : "var(--text-secondary)",
            }}
          >
            {tags.length > 0 ? tags.join(", ") : "点击添加标签…"}
          </div>
        )}
      </div>

      {/* Properties preview */}
      {tileData.properties && Object.keys(tileData.properties).length > 0 && (
        <div
          style={{
            padding: "6px 10px",
            borderTop: "1px solid var(--border)",
            fontSize: 10,
            color: "var(--text-secondary)",
          }}
        >
          自定义属性: {Object.keys(tileData.properties).length} 项
        </div>
      )}
    </div>
  );
}
