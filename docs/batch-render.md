1. 设计哲学
Mote 的 2D 渲染器从 The Cherno 的 Hazel Engine 批量渲染教程汲取灵感，但针对 WebGPU 的特性做了根本性重构。核心目标：
原则
说明
单 Draw Call 覆盖 95% 场景
将尽可能多的 Quad 合并到一次 drawIndexed()
CPU 侧零拷贝
用 device.queue.writeBuffer() 直传，避免 staging buffer 复杂度
Texture Atlas 优先
WebGPU 不支持 texture array（texture2D[]），用 Atlas + UV 偏移代替
TypeScript 友好
全类型安全，暴露给上层的 API 不超过 5 个方法
WebGL 2 可回退
数据布局兼容 WebGL 2 instanced rendering

---
2. Hazel 批量渲染器回顾与 WebGPU 适配
2.1 Hazel 的做法（OpenGL）
The Cherno 在 Hazel 中的 Batch Renderer 核心思路：
┌──────────────────────────────────────────┐
│  CPU 侧                                  │
│  ┌─────────────────────────────────────┐ │
│  │  Quad Vertex Buffer (动态)          │ │
│  │  每个 Quad = 4 vertices × stride    │ │
│  │  [pos, color, uv, texIndex]         │ │
│  └─────────────────────────────────────┘ │
│  ┌─────────────────────────────────────┐ │
│  │  Index Buffer (静态)                │ │
│  │  0,1,2, 2,3,0, 4,5,6, 6,7,4 ...   │ │
│  └─────────────────────────────────────┘ │
│  ┌─────────────────────────────────────┐ │
│  │  Texture Slots[0..31]               │ │
│  │  → glBindTexture 多槽绑定           │ │
│  └─────────────────────────────────────┘ │
└──────────────────────────────────────────┘
         ↓ 每帧 flush 一次
    glDrawElements(GL_TRIANGLES, indexCount)
关键特点：
- 每个 Quad 用 4 个顶点，每顶点含 texIndex（float），在 fragment shader 里用 texture(textures[int(texIndex)], uv) 采样
- OpenGL 允许 uniform sampler2D textures[32]，一次绑定最多 32 张纹理
- 当纹理超出 slot 上限 → flush → 开启新 batch
- Index buffer 是固定模式 0,1,2,2,3,0,4,5,6,...，启动时生成一次
2.2 WebGPU 的关键差异
维度
OpenGL (Hazel)
WebGPU (Mote)
Texture Array
sampler2D textures[N] ✅
❌ WGSL 不支持 array<texture_2d<f32>>
动态绑定
glActiveTexture 随时切换
Bind Group 创建后不可变
Buffer 上传
glBufferSubData / glMapBuffer
writeBuffer() 或 staging ring
Draw Call 开销
相对较高
很低，但 Bind Group 切换有代价
Shader 语言
GLSL uniform array
WGSL binding per slot
WebGPU 纹理绑定的核心限制：gpuweb/gpuweb#822 明确了 WebGPU 规范 不支持纹理数组绑定。每张纹理必须绑到一个独立的 binding slot。
2.3 Mote 的适配策略 — Texture Atlas
┌──────────────────────────────┐
│  Texture Atlas  2048×2048    │
│  ┌──────┬──────┬──────┐     │
│  │ 走路 │ 跑步 │ 跳跃 │     │
│  │ 0,0  │128,0 │256,0 │     │
│  ├──────┼──────┼──────┤     │
│  │ 地砖 │ 草地 │ 水面 │     │
│  │ 0,128│128,128│256,128    │
│  └──────┴──────┴──────┘     │
│  UV 偏移由 AtlasRegion 记录  │
└──────────────────────────────┘
所有 sprite 打包进一张（或少数几张）Atlas，每个 sprite 只记录 UV 偏移和大小。同一 Atlas 内的所有 Quad → 一次 Draw Call，零纹理切换。
当需要多张 Atlas（如 UI 层 + 游戏层）：按 Atlas 分组，每组一次 Draw Call。典型 2D 游戏 ≤ 3 张 Atlas = 3 次 Draw Call。

