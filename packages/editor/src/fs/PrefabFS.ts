// ═══════════════════════════════════════════════════════════════
// PrefabFS.ts - Prefab 文件系统操作
// 
// 设计原则：
// - 所有资源相对于 assetsDir，不预设任何子目录结构
// - 以文件路径为唯一键，不依赖 id 唯一性
// - 扫描整个 assets/ 目录递归查找 .mote-prefab.json
// ═══════════════════════════════════════════════════════════════

import type { Prefab } from '../data/Prefab';
import { validatePrefab, getPrefabDisplayName } from '../data/Prefab';
import { FileSystem, getFileSystem } from './FileSystem';

/**
 * Prefab 文件扩展名
 */
export const PREFAB_EXTENSION = '.mote-prefab.json';

/**
 * Prefab 元数据（用于索引）
 */
export interface PrefabMeta {
  id: string;
  name: string;
  path: string;           // 文件路径，如 "prefabs/environment/grass_01.mote-prefab.json"
  lastModified: number;
}

/**
 * Prefab 文件系统
 */
export class PrefabFS {
  private fs: FileSystem;
  private cache = new Map<string, Prefab>();      // path -> Prefab
  private metaCache = new Map<string, PrefabMeta>(); // path -> Meta
  private idToPath = new Map<string, string>();     // id -> first path
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
   * 初始化 Prefab 系统
   * - 扫描并缓存所有 Prefab（递归整个 assetsDir）
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) return true;
    await this.scanPrefabs();
    this.initialized = true;
    return true;
  }

  /**
   * 重新扫描所有 Prefab
   */
  async rescan(): Promise<void> {
    this.cache.clear();
    this.metaCache.clear();
    this.idToPath.clear();
    await this.scanPrefabs();
  }

  // ═══════════════════════════════════════════════════════════════
  // 读写操作
  // ═══════════════════════════════════════════════════════════════

  /**
   * 保存 Prefab
   * @param prefab - 要保存的 Prefab
   * @param relativePath - 相对于 assetsDir 的文件路径（必须包含扩展名）
   */
  async save(prefab: Prefab, relativePath: string): Promise<boolean> {
    if (!relativePath.endsWith(PREFAB_EXTENSION)) {
      throw new Error(`Prefab path must end with ${PREFAB_EXTENSION}: "${relativePath}"`);
    }

    // 确保父目录存在（基于项目根目录）
    const assetPath = this.resolveAssetPath(relativePath);
    const dir = assetPath.split('/').slice(0, -1).join('/');
    if (dir) {
      await this.fs.createDirectory(dir);
    }

    // 序列化
    const content = JSON.stringify(prefab, null, 2);

    // 写入文件
    const success = await this.fs.writeFile(assetPath, content);

    if (success) {
      this.cache.set(relativePath, prefab);
      this.metaCache.set(relativePath, {
        id: prefab.id,
        name: prefab.name,
        path: relativePath,
        lastModified: Date.now(),
      });
      if (!this.idToPath.has(prefab.id)) {
        this.idToPath.set(prefab.id, relativePath);
      }
    }

    return success;
  }

  /**
   * 加载单个 Prefab（通过路径）
   */
  async loadFromPath(filePath: string): Promise<Prefab | null> {
    // 先检查缓存
    if (this.cache.has(filePath)) {
      return this.cache.get(filePath)!;
    }

    const assetPath = this.resolveAssetPath(filePath);
    const content = await this.fs.readFile(assetPath);
    if (!content) return null;

    try {
      const data = JSON.parse(content);
      
      if (!validatePrefab(data)) {
        console.error(`Invalid prefab format: ${filePath}`);
        return null;
      }

      const prefab = data as Prefab;
      
      // 更新缓存
      this.cache.set(filePath, prefab);
      this.metaCache.set(filePath, {
        id: prefab.id,
        name: prefab.name,
        path: filePath,
        lastModified: Date.now(),
      });
      if (!this.idToPath.has(prefab.id)) {
        this.idToPath.set(prefab.id, filePath);
      }

      return prefab;
    } catch (err) {
      console.error(`Failed to parse prefab ${filePath}:`, err);
      return null;
    }
  }

  /**
   * 通过 ID 加载 Prefab（返回第一个匹配的）
   * 注意：路径自由后 ID 可能不唯一，建议优先使用 loadFromPath
   */
  async load(id: string): Promise<Prefab | null> {
    const path = this.idToPath.get(id);
    if (path) {
      return await this.loadFromPath(path);
    }
    // 如果 idToPath 中没有，尝试扫描查找
    await this.scanPrefabs();
    const foundPath = this.idToPath.get(id);
    if (foundPath) {
      return await this.loadFromPath(foundPath);
    }
    return null;
  }

  /**
   * 删除 Prefab（通过路径）
   */
  async delete(filePath: string): Promise<boolean> {
    const meta = this.metaCache.get(filePath);
    if (!meta) {
      console.warn(`Prefab not found at path: ${filePath}`);
      return false;
    }

    const assetPath = this.resolveAssetPath(filePath);
    const success = await this.fs.remove(assetPath);
    
    if (success) {
      this.cache.delete(filePath);
      this.metaCache.delete(filePath);
      // 清理 idToPath（如果指向被删的路径）
      if (this.idToPath.get(meta.id) === filePath) {
        this.idToPath.delete(meta.id);
        // 如果有其他同名 id 的文件，重新找一个
        for (const [p, m] of this.metaCache) {
          if (m.id === meta.id) {
            this.idToPath.set(meta.id, p);
            break;
          }
        }
      }
    }

    return success;
  }

  /**
   * 重命名/移动 Prefab
   */
  async move(oldPath: string, newPath: string, newId?: string): Promise<boolean> {
    const prefab = await this.loadFromPath(oldPath);
    if (!prefab) return false;

    const updatedPrefab: Prefab = newId ? { ...prefab, id: newId } : prefab;
    const success = await this.save(updatedPrefab, newPath);

    if (success && oldPath !== newPath) {
      await this.fs.remove(this.resolveAssetPath(oldPath));
      this.cache.delete(oldPath);
      this.metaCache.delete(oldPath);
      const oldMetaId = prefab.id;
      if (this.idToPath.get(oldMetaId) === oldPath) {
        this.idToPath.delete(oldMetaId);
      }
    }

    return success;
  }

  // ═══════════════════════════════════════════════════════════════
  // 查询操作
  // ═══════════════════════════════════════════════════════════════

  /**
   * 获取所有 Prefab
   */
  async getAll(): Promise<Prefab[]> {
    await this.ensureInitialized();
    return Array.from(this.cache.values());
  }

  /**
   * 获取所有 Prefab 的 path 列表
   */
  getAllPaths(): string[] {
    return Array.from(this.metaCache.keys()).sort();
  }

  /**
   * 获取所有 Meta
   */
  getAllMeta(): PrefabMeta[] {
    return Array.from(this.metaCache.values()).sort(
      (a, b) => a.path.localeCompare(b.path)
    );
  }

  /**
   * 搜索 Prefab
   */
  async search(query: string): Promise<Prefab[]> {
    await this.ensureInitialized();
    
    const lowerQuery = query.toLowerCase();
    const results: Prefab[] = [];
    
    for (const [path, prefab] of this.cache) {
      const searchText = `${prefab.id} ${prefab.name} ${prefab.description || ''} ${path}`.toLowerCase();
      if (searchText.includes(lowerQuery)) {
        results.push(prefab);
      }
    }
    
    return results.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * 获取 Prefab 元数据
   */
  getMeta(path: string): PrefabMeta | undefined {
    return this.metaCache.get(path);
  }

  /**
   * 通过路径检查 Prefab 是否存在
   */
  hasPath(path: string): boolean {
    return this.cache.has(path);
  }

  /**
   * 通过 ID 检查是否存在（至少一个）
   */
  has(id: string): boolean {
    return this.idToPath.has(id);
  }

  /**
   * 获取 Prefab 的路径（通过 ID，返回第一个匹配的）
   */
  getPathById(id: string): string | undefined {
    return this.idToPath.get(id);
  }

  // ═══════════════════════════════════════════════════════════════
  // 批量操作
  // ═══════════════════════════════════════════════════════════════

  /**
   * 批量保存 Prefab
   */
  async saveAll(prefabs: Array<{ prefab: Prefab; path: string }>): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const { prefab, path } of prefabs) {
      const ok = await this.save(prefab, path);
      if (ok) success++; else failed++;
    }

    return { success, failed };
  }

  // ═══════════════════════════════════════════════════════════════
  // 私有方法
  // ═══════════════════════════════════════════════════════════════

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private async scanPrefabs(): Promise<void> {
    try {
      for await (const entry of this.scanDirectory(this.assetsDir)) {
        if (entry.kind === 'file' && entry.name.endsWith(PREFAB_EXTENSION)) {
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
      // 目录可能不存在，忽略错误
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 单例导出
// ═══════════════════════════════════════════════════════════════

let prefabFSInstance: PrefabFS | null = null;

/**
 * 获取 PrefabFS 实例
 */
export function getPrefabFS(fs?: FileSystem): PrefabFS {
  if (!prefabFSInstance) {
    prefabFSInstance = new PrefabFS(fs);
  }
  return prefabFSInstance;
}

/**
 * 重置 PrefabFS 实例
 */
export function resetPrefabFS(): void {
  prefabFSInstance = null;
}
