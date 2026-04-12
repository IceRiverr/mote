// ═══════════════════════════════════════════════════════════════
// MenuBar.tsx - 顶部菜单栏
// ═══════════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from 'preact/hooks';
import {
  createNewProject,
  openExistingProject,
  saveCurrentProject,
  closeProject,
  projectName,
  hasUnsavedChanges,
  canSave,
  isProjectLoaded,
} from '../project';
import { currentScene, newScene, saveScene } from '../store/scene';
import { exportScene } from '../data/export';

interface MenuBarProps {
  onRequestWelcome?: () => void;
}

export function MenuBar({ onRequestWelcome }: MenuBarProps) {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭菜单
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setActiveMenu(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 菜单项定义
  const menus = {
    file: {
      label: '文件',
      items: [
        { label: '新建项目', action: handleNewProject, shortcut: 'Ctrl+Shift+N' },
        { label: '打开项目', action: handleOpenProject, shortcut: 'Ctrl+Shift+O' },
        { type: 'separator' },
        { label: '保存', action: handleSave, shortcut: 'Ctrl+S', disabled: !canSave.value },
        { label: '另存为...', action: handleSaveAs, disabled: !isProjectLoaded.value },
        { type: 'separator' },
        { label: '新建场景', action: handleNewScene, shortcut: 'Ctrl+N' },
        { label: '导出场景', action: handleExportScene, disabled: !currentScene.value },
        { type: 'separator' },
        { label: '关闭项目', action: handleCloseProject, disabled: !isProjectLoaded.value },
      ],
    },
    edit: {
      label: '编辑',
      items: [
        { label: '撤销', action: () => console.log('Undo'), shortcut: 'Ctrl+Z' },
        { label: '重做', action: () => console.log('Redo'), shortcut: 'Ctrl+Shift+Z' },
        { type: 'separator' },
        { label: '复制', action: () => console.log('Copy'), shortcut: 'Ctrl+C' },
        { label: '粘贴', action: () => console.log('Paste'), shortcut: 'Ctrl+V' },
        { label: '删除', action: () => console.log('Delete'), shortcut: 'Delete' },
      ],
    },
    view: {
      label: '视图',
      items: [
        { label: '网格', action: () => console.log('Toggle Grid'), shortcut: 'Ctrl+G', checkable: true },
        { label: '网格吸附', action: () => console.log('Toggle Snap'), shortcut: 'Ctrl+Shift+G', checkable: true },
        { type: 'separator' },
        { label: '全屏', action: toggleFullscreen, shortcut: 'F11' },
      ],
    },
    help: {
      label: '帮助',
      items: [
        { label: '快捷键', action: () => console.log('Shortcuts') },
        { label: '文档', action: () => window.open('https://github.com/limbowang/mote', '_blank') },
        { type: 'separator' },
        { label: '关于', action: () => alert('Mote Editor v0.2.0') },
      ],
    },
  };

  // 事件处理
  async function handleNewProject() {
    const confirmed = confirm('创建新项目会关闭当前项目。是否继续？');
    if (!confirmed) return;

    await closeProject();
    onRequestWelcome?.();
    setActiveMenu(null);
  }

  async function handleOpenProject() {
    await openExistingProject();
    setActiveMenu(null);
  }

  async function handleSave() {
    await saveCurrentProject();
    setActiveMenu(null);
  }

  async function handleSaveAs() {
    // TODO: 实现另存为
    console.log('Save As...');
    setActiveMenu(null);
  }

  function handleNewScene() {
    newScene(640, 480);
    setActiveMenu(null);
  }

  async function handleExportScene() {
    if (!currentScene.value) return;
    
    const data = exportScene(currentScene.value);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentScene.value.id}.json`;
    a.click();
    
    URL.revokeObjectURL(url);
    setActiveMenu(null);
  }

  async function handleCloseProject() {
    await closeProject();
    onRequestWelcome?.();
    setActiveMenu(null);
  }

  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen();
    }
    setActiveMenu(null);
  }

  return (
    <div
      ref={menuRef}
      style={{
        height: 32,
        background: '#2a2a2a',
        borderBottom: '1px solid #111',
        display: 'flex',
        alignItems: 'center',
        padding: '0 12px',
        fontSize: 13,
        userSelect: 'none',
      }}
    >
      {/* Logo */}
      <div
        style={{
          fontWeight: 700,
          color: '#4a90d9',
          marginRight: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span>Mote</span>
        {isProjectLoaded.value && (
          <span style={{ color: '#666', fontWeight: 400 }}>
            - {projectName.value}
            {hasUnsavedChanges.value && ' *'}
          </span>
        )}
      </div>

      {/* 菜单 */}
      {Object.entries(menus).map(([key, menu]) => (
        <div key={key} style={{ position: 'relative' }}>
          <button
            onClick={() => setActiveMenu(activeMenu === key ? null : key)}
            style={{
              padding: '6px 12px',
              background: activeMenu === key ? '#4a90d9' : 'transparent',
              color: '#e0e0e0',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            {menu.label}
          </button>

          {/* 下拉菜单 */}
          {activeMenu === key && (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                minWidth: 200,
                background: '#333',
                border: '1px solid #444',
                borderRadius: 4,
                marginTop: 4,
                zIndex: 1000,
                boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
              }}
            >
              {menu.items.map((item: any, index: number) => (
                item.type === 'separator' ? (
                  <div
                    key={index}
                    style={{
                      height: 1,
                      background: '#444',
                      margin: '4px 0',
                    }}
                  />
                ) : (
                  <button
                    key={index}
                    onClick={() => {
                      if (!item.disabled && item.action) {
                        item.action();
                      }
                    }}
                    disabled={item.disabled}
                    style={{
                      width: '100%',
                      padding: '8px 16px',
                      background: 'transparent',
                      color: item.disabled ? '#666' : '#e0e0e0',
                      border: 'none',
                      textAlign: 'left',
                      cursor: item.disabled ? 'not-allowed' : 'pointer',
                      fontSize: 13,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      opacity: item.disabled ? 0.5 : 1,
                    }}
                  >
                    <span>{item.label}</span>
                    {item.shortcut && (
                      <span style={{ color: '#666', fontSize: 11 }}>
                        {item.shortcut}
                      </span>
                    )}
                  </button>
                )
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
