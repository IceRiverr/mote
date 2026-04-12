// ═══════════════════════════════════════════════════════════════
// PrefabFS.ts - Prefab 文件系统操作
// 
// 标准目录结构：
// project/
// ├── prefabs/
// │   ├── characters/
// │   ├── environment/
// │   └── items/
// └── ...
// ═══════════════════════════════════════════════════════════════

import type { Prefab } from '../data/Prefab';
import { validatePrefab, getPrefabDisplayName } from '../data/Prefab';
import { FileSystem, getFileSystem } from './FileSystem';

/**
 * Prefab 文件扩展名
 */
export const PREFAB_EXTENSION = '.prefab.json';

/**
 * Prefab 元数据（用于索引）
 */
export interface PrefabMeta {
  id: string;
  name: string;
  category: string;
  path: string;           // 文件路径，如 "prefabs/environment/grass_01.prefab.json"
  lastModified: number;
}

/**
 * Prefab 文件系统
 */
export class PrefabFS {
  private fs: FileSystem;
  private cache = new Map<string, Prefab>();      // id -> Prefab
  private metaCache = new Map<string, PrefabMeta>(); // id -> Meta
  private initialized = false;

  constructor(fs?: FileSystem) {
    this.fs = fs || getFileSystem();
  }

  // ═══════════════════════════════════════════════════════════════
  // 初始化
  // ═══════════════════════════════════════════════════════════════

  /**
   * 初始化 Prefab 系统
   * - 创建 prefabs/ 目录（如果不存在）
   * - 扫描并缓存所有 Prefab
   */
  async initialize(): Promise<boolean> {
    if (this.initialized) return true;

    // 确保目录存在
    await this.fs.createDirectory('prefabs');

    // 扫描加载所有 Prefab
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
    await this.scanPrefabs();
  }

  // ═══════════════════════════════════════════════════════════════
  // 读写操作
  // ═══════════════════════════════════════════════════════════════

  /**
   * 保存 Prefab
   * @param prefab - 要保存的 Prefab
   * @param category - 分类（决定子目录），可选
   */
  async save(prefab: Prefab, category?: string): Promise<boolean> {
    const cat = category || prefab.category || 'uncategorized';
    const fileName = `${prefab.id}${PREFAB_EXTENSION}`;
    const filePath = `prefabs/${cat}/${fileName}`;

    // 确保分类目录存在
    await this.fs.createDirectory(`prefabs/${cat}`);

    // 序列化
    const content = JSON.stringify(prefab, null, 2);

    // 写入文件
    const success = await this.fs.writeFile(filePath, content);

    if (success) {
      // 更新缓存
      this.cache.set(prefab.id, prefab);
      this.metaCache.set(prefab.id, {
        id: prefab.id,
        name: prefab.name,
        category: cat,
        path: filePath,
        lastModified: Date.now(),
      });
    }

    return success;
  }

  /**
   * 加载单个 Prefab
   */
  async load(id: string): Promise<Prefab | null> {
    // 先检查缓存
    if (this.cache.has(id)) {
      return this.cache.get(id)!;
    }

    // 从元数据获取路径
    const meta = this.metaCache.get(id);
    if (meta) {
      return await this.loadFromPath(meta.path);
    }

    // 尝试在 prefabs/ 目录下查找
    const found = await this.findPrefabFile(id);
    if (found) {
      return await this.loadFromPath(found);
    }

    return null;
  }

  /**
   * 从指定路径加载 Prefab
   */
  async loadFromPath(filePath: string): Promise<Prefab | null> {
    const content = await this.fs.readFile(filePath);
    if (!content) return null;

    try {
      const data = JSON.parse(content);
      
      if (!validatePrefab(data)) {
        console.error(`Invalid prefab format: ${filePath}`);
        return null;
      }

      const prefab = data as Prefab;
      
      // 提取分类
      const category = this.extractCategoryFromPath(filePath);
      
      // 更新缓存
      this.cache.set(prefab.id, prefab);
      this.metaCache.set(prefab.id, {
        id: prefab.id,
        name: prefab.name,
        category,
        path: filePath,
        lastModified: Date.now(),
      });

      return prefab;
    } catch (err) {
      console.error(`Failed to parse prefab ${filePath}:`, err);
      return null;
    }
  }

  /**
   * 删除 Prefab
   */
  async delete(id: string): Promise<boolean> {
    const meta = this.metaCache.get(id);
    if (!meta) {
      console.warn(`Prefab not found: ${id}`);
      return false;
    }

    const success = await this.fs.remove(meta.path);
    
    if (success) {
      this.cache.delete(id);
      this.metaCache.delete(id);
    }

    return success;
  }

