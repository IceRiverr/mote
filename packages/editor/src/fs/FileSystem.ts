// ═══════════════════════════════════════════════════════════════
// FileSystem.ts - 文件系统抽象层
// 
// 提供统一的文件操作接口，支持：
// - File System Access API (Chrome/Edge)
// - 传统文件下载/上传 (降级方案)
// ═══════════════════════════════════════════════════════════════

/**
 * 文件系统配置
 */
export interface FileSystemConfig {
  /** 建议的目录名称 */
  suggestedName?: string;
  /** 文件类型过滤器 */
  types?: FilePickerAcceptType[];
}

/**
 * 文件句柄（抽象）
 */
export interface FileHandle {
  readonly name: string;
  readonly kind: 'file';
  getFile(): Promise<File>;
  createWritable(): Promise<FileSystemWritableFileStream>;
}

/**
 * 目录句柄（抽象）
 */
export interface DirectoryHandle {
  readonly name: string;
  readonly kind: 'directory';
  
  /**
   * 获取子文件
   */
  getFileHandle(name: string, options?: { create?: boolean }): Promise<FileHandle | null>;
  
  /**
   * 获取子目录
   */
  getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<DirectoryHandle | null>;
  
  /**
   * 删除条目
   */
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  
  /**
   * 列出所有条目
   */
  entries(): AsyncIterableIterator<[string, FileHandle | DirectoryHandle]>;
  
  /**
   * 解析路径
   */
  resolve(possibleDescendant: FileSystemHandle): Promise<string[] | null>;
}

/**
 * 文件系统句柄联合类型
 */
export type FileSystemHandle = FileHandle | DirectoryHandle;

// ═══════════════════════════════════════════════════════════════
// 检测 API 支持
// ═══════════════════════════════════════════════════════════════

function isFileSystemAccessAPISupported(): boolean {
  return 'showOpenFilePicker' in window && 'showDirectoryPicker' in window;
}

// ═══════════════════════════════════════════════════════════════
// File System Access API 实现
// ═══════════════════════════════════════════════════════════════

/**
 * 使用原生 File System Access API
 */
export class FileSystemAccessAPI {
  private directoryHandle: FileSystemDirectoryHandle | null = null;

  /**
   * 选择项目目录
   */
  async selectDirectory(): Promise<boolean> {
    try {
      this.directoryHandle = await (window as any).showDirectoryPicker();
      return true;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        return false; // 用户取消
      }
      console.error('Failed to select directory:', err);
      return false;
    }
  }

  /**
   * 获取已打开的目录
   */
  getDirectory(): FileSystemDirectoryHandle | null {
    return this.directoryHandle;
  }

  /**
   * 获取或创建子目录
   */
  async getOrCreateDirectory(name: string): Promise<FileSystemDirectoryHandle | null> {
    if (!this.directoryHandle) return null;
    
    try {
      return await this.directoryHandle.getDirectoryHandle(name, { create: true });
    } catch (err) {
      console.error(`Failed to get/create directory ${name}:`, err);
      return null;
    }
  }

  /**
   * 获取或创建文件
   */
  async getOrCreateFile(
    dirHandle: FileSystemDirectoryHandle,
    name: string
  ): Promise<FileSystemFileHandle | null> {
    try {
      return await dirHandle.getFileHandle(name, { create: true });
    } catch (err) {
      console.error(`Failed to get/create file ${name}:`, err);
      return null;
    }
  }

  /**
   * 写入文件
   */
  async writeFile(
    fileHandle: FileSystemFileHandle,
    content: string | Blob | ArrayBuffer
  ): Promise<boolean> {
    try {
      const writable = await fileHandle.createWritable();
      
      if (typeof content === 'string') {
        await writable.write(new TextEncoder().encode(content));
      } else {
        await writable.write(content);
      }
      
      await writable.close();
      return true;
    } catch (err) {
      console.error('Failed to write file:', err);
      return false;
    }
  }

  /**
   * 读取文件
   */
  async readFile(fileHandle: FileSystemFileHandle): Promise<string | null> {
    try {
      const file = await fileHandle.getFile();
      return await file.text();
    } catch (err) {
      console.error('Failed to read file:', err);
      return null;
    }
  }

  /**
   * 检查文件是否存在
   */
  async exists(path: string): Promise<boolean> {
    if (!this.directoryHandle) return false;
    
    try {
      const parts = path.split('/').filter(p => p);
      let current: FileSystemDirectoryHandle = this.directoryHandle;
      
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLast = i === parts.length - 1;
        
        try {
          if (isLast) {
            await current.getFileHandle(part);
          } else {
            current = await current.getDirectoryHandle(part);
          }
        } catch {
          return false;
        }
      }
      
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 列出目录内容
   */
  async *listDirectory(dirHandle?: FileSystemDirectoryHandle): AsyncGenerator<{
    name: string;
    kind: 'file' | 'directory';
    handle: FileSystemHandle;
  }> {
    const target = dirHandle || this.directoryHandle;
    if (!target) return;

    for await (const [name, handle] of target.entries()) {
      yield {
        name,
        kind: handle.kind,
        handle: handle as FileSystemHandle,
      };
    }
  }

  /**
   * 删除文件或目录
   */
  async remove(path: string, recursive = false): Promise<boolean> {
    if (!this.directoryHandle) return false;
    
    try {
      await this.directoryHandle.removeEntry(path, { recursive });
      return true;
    } catch (err) {
      console.error(`Failed to remove ${path}:`, err);
      return false;
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 降级方案：传统文件下载/上传
// ═══════════════════════════════════════════════════════════════

/**
 * 内存中的虚拟文件系统（降级方案）
 */
export class InMemoryFileSystem {
  private files = new Map<string, { content: string; type: string }>();

  /**
   * 保存文件（触发下载）
   */
  async saveFile(path: string, content: string, type = 'application/json'): Promise<void> {
    // 内存中存储
    this.files.set(path, { content, type });
    
    // 触发下载
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = path.split('/').pop() || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  /**
   * 读取文件（通过文件选择）
   */
  async loadFile(): Promise<{ path: string; content: string } | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,.prefab,.scene';
      
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) {
          resolve(null);
          return;
        }
        
        try {
          const content = await file.text();
          resolve({
            path: file.name,
            content,
          });
        } catch (err) {
          console.error('Failed to read file:', err);
          resolve(null);
        }
      };
      
      input.click();
    });
  }

  /**
   * 获取内存中的文件
   */
  getFile(path: string): string | null {
    return this.files.get(path)?.content || null;
  }

  /**
   * 列出所有文件
   */
  listFiles(): string[] {
    return Array.from(this.files.keys());
  }

  /**
   * 删除文件
   */
  deleteFile(path: string): boolean {
    return this.files.delete(path);
  }
}

