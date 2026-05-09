// engine/src/plugins/sprite/SpritePlugin.ts
// 精灵渲染插件 —— 2D Sprite 批量渲染

import type { Plugin } from '../../core/plugin.js';
import type { App } from '../../core/app.js';
import { ScheduleLabel } from '../../core/schedule.js';
import { TransformPlugin } from '../transform/plugin.js';
import { SpriteRenderer } from './SpriteRenderer.js';
import { Sprite, Camera, SpriteAnimation } from './types.js';
import { spriteRenderSystem, spriteAnimationSystem } from './systems.js';
import type { IGfxDevice } from '../gfx/gfxDevice.js';

export interface SpritePluginOptions {
  /** 目标宽度 */
  width?: number;
  /** 目标高度 */
  height?: number;
  /** 是否自动调整大小 */
  autoResize?: boolean;
}

/**
 * Sprite 渲染插件 —— 2D 精灵批量渲染。
 *
 * 依赖 GfxPlugin，复用其创建的 IGfxDevice。
 * 注册 Sprite、Camera、SpriteAnimation 组件，
 * 以及 spriteAnimationSystem 和 spriteRenderSystem。
 */
export class SpritePlugin implements Plugin {
  readonly name = 'sprite';
  readonly dependencies = [TransformPlugin] as const;

  constructor(private options: SpritePluginOptions = {}) {}

  async build(app: App): Promise<void> {
    const {
      width = 800,
      height = 600,
      autoResize = true,
    } = this.options;

    const device = app.getResource<IGfxDevice>('gfxDevice');
    if (!device) {
      throw new Error('[SpritePlugin] GfxPlugin must be added before SpritePlugin');
    }

    const canvas = app.getResource<HTMLCanvasElement>('gfxCanvas');

    // 创建渲染器
    const renderer = new SpriteRenderer(device, width, height);
    app.insertResource('renderer', renderer);

    // 初始化动画资源存储
    app.insertResource('animations', new Map<string, import('./types.js').AnimationDef>());

    // 注册组件
    app.registerComponent(Sprite);
    app.registerComponent(Camera);
    app.registerComponent(SpriteAnimation);

    // 注册系统（动画在 PreRender，渲染在 Render）
    app.addSystems(ScheduleLabel.PreRender, [{ name: 'spriteAnimation', update: spriteAnimationSystem }]);
    app.addSystems(ScheduleLabel.Render, [{ name: 'spriteRender', update: spriteRenderSystem }]);

    // 自动调整大小
    if (autoResize && canvas) {
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
