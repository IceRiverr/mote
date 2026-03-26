# mote engine 开发计划

基于 [design.md](design.md) 生成，作为逐步实现的开发依据。

当前状态：项目仅有一个 `src/main.ts`，包含硬编码的 WebGPU 三角形渲染。所有引擎架构尚未搭建。

---

## Phase 1: Foundation（基础层）

目标：搭建 Layer 1 + Layer 2 核心 + Layer 3 最小框架，实现「一个小人用方向键在场景里走动」。

### 1.1 项目基础设施

- [ ] 创建目录结构：`src/core/`、`src/renderer/2d/`、`src/renderer/shaders/`、`src/framework/`、`src/math/`
- [ ] 创建 `src/math/` 基础数学库
  - `Vec2.ts` — 二维向量（add, sub, scale, normalize, dot, length, lerp）
  - `Mat4.ts` — 4x4 矩阵（identity, ortho, translate, rotate, scale, multiply）
  - `Color.ts` — RGBA 颜色（fromHex, lerp, premultiply）
  - `Rect.ts` — 矩形（contains, intersects）
  - `index.ts` — 统一导出

### 1.2 Layer 1: 图形抽象接口

先实现 WebGPU 后端，接口层为后续 WebGL 2 回退预留。

- [ ] 定义抽象接口 `src/core/types.ts`
  - `IGfxDevice`、`IGfxBuffer`、`IGfxTexture`、`IGfxPipeline`
  - `IFrameContext`、`IRenderPass`
  - `BufferDesc`、`TextureDesc`、`PipelineDesc` 等描述符类型
- [ ] 实现 `src/core/WebGPUDevice.ts`（IGfxDevice 的 WebGPU 实现）
  - `init(canvas)` — adapter/device/context 初始化
  - `createBuffer / createTexture / createPipeline / createBindGroup`
  - `beginFrame() → FrameContext`、`submit()`、`destroy()`
- [ ] 实现 `src/core/GfxBuffer.ts`、`GfxTexture.ts`、`GfxPipeline.ts`
  - WebGPU 资源的薄封装，带 label 和 destroy
- [ ] 实现 `src/core/ShaderLib.ts`
  - `register(name, code)`、`get(name)`、`createVariant(name, defines)`
  - `hotReload(name, newCode)` — 配合 Vite HMR
- [ ] 实现 `src/core/PipelineCache.ts`
  - descriptor hash → pipeline 缓存
- [ ] 实现 `src/core/createGfxDevice.ts`
  - 自动选择逻辑：WebGPU 可用 → WebGPUDevice，否则 → WebGL2Device（Phase 1 先只返回 WebGPU）
- [ ] `src/core/index.ts` 统一导出

### 1.3 Layer 2: SpriteBatch + Camera2D

- [ ] 编写 `src/renderer/shaders/sprite_batch.wgsl`
  - 顶点着色器：单位四边形 × instance 数据（position, scale, rotation, uvRect, color, zIndex）→ camera VP 变换
  - 片段着色器：纹理采样 × color
- [ ] 实现 `src/renderer/2d/SpriteBatch.ts`
  - `begin(camera)` → 重置实例计数
  - `draw(sprite: SpriteData)` → 写入 CPU 端 Float32Array
  - `end()` → 按 texture + zIndex 排序 → writeBuffer → 按 texture 分批 drawInstanced
  - 默认 maxSprites: 10000
- [ ] 实现 `src/renderer/2d/Camera2D.ts`
  - position、zoom、rotation、viewport
  - `getViewProjectionMatrix()` — 正交投影
  - `screenToWorld / worldToScreen`
  - `follow(target, lerp)` — 平滑跟随
  - `shake(intensity, duration)` — 屏幕震动

### 1.4 Layer 3: 最小框架

- [ ] 实现 `src/framework/GameLoop.ts`
  - Semi-fixed timestep：固定步长 update + 插值 render
  - `start() / stop()`
  - 回调：`onUpdate(dt)` + `onRender(alpha)`
- [ ] 实现 `src/framework/InputManager.ts`
  - keyboard: `isDown(key) / isPressed(key) / isReleased(key) / getAxis(neg, pos)`
  - mouse: `position / worldPosition / isDown / wheel`
  - `update()` 每帧开头调用，`endFrame()` 每帧结尾重置 pressed/released

### 1.5 整合 + 里程碑验证

