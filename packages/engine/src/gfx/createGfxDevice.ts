import type { IGfxDevice } from './IGfxDevice.js';
import { WebGPUDevice } from '../backends/webgpu/WebGPUDevice.js';
import { WebGL2Device } from '../backends/webgl2/WebGL2Device.js';

export async function createGfxDevice(canvas: HTMLCanvasElement): Promise<IGfxDevice> {
  if (typeof navigator !== 'undefined' && navigator.gpu && isSecureContext) {
    try {
      return await WebGPUDevice.create(canvas);
    } catch {
      // fall through to WebGL 2
    }
  }
  return await WebGL2Device.create(canvas);
}
