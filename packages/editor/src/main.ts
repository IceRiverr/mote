// Mote Editor - New Architecture Entry Point

import { MockEditorBridge, type EditorBridge } from './core/EditorBridge.js';
import { CommandHistory } from './core/CommandHistory.js';
import { SelectionManager } from './core/SelectionManager.js';
import { ProjectManager } from './core/ProjectManager.js';

// Export core modules for external use
export {
  MockEditorBridge,
  CommandHistory,
  SelectionManager,
  ProjectManager,
};

// Export UI components
export * from './ui/index.js';

// Export hooks
export * from './hooks/useEditor.js';

// Export types
export type * from './types/editor.js';

// Export tools
export * from './tools/TilemapTool.js';
export * from './tools/BrushTool.js';
export * from './tools/EraserTool.js';
export * from './tools/RectTool.js';

// Export commands
export * from './commands/SetTileCommand.js';

// TODO: Initialize the new editor UI when ready
console.log('[Mote Editor] New architecture loaded');
