import { useState, useCallback } from "preact/hooks";
import { registerEditor } from "../registry";
import {
  currentScene,
  sceneVersion,
  activeSceneLayerId,
  addLayer,
  removeLayer,
  moveLayer,
  renameLayer,
  toggleLayerVisibility,
  toggleLayerLocked,
  bumpSceneVersion,
} from "../../store/scene";
import { selectedEntityId } from "../../store/selection";
import {
  createTileLayer,
  createEntityLayer,
  isTileLayer,
  isEntityLayer,
} from "../../data/Scene";
import type { SceneLayer, EntityLayerData } from "../../data/Scene";
import type { EntityInstance } from "../../data/EntityDef";

// ── Local state ────────────────────────────────────────────────────────────

let layerUid = 100;

// ── Context Menu ───────────────────────────────────────────────────────────

interface ContextMenuState {
  x: number;
  y: number;
  layerId: string;
}

function LayerContextMenu({
  state,
  onClose,
}: {
  state: ContextMenuState;
  onClose: () => void;
}) {
  const scene = currentScene.value;
  if (!scene) return null;

  const layerIdx = scene.layers.findIndex((l) => l.id === state.layerId);
  const canMoveUp = layerIdx > 0;
  const canMoveDown = layerIdx < scene.layers.length - 1;
  const canDelete = scene.layers.length > 1;

  const addTile = () => {
    const id = `layer_${++layerUid}`;
    const spriteSheet = scene.spriteSheets[0] ?? "";
    const newLayer = createTileLayer(
      id,
      `tile_${scene.layers.length + 1}`,
      scene.width,
      scene.height,
      spriteSheet,
    );
    addLayer(newLayer);
    onClose();
  };

  const addEntity = () => {
    const id = `layer_${++layerUid}`;
    const newLayer = createEntityLayer(id, `entity_${scene.layers.length + 1}`);
    addLayer(newLayer);
    onClose();
  };

  const remove = () => {
    if (canDelete) {
      removeLayer(state.layerId);
    }
    onClose();
  };

  const handleRename = () => {
    const layer = scene.layers.find((l) => l.id === state.layerId);
    if (!layer) {
      onClose();
      return;
    }
    const newName = prompt("重命名图层:", layer.name);
    if (newName && newName.trim()) {
      renameLayer(state.layerId, newName.trim());
    }
    onClose();
  };

  const handleMoveUp = () => {
    if (canMoveUp) {
      moveLayer(state.layerId, "up");
    }
    onClose();
  };

  const handleMoveDown = () => {
    if (canMoveDown) {
      moveLayer(state.layerId, "down");
    }
    onClose();
  };

  const items: {
    label: string;
    action: () => void;
    enabled: boolean;
    danger?: boolean;
  }[] = [
    { label: "▦ 添加 Tile 图层", action: addTile, enabled: true },
    { label: "◇ 添加 Entity 图层", action: addEntity, enabled: true },
    { label: "---", action: () => {}, enabled: false },
    { label: "✏️ 重命名", action: handleRename, enabled: true },
    { label: "⬆ 上移", action: handleMoveUp, enabled: canMoveUp },
    { label: "⬇ 下移", action: handleMoveDown, enabled: canMoveDown },
    { label: "---", action: () => {}, enabled: false },
    { label: "🗑️ 删除", action: remove, enabled: canDelete, danger: true },
  ];

  return (
    <div
      style={{
        position: "fixed",
        top: state.y,
        left: state.x,
        zIndex: 10000,
        background: "var(--bg-header)",
        border: "1px solid var(--border)",
        borderRadius: 4,
        padding: "4px 0",
        minWidth: 170,
        boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
      }}
      onMouseLeave={onClose}
    >
      {items.map((item, i) =>
        item.label === "---" ? (
          <div
            key={i}
            style={{
              height: 1,
              background: "var(--border)",
              margin: "3px 8px",
            }}
          />
        ) : (
          <div
            key={i}
            onClick={(e) => {
              e.stopPropagation();
              if (item.enabled) item.action();
            }}
            onMouseEnter={(e) => {
              if (item.enabled) {
                (e.currentTarget as HTMLElement).style.background =
                  "var(--selection)";
              }
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
            }}
            style={{
              padding: "5px 12px",
              fontSize: 11,
              cursor: item.enabled ? "pointer" : "default",
              color: !item.enabled
                ? "var(--text-secondary)"
                : item.danger
                  ? "var(--danger)"
                  : "var(--text-primary)",
              opacity: item.enabled ? 1 : 0.4,
              whiteSpace: "nowrap",
            }}
          >
            {item.label}
          </div>
        ),
      )}
    </div>
  );
}

// ── Entity Instance Item ───────────────────────────────────────────────────