// ═══════════════════════════════════════════════════════════════
// 统一文件系统接口
// ═══════════════════════════════════════════════════════════════

export type FileSystemMode = 'native' | 'fallback' | 'auto';

/**
 * 统一的文件系统管理器
 */
export class FileSystem {
  private mode: FileSystemMode;
  private nativeFS: FileSystemAccessAPI | null = null;
  private fallbackFS: InMemoryFileSystem | null = null;
  private projectRoot: FileSystemDirectoryHandle | null = null;

  constructor(mode: FileSystemMode = 'auto') {
    this.mode = mode === 'auto' 
      ? (isFileSystemAccessAPISupported() ? 'native' : 'fallback')
      : mode;
    
    if (this.mode === 'native') {
      this.nativeFS = new FileSystemAccessAPI();
    } else {
      this.fallbackFS = new InMemoryFileSystem();
    }
  }

  /**
   * 获取当前模式
   */
  getMode(): FileSystemMode {
    return this.mode;
  }

  /**
   * 是否支持原生文件系统
   */
  isNativeSupported(): boolean {
    return this.mode === 'native';
  }

  /**
   * 打开/创建项目目录
   */
  async openProject(): Promise<boolean> {
    if (this.mode === 'native' && this.nativeFS) {
      const success = await this.nativeFS.selectDirectory();
      if (success) {
        this.projectRoot = this.nativeFS.getDirectory();
      }
      return success;
    } else {
      // Fallback 模式不需要选择目录
      return true;
    }
  }

  /**
   * 获取项目根目录
   */
  getProjectRoot(): FileSystemDirectoryHandle | null {
    return this.projectRoot;
  }

  /**
   * 写入文件
   */
  async writeFile(path: string, content: string): Promise<boolean> {
    if (this.mode === 'native' && this.nativeFS && this.projectRoot) {
      const parts = path.split('/').filter(p => p);
      if (parts.length === 0) return false;

      try {
        // 逐级创建目录
        let currentDir = this.projectRoot;
        for (let i = 0; i < parts.length - 1; i++) {
          currentDir = await currentDir.getDirectoryHandle(parts[i], { create: true });
        }

        const fileName = parts[parts.length - 1];
        const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
        return await this.nativeFS.writeFile(fileHandle, content);
      } catch (err) {
        console.error(`Failed to write file ${path}:`, err);
        return false;
      }
    } else if (this.fallbackFS) {
      await this.fallbackFS.saveFile(path, content);
      return true;
    }
    
    return false;
  }

