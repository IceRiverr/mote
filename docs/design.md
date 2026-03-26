1. 设计哲学
1.1 核心原则（First Principles）
#
原则
约束
P1
想法→现实延迟 < 3s
Vite HMR、热重载 Shader、即时预览
P2
表达语言 = 自然语言
AI 翻译想法为代码，人类只做架构决策和体验审核
P3
体验设备无关
浏览器 = 运行时，一切皆 URL
P4
工具必须 AI 可操作
HTML/DOM 编辑器，非 Native GUI；文件格式为 JSON/纯文本
P5
系统小而可控
一个人 + AI 能完全掌控全部代码
1.2 设计约束
- 图形 API：WebGPU 主 + WebGL 2 自动回退（WebGPU 目标 Chrome 113+；WebGL 2 覆盖所有移动端浏览器）
- 语言：TypeScript strict mode（AI 训练数据丰富 + 强类型 = 高质量 AI 生成）
- 构建：Vite + HMR（< 1s 反馈循环）
- 部署：git push → 自动构建 → https://iceriver.cc 即时可用
- 发布：Electron 封装发布 Steam（远期）
1.3 非目标（明确不做）
- 不做通用商业引擎
- 不做 WebGL 兼容层 → 已修正：做 WebGL 2 回退后端（见 3.3 节）
- 不做可视化节点 Shader 编辑器（WGSL 直接写，AI 辅助）
- 不做多人实时协作编辑
- 不追求 AAA 级 3D 渲染

---
2. 整体架构
暂时无法在飞书文档外展示此内容

---
3. Layer 1: WebGPU Abstraction（底层图形抽象）
3.1 设计目标
对 WebGPU 原生 API 做薄封装，目标不是隐藏 WebGPU，而是：
- 消除重复的样板代码（Device 初始化、Buffer 创建、Pipeline 配置）
- 提供资源生命周期管理（自动释放、引用计数）
- 统一错误处理和 Debug 标签
3.2 核心类
GfxDevice — 对应 DX11 的 ID3D11Device + DeviceContext
GfxDevice
├── adapter: GPUAdapter
├── device: GPUDevice
├── context: GPUCanvasContext
├── format: GPUTextureFormat
│
├── init(canvas: HTMLCanvasElement): Promise<void>
├── createBuffer(desc: BufferDesc): GfxBuffer
├── createTexture(desc: TextureDesc): GfxTexture
├── createPipeline(desc: PipelineDesc): GfxPipeline
├── createBindGroup(desc: BindGroupDesc): GPUBindGroup
├── beginFrame(): FrameContext
├── submit(): void
└── destroy(): void
DX11 映射：
DX11
WebGPU
floe-engine
D3D11CreateDevice
requestAdapter + requestDevice
GfxDevice.init()
ID3D11Buffer
GPUBuffer
GfxBuffer
ID3D11Texture2D
GPUTexture
GfxTexture
ID3D11DeviceContext
GPUCommandEncoder
FrameContext
PSSetShader / VSSetShader
setPipeline
FrameContext.usePipeline()
ExecuteCommandList
queue.submit
GfxDevice.submit()
BufferPool — GPU Buffer 管理
BufferPool
├── getVertexBuffer(size: number): GfxBuffer
├── getIndexBuffer(size: number): GfxBuffer
├── getUniformBuffer(size: number): GfxBuffer
├── release(buffer: GfxBuffer): void
└── gc(): void    // 清理长期未使用的 Buffer
设计决策：环形 Buffer 池，避免每帧 create/destroy 的开销。
TextureManager — 纹理加载与缓存
TextureManager
├── load(url: string): Promise<GfxTexture>
├── loadAtlas(url: string): Promise<TextureAtlas>
├── createRenderTarget(w, h, format): GfxTexture
├── get(id: string): GfxTexture | null
└── destroy(id: string): void
支持格式：PNG、WebP、KTX2（GPU 压缩纹理，远期）
PipelineCache — Pipeline 状态缓存
PipelineCache
├── get(desc: PipelineDesc): GfxPipeline
├── preload(descs: PipelineDesc[]): void
└── stats(): { total: number, hits: number }
Pipeline 以 descriptor hash 作为 key，和 DX11 的 PSO 缓存思路一致。
ShaderLib — WGSL Shader 管理
ShaderLib
├── register(name: string, code: string): void
├── get(name: string): GPUShaderModule
├── createVariant(name: string, defines: Record<string, string>): GPUShaderModule
└── hotReload(name: string, newCode: string): void   // HMR 热替换 Shader
设计决策：Shader 以 .wgsl 文件存储，Vite 通过 ?raw 导入，支持 HMR 热替换。

