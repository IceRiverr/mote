// engine/src/core/component.ts
// ComponentRegistry —— 组件类型身份管理

import type { ComponentClass } from './types';
import type { ComponentSchema } from './schema.js';

// ═════════════════════════════════════════════════════════════════════════════
// 类型
// ═════════════════════════════════════════════════════════════════════════════

/** 组件元信息 */
export interface ComponentMeta {
  /** 数字 id（运行时唯一，O(1) 查询） */
  id: number;
  /** 注册名称 */
  name: string;
  /** 构造函数 */
  ctor: ComponentClass;
  /** 编辑器 Schema（可选，由 extract-schemas.ts 生成） */
  schema?: ComponentSchema;
}

// ═════════════════════════════════════════════════════════════════════════════
// ComponentRegistry
// ═════════════════════════════════════════════════════════════════════════════

/**
 * 组件类型注册表 —— 给每个 component class 分配运行时可用的"身份"
 *
 * 职责：
 * - 为每个 class 分配唯一的数字 id
 * - 维护 name → class → id 的三向映射
 * - 提供实例工厂（通过 class 或 name 创建实例）
 *
 * 注意：Registry 不存任何 entity 或实例数据，只存"类型元信息"。
 */
export class ComponentRegistry {
  private _nextId = 0;
  private _byName = new Map<string, ComponentMeta>();
  private _byCtor = new Map<ComponentClass, ComponentMeta>();
  private _byId: ComponentMeta[] = [];

  /**
   * 注册组件类，返回元信息（已注册则返回已有）
   */
  register<T>(ctor: ComponentClass<T>, name?: string, schema?: ComponentSchema): ComponentMeta {
    const existing = this._byCtor.get(ctor);
    if (existing) return existing;

    const key = name ?? ctor.name;
    if (this._byName.has(key)) {
      console.warn(`[ComponentRegistry] "${key}" already registered, overwriting`);
    }

    const meta: ComponentMeta = {
      id: this._nextId++,
      name: key,
      ctor,
      schema,
    };

    this._byName.set(key, meta);
    this._byCtor.set(ctor, meta);
    this._byId[meta.id] = meta;

    return meta;
  }

  /**
   * @internal 运行时数字 id 不稳定，不对外暴露
   */
  metaById(id: number): ComponentMeta | undefined {
    return this._byId[id];
  }

  /**
   * 获取所有带 schema 的组件元信息（供编辑器使用）
   */
  schemas(): ComponentSchema[] {
    return this._byId
      .filter(m => m?.schema)
      .map(m => m.schema!);
  }

  /**
   * 批量挂载 schema（用于运行时从 JSON 注入）
   *
   * 典型场景：
   *   1. Headless Engine 启动后，把构建时生成的 component-schemas.json
   *      通过 attachSchemas() 灌入 Registry
   *   2. Editor 直接读 app.registry.schemas() 获取所有组件定义
   *
   * 只给已注册组件附加 schema，不认识的组件名静默跳过
   */
  attachSchemas(schemas: ComponentSchema[]): void {
    for (const s of schemas) {
      const meta = this._byName.get(s.name);
      if (meta) {
        meta.schema = s;
      }
    }
  }

  /**
   * @internal 运行时数字 id 不稳定，不对外暴露
   */
  idOf(ctor: ComponentClass): number {
    const meta = this._byCtor.get(ctor);
    if (!meta) throw new Error(`[ComponentRegistry] Component "${ctor.name}" not registered`);
    return meta.id;
  }

  /**
   * @internal 运行时数字 id 不稳定，不对外暴露
   */
  idOfName(name: string): number {
    const meta = this._byName.get(name);
    if (!meta) throw new Error(`[ComponentRegistry] Component "${name}" not registered`);
    return meta.id;
  }

  /**
   * @internal 内部实现细节，不对外暴露
   */
  nameOf(ctor: ComponentClass): string | undefined {
    return this._byCtor.get(ctor)?.name;
  }

  /**
   * 通过名称获取元信息
   */
  metaByName(name: string): ComponentMeta | undefined {
    return this._byName.get(name);
  }

  /**
   * 通过名称获取组件类
   */
  get(name: string): ComponentClass | undefined {
    return this._byName.get(name)?.ctor;
  }

  /**
   * 通过名称获取组件类（不存在则抛错）
   */
  getOrThrow(name: string): ComponentClass {
    const meta = this._byName.get(name);
    if (!meta) {
      throw new Error(`[ComponentRegistry] Component "${name}" not registered`);
    }
    return meta.ctor;
  }

  /**
   * 是否已注册
   */
  has(name: string): boolean {
    return this._byName.has(name);
  }

  /**
   * 获取所有已注册的组件名
   */
  names(): string[] {
    return Array.from(this._byName.keys());
  }

  /**
   * 获取已注册组件数量
   */
  get count(): number {
    return this._nextId;
  }

  /**
   * 清空注册表
   */
  clear(): void {
    this._nextId = 0;
    this._byName.clear();
    this._byCtor.clear();
    this._byId.length = 0;
  }

  /**
   * 通过 class 创建一个组件实例，并用 partial data 覆盖默认值
   */
  createInstance<T>(cls: ComponentClass<T>, data?: Partial<T>): T {
    const instance = new cls();
    if (data) {
      Object.assign(instance as object, data);
    }
    return instance;
  }

  /**
   * 通过名称创建组件实例
   */
  createByName(name: string, data?: Record<string, any>): any {
    const cls = this.getOrThrow(name);
    return this.createInstance(cls, data);
  }
}
