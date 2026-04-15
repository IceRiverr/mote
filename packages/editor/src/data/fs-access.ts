// ═══════════════════════════════════════════════════════════════
// fs-access.ts - File System Access API 封装
// 提供现代化的文件系统操作接口
// ═══════════════════════════════════════════════════════════════

// File System Access API 类型定义
export interface FileSystemHandle {
  kind: 'file' | 'directory';
  name: string;
}

export interface FileSystemFileHandle extends FileSystemHandle {
  kind: 'file';
  getFile(): Promise<File>;
  createWritable(): Promise<FileSystemWritableFileStream>;
}

export interface FileSystemDirectoryHandle extends FileSystemHandle {
  kind: 'directory';
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  resolve(possibleDescendant: FileSystemHandle): Promise<string[] | null>;
  entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
}

export interface FileSystemWritableFileStream extends WritableStream {
  write(data: any): Promise<void>;
  close(): Promise<void>;
}

declare global {
  interface Window {
    showDirectoryPicker(options?: { mode?: 'read' | 'readwrite' }): Promise<FileSystemDirectoryHandle>;
    showOpenFilePicker(options?: any): Promise<FileSystemFileHandle[]>;
    showSaveFilePicker(options?: any): Promise<FileSystemFileHandle>;
  }
}

/**
 * 文件系统权限状态
 */
export type PermissionState = "granted" | "denied" | "prompt";

/**
 * 项目文件夹结构
 */
export interface ProjectFolder {
  handle: FileSystemDirectoryHandle;
  name: string;
}

/**
 * 请求选择项目文件夹
 */
export async function selectProjectFolder(): Promise<ProjectFolder | null> {
  try {
    const handle = await (window as any).showDirectoryPicker({
      mode: "readwrite",
    });

    return {
      handle,
      name: handle.name,
    };
  } catch (e) {
    // 用户取消或 API 不支持
    console.warn("Failed to select project folder:", e);
    return null;
  }
}

/**
 * 请求文件访问权限
 */
export async function requestPermission(
  handle: FileSystemHandle
): Promise<boolean> {
  try {
    const state = await (handle as any).requestPermission({
      mode: "readwrite",
    });
    return state === "granted";
  } catch (e) {
    console.error("Permission request failed:", e);
    return false;
  }
}

/**
 * 验证权限状态
 */
export async function queryPermission(
  handle: FileSystemHandle
): Promise<PermissionState> {
  try {
    const state = await (handle as any).queryPermission({
      mode: "readwrite",
    });
    return state;
  } catch (e) {
    return "denied";
  }
}

/**
 * 读取目录下的所有文件（递归可选）
 */
export async function readDirectory(
  dirHandle: FileSystemDirectoryHandle,
  options: { recursive?: boolean; pattern?: RegExp } = {}
): Promise<{ path: string; handle: FileSystemFileHandle }[]> {
  const files: { path: string; handle: FileSystemFileHandle }[] = [];

  for await (const [name, entry] of (dirHandle as any).entries()) {
    const entryPath = name;

    if (entry.kind === "file") {
      // 检查是否匹配模式
      if (options.pattern && !options.pattern.test(entryPath)) {
        continue;
      }
      files.push({
        path: entryPath,
        handle: entry as FileSystemFileHandle,
      });
    } else if (entry.kind === "directory" && options.recursive) {
      // 递归读取子目录
      const subFiles = await readDirectory(
        entry as FileSystemDirectoryHandle,
        options
      );
      files.push(
        ...subFiles.map((f) => ({
          path: `${entryPath}/${f.path}`,
          handle: f.handle,
        }))
      );
    }
  }

  return files;
}

/**
 * 获取指定路径的文件句柄（如果不存在则创建）
 */