---
3.3 双后端架构（WebGPU + WebGL 2）
背景：为什么需要 WebGL 2 回退
移动端 WebGPU 覆盖率不足（截至 2026 年 3 月）：
平台
浏览器
WebGPU 状态
Android
Chrome
✅ ARM/Qualcomm/Intel, Android 12+: Chrome 121 起
Android
Chrome
👷 部分芯片（MediaTek 等）: TBD
Android
Firefox
👷 Behind a flag，预计 2026 年适配
iOS/iPadOS
Safari
✅ Safari 26 起（iOS 26，预计 2026 秋季正式发布）
iOS/iPadOS
所有浏览器
❌ iOS 26 之前完全不可用
结论：桌面端 WebGPU 覆盖充分，但移动端仍有大量设备不支持。需要 WebGL 2 回退保证「Everything is a URL」在任何设备上都能打开。
接口抽象层
Layer 1 增加统一接口，Layer 2 渲染器完全不感知底层用的是 WebGPU 还是 WebGL：
Layer 2: Renderers（不变）
  SpriteBatch / Camera2D / TilemapRenderer / ...
  ↓ 调用 Layer 1 接口
Layer 1: Graphics Abstraction
  IGfxDevice / IGfxBuffer / IGfxTexture / IGfxPipeline
  ├── WebGPUBackend   ← 主要实现
  └── WebGL2Backend   ← 回退实现

核心接口定义：
IGfxDevice
├── init(canvas): Promise<void>
├── createBuffer(desc): IGfxBuffer
├── createTexture(desc): IGfxTexture
├── createPipeline(desc): IGfxPipeline
├── beginFrame(): IFrameContext
└── submit(): void

IFrameContext
├── beginRenderPass(desc): IRenderPass

IRenderPass
├── setPipeline(pipeline): void
├── setVertexBuffer(slot, buffer): void
├── setBindGroup(index, bindData): void
├── draw(vertexCount, instanceCount?): void
└── end(): void

自动选择逻辑：
function createGfxDevice(): IGfxDevice {
  if (navigator.gpu && isSecureContext)
    → return WebGPUDevice    // 桌面 + 支持的移动端
  else
    → return WebGL2Device     // 所有其他设备
}

Shader 双格式策略
WebGPU 使用 WGSL，WebGL 2 使用 GLSL ES 3.0。同一渲染逻辑维护两套 Shader：
shaders/
├── sprite_batch.wgsl          ← WebGPU
├── sprite_batch.vert.glsl     ← WebGL 2 vertex
└── sprite_batch.frag.glsl     ← WebGL 2 fragment

工作流：日常开发只写 WebGPU + WGSL。写完后让 Claude Code 生成对应的 WebGL 2 实现 + GLSL Shader。WGSL → GLSL 逻辑完全一致，只是语法不同。
为什么选 WebGL 2 而不是 Canvas 2D
维度
Canvas 2D
WebGL 2
移动端覆盖率
100%
~97%（足够）
自定义 Shader
❌ 无
✅ GLSL
GPU 加速
❌
✅
与 WebGPU 概念距离
非常远
比较近（同为 GPU 管线）
特效能力
无
有（闪白、粒子等）
性能
1000 sprites 吃力
10000+ sprites 无压力
实现成本
低（~300 行）
中（~800-1500 行）
4. Layer 2: Renderers（渲染器层）
4.1 2D 渲染器
SpriteBatch — 核心 2D 渲染（GPU Instancing）
这是 2D 引擎的心脏。对应 DX11 的 DrawInstanced。
SpriteBatch
├── maxSprites: number (default: 10000)
│
│   InstanceData（per-instance vertex buffer）:
│     position: vec2<f32>      // 世界坐标
│     scale: vec2<f32>         // 缩放
│     rotation: f32            // 弧度
│     uvRect: vec4<f32>        // 纹理图集中的 UV 区域
│     color: vec4<f32>         // 颜色叠加/透明度
│     zIndex: f32              // 排序层级
│
├── begin(camera: Camera2D): void
├── draw(sprite: SpriteData): void
├── end(): void    // 排序 + 上传 GPU + DrawInstanced
│
│   内部流程：
│   1. begin(): 重置实例计数
│   2. draw(): 写入 CPU 端 Float32Array
│   3. end():
│      a. 按 texture + zIndex 排序
│      b. writeBuffer 上传到 GPU
│      c. 按 texture 分批 drawInstanced
WGSL Shader 设计草稿：
// sprite_batch.wgsl 核心逻辑

