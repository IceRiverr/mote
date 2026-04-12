// ═══════════════════════════════════════════════════════════════
// project/index.ts - 项目模块导出
// ═══════════════════════════════════════════════════════════════

// 类型定义
export type {
  Project,
  ProjectSettings,
  ProjectInfo,
} from './Project';

// 工具函数
export {
  createProject,
  validateProject,
  generateProjectId,
  touchProject,
  serializeProject,
  DEFAULT_PROJECT_NAME,
  PROJECT_FILE,
} from './Project';

// Store
export {
  // State
  currentProject,
  isProjectLoaded,
  isLoading,
  recentProjects,
  hasUnsavedChanges,
  lastSavedAt,
  // Computed
  projectName,
  projectSettings,
  canSave,
  // Actions
  createNewProject,
  openExistingProject,
  openProjectFromPath,
  saveCurrentProject,
  closeProject,
  updateProjectSettings,
  renameProject,
  setLastOpenedScene,
  addRecentPrefab,
  markAsUnsaved,
  // Recent projects
  loadRecentProjects,
  saveRecentProjects,
  removeFromRecentProjects,
  clearRecentProjects,
  // Init
  initializeProjectStore,
} from './projectStore';
