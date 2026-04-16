// ═══════════════════════════════════════════════════════════════
// OpenProjectDialog.tsx - 打开项目文件夹对话框
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect } from 'preact/hooks';
import { createNewProject, loadAndOpenProject, scanProjectsInDirectory } from '../project/projectStore';
import { getFileSystem } from '../fs/FileSystem';
import { resetPrefabFS } from '../fs/PrefabFS';

interface Props {
  onClose: () => void;
  onOpened?: (path: string) => void;
}

export function OpenProjectDialog({ onClose, onOpened }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<'select' | 'choose'>('select');
  const [projectFiles, setProjectFiles] = useState<string[]>([]);

  const handleSelectDirectory = async () => {
    setLoading(true);
    setError(null);

    try {
      const fs = getFileSystem();
      const success = await fs.openProject();

      if (!success) {
        console.log('User cancelled');
        setLoading(false);
        return;
      }

      // 重置 PrefabFS
      resetPrefabFS();

      const files = await scanProjectsInDirectory();

      if (files.length === 0) {
        // 未找到项目文件，保持在选择页面但显示创建选项
        setProjectFiles([]);
        setStep('choose');
      } else if (files.length === 1) {
        // 只有一个，直接打开
        await handleOpenProjectFile(files[0]);
      } else {
        // 多个，让用户选择
        setProjectFiles(files);
        setStep('choose');
      }
    } catch (err: any) {
      console.error('Failed to open project:', err);
      setError(err.message || '无法打开项目');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenProjectFile = async (fileName: string) => {
    setLoading(true);
    setError(null);

    try {
      const project = await loadAndOpenProject(fileName);
      if (project) {
        onOpened?.('/');
        onClose();
      } else {
        setError(`无法加载项目文件: ${fileName}`);
      }
    } catch (err: any) {
      console.error('Failed to load project:', err);
      setError(err.message || '无法加载项目');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateNewProject = async () => {
    setLoading(true);
    setError(null);

    try {
      const fs = getFileSystem();
      // 创建标准目录结构（仅 assets 和 src）
      await fs.createDirectory('assets');
      await fs.createDirectory('src');

      const project = await createNewProject();
      if (project) {
        onOpened?.('/');
        onClose();
      } else {
        setError('创建新项目失败');
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
            📂 选择项目文件夹
          </h2>
        </div>

        {/* Content */}
        <div style={{ padding: 20, minHeight: 220 }}>
          {step === 'select' && (
            <>
              <p style={{ margin: '0 0 20px 0', fontSize: 13, color: '#aaa', lineHeight: 1.6 }}>
                Mote 需要在一个文件夹中工作。选择文件夹后，编辑器会自动扫描该目录下的 <code style={{ color: '#4a90d9' }}>.mote-project.json</code> 项目文件。
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
                  <div>snake.mote-project.json</div>
                  <div>assets/</div>
                  <div>src/</div>
                </div>
              </div>
            </>
          )}

          {step === 'choose' && projectFiles.length === 0 && (
            <>
              <p style={{ margin: '0 0 16px 0', fontSize: 13, color: '#aaa' }}>
                未找到 <code>.mote-project.json</code> 项目文件。
              </p>
              <p style={{ margin: '0 0 20px 0', fontSize: 13, color: '#888' }}>
                您可以在此目录创建一个新项目。
              </p>
            </>
          )}

          {step === 'choose' && projectFiles.length > 0 && (
            <>
              <p style={{ margin: '0 0 12px 0', fontSize: 13, color: '#aaa' }}>
                请选择要打开的项目文件：
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {projectFiles.map((fileName) => (
                  <button
                    key={fileName}
                    onClick={() => handleOpenProjectFile(fileName)}
                    disabled={loading}
                    style={{
                      padding: '10px 14px',
                      background: '#1f1f1f',
                      border: '1px solid #333',
                      borderRadius: 4,
                      color: '#e0e0e0',
                      cursor: loading ? 'not-allowed' : 'pointer',
                      textAlign: 'left',
                      fontSize: 13,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <span style={{ fontSize: 16 }}>◈</span>
                    <span>{fileName}</span>
                  </button>
                ))}
              </div>
            </>
          )}

          {error && (
            <div style={{
              padding: '10px',
              background: 'rgba(220, 60, 60, 0.15)',
              borderRadius: 4,
              fontSize: 12,
              color: '#e06060',
              marginTop: 16
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
          {step === 'select' && (
            <button
              onClick={handleSelectDirectory}
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
          )}
          {step === 'choose' && projectFiles.length === 0 && (
            <button
              onClick={handleCreateNewProject}
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
              {loading ? '创建中...' : '创建新项目'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