@vertex fn vs_main:
  单位四边形 4 顶点 (Triangle Strip)
  → 旋转 (cos/sin)
  → 缩放 (instance.scale)
  → 平移 (instance.position)
  → 投影 (camera.viewProjection)
  → UV 映射到图集区域 (uvRect)

@fragment fn fs_main:
  采样纹理 → 乘以 instance.color → 输出
Camera2D
Camera2D
├── position: Vec2
├── zoom: number (default: 1.0)
├── rotation: number
├── viewport: { width, height }
│
├── getViewProjectionMatrix(): Mat4
├── screenToWorld(screenPos: Vec2): Vec2
├── worldToScreen(worldPos: Vec2): Vec2
├── follow(target: Vec2, lerp?: number): void
└── shake(intensity: number, duration: number): void
正交投影矩阵，和 DX11 里 XMMatrixOrthographicLH 一样的套路。
TilemapRenderer
TilemapRenderer
├── loadMap(data: TilemapData): void     // Tiled JSON 格式
├── setTileset(texture: GfxTexture, tileSize: number): void
├── render(camera: Camera2D): void
│
│   优化策略：
│   - 只渲染 camera 视口内的 tile（视锥剔除）
│   - 整个 tilemap 用一次 draw call（GPU instancing）
│   - 支持多层（ground, decoration, collision）
VectorRenderer（SVG → GPU）
VectorRenderer
├── drawLine(from, to, color, width): void
├── drawRect(rect, color, fill?): void
├── drawCircle(center, radius, color, fill?): void
├── drawPath(points: Vec2[], color, width): void
├── drawSVG(svgData: string): void
└── flush(): void
用于 Debug 绘制、UI 元素、矢量动画。底层用**三角化（Triangulation）**将矢量图形转为三角网格。
ParticleRenderer
ParticleRenderer
├── create(config: ParticleConfig): ParticleEmitter
│
│   ParticleConfig:
│     maxParticles, emitRate, lifetime, speed,
│     angle, startColor/endColor, startSize/endSize,
│     gravity: Vec2, texture
│
├── update(dt: number): void   // 远期用 Compute Shader
├── render(camera: Camera2D): void
└── destroy(): void
TextRenderer
TextRenderer
├── loadFont(url: string): Promise<void>
├── drawText(text, position, style): void
└── measure(text, style): { width, height }
初期方案：Canvas 2D 预渲染到纹理 → SpriteBatch 绘制
进阶方案：MSDF 字体，无限缩放不模糊
4.2 3D 渲染器（远期扩展）
初期不实现，但架构预留接口：
MeshRenderer    → 加载 glTF, 基础 PBR
Camera3D        → 透视投影, 自由/轨道相机
BasicLighting   → 方向光 + 点光, 无阴影
SkyboxRenderer  → Cubemap 天空盒
关键设计：2D 和 3D 渲染器共享 Layer 1，独立实现渲染逻辑。可以在同一场景中混用。

---
5. Layer 3: Framework（框架层）
5.1 GameLoop — 游戏主循环
GameLoop (Semi-fixed timestep):

  loop():
    now = performance.now()
    dt = now - lastTime
    accumulator += dt

    while accumulator >= fixedTimestep:
      update(fixedTimestep)         // 物理/逻辑：固定步长
      accumulator -= fixedTimestep

    alpha = accumulator / fixedTimestep
    render(alpha)                   // 渲染：插值平滑
