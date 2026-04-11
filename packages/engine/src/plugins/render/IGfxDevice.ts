// engine/src/plugins/render/IGfxDevice.ts
// 图形设备抽象接口

// ── Buffer usage flags (backend-agnostic, mirrors GPUBufferUsage values) ──────

export const BufferUsage = {
  VERTEX:   0x0020,
  INDEX:    0x0010,
  UNIFORM:  0x0040,
  COPY_DST: 0x0008,
} as const;

// ── Descriptors ───────────────────────────────────────────────────────────────

export interface BufferDesc {
  label?: string;
  size: number;
  usage: number;
  mappedAtCreation?: boolean;
}

export interface TextureDesc {
  label?: string;
  width: number;
  height: number;
}

export interface VertexAttribute {
  shaderLocation: number;
  offset: number;
  format: 'float32x2' | 'float32x4';
}

export interface BindGroupLayoutEntry {
  binding: number;
  type: 'uniform' | 'texture' | 'sampler';
  name?: string;
}

export interface PipelineDesc {
  label?: string;
  wgsl?: string;
  vertGlsl?: string;
  fragGlsl?: string;
  vertexStride: number;
  vertexAttributes: VertexAttribute[];
  blendMode?: 'alpha' | 'additive' | 'none';
  bindGroupLayouts: BindGroupLayoutEntry[][];
}

export interface BindGroupEntry {
  binding: number;
  buffer?: IGfxBuffer;
  texture?: IGfxTexture;
  sampler?: boolean;
}

export interface BindGroupDesc {
  layout: IGfxBindGroupLayout;
  entries: BindGroupEntry[];
}

// ── Opaque handles ────────────────────────────────────────────────────────────

export interface IGfxBuffer {
  readonly size: number;
  destroy(): void;
}

export interface IGfxTexture {
  readonly width: number;
  readonly height: number;
  destroy(): void;
}

export interface IGfxPipeline {
  destroy(): void;
}

export interface IGfxBindGroup {}

export interface IGfxBindGroupLayout {}

// ── Render pass ───────────────────────────────────────────────────────────────

export interface IRenderPass {
  setPipeline(pipeline: IGfxPipeline): void;
  setVertexBuffer(slot: number, buf: IGfxBuffer): void;
  setIndexBuffer(buf: IGfxBuffer, format: 'uint16' | 'uint32'): void;
  setBindGroup(index: number, group: IGfxBindGroup): void;
  drawIndexed(indexCount: number, instanceCount?: number, firstIndex?: number): void;
  end(): void;
}

export interface IFrameEncoder {
  beginRenderPass(clearColor: [number, number, number, number]): IRenderPass;
  submit(): void;
}

// ── Device ────────────────────────────────────────────────────────────────────

export interface IGfxDevice {
  createBuffer(desc: BufferDesc): IGfxBuffer;
  createTexture(desc: TextureDesc): IGfxTexture;
  createPipeline(desc: PipelineDesc): IGfxPipeline;
  getBindGroupLayout(pipeline: IGfxPipeline, groupIndex: number): IGfxBindGroupLayout;
  createBindGroup(desc: BindGroupDesc): IGfxBindGroup;

  writeBuffer(buf: IGfxBuffer, data: ArrayBufferView | ArrayBuffer, byteOffset?: number): void;
  loadTexture(url: string): Promise<IGfxTexture>;

  beginFrame(): IFrameEncoder;
  destroy(): void;
}
