# WebGL 2 后端开发计划

## 项目背景

实现双后端架构（WebGPU + WebGL 2），让 mote 引擎能够在不支持 WebGPU 的设备上回退到 WebGL 2 运行。

## 当前状态

### ✅ 已完成

1. **抽象接口层** (`packages/engine/src/gfx/`)
   - `IGfxDevice.ts` - 定义了与后端无关的图形接口
   - `createGfxDevice.ts` - 自动检测并创建合适的后端

2. **WebGPU 后端** (`packages/engine/src/backends/webgpu/`)
   - `WebGPUDevice.ts` - 完整的 WebGPU 实现

3. **WebGL 2 后端** (`packages/engine/src/backends/webgl2/`)
   - `WebGL2Device.ts` - 基本框架已实现
   - 资源管理（Buffer, Texture, Pipeline, BindGroup）
   - RenderPass 和 FrameEncoder

4. **渲染器更新**
   - `SpriteBatch.ts` - 已更新为使用 `IGfxDevice` 抽象接口
   - 同时支持 WGSL 和 GLSL shader

5. **Shader 文件**
   - `shaders/SpriteBatch.wgsl` - WebGPU shader
   - `shaders/sprite_batch.vert.glsl` - WebGL 2 vertex shader
   - `shaders/sprite_batch.frag.glsl` - WebGL 2 fragment shader

6. **导出更新** (`index.ts`)
   - 导出新的抽象接口
   - 保留旧接口向后兼容

### 🔧 刚刚修复

- `WebGL2Device.ts` 中的常量引用问题（`USAGE_INDEX` → `BufferUsage.INDEX`）

## 架构设计

```
Layer 2: Renderers（渲染器层）
  SpriteBatch / Camera2D / (TilemapRenderer 等)
  ↓ 调用 Layer 1 接口

Layer 1: Graphics Abstraction（图形抽象层）
  IGfxDevice / IGfxBuffer / IGfxTexture / IGfxPipeline / IGfxBindGroup
  ├── WebGPUDevice   ← 主要实现
  └── WebGL2Device   ← 回退实现

自动选择逻辑：
  if (navigator.gpu && isSecureContext)
    → WebGPUDevice
  else
    → WebGL2Device
```

## 剩余工作

### Phase 1: 验证与测试

- [ ] 编译验证 - 确保 TypeScript 无错误
- [ ] WebGPU 路径测试 - 确保现有功能正常
- [ ] WebGL 2 路径测试 - 在不支持 WebGPU 的浏览器中测试

### Phase 2: 功能完善

- [ ] 验证 WebGL2 混合模式（blend mode）正确实现
- [ ] 验证纹理加载和绑定
- [ ] 验证 uniform buffer 更新机制
- [ ] 错误处理和边界情况

### Phase 3: 性能优化

- [ ] WebGL 2 状态变更优化（减少 gl 调用）
- [ ] 批量渲染优化
- [ ] 内存管理优化

### Phase 4: 扩展支持（可选）

- [ ] TilemapRenderer WebGL 2 支持
- [ ] 粒子系统 WebGL 2 支持
- [ ] Post-processing 效果

## 使用方式

```typescript
import { createGfxDevice, SpriteBatch, Camera2D } from '@mote/engine';

// 自动检测 WebGPU / WebGL 2
const gfx = await createGfxDevice(canvas);

// 使用方式与之前相同
const batch = new SpriteBatch(gfx);
const camera = new Camera2D(canvas.width, canvas.height);

// 渲染循环
batch.begin(camera);
batch.drawQuad(x, y, w, h, rotation, region, atlas, color);
batch.end();
```

## 技术细节

### WebGL 2 与 WebGPU 的关键差异处理

| 特性 | WebGPU | WebGL 2 |
|------|--------|---------|
| Shader 语言 | WGSL | GLSL ES 3.0 |
| 管线状态 | 预创建 Pipeline | 运行时状态设置 |
| BindGroup | 显式 BindGroup 对象 | uniform location + texture unit |
| Buffer 更新 | queue.writeBuffer | bufferSubData |
| 纹理坐标 | 原点左上 | 原点左下（已统一处理）|

### 注意事项

1. **纹理坐标**: WebGL 的纹理坐标原点在左下角，但代码中通过 `UNPACK_FLIP_Y_WEBGL` 设置为 false 保持与 WebGPU 一致

2. **Uniform 更新**: WebGL 2 需要保持 CPU 端的 uniform 数据副本（`cpuData`），因为无法直接从 GPU buffer 读取

3. **Texture Unit**: WebGL 2 需要手动管理 texture unit 分配

## 下一步行动

1. 运行 `tsc` 编译验证
2. 创建测试页面验证 WebGL 2 路径
3. 修复发现的问题