- [ ] 重写 `src/main.ts`，使用引擎 API 替代硬编码 WebGPU 调用
- [ ] 实现里程碑 Demo：加载一个 sprite 纹理，用方向键控制移动，Camera2D 跟随
- [ ] 验证 Vite HMR 对 .wgsl 文件的热替换工作正常

---

## Phase 2: Content Pipeline（内容管线）

目标：支持资源加载、帧动画、Tilemap、场景管理、碰撞检测。实现「角色在 Tilemap 场景中走动，有动画，有碰撞」。

### 2.1 资源系统

- [ ] 实现 `src/core/TextureManager.ts`
  - `load(url) → GfxTexture`、`get(id)`、`destroy(id)`
  - 支持 PNG、WebP
  - `createRenderTarget(w, h, format)`
- [ ] 实现 `src/core/BufferPool.ts`
  - 环形 Buffer 池，`getVertexBuffer / getIndexBuffer / getUniformBuffer / release / gc`
- [ ] 实现 `src/framework/AssetManager.ts`
  - `load<T>(url, type)`、`loadMany(manifest)`、`get<T>(url)`
  - 支持类型：texture、json、tilemap、shader、audio、sprite-sheet
  - `onProgress / onError` 回调

### 2.2 Sprite 动画

- [ ] 实现 TextureAtlas / SpriteSheet 解析
  - 从 JSON 描述文件加载帧信息（UV 区域 + 帧持续时间）
- [ ] 实现 `src/renderer/2d/SpriteAnimator.ts`
  - `play(animName) / stop() / update(dt)`
  - 输出当前帧的 uvRect 供 SpriteBatch 使用

### 2.3 Tilemap

- [ ] 编写 `src/renderer/shaders/tilemap.wgsl`
- [ ] 实现 `src/renderer/2d/TilemapRenderer.ts`
  - `loadMap(data: TilemapData)` — 兼容 Tiled JSON 格式
  - `setTileset(texture, tileSize)`
  - `render(camera)` — 视锥剔除 + GPU instancing 一次 draw call
  - 支持多图层（ground, decoration, collision）

### 2.4 场景管理 + 碰撞

- [ ] 实现 `src/framework/SceneManager.ts`
  - `push(scene) / pop() / switch(scene)`
  - Scene 接口：`onEnter / onExit / onPause / onResume / update / render`
- [ ] 实现基础 AABB 碰撞检测
  - `src/math/Collision.ts` — `aabbOverlap(a, b)`、`resolveOverlap(a, b)`

### 2.5 里程碑验证

- [ ] Demo：角色在 Tilemap 场景中走动，播放行走动画，与墙壁碰撞

---

## Phase 3: WebGL 2 回退后端

目标：实现 IGfxDevice 的 WebGL 2 实现，移动端全覆盖。Layer 2 以上代码零修改。

### 3.1 WebGL 2 后端

- [ ] 实现 `src/core/WebGL2Device.ts`（IGfxDevice 的 WebGL 2 实现）
  - 与 WebGPUDevice 相同的接口，内部用 WebGL 2 API
- [ ] 实现 WebGL 2 版本的 Buffer / Texture / Pipeline 封装
- [ ] 编写 GLSL ES 3.0 版本的 Shader
  - `sprite_batch.vert.glsl` + `sprite_batch.frag.glsl`
  - `tilemap.vert.glsl` + `tilemap.frag.glsl`
- [ ] 更新 `createGfxDevice()` 自动选择逻辑
  - `navigator.gpu && isSecureContext` → WebGPU，否则 → WebGL 2

### 3.2 验证

- [ ] 在 Chrome DevTools 中禁用 WebGPU，验证自动回退到 WebGL 2
- [ ] 在移动端浏览器上验证渲染结果一致

---

## Phase 4: ECS + Editors（编辑器）

目标：搭建 ECS 架构，实现可视化编辑器，达到「用编辑器制作一个完整关卡，无需手写 JSON」。

### 4.1 轻量 ECS

- [ ] 实现 `src/framework/ecs/types.ts`
  - Entity = number
  - 内置 Component 类型：Transform、Sprite、Velocity、Collider
- [ ] 实现 `src/framework/ecs/World.ts`
  - `createEntity / destroyEntity`
  - `addComponent / getComponent / removeComponent`
  - `query(...types) / forEach(types, callback)`
- [ ] 实现基础 System
  - `movementSystem(world, dt)`
  - `spriteRenderSystem(world, batch, camera)`
  - `collisionSystem(world)`
  - `animationSystem(world, dt)`

### 4.2 编辑器

