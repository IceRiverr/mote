import type { IGfxDevice, IGfxBuffer, IGfxTexture, IGfxPipeline, IGfxBindGroup, IGfxBindGroupLayout } from './IGfxDevice.js';
import { BufferUsage } from './IGfxDevice.js';
import type { Camera2D } from '../Camera2D.js';
import type { Color } from '../Color.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AtlasRegion {
  u0: number; v0: number;
  u1: number; v1: number;
  pixelWidth: number;
  pixelHeight: number;
}
import SPRITE_WGSL from './shaders/SpriteBatch.wgsl?raw';
import SPRITE_VERT_GLSL from './shaders/sprite_batch.vert.glsl?raw';
import SPRITE_FRAG_GLSL from './shaders/sprite_batch.frag.glsl?raw';

// ── TextureAtlas ──────────────────────────────────────────────────────────────

export class TextureAtlas {
  readonly texture: IGfxTexture;
  readonly bindGroup: IGfxBindGroup;
  private regions: Map<string, AtlasRegion> = new Map();

  constructor(texture: IGfxTexture, bindGroup: IGfxBindGroup) {
    this.texture = texture;
    this.bindGroup = bindGroup;
  }

  static async load(gfx: IGfxDevice, imageUrl: string, jsonUrl?: string): Promise<TextureAtlas> {
    const texture = await gfx.loadTexture(imageUrl);
    const layout = SpriteBatch.getAtlasBindGroupLayout(gfx);
    const bindGroup = gfx.createBindGroup({
      layout,
      entries: [
        { binding: 0, sampler: true },
        { binding: 1, texture },
      ],
    });
    const atlas = new TextureAtlas(texture, bindGroup);

    if (jsonUrl) {
      const data = await fetch(jsonUrl).then(r => r.json()) as Record<string, { x: number; y: number; w: number; h: number }>;
      const tw = texture.width, th = texture.height;
      for (const [name, frame] of Object.entries(data)) {
        atlas.regions.set(name, {
          u0: frame.x / tw,            v0: frame.y / th,
          u1: (frame.x + frame.w) / tw, v1: (frame.y + frame.h) / th,
          pixelWidth: frame.w,          pixelHeight: frame.h,
        });
      }
    } else {
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

  private static _atlasLayout: IGfxBindGroupLayout | null = null;

  private readonly gfx: IGfxDevice;
  private readonly pipeline: IGfxPipeline;
  private readonly vertexBuffer: IGfxBuffer;
  private readonly indexBuffer: IGfxBuffer;
  private readonly cameraUniformBuffer: IGfxBuffer;
  private readonly cameraBindGroup: IGfxBindGroup;

  private readonly cpuBuffer: Float32Array;
  private quadCount = 0;
  private currentAtlas: TextureAtlas | null = null;
  private batches: BatchEntry[] = [];

  constructor(gfx: IGfxDevice) {
    this.gfx = gfx;
    const MAX = SpriteBatch.MAX_QUADS;

    this.cpuBuffer = new Float32Array(MAX * SpriteBatch.VERTICES_PER_QUAD * SpriteBatch.FLOATS_PER_VERTEX);

    this.vertexBuffer = gfx.createBuffer({
      label: 'SpriteBatch:vertex',
      size: MAX * SpriteBatch.VERTICES_PER_QUAD * SpriteBatch.VERTEX_STRIDE,
      usage: BufferUsage.VERTEX | BufferUsage.COPY_DST,
    });

    this.indexBuffer = gfx.createBuffer({
      label: 'SpriteBatch:index',
      size: MAX * SpriteBatch.INDICES_PER_QUAD * 2,
      usage: BufferUsage.INDEX | BufferUsage.COPY_DST,
    });
    gfx.writeBuffer(this.indexBuffer, generateIndices(MAX));

    this.cameraUniformBuffer = gfx.createBuffer({
      label: 'SpriteBatch:cameraUniform',
      size: 64,
      usage: BufferUsage.UNIFORM | BufferUsage.COPY_DST,
    });

    this.pipeline = gfx.createPipeline({
      label: 'SpritePipeline',
      wgsl: SPRITE_WGSL,
      vertGlsl: SPRITE_VERT_GLSL,
      fragGlsl: SPRITE_FRAG_GLSL,
      vertexStride: SpriteBatch.VERTEX_STRIDE,
      vertexAttributes: [
        { shaderLocation: 0, offset: 0,  format: 'float32x2' },
        { shaderLocation: 1, offset: 8,  format: 'float32x2' },
        { shaderLocation: 2, offset: 16, format: 'float32x4' },
      ],
      blendMode: 'alpha',
      bindGroupLayouts: [
        [{ binding: 0, type: 'uniform', name: 'u_viewProjection' }],
        [{ binding: 0, type: 'sampler' }, { binding: 1, type: 'texture', name: 'u_texture' }],
      ],
    });

    const cameraLayout = gfx.getBindGroupLayout(this.pipeline, 0);
    this.cameraBindGroup = gfx.createBindGroup({
      layout: cameraLayout,
      entries: [{ binding: 0, buffer: this.cameraUniformBuffer }],
    });

    // Cache atlas layout for TextureAtlas.load()
    SpriteBatch._atlasLayout = gfx.getBindGroupLayout(this.pipeline, 1);
  }

  static getAtlasBindGroupLayout(_gfx: IGfxDevice): IGfxBindGroupLayout {
    if (!SpriteBatch._atlasLayout) throw new Error('SpriteBatch not yet constructed');
    return SpriteBatch._atlasLayout;
  }

  begin(camera: Camera2D): void {
    this.quadCount = 0;
    this.batches.length = 0;
    this.currentAtlas = null;
    this.gfx.writeBuffer(this.cameraUniformBuffer, camera.getViewProjectionMatrix().data);
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
    this.gfx.writeBuffer(this.vertexBuffer, this.cpuBuffer.subarray(0, byteSize / 4));

    const frame = this.gfx.beginFrame();
    const pass = frame.beginRenderPass([0.04, 0.04, 0.08, 1.0]);

    pass.setPipeline(this.pipeline);
    pass.setVertexBuffer(0, this.vertexBuffer);
    pass.setIndexBuffer(this.indexBuffer, 'uint16');
    pass.setBindGroup(0, this.cameraBindGroup);

    for (const batch of this.batches) {
      pass.setBindGroup(1, batch.atlas.bindGroup);
      pass.drawIndexed(
        batch.quadCount * SpriteBatch.INDICES_PER_QUAD,
        1,
        batch.startQuad * SpriteBatch.INDICES_PER_QUAD,
      );
    }

    pass.end();
    frame.submit();
    this.quadCount = 0;
    this.batches.length = 0;
    this.currentAtlas = null;

  }

  private _breakBatch(atlas: TextureAtlas): void {
    this.batches.push({ atlas, startQuad: this.quadCount, quadCount: 0 });
    this.currentAtlas = atlas;
  }

  private _flush(): void {
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
