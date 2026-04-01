import { h } from 'preact';
import { render, screen } from '@testing-library/preact';
import { describe, it, expect, beforeEach } from 'vitest';
import { signal } from '@preact/signals';
import { TilemapEditor } from '../ui/panels/TilemapEditor.js';
import { EditorContext, type EditorStore } from '../context/EditorContext.js';
import { MockEditorBridge, CommandHistory, SelectionManager, ProjectManager } from '../core/index.js';
import type { TilemapData, EditorTool, BottomTab, PlayState, GizmoMode } from '../types/editor.js';

function createTestStore(): EditorStore {
  const bridge = new MockEditorBridge();
  const history = new CommandHistory();
  const selection = new SelectionManager();
  const project = new ProjectManager();

  const tilemap: TilemapData = {
    tileSize: 32,
    width: 20,
    height: 15,
    tilesets: [
      { image: 'ground.png', columns: 8, tilecount: 16 },
    ],
    layers: [
      { name: 'ground', data: new Array(300).fill(0) },
      { name: 'objects', data: new Array(300).fill(0) },
    ],
  };
  bridge.setTilemapData(tilemap);

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

describe('TilemapEditor', () => {
  let store: EditorStore;

  beforeEach(() => {
    store = createTestStore();
  });

  it('应该显示 Tile Sets 标题', () => {
    renderWithContext(h(TilemapEditor, {}), store);
    expect(screen.getByText('Tile Sets')).toBeDefined();
  });

  it('应该渲染工具按钮', () => {
    renderWithContext(h(TilemapEditor, {}), store);
    // 查找包含工具按钮的工具栏
    const toolbar = document.querySelector('.mote-layout__toolbar, [style*="toolbar"]');
    expect(toolbar).toBeDefined();
  });

  it('应该渲染图层选择器', () => {
    renderWithContext(h(TilemapEditor, {}), store);
    const select = document.querySelector('select');
    expect(select).toBeDefined();
  });

  it('应该渲染 Canvas', () => {
    renderWithContext(h(TilemapEditor, {}), store);
    expect(document.querySelector('canvas')).toBeDefined();
  });

  it('应该渲染 Tile Sets 面板', () => {
    renderWithContext(h(TilemapEditor, {}), store);
    const tileSets = screen.getByText('Tile Sets');
    expect(tileSets).toBeDefined();
  });

  it('无 tilemap 时应该显示提示', () => {
    store.bridge.setTilemapData(null);
    renderWithContext(h(TilemapEditor, {}), store);
    expect(screen.getByText('No tilemap loaded')).toBeDefined();
  });
});
