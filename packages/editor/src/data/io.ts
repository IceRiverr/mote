// ═══════════════════════════════════════════════════════════════
// io.ts - 核心导入导出系统（新架构）
// 支持 Scene、Prefab 的 JSON 序列化
// ═══════════════════════════════════════════════════════════════

import type { FileSystemFileHandle } from "./fs-access";
import { readJsonFile, writeJsonFile } from "./fs-access";
import type { Scene, SceneEntity } from "./Scene";
import type { Prefab } from "./Prefab";

// ═══════════════════════════════════════════════════════════════
// JSON 类型定义
// ═══════════════════════════════════════════════════════════════

/** Scene JSON 格式 */
export interface SceneJson {
  type: "mote-scene";
  version: string;
  id: string;
  name: string;
  width: number;
  height: number;
  grid: {
    enabled: boolean;
    size: number;
    snap: boolean;
    color?: string;
  };
  entities: SceneEntityJson[];
}

/** Scene Entity JSON */
export interface SceneEntityJson {
  id: string;
  prefab: string;
  name?: string;
  x: number;
  y: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  overrides?: Record<string, Record<string, any>>;
  visible?: boolean;
}

/** Prefab JSON 格式 */
export interface PrefabJson {
  type: "mote-prefab";
  version: string;
  id: string;
  name: string;
  category: string;
  components: Record<string, Record<string, any>>;
  thumbnail?: string;
  description?: string;
}

/** 构建包格式（用于游戏发布） */
export interface BuildBundle {
  version: string;
  prefabs: Record<string, PrefabJson>;
  scenes: Record<string, SceneJson>;
  metadata: {
    prefabCount: number;
    sceneCount: number;
    totalEntities: number;
  };
}

// ═══════════════════════════════════════════════════════════════
// Scene 导入导出
// ═══════════════════════════════════════════════════════════════

/**
 * Scene → JSON
 */
export function sceneToJson(scene: Scene): SceneJson {
  return {
    type: "mote-scene",
    version: "1.0.0",
    id: scene.id,
    name: scene.name,
    width: scene.width,
    height: scene.height,
    grid: {
      enabled: scene.grid.enabled,
      size: scene.grid.size,
      snap: scene.grid.snap,
      color: scene.grid.color,
    },
    entities: scene.entities.map(entityToJson),
  };
}

/**
 * Entity → JSON
 */
function entityToJson(entity: SceneEntity): SceneEntityJson {
  const json: SceneEntityJson = {
    id: entity.id,
    prefab: entity.prefab,
    x: entity.x,
    y: entity.y,
  };

  // 只序列化非默认值
  if (entity.name) json.name = entity.name;
  if (entity.rotation) json.rotation = entity.rotation;
  if (entity.scaleX !== undefined && entity.scaleX !== 1) json.scaleX = entity.scaleX;
  if (entity.scaleY !== undefined && entity.scaleY !== 1) json.scaleY = entity.scaleY;
  if (entity.visible === false) json.visible = false;
  if (entity.overrides && Object.keys(entity.overrides).length > 0) {
    json.overrides = entity.overrides;
  }

  return json;
}

/**
 * JSON → Scene
 */
export function sceneFromJson(json: SceneJson): Scene {
  return {
    id: json.id,
    name: json.name,
    width: json.width,
    height: json.height,
    grid: {
      enabled: json.grid.enabled,
      size: json.grid.size,
      snap: json.grid.snap,
      color: json.grid.color,
    },
    entities: json.entities.map(entityFromJson),
  };
}

/**
 * JSON → Entity
 */
function entityFromJson(json: SceneEntityJson): SceneEntity {
  return {
    id: json.id,
    prefab: json.prefab,
    name: json.name,
    x: json.x,
    y: json.y,
    rotation: json.rotation,
    scaleX: json.scaleX,
    scaleY: json.scaleY,
    visible: json.visible !== false,
    overrides: json.overrides,
  };
}

/**
 * 保存 Scene 到文件
 */
export async function saveScene(
  scene: Scene,
  fileHandle: FileSystemFileHandle
): Promise<void> {
  const json = sceneToJson(scene);
  await writeJsonFile(fileHandle, json);
}

/**
 * 从文件加载 Scene
 */
