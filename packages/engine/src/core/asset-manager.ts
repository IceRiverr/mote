import { assetLoaders, type AssetLoader } from "./loader";
import { resolveAssetPath, validateAssetPath } from "./path";

/**
 * 资源管理器
 */
export class AssetManager {
  private cache = new Map<string, any>();

  constructor(private assetsRoot: string) {}

  /**
   * 加载资源（通用接口）
   */
  async load<T>(
    relativePath: string,
    options?: { cache?: boolean; loader?: AssetLoader<T> }
  ): Promise<T> {
    const error = validateAssetPath(relativePath);
    if (error) {
      throw new Error(`Invalid asset path "${relativePath}": ${error}`);
    }

    const cacheKey = relativePath;
    if (options?.cache !== false && this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    const fullPath = resolveAssetPath(this.assetsRoot, relativePath);
    const loader = options?.loader || assetLoaders.get<T>(relativePath);
    if (!loader) {
      throw new Error(`No loader found for: ${relativePath}`);
    }

    const data = await this.fetch(fullPath);
    const resource = await loader.load(relativePath, data);

    if (options?.cache !== false) {
      this.cache.set(cacheKey, resource);
    }
    return resource;
  }

  /**
   * 清除缓存
   */
  clearCache(): void {
    this.cache.clear();
  }

  private async fetch(path: string): Promise<ArrayBuffer> {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to fetch asset: ${path} (${response.status})`);
    }
    return response.arrayBuffer();
  }
}
