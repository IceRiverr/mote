// ═══════════════════════════════════════════════════════════════
// project.ts - 项目状态管理（新架构）
// ═══════════════════════════════════════════════════════════════

import { signal } from "@preact/signals";
import type { Project } from "../data/project";

/** 当前打开的项目 */
export const currentProject = signal<Project | null>(null);

/** 项目是否已修改 */
export const projectModified = signal(false);

/** 最近打开的项目路径列表 */
export const recentProjects = signal<string[]>([]);

// ═══════════════════════════════════════════════════════════════
// 操作
// ═══════════════════════════════════════════════════════════════

/**
 * 打开项目
 */
export async function openProject(project: Project): Promise<void> {
  currentProject.value = project;
  projectModified.value = false;
  
  // 添加到最近项目列表
  const path = project.folderHandle.name;
  const recents = recentProjects.value.filter(p => p !== path);
  recents.unshift(path);
  recentProjects.value = recents.slice(0, 10);
}

/**
 * 关闭项目
 */
export function closeProject(): void {
  currentProject.value = null;
  projectModified.value = false;
}

/**
 * 标记项目已修改
 */
export function markModified(): void {
  projectModified.value = true;
}

/**
 * 保存项目配置
 */
export async function saveProject(): Promise<void> {
  const project = currentProject.value;
  if (!project) return;
  
  // project.config 的保存由具体调用者处理
  projectModified.value = false;
}
