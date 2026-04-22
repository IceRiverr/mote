// engine/src/core/component.ts
// 组件注册表 —— 字符串名 ↔ Class 映射

import type { ComponentClass } from './types';

/** 字符串名 → ComponentClass 的运行时映射 */
const registry = new Map<string, ComponentClass>();

export const ComponentRegistry = {
  /**
   * 注册组件类
   * 默认使用 class.name 作为 key
   */
  register<T>(cls: ComponentClass<T>, name?: string): void {
    const key = name ?? cls.name;
    if (registry.has(key)) {
      console.warn(`[ComponentRegistry] "${key}" already registered, overwriting`);
    }
    registry.set(key, cls);
  },

  /**
   * 通过名称获取组件类
   */
  get(name: string): ComponentClass | undefined {
    return registry.get(name);
  },

  /**
   * 通过名称获取组件类（不存在则抛错）
   */
  getOrThrow(name: string): ComponentClass {
    const cls = registry.get(name);
    if (!cls) {
      throw new Error(`[ComponentRegistry] Component "${name}" not registered`);
    }
    return cls;
  },

  /**
   * 是否已注册
   */
  has(name: string): boolean {
    return registry.has(name);
  },

  /**
   * 获取组件类的注册名
   */
  nameOf(cls: ComponentClass): string | undefined {
    for (const [name, c] of registry) {
      if (c === cls) return name;
    }
    return undefined;
  },

  /**
   * 获取所有已注册的组件名
   */
  names(): string[] {
    return Array.from(registry.keys());
  },

  /**
   * 清空注册表
   */
  clear(): void {
    registry.clear();
  },

  /**
   * 通过 class 创建一个组件实例，并用 partial data 覆盖默认值
   */
  createInstance<T>(cls: ComponentClass<T>, data?: Partial<T>): T {
    const instance = new cls();
    if (data) {
      Object.assign(instance as object, data);
    }
    return instance;
  },

  /**
   * 通过名称创建组件实例
   */
  createByName(name: string, data?: Record<string, any>): any {
    const cls = this.getOrThrow(name);
    return this.createInstance(cls, data);
  },
};
