import { openDB, type IDBPDatabase } from 'idb';
import type { ProjectConfig, FileEntry } from '../types/editor.js';

/**
 * ProjectManager - 本地文件系统管理
 * 
 * 使用 File System Access API 管理项目文件，
 * 使用 IndexedDB 持久化目录句柄和编辑器状态。
 * 
 * 注意：File System Access API 仅 Chromium 内核浏览器支持
 */
export class ProjectManager {
  private dirHandle: FileSystemDirectoryHandle | null = null;
  private db: IDBPDatabase | null = null;
  private dbName = 'mote-editor';
  private dbVersion = 1;

  /**
   * 初始化 IndexedDB
   */
  async init(): Promise<void> {
    this.db = await openDB(this.dbName, this.dbVersion, {
      upgrade(db) {
        // 编辑器状态存储
        if (!db.objectStoreNames.contains('editor-state')) {
          db.createObjectStore('editor-state', { keyPath: 'id' });
        }
        // 游戏存档
        if (!db.objectStoreNames.contains('saves')) {
          db.createObjectStore('saves', { keyPath: 'id' });
        }
        // 资源缓存
        if (!db.objectStoreNames.contains('asset-cache')) {
          db.createObjectStore('asset-cache', { keyPath: 'path' });
        }
        // 最近项目
        if (!db.objectStoreNames.contains('recent-projects')) {
          db.createObjectStore('recent-projects', { keyPath: 'path' });
        }
      },
    });
  }

  /**
   * 检查浏览器是否支持 File System Access API
   */
  isFileSystemAccessSupported(): boolean {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  }

