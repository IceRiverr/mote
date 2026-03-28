import type {
  IGfxDevice, IGfxBuffer, IGfxTexture, IGfxPipeline, IGfxBindGroup, IGfxBindGroupLayout,
  IFrameEncoder, IRenderPass,
  BufferDesc, TextureDesc, PipelineDesc, BindGroupDesc, BindGroupEntry,
} from './IGfxDevice.js';
import { BufferUsage } from './IGfxDevice.js';

// ── Resource wrappers ─────────────────────────────────────────────────────────

export class WebGL2Buffer implements IGfxBuffer {
  readonly size: number;
  readonly glBuffer: WebGLBuffer;
  readonly target: number;
  private readonly gl: WebGL2RenderingContext;

  constructor(gl: WebGL2RenderingContext, desc: BufferDesc) {
    this.gl = gl;
    this.size = desc.size;
    const buf = gl.createBuffer();
    if (!buf) throw new Error('Failed to create WebGL buffer');
    this.glBuffer = buf;
    this.target = (desc.usage & BufferUsage.INDEX)
      ? gl.ELEMENT_ARRAY_BUFFER
      : (desc.usage & BufferUsage.UNIFORM)
        ? gl.UNIFORM_BUFFER
        : gl.ARRAY_BUFFER;
    gl.bindBuffer(this.target, buf);
    gl.bufferData(this.target, desc.size, gl.DYNAMIC_DRAW);
    gl.bindBuffer(this.target, null);
  }

  destroy(): void {
    this.gl.deleteBuffer(this.glBuffer);
  }
}

export class WebGL2Texture implements IGfxTexture {
  readonly width: number;
  readonly height: number;
  readonly glTexture: WebGLTexture;
  private readonly gl: WebGL2RenderingContext;

  private constructor(gl: WebGL2RenderingContext, width: number, height: number, glTexture: WebGLTexture) {
    this.gl = gl;
    this.width = width;
    this.height = height;
    this.glTexture = glTexture;
  }

  static createEmpty(gl: WebGL2RenderingContext, desc: TextureDesc): WebGL2Texture {
    const tex = gl.createTexture();
    if (!tex) throw new Error('Failed to create WebGL texture');
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, desc.width, desc.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);
    return new WebGL2Texture(gl, desc.width, desc.height, tex);
  }

  static fromLoaded(gl: WebGL2RenderingContext, width: number, height: number, glTexture: WebGLTexture): WebGL2Texture {
    return new WebGL2Texture(gl, width, height, glTexture);
  }

  destroy(): void {
    this.gl.deleteTexture(this.glTexture);
  }
}

// Stores uniform locations and texture unit assignments resolved at pipeline creation
interface UniformInfo {
  name: string;
  location: WebGLUniformLocation;
  type: 'mat4' | 'sampler2D';
  textureUnit?: number;
}

export class WebGL2Pipeline implements IGfxPipeline {
  readonly program: WebGLProgram;
  readonly uniforms: UniformInfo[];
  readonly bindingMap: Map<number, Map<number, UniformInfo>>;
  readonly vertexStride: number;
  readonly vertexAttributes: { shaderLocation: number; offset: number; size: number }[];

  constructor(
    program: WebGLProgram,
    uniforms: UniformInfo[],
    bindingMap: Map<number, Map<number, UniformInfo>>,
    vertexStride: number,
    vertexAttributes: { shaderLocation: number; offset: number; size: number }[],
  ) {
    this.program = program;
    this.uniforms = uniforms;
    this.bindingMap = bindingMap;
    this.vertexStride = vertexStride;
    this.vertexAttributes = vertexAttributes;
  }
  destroy(): void {}
}

export class WebGL2BindGroupLayout implements IGfxBindGroupLayout {
  readonly groupIndex: number;
  constructor(groupIndex: number) { this.groupIndex = groupIndex; }
}

export class WebGL2BindGroup implements IGfxBindGroup {
  readonly groupIndex: number;
  readonly entries: BindGroupEntry[];
  constructor(groupIndex: number, entries: BindGroupEntry[]) {
    this.groupIndex = groupIndex;
    this.entries = entries;
  }
}

// ── Render pass ───────────────────────────────────────────────────────────────

