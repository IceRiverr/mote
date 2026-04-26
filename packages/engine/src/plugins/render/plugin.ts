// engine/src/plugins/render/plugin.ts
// 渲染插件主入口 —— Bevy 风格 Plugin 类

import type { Plugin } from '../../core/plugin.js';
import type { App } from '../../core/app.js';
import { ScheduleLabel } from '../../core/schedule.js';
import { TransformPlugin } from '../transform/plugin.js';
import { SpriteRenderer } from './renderer.js';
import { spriteRenderSystem, spriteAnimationSystem } from './systems.js';
import { Sprite, Camera, SpriteAnimation, type AnimationDef } from './types.js';
import { createGfxDevice } from './createGfxDevice.js';

export { SpriteRenderer } from './renderer.js';
export { spriteRenderSystem, spriteAnimationSystem } from './systems.js';
export * from './types.js';

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
// RenderPlugin
// ═════════════════════════════════════════════════════════════════════════════

/**
 * 渲染插件 —— 支持 WebGPU 和 WebGL2 双后端
 *
 * ```ts
 * const app = new App();
 * await app.addPlugin(new RenderPlugin({
 *   canvas,
 *   backend: 'auto',
 *   width: 800,
 *   height: 600,
 * }));
 * app.run();
 * ```
 */
export class RenderPlugin implements Plugin {
  readonly name = 'render';
  readonly dependencies = [TransformPlugin] as const;

  constructor(private options: RenderPluginOptions) {}

  async build(app: App): Promise<void> {
    const {
      canvas,
      backend = 'auto',
      width = 800,
      height = 600,
      autoResize = true,
    } = this.options;

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
        gfxDevice = await createGfxDevice(canvas);
      }
    } catch (e) {
      console.error('Failed to create graphics device:', e);
      throw e;
    }

    // 创建渲染器
    const renderer = new SpriteRenderer(gfxDevice, width, height);
    app.insertResource('renderer', renderer);

    // 初始化动画资源存储
    app.insertResource('animations', new Map<string, AnimationDef>());

    // 注册组件
    app.registerComponent(Sprite);
    app.registerComponent(Camera);
    app.registerComponent(SpriteAnimation);

    // 注册系统（动画在 PreRender，渲染在 Render）
    app.addSystems(ScheduleLabel.PreRender, [spriteAnimationSystem]);
    app.addSystems(ScheduleLabel.Render, [spriteRenderSystem]);

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

      // TODO: teardown 时移除监听
    }
  }
}
