// ═══════════════════════════════════════════════════════════════
// projectStore.ts - 项目状态管理
// ═══════════════════════════════════════════════════════════════

import { signal, computed, type ReadonlySignal } from '@preact/signals';
import type { Project, ProjectInfo, ProjectSettings } from './Project';
import { createProject, validateProject, touchProject, generateProjectId, DEFAULT_PROJECT_NAME, PROJECT_FILE } from './Project';
import { getFileSystem } from '../fs/FileSystem';
import { getPrefabFS } from '../fs/PrefabFS';
import { getSceneFS } from '../fs/SceneFS';
import { newScene } from '../store/scene';

// ═══════════════════════════════════════════════════════════════
// 状态
// ═══════════════════════════════════════════════════════════════

/** 当前项目 */
export const currentProject = signal<Project | null>(null);

/** 项目是否已加载 */
export const isProjectLoaded = signal(false);

/** 是否正在加载 */
export const isLoading = signal(false);

/** 最近打开的项目列表 */
export const recentProjects = signal<ProjectInfo[]>([]);

/** 未保存的更改 */
export const hasUnsavedChanges = signal(false);

/** 最后保存时间 */
export const lastSavedAt = signal<number | null>(null);

// ═══════════════════════════════════════════════════════════════
// 计算属性
// ═══════════════════════════════════════════════════════════════

/** 项目名称 */
export const projectName = computed(() => currentProject.value?.name ?? 'No Project');

/** 项目设置 */
export const projectSettings = computed(() => currentProject.value?.settings);

/** 是否可以保存 */
export const canSave = computed(() => isProjectLoaded.value && hasUnsavedChanges.value);

// ═══════════════════════════════════════════════════════════════
// 项目生命周期
// ═══════════════════════════════════════════════════════════════

/**
 * 创建新项目
 */
export async function createNewProject(
  name: string = DEFAULT_PROJECT_NAME,
  settings?: Partial<ProjectSettings>
): Promise<Project | null> {
  try {
    isLoading.value = true;

    const fs = getFileSystem();
    
    // 选择项目目录
    const success = await fs.openProject();
    if (!success) {
      console.log('User cancelled project creation');
      return null;
    }

    // 生成项目
    const id = generateProjectId(name);
    const project = createProject(id, name, settings);

    // 创建标准目录结构（仅 assets 和 src）
    await fs.createDirectory('assets');
    await fs.createDirectory('src');

    // 保存项目文件
    await saveProjectFile(project);

    // 初始化子系统
    await initializeSubsystems();

    // 设置当前项目
    setProject(project);
    
    // 添加到最近项目
    addToRecentProjects(project);

    console.log('Project created:', project.id);
    return project;

  } catch (err) {
    console.error('Failed to create project:', err);
    return null;
  } finally {
    isLoading.value = false;
  }
}

/**
 * 打开现有项目
 */
export async function openExistingProject(): Promise<Project | null> {
  try {
    isLoading.value = true;

    const fs = getFileSystem();
    
    // 选择项目目录
    const success = await fs.openProject();
    if (!success) {
      console.log('User cancelled project opening');
      return null;
    }

    // 加载项目文件
    const project = await loadProjectFile();
    if (!project) {
      console.error('Failed to load project file');
      
      // 询问是否创建新项目
      if (confirm('未找到项目文件。是否在此创建新项目？')) {
        return await createNewProject();
      }
      
      return null;
    }

    // 初始化子系统
    await initializeSubsystems();

    // 设置当前项目
    setProject(project);

    // 加载最后打开的场景
    if (project.lastOpenedScene) {
      const sceneFS = getSceneFS();
      await sceneFS.load(project.lastOpenedScene);
    }

    // 添加到最近项目
    addToRecentProjects(project);

    console.log('Project opened:', project.id);
    return project;

  } catch (err) {
    console.error('Failed to open project:', err);
    return null;
  } finally {
    isLoading.value = false;
  }
}

/**
 * 从路径打开项目（用于最近项目列表）
 */
export async function openProjectFromPath(path: string): Promise<Project | null> {
  // TODO: 实现从特定路径打开
  // 当前 FileSystem 只支持选择目录，需要扩展
  console.warn('openProjectFromPath not fully implemented');
  return openExistingProject();
}

/**
 * 保存当前项目
 */
export async function saveCurrentProject(): Promise<boolean> {
  if (!currentProject.value) {
    console.warn('No project to save');
    return false;
  }

  try {
    // 更新修改时间
    const updated = touchProject(currentProject.value);
    
    // 保存项目文件
    const success = await saveProjectFile(updated);
    
    if (success) {
      currentProject.value = updated;
      hasUnsavedChanges.value = false;
      lastSavedAt.value = Date.now();
      
      console.log('Project saved');
    }

    return success;

  } catch (err) {
    console.error('Failed to save project:', err);
    return false;
  }
}

/**
 * 关闭当前项目
 */
export async function closeProject(): Promise<void> {
  if (hasUnsavedChanges.value) {
    const shouldSave = confirm('You have unsaved changes. Save before closing?');
    if (shouldSave) {
      await saveCurrentProject();
    }
  }

  // 清理状态
  currentProject.value = null;
  isProjectLoaded.value = false;
  hasUnsavedChanges.value = false;
  lastSavedAt.value = null;

  // 重置子系统
  const prefabFS = getPrefabFS();
  await prefabFS.rescan();

  console.log('Project closed');
}

