// ═══════════════════════════════════════════════════════════════
// WelcomeScreen.tsx - 欢迎页面
// 新用户首次打开或关闭项目时显示
// ═══════════════════════════════════════════════════════════════

import { useState, useEffect } from 'preact/hooks';
import {
  createNewProject,
  openExistingProject,
  recentProjects,
  removeFromRecentProjects,
  clearRecentProjects,
  loadRecentProjects,
} from '../project';

interface WelcomeScreenProps {
  onProjectOpened?: () => void;
}

export function WelcomeScreen({ onProjectOpened }: WelcomeScreenProps) {
  const [newProjectName, setNewProjectName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [isOpening, setIsOpening] = useState(false);

  // 加载最近项目
  useEffect(() => {
    loadRecentProjects();
  }, []);

  // 创建新项目
  const handleCreateProject = async () => {
    const name = newProjectName.trim() || 'My Project';
    setIsCreating(true);
    
    const project = await createNewProject(name);
    
    setIsCreating(false);
    if (project) {
      onProjectOpened?.();
    }
  };

  // 打开现有项目
  const handleOpenProject = async () => {
    setIsOpening(true);
    
    const project = await openExistingProject();
    
    setIsOpening(false);
    if (project) {
      onProjectOpened?.();
    }
  };

  // 打开最近项目
  const handleOpenRecent = async (projectId: string) => {
    // TODO: 实现从路径打开
    console.log('Open recent project:', projectId);
  };

  // 删除最近项目记录
  const handleRemoveRecent = (e: Event, projectId: string) => {
    e.stopPropagation();
    removeFromRecentProjects(projectId);
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        background: '#1a1a1a',
        color: '#e0e0e0',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* 左侧：新建项目 */}
      <div
        style={{
          flex: 1,
          padding: 48,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          borderRight: '1px solid #333',
        }}
      >
        <h1
          style={{
            fontSize: 32,
            fontWeight: 700,
            margin: '0 0 8px 0',
            color: '#fff',
          }}
        >
          Mote Editor
        </h1>
        <p
          style={{
            fontSize: 14,
            color: '#888',
            margin: '0 0 48px 0',
          }}
        >
          轻量级 ECS 游戏编辑器
        </p>

        <div style={{ marginBottom: 32 }}>
          <label
            style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              color: '#888',
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            新建项目
          </label>
          <div style={{ display: 'flex', gap: 12 }}>
            <input
              type="text"
              value={newProjectName}
              onInput={(e) => setNewProjectName((e.target as HTMLInputElement).value)}
              placeholder="项目名称"
              onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
              style={{
                flex: 1,
                padding: '12px 16px',
                fontSize: 14,
                background: '#2a2a2a',
                border: '1px solid #444',
                borderRadius: 6,
                color: '#fff',
                outline: 'none',
              }}
            />
            <button
              onClick={handleCreateProject}
              disabled={isCreating}
              style={{
                padding: '12px 24px',
                fontSize: 14,
                fontWeight: 600,
                background: '#4a90d9',
                color: '#fff',
                border: 'none',
                borderRadius: 6,
                cursor: isCreating ? 'wait' : 'pointer',
                opacity: isCreating ? 0.7 : 1,
              }}
            >
              {isCreating ? '创建中...' : '创建'}
            </button>
          </div>
        </div>

        <div>
          <label
            style={{
              display: 'block',
              fontSize: 12,
              fontWeight: 600,
              color: '#888',
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            打开项目
          </label>
          <button
            onClick={handleOpenProject}
            disabled={isOpening}
            style={{
              width: '100%',
              padding: '12px 24px',
              fontSize: 14,
              fontWeight: 600,
              background: '#2a2a2a',
              color: '#fff',
              border: '1px solid #444',
              borderRadius: 6,
              cursor: isOpening ? 'wait' : 'pointer',
              opacity: isOpening ? 0.7 : 1,
            }}
          >
            {isOpening ? '打开中...' : '选择项目文件夹...'}
          </button>
        </div>
      </div>

      {/* 右侧：最近项目 */}
      <div
        style={{
          width: 360,
          padding: 48,
          background: '#222',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 24,
          }}
        >
          <h2
            style={{
              fontSize: 14,
              fontWeight: 600,
              color: '#888',
              margin: 0,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            最近打开
          </h2>
          {recentProjects.value.length > 0 && (
            <button
              onClick={clearRecentProjects}
              style={{
                fontSize: 12,
                color: '#666',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              清空
            </button>
          )}
        </div>

        {recentProjects.value.length === 0 ? (
          <div
            style={{
              padding: 48,
              textAlign: 'center',
              color: '#666',
              fontSize: 14,
            }}
          >
            暂无最近项目
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {recentProjects.value.map((project) => (
              <div
                key={project.id}
                onClick={() => handleOpenRecent(project.id)}
                style={{
                  padding: 16,
                  background: '#2a2a2a',
                  borderRadius: 8,
                  cursor: 'pointer',
                  position: 'relative',
                }}
              >
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 600,
                    color: '#fff',
                    marginBottom: 4,
                  }}
                >
                  {project.name}
                </div>
                <div
                  style={{
                    fontSize: 12,
                    color: '#666',
                  }}
                >
                  {formatDate(project.lastOpened)}
                </div>
                <button
                  onClick={(e) => handleRemoveRecent(e, project.id)}
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    width: 24,
                    height: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'none',
                    border: 'none',
                    color: '#666',
                    cursor: 'pointer',
                    fontSize: 16,
                    borderRadius: 4,
                  }}
                  title="移除"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// 格式化日期
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  
  // 小于 1 小时
  if (diff < 60 * 60 * 1000) {
    const minutes = Math.floor(diff / (60 * 1000));
    return minutes < 1 ? '刚刚' : `${minutes} 分钟前`;
  }
  
  // 小于 24 小时
  if (diff < 24 * 60 * 60 * 1000) {
    const hours = Math.floor(diff / (60 * 60 * 1000));
    return `${hours} 小时前`;
  }
  
  // 其他
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
  });
}
