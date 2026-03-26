// ── Descriptors ──────────────────────────────────────────────────────────────

export interface BufferDesc {
  label?: string;
  size: number;
  usage: GPUBufferUsageFlags;
  mappedAtCreation?: boolean;
}

export interface TextureDesc {
  label?: string;
  width: number;
  height: number;
  format?: GPUTextureFormat;
  usage?: GPUTextureUsageFlags;
}

// ── Resource wrappers ─────────────────────────────────────────────────────────

export interface IGfxBuffer {
  readonly gpuBuffer: GPUBuffer;
  readonly size: number;
  destroy(): void;
}

export interface IGfxTexture {
  readonly gpuTexture: GPUTexture;
  readonly width: number;
  readonly height: number;
  destroy(): void;
}

// ── Atlas ─────────────────────────────────────────────────────────────────────

export interface AtlasRegion {
  u0: number; v0: number;
  u1: number; v1: number;
  pixelWidth: number;
  pixelHeight: number;
}