---
3. 数据架构
3.1 顶点布局（Per-Vertex）
每个 Quad = 4 个顶点，每个顶点的内存布局：
QuadVertex {
    position:  vec2<f32>   // 8  bytes — 世界空间 XY（CPU 预变换）
    uv:        vec2<f32>   // 8  bytes — Atlas 内 UV
    color:     vec4<f32>   // 16 bytes — RGBA tint / vertex color
}
// stride = 32 bytes per vertex
// 1 Quad  = 4 vertices = 128 bytes
// 10000 Quads = 1.22 MB（完全可接受）
为什么在 CPU 侧做变换而不用 instance + 矩阵？
- Hazel 方案的核心优势：CPU 预计算 4 个角的世界坐标，直接写入 vertex buffer
- 省掉 per-instance uniform / storage buffer 开销
- rotation 通过 2×2 旋转矩阵在 CPU 侧乘好，4 次乘法微不足道
- 这让 GPU 侧 shader 极度简单：只做 view-projection 变换
3.2 Index Buffer（静态）
固定模式，启动时一次性生成：
// 每 Quad 6 个索引，指向 4 个顶点
// Quad 0: [0,1,2, 2,3,0]
// Quad 1: [4,5,6, 6,7,4]
function generateIndices(maxQuads: number): Uint16Array {
    const indices = new Uint16Array(maxQuads * 6);
    for (let i = 0; i < maxQuads; i++) {
        const base = i * 4;
        const offset = i * 6;
        indices[offset + 0] = base + 0;
        indices[offset + 1] = base + 1;
        indices[offset + 2] = base + 2;
        indices[offset + 3] = base + 2;
        indices[offset + 4] = base + 3;
        indices[offset + 5] = base + 0;
    }
    return indices;
}
容量设计：MAX_QUADS = 10000，使用 Uint16Array 时上限为 65536/4 = 16384 个 Quad。超过此数用 Uint32Array。
3.3 Uniform Buffer — Camera
CameraUniforms {
    viewProjection:  mat4x4<f32>  // 64 bytes
}
绑定在 @group(0) @binding(0)，每帧通过 writeBuffer() 更新一次。
3.4 Texture + Sampler Bind Group
@group(1) @binding(0) — sampler
@group(1) @binding(1) — texture_2d<f32>  (当前 Atlas)
Bind Group 分离策略：Camera uniform 在 group 0（每帧更新一次），纹理在 group 1（按 Atlas 切换）。这样切换 Atlas 时只需 setBindGroup(1, ...)，不影响 camera。

---
4. 模块设计
4.1 整体架构
┌─────────────────────────────────────────────────┐
│                    Game Loop                     │
│            每帧 update → render                  │
└─────┬───────────────────────────────┬───────────┘
      ↓                               ↓
┌───────────┐                   ┌───────────────┐
│ Camera2D  │                   │  Sprite / Tile │
│ pos,zoom  │                   │  pos,size,rot  │
│ rot       │                   │  region(UV)    │
└─────┬─────┘                   └───────┬───────┘
      ↓                                 ↓
┌─────────────────────────────────────────────────┐
│              SpriteBatch                          │
│  ┌──────────────┐  ┌──────────────────────────┐ │
│  │ Quad Buffer   │  │ Flush Logic              │ │
│  │ (CPU Float32) │  │ sort by atlas → flush    │ │
│  │ writeBuffer() │  │ setBindGroup → drawIdx   │ │
│  └──────────────┘  └──────────────────────────┘ │
└─────────────────────────┬───────────────────────┘
                          ↓
