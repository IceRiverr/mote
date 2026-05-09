# WebGL 2 后端开发计划

## 现状分析

### 当前架构

```
packages/engine/src/
├── GfxDevice.ts        ← 直接包装 WebGPU GPUDevice
├── GfxResources.ts     ← GfxBuffer / GfxTexture，内部持有 GPUBuffer / GPUTexture
├── types.ts            ← IGfxBuffer / IGfxTexture 接口（已存在！）
├── SpriteBatch.ts      ← 直接调用 WebGPU API（GPURenderPipeline、GPUBindGroup 等）
└── shaders/
    └── SpriteBatch.wgsl
```

### 问题

`SpriteBatch.ts` 大量直接使用 WebGPU 类型：
- `GPURenderPipeline`、`GPUBindGroup`、`GPUBindGroupLayout`
- `device.createRenderPipeline()`、`device.createBindGroup()`
- `encoder.beginRenderPass()`、`pass.setBindGroup()`
- `TextureAtlas` 内部持有 `GPUBindGroup`

`types.ts` 里的 `IGfxBuffer` / `IGfxTexture` 接口已经存在，但 `IGfxBuffer.gpuBuffer: GPUBuffer` 仍然暴露了 WebGPU 类型，没有真正抽象。

---

## 目标架构

```
Layer 2: SpriteBatch / Camera2D / TextureAtlas（不感知底层）
    ↓ 调用
Layer 1: IGfxDevice 接口
    ├── WebGPUDevice   (packages/engine/src/backends/webgpu/)
    └── WebGL2Device   (packages/engine/src/backends/webgl2/)
```

---

## 开发步骤

### Step 1 — 定义 Layer 1 抽象接口

**文件：** `src/gfx/IGfxDevice.ts`

核心接口：

```typescript
// 不透明句柄，Layer 2 不需要知道内部是什么
export interface IGfxBuffer   { readonly size: number; destroy(): void; }
export interface IGfxTexture  { readonly width: number; readonly height: number; destroy(): void; }
export interface IGfxPipeline { destroy(): void; }
export interface IGfxBindGroup {}

export interface IGfxDevice {
  readonly canvasFormat: string;  // 仅供参考，WebGL2 不需要

  createBuffer(desc: BufferDesc): IGfxBuffer;
  createTexture(desc: TextureDesc): IGfxTexture;
  createPipeline(desc: PipelineDesc): IGfxPipeline;
  createBindGroup(desc: BindGroupDesc): IGfxBindGroup;

  writeBuffer(buf: IGfxBuffer, data: BufferSource, offset?: number): void;
  loadTexture(url: string): Promise<IGfxTexture>;
  getCurrentTextureView(): IGfxTextureView;  // 抽象的 render target

  beginFrame(): IFrameEncoder;
  destroy(): void;
}

export interface IFrameEncoder {
  beginRenderPass(clearColor: [number,number,number,number]): IRenderPass;
  submit(): void;
}

export interface IRenderPass {
  setPipeline(pipeline: IGfxPipeline): void;
  setVertexBuffer(slot: number, buf: IGfxBuffer): void;
  setIndexBuffer(buf: IGfxBuffer, format: 'uint16' | 'uint32'): void;
  setBindGroup(index: number, group: IGfxBindGroup): void;
  drawIndexed(indexCount: number, instanceCount?: number, firstIndex?: number): void;
  end(): void;
}
```

**关键决策：** `PipelineDesc` 携带双格式 shader：
```typescript
export interface PipelineDesc {
  label?: string;
  wgsl?: string;           // WebGPU 用
  vertGlsl?: string;       // WebGL 2 用
  fragGlsl?: string;
  vertexLayout: VertexAttribute[];
  blendMode?: 'alpha' | 'additive' | 'none';
  bindGroupLayouts: BindGroupLayoutDesc[];
}
```

---

### Step 2 — 实现 WebGPU 后端

**文件：** `src/backends/webgpu/WebGPUDevice.ts`

把现有 `GfxDevice.ts` 的逻辑迁移过来，实现 `IGfxDevice`。内部仍然持有 `GPUDevice`，但对外只暴露接口。

包装类：
- `WebGPUBuffer implements IGfxBuffer` — 内部 `gpuBuffer: GPUBuffer`
- `WebGPUTexture implements IGfxTexture` — 内部 `gpuTexture: GPUTexture`
- `WebGPUPipeline implements IGfxPipeline` — 内部 `pipeline: GPURenderPipeline`
- `WebGPUBindGroup implements IGfxBindGroup` — 内部 `bindGroup: GPUBindGroup`

---

### Step 3 — 实现 WebGL 2 后端

**文件：** `src/backends/webgl2/WebGL2Device.ts`

```typescript
export class WebGL2Device implements IGfxDevice {
  private gl: WebGL2RenderingContext;
  static async create(canvas: HTMLCanvasElement): Promise<WebGL2Device> { ... }
}
```

包装类：
- `WebGL2Buffer implements IGfxBuffer` — 内部 `glBuffer: WebGLBuffer`
- `WebGL2Texture implements IGfxTexture` — 内部 `glTexture: WebGLTexture`
- `WebGL2Pipeline implements IGfxPipeline` — 内部 `program: WebGLProgram`
- `WebGL2BindGroup implements IGfxBindGroup` — 内部存储 texture/sampler/uniform 绑定信息

