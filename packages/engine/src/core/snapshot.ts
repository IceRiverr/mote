// engine/src/core/snapshot.ts
// Snapshot —— 不透明类型，用户不可 new、不可解构

import type { EntityId } from './types';

/**
 * World 状态快照 —— 不透明类型
 * v1.0 内部实现为 ECS 数据的 deep clone
 * 用户通过 `world.snapshot()` 获取、`world.restore(snap)` 恢复
 */
export class Snapshot {
  private constructor(
    /** 引擎内部使用的快照数据 */
    readonly _data: SnapshotData,
  ) {}

  /** @internal 由 World.snapshot() 调用 */
  static _create(data: SnapshotData): Snapshot {
    return new Snapshot(data);
  }
}

/** @internal 快照数据结构，不对外暴露 */
export interface SnapshotData {
  nextId: number;
  alive: Set<EntityId>;
  entityComponents: Map<EntityId, Map<string, any>>;
}
