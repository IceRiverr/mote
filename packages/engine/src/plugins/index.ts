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

// ── 图形设备抽象（底层）───────────────────────────────────────────────────
export type {
  IGfxDevice,
  IGfxBuffer,
  IGfxTexture,
  IGfxPipeline,
  IGfxBindGroup,
  IGfxBindGroupLayout,
  IFrameEncoder,
  IRenderPass,
  BufferDesc,
  TextureDesc,
  VertexAttribute,
  BindGroupLayoutEntry,
  PipelineDesc,
  BindGroupEntry,
  BindGroupDesc,
} from './gfx/gfxDevice.js';
export { BufferUsage } from './gfx/gfxDevice.js';
export { Camera2D } from './gfx/Camera2D.js';
export { createGfxDevice } from './gfx/createGfxDevice.js';
export { GfxPlugin, type GfxPluginOptions } from './gfx/gfxPlugin.js';
export { WebGPUDevice } from './gfx/backends/WebGPUDevice.js';
export { WebGL2Device } from './gfx/backends/WebGL2Device.js';

// ── 精灵渲染（2D Sprite 批量渲染）──────────────────────────────────────────
export { Sprite, Camera, SpriteAnimation } from './sprite/types.js';
export type { AnimationDef } from './sprite/types.js';
export { TextureAtlas, SpriteBatch } from './sprite/SpriteBatch.js';
export type { AtlasRegion } from './sprite/SpriteBatch.js';
export { SpriteRenderer, type Renderer } from './sprite/SpriteRenderer.js';
export { spriteRenderSystem, spriteAnimationSystem } from './sprite/systems.js';
export { TextRenderer } from './sprite/TextRenderer.js';
export type { TextStyle, TextLayoutResult, BMFontJson, FontData } from './sprite/Font.js';
export {
  parseBMFont,
  parseBMFontJson,
  mergeFontData,
  layoutText,
  measureText,
  findMissingChars,
  canRender,
} from './sprite/Font.js';
export type { GlyphData, FontMetrics } from './sprite/Font.js';
export { SpritePlugin, type SpritePluginOptions } from './sprite/SpritePlugin.js';
