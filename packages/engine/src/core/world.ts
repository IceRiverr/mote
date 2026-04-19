// engine/src/core/world.ts
// World —— ECS 核心，串联所有子系统

import type {
  EntityId,
  ComponentClass,
  SpawnConfig,
  System,
  SystemFn,
  Plugin,
  Prefab,
} from './types';
import { Entity } from './entity';
import { EventBus } from './event';
import { ResourceStore } from './resource';
import { ComponentRegistry } from './component';
import { PrefabStore, mergeSpawnConfig } from './prefab';
import { QueryResult } from './query';

/**
 * World 是 ECS 的核心容器
 * 管理实体生命周期、组件存储、查询、系统调度、事件和资源
 */
export class World {
  // ─── 内部存储 ───

  /** 下一个可用的 EntityId */
  private nextId: EntityId = 1;

  /** 存活实体集合 */
  private alive = new Set<EntityId>();

  /** EntityId → (组件名 → 组件实例) */
  private entityComponents = new Map<EntityId, Map<string, any>>();

  /** 已注册的系统列表（按注册顺序执行） */
  private systems: Array<{ name: string; update: SystemFn }> = [];

  /** 事件总线 */
  private eventBus = new EventBus();

  /** 全局资源存储 */
  private resources = new ResourceStore();

  /** Prefab 存储 */
  private prefabs = new PrefabStore();

  // ─── spawn（统一创建入口） ───

  /**
   * 创建实体的统一入口
   *
   * ```ts
   * world.spawn()                                        // 空实体
   * world.spawn({ Transform: { x: 1 }, Stats: {} })     // 声明式
   * world.spawn('goblin')                                // Prefab
   * world.spawn('goblin', { Transform: { x: 300 } })    // Prefab + override
   * ```
   */
  spawn(configOrPrefab?: string | SpawnConfig, overrides?: SpawnConfig): Entity {
    const eid = this.nextId++;
    this.alive.add(eid);
    this.entityComponents.set(eid, new Map());

    if (typeof configOrPrefab === 'string') {
      // Prefab 创建
      const prefab = this.prefabs.getOrThrow(configOrPrefab);
      const config = overrides
        ? mergeSpawnConfig(prefab.components, overrides)
        : prefab.components;
      this._applyConfig(eid, config);

      // 递归创建子实体
      if (prefab.children) {
        for (const child of prefab.children) {
          this._spawnChild(eid, child, undefined);
        }
      }
    } else if (configOrPrefab) {
      // 声明式创建
      this._applyConfig(eid, configOrPrefab);
    }

    return new Entity(eid, this);
  }

  /**
   * 递归创建子实体（内部方法）
   */
  private _spawnChild(parentId: EntityId, prefab: Prefab, overrides?: SpawnConfig): void {
    const child = this.spawn(overrides ? mergeSpawnConfig(prefab.components, overrides) : prefab.components);
    // 如果需要父子关系组件，可以在这里添加
    // child.add(Parent, { id: parentId });

    if (prefab.children) {
      for (const grandchild of prefab.children) {
        this._spawnChild(child.id, grandchild, undefined);
      }
    }
  }

  /**
   * 将 SpawnConfig 应用到实体上
   */
  private _applyConfig(eid: EntityId, config: SpawnConfig): void {
    const comps = this.entityComponents.get(eid)!;
    for (const [name, data] of Object.entries(config)) {
      const instance = ComponentRegistry.createByName(name, data as any);
      comps.set(name, instance);
    }
  }

  // ─── 实体生命周期 ───

  /**
   * 实体是否存活
   */
  isAlive(eid: EntityId): boolean {
    return this.alive.has(eid);
  }

  /**
   * 销毁实体
   */
  destroy(eid: EntityId): void {
    this.alive.delete(eid);
    this.entityComponents.delete(eid);
  }

  /**
   * 从 EntityId 获取 Entity 胖句柄
   */
  ref(eid: EntityId): Entity {
    return new Entity(eid, this);
  }

  // ─── 组件操作（World 级，供 System 内部高频使用） ───

  /**
   * 添加组件
   */
  add<T>(eid: EntityId, cls: ComponentClass<T>, data?: Partial<T>): void {
    const comps = this.entityComponents.get(eid);
    if (!comps) throw new Error(`[World] Entity #${eid} does not exist`);
    const instance = ComponentRegistry.createInstance(cls, data);
    comps.set(cls.name, instance);
  }

  /**
   * 移除组件
   */
  remove<T>(eid: EntityId, cls: ComponentClass<T>): void {
    const comps = this.entityComponents.get(eid);
    if (comps) comps.delete(cls.name);
  }