和 UE 的 Tick 机制类似，但更简单。fixedTimestep 保证物理一致性。
5.2 InputManager — 统一输入
InputManager
├── keyboard
│   ├── isDown(key) / isPressed(key) / isReleased(key)
│   └── getAxis(negative, positive): number
├── mouse
│   ├── position / worldPosition
│   ├── isDown(button) / isPressed / isReleased
│   └── wheel: number
├── touch（移动端）
│   ├── touches: TouchInfo[]
│   └── primaryTouch: TouchInfo | null
├── gamepad（远期）
├── update(): void       // 每帧开头
└── endFrame(): void     // 每帧结尾，重置 pressed/released
5.3 AssetManager — 资源加载
AssetManager
├── load<T>(url, type: AssetType): Promise<T>
├── loadMany(manifest): Promise<void>    // 批量加载 + 进度
├── get<T>(url): T | null                // 从缓存获取
├── unload(url): void
│
│   AssetType:
│   'texture' | 'json' | 'tilemap' | 'shader' | 'audio' | 'sprite-sheet' | 'svg'
│
├── onProgress: (loaded, total) => void
└── onError: (url, error) => void
资源清单格式（assets.json）：
{
  "textures": { "player": "sprites/player.png", "tileset": "tiles/overworld.png" },
  "tilemaps": { "level1": "maps/level1.json" },
  "shaders": { "sprite": "shaders/sprite_batch.wgsl" }
}
5.4 SceneManager — 场景管理
SceneManager
├── push(scene): void     // 压栈（暂停当前场景）
├── pop(): void           // 弹栈（恢复上一个场景）
├── switch(scene): void   // 切换（销毁当前）

Scene 接口:
├── onEnter(): Promise<void>
├── onExit(): void
├── onPause() / onResume()
├── update(dt): void
└── render(alpha): void
5.5 ECS（轻量级 Entity Component System）
type Entity = number;    // 纯 ID

// Component：纯数据
Transform { x, y, rotation, scaleX, scaleY }
Sprite { textureId, uvRect, color }
Velocity { vx, vy }
Collider { type: 'aabb' | 'circle', width?, height?, radius? }

// World
World
├── createEntity() / destroyEntity()
├── addComponent<T>() / getComponent<T>() / removeComponent()
├── query(...types): Entity[]
└── forEach(types, callback): void

// System：纯函数
function movementSystem(world, dt) { ... }
function spriteRenderSystem(world, batch, camera) { ... }
5.6 AudioManager
AudioManager
├── load(id, url): Promise<void>
├── play(id, options?): SoundInstance
├── stop(id): void
├── setMasterVolume(v) / setChannelVolume(channel, v)
│   Channels: 'music' | 'sfx' | 'ui'
└── 底层使用 Web Audio API

---
6. Layer 4: Editors（HTML 单页编辑器）
6.1 编辑器哲学
- 所有编辑器 = 单个 HTML 文件 + 引擎运行时
- 人类可操作（可视化 UI）+ AI 可操作（DOM 结构清晰）
- URL 可访问（部署到 iceriver.cc/editors/xxx）
- 数据格式 = JSON（AI 可读写）
6.2 编辑器列表
Scene Editor（场景编辑器）
URL: https://iceriver.cc/editors/scene/

布局：左侧实体树 | 中间 Canvas 预览 | 右侧属性面板 | 底部资源面板
操作：拖拽放置 Sprite、选中变换 Gizmo、图层管理、Camera 预览
输出：scene.json（实体 + 组件数据）
Sprite Animation Editor
URL: https://iceriver.cc/editors/animation/

功能：导入 Sprite Sheet → 自动/手动切分帧 → 时间轴编辑 → 实时预览
输出：animation.json（帧 UV + 持续时间）
Tilemap Editor
URL: https://iceriver.cc/editors/tilemap/

功能：导入 Tileset → 画刷绘制 → 多图层 → 实时预览
输出：兼容 Tiled JSON 格式
Asset Browser
URL: https://iceriver.cc/editors/assets/

功能：浏览资源目录 → 缩略图预览 → 上传新资源 → 拖拽到其他编辑器
6.3 编辑器 ←→ 引擎通信
方式
描述
适用场景
同页面直接调用
编辑器 UI（DOM）+ 渲染（Canvas）在同一 HTML
主要方式
跨页面消息
BroadcastChannel / postMessage
远期 Editor + Game View 分离
文件系统
编辑器输出 JSON → 游戏加载 JSON
最简单，AI 可直接生成/修改

