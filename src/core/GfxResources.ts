import type { IGfxBuffer, IGfxTexture, BufferDesc, TextureDesc } from './types.js';

export class GfxBuffer implements IGfxBuffer {
  readonly gpuBuffer: GPUBuffer;
  readonly size: number;

  constructor(device: GPUDevice, desc: BufferDesc) {
    this.size = desc.size;
    this.gpuBuffer = device.createBuffer({
      label: desc.label,
      size: desc.size,
      usage: desc.usage,
      mappedAtCreation: desc.mappedAtCreation ?? false,
    });
  }

  destroy(): void { this.gpuBuffer.destroy(); }
}

export class GfxTexture implements IGfxTexture {
  readonly gpuTexture: GPUTexture;
  readonly width: number;
  readonly height: number;

  constructor(device: GPUDevice, desc: TextureDesc) {
    this.width = desc.width;
    this.height = desc.height;
    this.gpuTexture = device.createTexture({
      label: desc.label,
      size: [desc.width, desc.height],
      format: desc.format ?? 'rgba8unorm',
      usage: desc.usage ?? (GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT),
    });
  }

  createView(): GPUTextureView { return this.gpuTexture.createView(); }
  destroy(): void { this.gpuTexture.destroy(); }
}
