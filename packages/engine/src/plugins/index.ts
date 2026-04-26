// engine/src/plugins/index.ts
// 微尘引擎官方插件统一导出

// 变换插件
export { TransformPlugin, Transform, Name } from './transform/plugin.js';

// 输入插件
export {
  InputPlugin,
  InputManager,
  type InputPluginOptions,
  type InputMap,
  DefaultInputMap,
  PlayerInput,
} from './input/plugin.js';

// 音频插件
export {
  AudioPlugin,
  AudioManager,
  type SoundAsset,
  type PlayOptions,
  AudioEmitter,
  BGMPlayer,
} from './audio/plugin.js';

// 物理插件
export {
  PhysicsPlugin,
  Velocity,
  Acceleration,
  Friction,
  RigidBody,
  Gravity,
  BoxCollider,
  CircleCollider,
  type Collision,
} from './physics/plugin.js';

// 瓦片地图插件
export {
  TilemapPlugin,
  Tilemap,
  TilemapCollider,
  TileAnimation,
  type TileLayer,
  type TileAnimFrame,
  getTile,
  setTile,
  worldToTile,
  tileToWorld,
  createTilemap,
  loadFromTiled,
  resolveTilemapCollision,
} from './tilemap/plugin.js';

// 渲染插件（包含所有 gfx 内容）
export * from './render/index.js';