---
7. 项目目录结构
floe-engine/
├── src/
│   ├── core/                    # Layer 1: WebGPU Abstraction
│   │   ├── GfxDevice.ts
│   │   ├── GfxBuffer.ts / GfxTexture.ts / GfxPipeline.ts
│   │   ├── BufferPool.ts / TextureManager.ts
│   │   ├── PipelineCache.ts / BindGroupManager.ts
│   │   ├── ShaderLib.ts
│   │   └── index.ts
│   │
│   ├── renderer/                # Layer 2: Renderers
│   │   ├── 2d/
│   │   │   ├── SpriteBatch.ts / SpriteAnimator.ts
│   │   │   ├── TilemapRenderer.ts / VectorRenderer.ts
│   │   │   ├── TextRenderer.ts / ParticleRenderer.ts
│   │   │   ├── Camera2D.ts
│   │   │   └── index.ts
│   │   ├── 3d/（远期）
│   │   └── shaders/
│   │       ├── sprite_batch.wgsl / tilemap.wgsl
│   │       ├── vector.wgsl / particle.wgsl
│   │       └── text_msdf.wgsl
│   │
│   ├── framework/               # Layer 3: Framework
│   │   ├── GameLoop.ts / InputManager.ts
│   │   ├── AssetManager.ts / SceneManager.ts / AudioManager.ts
│   │   ├── ecs/
│   │   │   ├── World.ts / types.ts
│   │   │   └── systems/（movement, spriteRender, collision, animation）
│   │   └── index.ts
│   │
│   ├── math/（Vec2, Vec3, Mat4, Color, Rect）
│   ├── utils/（debug, logger, events）
│   └── index.ts                 # 引擎总入口
│
├── editors/                     # Layer 4: HTML 编辑器
│   ├── scene/ / animation/ / tilemap/ / assets/
│
├── games/                       # Layer 5: 游戏项目
│   └── demo/（main.ts, scenes/, assets/）
│
├── vite.config.ts / tsconfig.json / package.json
└── README.md

---
8. 数据流架构
8.1 运行时渲染管线
暂时无法在飞书文档外展示此内容
8.2 资源加载管线
AssetManager.loadMany(manifest)
  ├── textures → TextureManager.load() → GfxTexture
  ├── tilemaps → fetch JSON → TilemapData
  ├── animations → fetch JSON → AnimationData
  ├── shaders → fetch .wgsl → ShaderLib.register()
  └── audio → AudioManager.load() → AudioBuffer

  全部完成后 → Scene.onEnter() → 游戏开始

---
9. AI 协作接口设计
9.1 核心原则
- 人类：架构决策、体验审核、创意方向
- AI：代码实现、Shader 编写、数学计算、资源生成、Bug 修复
9.2 对 AI 友好的设计决策
设计
为什么对 AI 友好
TypeScript strict
类型信息 = AI 的上下文锚点，减少幻觉
每个类一个文件
AI 一次只改一个文件，不会改乱
纯 JSON 数据格式
AI 可以直接生成/修改游戏关卡数据
WGSL 独立文件
Shader 修改不影响 TS 代码
ECS 纯函数 System
AI 写一个 System = 写一个纯函数，无副作用
HTML 编辑器
DOM 结构 = AI 可以 "看到" 并操作的界面
清晰的目录结构
AI 根据文件名就知道改哪里
9.3 典型 AI 协作场景
场景
你说
AI 做
新增 System
"加一个弹幕系统，子弹从 boss 位置向玩家方向发射"
在 systems/ 新建 bulletSystem.ts
写 Shader 特效
"给角色加一个受伤闪白效果"
新建 flash_white.wgsl + 修改 SpriteBatch
生成关卡数据
"生成一个 50x30 的洞穴地图，细胞自动机算法"
输出 Tiled JSON 格式地图数据
编辑器功能
"场景编辑器加一个网格吸附功能"
修改 editors/scene/index.html