export async function loadScene(
  fileHandle: FileSystemFileHandle
): Promise<Scene | null> {
  try {
    const json = await readJsonFile(fileHandle);
    if (!isSceneJson(json)) {
      console.error("Invalid scene file format");
      return null;
    }
    return sceneFromJson(json);
  } catch (e) {
    console.error("Failed to load scene:", e);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// Prefab 导入导出
// ═══════════════════════════════════════════════════════════════

/**
 * Prefab → JSON
 */
export function prefabToJson(prefab: Prefab): PrefabJson {
  return {
    type: "mote-prefab",
    version: "1.0.0",
    id: prefab.id,
    name: prefab.name,
    category: prefab.category,
    components: deepClone(prefab.components),
    thumbnail: prefab.thumbnail,
    description: prefab.description,
  };
}

/**
 * JSON → Prefab
 */
export function prefabFromJson(json: PrefabJson): Prefab {
  return {
    id: json.id,
    name: json.name,
    category: json.category,
    components: deepClone(json.components),
    thumbnail: json.thumbnail,
    description: json.description,
  };
}

/**
 * 保存 Prefab 到文件
 */
export async function savePrefab(
  prefab: Prefab,
  fileHandle: FileSystemFileHandle
): Promise<void> {
  const json = prefabToJson(prefab);
  await writeJsonFile(fileHandle, json);
}

/**
 * 从文件加载 Prefab
 */
export async function loadPrefab(
  fileHandle: FileSystemFileHandle
): Promise<Prefab | null> {
  try {
    const json = await readJsonFile(fileHandle);
    if (!isPrefabJson(json)) {
      console.error("Invalid prefab file format");
      return null;
    }
    return prefabFromJson(json);
  } catch (e) {
    console.error("Failed to load prefab:", e);
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════
// 批量操作
// ═══════════════════════════════════════════════════════════════

/**
 * 导出构建包（用于游戏发布）
 */
export function exportBuildBundle(
  prefabs: Prefab[],
  scenes: Scene[]
): BuildBundle {
  const prefabRecord: Record<string, PrefabJson> = {};
  const sceneRecord: Record<string, SceneJson> = {};

  for (const prefab of prefabs) {
    prefabRecord[prefab.id] = prefabToJson(prefab);
  }

  let totalEntities = 0;
  for (const scene of scenes) {
    sceneRecord[scene.id] = sceneToJson(scene);
    totalEntities += scene.entities.length;
  }

  return {
    version: "1.0.0",
    prefabs: prefabRecord,
    scenes: sceneRecord,
    metadata: {
      prefabCount: prefabs.length,
      sceneCount: scenes.length,
      totalEntities,
    },
  };
}

/**
 * 下载构建包
 */
export function downloadBuildBundle(bundle: BuildBundle, filename?: string): void {
  const json = JSON.stringify(bundle, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename || `bundle-${Date.now()}.json`;
  a.click();

  URL.revokeObjectURL(url);
}

// ═══════════════════════════════════════════════════════════════
// 验证函数
// ═══════════════════════════════════════════════════════════════

/**
 * 验证是否为 Scene JSON
 */
export function isSceneJson(json: unknown): json is SceneJson {
  if (!json || typeof json !== "object") return false;
  const obj = json as Record<string, unknown>;
  return (
    obj.type === "mote-scene" &&
    typeof obj.version === "string" &&
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    typeof obj.width === "number" &&
    typeof obj.height === "number" &&
    obj.grid !== undefined &&
    Array.isArray(obj.entities)
  );
}

/**
 * 验证是否为 Prefab JSON
 */
export function isPrefabJson(json: unknown): json is PrefabJson {
  if (!json || typeof json !== "object") return false;
  const obj = json as Record<string, unknown>;
  return (
    obj.type === "mote-prefab" &&
    typeof obj.version === "string" &&
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    typeof obj.category === "string" &&
    obj.components !== undefined &&
    typeof obj.components === "object"
  );
}

// ═══════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════

/**
 * 深拷贝对象
 */
function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== "object") return obj;
  if (obj instanceof Date) return new Date(obj.getTime()) as unknown as T;
  if (Array.isArray(obj)) return obj.map(deepClone) as unknown as T;

  const cloned: Record<string, any> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepClone((obj as Record<string, any>)[key]);
    }
  }
  return cloned as T;
}

/**
 * 生成唯一文件名
 */
export function generateUniqueFilename(
  baseName: string,
  existingNames: Set<string>,
  extension: string = ".json"
): string {
  if (!existingNames.has(baseName + extension)) {
    return baseName + extension;
  }

  let counter = 2;
  let newName = `${baseName}_${counter}${extension}`;
  while (existingNames.has(newName)) {
    counter++;
    newName = `${baseName}_${counter}${extension}`;
  }
  return newName;
}

/**
 * 检测 JSON 文件类型
 */
export function detectJsonType(
  json: unknown
): "scene" | "prefab" | "project" | "atlas" | "unknown" {
  if (!json || typeof json !== "object") return "unknown";
  const obj = json as Record<string, unknown>;

  switch (obj.type) {
    case "mote-scene":
      return "scene";
    case "mote-prefab":
      return "prefab";
    case "mote-project":
      return "project";
    case "mote-sprite":
      return "atlas";
    default:
      return "unknown";
  }
}
