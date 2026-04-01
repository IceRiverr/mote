import { createContext } from 'preact';
import type { Signal } from '@preact/signals';
import type { 
  EditorBridge, 
  CommandHistory, 
  SelectionManager, 
  ProjectManager 
} from '../core/index.js';
import type { EditorTool, BottomTab, PlayState, GizmoMode } from '../types/editor.js';

/**
 * EditorStore - 编辑器全局状态
 * 
 * 包含核心模块实例和全局 UI 状态的 Signal
 */
export interface EditorStore {
  // 核心模块
  bridge: EditorBridge;
  history: CommandHistory;
  selection: SelectionManager;
  project: ProjectManager;

  // 全局 UI 状态（响应式）
  tool: Signal<EditorTool>;
  bottomTab: Signal<BottomTab>;
  isBottomPanelOpen: Signal<boolean>;
  showGrid: Signal<boolean>;
  zoom: Signal<number>;
  playState: Signal<PlayState>;
  gizmoMode: Signal<GizmoMode>;
}

/**
 * EditorContext - Preact Context
 * 
 * 通过 useContext(EditorContext) 在组件中访问编辑器状态
 */
export const EditorContext = createContext<EditorStore | null>(null);
