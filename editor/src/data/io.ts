// ═══════════════════════════════════════════════════════════════
// io.ts - 核心导入导出系统（新架构）
// 支持 Scene、Prefab、SpriteSheet 的 JSON 序列化
// ═══════════════════════════════════════════════════════════════

import type { FileSystemFileHandle } from "./fs-access";
import { readJsonFile, writeJsonFile } from "./fs-access";
import type { Scene, SceneEntity } from "./Scene";
import { generateEntityId } from "./Scene";
import type { Prefab } from "./Prefab";
import type { ColliderShape } from "./Collider";
import type {
  SpriteSheet,
  FrameData,
  Slicing,
  GridSlicing,
  PackedSlicing,
  XmlSlicing,
} from "./SpriteSheet";
import { ENGINE_VERSION } from "@mote/engine/core/version";

/** 验证资源路径是否符合规范（内联，不依赖 engine 的已删除 path 模块） */
function validateAssetPath(path: string): string | null {
  if (typeof path !== "string" || path.trim() === "") {
    return "Path must be a non-empty string";
  }
  if (path.includes("\\")) {
    return `Path must use forward slashes (/), not backslashes: "${path}"`;
  }
  if (path.startsWith("/")) {
    return `Absolute paths are not allowed: "${path}"`;
  }
  if (/^[a-zA-Z]:/.test(path)) {
    return `Drive letters are not allowed: "${path}"`;
  }
  if (path === ".." || path.startsWith("../") || path.includes("/../")) {
    return `Path traversal (../) is not allowed: "${path}"`;
  }
  if (path.startsWith("assets/") || path === "assets") {
    return `Path should not include "assets/" prefix: "${path}"`;
  }
  if (path.startsWith("./")) {
    return `Path should not start with "./": "${path}"`;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════
// JSON 类型定义
// ═══════════════════════════════════════════════════════════════

/** Scene JSON 格式 */
export interface SceneJson {
  version: string;
  kind: "scene";
  id: string;
  name: string;
  grid: {
    enabled: boolean;
    size: number;
    snap: boolean;
    color?: string;
  };
  entities: SceneEntityJson[];
}

/** Scene Entity JSON（v2，含独立 transform） */
export interface SceneEntityJson {
  prefab: string;
  name: string;
  parent?: string | null;
  transform: {
    x: number;
    y: number;
    rotation: number;
    scaleX: number;
    scaleY: number;
  };
  overrides?: Record<string, Record<string, any>>;
  visible?: boolean;
}

/** Prefab JSON 格式（无 id） */
export interface PrefabJson {
  version: string;
  kind: "prefab";
  name?: string;
  tags?: string[];
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

/** SpriteSheet JSON 格式 */
export interface SpriteSheetJson {
  type: "mote-sprite";
  version: string;
  id: string;
  name: string;
  image: string;
  slicing: {
    mode: "grid" | "packed" | "xml" | "manual";
    tileWidth?: number;
    tileHeight?: number;
    margin?: number;
    spacing?: number;
    source?: string;
  };
  frames: Array<{
    name: string;
    x: number;
    y: number;
    w: number;
    h: number;
    collider?: { shapes: ColliderShape[] };
    tags?: string[];
    properties?: Record<string, unknown>;
    trimmed?: boolean;
    sourceWidth?: number;
    sourceHeight?: number;
    offsetX?: number;
    offsetY?: number;
    rotated?: boolean;
  }>;
}

// ═══════════════════════════════════════════════════════════════
// Scene 导入导出
// ═══════════════════════════════════════════════════════════════

/**
 * Scene → JSON（v2）
 */
export function sceneToJson(scene: Scene): SceneJson {
  const json: SceneJson = {
    version: scene.version,
    kind: scene.kind,
    id: scene.id,
    name: scene.name,
    grid: {
      enabled: scene.grid.enabled,
      size: scene.grid.size,
      snap: scene.grid.snap,
      color: scene.grid.color,
    },
    entities: scene.entities.map(entityToJson),
  };
  // path 是运行时属性，不序列化到文件
  return json;
}

/**
 * Entity → JSON（v2）
 * 注意：不输出运行时 id，id 仅在内存中维护
 */
function entityToJson(entity: SceneEntity): SceneEntityJson {
  const json: SceneEntityJson = {
    prefab: entity.prefab,
    name: entity.name,
    transform: entity.transform,
  };

  if (entity.parent !== undefined && entity.parent !== null) json.parent = entity.parent;
  if (entity.visible === false) json.visible = false;
  if (entity.overrides && Object.keys(entity.overrides).length > 0) {
    json.overrides = structuredClone(entity.overrides);
  }

  return json;
}

/**
 * JSON → Scene（v2）
 */
export function sceneFromJson(json: SceneJson): Scene {
  return {
    version: json.version,
    kind: json.kind,
    id: json.id,
    name: json.name,
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
 * JSON → Entity（v2）
 * 加载时重新生成运行时 id（编辑器只是预览器，打开即重建）
 */
/**
 * JSON → Entity（v2）
 * 加载时重新生成运行时 id（编辑器只是预览器，打开即重建）
 */
function entityFromJson(json: SceneEntityJson): SceneEntity {
  return {
    id: generateEntityId(),
    prefab: json.prefab,
    name: json.name,
    parent: json.parent ?? null,
    transform: json.transform,
    visible: json.visible !== false,
    overrides: json.overrides ? structuredClone(json.overrides) : undefined,
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
 * Prefab → JSON（v2）
 */
export function prefabToJson(prefab: Prefab): PrefabJson {
  const json: PrefabJson = {
    version: prefab.version,
    kind: prefab.kind,
    name: prefab.name,
    components: structuredClone(prefab.components),
    thumbnail: prefab.thumbnail,
    description: prefab.description,
  };
  if (prefab.tags && prefab.tags.length > 0) {
    json.tags = [...prefab.tags];
  }
  return json;
}

/**
 * JSON → Prefab（v2）
 */
export function prefabFromJson(json: PrefabJson): Prefab {
  // 验证 Sprite atlas 路径
  const atlas = json.components.Sprite?.atlas;
  if (atlas) {
    const error = validateAssetPath(atlas);
    if (error) {
      throw new Error(`Invalid atlas path in prefab: ${error}`);
    }
  }

  return {
    version: json.version,
    kind: json.kind,
    name: json.name,
    tags: json.tags ? [...json.tags] : undefined,
    components: structuredClone(json.components),
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
  prefabs: Array<{ id: string; prefab: Prefab }>,
  scenes: Scene[]
): BuildBundle {
  const prefabRecord: Record<string, PrefabJson> = {};
  const sceneRecord: Record<string, SceneJson> = {};

  for (const { id, prefab } of prefabs) {
    prefabRecord[id] = prefabToJson(prefab);
  }

  let totalEntities = 0;
  for (const scene of scenes) {
    sceneRecord[scene.id] = sceneToJson(scene);
    totalEntities += scene.entities.length;
  }

  return {
    version: ENGINE_VERSION,
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
 * 验证是否为 Scene JSON（v2）
 */
export function isSceneJson(json: unknown): json is SceneJson {
  if (!json || typeof json !== "object") return false;
  const obj = json as Record<string, unknown>;
  return (
    obj.version === ENGINE_VERSION &&
    obj.kind === "scene" &&
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    obj.grid !== undefined &&
    Array.isArray(obj.entities)
  );
}

/**
 * 验证是否为 Prefab JSON（v2）
 */
export function isPrefabJson(json: unknown): json is PrefabJson {
  if (!json || typeof json !== "object") return false;
  const obj = json as Record<string, unknown>;
  return (
    obj.version === ENGINE_VERSION &&
    obj.kind === "prefab" &&
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
 * 验证是否为 SpriteSheet JSON
 */
export function isSpriteSheetJson(json: unknown): json is SpriteSheetJson {
  if (!json || typeof json !== "object") return false;
  const obj = json as Record<string, unknown>;
  return (
    obj.type === "mote-sprite" &&
    typeof obj.version === "string" &&
    typeof obj.id === "string" &&
    typeof obj.name === "string" &&
    typeof obj.image === "string" &&
    obj.slicing !== undefined &&
    Array.isArray(obj.frames)
  );
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

// ═══════════════════════════════════════════════════════════════
// SpriteSheet 导入导出
// ═══════════════════════════════════════════════════════════════

/**
 * SpriteSheet → JSON
 */
export function spriteSheetToJson(sheet: SpriteSheet, overrideImagePath?: string): SpriteSheetJson {
  const imagePath = overrideImagePath ?? sheet.sourcePath ?? sheet.image;
  
  const slicing: SpriteSheetJson["slicing"] = { mode: sheet.slicing.mode };

  if (sheet.slicing.mode === "grid") {
    const g = sheet.slicing as GridSlicing;
    slicing.tileWidth = g.tileWidth;
    slicing.tileHeight = g.tileHeight;
    if (g.margin !== undefined && g.margin !== 0) slicing.margin = g.margin;
    if (g.spacing !== undefined && g.spacing !== 0) slicing.spacing = g.spacing;
  } else if (sheet.slicing.mode === "packed") {
    const p = sheet.slicing as PackedSlicing;
    if (p.source) slicing.source = p.source;
  } else if (sheet.slicing.mode === "xml") {
    const x = sheet.slicing as XmlSlicing;
    if (x.source) slicing.source = x.source;
  }

  const frames: SpriteSheetJson["frames"] = [];
  for (const [frameId, frame] of Object.entries(sheet.frames)) {
    const entry: SpriteSheetJson["frames"][number] = {
      name: frameId,
      x: frame.x,
      y: frame.y,
      w: frame.w,
      h: frame.h,
    };
    if (frame.collider && frame.collider.length > 0) {
      entry.collider = { shapes: frame.collider.map((c) => ({ ...c })) };
    }
    if (frame.tags && frame.tags.length > 0) entry.tags = [...frame.tags];
    if (frame.properties && Object.keys(frame.properties).length > 0) {
      entry.properties = { ...frame.properties };
    }
    if (frame.trimmed !== undefined) entry.trimmed = frame.trimmed;
    if (frame.sourceWidth !== undefined) entry.sourceWidth = frame.sourceWidth;
    if (frame.sourceHeight !== undefined) entry.sourceHeight = frame.sourceHeight;
    if (frame.offsetX !== undefined) entry.offsetX = frame.offsetX;
    if (frame.offsetY !== undefined) entry.offsetY = frame.offsetY;
    if (frame.rotated !== undefined) entry.rotated = frame.rotated;
    frames.push(entry);
  }

  return {
    type: "mote-sprite",
    version: ENGINE_VERSION,
    id: sheet.id,
    name: sheet.name,
    image: imagePath,
    slicing,
    frames,
  };
}

/**
 * JSON → SpriteSheet
 */
export function spriteSheetFromJson(
  json: SpriteSheetJson,
  imageUrl: string,
): SpriteSheet {
  // 验证 image 路径
  const imageError = validateAssetPath(json.image);
  if (imageError) {
    throw new Error(`Invalid image path in sprite sheet ${json.id}: ${imageError}`);
  }
  let slicing: Slicing;
  switch (json.slicing.mode) {
    case "grid":
      slicing = {
        mode: "grid",
        tileWidth: json.slicing.tileWidth ?? 16,
        tileHeight: json.slicing.tileHeight ?? 16,
        margin: json.slicing.margin,
        spacing: json.slicing.spacing,
      };
      break;
    case "packed":
      slicing = {
        mode: "packed",
        source: json.slicing.source,
      };
      break;
    case "xml":
      slicing = {
        mode: "xml",
        source: json.slicing.source,
      };
      break;
    case "manual":
    default:
      slicing = { mode: "manual" };
      break;
  }

  const frames: Record<string, FrameData> = {};
  const frameArray = Array.isArray(json.frames)
    ? json.frames
    : Object.entries(json.frames as Record<string, FrameData>).map(([id, f]) => ({ name: id, ...f }));

  for (const f of frameArray) {
    const frameName = f.name ?? (f as any).id;
    if (!frameName) continue;
    const frame: FrameData = {
      x: f.x,
      y: f.y,
      w: f.w,
      h: f.h,
    };
    if (f.collider) {
      const colliderShapes = Array.isArray(f.collider)
        ? (f.collider as ColliderShape[])
        : (f.collider as { shapes?: ColliderShape[] }).shapes;
      if (colliderShapes && colliderShapes.length > 0) {
        frame.collider = colliderShapes;
      }
    }
    if (f.tags && f.tags.length > 0) frame.tags = [...f.tags];
    if (f.properties && Object.keys(f.properties).length > 0) {
      frame.properties = { ...f.properties };
    }
    if (f.trimmed !== undefined) frame.trimmed = f.trimmed;
    if (f.sourceWidth !== undefined) frame.sourceWidth = f.sourceWidth;
    if (f.sourceHeight !== undefined) frame.sourceHeight = f.sourceHeight;
    if (f.offsetX !== undefined) frame.offsetX = f.offsetX;
    if (f.offsetY !== undefined) frame.offsetY = f.offsetY;
    if (f.rotated !== undefined) frame.rotated = f.rotated;
    frames[frameName] = frame;
  }

  let imageWidth = 0;
  let imageHeight = 0;
  for (const f of Object.values(frames)) {
    imageWidth = Math.max(imageWidth, f.x + f.w);
    imageHeight = Math.max(imageHeight, f.y + f.h);
  }

  return {
    id: json.id,
    name: json.name,
    image: imageUrl,
    sourcePath: json.image,
    imageWidth,
    imageHeight,
    slicing,
    frames,
  };
}

/**
 * 将 SpriteSheet 转换为紧凑格式的 JSON 字符串（每个 frame 一行）
 */
export function formatSpriteSheetJson(sheet: SpriteSheet, overrideImagePath?: string): string {
  const json = spriteSheetToJson(sheet, overrideImagePath);
  
  const header = {
    type: json.type,
    version: json.version,
    id: json.id,
    name: json.name,
    image: json.image,
    slicing: json.slicing,
  };
  
  const headerStr = JSON.stringify(header, null, 2).slice(0, -1).trimEnd();
  
  const framesLines = json.frames.map((frame) => {
    const fields: Record<string, unknown> = {
      name: frame.name,
      x: frame.x,
      y: frame.y,
      w: frame.w,
      h: frame.h,
    };
    if (frame.collider) fields.collider = frame.collider;
    if (frame.tags) fields.tags = frame.tags;
    if (frame.properties) fields.properties = frame.properties;
    if (frame.trimmed !== undefined) fields.trimmed = frame.trimmed;
    if (frame.sourceWidth !== undefined) fields.sourceWidth = frame.sourceWidth;
    if (frame.sourceHeight !== undefined) fields.sourceHeight = frame.sourceHeight;
    if (frame.offsetX !== undefined) fields.offsetX = frame.offsetX;
    if (frame.offsetY !== undefined) fields.offsetY = frame.offsetY;
    if (frame.rotated !== undefined) fields.rotated = frame.rotated;
    return JSON.stringify(fields);
  });
  
  let output = headerStr + ",\n  \"frames\": [\n";
  output += framesLines.map((line) => "    " + line).join(",\n");
  output += "\n  ]\n}";
  
  return output;
}

/**
 * 保存 SpriteSheet 到文件（紧凑格式）
 */
export async function saveSpriteSheet(
  sheet: SpriteSheet,
  fileHandle: FileSystemFileHandle
): Promise<void> {
  const json = formatSpriteSheetJson(sheet);
  await writeJsonFile(fileHandle, json);
}

/**
 * 从文件加载 SpriteSheet
 */
export async function loadSpriteSheet(
  fileHandle: FileSystemFileHandle,
  imageUrl: string
): Promise<SpriteSheet | null> {
  try {
    const json = await readJsonFile(fileHandle);
    if (!isSpriteSheetJson(json)) {
      console.error("Invalid sprite sheet file format");
      return null;
    }
    return spriteSheetFromJson(json, imageUrl);
  } catch (e) {
    console.error("Failed to load sprite sheet:", e);
    return null;
  }
}
