// ═══════════════════════════════════════════════════════════════
// StatusBar.tsx - 底部状态栏
// ═══════════════════════════════════════════════════════════════

import { projectName, hasUnsavedChanges, lastSavedAt } from '../project';
import { currentScene, selectedEntities, sceneVersion } from '../store/scene';
import { prefabs, prefabVersion } from '../store/prefabs';
import { hoverWorldPos } from '../store/viewport';
import { undo, redo, canUndo, canRedo, undoLabel, redoLabel } from '../store/history';
import { selectedAssetPaths, selectedFolderPath } from '../store/contentBrowser';

export function StatusBar() {
  // 格式化最后保存时间
  const formatLastSaved = (): string => {
    if (!lastSavedAt.value) return '';
    
    const diff = Date.now() - lastSavedAt.value;
    
    if (diff < 60000) return '刚刚保存';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前保存`;
    return '已保存';
  };

  return (
    <div
      style={{
        height: 24,
        background: '#2a2a2a',
        borderTop: '1px solid #111',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        fontSize: 12,
        color: '#888',
        userSelect: 'none',
      }}
    >
      {/* 左侧：项目状态 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span>{projectName.value}</span>
        {hasUnsavedChanges.value && (
          <span style={{ color: '#d99a4a' }}>未保存</span>
        )}
        {!hasUnsavedChanges.value && lastSavedAt.value && (
          <span>{formatLastSaved()}</span>
        )}
      </div>

      {/* 中间：场景信息 + 鼠标坐标 + 资源状态 */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 20 }}>
        {currentScene.value && (
          <>
            <span>
              场景: {currentScene.value.name}
            </span>
            <span>
              Entity: {currentScene.value.entities.length}
            </span>
            {selectedEntities.value.length > 0 && (
              <span style={{ color: '#4a90d9' }}>
                选中: {selectedEntities.value.length}
              </span>
            )}
            {/* 鼠标坐标 */}
            {hoverWorldPos.value && (
              <span style={{ color: '#aaa', fontFamily: 'monospace' }}>
                ({hoverWorldPos.value.x.toFixed(1)}, {hoverWorldPos.value.y.toFixed(1)})
                {(() => {
                  const scene = currentScene.value;
                  const pos = hoverWorldPos.value;
                  if (!scene || !pos) return null;
                  const gx = Math.floor(pos.x / scene.grid.size);
                  const gy = Math.floor(pos.y / scene.grid.size);
                  return ` [${gx},${gy}]`;
                })()}
              </span>
            )}
          </>
        )}
        {/* 资源选中状态 */}
        {selectedAssetPaths.value.length > 0 && (
          <span style={{ color: '#aaa', fontSize: 11 }}>
            📦 {selectedAssetPaths.value[0].split('/').pop()}
          </span>
        )}
      </div>

      {/* 右侧：Undo/Redo + 统计 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Undo */}
        <button
          onClick={() => undo()}
          disabled={!canUndo.value}
          title={canUndo.value ? `撤销: ${undoLabel.value}` : '无可撤销操作'}
          style={{
            background: 'transparent',
            border: '1px solid #444',
            borderRadius: 3,
            padding: '1px 5px',
            cursor: canUndo.value ? 'pointer' : 'default',
            color: canUndo.value ? '#ccc' : '#555',
            fontSize: 12,
            lineHeight: 1,
            opacity: canUndo.value ? 1 : 0.5,
          }}
        >
          ↶
        </button>
        {/* Redo */}
        <button
          onClick={() => redo()}
          disabled={!canRedo.value}
          title={canRedo.value ? `重做: ${redoLabel.value}` : '无可重做操作'}
          style={{
            background: 'transparent',
            border: '1px solid #444',
            borderRadius: 3,
            padding: '1px 5px',
            cursor: canRedo.value ? 'pointer' : 'default',
            color: canRedo.value ? '#ccc' : '#555',
            fontSize: 12,
            lineHeight: 1,
            opacity: canRedo.value ? 1 : 0.5,
          }}
        >
          ↷
        </button>

        <span>Prefab: {prefabs.value.size}</span>
        <span style={{ color: '#666' }}>Mote Editor v0.2.0</span>
      </div>
    </div>
  );
}
