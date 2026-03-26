import { GfxBuffer, GfxTexture } from './GfxResources.js';
import type { BufferDesc, TextureDesc } from './types.js';

export class GfxDevice {
  readonly device: GPUDevice;
  readonly context: GPUCanvasContext;
  readonly format: GPUTextureFormat;
  private constructor(_adapter: GPUAdapter, device: GPUDevice, context: GPUCanvasContext, format: GPUTextureFormat) {
    this.device = device;
    this.context = context;
    this.format = format;
  }

  static async create(canvas: HTMLCanvasElement): Promise<GfxDevice> {
    if (!navigator.gpu) throw new Error('WebGPU not supported');
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No GPU adapter found');
    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu') as GPUCanvasContext;
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'premultiplied' });
    return new GfxDevice(adapter, device, context, format);
  }

  createBuffer(desc: BufferDesc): GfxBuffer {
    return new GfxBuffer(this.device, desc);
  }

  createTexture(desc: TextureDesc): GfxTexture {
    return new GfxTexture(this.device, desc);
  }

  // Load an image URL into a GPU texture
  async loadTexture(url: string): Promise<GfxTexture> {
    const img = new Image();
    img.src = url;
    await img.decode();
    const bitmap = await createImageBitmap(img);
    const tex = new GfxTexture(this.device, {
      label: url,
      width: bitmap.width,
      height: bitmap.height,
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
    });
    this.device.queue.copyExternalImageToTexture(
      { source: bitmap },
      { texture: tex.gpuTexture },
      [bitmap.width, bitmap.height],
    );
    bitmap.close();
    return tex;
  }

  writeBuffer(buffer: GfxBuffer, data: BufferSource, byteOffset = 0): void {
    this.device.queue.writeBuffer(buffer.gpuBuffer, byteOffset, data);
  }

  getCurrentTextureView(): GPUTextureView {
    return this.context.getCurrentTexture().createView();
  }

  destroy(): void {
    this.device.destroy();
  }
}