function EntityItem({ entity }: { entity: EntityInstance }) {
  const isSelected = selectedEntityId.value === entity.id;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        selectedEntityId.value = entity.id;
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        height: 24,
        paddingLeft: 40,
        paddingRight: 8,
        gap: 4,
        cursor: "pointer",
        background: isSelected
          ? "var(--selection)"
          : hovered
            ? "rgba(255,255,255,0.04)"
            : "transparent",
        userSelect: "none",
        transition: "background 0.1s",
      }}
    >
      <span
        style={{
          fontSize: 10,
          flexShrink: 0,
          width: 16,
          textAlign: "center",
        }}
      >
        ◇
      </span>
      <span
        style={{
          flex: 1,
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontSize: 10,
          color: isSelected ? "var(--text-bright)" : "var(--text-primary)",
        }}
      >
        {entity.name || entity.template}
      </span>
      <span
        style={{
          fontSize: 9,
          color: "var(--text-secondary)",
          flexShrink: 0,
        }}
      >
        ({Math.round(entity.x)},{Math.round(entity.y)})
      </span>
      {entity.visible === false && (
        <span
          style={{
            fontSize: 9,
            color: "var(--text-secondary)",
            opacity: 0.5,
          }}
        >
          👁
        </span>
      )}
    </div>
  );
}

// ── Layer Item ─────────────────────────────────────────────────────────────

function LayerItem({
  layer,
  onContextMenu,
}: {
  layer: SceneLayer;
  onContextMenu: (e: MouseEvent, layerId: string) => void;
}) {
  const isActive = activeSceneLayerId.value === layer.id;
  const [hovered, setHovered] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const isEntity = isEntityLayer(layer);
  const entityLayer = isEntity ? (layer as EntityLayerData) : null;
  const hasEntities = entityLayer && entityLayer.entities.length > 0;

  const handleToggleVisible = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      toggleLayerVisibility(layer.id);
    },
    [layer.id],
  );

  const handleToggleLock = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      toggleLayerLocked(layer.id);
    },
    [layer.id],
  );

  const handleClick = useCallback(() => {
    activeSceneLayerId.value = layer.id;
  }, [layer.id]);

  const handleCtxMenu = useCallback(
    (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onContextMenu(e, layer.id);
    },
    [layer.id, onContextMenu],
  );

  const handleExpandToggle = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      setExpanded((v) => !v);
    },
    [],
  );

  // Force read from sceneVersion to trigger re-render on mutations
  const _ver = sceneVersion.value;

  return (
    <div>
      <div
        onClick={handleClick}
        onContextMenu={handleCtxMenu}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        style={{
          display: "flex",
          alignItems: "center",
          height: 30,
          padding: "0 6px",
          gap: 4,
          cursor: "pointer",
          background: isActive
            ? "var(--selection)"
            : hovered
              ? "rgba(255,255,255,0.04)"
              : "transparent",
          borderLeft: isActive
            ? "2px solid var(--accent)"
            : "2px solid transparent",
          userSelect: "none",
          transition: "background 0.1s",
        }}
      >
        {/* Expand arrow (entity layers only) */}
        <span
          onClick={isEntity && hasEntities ? handleExpandToggle : undefined}
          style={{
            width: 14,
            fontSize: 9,
            color: "var(--text-secondary)",
            textAlign: "center",
            flexShrink: 0,
            cursor: isEntity && hasEntities ? "pointer" : "default",
          }}
        >
          {isEntity && hasEntities ? (expanded ? "▼" : "▶") : ""}
        </span>

        {/* Type badge */}
        <span
          style={{
            fontSize: 9,
            fontWeight: 600,
            color: isEntity ? "#e0a040" : "var(--accent)",
            background: isEntity
              ? "rgba(224,160,64,0.15)"
              : "rgba(74,144,217,0.15)",
            borderRadius: 2,
            padding: "1px 4px",
            flexShrink: 0,
            lineHeight: "14px",
          }}
        >
          {isTileLayer(layer) ? "T" : "E"}
        </span>

        {/* Visibility */}
        <button
          title={layer.visible ? "隐藏" : "显示"}
          onClick={handleToggleVisible}
          style={{
            border: "none",
            background: "transparent",
            padding: 0,
            cursor: "pointer",
            opacity: layer.visible ? 0.9 : 0.25,
            fontSize: 11,
            width: 18,
            height: 18,
            flexShrink: 0,
            lineHeight: "18px",
            textAlign: "center",
          }}
        >
          👁
        </button>

        {/* Lock */}
        <button
          title={layer.locked ? "解锁" : "锁定"}
          onClick={handleToggleLock}
          style={{
            background: layer.locked ? "var(--accent)" : "transparent",
            border: layer.locked
              ? "1px solid var(--accent)"
              : "1px solid var(--border)",
            borderRadius: 3,
            padding: 0,
            cursor: "pointer",
            fontSize: 10,
            width: 20,
            height: 18,
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: layer.locked ? "#fff" : "var(--text-secondary)",
          }}
        >
          {layer.locked ? "🔒" : "🔓"}
        </button>

        {/* Name */}
        <span
          style={{
            flex: 1,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            fontSize: 11,
            color: isActive ? "var(--text-bright)" : "var(--text-primary)",
          }}
        >
          {layer.name}
        </span>

        {/* Entity count badge */}
        {isEntity && entityLayer && (
          <span
            style={{
              fontSize: 9,
              color: "var(--text-secondary)",
              flexShrink: 0,
            }}
          >
            {entityLayer.entities.length}
          </span>
        )}
      </div>

      {/* Expanded entity list */}
      {isEntity && expanded && entityLayer && (
        <div>
          {entityLayer.entities.length === 0 ? (
            <div
              style={{
                paddingLeft: 40,
                height: 22,
                display: "flex",
                alignItems: "center",
                fontSize: 10,
                color: "var(--text-secondary)",
                fontStyle: "italic",
              }}
            >
              (无实体)
            </div>
          ) : (
            entityLayer.entities.map((entity) => (
              <EntityItem key={entity.id} entity={entity} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Header ─────────────────────────────────────────────────────────────────

function SceneTreeHeader() {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const scene = currentScene.value;
  if (!scene) return null;

  const addTileLayer = () => {
    const id = `layer_${++layerUid}`;
    const spriteSheet = scene.spriteSheets[0] ?? "";
    const newLayer = createTileLayer(
      id,
      `tile_${scene.layers.length + 1}`,
      scene.width,
      scene.height,
      spriteSheet,
    );
    addLayer(newLayer);
    setShowAddMenu(false);
  };

  const addEntityLayer = () => {
    const id = `layer_${++layerUid}`;
    const newLayer = createEntityLayer(id, `entity_${scene.layers.length + 1}`);
    addLayer(newLayer);
    setShowAddMenu(false);
  };

  return (
    <div
      style={{
        height: 32,
        background: "var(--panel-header)",
        display: "flex",
        alignItems: "center",
        padding: "0 8px",
        gap: 6,
        flexShrink: 0,
        borderBottom: "1px solid var(--border)",
      }}
    >
      <span style={{ fontSize: 12 }}>🌳</span>
      <span
        style={{
          fontWeight: 600,
          fontSize: 11,
          color: "var(--text-bright)",
        }}
      >
        场景树
      </span>
      <span
        style={{
          fontSize: 10,
          color: "var(--text-secondary)",
          marginLeft: 4,
        }}
      >
        — {scene.name}
      </span>
      <div style={{ flex: 1 }} />

      {/* Add layer button */}
      <div style={{ position: "relative" }}>
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowAddMenu(!showAddMenu);
          }}
          title="添加图层"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--text-secondary)",
            fontSize: 14,
            padding: "0 4px",
            lineHeight: 1,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color =
              "var(--text-bright)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color =
              "var(--text-secondary)";
          }}
        >
          ＋
        </button>
        {showAddMenu && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              right: 0,
              zIndex: 100,
              background: "var(--bg-header)",
              border: "1px solid var(--border)",
              borderRadius: 4,
              padding: "2px 0",
              minWidth: 140,
              boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
            }}
            onMouseLeave={() => setShowAddMenu(false)}
          >
            <button
              onClick={(e) => {
                e.stopPropagation();
                addTileLayer();
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--text-primary)",
                fontSize: 11,
                padding: "5px 10px",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "var(--selection)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "transparent";
              }}
            >
              ▦ Tile Layer
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                addEntityLayer();
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--text-primary)",
                fontSize: 11,
                padding: "5px 10px",
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "var(--selection)";
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background =
                  "transparent";
              }}
            >
              ◇ Entity Layer
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────

