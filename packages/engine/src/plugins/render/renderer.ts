// engine/src/plugins/render/renderer.ts
// 渲染器实现 —— 基于 gfx 的双后端抽象

import type { IGfxDevice } from './IGfxDevice.js';
import { SpriteBatch, TextureAtlas } from './SpriteBatch.js';
import { Camera2D } from '../../Camera2D.js';
import type { Renderer } from './systems.js';

export { type Renderer };

/**
 * 创建渲染器
 * 
 * 封装 SpriteBatch 和图集管理，提供统一的渲染接口
 */
export class SpriteRenderer implements Renderer {
  readonly device: IGfxDevice;
  readonly batch: SpriteBatch;
  readonly camera2D: Camera2D;

  private atlases = new Map<string, TextureAtlas>();

  constructor(device: IGfxDevice, width = 800, height = 600) {
    this.device = device;
    this.batch = new SpriteBatch(device);
    this.camera2D = new Camera2D(width, height);
  }

  registerAtlas(name: string, atlas: TextureAtlas): void {
    this.atlases.set(name, atlas);
  }

  getAtlas(name: string): TextureAtlas | undefined {
    return this.atlases.get(name);
  }

  async loadAtlas(name: string, imageUrl: string, jsonUrl?: string): Promise<void> {
    const atlas = await TextureAtlas.load(
      this.device,
      this.batch.getAtlasBindGroupLayout(),
      imageUrl,
      jsonUrl,
    );
    this.registerAtlas(name, atlas);
  }

  destroy(): void {
    this.batch.destroy();
    this.device.destroy();
  }
}
