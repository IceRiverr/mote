import { describe, it, expect, beforeEach } from 'vitest';
import { h } from 'preact';
import { renderHook } from '@testing-library/preact';
import { signal } from '@preact/signals';
import { EditorContext, type EditorStore } from '../context/EditorContext.js';
import { 
  useEditor, 
  useSelection, 
  useCommandHistory, 
  usePlayState 
} from '../hooks/useEditor.js';
import { 
  MockEditorBridge, 
  CommandHistory, 
  SelectionManager, 
  ProjectManager 
} from '../core/index.js';
import type { EditorTool, BottomTab, PlayState, GizmoMode } from '../types/editor.js';

// 辅助函数：创建测试用的 EditorStore
function createTestStore(): EditorStore {
  const bridge = new MockEditorBridge();
  const history = new CommandHistory();
  const selection = new SelectionManager();
  const project = new ProjectManager();

  const playState = signal('stopped' as PlayState);
  
  // 同步 bridge 的 play state 到 signal
  bridge.on('play-state-changed', (state) => {
    playState.value = state as PlayState;
  });

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
    playState,
    gizmoMode: signal('translate' as GizmoMode),
  };
}

// 辅助函数：包装 Provider
function createWrapper(store: EditorStore) {
  return function Wrapper({ children }: { children: any }) {
    return h(EditorContext.Provider, { value: store }, children);
  };
}

describe('useEditor', () => {
  it('应该在 Provider 内返回 store', () => {
    const store = createTestStore();
    const wrapper = createWrapper(store);
    
    const { result } = renderHook(() => useEditor(), { wrapper });
    
    expect(result.current).toBe(store);
  });

  it('在 Provider 外应该抛出错误', () => {
    expect(() => {
      renderHook(() => useEditor());
    }).toThrow('useEditor must be used within an EditorProvider');
  });
});

describe('useSelection', () => {
  let store: EditorStore;
  let wrapper: ({ children }: { children: any }) => h.JSX.Element;

  beforeEach(() => {
    store = createTestStore();
    wrapper = createWrapper(store);
  });

  it('应该返回选中状态', () => {
    const { result } = renderHook(() => useSelection(), { wrapper });
    
    expect(result.current.selected.value).toEqual([]);
    expect(result.current.primary).toBeNull();
  });

  it('应该可以选中实体', () => {
    const { result } = renderHook(() => useSelection(), { wrapper });
    
    result.current.select(1);
    
    expect(store.selection.selected.value).toEqual([1]);
  });

  it('应该可以切换选中', () => {
    const { result } = renderHook(() => useSelection(), { wrapper });
    
    result.current.toggleSelect(1);
    expect(result.current.isSelected(1)).toBe(true);
    
    result.current.toggleSelect(1);
    expect(result.current.isSelected(1)).toBe(false);
  });

  it('应该可以清空选中', () => {
    const { result } = renderHook(() => useSelection(), { wrapper });
    
    result.current.select(1);
    result.current.clear();
    
    expect(store.selection.selected.value).toEqual([]);
  });
});

describe('useCommandHistory', () => {
  let store: EditorStore;
  let wrapper: ({ children }: { children: any }) => h.JSX.Element;

  beforeEach(() => {
    store = createTestStore();
    wrapper = createWrapper(store);
  });

  it('应该返回历史状态', () => {
    const { result } = renderHook(() => useCommandHistory(), { wrapper });
    
    expect(result.current.canUndo()).toBe(false);
    expect(result.current.canRedo()).toBe(false);
  });

  it('undo/redo 应该工作', () => {
    const { result } = renderHook(() => useCommandHistory(), { wrapper });
    
    // 先执行一个命令
    store.history.execute({
      description: 'Test',
      execute: () => {},
      undo: () => {},
    });
    
    expect(result.current.canUndo()).toBe(true);
    
    result.current.undo();
    expect(result.current.canUndo()).toBe(false);
    expect(result.current.canRedo()).toBe(true);
    
    result.current.redo();
    expect(result.current.canRedo()).toBe(false);
  });
});

describe('usePlayState', () => {
  let store: EditorStore;
  let wrapper: ({ children }: { children: any }) => h.JSX.Element;

  beforeEach(() => {
    store = createTestStore();
    wrapper = createWrapper(store);
  });

  it('应该返回初始状态', () => {
    const { result } = renderHook(() => usePlayState(), { wrapper });
    
    expect(result.current.state.value).toBe('stopped');
    expect(result.current.isStopped()).toBe(true);
    expect(result.current.isPlaying()).toBe(false);
    expect(result.current.isPaused()).toBe(false);
  });

  it('play 应该改变状态', () => {
    const { result } = renderHook(() => usePlayState(), { wrapper });
    
    result.current.play();
    
    expect(store.playState.value).toBe('playing');
    expect(result.current.isPlaying()).toBe(true);
  });

  it('pause 应该改变状态', () => {
    const { result } = renderHook(() => usePlayState(), { wrapper });
    
    result.current.play();
    result.current.pause();
    
    expect(store.playState.value).toBe('paused');
    expect(result.current.isPaused()).toBe(true);
  });

  it('stop 应该回到 stopped', () => {
    const { result } = renderHook(() => usePlayState(), { wrapper });
    
    result.current.play();
    result.current.stop();
    
    expect(store.playState.value).toBe('stopped');
  });
});