---
10. 开发路线图
Phase 1: Foundation（1-2 周）
目标：屏幕上画出能动的东西
- GfxDevice + 基础初始化
- SpriteBatch（核心渲染）
- Camera2D（平移/缩放）
- GameLoop（固定时间步长）
- InputManager（键盘/鼠标）
- Math 库（Vec2, Mat4, Color）
- 里程碑：一个小人在场景里用方向键走动
Phase 2: Content Pipeline（1-2 周）
目标：能做出有内容的场景
- AssetManager（批量加载 + 缓存）
- TextureAtlas / SpriteSheet 支持
- SpriteAnimator（帧动画）
- TilemapRenderer（Tiled 地图渲染）
- SceneManager（场景切换）
- 基础碰撞检测（AABB）
- 里程碑：角色在 Tilemap 场景中走动，有动画，有碰撞
Phase 3: Editors（2-3 周）
目标：可视化制作内容
- Sprite Animation Editor
- Tilemap Editor
- Scene Editor（基础版）
- Asset Browser
- 里程碑：用编辑器制作一个完整关卡，无需手写 JSON
Phase 4: Polish（1-2 周）
目标：能做像样的小游戏
- AudioManager（音效 + 音乐）
- ParticleRenderer（粒子效果）
- TextRenderer（MSDF 文字）
- VectorRenderer（Debug 绘制）
- 基础 UI 系统
- 里程碑：一个完整的可玩 Demo
Phase 5: 3D Extension（远期）
- MeshRenderer（glTF 加载）+ Camera3D + BasicLighting
- 2D/3D 混合渲染
- 里程碑：3D 场景 + 2D 像素角色（Octopath Traveler 风格）

---
11. 技术决策记录（ADR）
ADR
决策
原因
ADR-001
不做 WebGL Fallback
维护两套渲染后端成本过高；Chrome 113+ 覆盖率足够
ADR-002
轻量自写 ECS
bitECS 等库为大规模场景优化，小游戏（<1000 实体）用不到
ADR-003
JSON 作为统一数据格式
人类可读，AI 可读写，Git diff 友好
ADR-004
编辑器用原生 HTML，不用 React/Vue
减少依赖，AI 生成纯 HTML 更可靠
ADR-005
Shader 用独立 .wgsl 文件
IDE 语法高亮 + Vite HMR 热替换 + AI 独立修改

---
12. 单文件发布方案（Single HTML Distribution）
12.1 核心思路
将所有资源（JS Bundle、WGSL Shader、图片、音频、JSON 数据）内联到一个 HTML 文件中。构建后生成一个自包含的 index.html，发送给任何人即可运行。
12.2 资源内联技术
资源类型
内联方式
说明
TypeScript/JS
Vite 打包后内联 <script>
默认行为
WGSL Shader
?raw import → 字符串常量
零额外成本，已是字符串
PNG/WebP 图片
Base64 编码 Data URL
data:image/png;base64,...
JSON 数据
import → 对象字面量
Vite 默认内联
音频
Base64 编码 Data URL
data:audio/mp3;base64,...
CSS
内联 <style>
Vite 默认行为
字体
Base64 内联到 @font-face
data:font/woff2;base64,...
12.3 构建配置
使用 vite-plugin-singlefile 插件，构建时将所有产物合并到一个 HTML 中：
// vite.config.single.ts
import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    target: 'esnext',
    assetsInlineLimit: 100000000,   // 所有资源都内联
    cssCodeSplit: false,
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});

12.4 文件大小参考
资源
原始大小
Base64 后（膨胀 ~33%）
Sprite Sheet（像素风）
50-200 KB
67-267 KB
Tileset
30-100 KB
40-133 KB
音效 × 10
200 KB
267 KB
BGM（1 首循环）
500 KB-2 MB
667 KB-2.7 MB
JS Bundle
50-150 KB
不变（文本）
WGSL Shaders
5-20 KB
不变（已是字符串）
典型像素风小游戏总计
~1-3 MB
~1.5-4 MB
优化手段：图片用 WebP（比 PNG 小 30-50%）、音频用低码率 MP3/OGG、SpriteSheet 紧凑排列、Gzip 压缩。
12.5 Secure Context 限制与解决
WebGPU 要求 HTTPS 或 localhost（Secure Context）。双击 HTML 打开的 file:// 协议默认不满足。解决方案：
方案
说明
在线分发（推荐）
通过 here.now 或 iceriver.cc 分发 URL，HTTPS 天然满足，WebGPU 全特性可用
Chrome Flag
chrome://flags/#unsafely-treat-insecure-origin-as-secure 添加 file://
附带启动脚本
.bat/.sh 脚本启动本地 HTTP server 后打开浏览器
Electron 封装
桌面应用，自动满足 Secure Context
结论：在线分发（here.now URL）是最佳选择，接收方零配置、全平台、WebGPU 全功能可用。双击 HTML 文件作为备用方案，需配合启动脚本或 Chrome Flag。