class WebGL2RenderPass implements IRenderPass {
  private gl: WebGL2RenderingContext;
  private vao: WebGLVertexArrayObject;
  private currentPipeline: WebGL2Pipeline | null = null;
  private boundGroups: Map<number, WebGL2BindGroup> = new Map();
  private dirtyGroups = new Set<number>();

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    const vao = gl.createVertexArray();
    if (!vao) throw new Error('Failed to create VAO');
    this.vao = vao;
    gl.bindVertexArray(this.vao);
  }

  setPipeline(p: IGfxPipeline): void {
    this.currentPipeline = p as WebGL2Pipeline;
    this.gl.useProgram(this.currentPipeline.program);
    // Mark all currently bound groups as dirty (new pipeline = re-apply all)
    for (const groupIdx of this.boundGroups.keys()) {
      this.dirtyGroups.add(groupIdx);
    }
  }

  setVertexBuffer(slot: number, buf: IGfxBuffer): void {
    const gl = this.gl;
    const b = buf as WebGL2Buffer;
    gl.bindBuffer(gl.ARRAY_BUFFER, b.glBuffer);
    void slot;
    if (this.currentPipeline) {
      for (const attr of this.currentPipeline.vertexAttributes) {
        gl.enableVertexAttribArray(attr.shaderLocation);
        gl.vertexAttribPointer(attr.shaderLocation, attr.size, gl.FLOAT, false, this.currentPipeline.vertexStride, attr.offset);
      }
    }
  }

  setIndexBuffer(buf: IGfxBuffer, _format: 'uint16' | 'uint32'): void {
    const gl = this.gl;
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, (buf as WebGL2Buffer).glBuffer);
  }

  setBindGroup(index: number, group: IGfxBindGroup): void {
    this.boundGroups.set(index, group as WebGL2BindGroup);
    this.dirtyGroups.add(index);
  }

  drawIndexed(indexCount: number, _instanceCount = 1, firstIndex = 0): void {
    const gl = this.gl;
    const pipeline = this.currentPipeline!;

    for (const groupIdx of this.dirtyGroups) {
      const group = this.boundGroups.get(groupIdx);
      if (!group) continue;
      const groupBindings = pipeline.bindingMap.get(groupIdx);
      if (!groupBindings) continue;
      for (const entry of group.entries) {
        const info = groupBindings.get(entry.binding);
        if (!info) continue;
        if (info.type === 'mat4' && entry.buffer) {
          const buf = entry.buffer as WebGL2Buffer & { cpuData?: Float32Array };
          if (buf.cpuData) gl.uniformMatrix4fv(info.location, false, buf.cpuData);
        } else if (info.type === 'sampler2D' && entry.texture) {
          const unit = info.textureUnit ?? 0;
          gl.activeTexture(gl.TEXTURE0 + unit);
          gl.bindTexture(gl.TEXTURE_2D, (entry.texture as WebGL2Texture).glTexture);
          gl.uniform1i(info.location, unit);
        }
      }
    }
    this.dirtyGroups.clear();

    gl.drawElements(gl.TRIANGLES, indexCount, gl.UNSIGNED_SHORT, firstIndex * 2);
  }

  end(): void {
    this.gl.bindVertexArray(null);
    this.gl.deleteVertexArray(this.vao);
  }
}

class WebGL2FrameEncoder implements IFrameEncoder {
  private gl: WebGL2RenderingContext;

  constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
  }

  beginRenderPass(clearColor: [number, number, number, number]): IRenderPass {
    const gl = this.gl;
    const [r, g, b, a] = clearColor;
    gl.clearColor(r, g, b, a);
    gl.clear(gl.COLOR_BUFFER_BIT);
    return new WebGL2RenderPass(gl);
  }

  submit(): void { /* WebGL 2 is immediate mode — nothing to submit */ }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function compileShader(gl: WebGL2RenderingContext, type: number, src: string): WebGLShader {
  const shader = gl.createShader(type)!;
  gl.shaderSource(shader, src);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(`Shader compile error: ${gl.getShaderInfoLog(shader)}`);
  }
  return shader;
}

function linkProgram(gl: WebGL2RenderingContext, vert: string, frag: string): WebGLProgram {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vert);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, frag);
  const prog = gl.createProgram()!;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    throw new Error(`Program link error: ${gl.getProgramInfoLog(prog)}`);
  }
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  return prog;
}

