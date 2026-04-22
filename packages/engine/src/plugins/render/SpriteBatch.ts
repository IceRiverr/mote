// engine/src/plugins/render/SpriteBatch.ts
// 精灵批处理渲染器 —— 基于 IGfxDevice

import type { IGfxDevice, IGfxBuffer, IGfxTexture, IGfxPipeline, IGfxBindGroup, IGfxBindGroupLayout } from './IGfxDevice.js';
import { BufferUsage } from './IGfxDevice.js';
import type { Camera2D } from '../../Camera2D.js';
import type { Color } from '../../Math.js';

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

  static async load(
    gfx: IGfxDevice,
    layout: IGfxBindGroupLayout,
    imageUrl: string,
    jsonUrl?: string,
  ): Promise<TextureAtlas> {
    const texture = await gfx.loadTexture(imageUrl);
    const bindGroup = gfx.createBindGroup({
      layout,
      entries: [
        { binding: 0, sampler: true },
        { binding: 1, texture },
      ],
    });
    const atlas = new TextureAtlas(texture, bindGroup);

    if (jsonUrl) {
      const data = await fetch(jsonUrl).then(r => r.json()) as any;
      const tw = texture.width, th = texture.height;
      
      // mote-sprite 格式: { frames: [{id, x, y, w, h}] }
      if (data.frames && Array.isArray(data.frames)) {
        for (const frame of data.frames) {
          atlas.regions.set(frame.id, {
            u0: frame.x / tw,            v0: frame.y / th,
            u1: (frame.x + frame.w) / tw, v1: (frame.y + frame.h) / th,
            pixelWidth: frame.w,          pixelHeight: frame.h,
          });
        }
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

const DEFAULT_COLOR: Color = { r: 1, g: 1, b: 1, a: 1 } as Color;

export class SpriteBatch {
  private static readonly MAX_QUADS = 10_000;
  private static readonly FLOATS_PER_VERTEX = 8;   // pos(2) + uv(2) + color(4)
  private static readonly VERTICES_PER_QUAD = 4;
  private static readonly INDICES_PER_QUAD  = 6;
  private static readonly VERTEX_STRIDE     = 32;  // 8 floats × 4 bytes

  private readonly gfx: IGfxDevice;
  private readonly pipeline: IGfxPipeline;
  private readonly atlasLayout: IGfxBindGroupLayout;
  private readonly vertexBuffer: IGfxBuffer;
  private readonly indexBuffer: IGfxBuffer;
  private readonly cameraUniformBuffer: IGfxBuffer;
  private readonly cameraBindGroup: IGfxBindGroup;

  private readonly cpuBuffer: Float32Array;
  private quadCount = 0;
  private currentAtlas: TextureAtlas | null = null;
  private batches: BatchEntry[] = [];

  private frameEncoder: import('./IGfxDevice.js').IFrameEncoder | null = null;
  private renderPass: import('./IGfxDevice.js').IRenderPass | null = null;

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

    this.atlasLayout = gfx.getBindGroupLayout(this.pipeline, 1);
  }

  /** Get the bind group layout for atlas texture bind groups */
  getAtlasBindGroupLayout(): IGfxBindGroupLayout {
    return this.atlasLayout;
  }

  begin(camera: Camera2D): void {
    this.quadCount = 0;
    this.batches.length = 0;
    this.currentAtlas = null;
    this.gfx.writeBuffer(this.cameraUniformBuffer, camera.getViewProjectionMatrix().data);

    this.frameEncoder = this.gfx.beginFrame();
    const bg = camera.backgroundColor;
    this.renderPass = this.frameEncoder.beginRenderPass([bg.r, bg.g, bg.b, bg.a]);
    this.renderPass.setPipeline(this.pipeline);
    this.renderPass.setVertexBuffer(0, this.vertexBuffer);
    this.renderPass.setIndexBuffer(this.indexBuffer, 'uint16');
    this.renderPass.setBindGroup(0, this.cameraBindGroup);
  }

  drawQuad(
    x: number, y: number,
    w: number, h: number,
    rotation: number,
    region: AtlasRegion,
    atlas: TextureAtlas,
    color: Color = DEFAULT_COLOR,
    flipX = false,
    flipY = false,
  ): void {
    if (this.quadCount >= SpriteBatch.MAX_QUADS) this._flush();
    if (atlas !== this.currentAtlas) this._breakBatch(atlas);

    const base = this.quadCount * SpriteBatch.VERTICES_PER_QUAD * SpriteBatch.FLOATS_PER_VERTEX;

    if (rotation === 0) {
      const hw = w * 0.5, hh = h * 0.5;
      const x0 = x - hw, x1 = x + hw;
      const y0 = y - hh, y1 = y + hh;

      // vertex 0: top-left    (y0 = upper edge in Y-down)
      this.cpuBuffer[base]      = x0; this.cpuBuffer[base + 1]  = y0;
      this.cpuBuffer[base + 2]  = region.u0; this.cpuBuffer[base + 3]  = region.v0;
      this.cpuBuffer[base + 4]  = color.r; this.cpuBuffer[base + 5]  = color.g;
      this.cpuBuffer[base + 6]  = color.b; this.cpuBuffer[base + 7]  = color.a;
      // vertex 1: top-right
      this.cpuBuffer[base + 8]  = x1; this.cpuBuffer[base + 9]  = y0;
      this.cpuBuffer[base + 10] = region.u1; this.cpuBuffer[base + 11] = region.v0;
      this.cpuBuffer[base + 12] = color.r; this.cpuBuffer[base + 13] = color.g;
      this.cpuBuffer[base + 14] = color.b; this.cpuBuffer[base + 15] = color.a;
      // vertex 2: bottom-right  (y1 = lower edge in Y-down)
      this.cpuBuffer[base + 16] = x1; this.cpuBuffer[base + 17] = y1;
      this.cpuBuffer[base + 18] = region.u1; this.cpuBuffer[base + 19] = region.v1;
      this.cpuBuffer[base + 20] = color.r; this.cpuBuffer[base + 21] = color.g;
      this.cpuBuffer[base + 22] = color.b; this.cpuBuffer[base + 23] = color.a;
      // vertex 3: bottom-left
      this.cpuBuffer[base + 24] = x0; this.cpuBuffer[base + 25] = y1;
      this.cpuBuffer[base + 26] = region.u0; this.cpuBuffer[base + 27] = region.v1;
      this.cpuBuffer[base + 28] = color.r; this.cpuBuffer[base + 29] = color.g;
      this.cpuBuffer[base + 30] = color.b; this.cpuBuffer[base + 31] = color.a;
    } else {
      const hw = w * 0.5, hh = h * 0.5;
      const cos = Math.cos(rotation), sin = Math.sin(rotation);

      const lx0 = -hw, lx1 = hw;
      const ly0 = -hh, ly1 = hh;

      // Unrolled 4 vertices with rotation transform
      // vertex 0: top-left    (ly0 = -hh → upper edge in Y-down)
      this.cpuBuffer[base]      = x + lx0 * cos - ly0 * sin;
      this.cpuBuffer[base + 1]  = y + lx0 * sin + ly0 * cos;
      this.cpuBuffer[base + 2]  = region.u0; this.cpuBuffer[base + 3]  = region.v0;
      this.cpuBuffer[base + 4]  = color.r; this.cpuBuffer[base + 5]  = color.g;
      this.cpuBuffer[base + 6]  = color.b; this.cpuBuffer[base + 7]  = color.a;
      // vertex 1: top-right
      this.cpuBuffer[base + 8]  = x + lx1 * cos - ly0 * sin;
      this.cpuBuffer[base + 9]  = y + lx1 * sin + ly0 * cos;
      this.cpuBuffer[base + 10] = region.u1; this.cpuBuffer[base + 11] = region.v0;
      this.cpuBuffer[base + 12] = color.r; this.cpuBuffer[base + 13] = color.g;
      this.cpuBuffer[base + 14] = color.b; this.cpuBuffer[base + 15] = color.a;
      // vertex 2: bottom-right  (ly1 = +hh → lower edge in Y-down)
      this.cpuBuffer[base + 16] = x + lx1 * cos - ly1 * sin;
      this.cpuBuffer[base + 17] = y + lx1 * sin + ly1 * cos;
      this.cpuBuffer[base + 18] = region.u1; this.cpuBuffer[base + 19] = region.v1;
      this.cpuBuffer[base + 20] = color.r; this.cpuBuffer[base + 21] = color.g;
      this.cpuBuffer[base + 22] = color.b; this.cpuBuffer[base + 23] = color.a;
      // vertex 3: bottom-left
      this.cpuBuffer[base + 24] = x + lx0 * cos - ly1 * sin;
      this.cpuBuffer[base + 25] = y + lx0 * sin + ly1 * cos;
      this.cpuBuffer[base + 26] = region.u0; this.cpuBuffer[base + 27] = region.v1;
      this.cpuBuffer[base + 28] = color.r; this.cpuBuffer[base + 29] = color.g;
      this.cpuBuffer[base + 30] = color.b; this.cpuBuffer[base + 31] = color.a;
    }

    this.quadCount++;
    this.batches[this.batches.length - 1].quadCount++;
  }

  end(): void {
    if (this.quadCount === 0) {
      // 即使没画任何东西也要正确关闭 render pass
      if (this.renderPass) { this.renderPass.end(); this.renderPass = null; }
      if (this.frameEncoder) { this.frameEncoder.submit(); this.frameEncoder = null; }
      return;
    }

    const byteSize = this.quadCount * SpriteBatch.VERTICES_PER_QUAD * SpriteBatch.VERTEX_STRIDE;
    this.gfx.writeBuffer(this.vertexBuffer, this.cpuBuffer.subarray(0, byteSize / 4));

    const pass = this.renderPass!;

    for (const batch of this.batches) {
      pass.setBindGroup(1, batch.atlas.bindGroup);
      pass.drawIndexed(
        batch.quadCount * SpriteBatch.INDICES_PER_QUAD,
        1,
        batch.startQuad * SpriteBatch.INDICES_PER_QUAD,
      );
    }

    pass.end();
    this.frameEncoder!.submit();
    this.renderPass = null;
    this.frameEncoder = null;
    this.quadCount = 0;
    this.batches.length = 0;
    this.currentAtlas = null;
  }

  private _breakBatch(atlas: TextureAtlas): void {
    this.batches.push({ atlas, startQuad: this.quadCount, quadCount: 0 });
    this.currentAtlas = atlas;
  }

  private _flush(): void {
    if (this.quadCount === 0) return;
    const byteSize = this.quadCount * SpriteBatch.VERTICES_PER_QUAD * SpriteBatch.VERTEX_STRIDE;
    this.gfx.writeBuffer(this.vertexBuffer, this.cpuBuffer.subarray(0, byteSize / 4));

    const pass = this.renderPass!;
    for (const batch of this.batches) {
      pass.setBindGroup(1, batch.atlas.bindGroup);
      pass.drawIndexed(
        batch.quadCount * SpriteBatch.INDICES_PER_QUAD,
        1,
        batch.startQuad * SpriteBatch.INDICES_PER_QUAD,
      );
    }

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
