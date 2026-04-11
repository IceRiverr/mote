// engine/src/core/entity.ts
// Entity 胖句柄 —— 持有 EntityId + World 引用（private）

import type { EntityId, ComponentClass } from './types';
import type { World } from './world';

/**
 * Entity 是面向使用者的胖句柄
 * 内部委托给 World 的组件操作方法
 * 支持链式调用
 */
export class Entity {
  readonly id: EntityId;
  private _world: World;

  constructor(id: EntityId, world: World) {
    this.id = id;
    this._world = world;
  }

  /**
   * 实体是否仍然存活
   */
  get alive(): boolean {
    return this._world.isAlive(this.id);
  }

  /**
   * 添加组件，返回 this 支持链式调用
   *
   * ```ts
   * entity.add(Transform, { x: 100 }).add(Velocity, { vx: 5 });
   * ```
   */
  add<T>(cls: ComponentClass<T>, data?: Partial<T>): this {
    this._world.add(this.id, cls, data);
    return this;
  }

  /**
   * 移除组件，返回 this 支持链式调用
   */
  remove<T>(cls: ComponentClass<T>): this {
    this._world.remove(this.id, cls);
    return this;
  }

  /**
   * 获取组件实例（类型自动推断）
   *
   * ```ts
   * const t = entity.get(Transform); // t: Transform
   * t.x += 10;
   * ```
   */
  get<T>(cls: ComponentClass<T>): T {
    return this._world.get(this.id, cls);
  }

  /**
   * 判断是否拥有某组件
   */
  has<T>(cls: ComponentClass<T>): boolean {
    return this._world.has(this.id, cls);
  }

  /**
   * 销毁实体
   */
  destroy(): void {
    this._world.destroy(this.id);
  }
}
