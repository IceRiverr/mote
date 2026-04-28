// engine/src/plugins/gfx/createGfxDevice.ts
// 图形设备工厂 —— 自动选择 WebGPU、WebGL2 或 Canvas2D

import type { IGfxDevice } from './gfxDevice.js';

export async function createGfxDevice(
  canvas: HTMLCanvasElement,
  backend: 'auto' | 'webgpu' | 'webgl2' | 'canvas2d' = 'auto'
): Promise<IGfxDevice> {
  if (backend === 'webgpu') {
    const { WebGPUDevice } = await import('./backends/WebGPUDevice.js');
    return await WebGPUDevice.create(canvas);
  }

  if (backend === 'webgl2') {
    const { WebGL2Device } = await import('./backends/WebGL2Device.js');
    return await WebGL2Device.create(canvas);
  }

  // auto
  if (typeof navigator !== 'undefined' && navigator.gpu && isSecureContext) {
    try {
      const { WebGPUDevice } = await import('./backends/WebGPUDevice.js');
      return await WebGPUDevice.create(canvas);
    } catch {
      // fall through to WebGL 2
    }
  }
  const { WebGL2Device } = await import('./backends/WebGL2Device.js');
  return await WebGL2Device.create(canvas);
}