---
13. 双轨部署策略
13.1 两条部署轨道
引擎采用 阿里云服务器（iceriver.cc） + here.now 双轨部署，各司其职。
阿里云服务器（iceriver.cc）— 大本营
定位：长期运行的主站、开发基础设施、需要后端能力的服务。
- 引擎 Demo 主页（iceriver.cc）
- 编辑器工具集（iceriver.cc/editors/）
- 正式版游戏（iceriver.cc/games/xxx）
- CI/CD 自动部署（git push → 自动构建 → 上线）
- 远期后端服务（排行榜、存档同步、多人联机）
here.now — 即时分享
定位：快速分享、版本快照、零成本试错。
- 给朋友试玩的原型（发一个 URL 即可）
- Game Jam 作品提交
- 社区分享 / 求反馈
- 同一游戏的多个实验版本并行（v1.here.now / v2.here.now）
- 免费 500 站点、10 GB 存储，个人使用完全够用
13.2 对比
维度
阿里云（iceriver.cc）
here.now
本质
你拥有的完整 Linux 服务器
静态文件 CDN 托管
能力
无限（后端、数据库、WebSocket）
纯静态文件
维护
需管理 Nginx、SSL、系统更新
零维护
发布速度
git push → ~30s
API 上传 → ~5s
费用
每月服务器费（持续）
免费
适合
长期项目、需后端、个人品牌
临时分享、快速原型、多版本并行
13.3 场景决策表
场景
使用
原因
日常开发预览
localhost:5173
最快
手机上自己看效果
iceriver.cc
自有服务器，随时可用
引擎 Demo 展示页
iceriver.cc
长期入口，个人品牌
编辑器工具
iceriver.cc
长期在线 + 可能加后端
给朋友发个游戏试玩
here.now
5 秒发布，发一个链接
Game Jam 提交
here.now
独立 URL，不污染主站
A/B 测试两个版本
here.now
两个链接并行对比
正式发布游戏
iceriver.cc
专业、稳定、可追踪
Steam 发布
Electron 封装
桌面应用
13.4 命令集成
{
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "deploy": "git push deploy main",
    "share": "vite build && node scripts/publish-herenow.js",
    "share:quick": "vite build && node scripts/publish-herenow.js --anonymous"
  }
}

命令
效果
目标
耗时
npm run dev
本地开发
localhost:5173
即时
npm run deploy
部署到主站
iceriver.cc
~30s
npm run share
发布到 here.now（永久）
xxx.here.now
~10s
npm run share:quick
匿名发布（24h 有效）
xxx.here.now
~5s
13.5 可选：自定义域名绑定
here.now 支持自定义域名。可将 play.iceriver.cc 的 CNAME 指向 fallback.here.now，分享链接变为 https://play.iceriver.cc。

---
14. 技术决策记录（ADR）续
ADR
决策
原因
ADR-006
不做 Canvas 2D 渲染回退
所有在线分发路径（iceriver.cc / here.now）均为 HTTPS，WebGPU 直接可用；维护两套渲染后端违反 P5 原则（小而可控）
ADR-007
双轨部署：阿里云 + here.now
iceriver.cc 承担长期主站和后端服务；here.now 承担即时分享和原型分发；各司其职，互不替代
ADR-008
单文件发布使用 vite-plugin-singlefile
构建时自动内联所有资源，运行时代码零修改，只是构建配置的区别
ADR-001 修正记录：
原决策「不做 WebGL Fallback」已修正为「做 WebGL 2 回退」。
修正原因：移动端 WebGPU 覆盖不足——iOS 26 之前完全不可用、部分 Android 芯片不支持。WebGL 2 与 WebGPU 概念接近（同为 GPU 管线），接口抽象可复用。GLSL Shader 由 AI 从 WGSL 自动生成，维护成本可控。
ADR-006 修正记录：
原决策「不做 Canvas 2D 渲染回退」修正为「做 WebGL 2 回退（不做 Canvas 2D）」。WebGL 2 保留 Shader 能力和 GPU 加速，覆盖率 ~97%，远优于 Canvas 2D 的功能阉割方案。