function SceneTreeEditor({ areaId }: { areaId: string }) {
  const scene = currentScene.value;
  const _ver = sceneVersion.value; // subscribe to mutations
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  const handleContextMenu = useCallback(
    (e: MouseEvent, layerId: string) => {
      setContextMenu({ x: e.clientX, y: e.clientY, layerId });
    },
    [],
  );

  const closeContextMenu = useCallback(() => {
    setContextMenu(null);
  }, []);

  if (!scene) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--text-secondary)",
          fontSize: 12,
        }}
      >
        暂无场景
      </div>
    );
  }

  // Display layers in reverse order (top layer first in UI)
  const displayLayers = [...scene.layers].reverse();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
      }}
      onClick={closeContextMenu}
    >
      <SceneTreeHeader />

      {/* Layer list */}
      <div style={{ flex: 1, overflow: "auto" }}>
        {displayLayers.length === 0 ? (
          <div
            style={{
              padding: 16,
              textAlign: "center",
              color: "var(--text-secondary)",
              fontSize: 11,
            }}
          >
            暂无图层
          </div>
        ) : (
          displayLayers.map((layer) => (
            <LayerItem
              key={layer.id}
              layer={layer}
              onContextMenu={handleContextMenu}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          height: 22,
          borderTop: "1px solid var(--border)",
          background: "var(--bg-header)",
          display: "flex",
          alignItems: "center",
          padding: "0 8px",
          fontSize: 10,
          color: "var(--text-secondary)",
          flexShrink: 0,
          gap: 8,
        }}
      >
        <span>
          {scene.layers.length} 个图层 · {scene.width}×{scene.height} ·{" "}
          {scene.tileWidth}×{scene.tileHeight}px
        </span>
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <LayerContextMenu state={contextMenu} onClose={closeContextMenu} />
      )}
    </div>
  );
}

registerEditor({
  id: "scene-tree",
  name: "场景树",
  icon: "🌳",
  component: SceneTreeEditor,
});

export { SceneTreeEditor };
