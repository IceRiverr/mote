// games/tiny-dungeon/src/plugin.ts
// TinyDungeonPlugin —— 游戏根插件，内部装配所有子系统

import type { Plugin, App } from '@mote/engine';
import { ScheduleLabel } from '@mote/engine';
import { PlayerTag, EnemyAI, Weapon, Health, Pickup, WallTag, FloorTag } from './components.js';
import { ALL_PREFABS } from './prefabs.js';
import { DEFAULT_CONFIG } from './resources.js';

// ── Startup Systems ──
import { loadAssetsSystem } from './systems/startup/loadAssets.js';
import { generateMapSystem } from './systems/startup/generateMap.js';
import { spawnWallsSystem } from './systems/startup/spawnWalls.js';
import { spawnFloorSystem } from './systems/startup/spawnFloor.js';
import { spawnEntitiesSystem } from './systems/startup/spawnEntities.js';
import { spawnCameraSystem } from './systems/startup/spawnCamera.js';

// ── Update Systems ──
import { inputSystem } from './systems/input.js';
import { throwAttackSystem, weaponFlySystem } from './systems/combat.js';
import { pickupSystem } from './systems/pickup.js';
import { cameraFollowSystem } from './systems/camera.js';

// ═════════════════════════════════════════════════════════════════════════════
// 子插件（游戏内部可以再拆分）
// ═════════════════════════════════════════════════════════════════════════════

/** 地图生成插件 */
const MapGenerationPlugin: Plugin = {
  name: 'tiny-dungeon/map-generation',

  build(app: App) {
    app.addSystems(ScheduleLabel.Startup, [
      generateMapSystem,
      spawnWallsSystem,
      spawnFloorSystem,
    ]);
  },
};

/** 实体生成插件 */
const SpawnerPlugin: Plugin = {
  name: 'tiny-dungeon/spawner',

  build(app: App) {
    app.addSystems(ScheduleLabel.Startup, [
      spawnEntitiesSystem,
      spawnCameraSystem,
    ]);
  },
};

/** 战斗系统插件 */
const CombatPlugin: Plugin = {
  name: 'tiny-dungeon/combat',

  build(app: App) {
    app.addSystems(ScheduleLabel.Update, [
      throwAttackSystem,
      weaponFlySystem,
    ]);
  },
};

/** 玩家系统插件 */
const PlayerPlugin: Plugin = {
  name: 'tiny-dungeon/player',

  build(app: App) {
    app.addSystems(ScheduleLabel.Update, [
      inputSystem,
      pickupSystem,
      cameraFollowSystem,
    ]);
  },
};

// ═════════════════════════════════════════════════════════════════════════════
// 游戏根插件
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Tiny Dungeon 游戏根插件
 *
 * 负责注册游戏级别的组件、Prefab、Resource，
 * 并装配游戏内部的子插件。
 *
 * ```ts
 * await app.addPlugins([
 *   new RenderPlugin({ canvas }),
 *   PhysicsPlugin,
 *   new TinyDungeonPlugin(),
 * ]);
 * ```
 */
export class TinyDungeonPlugin implements Plugin {
  readonly name = 'tiny-dungeon';

  async build(app: App): Promise<void> {
    // 1. 注册游戏组件
    app.registerComponent(PlayerTag);
    app.registerComponent(EnemyAI);
    app.registerComponent(Weapon);
    app.registerComponent(Health);
    app.registerComponent(Pickup);
    app.registerComponent(WallTag);
    app.registerComponent(FloorTag);

    // 2. 注册 Prefab
    for (const prefab of ALL_PREFABS) {
      app.registerPrefab((prefab as any).id, prefab);
    }

    // 3. 注册配置 Resource
    app.insertResource('GameConfig', DEFAULT_CONFIG);

    // 4. 加载资源（图集）
    app.addSystems(ScheduleLabel.Startup, [loadAssetsSystem]);

    // 5. 装配子插件（每个子系统独立，未来可插拔）
    await app.addPlugins([
      MapGenerationPlugin,
      SpawnerPlugin,
      CombatPlugin,
      PlayerPlugin,
    ]);
  }
}