  /**
   * 打开项目文件夹（首次使用）
   * @returns 是否成功打开
   */
  async openProject(): Promise<boolean> {
    if (!this.isFileSystemAccessSupported()) {
      throw new Error('File System Access API is not supported in this browser');
    }

    try {
      this.dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
      await this._persistProjectHandle();
      await this._addToRecentProjects();
      return true;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        return false; // 用户取消
      }
      throw err;
    }
  }

  /**
   * 恢复上次打开的项目
   * @returns 是否成功恢复
   */
  async restoreProject(): Promise<boolean> {
    if (!this.db) await this.init();
    
    const record = await this.db!.get('editor-state', 'project-dir');
    if (!record?.handle) return false;

    // 请求权限（浏览器安全策略要求每次会话重新授权）
    const perm = await record.handle.requestPermission({ mode: 'readwrite' });
    if (perm !== 'granted') return false;

    this.dirHandle = record.handle;
    return true;
  }

  /**
   * 关闭当前项目
   */
  closeProject(): void {
    this.dirHandle = null;
  }

  /**
   * 是否已打开项目
   */
  hasOpenProject(): boolean {
    return this.dirHandle !== null;
  }

  /**
   * 获取当前项目句柄
   */
  getDirectoryHandle(): FileSystemDirectoryHandle | null {
    return this.dirHandle;
  }

  /**
   * 获取项目名称（文件夹名）
   */
  getProjectName(): string | null {
    return this.dirHandle?.name ?? null;
  }

  // === 文件操作 ===

  /**
   * 读取文本文件
   */
  async readFile(relativePath: string): Promise<string> {
    const handle = await this._resolveFile(relativePath);
    const file = await handle.getFile();
    return file.text();
  }

  /**
   * 读取二进制文件
   */
  async readBlob(relativePath: string): Promise<Blob> {
    const handle = await this._resolveFile(relativePath);
    const file = await handle.getFile();
    return file;
  }

  /**
   * 读取 JSONC 文件（去注释后解析）
   */
  async readJsonc<T = unknown>(relativePath: string): Promise<T> {
    const text = await this.readFile(relativePath);
    return JSON.parse(this._stripJsonComments(text)) as T;
  }

  /**
   * 写入文本文件（不存在则创建）
   */
  async writeFile(relativePath: string, content: string): Promise<void> {
    const handle = await this._resolveFile(relativePath, true);
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
  }

  /**
   * 写入 JSON 文件（自动格式化）
   */
  async writeJson(relativePath: string, data: unknown): Promise<void> {
    await this.writeFile(relativePath, JSON.stringify(data, null, 2));
  }

  /**
   * 列出目录内容
   */
  async listDir(relativePath: string = ''): Promise<FileEntry[]> {
    const dir = relativePath
      ? await this._resolveDir(relativePath)
      : this.dirHandle!;

    const entries: FileEntry[] = [];
    for await (const [name, handle] of dir) {
      entries.push({
        name,
        kind: handle.kind,
        path: relativePath ? `${relativePath}/${name}` : name,
      });
    }
    
    return entries.sort((a, b) => {
      // 目录排前面
      if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
  }

  /**
   * 创建目录
   */
  async createDir(relativePath: string): Promise<void> {
    const parts = relativePath.split('/').filter(p => p);
    let dir = this.dirHandle!;
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create: true });
    }
  }

  /**
   * 删除文件或目录
   */
  async delete(relativePath: string): Promise<void> {
    const parts = relativePath.split('/').filter(p => p);
    const name = parts.pop()!;
    const dir = parts.length > 0
      ? await this._resolveDir(parts.join('/'))
      : this.dirHandle!;
    await dir.removeEntry(name, { recursive: true });
  }

  /**
   * 检查文件是否存在
   */
  async exists(relativePath: string): Promise<boolean> {
    try {
      await this._resolveFile(relativePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 获取文件信息
   */
  async getFileInfo(relativePath: string): Promise<{ size: number; lastModified: number } | null> {
    try {
      const handle = await this._resolveFile(relativePath);
      const file = await handle.getFile();
      return {
        size: file.size,
        lastModified: file.lastModified,
      };
    } catch {
      return null;
    }
  }

  // === 项目配置 ===

  /**
   * 读取 game.json 项目配置
   */
  async loadProjectConfig(): Promise<ProjectConfig | null> {
    try {
      return await this.readJsonc<ProjectConfig>('game.json');
    } catch {
      return null;
    }
  }

  /**
   * 保存 game.json 项目配置
   */
  async saveProjectConfig(config: ProjectConfig): Promise<void> {
    await this.writeJson('game.json', config);
  }

  // === IndexedDB 状态存储 ===

  /**
   * 保存编辑器状态
   */
  async saveEditorState(id: string, data: unknown): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.put('editor-state', { id, data, timestamp: Date.now() });
  }

  /**
   * 读取编辑器状态
   */
  async loadEditorState<T>(id: string): Promise<T | null> {
    if (!this.db) await this.init();
    const record = await this.db!.get('editor-state', id);
    return record?.data ?? null;
  }

  /**
   * 保存游戏存档
   */
  async saveGame(slotId: string, data: unknown): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.put('saves', { id: slotId, data, timestamp: Date.now() });
  }

  /**
   * 读取游戏存档
   */
  async loadGame<T>(slotId: string): Promise<{ data: T; timestamp: number } | null> {
    if (!this.db) await this.init();
    const record = await this.db!.get('saves', slotId);
    return record ? { data: record.data, timestamp: record.timestamp } : null;
  }

  /**
   * 列出所有存档
   */
  async listSaves(): Promise<string[]> {
    if (!this.db) await this.init();
    return this.db!.getAllKeys('saves') as Promise<string[]>;
  }

  /**
   * 删除存档
   */
  async deleteSave(slotId: string): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.delete('saves', slotId);
  }

  /**
   * 获取最近打开的项目列表
   */
  async getRecentProjects(): Promise<{ path: string; name: string; timestamp: number }[]> {
    if (!this.db) await this.init();
    const records = await this.db!.getAll('recent-projects');
    return records
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10);
  }

  // === 内部方法 ===

  private async _resolveFile(
    path: string,
    create = false,
  ): Promise<FileSystemFileHandle> {
    if (!this.dirHandle) throw new Error('No project opened');

    const parts = path.split('/').filter(p => p);
    const fileName = parts.pop()!;
    let dir = this.dirHandle;
    
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part, { create });
    }
    
    return dir.getFileHandle(fileName, { create });
  }

  private async _resolveDir(path: string): Promise<FileSystemDirectoryHandle> {
    if (!this.dirHandle) throw new Error('No project opened');

    const parts = path.split('/').filter(p => p);
    let dir = this.dirHandle;
    
    for (const part of parts) {
      dir = await dir.getDirectoryHandle(part);
    }
    
    return dir;
  }

  private async _persistProjectHandle(): Promise<void> {
    if (!this.db) await this.init();
    await this.db!.put('editor-state', {
      id: 'project-dir',
      handle: this.dirHandle,
      name: this.dirHandle?.name,
      timestamp: Date.now(),
    });
  }

  private async _addToRecentProjects(): Promise<void> {
    if (!this.db || !this.dirHandle) return;
    
    await this.db!.put('recent-projects', {
      path: this.dirHandle.name,
      name: this.dirHandle.name,
      timestamp: Date.now(),
    });
  }

  private _stripJsonComments(text: string): string {
    return text
      .replace(/\/\/.*$/gm, '') // 行注释
      .replace(/\/\*[\s\S]*?\*\//g, ''); // 块注释
  }
}
