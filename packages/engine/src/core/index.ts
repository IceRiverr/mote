// engine/src/core/index.ts
// 微尘引擎 ECS 核心 —— 统一导出

// Version
export { ENGINE_VERSION } from './version';

// Types
export type {
  EntityId,
  ComponentClass,
  ComponentMap,
  SpawnConfig,
  Prefab,
  InstanceTypes,
} from './types';

// App & ECS 门面
export { App, Time } from './app';
export type { Plugin } from './plugin';
export { ScheduleLabel } from './schedule';
export type { System, SystemFn, SystemObj } from './system';

// World
export { World } from './world';

// Entity
export { Entity } from './entity';

// Query
export { QueryResult } from './query';

// Component
export { ComponentRegistry } from './componentRegistry';

// Prefab
export { definePrefab, PrefabStore, mergeSpawnConfig } from './prefab';

// Event
export { EventBus } from './event';

// Resource
export { ResourceStore } from './resource';