// ═══════════════════════════════════════════════════════════════
// 项目修改
// ═══════════════════════════════════════════════════════════════

/**
 * 更新项目设置
 */
export function updateProjectSettings(settings: Partial<ProjectSettings>): void {
  if (!currentProject.value) return;

  currentProject.value = {
    ...currentProject.value,
    settings: {
      ...currentProject.value.settings,
      ...settings,
    },
  };

  markAsUnsaved();
}

/**
 * 重命名项目
 */
export function renameProject(newName: string): void {
  if (!currentProject.value) return;

  currentProject.value = {
    ...currentProject.value,
    name: newName,
  };

  markAsUnsaved();
}

/**
 * 设置最后打开的场景
 */
export function setLastOpenedScene(sceneId: string): void {
  if (!currentProject.value) return;

  currentProject.value = {
    ...currentProject.value,
    lastOpenedScene: sceneId,
  };

  markAsUnsaved();
}

/**
 * 添加最近使用的 Prefab
 */
export function addRecentPrefab(prefabId: string): void {
  if (!currentProject.value) return;

  const recent = currentProject.value.recentPrefabs || [];
  const filtered = recent.filter(id => id !== prefabId);
  filtered.unshift(prefabId);
  
  // 只保留最近 10 个
  currentProject.value = {
    ...currentProject.value,
    recentPrefabs: filtered.slice(0, 10),
  };

  markAsUnsaved();
}

/**
 * 标记有未保存的更改
 */
export function markAsUnsaved(): void {
  hasUnsavedChanges.value = true;
}

// ═══════════════════════════════════════════════════════════════
// 最近项目
// ═══════════════════════════════════════════════════════════════

/**
 * 加载最近项目列表（从 localStorage）
 */
export function loadRecentProjects(): void {
  try {
    const stored = localStorage.getItem('mote_recent_projects');
    if (stored) {
      recentProjects.value = JSON.parse(stored);
    }
  } catch (err) {
    console.error('Failed to load recent projects:', err);
    recentProjects.value = [];
  }
}

/**
 * 保存最近项目列表到 localStorage
 */
export function saveRecentProjects(): void {
  try {
    localStorage.setItem(
      'mote_recent_projects',
      JSON.stringify(recentProjects.value.slice(0, 10))
    );
  } catch (err) {
    console.error('Failed to save recent projects:', err);
  }
}

/**
 * 添加到最近项目
 */
function addToRecentProjects(project: Project): void {
  const info: ProjectInfo = {
    id: project.id,
    name: project.name,
    path: '', // 暂时无法获取路径
    projectFileName: project.projectFileName || PROJECT_FILE,
    lastOpened: Date.now(),
    modifiedAt: new Date(project.modifiedAt || Date.now()).getTime(),
  };

  // 去重并移到最前
  const filtered = recentProjects.value.filter(p => p.id !== project.id);
  filtered.unshift(info);
  
  recentProjects.value = filtered.slice(0, 10);
  saveRecentProjects();
}

/**
 * 从最近项目移除
 */
export function removeFromRecentProjects(projectId: string): void {
  recentProjects.value = recentProjects.value.filter(p => p.id !== projectId);
  saveRecentProjects();
}

/**
 * 清空最近项目
 */
export function clearRecentProjects(): void {
  recentProjects.value = [];
  localStorage.removeItem('mote_recent_projects');
}

// ═══════════════════════════════════════════════════════════════
// 私有辅助函数
// ═══════════════════════════════════════════════════════════════

function setProject(project: Project): void {
  currentProject.value = project;
  isProjectLoaded.value = true;
  hasUnsavedChanges.value = false;
  lastSavedAt.value = Date.now();
}

export async function initializeSubsystems(): Promise<void> {
  // 初始化 PrefabFS
  const prefabFS = getPrefabFS();
  await prefabFS.initialize();

  // 初始化 SceneFS
  const sceneFS = getSceneFS();
  await sceneFS.initialize();
}

async function saveProjectFile(project: Project): Promise<boolean> {
  const fs = getFileSystem();
  const content = JSON.stringify(project, null, 2);
  return await fs.writeFile(PROJECT_FILE, content);
}

async function loadProjectFile(): Promise<Project | null> {
  const fs = getFileSystem();
  const content = await fs.readFile(PROJECT_FILE);
  
  if (!content) return null;

  try {
    const data = JSON.parse(content);
    if (validateProject(data)) {
      return data;
    }
    console.error('Invalid project file format');
    return null;
  } catch (err) {
    console.error('Failed to parse project file:', err);
    return null;
  }
}

/**
 * 创建内存项目（不关联文件系统，直接打开编辑器）
 */
export function createInMemoryProject(): void {
  const id = generateProjectId('Untitled');
  const project = createProject(id, 'Untitled Project');
  
  // 初始化子系统（使用内存模式）
  const prefabFS = getPrefabFS();
  prefabFS.initialize();
  
  const sceneFS = getSceneFS();
  sceneFS.initialize();
  
  // 设置当前项目
  setProject(project);
  
  // 自动创建默认场景（640x480）
  newScene(640, 480);
  
  console.log('In-memory project created:', project.id);
}

/**
 * 初始化项目存储
 */
export function initializeProjectStore(): void {
  loadRecentProjects();
  console.log('Project store initialized');
}
