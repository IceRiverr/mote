/**
 * 微尘引擎 — 资源加载器接口与注册表
 */

/**
 * 资源加载器接口
 */
export interface AssetLoader<T> {
  /** 资源类型标识 */
  type: string;
  /** 支持的扩展名 */
  extensions: string[];
  /** 加载资源 */
  load(path: string, data: ArrayBuffer | string): Promise<T>;
  /** 可选：释放资源 */
  unload?(resource: T): void;
}

/**
 * 加载器注册表
 */
export class LoaderRegistry {
  private loaders = new Map<string, AssetLoader<any>>();

  register<T>(loader: AssetLoader<T>): void {
    for (const ext of loader.extensions) {
      const normalized = ext.toLowerCase().replace(/^\./, "");
      this.loaders.set(normalized, loader);
    }
  }

  get<T>(path: string): AssetLoader<T> | undefined {
    const ext = path.split(".").pop()?.toLowerCase();
    if (!ext) return undefined;
    return this.loaders.get(ext) as AssetLoader<T> | undefined;
  }
}

/** 全局单例 */
export const assetLoaders = new LoaderRegistry();
