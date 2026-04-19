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
  SystemFn,
  SystemObj,
  System,
  Plugin,
  Prefab,
  InstanceTypes,
} from './types';

// World
export { World } from './world';

// Entity
export { Entity } from './entity';

// Query
export { QueryResult } from './query';

// Component
export { ComponentRegistry } from './component';

// Prefab
export { definePrefab, PrefabStore, mergeSpawnConfig } from './prefab';

// Event
export { EventBus } from './event';

// Resource
export { ResourceStore } from './resource';

// Asset System
export { validateAssetPath, resolveAssetPath } from './path';
export { AssetLoader, LoaderRegistry, assetLoaders } from './loader';
export { AssetManager } from './asset-manager';
