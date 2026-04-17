// ═══════════════════════════════════════════════════════════════
// SceneFS.ts - Scene 文件系统操作
// 
// 设计原则：
// - 所有资源相对于 assetsDir，不预设任何子目录结构
// - 以文件路径为唯一键
// - 扫描整个 assets/ 目录递归查找 .mote-scene.json
// ═══════════════════════════════════════════════════════════════

import type { Scene } from '../data/Scene';
import { validateScene } from '../data/Scene';
import { FileSystem, getFileSystem } from './FileSystem';

/**
 * Scene 文件扩展名
 */
export const SCENE_EXTENSION = '.mote-scene.json';

/**
 * Scene 元数据
 */
export interface SceneMeta {
  id: string;
  name: string;
  path: string;
  lastModified: number;
  entityCount: number;
}

/**
 * Scene 文件系统
 */
export class SceneFS {
  private fs: FileSystem;
  private cache = new Map<string, Scene>();        // path -> Scene
  private metaCache = new Map<string, SceneMeta>(); // path -> Meta
  private idToPath = new Map<string, string>();     // id -> first path
  private currentScenePath: string | null = null;
  private initialized = false;
  private assetsDir = 'assets';

  constructor(fs?: FileSystem) {
    this.fs = fs || getFileSystem();
  }

  /**
   * 设置资源根目录（默认 assets）
   */
  setAssetsDir(dir: string): void {
    this.assetsDir = dir || 'assets';
  }

  /**
   * 获取资源根目录
   */
  getAssetsDir(): string {
    return this.assetsDir;
  }

  /**
   * 将相对于 assetsDir 的路径解析为项目根目录下的完整相对路径
   */
  private resolveAssetPath(relativePath: string): string {
    return `${this.assetsDir}/${relativePath}`;
  }

  // ═══════════════════════════════════════════════════════════════
  // 初始化
  // ═══════════════════════════════════════════════════════════════

  /**
   * 初始化 Scene 系统
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) return true;
    await this.scanScenes();
    this.initialized = true;
    return true;
  }

  /**
   * 重新扫描所有 Scene
   */
  async rescan(): Promise<void> {
    this.cache.clear();
    this.metaCache.clear();
    this.idToPath.clear();
    await this.scanScenes();
  }

  // ═══════════════════════════════════════════════════════════════
  // 读写操作
  // ═══════════════════════════════════════════════════════════════

  /**
   * 保存 Scene
   * @param scene - 要保存的场景
   * @param relativePath - 相对于 assetsDir 的文件路径（可选，默认使用 scene.path）
   */
  async save(scene: Scene, relativePath?: string): Promise<boolean> {
    const targetPath = relativePath || scene.path;
    if (!targetPath) {
      throw new Error('Scene save failed: no path provided and scene.path is not set');
    }
    if (!targetPath.endsWith(SCENE_EXTENSION)) {
      throw new Error(`Scene path must end with ${SCENE_EXTENSION}: "${targetPath}"`);
    }

    // 更新 scene 的 path
    scene = { ...scene, path: targetPath };

    // 确保父目录存在（基于项目根目录）
    const assetPath = this.resolveAssetPath(targetPath);
    const dir = assetPath.split('/').slice(0, -1).join('/');
    if (dir) {
      await this.fs.createDirectory(dir);
    }

    // 序列化（移除运行时状态）
    const toSave = this.serializeScene(scene);
    const content = JSON.stringify(toSave, null, 2);

    // 写入文件
    const success = await this.fs.writeFile(assetPath, content);

    if (success) {
      this.cache.set(targetPath, scene);
      this.metaCache.set(targetPath, {
        id: scene.id,
        name: scene.name,
        path: targetPath,
        lastModified: Date.now(),
        entityCount: scene.entities.length,
      });
      if (!this.idToPath.has(scene.id)) {
        this.idToPath.set(scene.id, targetPath);
      }
    }

    return success;
  }

  /**
   * 快速保存（使用当前场景的 path）
   */
  async quickSave(): Promise<boolean> {
    if (!this.currentScenePath) {
      console.error('No current scene to save');
      return false;
    }

    const scene = this.cache.get(this.currentScenePath);
    if (!scene) {
      console.error('Current scene not found in cache');
      return false;
    }

    return await this.save(scene);
  }

  /**
   * 从指定路径加载 Scene
   */
  async loadFromPath(filePath: string): Promise<Scene | null> {
    // 先检查缓存
    if (this.cache.has(filePath)) {
      return this.cache.get(filePath)!;
    }

    const assetPath = this.resolveAssetPath(filePath);
    const content = await this.fs.readFile(assetPath);
    if (!content) return null;

    try {
      const data = JSON.parse(content);
      
      if (!validateScene(data)) {
        console.error(`Invalid scene format: ${filePath}`);
        return null;
      }

      const scene = data as Scene;
      scene.path = filePath;
      
      // 确保所有实体都有 ID
      scene.entities = scene.entities.map((e, i) => ({
        ...e,
        id: e.id || `e_${Date.now()}_${i}`,
      }));

      // 更新缓存
      this.cache.set(filePath, scene);
      this.metaCache.set(filePath, {
        id: scene.id,
        name: scene.name,
        path: filePath,
        lastModified: Date.now(),
        entityCount: scene.entities.length,
      });
      if (!this.idToPath.has(scene.id)) {
        this.idToPath.set(scene.id, filePath);
      }

      // 设置为当前场景
      this.currentScenePath = filePath;

      return scene;
    } catch (err) {
      console.error(`Failed to parse scene ${filePath}:`, err);
      return null;
    }
  }

