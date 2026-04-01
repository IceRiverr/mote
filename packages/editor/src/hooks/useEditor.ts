import { useContext } from 'preact/hooks';
import { EditorContext, type EditorStore } from '../context/EditorContext.js';

/**
 * useEditor - 获取编辑器全局状态的 Hook
 * 
 * 必须在 EditorContext.Provider 内部使用
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { bridge, selection } = useEditor();
 *   // ...
 * }
 * ```
 */
export function useEditor(): EditorStore {
  const context = useContext(EditorContext);
  if (!context) {
    throw new Error('useEditor must be used within an EditorProvider');
  }
  return context;
}

/**
 * useSelection - 获取选中状态的便捷 Hook
 * 
 * @example
 * ```tsx
 * function Inspector() {
 *   const { selected, primary } = useSelection();
 *   // ...
 * }
 * ```
 */
export function useSelection() {
  const { selection } = useEditor();
  return {
    selected: selection.selected,
    primary: selection.primary,
    isSelected: selection.isSelected.bind(selection),
    select: selection.select.bind(selection),
    toggleSelect: selection.toggleSelect.bind(selection),
    clear: selection.clear.bind(selection),
  };
}

/**
 * useCommandHistory - 获取命令历史的便捷 Hook
 * 
 * @example
 * ```tsx
 * function Toolbar() {
 *   const { canUndo, canRedo, undo, redo } = useCommandHistory();
 *   // ...
 * }
 * ```
 */
export function useCommandHistory() {
  const { history } = useEditor();
  return {
    canUndo: history.canUndo.bind(history),
    canRedo: history.canRedo.bind(history),
    undo: history.undo.bind(history),
    redo: history.redo.bind(history),
  };
}

/**
 * usePlayState - 获取运行状态的便捷 Hook
 * 
 * @example
 * ```tsx
 * function PlayButton() {
 *   const { playState, play, pause, stop } = usePlayState();
 *   // ...
 * }
 * ```
 */
export function usePlayState() {
  const { bridge, playState } = useEditor();
  return {
    state: playState,
    play: bridge.play.bind(bridge),
    pause: bridge.pause.bind(bridge),
    stop: bridge.stop.bind(bridge),
    isPlaying: () => playState.value === 'playing',
    isPaused: () => playState.value === 'paused',
    isStopped: () => playState.value === 'stopped',
  };
}
