import { h } from 'preact';
import { render, screen, fireEvent } from '@testing-library/preact';
import { describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@preact/signals';
import { InspectorPanel } from '../ui/panels/InspectorPanel.js';
import { EditorContext, type EditorStore } from '../context/EditorContext.js';
import { MockEditorBridge, CommandHistory, SelectionManager, ProjectManager } from '../core/index.js';
import type { EditorTool, BottomTab, PlayState, GizmoMode } from '../types/editor.js';

function createTestStore(): EditorStore {
  const bridge = new MockEditorBridge();
  const history = new CommandHistory();
  const selection = new SelectionManager();
  const project = new ProjectManager();

  // 创建测试实体
  const id = bridge.createEntity('Player', {
    Position: { x: 10, y: 20 },
    Sprite: { texture: 'player.png' },
  });
  selection.select(id);

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

describe('InspectorPanel', () => {
  let store: EditorStore;

  beforeEach(() => {
    store = createTestStore();
  });

  it('应该显示标题', () => {
    renderWithContext(h(InspectorPanel, {}), store);
    expect(screen.getByText('Inspector')).toBeDefined();
  });

  it('未选中时应该显示提示', () => {
    store.selection.clear();
    renderWithContext(h(InspectorPanel, {}), store);
    expect(screen.getByText('Select an entity to edit')).toBeDefined();
  });

  it('应该显示选中的实体名称', () => {
    renderWithContext(h(InspectorPanel, {}), store);
    expect(screen.getByText(/Player/)).toBeDefined();
  });

  it('应该显示组件列表', () => {
    renderWithContext(h(InspectorPanel, {}), store);
    expect(screen.getByText('Position')).toBeDefined();
    expect(screen.getByText('Sprite')).toBeDefined();
  });

  it('应该显示组件字段', () => {
    renderWithContext(h(InspectorPanel, {}), store);
    expect(screen.getByDisplayValue('10')).toBeDefined();
    expect(screen.getByDisplayValue('20')).toBeDefined();
  });

  it('修改字段应该更新组件', () => {
    renderWithContext(h(InspectorPanel, {}), store);
    
    const xInput = screen.getByDisplayValue('10');
    fireEvent.change(xInput, { target: { value: '100' } });
    
    // 验证组件已更新
    const components = store.bridge.getComponents(1);
    expect(components.Position.x).toBe(100);
  });
});