  /**
   * 通过 ID 加载 Scene（返回第一个匹配的）
   */
  async load(id: string): Promise<Scene | null> {
    const path = this.idToPath.get(id);
    if (path) {
      return await this.loadFromPath(path);
    }
    await this.scanScenes();
    const foundPath = this.idToPath.get(id);
    if (foundPath) {
      return await this.loadFromPath(foundPath);
    }
    return null;
  }

  /**
   * 创建新 Scene
   */
  async create(id: string, name: string, width = 640, height = 480, relativePath?: string): Promise<Scene | null> {
    const filePath = relativePath || `${id}${SCENE_EXTENSION}`;
    const scene: Scene = {
      id,
      name,
      path: filePath,
      width,
      height,
      grid: {
        enabled: true,
        size: 32,
        snap: true,
        color: 'rgba(255, 255, 255, 0.2)',
      },
      entities: [],
    };

    const success = await this.save(scene, filePath);
    return success ? scene : null;
  }

  /**
   * 删除 Scene（通过路径）
   */
  async delete(filePath: string): Promise<boolean> {
    const meta = this.metaCache.get(filePath);
    if (!meta) {
      console.warn(`Scene not found at path: ${filePath}`);
      return false;
    }

    const assetPath = this.resolveAssetPath(filePath);
    const success = await this.fs.remove(assetPath);

    if (success) {
      this.cache.delete(filePath);
      this.metaCache.delete(filePath);
      if (this.idToPath.get(meta.id) === filePath) {
        this.idToPath.delete(meta.id);
        for (const [p, m] of this.metaCache) {
          if (m.id === meta.id) {
            this.idToPath.set(meta.id, p);
            break;
          }
        }
      }
      if (this.currentScenePath === filePath) {
        this.currentScenePath = null;
      }
    }

    return success;
  }

  /**
   * 重命名 Scene（只改 name，不改 id 和 path）
   */
  async rename(filePath: string, newName: string): Promise<boolean> {
    const scene = await this.loadFromPath(filePath);
    if (!scene) return false;

    const updatedScene: Scene = {
      ...scene,
      name: newName,
    };

    return await this.save(updatedScene, filePath);
  }

  /**
   * 复制 Scene
   */
  async duplicate(sourcePath: string, newId: string, newPath: string): Promise<Scene | null> {
    const scene = await this.loadFromPath(sourcePath);
    if (!scene) return null;

    // 检查新路径是否已存在
    if (await this.fs.exists(this.resolveAssetPath(newPath))) {
      console.error(`Scene file already exists: ${newPath}`);
      return null;
    }

    const duplicated: Scene = {
      ...scene,
      id: newId,
      name: `${scene.name} (Copy)`,
      path: newPath,
      entities: scene.entities.map((e, i) => ({
        ...e,
        id: `e_${Date.now()}_${i}`,
      })),
    };

    const success = await this.save(duplicated, newPath);
    return success ? duplicated : null;
  }

  // ═══════════════════════════════════════════════════════════════
  // 当前场景管理
  // ═══════════════════════════════════════════════════════════════

  /**
   * 设置当前场景（通过路径）
   */
  setCurrent(filePath: string): boolean {
    if (!this.cache.has(filePath) && !this.metaCache.has(filePath)) {
      console.warn(`Scene ${filePath} not found`);
      return false;
    }
    this.currentScenePath = filePath;
    return true;
  }

  /**
   * 获取当前场景
   */
  getCurrent(): Scene | null {
    if (!this.currentScenePath) return null;
    return this.cache.get(this.currentScenePath) || null;
  }

  /**
   * 获取当前场景路径
   */
  getCurrentPath(): string | null {
    return this.currentScenePath;
  }

  /**
   * 更新当前场景（内存中）
   * 注意：需要调用 save() 才能持久化
   */
  updateCurrent(updates: Partial<Scene>): boolean {
    if (!this.currentScenePath) return false;

    const scene = this.cache.get(this.currentScenePath);
    if (!scene) return false;

    const updated: Scene = { ...scene, ...updates };
    this.cache.set(this.currentScenePath, updated);

    // 更新元数据
    const meta = this.metaCache.get(this.currentScenePath);
    if (meta) {
      meta.entityCount = updated.entities.length;
      if (updates.name) meta.name = updated.name;
      if (updates.id) meta.id = updated.id;
    }

    return true;
  }

  // ═══════════════════════════════════════════════════════════════
  // 查询操作
  // ═══════════════════════════════════════════════════════════════

