// ═══════════════════════════════════════════════════════════════
// NewProjectDialog.tsx — 新建项目弹窗
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect } from 'preact/hooks';
import { createNewProject } from '../project/projectStore';

interface Props {
  onClose: () => void;
  onCreated?: () => void;
}

export function NewProjectDialog({ onClose, onCreated }: Props) {
  const [name, setName] = useState('Untitled Project');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    const trimmed = name.trim();
    if (!trimmed) {
      setError('项目名称不能为空');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const project = await createNewProject(trimmed);
      if (project) {
        onCreated?.();
        onClose();
      } else {
        // 用户取消了目录选择，静默关闭
        onClose();
      }
    } catch (err: any) {
      console.error('Failed to create project:', err);
      setError(err.message || '创建项目失败');
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
            📝 新建项目
          </h2>
        </div>

        {/* Content */}
        <div style={{ padding: 20 }}>
          <p style={{ margin: '0 0 16px 0', fontSize: 13, color: '#aaa', lineHeight: 1.6 }}>
            输入项目名称后，将提示您选择保存目录。
          </p>

          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 600,
                color: '#aaa',
                marginBottom: 6,
                textTransform: 'uppercase',
              }}
            >
              项目名称
            </label>
            <input
              type="text"
              value={name}
              onInput={(e) => setName((e.target as HTMLInputElement).value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
              }}
              placeholder="例如：Snake Game"
              style={{
                width: '100%',
                padding: '8px 10px',
                fontSize: 13,
                background: '#1a1a1a',
                border: '1px solid #444',
                borderRadius: 4,
                color: '#fff',
                outline: 'none',
              }}
              autoFocus
            />
            <p style={{ margin: '6px 0 0 0', fontSize: 10, color: '#666' }}>
              项目文件将保存为 project.mote-project.json
            </p>
          </div>

          {error && (
            <div
              style={{
                padding: '10px',
                background: 'rgba(220, 60, 60, 0.15)',
                borderRadius: 4,
                fontSize: 12,
                color: '#e06060',
              }}
            >
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
            onClick={handleCreate}
            disabled={loading || !name.trim()}
            style={{
              padding: '8px 20px',
              fontSize: 13,
              fontWeight: 600,
              background: '#4a90d9',
              border: 'none',
              borderRadius: 4,
              color: '#fff',
              cursor: loading || !name.trim() ? 'not-allowed' : 'pointer',
              opacity: loading || !name.trim() ? 0.7 : 1,
            }}
          >
            {loading ? '创建中...' : '创建并选择目录'}
          </button>
        </div>
      </div>
    </div>
  );
}