  /**
   * 获取组件实例
   */
  get<T>(eid: EntityId, cls: ComponentClass<T>): T {
    const comps = this.entityComponents.get(eid);
    if (!comps) throw new Error(`[World] Entity #${eid} does not exist`);
    return comps.get(cls.name) as T;
  }

  /**
   * 判断实体是否拥有某组件
   */
  has<T>(eid: EntityId, cls: ComponentClass<T>): boolean {
    const comps = this.entityComponents.get(eid);
    return comps ? comps.has(cls.name) : false;
  }

  // ─── 查询 ───

  /**
   * 按组件类查询匹配的实体
   *
   * ```ts
   * // 风格 A：for...of
   * for (const eid of world.query(Transform, Velocity)) {
   *   const t = world.get(eid, Transform);
   * }
   *
   * // 风格 B：each 回调
   * world.query(Transform, Velocity).each((t, v, eid) => {
   *   t.x += v.vx * dt;
   * });
   * ```
   */
  query(...components: ComponentClass[]): QueryResult {
    const names = components.map((c) => c.name);
    const matched: EntityId[] = [];

    for (const [eid, comps] of this.entityComponents) {
      if (!this.alive.has(eid)) continue;
      let match = true;
      for (const name of names) {
        if (!comps.has(name)) {
          match = false;
          break;
        }
      }
      if (match) matched.push(eid);
    }

    return new QueryResult(
      matched,
      components,
      (eid, cls) => this.get(eid, cls),
    );
  }

  // ─── 系统管理 ───

  /**
   * 注册系统（手动显式，调用顺序 = 执行顺序）
   */
  addSystem(system: System): void {
    if (typeof system === 'function') {
      this.systems.push({ name: system.name || 'anonymous', update: system });
    } else {
      this.systems.push({ name: system.name || 'anonymous', update: system.update.bind(system) });
    }
  }

  /**
   * 执行一帧更新：运行所有系统 + 处理事件队列
   */
  update(dt: number): void {
    for (const sys of this.systems) {
      sys.update(this, dt);
    }
    this.eventBus.processQueue();
  }

  // ─── 插件 ───

  /**
   * 注册插件（支持链式 + 批量 + 带选项）
   *
   * ```ts
   * // 简单插件
   * world.use(PhysicsPlugin);
   * 
   * // 带选项的插件（使用数组元组）
   * world.use([RenderPlugin, { canvas, width: 800, height: 600 }]);
   * 
   * // 混合使用（使用 await）
   * await world.use(PhysicsPlugin, [RenderPlugin, { canvas }]);
   * 
   * // 链式调用
   * await world.use(PhysicsPlugin).use([RenderPlugin, { canvas }]);
   * ```
   */
  async use(...plugins: Array<Plugin | [Plugin, any]>): Promise<this> {
    for (const item of plugins) {
      const isTuple = Array.isArray(item);
      const plugin = isTuple ? item[0] : item;
      const options = isTuple ? item[1] : undefined;
      
      if (typeof plugin !== 'function') {
        console.error('[World.use] Invalid plugin:', plugin);
        throw new TypeError(`plugin is not a function: ${plugin}`);
      }
      
      await plugin(this, options);
    }
    return this;
  }

  // ─── Prefab ───

  /**
   * 注册 Prefab 模板
   */
  registerPrefab(id: string, prefab: Prefab): void {
    this.prefabs.register(id, prefab);
  }

  // ─── 组件注册（供插件使用） ───

  /**
   * 注册组件类到全局 ComponentRegistry
   */
  registerComponent<T>(cls: ComponentClass<T>, name?: string): void {
    ComponentRegistry.register(cls, name);
  }

  // ─── 资源 ───

  /**
   * 添加全局资源
   */
  addResource<T>(key: string, value: T): void {
    this.resources.add(key, value);
  }

  /**
   * 获取全局资源
   */
  getResource<T>(key: string): T {
    return this.resources.get<T>(key);
  }

  // ─── 事件 ───

  /**
   * 立即派发事件
   */
  emit(event: string, data?: any): void {
    this.eventBus.emit(event, data);
  }

  /**
   * 将事件加入队列（延迟到 update 末尾处理）
   */
  enqueue(event: string, data?: any): void {
    this.eventBus.enqueue(event, data);
  }

  /**
   * 监听事件
   */
  on(event: string, handler: (data: any) => void): void {
    this.eventBus.on(event, handler);
  }

  /**
   * 移除事件监听
   */
  off(event: string, handler: (data: any) => void): void {
    this.eventBus.off(event, handler);
  }
}
