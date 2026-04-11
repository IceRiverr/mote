// engine/src/plugins/render/plugin.ts
// 渲染插件主入口

import type { World } from '../../core/world.js';
import type { Renderer } from './systems.js';
import { SpriteRenderer } from './renderer.js';
import { spriteRenderSystem, spriteAnimationSystem } from './systems.js';
import { Sprite, Camera, SpriteAnimation, type AnimationDef } from './types.js';
import { createGfxDevice } from './createGfxDevice.js';

export { SpriteRenderer } from './renderer';
export { spriteRenderSystem, spriteAnimationSystem } from './systems';
export * from './types';

// ═════════════════════════════════════════════════════════════════════════════
// 插件配置
// ═════════════════════════════════════════════════════════════════════════════

export interface RenderPluginOptions {
  /** Canvas 元素 */
  canvas: HTMLCanvasElement;
  /** 渲染后端：'auto' | 'webgpu' | 'webgl2' */
  backend?: 'auto' | 'webgpu' | 'webgl2';
  /** 目标宽度 */
  width?: number;
  /** 目标高度 */
  height?: number;
  /** 是否自动调整大小 */
  autoResize?: boolean;
}

// ═════════════════════════════════════════════════════════════════════════════
// 插件导出
// ═════════════════════════════════════════════════════════════════════════════

/**
 * 渲染插件 —— 支持 WebGPU 和 WebGL2 双后端
 * 
 * ```ts
 * const canvas = document.getElementById('game') as HTMLCanvasElement;
 * 
 * world.use(RenderPlugin, {
 *   canvas,
 *   backend: 'auto',  // 自动选择：优先 WebGPU，回退 WebGL2
 *   width: 800,
 *   height: 600,
 * });
 * 
 * // 创建相机
 * const camera = world.spawn({
 *   Camera: { width: 800, height: 600 },
 *   Transform: { x: 0, y: 0 },
 * });
 * 
 * // 创建精灵
 * const player = world.spawn({
 *   Transform: { x: 100, y: 100 },
 *   Sprite: { atlas: 'characters', region: 'hero_idle_0' },
 *   SpriteAnimation: {},
 * });
 * 
 * // 加载图集
 * const renderer = world.getResource<Renderer>('renderer');
 * await renderer.loadAtlas('characters', '/assets/chars.png', '/assets/chars.json');
 * 
 * // 定义动画
 * const anims = world.getResource<Map<string, AnimationDef>>('animations');
 * anims.set('hero_run', {
 *   frames: ['hero_run_0', 'hero_run_1', 'hero_run_2', 'hero_run_3'],
 *   frameDuration: 100,
 * });
 * 
 * // 播放动画
 * player.get(SpriteAnimation).currentAnim = 'hero_run';
 * ```
 */
export async function RenderPlugin(world: World, options: RenderPluginOptions): Promise<void> {
  const { canvas, backend = 'auto', width = 800, height = 600, autoResize = true } = options;

  // 设置 canvas 尺寸
  canvas.width = width;
  canvas.height = height;

  // 选择并创建后端
  let gfxDevice;
  try {
    if (backend === 'webgpu') {
      const { WebGPUDevice } = await import('./WebGPUDevice.js');
      gfxDevice = await WebGPUDevice.create(canvas);
    } else if (backend === 'webgl2') {
      const { WebGL2Device } = await import('./WebGL2Device.js');
      gfxDevice = await WebGL2Device.create(canvas);
    } else {
      // auto
      gfxDevice = await createGfxDevice(canvas);
    }
  } catch (e) {
    console.error('Failed to create graphics device:', e);
    throw e;
  }

  // 创建渲染器
  const renderer = new SpriteRenderer(gfxDevice, width, height);
  world.addResource('renderer', renderer);

  // 初始化动画资源存储
  world.addResource('animations', new Map<string, AnimationDef>());

  // 注册组件
  world.registerComponent(Sprite);
  world.registerComponent(Camera);
  world.registerComponent(SpriteAnimation);

  // 注册系统（动画系统在游戏逻辑之前，渲染系统在最后）
  world.addSystem(spriteAnimationSystem);
  world.addSystem(spriteRenderSystem);

  // 自动调整大小
  if (autoResize) {
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const newWidth = Math.floor(rect.width * dpr);
      const newHeight = Math.floor(rect.height * dpr);
      
      canvas.width = newWidth;
      canvas.height = newHeight;
      renderer.camera2D.viewportWidth = newWidth;
      renderer.camera2D.viewportHeight = newHeight;
    };

    window.addEventListener('resize', resize);
    resize();

    world.on('destroy', () => {
      window.removeEventListener('resize', resize);
    });
  }

  // 清理
  world.on('destroy', () => renderer.destroy());
}
