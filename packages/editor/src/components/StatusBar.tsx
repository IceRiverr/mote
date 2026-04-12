// ═══════════════════════════════════════════════════════════════
// StatusBar.tsx - 底部状态栏
// ═══════════════════════════════════════════════════════════════

import { projectName, hasUnsavedChanges, lastSavedAt } from '../project';
import { currentScene, selectedEntities, sceneVersion } from '../store/scene';
import { prefabs, prefabVersion } from '../store/prefabs';

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

      {/* 中间：场景信息 */}
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 24 }}>
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
          </>
        )}
      </div>

      {/* 右侧：统计 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <span>Prefab: {prefabs.value.size}</span>
        <span style={{ color: '#666' }}>Mote Editor v0.2.0</span>
      </div>
    </div>
  );
}