┌─────────────────────────────────────────────────┐
│              GfxDevice (WebGPU 抽象层)            │
│  device / queue / pipeline / bind groups         │
│  createBuffer / writeBuffer / submit             │
└─────────────────────────────────────────────────┘
4.2 SpriteBatch — 核心类
class SpriteBatch {
    // ── 容量 ──
    private static readonly MAX_QUADS = 10_000;
    private static readonly FLOATS_PER_VERTEX = 8;
    private static readonly VERTICES_PER_QUAD = 4;
    private static readonly INDICES_PER_QUAD = 6;

    // ── CPU 侧缓冲 ──
    private cpuBuffer: Float32Array;
    private quadCount: number = 0;

    // ── GPU 资源 ──
    private vertexBuffer: GPUBuffer;
    private indexBuffer: GPUBuffer;
    private pipeline: GPURenderPipeline;
    private cameraBindGroup: GPUBindGroup;

    // ── 纹理批次管理 ──
    private currentAtlas: TextureAtlas | null = null;
    private batches: BatchEntry[] = [];

    // ── 公开 API ──
    begin(camera: Camera2D): void;
    drawQuad(x, y, w, h, rotation, region, color?): void;
    end(): void;
}
4.3 帧生命周期
frame() {
    // 1. 更新 camera uniform
    camera.updateViewProjection();
    writeBuffer(cameraUniformBuffer, camera.vpMatrix);

    // 2. 开始 batch
    batch.begin(camera);

    // 3. 提交所有 sprite（自动按 atlas 分组）
    for (const entity of visibleEntities) {
        batch.drawQuad(
            entity.x, entity.y,
            entity.width, entity.height,
            entity.rotation,
            entity.atlasRegion,
            entity.tint
        );
    }

    // 4. flush → GPU
    batch.end();
    // 内部: writeBuffer → beginRenderPass →
    //   for each batch: setBindGroup(1) → drawIndexed
    // → end → submit
}
4.4 排序与 Flush 策略
drawQuad() 调用序列:
  sprite_A (atlas_0)  → 追加（batch 0）
  sprite_B (atlas_0)  → 追加（batch 0 继续）
  sprite_C (atlas_1)  → atlas 变了！断批
  sprite_D (atlas_1)  → 追加（batch 1）
  sprite_E (atlas_0)  → atlas 又变了！断批

结果: 3 个 Draw Call
优化：上层在提交 sprite 前按 atlas 排序（或 z-layer + atlas 排序），减少 batch 断裂。SpriteBatch 本身不排序——它只在 atlas 切换时断批，把排序责任交给调用者。

---
5. WGSL Shader 设计
5.1 Vertex Shader
struct CameraUniforms {
    viewProjection: mat4x4<f32>,
};

struct VertexInput {
    @location(0) position: vec2<f32>,
    @location(1) uv:       vec2<f32>,
    @location(2) color:    vec4<f32>,
};

struct VertexOutput {
    @builtin(position) clipPos: vec4<f32>,
    @location(0)       vUV:     vec2<f32>,
    @location(1)       vColor:  vec4<f32>,
};

@group(0) @binding(0) var<uniform> camera: CameraUniforms;

@vertex
fn vs_main(in: VertexInput) -> VertexOutput {
    var out: VertexOutput;
    out.clipPos = camera.viewProjection * vec4<f32>(in.position, 0.0, 1.0);
    out.vUV     = in.uv;
    out.vColor  = in.color;
    return out;
}
5.2 Fragment Shader
@group(1) @binding(0) var texSampler: sampler;
@group(1) @binding(1) var texAtlas:   texture_2d<f32>;

@fragment
fn fs_main(in: VertexOutput) -> @location(0) vec4<f32> {
    let texColor = textureSample(texAtlas, texSampler, in.vUV);
    return texColor * in.vColor;
}
极度简洁——没有 if/switch 分支，没有 texture index 查找。所有复杂度被 Atlas + UV 偏移 + CPU 预变换消化掉了。

