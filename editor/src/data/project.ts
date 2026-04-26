// ═══════════════════════════════════════════════════════════════
// project.ts - 项目配置管理
// .mote-project.json 仅用于编辑器，游戏运行时无需此文件
// ═══════════════════════════════════════════════════════════════

import type { FileSystemDirectoryHandle, FileSystemFileHandle } from "./fs-access";
import { readJsonFile, writeJsonFile, getFileHandle } from "./fs-access";

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

/**
 * 编辑器状态（仅编辑器使用）
 */
export interface EditorState {
  /** 最后打开的 Scene */
  lastOpenScene?: string;
  /** 相机位置 */
  viewportX?: number;
  viewportY?: number;
  /** 相机缩放 */
  viewportZoom?: number;
  /** 最后选中的 Prefab */
  lastSelectedPrefab?: string;
}

/**
 * 项目设置
 */
export interface ProjectSettings {
  defaultSceneWidth: number;
  defaultSceneHeight: number;
  defaultGridSize: number;
  autoSaveInterval: number;
  theme: 'dark' | 'light';
  editor: {
    showGrid: boolean;
    snapToGrid: boolean;
    showColliders: boolean;
  };
}

/**
 * 项目配置（对应 .mote-project.json 的磁盘格式）
 */
export interface ProjectConfig {
  /** 项目唯一标识 */
  id: string;
  /** 项目名称 */
  name: string;
  /** 版本 */
  version: string;
  /** 资源目录名 */
  assetsDir: string;
  /** 源码目录名 */
  srcDir: string;
  /** 入口场景（相对于 assetsDir） */
  entryScene?: string;
  /** 入口脚本（相对于 srcDir） */
  entryScript?: string;
  /** 创建时间 */
  createdAt?: string;
  /** 最后修改时间 */
  modifiedAt?: string;
  /** 最后打开的场景 ID */
  lastOpenedScene?: string;
  /** 项目设置 */
  settings: ProjectSettings;
  /** 最近使用的 Prefab */
  recentPrefabs?: string[];
  /** 项目描述 */
  description?: string;
}

/**
 * 项目运行时状态
 */
export interface Project {
  /** 文件夹句柄 */
  folderHandle: FileSystemDirectoryHandle;
  /** 配置 */
  config: ProjectConfig;
  /** 配置文件的句柄 */
  configHandle: FileSystemFileHandle;
}

// ═══════════════════════════════════════════════════════════════
// 常量
// ═══════════════════════════════════════════════════════════════

const PROJECT_FILE_EXTENSION = ".mote-project.json";
const DEFAULT_VERSION = "1.0.0";

/**
 * 生成项目文件名
 */
export function generateProjectFileName(name: string): string {
  const sanitized = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${sanitized || "untitled"}${PROJECT_FILE_EXTENSION}`;
}

// ═══════════════════════════════════════════════════════════════
// 项目操作
// ═══════════════════════════════════════════════════════════════

/**
 * 创建新的项目配置
 */
export function createProjectConfig(name: string, id?: string): ProjectConfig {
  const now = new Date().toISOString();
  return {
    id: id || `project_${Date.now().toString(36)}`,
    name,
    version: DEFAULT_VERSION,
    assetsDir: "assets",
    srcDir: "src",
    entryScript: "main.ts",
    createdAt: now,
    modifiedAt: now,
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
    },
  };
}

/**
 * 读取项目配置
 */
export async function loadProject(
  folderHandle: FileSystemDirectoryHandle
): Promise<Project | null> {
  try {
    // 扫描目录下唯一的 .mote-project.json
    const files: string[] = [];
    for await (const [name, entry] of (folderHandle as any).entries()) {
      if (entry.kind === "file" && name.endsWith(PROJECT_FILE_EXTENSION)) {
        files.push(name);
      }
    }

    if (files.length === 0) {
      return null;
    }

    if (files.length > 1) {
      console.warn("Multiple .mote-project.json files found in directory");
    }

    const configHandle = await getFileHandle(folderHandle, files[0], {
      create: false,
    });

    if (!configHandle) {
      return null;
    }

    const json = await readJsonFile(configHandle);

    if (!isValidProjectConfig(json)) {
      console.error("Invalid project file format");
      return null;
    }

    const config = json as ProjectConfig;

    return {
      folderHandle,
      config,
      configHandle,
    };
  } catch (e) {
    console.error("Failed to load project:", e);
    return null;
  }
}

/**
 * 初始化新项目
 */
export async function createProject(
  folderHandle: FileSystemDirectoryHandle,
  name: string
): Promise<Project | null> {
  try {
    const config = createProjectConfig(name);
    const fileName = generateProjectFileName(name);

    // 创建 .mote-project.json
    const configHandle = await getFileHandle(folderHandle, fileName, {
      create: true,
    });

    if (!configHandle) {
      throw new Error(`Failed to create ${fileName}`);
    }

    await writeJsonFile(configHandle, config);

    // 创建默认目录结构（仅 assets 和 src）
    await Promise.all([
      (folderHandle as any).getDirectoryHandle("assets", { create: true }),
      (folderHandle as any).getDirectoryHandle("src", { create: true }),
    ]);

    return {
      folderHandle,
      config,
      configHandle,
    };
  } catch (e) {
    console.error("Failed to create project:", e);
    return null;
  }
}

/**
 * 保存项目配置
 */
export async function saveProjectConfig(project: Project): Promise<void> {
  await writeJsonFile(project.configHandle, project.config);
}

/**
 * 更新编辑器状态
 */
export async function updateEditorState(
  project: Project,
  state: Partial<EditorState>
): Promise<void> {
  // 编辑器状态暂存到 settings.editor 中
  project.config.settings.editor = {
    ...project.config.settings.editor,
    ...state,
  };
  await saveProjectConfig(project);
}

// ═══════════════════════════════════════════════════════════════
// 验证函数
// ═══════════════════════════════════════════════════════════════

/**
 * 验证是否为有效的项目配置
 */
export function isValidProjectConfig(json: unknown): json is ProjectConfig {
  if (!json || typeof json !== "object") return false;
  const obj = json as Record<string, unknown>;
  return (
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    typeof obj.version === "string" &&
    typeof obj.assetsDir === "string" &&
    typeof obj.srcDir === "string" &&
    obj.settings !== undefined &&
    typeof obj.settings === "object"
  );
}

import { ENGINE_VERSION } from "@mote/engine/core/version";

/**
 * 验证是否为 Prefab JSON
 */
export function isPrefabJson(json: unknown): boolean {
  if (!json || typeof json !== "object") return false;
  const obj = json as Record<string, unknown>;
  return obj.kind === "prefab" && obj.version === ENGINE_VERSION && typeof obj.components === "object";
}

/**
 * 验证是否为 Scene JSON
 */
export function isSceneJson(json: unknown): boolean {
  if (!json || typeof json !== "object") return false;
  const obj = json as Record<string, unknown>;
  return obj.kind === "scene" && obj.version === ENGINE_VERSION && typeof obj.id === "string";
}