export async function getFileHandle(
  dirHandle: FileSystemDirectoryHandle,
  path: string,
  options: { create?: boolean } = {}
): Promise<FileSystemFileHandle | null> {
  const parts = path.split("/");
  let currentDir = dirHandle;

  // 遍历中间目录
  for (let i = 0; i < parts.length - 1; i++) {
    try {
      currentDir = await currentDir.getDirectoryHandle(parts[i], {
        create: options.create,
      });
    } catch (e) {
      console.error(`Failed to get directory: ${parts[i]}`, e);
      return null;
    }
  }

  // 获取文件
  const fileName = parts[parts.length - 1];
  try {
    return await currentDir.getFileHandle(fileName, {
      create: options.create,
    });
  } catch (e) {
    if (!options.create) {
      return null;
    }
    console.error(`Failed to get file handle: ${fileName}`, e);
    return null;
  }
}

/**
 * 读取文件内容为 JSON
 */
export async function readJsonFile(
  fileHandle: FileSystemFileHandle
): Promise<unknown> {
  try {
    const file = await fileHandle.getFile();
    const text = await file.text();
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to read JSON file:", e);
    throw e;
  }
}

/**
 * 写入 JSON 内容到文件
 */
export async function writeJsonFile(
  fileHandle: FileSystemFileHandle,
  data: unknown,
  options: { pretty?: boolean } = {}
): Promise<void> {
  try {
    const writable = await (fileHandle as any).createWritable();
    const json = options.pretty !== false
      ? JSON.stringify(data, null, 2)
      : JSON.stringify(data);
    await writable.write(json);
    await writable.close();
  } catch (e) {
    console.error("Failed to write JSON file:", e);
    throw e;
  }
}

/**
 * 创建目录结构
 */
export async function ensureDirectory(
  dirHandle: FileSystemDirectoryHandle,
  path: string
): Promise<FileSystemDirectoryHandle> {
  const parts = path.split("/").filter(Boolean);
  let current = dirHandle;

  for (const part of parts) {
    current = await current.getDirectoryHandle(part, { create: true });
  }

  return current;
}

/**
 * 检查文件是否存在
 */
export async function fileExists(
  dirHandle: FileSystemDirectoryHandle,
  path: string
): Promise<boolean> {
  try {
    await getFileHandle(dirHandle, path, { create: false });
    return true;
  } catch {
    return false;
  }
}

/**
 * 检查是否支持 File System Access API
 */
export function isFileSystemAccessSupported(): boolean {
  return typeof window !== 'undefined' && 'showOpenFilePicker' in window;
}

/**
 * 将 SpriteSheet 转换为紧凑格式的 JSON 字符串（每个 frame 一行）
 */
async function formatSpriteSheetJson(sheet: any): Promise<string> {
  const { spriteSheetToJson } = await import('./io-v2');
  const json = spriteSheetToJson(sheet);
  
  // 构建头部（不包含 frames 数组）
  const header = {
    type: json.type,
    version: json.version,
    id: json.id,
    name: json.name,
    image: json.image,
    slicing: json.slicing,
  };
  
  const headerStr = JSON.stringify(header, null, 2).slice(0, -1).trimEnd();
  
  // 每个 frame 一行
  const framesLines = json.frames.map((frame: any) => {
    const fields: Record<string, unknown> = {
      id: frame.id,
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
  
  let output = headerStr + ',\n  "frames": [\n';
  output += framesLines.map((line: string) => '    ' + line).join(',\n');
  output += '\n  ]\n}';
  
  return output;
}

/**
 * 导出 SpriteSheet 到文件（使用文件选择器）
 */
export async function exportSpriteSheetWithPicker(
  sheet: any,
  options: { saveImage?: boolean } = {}
): Promise<void> {
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: `${sheet.name || 'sprites'}.mote-sprite.json`,
      types: [{
        description: 'Mote Sprite JSON',
        accept: { 'application/json': ['.json'] }
      }]
    });
    
    const writable = await (handle as any).createWritable();
    const json = await formatSpriteSheetJson(sheet);
    await writable.write(json);
    await writable.close();
  } catch (e: any) {
    if (e.name !== 'AbortError') {
      throw e;
    }
  }
}

/**
 * 下载内容作为文件（兼容回退）
 */
export function downloadAsFallback(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * 下载 JSON 数据
 */
export function downloadJson(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  downloadAsFallback(json, filename);
}