import type { GfxDevice } from '../../core/GfxDevice.js';
import type { GfxBuffer } from '../../core/GfxResources.js';
import type { GfxTexture } from '../../core/GfxResources.js';
import type { AtlasRegion } from '../../core/types.js';
import type { Camera2D } from './Camera2D.js';
import type { Color } from '../../math/Color.js';
import SPRITE_WGSL from '../shaders/sprite_batch.wgsl?raw';

// ── TextureAtlas ──────────────────────────────────────────────────────────────

export class TextureAtlas {
  readonly texture: GfxTexture;
  readonly bindGroup: GPUBindGroup;
  private regions: Map<string, AtlasRegion> = new Map();

  constructor(texture: GfxTexture, bindGroup: GPUBindGroup) {
    this.texture = texture;
    this.bindGroup = bindGroup;
  }

  static async load(gfx: GfxDevice, imageUrl: string, jsonUrl?: string): Promise<TextureAtlas> {
    const texture = await gfx.loadTexture(imageUrl);
    const sampler = gfx.device.createSampler({ magFilter: 'nearest', minFilter: 'nearest' });
    const bindGroup = gfx.device.createBindGroup({
      label: `atlas:${imageUrl}`,
      layout: SpriteBatch.getAtlasBindGroupLayout(gfx),
      entries: [
        { binding: 0, resource: sampler },
        { binding: 1, resource: texture.gpuTexture.createView() },
      ],
    });
    const atlas = new TextureAtlas(texture, bindGroup);

    if (jsonUrl) {
      const data = await fetch(jsonUrl).then(r => r.json()) as Record<string, { x: number; y: number; w: number; h: number }>;
      const tw = texture.width, th = texture.height;
      for (const [name, frame] of Object.entries(data)) {
        atlas.regions.set(name, {
          u0: frame.x / tw,       v0: frame.y / th,
          u1: (frame.x + frame.w) / tw, v1: (frame.y + frame.h) / th,
          pixelWidth: frame.w,    pixelHeight: frame.h,
        });
      }
    } else {
      // Whole texture as single region
      atlas.regions.set('__full__', { u0: 0, v0: 0, u1: 1, v1: 1, pixelWidth: texture.width, pixelHeight: texture.height });
    }

    return atlas;
  }

  getRegion(name: string): AtlasRegion {
    const r = this.regions.get(name);
    if (!r) throw new Error(`Atlas region not found: ${name}`);
    return r;
  }

  get fullRegion(): AtlasRegion { return this.regions.get('__full__')!; }
}

// ── BatchEntry ────────────────────────────────────────────────────────────────

interface BatchEntry {
  atlas: TextureAtlas;
  startQuad: number;
  quadCount: number;
}

// ── SpriteBatch ───────────────────────────────────────────────────────────────

export class SpriteBatch {
  private static readonly MAX_QUADS = 10_000;
  private static readonly FLOATS_PER_VERTEX = 8;   // pos(2) + uv(2) + color(4)
  private static readonly VERTICES_PER_QUAD = 4;
  private static readonly INDICES_PER_QUAD  = 6;
  private static readonly VERTEX_STRIDE     = 32;  // 8 floats × 4 bytes

  private static _atlasLayout: GPUBindGroupLayout | null = null;

  private readonly gfx: GfxDevice;
  private readonly pipeline: GPURenderPipeline;
  private readonly vertexBuffer: GfxBuffer;
  private readonly indexBuffer: GfxBuffer;
  private readonly cameraUniformBuffer: GfxBuffer;
  private readonly cameraBindGroup: GPUBindGroup;

  private readonly cpuBuffer: Float32Array;
  private quadCount = 0;
  private currentAtlas: TextureAtlas | null = null;
  private batches: BatchEntry[] = [];