  /**
   * 获取所有 Scene
   */
  async getAll(): Promise<Scene[]> {
    await this.ensureInitialized();
    return Array.from(this.cache.values());
  }

  /**
   * 获取所有 Scene 元数据
   */
  getAllMeta(): SceneMeta[] {
    return Array.from(this.metaCache.values()).sort(
      (a, b) => a.path.localeCompare(b.path)
    );
  }

  /**
   * 获取单个 Scene 元数据
   */
  getMeta(path: string): SceneMeta | undefined {
    return this.metaCache.get(path);
  }

  /**
   * 检查 Scene 文件是否存在
   */
  async exists(filePath: string): Promise<boolean> {
    if (this.cache.has(filePath) || this.metaCache.has(filePath)) return true;
    return await this.fs.exists(this.resolveAssetPath(filePath));
  }

  /**
   * 搜索 Scene
   */
  async search(query: string): Promise<Scene[]> {
    await this.ensureInitialized();

    const lowerQuery = query.toLowerCase();
    const results: Scene[] = [];

    for (const [path, scene] of this.cache) {
      const searchText = `${scene.id} ${scene.name} ${path}`.toLowerCase();
      if (searchText.includes(lowerQuery)) {
        results.push(scene);
      }
    }

    return results.sort((a, b) => a.name.localeCompare(b.name));
  }

  // ═══════════════════════════════════════════════════════════════
  // 导出功能
  // ═══════════════════════════════════════════════════════════════

  /**
   * 导出为 ECS 格式（移除 Editor 专用数据）
   */
  async exportForECS(filePath: string): Promise<object | null> {
    const scene = await this.loadFromPath(filePath);
    if (!scene) return null;

    return {
      id: scene.id,
      name: scene.name,
      bounds: {
        width: scene.width,
        height: scene.height,
      },
      entities: scene.entities.map(e => {
        const t = e.overrides?.Transform;
        return {
          id: e.id,
          prefab: e.prefab,
          parent: e.parent,
          x: t?.x ?? 0,
          y: t?.y ?? 0,
          rotation: t?.rotation ?? 0,
          scaleX: t?.scaleX ?? 1,
          scaleY: t?.scaleY ?? 1,
          overrides: e.overrides,
        };
      }),
    };
  }

  // ═══════════════════════════════════════════════════════════════
  // 自动保存
  // ═══════════════════════════════════════════════════════════════

  private autoSaveInterval: number | null = null;

  /**
   * 启用自动保存
   */
  enableAutoSave(intervalMs = 30000): void {
    this.disableAutoSave();
    this.autoSaveInterval = window.setInterval(() => {
      this.quickSave();
    }, intervalMs);
  }

  /**
   * 禁用自动保存
   */
  disableAutoSave(): void {
    if (this.autoSaveInterval !== null) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
  }

  /**
   * 是否启用了自动保存
   */
  isAutoSaveEnabled(): boolean {
    return this.autoSaveInterval !== null;
  }

  // ═══════════════════════════════════════════════════════════════
  // 私有方法
  // ═══════════════════════════════════════════════════════════════

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private async scanScenes(): Promise<void> {
    try {
      for await (const entry of this.scanDirectory(this.assetsDir)) {
        if (entry.kind === 'file' && entry.name.endsWith(SCENE_EXTENSION)) {
          // entry.path 是 assetsDir/xxx，去掉前缀得到相对于 assetsDir 的路径
          const relativePath = entry.path.slice(this.assetsDir.length + 1);
          await this.loadFromPath(relativePath);
        }
      }
    } catch (err) {
      console.log(`Scan directory ${this.assetsDir} not found or empty`);
    }
  }

  private async *scanDirectory(dirPath: string): AsyncGenerator<{
    name: string;
    kind: 'file' | 'directory';
    path: string;
  }> {
    try {
      for await (const entry of this.fs.listDirectory(dirPath)) {
        const fullPath = `${dirPath}/${entry.name}`;
        yield {
          name: entry.name,
          kind: entry.kind,
          path: fullPath,
        };
        if (entry.kind === 'directory') {
          yield* this.scanDirectory(fullPath);
        }
      }
    } catch (err) {
      // ignore
    }
  }

  private serializeScene(scene: Scene): object {
    // 移除运行时状态，只保留持久化数据
    return {
      id: scene.id,
      name: scene.name,
      width: scene.width,
      height: scene.height,
      grid: scene.grid,
      entities: scene.entities,
    };
  }
}

// ═══════════════════════════════════════════════════════════════
// 单例导出
// ═══════════════════════════════════════════════════════════════

let sceneFSInstance: SceneFS | null = null;

/**
 * 获取 SceneFS 实例
 */
export function getSceneFS(fs?: FileSystem): SceneFS {
  if (!sceneFSInstance) {
    sceneFSInstance = new SceneFS(fs);
  }
  return sceneFSInstance;
}

/**
 * 重置 SceneFS 实例
 */
export function resetSceneFS(): void {
  sceneFSInstance = null;
}