所有编辑器为单个 HTML 文件 + 引擎运行时，输出 JSON。

- [ ] 创建 `editors/` 目录结构
- [ ] Sprite Animation Editor（`editors/animation/index.html`）
  - 导入 Sprite Sheet → 自动/手动切分帧 → 时间轴编辑 → 实时预览
  - 输出 `animation.json`
- [ ] Tilemap Editor（`editors/tilemap/index.html`）
  - 导入 Tileset → 画刷绘制 → 多图层 → 实时预览
  - 输出兼容 Tiled JSON 格式
- [ ] Scene Editor（`editors/scene/index.html`）
  - 左侧实体树 | 中间 Canvas 预览 | 右侧属性面板 | 底部资源面板
  - 拖拽放置 Sprite、选中变换 Gizmo、图层管理
  - 输出 `scene.json`
- [ ] Asset Browser（`editors/assets/index.html`）
  - 浏览资源目录 → 缩略图预览

---

## Phase 5: Polish（打磨）

目标：补全引擎能力，做出一个完整可玩的 Demo。

### 5.1 音频

- [ ] 实现 `src/framework/AudioManager.ts`
  - Web Audio API 底层
  - `load / play / stop / setMasterVolume / setChannelVolume`
  - 声道：music / sfx / ui

### 5.2 粒子系统

- [ ] 编写 `src/renderer/shaders/particle.wgsl`
- [ ] 实现 `src/renderer/2d/ParticleRenderer.ts`
  - `create(config) → ParticleEmitter`
  - `update(dt) / render(camera) / destroy()`

### 5.3 文字渲染

- [ ] 实现 `src/renderer/2d/TextRenderer.ts`
  - 初期：Canvas 2D 预渲染到纹理 → SpriteBatch 绘制
  - 进阶：MSDF 字体渲染

### 5.4 矢量渲染

- [ ] 编写 `src/renderer/shaders/vector.wgsl`
- [ ] 实现 `src/renderer/2d/VectorRenderer.ts`
  - `drawLine / drawRect / drawCircle / drawPath / drawSVG / flush`
  - 用于 Debug 绘制和 UI

### 5.5 基础 UI 系统

- [ ] 实现简单的 UI 层（按钮、文本标签、血条等常见游戏 UI 元素）

### 5.6 里程碑验证

- [ ] 一个完整的可玩 Demo，包含：场景切换、动画、粒子、音效、UI

---

## Phase 6: 部署与发布

### 6.1 单文件发布

- [ ] 集成 `vite-plugin-singlefile`，配置 `vite.config.single.ts`
- [ ] 验证所有资源（JS、WGSL、图片、音频）正确内联到单个 HTML

### 6.2 双轨部署

- [ ] 配置 iceriver.cc 自动部署（git push → 构建 → 上线）
- [ ] 编写 `scripts/publish-herenow.js`，实现 `npm run share` / `npm run share:quick`
- [ ] 更新 `package.json` scripts

### 6.3 Vite 多入口配置

- [ ] 配置 Vite 支持多入口：引擎 Demo、各编辑器、游戏项目
  - `games/demo/` 作为第一个游戏项目目录

---

## Phase 7: 3D 扩展（远期）

- [ ] `MeshRenderer` — glTF 加载 + 基础 PBR
- [ ] `Camera3D` — 透视投影、自由/轨道相机
- [ ] `BasicLighting` — 方向光 + 点光
- [ ] `SkyboxRenderer` — Cubemap 天空盒
- [ ] 2D/3D 混合渲染验证

---

## 开发原则提醒

1. 每个类一个文件，TypeScript strict mode
2. Shader 用独立 `.wgsl` 文件，通过 `?raw` 导入
3. 数据格式统一用 JSON
4. 编辑器用原生 HTML，不引入 React/Vue
5. 日常只写 WGSL，WebGL 2 的 GLSL 由 AI 生成
6. 保持系统小而可控（P5 原则）

## 技术决策索引

| ADR | 决策 |
|-----|------|
| ADR-001（修正） | WebGL 2 回退后端（原为不做） |
| ADR-002 | 轻量自写 ECS |
| ADR-003 | JSON 统一数据格式 |
| ADR-004 | 编辑器用原生 HTML |
| ADR-005 | Shader 用独立 .wgsl 文件 |
| ADR-006（修正） | WebGL 2 回退，不做 Canvas 2D |
| ADR-007 | 双轨部署：阿里云 + here.now |
| ADR-008 | 单文件发布用 vite-plugin-singlefile |