  /**
   * 读取文件
   */
  async readFile(path: string): Promise<string | null> {
    if (this.mode === 'native' && this.nativeFS && this.projectRoot) {
      const parts = path.split('/').filter(p => p);
      if (parts.length === 0) return null;

      try {
        let currentDir = this.projectRoot;
        for (let i = 0; i < parts.length - 1; i++) {
          currentDir = await currentDir.getDirectoryHandle(parts[i]);
        }

        const fileName = parts[parts.length - 1];
        const fileHandle = await currentDir.getFileHandle(fileName);
        return await this.nativeFS.readFile(fileHandle);
      } catch (err) {
        console.error(`Failed to read file ${path}:`, err);
        return null;
      }
    } else if (this.fallbackFS) {
      return this.fallbackFS.getFile(path);
    }
    
    return null;
  }

  /**
   * 检查文件是否存在
   */
  async exists(path: string): Promise<boolean> {
    if (this.mode === 'native' && this.nativeFS) {
      return await this.nativeFS.exists(path);
    } else if (this.fallbackFS) {
      return this.fallbackFS.getFile(path) !== null;
    }
    return false;
  }

  /**
   * 创建目录
   */
  async createDirectory(path: string): Promise<boolean> {
    if (this.mode === 'native' && this.nativeFS && this.projectRoot) {
      const parts = path.split('/').filter(p => p);
      
      try {
        let currentDir = this.projectRoot;
        for (const part of parts) {
          currentDir = await currentDir.getDirectoryHandle(part, { create: true });
        }
        return true;
      } catch (err) {
        console.error(`Failed to create directory ${path}:`, err);
        return false;
      }
    }
    
    // Fallback 模式不需要创建目录
    return true;
  }

  /**
   * 列出目录内容
   */
  async *listDirectory(path: string = ''): AsyncGenerator<{
    name: string;
    kind: 'file' | 'directory';
  }> {
    if (this.mode === 'native' && this.nativeFS && this.projectRoot) {
      try {
        let targetDir = this.projectRoot;
        
        if (path) {
          const parts = path.split('/').filter(p => p);
          for (const part of parts) {
            targetDir = await targetDir.getDirectoryHandle(part);
          }
        }

        for await (const entry of this.nativeFS.listDirectory(targetDir)) {
          yield {
            name: entry.name,
            kind: entry.kind,
          };
        }
      } catch (err) {
        console.error(`Failed to list directory ${path}:`, err);
      }
    } else if (this.fallbackFS) {
      const files = this.fallbackFS.listFiles()
        .filter(f => f.startsWith(path))
        .map(f => f.slice(path.length).split('/')[0])
        .filter((v, i, a) => a.indexOf(v) === i);
      
      for (const name of files) {
        yield { name, kind: 'file' };
      }
    }
  }

  /**
   * 删除文件或目录
   */
  async remove(path: string, recursive = false): Promise<boolean> {
    if (this.mode === 'native' && this.nativeFS) {
      return await this.nativeFS.remove(path, recursive);
    } else if (this.fallbackFS) {
      return this.fallbackFS.deleteFile(path);
    }
    return false;
  }

  /**
   * 读取多个文件（批量）
   */
  async readFiles(pattern: RegExp): Promise<Array<{ path: string; content: string }>> {
    const results: Array<{ path: string; content: string }> = [];
    
    for await (const entry of this.listDirectory()) {
      if (entry.kind === 'file' && pattern.test(entry.name)) {
        const content = await this.readFile(entry.name);
        if (content !== null) {
          results.push({ path: entry.name, content });
        }
      }
    }
    
    return results;
  }
}

// ═══════════════════════════════════════════════════════════════
// 单例导出
// ═══════════════════════════════════════════════════════════════

let fileSystemInstance: FileSystem | null = null;

/**
 * 获取文件系统实例（单例）
 */
export function getFileSystem(mode?: FileSystemMode): FileSystem {
  if (!fileSystemInstance || (mode && fileSystemInstance.getMode() !== mode)) {
    fileSystemInstance = new FileSystem(mode);
  }
  return fileSystemInstance;
}

/**
 * 重置文件系统实例
 */
export function resetFileSystem(): void {
  fileSystemInstance = null;
}

// 类型导出
export type { FileSystemMode };
