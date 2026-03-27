import type {
  IGfxDevice, IGfxBuffer, IGfxTexture, IGfxPipeline, IGfxBindGroup, IGfxBindGroupLayout,
  IFrameEncoder, IRenderPass,
  BufferDesc, TextureDesc, PipelineDesc, BindGroupDesc,
} from '../../gfx/IGfxDevice.js';

// ── Resource wrappers ─────────────────────────────────────────────────────────

export class WebGPUBuffer implements IGfxBuffer {
  readonly size: number;
  readonly gpuBuffer: GPUBuffer;
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

export class WebGPUTexture implements IGfxTexture {
  readonly width: number;
  readonly height: number;
  readonly gpuTexture: GPUTexture;
  constructor(device: GPUDevice, desc: TextureDesc & { format?: GPUTextureFormat; usage?: GPUTextureUsageFlags }) {
    this.width = desc.width;
    this.height = desc.height;
    this.gpuTexture = device.createTexture({
      label: desc.label,
      size: [desc.width, desc.height],
      format: desc.format ?? 'rgba8unorm',
      usage: desc.usage ?? (GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT),
    });
  }
  destroy(): void { this.gpuTexture.destroy(); }
}

export class WebGPUPipeline implements IGfxPipeline {
  readonly pipeline: GPURenderPipeline;
  constructor(pipeline: GPURenderPipeline) { this.pipeline = pipeline; }
  destroy(): void { /* GPURenderPipeline has no destroy */ }
}

export class WebGPUBindGroupLayout implements IGfxBindGroupLayout {
  readonly layout: GPUBindGroupLayout;
  constructor(layout: GPUBindGroupLayout) { this.layout = layout; }
}

export class WebGPUBindGroup implements IGfxBindGroup {
  readonly bindGroup: GPUBindGroup;
  constructor(bindGroup: GPUBindGroup) { this.bindGroup = bindGroup; }
}

// ── Render pass ───────────────────────────────────────────────────────────────

class WebGPURenderPass implements IRenderPass {
  constructor(private pass: GPURenderPassEncoder) {}

  setPipeline(p: IGfxPipeline): void {
    this.pass.setPipeline((p as WebGPUPipeline).pipeline);
  }
  setVertexBuffer(slot: number, buf: IGfxBuffer): void {
    this.pass.setVertexBuffer(slot, (buf as WebGPUBuffer).gpuBuffer);
  }
  setIndexBuffer(buf: IGfxBuffer, format: 'uint16' | 'uint32'): void {
    this.pass.setIndexBuffer((buf as WebGPUBuffer).gpuBuffer, format);
  }
  setBindGroup(index: number, group: IGfxBindGroup): void {
    this.pass.setBindGroup(index, (group as WebGPUBindGroup).bindGroup);
  }
  drawIndexed(indexCount: number, instanceCount = 1, firstIndex = 0): void {
    this.pass.drawIndexed(indexCount, instanceCount, firstIndex);
  }
  end(): void { this.pass.end(); }
}

class WebGPUFrameEncoder implements IFrameEncoder {
  private encoder: GPUCommandEncoder;
  private device: GPUDevice;
  private currentView: GPUTextureView;

  constructor(device: GPUDevice, currentView: GPUTextureView) {
    this.device = device;
    this.currentView = currentView;
    this.encoder = device.createCommandEncoder();
  }

