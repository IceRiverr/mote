// engine/src/plugins/render/index.ts
// 渲染插件统一导出

// 核心类型和接口
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
} from './IGfxDevice.js';
export { BufferUsage } from './IGfxDevice.js';

// 渲染组件
export { Sprite, Camera, SpriteAnimation, Color } from './types.js';
export type { AnimationDef } from './types.js';

// 图集和批次
export { TextureAtlas, SpriteBatch } from './SpriteBatch.js';
export type { AtlasRegion } from './SpriteBatch.js';

// 渲染系统和渲染器
export { spriteRenderSystem, spriteAnimationSystem } from './systems.js';
export { SpriteRenderer, type Renderer } from './renderer.js';

// 后端设备（按需导入）
export { WebGL2Device } from './WebGL2Device.js';
export { WebGPUDevice } from './WebGPUDevice.js';

// 工具函数
export { createGfxDevice } from './createGfxDevice.js';

// 插件
export { RenderPlugin, type RenderPluginOptions } from './plugin.js';
