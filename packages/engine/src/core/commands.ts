// engine/src/core/commands.ts
// Commands —— 延迟修改 ECS 世界

import type { EntityId, ComponentClass, SpawnConfig } from './types';
import type { World } from './world';

// ═════════════════════════════════════════════════════════════════════════════
// Command 类型
// ═════════════════════════════════════════════════════════════════════════════

type Command =
  | { type: 'add'; eid: EntityId; cls: ComponentClass; data?: any }
  | { type: 'remove'; eid: EntityId; cls: ComponentClass }
  | { type: 'destroy'; eid: EntityId };

// ═════════════════════════════════════════════════════════════════════════════
// EntityCommands
// ═════════════════════════════════════════════════════════════════════════════

/**
 * 对单个实体的延迟操作句柄
 * `.id` 是真实有效的 EntityId（通过 World.reserveEntity 预分配）
 */
export class EntityCommands {
  constructor(
    readonly id: EntityId,
    private world: World,
    private queue: Command[],
  ) {}

  /**
   * 延迟添加组件
   */
  add<T>(cls: ComponentClass<T>, data?: Partial<T>): this {
    this.queue.push({ type: 'add', eid: this.id, cls, data });
    return this;
  }

  /**
   * 延迟移除组件
   */
  remove<T>(cls: ComponentClass<T>): this {
    this.queue.push({ type: 'remove', eid: this.id, cls });
    return this;
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// Commands
// ═════════════════════════════════════════════════════════════════════════════

/**
 * 命令缓冲区 —— 收集一帧内的所有延迟修改，最后统一 flush
 *
 * ```ts
 * update(world, dt, cmd) {
 *   cmd.spawn({ Transform: { x: 0 } }).add(Velocity, { vx: 5 });
 *   cmd.destroy(eid);
 * }
 * ```
 */
export class Commands {
  private queue: Command[] = [];

  constructor(private world: World) {}

  /**
   * 延迟创建实体
   * 返回 EntityCommands，其 `.id` 已预分配、立即可用
   *
   * ```ts
   * cmd.spawn({ Transform: { x: 0 } }).add(Velocity, { vx: 5 });
   * cmd.spawn('skeleton', { Transform: { x: 100 } });
   * ```
   */
  spawn(configOrPrefab?: string | SpawnConfig, overrides?: SpawnConfig): EntityCommands {
    if (typeof configOrPrefab === 'string') {
      // Prefab 创建：委托给 World（立即执行，返回真实 Entity）
      const entity = this.world.spawn(configOrPrefab, overrides);
      return new EntityCommands(entity.id, this.world, this.queue);
    }

    // 声明式创建：预分配 id + 排队组件添加
    const eid = this.world.reserveEntity();
    if (configOrPrefab) {
      for (const [name, data] of Object.entries(configOrPrefab)) {
        const cls = this.world.registry.getOrThrow(name);
        this.queue.push({ type: 'add', eid, cls, data });
      }
    }
    return new EntityCommands(eid, this.world, this.queue);
  }

  /**
   * 对已有实体进行延迟操作
   */
  entity(eid: EntityId): EntityCommands {
    return new EntityCommands(eid, this.world, this.queue);
  }

  /**
   * 延迟销毁实体
   */
  destroy(eid: EntityId): void {
    this.queue.push({ type: 'destroy', eid });
  }

  /**
   * 执行所有排队命令
   * 由 App 调度器在合适时机调用
   */
  flush(): void {
    for (const cmd of this.queue) {
      switch (cmd.type) {
        case 'add':
          this.world.add(cmd.eid, cmd.cls, cmd.data);
          break;
        case 'remove':
          this.world.remove(cmd.eid, cmd.cls);
          break;
        case 'destroy':
          this.world.destroy(cmd.eid);
          break;
      }
    }
    this.queue.length = 0;
  }
}
