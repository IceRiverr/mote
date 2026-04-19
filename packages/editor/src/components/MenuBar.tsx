// ═══════════════════════════════════════════════════════════════
// MenuBar.tsx - 顶部菜单栏
// ═══════════════════════════════════════════════════════════════

import { useState, useRef, useEffect } from 'preact/hooks';
import {
  openExistingProject,
  saveCurrentProject,
  closeProject,
  createInMemoryProject,
  projectName,
  hasUnsavedChanges,
  canSave,
  isProjectLoaded,
} from '../project';
import { currentScene, newScene, saveScene, updateScene, selectedEntityIds, selectedEntities, clearSelection, snapEnabled, toggleSnap } from '../store/scene';
import { undo, redo, canUndo, canRedo, executeCommand } from '../store/history';
import { currentProject } from '../project/projectStore';
import { copyEntities, pasteEntities, hasClipboard } from '../store/clipboard';
import { showGrid } from '../store/selection';
import { getFileSystem } from '../fs/FileSystem';
import { RemoveEntityCommand } from '../commands';
import { exportScene } from '../data/export';
import { NewProjectDialog } from './NewProjectDialog';

export function MenuBar() {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showNewProjectDialog, setShowNewProjectDialog] = useState(false);
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
        { label: '撤销', action: handleUndo, shortcut: 'Ctrl+Z', disabled: !canUndo.value },
        { label: '重做', action: handleRedo, shortcut: 'Ctrl+Shift+Z', disabled: !canRedo.value },
        { type: 'separator' },
        { label: '复制', action: handleCopy, shortcut: 'Ctrl+C', disabled: selectedEntityIds.value.size === 0 },
        { label: '粘贴', action: handlePaste, shortcut: 'Ctrl+V', disabled: !hasClipboard() },
        { label: '删除', action: handleDelete, shortcut: 'Delete', disabled: selectedEntityIds.value.size === 0 },
      ],
    },
    view: {
      label: '视图',
      items: [
        { label: '网格', action: handleToggleGrid, shortcut: 'Ctrl+G', checkable: true, checked: showGrid.value },
        { label: '网格吸附', action: handleToggleSnap, shortcut: 'Ctrl+Shift+G', checkable: true, checked: snapEnabled.value },
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
    setShowNewProjectDialog(true);
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
    const project = currentProject.value ?? currentScene.value;
    if (!project) { setActiveMenu(null); return; }

    const defaultName = (currentProject.value?.name ?? currentScene.value?.name ?? 'untitled') + '_copy';
    const input = prompt('输入新项目名称:', defaultName);
    if (!input) { setActiveMenu(null); return; }

    const newName = input.trim();
    const fileName = `${newName}.mote-project.json`;
    const content = JSON.stringify(
      { ...currentProject.value, name: newName, projectFileName: fileName },
      null,
      2
    );

    const fs = getFileSystem();
    const success = await fs.writeFile(fileName, content);
    if (success) {
      alert(`已另存为 ${fileName}`);
    } else {
      alert('另存为失败，请检查目录权限');
    }
    setActiveMenu(null);
  }

  function handleUndo() {
    undo();
    setActiveMenu(null);
  }

  function handleRedo() {
    redo();
    setActiveMenu(null);
  }

  function handleCopy() {
    const entities = selectedEntities.value;
    if (entities.length > 0) {
      copyEntities(entities);
    }
    setActiveMenu(null);
  }

  function handlePaste() {
    pasteEntities();
    setActiveMenu(null);
  }

  function handleDelete() {
    const ids = Array.from(selectedEntityIds.value);
    if (ids.length === 0) { setActiveMenu(null); return; }

    // 逐个构造并执行删除命令（构造时实体仍在场景中，能正确捕获快照）
    for (const id of ids) {
      const cmd = new RemoveEntityCommand(id);
      executeCommand(cmd);
    }
    clearSelection();
    setActiveMenu(null);
  }

  function handleNewScene() {
    newScene();
    setActiveMenu(null);
  }

  async function handleExportScene() {
    if (!currentScene.value) return;

    const scene = currentScene.value;
    const defaultPath = scene.path || `${scene.id}.mote-scene.json`;
    const input = prompt('保存路径（相对于 assets/）:', defaultPath);
    if (!input) {
      setActiveMenu(null);
      return; // 用户取消
    }

    let path = input.trim();
    if (!path.endsWith('.mote-scene.json')) {
      path += '.mote-scene.json';
    }

    const success = await exportScene(scene, path);
    if (success) {
      // 更新 scene 的 path（如果是首次保存）
      if (scene.path !== path) {
        updateScene({ path });
      }
      // 刷新 Content Browser
      const { scanAssets } = await import('../store/contentBrowser');
      await scanAssets();
      console.log(`[Export] Scene saved to assets/${path}`);
    } else {
      alert('保存失败，请检查路径是否正确');
    }

    setActiveMenu(null);
  }

  async function handleCloseProject() {
    await closeProject();
    createInMemoryProject();
    setActiveMenu(null);
  }

  function handleToggleGrid() {
    showGrid.value = !showGrid.value;
    setActiveMenu(null);
  }

  function handleToggleSnap() {
    toggleSnap();
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
    <>
      <div
        ref={menuRef}
        style={{
          height: 28,
          background: '#2a2a2a',
          borderBottom: '1px solid #1a1a1a',
          display: 'flex',
          alignItems: 'center',
          padding: '0 10px',
          fontSize: 12,
          userSelect: 'none',
          flexShrink: 0,
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
              padding: '4px 10px',
              background: activeMenu === key ? '#4a90d9' : 'transparent',
              color: '#e0e0e0',
              border: 'none',
              borderRadius: 3,
              cursor: 'pointer',
              fontSize: 12,
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
                      padding: '6px 14px',
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
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {item.checkable && (
                        <span style={{ width: 14, display: 'inline-block', textAlign: 'center' }}>
                          {item.checked ? '✓' : ''}
                        </span>
                      )}
                      {!item.checkable && <span style={{ width: 14, display: 'inline-block' }} />}
                      {item.label}
                    </span>
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

    {showNewProjectDialog && (
      <NewProjectDialog
        onClose={() => setShowNewProjectDialog(false)}
        onCreated={() => setShowNewProjectDialog(false)}
      />
    )}
  </>
  );
}
