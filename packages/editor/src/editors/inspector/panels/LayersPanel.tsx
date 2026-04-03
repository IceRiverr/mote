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
import { PanelShell } from "./PanelShell";

let layerUid = 10;

export function LayersPanel() {
  const map = currentMap.value;
  const selectedLayer =
    map.layers.find((l) => l.id === activeLayerId.value) ?? map.layers[0];

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

  const moveLayer = (id: string, dir: -1 | 1) => {
    const idx = map.layers.findIndex((l) => l.id === id);
    if (idx < 0) return;
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= map.layers.length) return;
    executeCommand(new MoveLayerCommand(id, dir));
  };

  const renameLayer = (id: string, name: string) => {
    executeCommand(
      new SetLayerPropertyCommand(id, "name", name, "重命名图层")
    );
  };

  const setOpacity = (id: string, opacity: number) => {
    executeCommand(
      new SetLayerPropertyCommand(id, "opacity", opacity, "修改图层透明度")
    );
  };

  return (
    <PanelShell title="图层">
      {/* Toolbar */}
      <div style={{ display: "flex", gap: 2, marginBottom: 4 }}>
        <button
          onClick={addLayer}
          title="添加图层"
          style={{ flex: 1, fontSize: 11 }}
        >
          +
        </button>
        <button
          onClick={() => selectedLayer && moveLayer(selectedLayer.id, -1)}
          title="上移"
          style={{ flex: 1, fontSize: 11 }}
        >
          ↑
        </button>
        <button
          onClick={() => selectedLayer && moveLayer(selectedLayer.id, 1)}
          title="下移"
          style={{ flex: 1, fontSize: 11 }}
        >
          ↓
        </button>
        <button
          onClick={() => selectedLayer && removeLayer(selectedLayer.id)}
          title="删除图层"
          style={{ flex: 1, fontSize: 11, color: "var(--danger)" }}
        >
          ✕
        </button>
      </div>

      {/* Quick visibility bar */}
      <div
        style={{
          display: "flex",
          gap: 2,
          marginBottom: 6,
          flexWrap: "wrap",
        }}
      >
        {map.layers.map((layer) => (
          <div
            key={layer.id}
            onClick={() => toggleVisible(layer.id)}
            title={`${layer.name} (${layer.visible ? "可见" : "隐藏"})`}
            style={{
              width: 18,
              height: 18,
              borderRadius: 2,
              border:
                activeLayerId.value === layer.id
                  ? "2px solid var(--accent)"
                  : "1px solid var(--border)",
              background: layer.visible
                ? "var(--accent)"
                : "var(--bg-input)",
              opacity: layer.visible ? 1 : 0.3,
              cursor: "pointer",
            }}
          />
        ))}
      </div>

      {/* Layer list */}
      <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        {[...map.layers].reverse().map((layer) => (
          <div
            key={layer.id}
            onClick={() => {
              activeLayerId.value = layer.id;
            }}
            style={{
              display: "flex",
              alignItems: "center",
              height: 26,
              padding: "0 4px",
              gap: 3,
              background:
                activeLayerId.value === layer.id
                  ? "var(--selection)"
                  : "transparent",
              borderRadius: 3,
              cursor: "pointer",
            }}
          >
            <button
              title={layer.visible ? "隐藏" : "显示"}
              onClick={(e) => {
                e.stopPropagation();
                toggleVisible(layer.id);
              }}
              style={{
                border: "none",
                background: "transparent",
                padding: "0 2px",
                cursor: "pointer",
                opacity: layer.visible ? 1 : 0.3,
                fontSize: 11,
                width: 18,
                height: 20,
              }}
            >
              👁
            </button>
            <button
              title={layer.locked ? "解锁" : "锁定"}
              onClick={(e) => {
                e.stopPropagation();
                toggleLock(layer.id);
              }}
              style={{
                border: "none",
                background: "transparent",
                padding: "0 2px",
                cursor: "pointer",
                opacity: layer.locked ? 1 : 0.3,
                fontSize: 11,
                width: 18,
                height: 20,
              }}
            >
              🔒
            </button>
            <span
              style={{
                flex: 1,
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                fontSize: 11,
              }}
            >
              {layer.name}
            </span>
            <span
              style={{
                fontSize: 10,
                color: "var(--text-secondary)",
                minWidth: 24,
                textAlign: "right",
              }}
            >
              {Math.round(layer.opacity * 100)}%
            </span>
          </div>
        ))}
      </div>

      {/* Selected layer properties */}
      {selectedLayer && (
        <div
          style={{
            marginTop: 8,
            paddingTop: 6,
            borderTop: "1px solid var(--border)",
            display: "flex",
            flexDirection: "column",
            gap: 4,
          }}
        >
          <div
            style={{
              fontSize: 10,
              color: "var(--text-secondary)",
              fontWeight: 500,
              marginBottom: 2,
            }}
          >
            图层属性
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 40,
                fontSize: 10,
                color: "var(--text-secondary)",
                textAlign: "right",
                flexShrink: 0,
              }}
            >
              名称
            </span>
            <input
              type="text"
              value={selectedLayer.name}
              onChange={(e) =>
                renameLayer(
                  selectedLayer.id,
                  (e.target as HTMLInputElement).value
                )
              }
              onClick={(e) => e.stopPropagation()}
              style={{ flex: 1, minWidth: 0, fontSize: 11 }}
            />
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 40,
                fontSize: 10,
                color: "var(--text-secondary)",
                textAlign: "right",
                flexShrink: 0,
              }}
            >
              透明度
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={selectedLayer.opacity}
              onChange={(e) =>
                setOpacity(
                  selectedLayer.id,
                  parseFloat((e.target as HTMLInputElement).value)
                )
              }
              style={{ flex: 1 }}
            />
            <span
              style={{
                fontSize: 10,
                color: "var(--text-secondary)",
                width: 30,
                textAlign: "right",
              }}
            >
              {Math.round(selectedLayer.opacity * 100)}%
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 40,
                fontSize: 10,
                color: "var(--text-secondary)",
                textAlign: "right",
                flexShrink: 0,
              }}
            >
              锁定
            </span>
            <input
              type="checkbox"
              checked={selectedLayer.locked}
              onChange={() => toggleLock(selectedLayer.id)}
            />
          </div>
        </div>
      )}
    </PanelShell>
  );
}