---
6. Texture Atlas 管理
6.1 AtlasRegion
interface AtlasRegion {
    atlas: TextureAtlas;
    u0: number; v0: number;  // 归一化 UV 左上
    u1: number; v1: number;  // 归一化 UV 右下
    pixelWidth: number;
    pixelHeight: number;
}
6.2 TextureAtlas
class TextureAtlas {
    readonly texture: GPUTexture;
    readonly bindGroup: GPUBindGroup;
    private regions: Map<string, AtlasRegion>;

    static async load(device: GPUDevice, url: string): Promise<TextureAtlas>;
    getRegion(name: string): AtlasRegion;
}
6.3 Atlas 打包策略
阶段
方案
Phase 1
手动用 TexturePacker / free-tex-packer 生成 atlas + JSON
Phase 2
Vite 插件扫描 assets/sprites/，构建时自动生成
Phase 3
Runtime 动态 Atlas（类似 PixiJS 按需打包）

---
7. CPU 侧 Quad 生成详解
Hazel 教程的核心——在 CPU 侧将 transform 烘焙进 4 个顶点坐标：
drawQuad(
    x: number, y: number,
    w: number, h: number,
    rotation: number,
    region: AtlasRegion,
    color: Color = WHITE
): void {
    if (this.quadCount >= MAX_QUADS) this.flush();
    if (region.atlas !== this.currentAtlas) this.breakBatch(region.atlas);

    // 4 个角（中心在原点）
    const hw = w * 0.5, hh = h * 0.5;
    //  3 ---- 2
    //  |      |
    //  0 ---- 1
    const corners = [[-hw,-hh],[hw,-hh],[hw,hh],[-hw,hh]];

    // 旋转 + 平移
    const cos = Math.cos(rotation), sin = Math.sin(rotation);
    const uvs = [
        [region.u0, region.v1],
        [region.u1, region.v1],
        [region.u1, region.v0],
        [region.u0, region.v0],
    ];

    const base = this.quadCount * 4 * 8;
    for (let i = 0; i < 4; i++) {
        const [lx, ly] = corners[i];
        const o = base + i * 8;
        this.cpuBuffer[o+0] = x + lx*cos - ly*sin;  // world x
        this.cpuBuffer[o+1] = y + lx*sin + ly*cos;  // world y
        this.cpuBuffer[o+2] = uvs[i][0];
        this.cpuBuffer[o+3] = uvs[i][1];
        this.cpuBuffer[o+4] = color.r;
        this.cpuBuffer[o+5] = color.g;
        this.cpuBuffer[o+6] = color.b;
        this.cpuBuffer[o+7] = color.a;
    }
    this.quadCount++;
}

---
8. Pipeline 创建
function createSpritePipeline(device: GPUDevice, format: GPUTextureFormat) {
    const shaderModule = device.createShaderModule({ code: SPRITE_WGSL });
    return device.createRenderPipeline({
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
                    alpha: { srcFactor: 'one', dstFactor: 'one-minus-src-alpha', operation: 'add' },
                },
            }],
        },
        primitive: { topology: 'triangle-list', cullMode: 'none' },
    });
}

---
9. Buffer 上传策略
基于 [WebGPU Buffer Uploads Best Practices] 的建议：
Buffer
类型
上传方式
频率
Index Buffer
静态
mappedAtCreation
仅一次
Vertex Buffer
每帧变化
writeBuffer()
每帧
Camera Uniform
每帧变化
writeBuffer()
每帧
Atlas Texture
静态
writeTexture()
加载时
为什么用 writeBuffer() 而不是 staging ring？ Toji 的文章明确指出："When in doubt, writeBuffer()!"——代码最简单，浏览器内部会选择最优上传路径。10000 Quads × 128 bytes = 1.22 MB/帧，对现代 GPU 完全不是问题。只有当 profiling 发现瓶颈时才考虑升级。

