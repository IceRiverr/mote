import { currentMap, activeLayerId, bumpMapVersion } from '../../store/project';
import type { TileLayer } from '../../data/TileMap';

let nextLayerId = 2;

export function LayerPanel() {
  const map = currentMap.value;

  const addLayer = () => {
    const id = `layer_${nextLayerId++}`;
    const layer = {
      id,
      name: `Layer ${map.layers.length + 1}`,
      visible: true,
      opacity: 1,
      locked: false,
      data: new Array(map.width * map.height).fill(0),
    };
    currentMap.value = { ...map, layers: [...map.layers, layer as TileLayer] };
    activeLayerId.value = id;
    bumpMapVersion();
  };

  const toggleVisibility = (layerId: string) => {
    currentMap.value = {
      ...map,
      layers: map.layers.map((l) =>
        l.id === layerId ? { ...l, visible: !l.visible } : l
      ),
    };
    bumpMapVersion();
  };

  return (
    <div style={{
      width: 140,
      background: '#2a2a2a',
      borderLeft: '1px solid #1a1a1a',
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 6px',
        borderBottom: '1px solid #1a1a1a',
      }}>
        <span style={{ fontSize: 11, fontWeight: 600 }}>Layers</span>
        <button
          onClick={addLayer}
          style={{
            background: '#333',
            color: '#ccc',
            border: '1px solid #444',
            borderRadius: 3,
            fontSize: 11,
            cursor: 'pointer',
            padding: '0 6px',
          }}
        >+</button>
      </div>
      <div style={{ flex: 1, overflow: 'auto' }}>
        {[...map.layers].reverse().map((layer) => (
          <div
            key={layer.id}
            onClick={() => { activeLayerId.value = layer.id; }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '3px 6px',
              background: activeLayerId.value === layer.id ? '#3a3a4a' : 'transparent',
              cursor: 'pointer',
              fontSize: 11,
            }}
          >
            <span
              onClick={(e) => { e.stopPropagation(); toggleVisibility(layer.id); }}
              style={{ cursor: 'pointer', opacity: layer.visible ? 1 : 0.3, fontSize: 10 }}
            >
              👁
            </span>
            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {layer.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
