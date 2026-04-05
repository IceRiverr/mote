// ═════════════════════════════════════════════════════════════════════════════
// mote engine — public API
// ═════════════════════════════════════════════════════════════════════════════

// ── Core systems ──────────────────────────────────────────────────────────────
export * from './GameLoop.js';
export * from './Input.js';
export * from './Math.js';
export * from './Camera2D.js';
export * from './audio.js';

// ── Graphics ──────────────────────────────────────────────────────────────────
export * from './gfx/SpriteBatch.js';
export * from './gfx/TextRenderer.js';
export { createGfxDevice } from './gfx/createGfxDevice.js';
export { BufferUsage } from './gfx/IGfxDevice.js';
export type {
  IGfxDevice, IGfxBuffer, IGfxTexture, IGfxPipeline, IGfxBindGroup, IGfxBindGroupLayout,
  IFrameEncoder, IRenderPass,
  BufferDesc, TextureDesc, PipelineDesc, BindGroupDesc, BindGroupEntry,
} from './gfx/IGfxDevice.js';
export type { AtlasRegion } from './gfx/SpriteBatch.js';

// Font
export * from './gfx/Font.js';

// ── Phase 6: Resource loading ─────────────────────────────────────────────────
export { ProjectLoader } from './ProjectLoader.js';
export type {
  ProjectRuntime,
  SpriteSheetRuntime,
  FrameRuntime,
  EntityDefRuntime,
  ColliderShapeRuntime,
  SceneData,
} from './ProjectLoader.js';

export { SceneManager } from './SceneManager.js';
export type {
  SceneRuntime,
  TileLayerRuntime,
  EntityLayerRuntime,
  EntityInstanceRuntime,
  LayerRuntime,
} from './SceneManager.js';

export { TileMapRenderer } from './TileMapRenderer.js';

// ── Phase 7: Collision + scripting ────────────────────────────────────────────
export { Entity } from './Entity.js';

export { CollisionSystem } from './CollisionSystem.js';
export type { AABB, CollisionResult } from './CollisionSystem.js';

export { ScriptRuntime } from './ScriptRuntime.js';
export type { ScriptLifecycle } from './ScriptRuntime.js';