---
10. 完整 Render Pass
end(): void {
    if (this.quadCount === 0) return;

    const byteSize = this.quadCount * 4 * 32;
    this.device.queue.writeBuffer(this.vertexBuffer, 0, this.cpuBuffer.buffer, 0, byteSize);

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
        colorAttachments: [{
            view: this.context.getCurrentTexture().createView(),
            clearValue: { r: 0.04, g: 0.04, b: 0.08, a: 1.0 },
            loadOp: 'clear', storeOp: 'store',
        }],
    });

    pass.setPipeline(this.pipeline);
    pass.setVertexBuffer(0, this.vertexBuffer);
    pass.setIndexBuffer(this.indexBuffer, 'uint16');
    pass.setBindGroup(0, this.cameraBindGroup);

    for (const batch of this.batches) {
        pass.setBindGroup(1, batch.atlas.bindGroup);
        pass.drawIndexed(batch.quadCount * 6, 1, batch.startQuad * 6, 0, 0);
    }

    pass.end();
    this.device.queue.submit([encoder.finish()]);
    this.quadCount = 0;
    this.batches.length = 0;
    this.currentAtlas = null;
}

---
11. 与 Hazel 方案对比总结
维度
Hazel (OpenGL)
Mote (WebGPU)
多纹理
sampler2D[32] + texIndex
Texture Atlas + UV 偏移
Shader 复杂度
switch(texIndex) 分支
零分支，直接采样
Batch 拆分条件
texture slot 满
Atlas 切换
Draw Call 数
1（直到 slot 满）
通常 1-3（按 Atlas 数）
顶点布局
pos+uv+color+texIndex+tiling
pos+uv+color（更紧凑）
Buffer 上传
glBufferSubData
writeBuffer()
预变换
CPU 侧 ✅
CPU 侧 ✅（相同策略）

---
12. 性能预算
目标：60 FPS @ 10000 sprites

CPU 侧:
  - 10000 × drawQuad() ≈ 0.3ms
  - writeBuffer(1.22 MB) ≈ 0.1ms
  - 总 CPU ≈ 0.5ms

GPU 侧:
  - 1-3 draw calls
  - 60000 indices
  - 极简 VS (1 矩阵乘法) + 极简 FS (1 采样 + 1 乘法)
  - 总 GPU ≈ 0.2ms

总计 ≈ 0.7ms / 帧预算 16.6ms，余量充裕

---
13. 扩展路线
Phase 1 — 最小可用
- GfxDevice WebGPU 抽象
- SpriteBatch 实现（纯色 quad → 带纹理 Quad）
- Camera2D（正交投影 + 平移/缩放）
- 静态 Atlas 加载
- 里程碑：屏幕上 1000 个彩色方块 @ 60 FPS
Phase 2 — 角色动起来
- SpriteAnimation（帧序列 + 时间控制）
- InputManager（键盘/手柄）
- 里程碑：小人方向键走动
Phase 3 — 进阶渲染
- Z-sorting / depth buffer
- Tilemap renderer（基于 SpriteBatch）
- Particle system（复用 SpriteBatch 通道）
- Debug draw（纯色/线框 Quad）
Phase 4 — 性能优化
- Frustum culling（Camera 可见矩形剔除）
- Staging buffer ring
- Render Bundles（WebGPU 预录制渲染命令）
- WebGL 2 fallback renderer

---
14. API 速览
最终暴露给上层的 API 极其简洁：
const gfx = await GfxDevice.create(canvas);
const batch = new SpriteBatch(gfx);
const atlas = await TextureAtlas.load(gfx, 'assets/sprites.json');
const camera = new Camera2D(canvas.width, canvas.height);

function frame() {
    camera.update();
    batch.begin(camera);
    batch.drawQuad(100, 200, 64, 64, 0, atlas.getRegion('hero_idle_0'));
    batch.drawQuad(300, 150, 32, 32, Math.PI/4, atlas.getRegion('bullet'), {r:1,g:0.3,b:0.3,a:1});
    batch.end();
    requestAnimationFrame(frame);
}
5 个核心方法，0 个 GPU 概念暴露。