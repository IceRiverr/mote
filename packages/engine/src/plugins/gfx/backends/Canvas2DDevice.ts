// engine/src/plugins/gfx/backends/Canvas2DDevice.ts
// Canvas 2D 图形设备实现 —— TODO

import type { IGfxDevice } from '../gfxDevice.js';

export class Canvas2DDevice implements IGfxDevice {
  // TODO: 实现 Canvas 2D 后端
  static async create(_canvas: HTMLCanvasElement): Promise<Canvas2DDevice> {
    throw new Error('Canvas2DDevice not implemented yet');
  }

  createBuffer(): any { throw new Error('not implemented'); }
  createTexture(): any { throw new Error('not implemented'); }
  createPipeline(): any { throw new Error('not implemented'); }
  getBindGroupLayout(): any { throw new Error('not implemented'); }
  createBindGroup(): any { throw new Error('not implemented'); }
  writeBuffer(): void { throw new Error('not implemented'); }
  async loadTexture(): Promise<any> { throw new Error('not implemented'); }
  beginFrame(): any { throw new Error('not implemented'); }
  destroy(): void {}
}
