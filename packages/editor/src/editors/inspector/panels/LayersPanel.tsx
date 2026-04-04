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
  SetLayerPropertyCommand,
} from "../../../commands/layer";
import { createTileLayer, createEntityLayer, isTileLayer, isEntityLayer } from "../../../data/TileMap";
import { PanelShell } from "./PanelShell";

let layerUid = 10;

export function LayersPanel() {
  const map = currentMap.value;
  const selectedLayer =
    map.layers.find((l) => l.id === activeLayerId.value) ?? map.layers[0];

  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const renameRef = useRef<HTMLInputElement>(null);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [insertIdx, setInsertIdx] = useState<number | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const [showAddMenu, setShowAddMenu] = useState(false);

  const addTileLayer = () => {
    const id = `layer_${++layerUid}`;
    const newLayer = createTileLayer(id, `tile_${map.layers.length + 1}`, map.width, map.height);
    executeCommand(new AddLayerCommand(newLayer));
    setShowAddMenu(false);
  };

  const addEntityLayer = () => {
    const id = `layer_${++layerUid}`;
    const newLayer = createEntityLayer(id, `entity_${map.layers.length + 1}`);
    executeCommand(new AddLayerCommand(newLayer));
    setShowAddMenu(false);
  };

  const removeLayer = (id: string) => {
    if (map.layers.length <= 1) return;
    executeCommand(new RemoveLayerCommand(id));
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

  const startRename = (id: string, currentName: string) => {
    setRenamingId(id);
    setRenameValue(currentName);
    requestAnimationFrame(() => renameRef.current?.select());
  };

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      executeCommand(
        new SetLayerPropertyCommand(renamingId, "name", renameValue.trim(), "重命名图层")
      );
    }
    setRenamingId(null);
  };

  const displayLayers = [...map.layers].reverse();

  /* Pointer-event drag reorder */
  const onRowPointerDown = useCallback(
    (e: PointerEvent, layerId: string) => {
      if (e.button !== 0) return;
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "BUTTON" || tag === "INPUT") return;

      const startY = e.clientY;
      let started = false;
      let currentInsert: number | null = null;
      const target = e.currentTarget as HTMLElement;
      target.setPointerCapture(e.pointerId);

      const onMove = (ev: PointerEvent) => {
        const dy = ev.clientY - startY;
        if (!started && Math.abs(dy) > 4) {
          started = true;
          setDragId(layerId);
        }
        if (!started || !listRef.current) return;

        const children = Array.from(listRef.current.children) as HTMLElement[];
        let bestIdx = displayLayers.length;
        for (let i = 0; i < children.length; i++) {
          const rect = children[i].getBoundingClientRect();
          const mid = rect.top + rect.height / 2;
          if (ev.clientY < mid) {
            bestIdx = i;
            break;
          }
        }
        const realInsert = map.layers.length - bestIdx;
        currentInsert = realInsert;
        setInsertIdx(realInsert);
      };

      const onUp = () => {
        target.removeEventListener("pointermove", onMove);
        target.removeEventListener("pointerup", onUp);

        if (started && currentInsert !== null) {
          const fromDisplayIdx = displayLayers.findIndex((l) => l.id === layerId);
          const fromRealIdx = map.layers.length - 1 - fromDisplayIdx;
          let targetIdx = currentInsert;
          if (targetIdx > fromRealIdx) targetIdx--;
          if (targetIdx !== fromRealIdx && targetIdx >= 0 && targetIdx < map.layers.length) {
            const newLayers = [...map.layers];
            const [removed] = newLayers.splice(fromRealIdx, 1);
            newLayers.splice(targetIdx, 0, removed);
            currentMap.value = { ...map, layers: newLayers };
            bumpMapVersion();
          }
        }
        setDragId(null);
        setInsertIdx(null);
      };

      target.addEventListener("pointermove", onMove);
      target.addEventListener("pointerup", onUp);
    },
    [displayLayers, map]
  );

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Delete" || e.key === "Backspace") {
      if (renamingId) return;
      if (selectedLayer && map.layers.length > 1) removeLayer(selectedLayer.id);
    }
    if (e.key === "F2" && selectedLayer && !renamingId) {
      startRename(selectedLayer.id, selectedLayer.name);
    }
  };

  const insertDisplayIdx =
    insertIdx !== null ? map.layers.length - insertIdx : null;

  const addBtn = (
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
          (e.currentTarget as HTMLElement).style.color = "var(--text-bright)";
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
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
            background: "var(--bg-panel)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            padding: "2px 0",
            minWidth: 120,
            boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
          }}
          onMouseLeave={() => setShowAddMenu(false)}
        >
          <button
            onClick={(e) => { e.stopPropagation(); addTileLayer(); }}
            style={{
              display: "block", width: "100%", textAlign: "left",
              background: "transparent", border: "none", cursor: "pointer",
              color: "var(--text-primary)", fontSize: 11, padding: "4px 10px",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--selection)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            ▦ Tile Layer
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); addEntityLayer(); }}
            style={{
              display: "block", width: "100%", textAlign: "left",
              background: "transparent", border: "none", cursor: "pointer",
              color: "var(--text-primary)", fontSize: 11, padding: "4px 10px",
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--selection)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
          >
            ◇ Entity Layer
          </button>
        </div>
      )}
    </div>
  );

  return (
    <PanelShell title="图层" headerRight={addBtn}>
      <div tabIndex={0} onKeyDown={onKeyDown} style={{ outline: "none" }}>
        <div
          ref={listRef}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 0,
            position: "relative",
          }}
        >
          {displayLayers.map((layer, displayIdx) => {
            const isSelected = activeLayerId.value === layer.id;
            const isDragging = dragId === layer.id;
            const isHovered = hoverId === layer.id;
            const showInsertBefore =
              insertDisplayIdx === displayIdx && dragId !== null && dragId !== layer.id;
            const showInsertAfter =
              insertDisplayIdx === displayLayers.length &&
              displayIdx === displayLayers.length - 1 &&
              dragId !== null &&
              dragId !== layer.id;

            return (
              <div key={layer.id}>
                {showInsertBefore && (
                  <div
                    style={{
                      height: 2,
                      background: "var(--accent)",
                      borderRadius: 1,
                      margin: "0 4px",
                    }}
                  />
                )}

                <div
                  onPointerDown={(e) => onRowPointerDown(e as any, layer.id)}
                  onClick={() => { activeLayerId.value = layer.id; }}
                  onMouseEnter={() => setHoverId(layer.id)}
                  onMouseLeave={() => setHoverId(null)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    height: 28,
                    padding: "0 4px",
                    gap: 4,
                    background: isSelected
                      ? "var(--selection)"
                      : isHovered && !isDragging
                      ? "rgba(255,255,255,0.04)"
                      : "transparent",
                    borderLeft: isSelected
                      ? "2px solid var(--accent)"
                      : "2px solid transparent",
                    borderRadius: 2,
                    cursor: "grab",
                    opacity: isDragging ? 0.3 : 1,
                    transition: "background 0.1s, opacity 0.1s",
                    userSelect: "none",
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
                      border: "none", background: "transparent",
                      padding: "0 1px", cursor: "pointer",
                      opacity: layer.visible ? 0.9 : 0.25,
                      fontSize: 11, width: 20, height: 20,
                      flexShrink: 0, lineHeight: "20px", textAlign: "center",
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
                      background: layer.locked ? "var(--accent)" : "transparent",
                      border: layer.locked
                        ? "1px solid var(--accent)"
                        : "1px solid var(--border)",
                      borderRadius: 3,
                      padding: "1px 5px",
                      cursor: "pointer",
                      fontSize: 12,
                      lineHeight: 1,
                      color: layer.locked ? "#fff" : "var(--text-secondary)",
                      width: 24, height: 20, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}
                  >
                    {layer.locked ? "🔒" : "🔓"}
                  </button>

                  {/* Type icon */}
                  <span
                    title={isTileLayer(layer) ? "Tile Layer" : "Entity Layer"}
                    style={{
                      fontSize: 9,
                      color: isEntityLayer(layer) ? "#e0a040" : "var(--text-secondary)",
                      flexShrink: 0,
                      width: 14,
                      textAlign: "center",
                      opacity: 0.7,
                    }}
                  >
                    {isTileLayer(layer) ? "▦" : "◇"}
                  </span>

                  {/* Name */}
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
                        flex: 1, minWidth: 0, fontSize: 11, height: 18,
                        padding: "0 3px",
                        border: "1px solid var(--accent)", borderRadius: 2,
                        background: "var(--bg-input)", color: "var(--text-bright)",
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
                        flex: 1, overflow: "hidden",
                        textOverflow: "ellipsis", whiteSpace: "nowrap",
                        fontSize: 11, cursor: "default",
                      }}
                    >
                      {layer.name}
                    </span>
                  )}

                  {/* Delete */}
                  <button
                    title="删除图层 (Delete)"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeLayer(layer.id);
                    }}
                    style={{
                      border: "none",
                      background: "transparent",
                      cursor: map.layers.length <= 1 ? "default" : "pointer",
                      fontSize: 10,
                      width: 18,
                      height: 18,
                      flexShrink: 0,
                      lineHeight: "18px",
                      textAlign: "center",
                      color: "var(--text-secondary)",
                      opacity: (isHovered || isSelected) && map.layers.length > 1 ? 0.7 : 0,
                      transition: "opacity 0.15s",
                      padding: 0,
                      borderRadius: 2,
                    }}
                    onMouseEnter={(e) => {
                      if (map.layers.length > 1)
                        (e.currentTarget as HTMLElement).style.color = "#e06060";
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.color = "var(--text-secondary)";
                    }}
                  >
                    ✕
                  </button>
                </div>

                {showInsertAfter && (
                  <div
                    style={{
                      height: 2,
                      background: "var(--accent)",
                      borderRadius: 1,
                      margin: "0 4px",
                    }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </PanelShell>
  );
}
