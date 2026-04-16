// ═══════════════════════════════════════════════════════════════
// OpenProjectDialog.tsx - 打开项目文件夹对话框
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect } from 'preact/hooks';
import { createNewProject, openExistingProject } from '../project/projectStore';

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
      const project = await openExistingProject();
      if (project) {
        onOpened?.('/');
        onClose();
      } else {
        // 用户取消或未找到项目文件，静默关闭
        onClose();
      }
    } catch (err: any) {
      console.error('Failed to open project:', err);
      setError(err.message || '无法打开项目');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewProject = async () => {
    setLoading(true);
    setError(null);

    try {
      const project = await createNewProject();
      if (project) {
        onOpened?.('/');
        onClose();
      } else {
        // 用户取消，静默关闭
        onClose();
      }
    } catch (err: any) {
      console.error('Failed to create project:', err);
      setError(err.message || '创建新项目失败');
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
            📂 打开项目
          </h2>
        </div>

        {/* Content */}
        <div style={{ padding: 20, minHeight: 160 }}>
          <p style={{ margin: '0 0 20px 0', fontSize: 13, color: '#aaa', lineHeight: 1.6 }}>
            每个文件夹对应一个 Mote 项目。选择包含 <code style={{ color: '#4a90d9' }}>project.mote-project.json</code> 的目录。
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
            <div style={{ color: '#4a90d9' }}>my-project/</div>
            <div style={{ paddingLeft: 16 }}>
              <div>project.mote-project.json</div>
              <div>assets/</div>
              <div>src/</div>
            </div>
          </div>

          {error && (
            <div style={{
              padding: '10px',
              background: 'rgba(220, 60, 60, 0.15)',
              borderRadius: 4,
              fontSize: 12,
              color: '#e06060',
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
            onClick={handleCreateNewProject}
            disabled={loading}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              fontWeight: 600,
              background: 'transparent',
              border: '1px solid #4a90d9',
              borderRadius: 4,
              color: '#4a90d9',
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            新建项目
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
