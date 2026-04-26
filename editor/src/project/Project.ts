import { ENGINE_VERSION } from '@mote/engine/core/version';

// ═══════════════════════════════════════════════════════════════
// Project.ts - 项目定义和类型
// 
// 标准项目结构：
// my-project/
// ├── snake.mote-project.json   # 项目元数据
// ├── assets/                   # 资源根目录（引擎只预设这一个目录）
// │   └── *                     # 内部结构完全自由，由用户决定
// │       ├── *.mote-prefab.json
// │       ├── *.mote-scene.json
// │       ├── *.mote-sprite.json
// │       └── *.png / *.mp3 / ...
// └── src/                      # 源码目录
// 
// 设计原则：引擎不强制 assets/ 内部的任何子目录结构。
// 所有资源引用统一使用相对于 assets/ 的文件路径。
// ═══════════════════════════════════════════════════════════════

/**
 * 项目设置
 */
export interface ProjectSettings {
  /** 默认场景宽度 */
  defaultSceneWidth: number;
  /** 默认场景高度 */
  defaultSceneHeight: number;
  /** 默认网格大小 */
  defaultGridSize: number;
  /** 自动保存间隔（毫秒，0 表示禁用） */
  autoSaveInterval: number;
  /** 主题 */
  theme: 'dark' | 'light';
  /** 编辑器设置 */
  editor: {
    /** 显示网格 */
    showGrid: boolean;
    /** 网格吸附 */
    snapToGrid: boolean;
    /** 显示碰撞体 */
    showColliders: boolean;
  };
}

/**
 * 项目元数据（保存在 .mote-project.json 中）
 */
export interface Project {
  /** 项目类型 */
  type: 'mote-project';
  /** 项目 ID */
  id: string;
  /** 项目名称 */
  name: string;
  /** 版本 */
  version: string;
  /** 资源目录名，相对于项目根 */
  assetsDir: string;
  /** 源码目录名，相对于项目根 */
  srcDir: string;
  /** 入口场景，相对于 assetsDir */
  entryScene?: string;
  /** 入口脚本（源码），相对于 srcDir */
  entryScript?: string;
  /** 创建时间 */
  createdAt?: string;
  /** 最后修改时间 */
  modifiedAt?: string;
  /** 最后打开的场景 ID */
  lastOpenedScene?: string;
  /** 项目设置 */
  settings: ProjectSettings;
  /** 最近使用的 Prefab（用于快速访问） */
  recentPrefabs?: string[];
  /** 项目描述 */
  description?: string;
  /** 项目文件名（如 snake.mote-project.json） */
  projectFileName?: string;
}

/**
 * 项目信息（显示在欢迎页面）
 */
export interface ProjectInfo {
  id: string;
  name: string;
  path: string;
  projectFileName: string;
  lastOpened: number;
  modifiedAt: number;
  thumbnail?: string;
}

/**
 * 创建新项目
 */
export function createProject(
  id: string,
  name: string,
  options?: Partial<ProjectSettings>
): Project {
  const now = new Date().toISOString();

  return {
    type: 'mote-project',
    id,
    name,
    version: ENGINE_VERSION,
    assetsDir: 'assets',
    srcDir: 'src',
    entryScene: undefined,
    entryScript: 'main.ts',
    createdAt: now,
    modifiedAt: now,
    projectFileName: generateProjectFileName(name),
    settings: {
      defaultSceneWidth: 640,
      defaultSceneHeight: 480,
      defaultGridSize: 32,
      autoSaveInterval: 30000,
      theme: 'dark',
      editor: {
        showGrid: true,
        snapToGrid: true,
        showColliders: false,
      },
      ...options,
    },
  };
}

/**
 * 验证项目数据
 */
export function validateProject(data: any): data is Project {
  if (!data || typeof data !== 'object') return false;
  if (!data.id || typeof data.id !== 'string') return false;
  if (!data.name || typeof data.name !== 'string') return false;
  if (!data.version || typeof data.version !== 'string') return false;
  if (!data.assetsDir || typeof data.assetsDir !== 'string') return false;
  if (!data.srcDir || typeof data.srcDir !== 'string') return false;
  if (!data.settings || typeof data.settings !== 'object') return false;

  return true;
}

/**
 * 生成项目 ID
 */
export function generateProjectId(name: string): string {
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  
  const timestamp = Date.now().toString(36);
  return `${sanitized}_${timestamp}`;
}

/**
 * 更新项目修改时间
 */
export function touchProject(project: Project): Project {
  return {
    ...project,
    modifiedAt: new Date().toISOString(),
  };
}

/**
 * 项目序列化（移除运行时数据）
 */
export function serializeProject(project: Project): string {
  return JSON.stringify(project, null, 2);
}

/**
 * 默认项目名称
 */
export const DEFAULT_PROJECT_NAME = 'Untitled Project';

/**
 * 项目文件扩展名
 */
export const PROJECT_FILE_EXTENSION = '.mote-project.json';

/**
 * 根据项目名称生成项目文件名
 * e.g. "Snake Game" -> "snake_game.mote-project.json"
 */
export function generateProjectFileName(name: string): string {
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `${sanitized || 'untitled'}${PROJECT_FILE_EXTENSION}`;
}
