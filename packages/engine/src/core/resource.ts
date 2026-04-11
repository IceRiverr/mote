// engine/src/core/resource.ts
// 全局资源存储 —— 非 Entity 的共享对象（渲染器、音频上下文等）

export class ResourceStore {
  private resources = new Map<string, any>();

  /**
   * 添加全局资源
   * @throws 如果 key 已存在
   */
  add<T>(key: string, value: T): void {
    if (this.resources.has(key)) {
      throw new Error(`[Resource] "${key}" already exists. Use replace() to overwrite.`);
    }
    this.resources.set(key, value);
  }

  /**
   * 获取全局资源
   * @throws 如果 key 不存在
   */
  get<T>(key: string): T {
    const value = this.resources.get(key);
    if (value === undefined && !this.resources.has(key)) {
      throw new Error(`[Resource] "${key}" not found`);
    }
    return value as T;
  }

  /**
   * 尝试获取，不存在返回 undefined
   */
  tryGet<T>(key: string): T | undefined {
    return this.resources.get(key) as T | undefined;
  }

  /**
   * 是否存在
   */
  has(key: string): boolean {
    return this.resources.has(key);
  }

  /**
   * 替换已有资源
   */
  replace<T>(key: string, value: T): void {
    this.resources.set(key, value);
  }

  /**
   * 移除资源
   */
  remove(key: string): boolean {
    return this.resources.delete(key);
  }

  /**
   * 清空
   */
  clear(): void {
    this.resources.clear();
  }
}