  constructor(gfx: GfxDevice) {
    this.gfx = gfx;
    const device = gfx.device;
    const MAX = SpriteBatch.MAX_QUADS;

    // CPU-side vertex staging buffer
    this.cpuBuffer = new Float32Array(MAX * SpriteBatch.VERTICES_PER_QUAD * SpriteBatch.FLOATS_PER_VERTEX);

    // GPU vertex buffer (dynamic, written every frame)
    this.vertexBuffer = gfx.createBuffer({
      label: 'SpriteBatch:vertex',
      size: MAX * SpriteBatch.VERTICES_PER_QUAD * SpriteBatch.VERTEX_STRIDE,
      usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
    });

    // GPU index buffer (static, generated once)
    this.indexBuffer = gfx.createBuffer({
      label: 'SpriteBatch:index',
      size: MAX * SpriteBatch.INDICES_PER_QUAD * 2, // Uint16
      usage: GPUBufferUsage.INDEX | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(this.indexBuffer.gpuBuffer, 0, generateIndices(MAX));

    // Camera uniform buffer (64 bytes = mat4)
    this.cameraUniformBuffer = gfx.createBuffer({
      label: 'SpriteBatch:cameraUniform',
      size: 64,
      usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    // Pipeline
    this.pipeline = createSpritePipeline(device, gfx.format);

    // Camera bind group (group 0)
    this.cameraBindGroup = device.createBindGroup({
      label: 'SpriteBatch:cameraBindGroup',
      layout: this.pipeline.getBindGroupLayout(0),
      entries: [{ binding: 0, resource: { buffer: this.cameraUniformBuffer.gpuBuffer } }],
    });

    // Cache atlas layout for TextureAtlas.load()
    SpriteBatch._atlasLayout = this.pipeline.getBindGroupLayout(1);
  }

  static getAtlasBindGroupLayout(_gfx: GfxDevice): GPUBindGroupLayout {
    if (!SpriteBatch._atlasLayout) throw new Error('SpriteBatch not yet constructed');
    return SpriteBatch._atlasLayout;
  }

  begin(camera: Camera2D): void {
    this.quadCount = 0;
    this.batches.length = 0;
    this.currentAtlas = null;
    // Upload camera VP matrix
    this.gfx.device.queue.writeBuffer(this.cameraUniformBuffer.gpuBuffer, 0, camera.getViewProjectionMatrix().data);
  }

  drawQuad(
    x: number, y: number,
    w: number, h: number,
    rotation: number,
    region: AtlasRegion,
    atlas: TextureAtlas,
    color: Color = { r: 1, g: 1, b: 1, a: 1 } as Color,
  ): void {
    if (this.quadCount >= SpriteBatch.MAX_QUADS) this._flush();
    if (atlas !== this.currentAtlas) this._breakBatch(atlas);

    const hw = w * 0.5, hh = h * 0.5;
    const cos = Math.cos(rotation), sin = Math.sin(rotation);

    // Corner offsets (local space, center at origin)
    //  3 ---- 2
    //  |      |
    //  0 ---- 1
    const lx = [-hw,  hw,  hw, -hw];
    const ly = [-hh, -hh,  hh,  hh];
    const uvs: [number, number][] = [
      [region.u0, region.v1],
      [region.u1, region.v1],
      [region.u1, region.v0],
      [region.u0, region.v0],
    ];

    const base = this.quadCount * SpriteBatch.VERTICES_PER_QUAD * SpriteBatch.FLOATS_PER_VERTEX;
    for (let i = 0; i < 4; i++) {
      const o = base + i * SpriteBatch.FLOATS_PER_VERTEX;
      this.cpuBuffer[o + 0] = x + lx[i] * cos - ly[i] * sin;
      this.cpuBuffer[o + 1] = y + lx[i] * sin + ly[i] * cos;
      this.cpuBuffer[o + 2] = uvs[i][0];
      this.cpuBuffer[o + 3] = uvs[i][1];
      this.cpuBuffer[o + 4] = color.r;
      this.cpuBuffer[o + 5] = color.g;
      this.cpuBuffer[o + 6] = color.b;
      this.cpuBuffer[o + 7] = color.a;
    }
    this.quadCount++;
    this.batches[this.batches.length - 1].quadCount++;
  }

  end(): void {
    if (this.quadCount === 0) return;

    const byteSize = this.quadCount * SpriteBatch.VERTICES_PER_QUAD * SpriteBatch.VERTEX_STRIDE;
    this.gfx.device.queue.writeBuffer(this.vertexBuffer.gpuBuffer, 0, this.cpuBuffer.buffer, 0, byteSize);

    const encoder = this.gfx.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: this.gfx.getCurrentTextureView(),
        clearValue: { r: 0.04, g: 0.04, b: 0.08, a: 1.0 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });

    pass.setPipeline(this.pipeline);
    pass.setVertexBuffer(0, this.vertexBuffer.gpuBuffer);
    pass.setIndexBuffer(this.indexBuffer.gpuBuffer, 'uint16');
    pass.setBindGroup(0, this.cameraBindGroup);

    for (const batch of this.batches) {
      pass.setBindGroup(1, batch.atlas.bindGroup);
      pass.drawIndexed(batch.quadCount * SpriteBatch.INDICES_PER_QUAD, 1, batch.startQuad * SpriteBatch.INDICES_PER_QUAD, 0, 0);
    }

    pass.end();
    this.gfx.device.queue.submit([encoder.finish()]);
    this.quadCount = 0;
    this.batches.length = 0;
    this.currentAtlas = null;
  }

  private _breakBatch(atlas: TextureAtlas): void {
    this.batches.push({ atlas, startQuad: this.quadCount, quadCount: 0 });
    this.currentAtlas = atlas;
  }

  private _flush(): void {
    // Overflow guard: end current frame and start fresh
    this.end();
    this.quadCount = 0;
    this.batches.length = 0;
    this.currentAtlas = null;
  }

  destroy(): void {
    this.vertexBuffer.destroy();
    this.indexBuffer.destroy();
    this.cameraUniformBuffer.destroy();
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateIndices(maxQuads: number): Uint16Array {
  const indices = new Uint16Array(maxQuads * 6);
  for (let i = 0; i < maxQuads; i++) {
    const base = i * 4, offset = i * 6;
    indices[offset + 0] = base + 0;
    indices[offset + 1] = base + 1;
    indices[offset + 2] = base + 2;
    indices[offset + 3] = base + 2;
    indices[offset + 4] = base + 3;
    indices[offset + 5] = base + 0;
  }
  return indices;
}

function createSpritePipeline(device: GPUDevice, format: GPUTextureFormat): GPURenderPipeline {
  const shaderModule = device.createShaderModule({ label: 'sprite_batch', code: SPRITE_WGSL });
  return device.createRenderPipeline({
    label: 'SpritePipeline',
    layout: 'auto',
    vertex: {
      module: shaderModule,
      entryPoint: 'vs_main',
      buffers: [{
        arrayStride: 32,
        attributes: [
          { shaderLocation: 0, offset: 0,  format: 'float32x2' },
          { shaderLocation: 1, offset: 8,  format: 'float32x2' },
          { shaderLocation: 2, offset: 16, format: 'float32x4' },
        ],
      }],
    },
    fragment: {
      module: shaderModule,
      entryPoint: 'fs_main',
      targets: [{
        format,
        blend: {
          color: { srcFactor: 'src-alpha', dstFactor: 'one-minus-src-alpha', operation: 'add' },
          alpha: { srcFactor: 'one',       dstFactor: 'one-minus-src-alpha', operation: 'add' },
        },
      }],
    },
    primitive: { topology: 'triangle-list', cullMode: 'none' },
  });
}
