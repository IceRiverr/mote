// engine/src/core/query.ts
// 查询结果 —— 支持 for...of 遍历和 each 快捷回调

import type { EntityId, ComponentClass } from './types';

/**
 * QueryResult 持有匹配的 EntityId 列表
 * 提供两种遍历方式：
 * - for...of 遍历 EntityId（配合 world.get 使用）
 * - .each() 回调直接拿到组件实例
 */
export class QueryResult {
  constructor(
    /** 匹配的实体 ID 列表 */
    private entities: EntityId[],
    /** 查询的组件类列表 */
    private components: ComponentClass[],
    /** 获取组件的回调（由 World 注入） */
    private getComponent: (eid: EntityId, cls: ComponentClass) => any,
  ) {}

  /**
   * 迭代器 —— 遍历 EntityId
   *
   * ```ts
   * for (const eid of world.query(Transform, Velocity)) {
   *   const t = world.get(eid, Transform);
   * }
   * ```
   */
  [Symbol.iterator](): Iterator<EntityId> {
    let index = 0;
    const entities = this.entities;
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
   * 组件参数顺序与 query() 参数顺序一致
   *
   * ```ts
   * world.query(Transform, Velocity).each((t, v, eid) => {
   *   t.x += v.vx * dt;
   * });
   * ```
   */
  each(fn: (...args: any[]) => void): void {
    const comps = this.components;
    const compCount = comps.length;
    const getter = this.getComponent;
    const args: any[] = new Array(compCount + 1);

    for (let i = 0; i < this.entities.length; i++) {
      const eid = this.entities[i];
      for (let c = 0; c < compCount; c++) {
        args[c] = getter(eid, comps[c]);
      }
      args[compCount] = eid; // 最后一个参数是 EntityId
      fn.apply(null, args);
    }
  }

  /**
   * 匹配的实体数量
   */
  get length(): number {
    return this.entities.length;
  }

  /**
   * 是否有匹配结果
   */
  get empty(): boolean {
    return this.entities.length === 0;
  }

  /**
   * 获取第一个匹配的 EntityId（无匹配返回 undefined）
   */
  first(): EntityId | undefined {
    return this.entities[0];
  }

  /**
   * 转为 EntityId 数组
   */
  toArray(): EntityId[] {
    return this.entities.slice();
  }
}
