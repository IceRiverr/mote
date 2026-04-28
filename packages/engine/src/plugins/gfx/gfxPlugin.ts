// engine/src/plugins/gfx/GfxPlugin.ts
// 图形设备插件 —— 创建 IGfxDevice 后端

import type { Plugin } from '../../core/plugin.js';
import type { App } from '../../core/app.js';
import { createGfxDevice } from './createGfxDevice.js';

export interface GfxPluginOptions {
  /** Canvas 元素 */
  canvas: HTMLCanvasElement;
  /** 渲染后端：'auto' | 'webgpu' | 'webgl2' | 'canvas2d' */
  backend?: 'auto' | 'webgpu' | 'webgl2';
}

/**
 * Gfx 插件 —— 创建图形设备并插入到 World Resources。
 *
 * 这是所有渲染插件（Sprite、Mesh 等）的基础设施，
 * 本身不注册任何组件或渲染系统。
 */
export class GfxPlugin implements Plugin {
  readonly name = 'gfx';
  readonly dependencies = [] as const;

  constructor(private options: GfxPluginOptions) {}

  async build(app: App): Promise<void> {
    const { canvas, backend = 'auto' } = this.options;
    const device = await createGfxDevice(canvas, backend);
    app.insertResource('gfxDevice', device);
    app.insertResource('gfxCanvas', canvas);
  }
}
