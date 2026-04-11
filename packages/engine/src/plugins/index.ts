// engine/src/plugins/index.ts
// 微尘引擎官方插件统一导出

// 输入插件
export { InputPlugin, type InputPluginOptions, type InputMap, DefaultInputMap, PlayerInput, InputManager } from './input.js';

// 音频插件
export { AudioPlugin, type SoundAsset, type PlayOptions, AudioEmitter, BGMPlayer, AudioManager } from './audio.js';

// 物理插件
export {
  PhysicsPlugin,
  Transform, Velocity, Acceleration, Friction, RigidBody, Gravity,
  BoxCollider, CircleCollider,
  type Collision,
} from './physics.js';

// 瓦片地图插件
export {
  TilemapPlugin,
  Tilemap, TilemapCollider, TileAnimation,
  type TileLayer, type TileAnimFrame,
  getTile, setTile, worldToTile, tileToWorld,
  createTilemap, loadFromTiled, resolveTilemapCollision,
} from './tilemap.js';

// 渲染插件（包含所有 gfx 内容）
export * from './render/index.js';
