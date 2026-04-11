// engine/src/plugins/render/createGfxDevice.ts
// 图形设备工厂 —— 自动选择 WebGPU 或 WebGL2

import type { IGfxDevice } from './IGfxDevice.js';

export async function createGfxDevice(canvas: HTMLCanvasElement): Promise<IGfxDevice> {
  if (typeof navigator !== 'undefined' && navigator.gpu && isSecureContext) {
    try {
      const { WebGPUDevice } = await import('./WebGPUDevice.js');
      return await WebGPUDevice.create(canvas);
    } catch {
      // fall through to WebGL 2
    }
  }
  const { WebGL2Device } = await import('./WebGL2Device.js');
  return await WebGL2Device.create(canvas);
}
