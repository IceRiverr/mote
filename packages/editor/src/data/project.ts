// ═══════════════════════════════════════════════════════════════
// project.ts - 项目配置管理
// project.json 仅用于编辑器，游戏运行时无需此文件
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
 * 资源匹配模式
 */
export interface AssetPatterns {
  /** Prefab 文件路径模式 */
  prefabPaths: string[];
  /** Scene 文件路径模式 */
  scenePaths: string[];
  /** Sprite Atlas 路径模式 */
  atlasPaths: string[];
}

/**
 * 项目配置
 */
export interface ProjectConfig {
  /** 文件类型标识 */
  type: "mote-project";
  /** 版本 */
  version: string;
  /** 项目名称 */
  name: string;
  /** 编辑器状态 */
  editor?: EditorState;
  /** 资源匹配模式 */
  assets: AssetPatterns;
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
  /** 扫描到的资源索引 */
  index: ProjectIndex;
}

/**
 * 项目资源索引
 */
export interface ProjectIndex {
  prefabs: { path: string; handle: FileSystemFileHandle }[];
  scenes: { path: string; handle: FileSystemFileHandle }[];
  atlases: { path: string; handle: FileSystemFileHandle }[];
}

// ═══════════════════════════════════════════════════════════════
// 常量
// ═══════════════════════════════════════════════════════════════

const PROJECT_FILENAME = "project.json";
const DEFAULT_VERSION = "1.0.0";

// ═══════════════════════════════════════════════════════════════
// 项目操作
// ═══════════════════════════════════════════════════════════════

/**
 * 创建新的项目配置
 */
export function createProjectConfig(name: string): ProjectConfig {
  return {
    type: "mote-project",
    version: DEFAULT_VERSION,
    name,
    assets: {
      prefabPaths: ["prefabs/**/*.json", "assets/prefabs/**/*.json"],
      scenePaths: ["scenes/**/*.json", "assets/scenes/**/*.json"],
      atlasPaths: ["atlases/**/*.mote-sprite.json", "assets/sprites/**/*.mote-sprite.json"],
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
    // 尝试读取 project.json
    const configHandle = await getFileHandle(folderHandle, PROJECT_FILENAME, {
      create: false,
    });

    if (!configHandle) {
      return null;
    }

    const json = await readJsonFile(configHandle);
    
    if (!isValidProjectConfig(json)) {
      console.error("Invalid project.json format");
      return null;
    }

    const config = json as ProjectConfig;

    // 扫描资源
    const index = await scanProjectAssets(folderHandle, config);

    return {
      folderHandle,
      config,
      configHandle,
      index,
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
    
    // 创建 project.json
    const configHandle = await getFileHandle(folderHandle, PROJECT_FILENAME, {
      create: true,
    });

    if (!configHandle) {
      throw new Error("Failed to create project.json");
    }

    await writeJsonFile(configHandle, config);

    // 创建默认目录结构
    await Promise.all([
      (folderHandle as any).getDirectoryHandle("prefabs", { create: true }),
      (folderHandle as any).getDirectoryHandle("scenes", { create: true }),
      (folderHandle as any).getDirectoryHandle("atlases", { create: true }),
    ]);

    return {
      folderHandle,
      config,
      configHandle,
      index: { prefabs: [], scenes: [], atlases: [] },
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
  project.config.editor = {
    ...project.config.editor,
    ...state,
  };
  await saveProjectConfig(project);
}

// ═══════════════════════════════════════════════════════════════
// 资源扫描
// ═══════════════════════════════════════════════════════════════

/**
 * 扫描项目资源
 */
export async function scanProjectAssets(
  folderHandle: FileSystemDirectoryHandle,
  config: ProjectConfig
): Promise<ProjectIndex> {
  const index: ProjectIndex = {
    prefabs: [],
    scenes: [],
    atlases: [],
  };

  // 递归读取所有文件
  async function scanDir(
    dirHandle: FileSystemDirectoryHandle,
    basePath: string
  ) {
    for await (const [name, entry] of (dirHandle as any).entries()) {
      const path = basePath ? `${basePath}/${name}` : name;

      if (entry.kind === "file") {
        // 检查是否匹配各种资源模式
        if (matchesPatterns(path, config.assets.prefabPaths)) {
          // 验证是有效的 Prefab 文件
          try {
            const json = await readJsonFile(entry as FileSystemFileHandle);
            if (isPrefabJson(json)) {
              index.prefabs.push({ path, handle: entry as FileSystemFileHandle });
            }
          } catch {
            // 忽略无效文件
          }
        } else if (matchesPatterns(path, config.assets.scenePaths)) {
          try {
            const json = await readJsonFile(entry as FileSystemFileHandle);
            if (isSceneJson(json)) {
              index.scenes.push({ path, handle: entry as FileSystemFileHandle });
            }
          } catch {
            // 忽略无效文件
          }
        } else if (matchesPatterns(path, config.assets.atlasPaths)) {
          index.atlases.push({ path, handle: entry as FileSystemFileHandle });
        }
      } else if (entry.kind === "directory") {
        await scanDir(entry as FileSystemDirectoryHandle, path);
      }
    }
  }

  await scanDir(folderHandle, "");
  return index;
}

/**
 * 检查路径是否匹配模式列表
 */
function matchesPatterns(path: string, patterns: string[]): boolean {
  for (const pattern of patterns) {
    // 简单的 glob 匹配转换
    const regex = new RegExp(
      "^" +
        pattern
          .replace(/\*\*/g, "<<<DOUBLESTAR>>>")
          .replace(/\*/g, "[^/]*")
          .replace(/<<<DOUBLESTAR>>>/g, ".*")
          .replace(/\?/g, ".") +
        "$"
    );
    if (regex.test(path)) {
      return true;
    }
  }
  return false;
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
    obj.type === "mote-project" &&
    typeof obj.version === "string" &&
    typeof obj.name === "string" &&
    obj.assets !== undefined &&
    typeof obj.assets === "object" &&
    Array.isArray((obj.assets as AssetPatterns).prefabPaths) &&
    Array.isArray((obj.assets as AssetPatterns).scenePaths) &&
    Array.isArray((obj.assets as AssetPatterns).atlasPaths)
  );
}

/**
 * 验证是否为 Prefab JSON
 */
export function isPrefabJson(json: unknown): boolean {
  if (!json || typeof json !== "object") return false;
  const obj = json as Record<string, unknown>;
  return obj.type === "mote-prefab" && typeof obj.id === "string";
}

/**
 * 验证是否为 Scene JSON
 */
export function isSceneJson(json: unknown): boolean {
  if (!json || typeof json !== "object") return false;
  const obj = json as Record<string, unknown>;
  return obj.type === "mote-scene" && typeof obj.id === "string";
}
