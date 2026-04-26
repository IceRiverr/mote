// ═══════════════════════════════════════════════════════════════
// ExportPanel.tsx — 导出到项目目录（类似 Prefab 保存流程）
// ═══════════════════════════════════════════════════════════════

import { exportScene, exportSceneAsDownload, exportPrefab } from '../../../data/export';
import { currentScene, updateScene } from '../../../store/scene';
import { prefabs } from '../../../store/prefabs';

export function ExportPanel() {
  const scene = currentScene.value;

  const handleExportScene = async () => {
    if (!scene) return;

    const defaultPath = scene.path || `${scene.id}.mote-scene.json`;
    const input = prompt('保存路径（相对于 assets/）:', defaultPath);
    if (!input) return;

    let path = input.trim();
    if (!path.endsWith('.mote-scene.json')) {
      path += '.mote-scene.json';
    }

    const success = await exportScene(scene, path);
    if (success) {
      if (scene.path !== path) {
        updateScene({ path });
      }
      const { scanAssets } = await import('../../../store/contentBrowser');
      await scanAssets();
      console.log(`[Export] Scene saved to assets/${path}`);
    } else {
      alert('保存失败，请检查路径是否正确');
    }
  };

  return (
    <div style={{ padding: 12 }}>
      <h4 style={{ margin: '0 0 12px', fontSize: 13 }}>Export</h4>

      {scene && (
        <>
          <button
            onClick={handleExportScene}
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
            💾 保存场景到 assets
          </button>
          <button
            onClick={() => exportSceneAsDownload(scene)}
            style={{
              width: '100%',
              padding: '8px',
              marginBottom: '8px',
              background: '#2a2a2a',
              border: '1px solid #444',
              borderRadius: 4,
              color: '#999',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            ⬇️ 下载场景文件
          </button>
        </>
      )}

      <button
        onClick={() => {
          for (const [prefabId, prefab] of prefabs.value) {
            exportPrefab(prefab, prefabId);
          }
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