// ── Device ────────────────────────────────────────────────────────────────────

type WebGL2BufferWithShadow = WebGL2Buffer & { cpuData?: Float32Array };

export class WebGL2Device implements IGfxDevice {
  private gl: WebGL2RenderingContext;

  private constructor(gl: WebGL2RenderingContext) {
    this.gl = gl;
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
  }

  static async create(canvas: HTMLCanvasElement): Promise<WebGL2Device> {
    const gl = canvas.getContext('webgl2');
    if (!gl) throw new Error('WebGL 2 not supported');
    return new WebGL2Device(gl);
  }

  createBuffer(desc: BufferDesc): IGfxBuffer {
    return new WebGL2Buffer(this.gl, desc);
  }

  createTexture(desc: TextureDesc): IGfxTexture {
    return WebGL2Texture.createEmpty(this.gl, desc);
  }

  createPipeline(desc: PipelineDesc): IGfxPipeline {
    if (!desc.vertGlsl || !desc.fragGlsl) throw new Error('WebGL2Device requires vertGlsl and fragGlsl');
    const program = linkProgram(this.gl, desc.vertGlsl, desc.fragGlsl);
    this.gl.useProgram(program);

    const vertexAttrs = desc.vertexAttributes.map(a => ({
      shaderLocation: a.shaderLocation,
      offset: a.offset,
      size: a.format === 'float32x2' ? 2 : 4,
    }));

    const uniforms: UniformInfo[] = [];
    const bindingMap = new Map<number, Map<number, UniformInfo>>();
    let textureUnit = 0;

    for (let groupIdx = 0; groupIdx < desc.bindGroupLayouts.length; groupIdx++) {
      const groupMap = new Map<number, UniformInfo>();
      bindingMap.set(groupIdx, groupMap);
      for (const entry of desc.bindGroupLayouts[groupIdx]) {
        if (entry.type === 'sampler') continue;
        const name = entry.name;
        if (!name) continue;
        const loc = this.gl.getUniformLocation(program, name);
        if (!loc) continue;
        const info: UniformInfo = {
          name,
          location: loc,
          type: entry.type === 'texture' ? 'sampler2D' : 'mat4',
          textureUnit: entry.type === 'texture' ? textureUnit++ : undefined,
        };
        uniforms.push(info);
        groupMap.set(entry.binding, info);
      }
    }

    return new WebGL2Pipeline(program, uniforms, bindingMap, desc.vertexStride, vertexAttrs);
  }

  getBindGroupLayout(pipeline: IGfxPipeline, groupIndex: number): IGfxBindGroupLayout {
    void pipeline;
    return new WebGL2BindGroupLayout(groupIndex);
  }

  createBindGroup(desc: BindGroupDesc): IGfxBindGroup {
    const layout = desc.layout as WebGL2BindGroupLayout;
    return new WebGL2BindGroup(layout.groupIndex, desc.entries);
  }

  writeBuffer(buf: IGfxBuffer, data: ArrayBufferView | ArrayBuffer, byteOffset = 0): void {
    const gl = this.gl;
    const b = buf as WebGL2BufferWithShadow;
    gl.bindBuffer(b.target, b.glBuffer);
    if (data instanceof ArrayBuffer) {
      gl.bufferSubData(b.target, byteOffset, data);
    } else {
      gl.bufferSubData(b.target, byteOffset, data);
    }
    if (data instanceof Float32Array) {
      b.cpuData = new Float32Array(data);
    }
    gl.bindBuffer(b.target, null);
  }

  async loadTexture(url: string): Promise<IGfxTexture> {
    const gl = this.gl;
    const resp = await fetch(url);
    const blob = await resp.blob();
    const bitmap = await createImageBitmap(blob);

    const tex = gl.createTexture();
    if (!tex) throw new Error('Failed to create texture');
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bitmap);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.bindTexture(gl.TEXTURE_2D, null);

    bitmap.close();
    return WebGL2Texture.fromLoaded(gl, bitmap.width, bitmap.height, tex);
  }

  beginFrame(): IFrameEncoder {
    return new WebGL2FrameEncoder(this.gl);
  }

  destroy(): void {
    const ext = this.gl.getExtension('WEBGL_lose_context');
    ext?.loseContext();
  }
}
