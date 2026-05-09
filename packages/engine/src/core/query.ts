// engine/src/core/query.ts
// QueryBuilder —— 延迟构建 + 泛型类型推导

import type { EntityId, ComponentClass, InstanceTypes } from './types';
import type { World } from './world';
import type { ComponentRegistry } from './componentRegistry';

/**
 * QueryBuilder 支持链式构建查询条件
 * 首次读取时执行查询（延迟计算）
 *
 * ```ts
 * // 类型自动推导
 * world.query(Transform).with(Velocity).without(Frozen)
 *   .each((t, v, eid) => {
 *     // t: Transform, v: Velocity, eid: EntityId
 *     t.x += v.vx * dt;
 *   });
 *
 * // for...of 遍历 EntityId
 * for (const eid of world.query(Transform)) { ... }
 * ```
 */
export class QueryBuilder<T extends ComponentClass[] = []> {
  constructor(
    private world: World,
    private registry: ComponentRegistry,
    private withComponents: ComponentClass[],
    private withoutComponents: ComponentClass[] = [],
  ) {}

  /**
   * 追加必须拥有的组件
   */
  with<U extends ComponentClass[]>(
    ...components: U
  ): QueryBuilder<[...T, ...U]> {
    return new QueryBuilder(
      this.world,
      this.registry,
      [...this.withComponents, ...components],
      this.withoutComponents,
    );
  }

  /**
   * 追加必须不包含的组件
   */
  without<U extends ComponentClass[]>(
    ...components: U
  ): QueryBuilder<T> {
    return new QueryBuilder(
      this.world,
      this.registry,
      this.withComponents,
      [...this.withoutComponents, ...components],
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 延迟执行
  // ═══════════════════════════════════════════════════════════════════════

  private _entities: EntityId[] | null = null;

  private _execute(): EntityId[] {
    if (this._entities !== null) return this._entities;

    const withNames = this.withComponents.map(
      (c) => this.registry.nameOf(c) ?? c.name,
    );
    const withoutNames = this.withoutComponents.map(
      (c) => this.registry.nameOf(c) ?? c.name,
    );

    this._entities = this.world._internalQuery(withNames, withoutNames);
    return this._entities;
  }

  // ═══════════════════════════════════════════════════════════════════════
  // 遍历接口
  // ═══════════════════════════════════════════════════════════════════════

  /**
   * 迭代器 —— 遍历 EntityId
   */
  [Symbol.iterator](): Iterator<EntityId> {
    const entities = this._execute();
    let index = 0;
    return {
      next(): IteratorResult<EntityId> {
        if (index < entities.length) {
          return { value: entities[index++], done: false };
        }
        return { value: undefined as any, done: true };
      },
    };
  }

  /**
   * 快捷遍历 —— 回调中直接拿到组件实例 + EntityId
   * 组件参数顺序与 query()/with() 参数顺序一致
   */
  each(
    fn: (...args: [...InstanceTypes<T>, EntityId]) => void,
  ): void {
    const entities = this._execute();
    const comps = this.withComponents;
    const compCount = comps.length;
    const getter = (eid: EntityId, cls: ComponentClass) =>
      this.world.get(eid, cls);
    const args: any[] = new Array(compCount + 1);

    for (let i = 0; i < entities.length; i++) {
      const eid = entities[i];
      for (let c = 0; c < compCount; c++) {
        args[c] = getter(eid, comps[c]);
      }
      args[compCount] = eid;
      // @ts-ignore: runtime arity matches by construction
      fn(...args);
    }
  }

  /**
   * 匹配的实体数量
   */
  get length(): number {
    return this._execute().length;
  }

  /**
   * 是否有匹配结果
   */
  get empty(): boolean {
    return this._execute().length === 0;
  }

  /**
   * 获取第一个匹配的 EntityId（无匹配返回 undefined）
   */
  first(): EntityId | undefined {
    return this._execute()[0];
  }

  /**
   * 转为 EntityId 数组
   */
  toArray(): EntityId[] {
    return this._execute().slice();
  }
}
