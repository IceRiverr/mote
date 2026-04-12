// ═══════════════════════════════════════════════════════════════
// ExportPanel.tsx — Simplified for new architecture
// ═══════════════════════════════════════════════════════════════

import { exportScene, exportPrefab } from '../../../data/export';
import { currentScene } from '../../../store/scene';
import { prefabs } from '../../../store/prefabs';

export function ExportPanel() {
  const scene = currentScene.value;
  
  return (
    <div style={{ padding: 12 }}>
      <h4 style={{ margin: '0 0 12px', fontSize: 13 }}>Export</h4>
      
      {scene && (
        <button
          onClick={() => exportScene(scene)}
          style={{
            width: '100%',
            padding: '8px',
            marginBottom: '8px',
            background: '#2a2a2a',
            border: '1px solid #444',
            borderRadius: 4,
            color: '#fff',
            fontSize: 12,
            cursor: 'pointer',
          }}
        >
          Export Current Scene
        </button>
      )}
      
      <button
        onClick={() => {
          // Export all prefabs
          const allPrefabs = Array.from(prefabs.value.values());
          allPrefabs.forEach(prefab => exportPrefab(prefab));
        }}
        style={{
          width: '100%',
          padding: '8px',
          background: '#2a2a2a',
          border: '1px solid #444',
          borderRadius: 4,
          color: '#fff',
          fontSize: 12,
          cursor: 'pointer',
        }}
      >
        Export All Prefabs
      </button>
    </div>
  );
}
