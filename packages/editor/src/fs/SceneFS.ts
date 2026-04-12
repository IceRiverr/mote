// ═══════════════════════════════════════════════════════════════
// SceneFS.ts - Scene 文件系统操作
// 
// 标准目录结构：
// project/
// ├── scenes/
// │   ├── level_01.scene.json
// │   ├── level_02.scene.json
// │   └── ...
// └── ...
// ═══════════════════════════════════════════════════════════════

import type { Scene } from '../data/Scene';
import { validateScene } from '../data/Scene';
import { FileSystem, getFileSystem } from './FileSystem';

/**
 * Scene 文件扩展名
 */
export const SCENE_EXTENSION = '.scene.json';

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
  private cache = new Map<string, Scene>();        // id -> Scene
  private metaCache = new Map<string, SceneMeta>(); // id -> Meta
  private currentSceneId: string | null = null;
  private initialized = false;

  constructor(fs?: FileSystem) {
    this.fs = fs || getFileSystem();
  }

  // ═══════════════════════════════════════════════════════════════
  // 初始化
  // ═══════════════════════════════════════════════════════════════

  /**
   * 初始化 Scene 系统
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) return true;

    // 确保目录存在
    await this.fs.createDirectory('scenes');

    // 扫描加载所有 Scene
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
    await this.scanScenes();
  }

  // ═══════════════════════════════════════════════════════════════
  // 读写操作
  // ═══════════════════════════════════════════════════════════════

  /**
   * 保存 Scene
   */
  async save(scene: Scene): Promise<boolean> {
    const fileName = `${scene.id}${SCENE_EXTENSION}`;
    const filePath = `scenes/${fileName}`;

    // 序列化（移除运行时状态）
    const toSave = this.serializeScene(scene);
    const content = JSON.stringify(toSave, null, 2);

    // 写入文件
    const success = await this.fs.writeFile(filePath, content);

    if (success) {
      // 更新缓存
      this.cache.set(scene.id, scene);
      this.metaCache.set(scene.id, {
        id: scene.id,
        name: scene.name,
        path: filePath,
        lastModified: Date.now(),
        entityCount: scene.entities.length,
      });
    }

    return success;
  }

  /**
   * 快速保存（使用已知的 scene id）
   */
  async quickSave(): Promise<boolean> {
    if (!this.currentSceneId) {
      console.error('No current scene to save');
      return false;
    }

    const scene = this.cache.get(this.currentSceneId);
    if (!scene) {
      console.error('Current scene not found in cache');
      return false;
    }

    return await this.save(scene);
  }

  /**
   * 加载 Scene
   */
  async load(id: string): Promise<Scene | null> {
    // 先检查缓存
    if (this.cache.has(id)) {
      return this.cache.get(id)!;
    }

    // 从元数据获取路径
    const meta = this.metaCache.get(id);
    if (meta) {
      return await this.loadFromPath(meta.path);
    }

    // 尝试默认路径
    const defaultPath = `scenes/${id}${SCENE_EXTENSION}`;
    if (await this.fs.exists(defaultPath)) {
      return await this.loadFromPath(defaultPath);
    }

    return null;
  }

  /**
   * 从指定路径加载 Scene
   */
  async loadFromPath(filePath: string): Promise<Scene | null> {
    const content = await this.fs.readFile(filePath);
    if (!content) return null;

    try {
      const data = JSON.parse(content);
      
      if (!validateScene(data)) {
        console.error(`Invalid scene format: ${filePath}`);
        return null;
      }

      const scene = data as Scene;
      
      // 确保所有实体都有 ID
      scene.entities = scene.entities.map((e, i) => ({
        ...e,
        id: e.id || `e_${Date.now()}_${i}`,
      }));

      // 更新缓存
      this.cache.set(scene.id, scene);
      this.metaCache.set(scene.id, {
        id: scene.id,
        name: scene.name,
        path: filePath,
        lastModified: Date.now(),
        entityCount: scene.entities.length,
      });

      // 设置为当前场景
      this.currentSceneId = scene.id;

      return scene;
    } catch (err) {
      console.error(`Failed to parse scene ${filePath}:`, err);
      return null;
    }
  }

  /**
   * 创建新 Scene
   */
  async create(id: string, name: string, width = 640, height = 480): Promise<Scene | null> {
    const scene: Scene = {
      id,
      name,
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

    const success = await this.save(scene);
    return success ? scene : null;
  }

  /**
   * 删除 Scene
   */
  async delete(id: string): Promise<boolean> {
    const meta = this.metaCache.get(id);
    if (!meta) {
      console.warn(`Scene not found: ${id}`);
      return false;
    }

    const success = await this.fs.remove(meta.path);

    if (success) {
      this.cache.delete(id);
      this.metaCache.delete(id);

      // 如果删除的是当前场景，清除当前场景
      if (this.currentSceneId === id) {
        this.currentSceneId = null;
      }
    }

    return success;
  }

  /**
   * 重命名 Scene
   */
  async rename(id: string, newName: string): Promise<boolean> {
    const scene = await this.load(id);
    if (!scene) return false;

    const updatedScene: Scene = {
      ...scene,
      name: newName,
    };

    return await this.save(updatedScene);
  }

  /**
   * 复制 Scene
   */
  async duplicate(id: string, newId: string): Promise<Scene | null> {
    const scene = await this.load(id);
    if (!scene) return null;

    // 检查新 ID 是否已存在
    if (await this.exists(newId)) {
      console.error(`Scene ${newId} already exists`);
      return null;
    }

    const duplicated: Scene = {
      ...scene,
      id: newId,
      name: `${scene.name} (Copy)`,
      entities: scene.entities.map((e, i) => ({
        ...e,
        id: `e_${Date.now()}_${i}`,
      })),
    };

    const success = await this.save(duplicated);
    return success ? duplicated : null;
  }

  // ═══════════════════════════════════════════════════════════════
  // 当前场景管理
  // ═══════════════════════════════════════════════════════════════

  /**
   * 设置当前场景
   */
  setCurrent(id: string): boolean {
    if (!this.cache.has(id) && !this.metaCache.has(id)) {
      console.warn(`Scene ${id} not found`);
      return false;
    }
    this.currentSceneId = id;
    return true;
  }

  /**
   * 获取当前场景
   */
  getCurrent(): Scene | null {
    if (!this.currentSceneId) return null;
    return this.cache.get(this.currentSceneId) || null;
  }

  /**
   * 获取当前场景 ID
   */
  getCurrentId(): string | null {
    return this.currentSceneId;
  }

  /**
   * 更新当前场景（内存中）
   * 注意：需要调用 save() 才能持久化
   */
  updateCurrent(updates: Partial<Scene>): boolean {
    if (!this.currentSceneId) return false;

    const scene = this.cache.get(this.currentSceneId);
    if (!scene) return false;

    const updated: Scene = { ...scene, ...updates };
    this.cache.set(this.currentSceneId, updated);

    // 更新元数据
    const meta = this.metaCache.get(this.currentSceneId);
    if (meta) {
      meta.entityCount = updated.entities.length;
      if (updates.name) meta.name = updates.name;
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
      (a, b) => a.name.localeCompare(b.name)
    );
  }

  /**
   * 获取单个 Scene 元数据
   */
  getMeta(id: string): SceneMeta | undefined {
    return this.metaCache.get(id);
  }

  /**
   * 检查 Scene 是否存在
   */
  async exists(id: string): Promise<boolean> {
    if (this.cache.has(id) || this.metaCache.has(id)) return true;
    
    const filePath = `scenes/${id}${SCENE_EXTENSION}`;
    return await this.fs.exists(filePath);
  }

  /**
   * 搜索 Scene
   */
  async search(query: string): Promise<Scene[]> {
    await this.ensureInitialized();

    const lowerQuery = query.toLowerCase();
    const results: Scene[] = [];

    for (const scene of this.cache.values()) {
      const searchText = `${scene.id} ${scene.name}`.toLowerCase();
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
  async exportForECS(id: string): Promise<object | null> {
    const scene = await this.load(id);
    if (!scene) return null;

    return {
      id: scene.id,
      name: scene.name,
      bounds: {
        width: scene.width,
        height: scene.height,
      },
      entities: scene.entities.map(e => ({
        id: e.id,
        prefab: e.prefab,
        x: e.x,
        y: e.y,
        rotation: e.rotation,
        scaleX: e.scaleX,
        scaleY: e.scaleY,
        overrides: e.overrides,
      })),
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
      for await (const entry of this.fs.listDirectory('scenes')) {
        if (entry.kind === 'file' && entry.name.endsWith(SCENE_EXTENSION)) {
          const filePath = `scenes/${entry.name}`;
          await this.loadFromPath(filePath);
        }
      }
    } catch (err) {
      console.log('Scenes directory not found or empty');
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
