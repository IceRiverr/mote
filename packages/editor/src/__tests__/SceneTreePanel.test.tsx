import { h } from 'preact';
import { render, screen, fireEvent } from '@testing-library/preact';
import { describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@preact/signals';
import { SceneTreePanel } from '../ui/panels/SceneTreePanel.js';
import { EditorContext, type EditorStore } from '../context/EditorContext.js';
import { MockEditorBridge, CommandHistory, SelectionManager, ProjectManager } from '../core/index.js';
import type { EditorTool, BottomTab, PlayState, GizmoMode } from '../types/editor.js';

function createTestStore(): EditorStore {
  const bridge = new MockEditorBridge();
  const history = new CommandHistory();
  const selection = new SelectionManager();
  const project = new ProjectManager();

  // 创建测试实体
  bridge.createEntity('Root', { Position: { x: 0, y: 0 } });
  const childId = bridge.createEntity('Child');
  bridge.reparentEntity(childId, 1);

  return {
    bridge,
    history,
    selection,
    project,
    tool: signal('select' as EditorTool),
    bottomTab: signal('assets' as BottomTab),
    isBottomPanelOpen: signal(false),
    showGrid: signal(true),
    zoom: signal(1),
    playState: signal('stopped' as PlayState),
    gizmoMode: signal('translate' as GizmoMode),
  };
}

function renderWithContext(component: h.JSX.Element, store: EditorStore) {
  return render(
    h(EditorContext.Provider, { value: store }, component)
  );
}

describe('SceneTreePanel', () => {
  let store: EditorStore;

  beforeEach(() => {
    store = createTestStore();
  });

  it('应该显示标题', () => {
    renderWithContext(h(SceneTreePanel, {}), store);
    expect(screen.getByText('Hierarchy')).toBeDefined();
  });

  it('应该显示实体数量', () => {
    renderWithContext(h(SceneTreePanel, {}), store);
    expect(screen.getByText(/2 entities/)).toBeDefined();
  });

  it('应该渲染实体列表', () => {
    renderWithContext(h(SceneTreePanel, {}), store);
    expect(screen.getByText('Root')).toBeDefined();
  });

  it('点击实体应该选中', () => {
    renderWithContext(h(SceneTreePanel, {}), store);
    
    const rootNode = screen.getByText('Root');
    fireEvent.click(rootNode);

    expect(store.selection.selected.value).toContain(1);
  });

  it('应该显示组件数量', () => {
    renderWithContext(h(SceneTreePanel, {}), store);
    expect(screen.getByText('(1)')).toBeDefined();
  });

  it('空场景应该显示提示', () => {
    store.bridge.deleteEntity(1);
    store.bridge.deleteEntity(2);
    
    renderWithContext(h(SceneTreePanel, {}), store);
    expect(screen.getByText('No entities in scene')).toBeDefined();
  });

  it('应该支持过滤器', () => {
    renderWithContext(h(SceneTreePanel, { filter: 'Root' }), store);
    expect(screen.getByText('Root')).toBeDefined();
    expect(screen.queryByText('Child')).toBeNull();
  });
});
