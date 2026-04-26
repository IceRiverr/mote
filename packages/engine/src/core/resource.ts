// engine/src/core/resource.ts
// 全局资源存储 —— 非 Entity 的共享对象（渲染器、音频上下文等）

function normalizeKey(key: string | Function): string {
  return typeof key === 'string' ? key : key.name;
}

export class ResourceStore {
  private resources = new Map<string, any>();

  /**
   * 添加全局资源（支持 string 或 class 做 key）
   * @throws 如果 key 已存在
   */
  add<T>(key: string | Function, value: T): void {
    const k = normalizeKey(key);
    if (this.resources.has(k)) {
      throw new Error(`[Resource] "${k}" already exists. Use replace() to overwrite.`);
    }
    this.resources.set(k, value);
  }

  /**
   * 获取全局资源（支持 string 或 class 做 key）
   * @throws 如果 key 不存在
   */
  get<T>(key: string | Function): T {
    const k = normalizeKey(key);
    const value = this.resources.get(k);
    if (value === undefined && !this.resources.has(k)) {
      throw new Error(`[Resource] "${k}" not found`);
    }
    return value as T;
  }

  /**
   * 尝试获取，不存在返回 undefined
   */
  tryGet<T>(key: string | Function): T | undefined {
    return this.resources.get(normalizeKey(key)) as T | undefined;
  }

  /**
   * 是否存在
   */
  has(key: string | Function): boolean {
    return this.resources.has(normalizeKey(key));
  }

  /**
   * 替换已有资源
   */
  replace<T>(key: string | Function, value: T): void {
    this.resources.set(normalizeKey(key), value);
  }

  /**
   * 移除资源
   */
  remove(key: string | Function): boolean {
    return this.resources.delete(normalizeKey(key));
  }

  /**
   * 清空
   */
  clear(): void {
    this.resources.clear();
  }
}