  /**
   * 重命名/移动 Prefab
   */
  async move(id: string, newId?: string, newCategory?: string): Promise<boolean> {
    const prefab = await this.load(id);
    if (!prefab) return false;

    const meta = this.metaCache.get(id)!;

    // 确定新路径
    const targetId = newId || prefab.id;
    const targetCategory = newCategory || meta.category;
    const newPath = `prefabs/${targetCategory}/${targetId}${PREFAB_EXTENSION}`;

    // 如果路径没变，直接返回成功
    if (newPath === meta.path && targetId === prefab.id) {
      return true;
    }

    // 确保目标目录存在
    await this.fs.createDirectory(`prefabs/${targetCategory}`);

    // 更新 Prefab
    const updatedPrefab: Prefab = {
      ...prefab,
      id: targetId,
      category: targetCategory,
    };

    // 保存到新位置
    const success = await this.save(updatedPrefab, targetCategory);

    if (success && newPath !== meta.path) {
      // 删除旧文件
      await this.fs.remove(meta.path);
      
      // 如果 ID 变了，删除旧的缓存
      if (targetId !== id) {
        this.cache.delete(id);
        this.metaCache.delete(id);
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
   * 获取所有分类
   */
  getCategories(): string[] {
    const categories = new Set<string>();
    for (const meta of this.metaCache.values()) {
      categories.add(meta.category);
    }
    return Array.from(categories).sort();
  }

  /**
   * 按分类获取 Prefab
   */
  async getByCategory(category: string): Promise<Prefab[]> {
    await this.ensureInitialized();
    
    const results: Prefab[] = [];
    for (const [id, meta] of this.metaCache) {
      if (meta.category === category) {
        const prefab = this.cache.get(id);
        if (prefab) results.push(prefab);
      }
    }
    
    return results.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * 搜索 Prefab
   */
  async search(query: string): Promise<Prefab[]> {
    await this.ensureInitialized();
    
    const lowerQuery = query.toLowerCase();
    const results: Prefab[] = [];
    
    for (const prefab of this.cache.values()) {
      const searchText = `${prefab.id} ${prefab.name} ${prefab.description || ''}`.toLowerCase();
      if (searchText.includes(lowerQuery)) {
        results.push(prefab);
      }
    }
    
    return results.sort((a, b) => a.name.localeCompare(b.name));
  }

  /**
   * 获取 Prefab 元数据
   */
  getMeta(id: string): PrefabMeta | undefined {
    return this.metaCache.get(id);
  }

  /**
   * 检查 Prefab 是否存在
   */
  has(id: string): boolean {
    return this.cache.has(id);
  }

  // ═══════════════════════════════════════════════════════════════
  // 批量操作
  // ═══════════════════════════════════════════════════════════════

  /**
   * 批量保存 Prefab
   */
  async saveAll(prefabs: Prefab[]): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const prefab of prefabs) {
      const ok = await this.save(prefab);
      if (ok) success++; else failed++;
    }

    return { success, failed };
  }

  /**
   * 从 Sprite Atlas 批量生成并保存
   */
  async generateFromSprites(
    sprites: Array<{ atlas: string; frame: string; collider?: any }>,
    options: {
      prefix?: string;
      category?: string;
      autoCollider?: boolean;
    }
  ): Promise<Prefab[]> {
    const { prefix, category = 'from-sprite', autoCollider = true } = options;

    const created: Prefab[] = [];

    for (let i = 0; i < sprites.length; i++) {
      const { atlas, frame, collider } = sprites[i];
      
      // 生成 ID
      const num = (i + 1).toString().padStart(2, '0');
      const id = prefix ? `${prefix}_${num}` : `${atlas}_${frame}`;

      // 检查是否已存在
      if (this.has(id)) {
        console.warn(`Prefab ${id} already exists, skipping`);
        continue;
      }

      // 创建 Prefab
      const prefab: Prefab = {
        id,
        name: id,
        category,
        components: {
          Transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
          Sprite: {
            atlas,
            frame,
            layer: 0,
            tint: '#ffffff',
            flipX: false,
            flipY: false,
            alpha: 1,
            visible: true,
          },
        },
      };

      // 添加碰撞体
      if (autoCollider && collider) {
        prefab.components.Collider = {
          shapes: collider,
          isTrigger: false,
          material: 'default',
          layer: 1,
          mask: 0xFFFFFFFF,
        };
      }

      // 保存
      const success = await this.save(prefab, category);
      if (success) {
        created.push(prefab);
      }
    }

    return created;
  }

  // ═══════════════════════════════════════════════════════════════
  // 私有方法
  // ═══════════════════════════════════════════════════════════════

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  private async scanPrefabs(dirPath: string = 'prefabs'): Promise<void> {
    try {
      for await (const entry of this.fs.listDirectory(dirPath)) {
        const fullPath = `${dirPath}/${entry.name}`;

        if (entry.kind === 'directory') {
          // 递归扫描子目录
          await this.scanPrefabs(fullPath);
        } else if (entry.kind === 'file' && entry.name.endsWith(PREFAB_EXTENSION)) {
          // 加载 Prefab
          await this.loadFromPath(fullPath);
        }
      }
    } catch (err) {
      // 目录可能不存在，忽略错误
      console.log(`Scan directory ${dirPath} not found or empty`);
    }
  }

  private async findPrefabFile(id: string): Promise<string | null> {
    const fileName = `${id}${PREFAB_EXTENSION}`;
    
    // 扫描所有子目录
    for await (const entry of this.fs.listDirectory('prefabs')) {
      if (entry.kind === 'directory') {
        const candidate = `prefabs/${entry.name}/${fileName}`;
        if (await this.fs.exists(candidate)) {
          return candidate;
        }
      }
    }
    
    return null;
  }

  private extractCategoryFromPath(filePath: string): string {
    const parts = filePath.split('/');
    // prefabs/category/name.prefab.json
    if (parts.length >= 2) {
      return parts[parts.length - 2];
    }
    return 'uncategorized';
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