  beginRenderPass(clearColor: [number, number, number, number]): IRenderPass {
    const [r, g, b, a] = clearColor;
    const pass = this.encoder.beginRenderPass({
      colorAttachments: [{
        view: this.currentView,
        clearValue: { r, g, b, a },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    return new WebGPURenderPass(pass);
  }

  submit(): void {
    this.device.queue.submit([this.encoder.finish()]);
  }
}

// ── Device ────────────────────────────────────────────────────────────────────

export class WebGPUDevice implements IGfxDevice {
  readonly device: GPUDevice;
  readonly context: GPUCanvasContext;
  readonly format: GPUTextureFormat;

  private constructor(device: GPUDevice, context: GPUCanvasContext, format: GPUTextureFormat) {
    this.device = device;
    this.context = context;
    this.format = format;
  }

  static async create(canvas: HTMLCanvasElement): Promise<WebGPUDevice> {
    if (!navigator.gpu) throw new Error('WebGPU not supported');
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) throw new Error('No GPU adapter found');
    const device = await adapter.requestDevice();
    const context = canvas.getContext('webgpu') as GPUCanvasContext;
    const format = navigator.gpu.getPreferredCanvasFormat();
    context.configure({ device, format, alphaMode: 'premultiplied' });
    return new WebGPUDevice(device, context, format);
  }

  createBuffer(desc: BufferDesc): IGfxBuffer {
    return new WebGPUBuffer(this.device, desc);
  }

  createTexture(desc: TextureDesc): IGfxTexture {
    return new WebGPUTexture(this.device, desc);
  }

  createPipeline(desc: PipelineDesc): IGfxPipeline {
    if (!desc.wgsl) throw new Error('WebGPUDevice requires wgsl shader');
    const module = this.device.createShaderModule({ label: desc.label, code: desc.wgsl });

    const attributes: GPUVertexAttribute[] = desc.vertexAttributes.map(a => ({
      shaderLocation: a.shaderLocation,
      offset: a.offset,
      format: a.format as GPUVertexFormat,
    }));

    const blendAlpha: GPUBlendState = {
      color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
      alpha: { srcFactor: 'one',       dstFactor: 'one-minus-src-alpha', operation: 'add' },
    };
    const blendAdditive: GPUBlendState = {
      color: { srcFactor: 'src-alpha', dstFactor: 'one', operation: 'add' },
      alpha: { srcFactor: 'one',       dstFactor: 'one', operation: 'add' },
    };
    const blend = desc.blendMode === 'additive' ? blendAdditive
                : desc.blendMode === 'none'     ? undefined
                : blendAlpha;

    const pipeline = this.device.createRenderPipeline({
      label: desc.label,
      layout: 'auto',
      vertex: {
        module,
        entryPoint: 'vs_main',
        buffers: [{ arrayStride: desc.vertexStride, attributes }],
      },
      fragment: {
        module,
        entryPoint: 'fs_main',
        targets: [{ format: this.format, blend }],
      },
      primitive: { topology: 'triangle-list', cullMode: 'none' },
    });
    return new WebGPUPipeline(pipeline);
  }

  getBindGroupLayout(pipeline: IGfxPipeline, groupIndex: number): IGfxBindGroupLayout {
    const gpuPipeline = (pipeline as WebGPUPipeline).pipeline;
    return new WebGPUBindGroupLayout(gpuPipeline.getBindGroupLayout(groupIndex));
  }

  createBindGroup(desc: BindGroupDesc): IGfxBindGroup {
    const layout = (desc.layout as WebGPUBindGroupLayout).layout;
    const entries: GPUBindGroupEntry[] = desc.entries.map(e => {
      if (e.buffer) {
        return { binding: e.binding, resource: { buffer: (e.buffer as WebGPUBuffer).gpuBuffer } };
      }
      if (e.texture) {
        return { binding: e.binding, resource: (e.texture as WebGPUTexture).gpuTexture.createView() };
      }
      if (e.sampler) {
        const sampler = this.device.createSampler({ magFilter: 'nearest', minFilter: 'nearest' });
        return { binding: e.binding, resource: sampler };
      }
      throw new Error('BindGroupEntry must have buffer, texture, or sampler');
    });
    return new WebGPUBindGroup(this.device.createBindGroup({ layout, entries }));
  }

  writeBuffer(buf: IGfxBuffer, data: ArrayBufferView | ArrayBuffer, byteOffset = 0): void {
    this.device.queue.writeBuffer((buf as WebGPUBuffer).gpuBuffer, byteOffset, data);
  }

  async loadTexture(url: string): Promise<IGfxTexture> {
    const img = new Image();
    img.src = url;
    await img.decode();
    const bitmap = await createImageBitmap(img);
    const tex = new WebGPUTexture(this.device, {
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

  beginFrame(): IFrameEncoder {
    return new WebGPUFrameEncoder(this.device, this.context.getCurrentTexture().createView());
  }

  destroy(): void { this.device.destroy(); }
}
