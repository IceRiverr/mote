// ═══════════════════════════════════════════════════════════════
// OpenProjectDialog.tsx - 打开项目文件夹对话框
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect } from 'preact/hooks';
import { createInMemoryProject, initializeSubsystems } from '../project/projectStore';
import { getFileSystem } from '../fs/FileSystem';
import { resetPrefabFS } from '../fs/PrefabFS';

interface Props {
  onClose: () => void;
  onOpened?: (path: string) => void;
}

export function OpenProjectDialog({ onClose, onOpened }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleOpenProject = async () => {
    setLoading(true);
    setError(null);

    try {
      const fs = getFileSystem();
      const success = await fs.openProject();
      
      if (!success) {
        console.log('User cancelled');
        onClose();
        return;
      }

      // 重置 PrefabFS，使其使用新的文件系统
      resetPrefabFS();

      // 创建必要的项目目录结构
      await fs.createDirectory('prefabs');
      await fs.createDirectory('prefabs/characters');
      await fs.createDirectory('prefabs/environment');
      await fs.createDirectory('prefabs/items');
      await fs.createDirectory('prefabs/effects');
      await fs.createDirectory('prefabs/ui');
      await fs.createDirectory('scenes');
      await fs.createDirectory('sprites');

      // 创建内存项目（不保存 project.json）
      createInMemoryProject();
      
      // 初始化子系统
      await initializeSubsystems();

      console.log('Project opened in memory mode');
      onOpened?.('/');
      onClose();

    } catch (err: any) {
      console.error('Failed to open project:', err);
      setError(err.message || '无法打开项目');
    } finally {
      setLoading(false);
    }
  };

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: 420,
          background: '#2a2a2a',
          borderRadius: 8,
          border: '1px solid #444',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #444',
          }}
        >
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: '#fff' }}>
            📂 选择项目文件夹
          </h2>
        </div>

        {/* Content */}
        <div style={{ padding: 20 }}>
          <p style={{ margin: '0 0 20px 0', fontSize: 13, color: '#aaa', lineHeight: 1.6 }}>
            Mote 需要在一个文件夹中工作。选择后将自动创建以下目录结构：
          </p>

          <div style={{
            background: '#1a1a1a',
            borderRadius: 4,
            padding: '12px',
            fontFamily: 'monospace',
            fontSize: 11,
            color: '#888',
            marginBottom: 20,
            border: '1px solid #333'
          }}>
            <div style={{ color: '#4a90d9' }}>project/</div>
            <div style={{ paddingLeft: 16 }}>
              <div>prefabs/</div>
              <div style={{ paddingLeft: 16 }}>
                <div>characters/</div>
                <div>environment/</div>
                <div>items/</div>
              </div>
              <div>scenes/</div>
              <div>sprites/</div>
            </div>
          </div>

          {error && (
            <div style={{
              padding: '10px',
              background: 'rgba(220, 60, 60, 0.15)',
              borderRadius: 4,
              fontSize: 12,
              color: '#e06060',
              marginBottom: 16
            }}>
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid #444',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 10,
          }}
        >
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              background: 'transparent',
              border: '1px solid #444',
              borderRadius: 4,
              color: '#aaa',
              cursor: 'pointer',
            }}
          >
            取消
          </button>
          <button
            onClick={handleOpenProject}
            disabled={loading}
            style={{
              padding: '8px 20px',
              fontSize: 13,
              fontWeight: 600,
              background: '#4a90d9',
              border: 'none',
              borderRadius: 4,
              color: '#fff',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
            }}
          >
            {loading ? '打开中...' : '选择文件夹'}
          </button>
        </div>
      </div>
    </div>
  );
}
