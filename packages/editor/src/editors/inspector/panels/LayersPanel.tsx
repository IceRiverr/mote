import {
  currentMap,
  activeLayerId,
  bumpMapVersion,
} from "../../../store/project";
import { PanelShell } from "./PanelShell";

let layerUid = 10;

export function LayersPanel() {
  const map = currentMap.value;

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
    currentMap.value = {
      ...map,
      layers: [...map.layers, newLayer],
    };
    activeLayerId.value = id;
    bumpMapVersion();
  };

  const removeLayer = (id: string) => {
    if (map.layers.length <= 1) return;
    currentMap.value = {
      ...map,
      layers: map.layers.filter((l) => l.id !== id),
    };
    if (activeLayerId.value === id) {
      activeLayerId.value = currentMap.value.layers[0].id;
    }
    bumpMapVersion();
  };

  const toggleVisible = (id: string) => {
    currentMap.value = {
      ...map,
      layers: map.layers.map((l) =>
        l.id === id ? { ...l, visible: !l.visible } : l
      ),
    };
    bumpMapVersion();
  };

  const toggleLock = (id: string) => {
    currentMap.value = {
      ...map,
      layers: map.layers.map((l) =>
        l.id === id ? { ...l, locked: !l.locked } : l
      ),
    };
    bumpMapVersion();
  };

  return (
    <PanelShell title="图层">
      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {[...map.layers].reverse().map((layer) => (
          <div
            key={layer.id}
            onClick={() => { activeLayerId.value = layer.id; }}
            style={{
              display: "flex",
              alignItems: "center",
              height: 26,
              padding: "0 4px",
              gap: 4,
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
              onClick={(e) => { e.stopPropagation(); toggleVisible(layer.id); }}
              style={{
                border: "none",
                background: "transparent",
                padding: "0 2px",
                cursor: "pointer",
                opacity: layer.visible ? 1 : 0.3,
                fontSize: 12,
                width: 20,
                height: 20,
              }}
            >
              👁
            </button>
            <button
              title={layer.locked ? "解锁" : "锁定"}
              onClick={(e) => { e.stopPropagation(); toggleLock(layer.id); }}
              style={{
                border: "none",
                background: "transparent",
                padding: "0 2px",
                cursor: "pointer",
                opacity: layer.locked ? 1 : 0.3,
                fontSize: 12,
                width: 20,
                height: 20,
              }}
            >
              🔒
            </button>
            <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontSize: 11 }}>
              {layer.name}
            </span>
            <button
              title="删除图层"
              onClick={(e) => { e.stopPropagation(); removeLayer(layer.id); }}
              style={{
                border: "none",
                background: "transparent",
                padding: "0 2px",
                cursor: "pointer",
                color: "var(--danger)",
                fontSize: 11,
                width: 20,
                height: 20,
              }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <button onClick={addLayer} style={{ width: "100%", marginTop: 4 }}>
        + 添加图层
      </button>
    </PanelShell>
  );
}
