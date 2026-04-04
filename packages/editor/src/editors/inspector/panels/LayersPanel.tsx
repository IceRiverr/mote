import { useState, useRef, useCallback } from "preact/hooks";
import {
  currentMap,
  activeLayerId,
  bumpMapVersion,
} from "../../../store/project";
import { executeCommand } from "../../../store/history";
import {
  AddLayerCommand,
  RemoveLayerCommand,
  MoveLayerCommand,
  SetLayerPropertyCommand,
} from "../../../commands/layer";
import { getLayerColor } from "../../../data/TileMap";
import { PanelShell } from "./PanelShell";
import { OpacitySlider } from "./OpacitySlider";
import { ColorTagPopover } from "./ColorTagPopover";

let layerUid = 10;

export function LayersPanel() {
  const map = currentMap.value;
  const selectedLayer =
    map.layers.find((l) => l.id === activeLayerId.value) ?? map.layers[0];

  // --- Inline rename state ---
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);

  // --- Color tag popover state ---
  const [colorPopoverId, setColorPopoverId] = useState<string | null>(null);

  // --- Drag state ---
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  // --- Actions ---
  const addLayer = () => {
    const id = `layer_${++layerUid}`;
    const newLayer = {
      id,
      name: `layer_${map.layers.length + 1}`,
      visible: true,
      opacity: 1,
      locked: false,
      data: new Array(map.width * map.height).fill(0),
    };
    executeCommand(new AddLayerCommand(newLayer));
  };

  const removeLayer = () => {
    if (!selectedLayer || map.layers.length <= 1) return;
    executeCommand(new RemoveLayerCommand(selectedLayer.id));
  };

  const moveLayer = (dir: -1 | 1) => {
    if (!selectedLayer) return;
    const idx = map.layers.findIndex((l) => l.id === selectedLayer.id);
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= map.layers.length) return;
    executeCommand(new MoveLayerCommand(selectedLayer.id, dir));
  };

  const toggleVisible = (id: string) => {
    const layer = map.layers.find((l) => l.id === id);
    if (!layer) return;
    executeCommand(
      new SetLayerPropertyCommand(id, "visible", !layer.visible, "切换图层可见性")
    );
  };

  const toggleLock = (id: string) => {
    const layer = map.layers.find((l) => l.id === id);
    if (!layer) return;
    executeCommand(
      new SetLayerPropertyCommand(id, "locked", !layer.locked, "切换图层锁定")
    );
  };

  const setOpacity = (opacity: number) => {
    if (!selectedLayer) return;
    executeCommand(
      new SetLayerPropertyCommand(
        selectedLayer.id,
        "opacity",
        opacity,
        "修改图层透明度"
      )
    );
  };

  const setColor = (layerId: string, colorId: string) => {
    const color = colorId === "gray" ? undefined : colorId;
    executeCommand(
      new SetLayerPropertyCommand(layerId, "color", color, "修改图层颜色标记")
    );
  };

  // --- Inline rename ---
  const startRename = (id: string, currentName: string) => {
    setRenamingId(id);
    setRenameValue(currentName);
    requestAnimationFrame(() => renameRef.current?.select());
  };

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      executeCommand(
        new SetLayerPropertyCommand(
          renamingId,
          "name",
          renameValue.trim(),
          "重命名图层"
        )
      );
    }
    setRenamingId(null);
  };

  // --- Drag & drop ---
  const displayLayers = [...map.layers].reverse(); // top → bottom = front → back

  const onDragStart = (e: DragEvent, layerId: string) => {
    setDragId(layerId);
    e.dataTransfer!.effectAllowed = "move";
    // Minimal drag image
    const el = e.currentTarget as HTMLElement;
    e.dataTransfer!.setDragImage(el, 0, 0);
  };

  const onDragOver = useCallback(
    (e: DragEvent, displayIdx: number) => {
      e.preventDefault();
      e.dataTransfer!.dropEffect = "move";
      // Convert display index to real index
      const realIdx = map.layers.length - 1 - displayIdx;
      setDropIndex(realIdx);
    },
    [map.layers.length]
  );

  const onDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      if (dragId === null || dropIndex === null) return;

      const fromIdx = map.layers.findIndex((l) => l.id === dragId);
      if (fromIdx < 0 || fromIdx === dropIndex) {
        setDragId(null);
        setDropIndex(null);
        return;
      }

      // Move layer by swapping step by step
      const dir = dropIndex > fromIdx ? 1 : -1;
      let steps = Math.abs(dropIndex - fromIdx);
      // Execute as multiple move commands (or a single reorder)
      // For simplicity, do direct mutation + single undo command
      const newLayers = [...map.layers];
      const [removed] = newLayers.splice(fromIdx, 1);
      newLayers.splice(dropIndex, 0, removed);
      currentMap.value = { ...map, layers: newLayers };
      bumpMapVersion();

      setDragId(null);
      setDropIndex(null);
    },
    [dragId, dropIndex, map]
  );

  const onDragEnd = () => {
    setDragId(null);
    setDropIndex(null);
  };

  // --- Keyboard ---
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      if (renamingId) return; // Don't delete while renaming
      removeLayer();
    }
    if (e.key === "F2" && selectedLayer && !renamingId) {
      startRename(selectedLayer.id, selectedLayer.name);
    }
  };

  // Selected layer index for move button disable
  const selectedIdx = selectedLayer
    ? map.layers.findIndex((l) => l.id === selectedLayer.id)
    : -1;

  return (
    <PanelShell title="图层">
      <div
        tabIndex={0}
        onKeyDown={onKeyDown}
        style={{ outline: "none" }}
      >
        {/* --- Top: Opacity slider for selected layer --- */}
        <OpacitySlider
          value={selectedLayer?.opacity ?? 1}
          onChange={setOpacity}
          disabled={!selectedLayer}
        />

        {/* --- Layer list --- */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 1,
            marginTop: 4,
            marginBottom: 4,
          }}
        >
          {displayLayers.map((layer, displayIdx) => {
            const isSelected = activeLayerId.value === layer.id;
            const isDragging = dragId === layer.id;
            const realIdx = map.layers.length - 1 - displayIdx;
            const isDropTarget = dropIndex === realIdx && dragId !== null && dragId !== layer.id;

            return (
              <div
                key={layer.id}
                draggable={renamingId !== layer.id}
                onDragStart={(e) => onDragStart(e as any, layer.id)}
                onDragOver={(e) => onDragOver(e as any, displayIdx)}
                onDrop={(e) => onDrop(e as any)}
                onDragEnd={onDragEnd}
                onClick={() => {
                  activeLayerId.value = layer.id;
                  // Close color popover if open
                  if (colorPopoverId && colorPopoverId !== layer.id) {
                    setColorPopoverId(null);
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  height: 28,
                  padding: "0 4px",
                  gap: 2,
                  background: isSelected
                    ? "var(--selection)"
                    : "transparent",
                  borderLeft: isSelected
                    ? "2px solid var(--accent)"
                    : "2px solid transparent",
                  borderTop: isDropTarget
                    ? "2px solid var(--accent)"
                    : "2px solid transparent",
                  borderRadius: 2,
                  cursor: "grab",
                  opacity: isDragging ? 0.4 : 1,
                  transition: "background 0.1s",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLElement).style.background =
                      "rgba(255,255,255,0.04)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    (e.currentTarget as HTMLElement).style.background =
                      "transparent";
                  }
                }}
              >
                {/* Visibility */}
                <button
                  title={layer.visible ? "隐藏" : "显示"}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleVisible(layer.id);
                  }}
                  style={{
                    border: "none",
                    background: "transparent",
                    padding: "0 1px",
                    cursor: "pointer",
                    opacity: layer.visible ? 0.9 : 0.25,
                    fontSize: 11,
                    width: 20,
                    height: 20,
                    flexShrink: 0,
                    lineHeight: "20px",
                    textAlign: "center",
                  }}
                >
                  👁
                </button>

                {/* Lock */}
                <button
                  title={layer.locked ? "解锁" : "锁定"}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleLock(layer.id);
                  }}
                  style={{
                    border: "none",
                    background: "transparent",
                    padding: "0 1px",
                    cursor: "pointer",
                    opacity: layer.locked ? 0.9 : 0.25,
                    fontSize: 11,
                    width: 20,
                    height: 20,
                    flexShrink: 0,
                    lineHeight: "20px",
                    textAlign: "center",
                  }}
                >
                  🔒
                </button>

                {/* Color tag */}
                <div
                  style={{ position: "relative", flexShrink: 0 }}
                >
                  <div
                    title="颜色标记"
                    onClick={(e) => {
                      e.stopPropagation();
                      setColorPopoverId(
                        colorPopoverId === layer.id ? null : layer.id
                      );
                    }}
                    style={{
                      width: 4,
                      height: 16,
                      borderRadius: 1,
                      background: getLayerColor(layer.color),
                      cursor: "pointer",
                      marginRight: 4,
                    }}
                  />
                  {colorPopoverId === layer.id && (
                    <ColorTagPopover
                      currentColor={layer.color}
                      onSelect={(colorId) => setColor(layer.id, colorId)}
                      onClose={() => setColorPopoverId(null)}
                    />
                  )}
                </div>

                {/* Name (double-click to rename) */}
                {renamingId === layer.id ? (
                  <input
                    ref={renameRef}
                    type="text"
                    value={renameValue}
                    onInput={(e) =>
                      setRenameValue((e.target as HTMLInputElement).value)
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitRename();
                      if (e.key === "Escape") setRenamingId(null);
                      e.stopPropagation();
                    }}
                    onBlur={commitRename}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      fontSize: 11,
                      height: 18,
                      padding: "0 3px",
                      border: "1px solid var(--accent)",
                      borderRadius: 2,
                      background: "var(--bg-input)",
                      color: "var(--text-bright)",
                      outline: "none",
                    }}
                  />
                ) : (
                  <span
                    onDblClick={(e) => {
                      e.stopPropagation();
                      startRename(layer.id, layer.name);
                    }}
                    style={{
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontSize: 11,
                      cursor: "default",
                      userSelect: "none",
                    }}
                  >
                    {layer.name}
                  </span>
                )}

                {/* Opacity percentage */}
                <span
                  style={{
                    fontSize: 10,
                    color: "var(--text-secondary)",
                    width: 32,
                    textAlign: "right",
                    flexShrink: 0,
                    fontFamily: "monospace",
                  }}
                >
                  {Math.round(layer.opacity * 100)}%
                </span>
              </div>
            );
          })}
        </div>

        {/* --- Bottom toolbar --- */}
        <div
          style={{
            display: "flex",
            gap: 2,
            paddingTop: 4,
            borderTop: "1px solid var(--border)",
          }}
        >
          <button
            onClick={addLayer}
            title="添加图层"
            style={{
              flex: 1,
              fontSize: 12,
              height: 24,
              border: "1px solid var(--border)",
              borderRadius: 3,
              background: "transparent",
              color: "var(--text)",
              cursor: "pointer",
            }}
          >
            ＋
          </button>
          <button
            onClick={() => moveLayer(-1)}
            disabled={selectedIdx <= 0}
            title="上移"
            style={{
              flex: 1,
              fontSize: 12,
              height: 24,
              border: "1px solid var(--border)",
              borderRadius: 3,
              background: "transparent",
              color: "var(--text)",
              cursor: selectedIdx <= 0 ? "default" : "pointer",
              opacity: selectedIdx <= 0 ? 0.3 : 1,
            }}
          >
            ▲
          </button>
          <button
            onClick={() => moveLayer(1)}
            disabled={selectedIdx >= map.layers.length - 1}
            title="下移"
            style={{
              flex: 1,
              fontSize: 12,
              height: 24,
              border: "1px solid var(--border)",
              borderRadius: 3,
              background: "transparent",
              color: "var(--text)",
              cursor:
                selectedIdx >= map.layers.length - 1 ? "default" : "pointer",
              opacity: selectedIdx >= map.layers.length - 1 ? 0.3 : 1,
            }}
          >
            ▼
          </button>
          <button
            onClick={removeLayer}
            disabled={map.layers.length <= 1}
            title="删除图层 (Delete)"
            style={{
              flex: 1,
              fontSize: 12,
              height: 24,
              border: "1px solid var(--border)",
              borderRadius: 3,
              background: "transparent",
              color:
                map.layers.length <= 1 ? "var(--text-secondary)" : "#e06060",
              cursor: map.layers.length <= 1 ? "default" : "pointer",
              opacity: map.layers.length <= 1 ? 0.3 : 1,
            }}
          >
            🗑
          </button>
        </div>
      </div>
    </PanelShell>
  );
}
