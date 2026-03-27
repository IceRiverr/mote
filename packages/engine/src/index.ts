export * from './GameLoop.js';
export * from './ActionMap.js';
export * from './ActionState.js';
export * from './InputManager.js';
export * from './InputTypes.js';
export * from './Color.js';
export * from './Mat4.js';
export * from './Rect.js';
export * from './Vec2.js';
export * from './Camera2D.js';
export * from './SpriteBatch.js';
export { createGfxDevice } from './gfx/createGfxDevice.js';
export { BufferUsage } from './gfx/IGfxDevice.js';
export type {
  IGfxDevice, IGfxBuffer, IGfxTexture, IGfxPipeline, IGfxBindGroup, IGfxBindGroupLayout,
  IFrameEncoder, IRenderPass,
  BufferDesc, TextureDesc, PipelineDesc, BindGroupDesc, BindGroupEntry,
} from './gfx/IGfxDevice.js';
export type { AtlasRegion } from './types.js';
// Legacy exports — kept for backwards compatibility
export { GfxDevice } from './GfxDevice.js';
export { GfxBuffer, GfxTexture } from './GfxResources.js';