**WebGL 2 特殊处理：**

| WebGPU 概念 | WebGL 2 对应 |
|---|---|
| BindGroup (group 0, uniform) | `gl.uniformMatrix4fv()` |
| BindGroup (group 1, texture) | `gl.activeTexture()` + `gl.bindTexture()` |
| `beginRenderPass` + clearColor | `gl.clear()` + `gl.clearColor()` |
| `drawIndexed` | `gl.drawElements()` |
| `writeBuffer` | `gl.bufferSubData()` |

---

### Step 4 — 添加 GLSL Shader

**文件：** `src/shaders/sprite_batch.vert.glsl` / `sprite_batch.frag.glsl`

```glsl
// sprite_batch.vert.glsl
#version 300 es
uniform mat4 u_viewProjection;
layout(location = 0) in vec2 a_position;
layout(location = 1) in vec2 a_uv;
layout(location = 2) in vec4 a_color;
out vec2 v_uv;
out vec4 v_color;
void main() {
  gl_Position = u_viewProjection * vec4(a_position, 0.0, 1.0);
  v_uv = a_uv;
  v_color = a_color;
}
```

```glsl
// sprite_batch.frag.glsl
#version 300 es
precision mediump float;
uniform sampler2D u_texture;
in vec2 v_uv;
in vec4 v_color;
out vec4 fragColor;
void main() {
  fragColor = texture(u_texture, v_uv) * v_color;
}
```

---

### Step 5 — 重构 SpriteBatch

`SpriteBatch.ts` 改为依赖 `IGfxDevice`，不再直接使用任何 WebGPU 类型。

`TextureAtlas` 改为持有 `IGfxBindGroup` 而不是 `GPUBindGroup`。

主要变化：
- `constructor(gfx: IGfxDevice)` — 类型改为接口
- `createSpritePipeline()` — 改为调用 `gfx.createPipeline({ wgsl, vertGlsl, fragGlsl, ... })`
- `end()` — 改为调用 `gfx.beginFrame().beginRenderPass(...)`

---

### Step 6 — 自动选择后端

**文件：** `src/gfx/createGfxDevice.ts`

```typescript
export async function createGfxDevice(canvas: HTMLCanvasElement): Promise<IGfxDevice> {
  if (navigator.gpu && isSecureContext) {
    try {
      return await WebGPUDevice.create(canvas);
    } catch {
      // 降级
    }
  }
  return await WebGL2Device.create(canvas);
}
```

---

### Step 7 — 更新 exports

`index.ts` 导出 `createGfxDevice` 和 `IGfxDevice`，移除直接导出 `GfxDevice`（或保留作为别名兼容旧代码）。

---

## 文件结构（完成后）

```
packages/engine/src/
├── gfx/
│   ├── IGfxDevice.ts          ← 接口定义（新增）
│   └── createGfxDevice.ts     ← 自动选择逻辑（新增）
├── backends/
│   ├── webgpu/
│   │   └── WebGPUDevice.ts    ← 从 GfxDevice.ts 迁移（重构）
│   └── webgl2/
│       └── WebGL2Device.ts    ← 新增
├── shaders/
│   ├── SpriteBatch.wgsl       ← 不变
│   ├── sprite_batch.vert.glsl ← 新增
│   └── sprite_batch.frag.glsl ← 新增
├── SpriteBatch.ts             ← 重构，依赖 IGfxDevice
├── GfxDevice.ts               ← 保留或删除（迁移后）
├── GfxResources.ts            ← 保留或删除（迁移后）
├── types.ts                   ← 扩展接口定义
└── index.ts                   ← 更新导出
```

---

## 实施顺序

1. `IGfxDevice.ts` — 定义所有接口（无副作用，可先写）
2. `WebGPUDevice.ts` — 迁移现有逻辑，确保现有功能不回归
3. `SpriteBatch.ts` — 重构为依赖接口（此时只有 WebGPU 后端，但已解耦）
4. GLSL shaders — 编写并验证逻辑与 WGSL 一致
5. `WebGL2Device.ts` — 实现 WebGL 2 后端
6. `createGfxDevice.ts` — 接入自动选择
7. 测试：在 Chrome DevTools 中禁用 WebGPU，验证 WebGL 2 路径

---

## 注意事项

- WebGL 2 没有 BindGroup 概念，`IGfxBindGroup` 在 WebGL 2 侧是一个数据容器，在 `drawIndexed` 前由 `IRenderPass.setBindGroup()` 解包并调用对应的 `gl.uniform*` / `gl.bindTexture`
- WebGL 2 的 uniform 需要在 pipeline 创建时查询 location，存入 `WebGL2Pipeline`
- `loadTexture` 在 WebGL 2 中使用 `gl.texImage2D()`，需要 `UNPACK_FLIP_Y_WEBGL = false`（与 WebGPU 保持一致，UV 原点在左上角）
- 顶点布局（pos+uv+color，stride=32）两端完全一致，无需改动 CPU 侧数据生成逻辑
