# mote（微尘）

> 轻量级 Web 2D 游戏引擎 + 浏览器内嵌编辑器，ECS 架构，WebGPU 渲染。

## 简介

mote 是一个面向个人开发者与小型团队的开源 Web 2D 游戏引擎实验项目。引擎采用 ECS（Entity-Component-System）架构，渲染层以 WebGPU 为主、WebGL2 自动回退；配套编辑器基于 Preact + Signals 构建，可在浏览器中直接预览与编辑场景。

项目当前处于**活跃开发期**，核心引擎与编辑器功能已可运行，API 仍可能调整。

## 技术栈

| 层级 | 技术 |
|------|------|
| 渲染 | WebGPU (WGSL) / WebGL2 (GLSL) 自动回退 |
| 架构 | ECS（Entity-Component-System） |
| 编辑器 UI | Preact + @preact/signals |
| 构建 | Vite（多入口、HMR、单文件打包） |
| 语言 | TypeScript（strict 模式） |
| 部署 | SFTP 增量部署至阿里云 |

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器（主站 + 编辑器 + 各游戏项目）
npm run dev

# 构建全部（tsc + vite build）
npm run build

# 预览构建产物
npm run preview

# 打包成单个独立 HTML 文件
npm run bundle

# 构建并增量部署到服务器
npm run deploy

# TypeScript 类型检查
npm run check
```

> **注意**：WebGPU 和 File System Access API 需要 HTTPS 或 localhost，`file://` 协议不支持 WebGPU。

## 项目结构

```
packages/
  engine/          # 引擎核心（ECS、渲染、输入、音频、物理、Tilemap）
  editor/          # 浏览器编辑器（Preact UI、Viewport、Inspector、各种面板）
games/
  <name>/          # 独立游戏项目，引用 engine 包
docs/              # 设计文档与开发日志
scripts/
  bundle-html.mjs  # 单文件打包脚本
```

## 文档索引

需要深入某主题时，优先查阅对应文档。

| 文档 | 内容 |
|------|------|
| `docs/design.md` | 总体设计：设计哲学、架构分层（Layer 1-4）、ADR、双轨部署策略 |
| `docs/mote-engine-spec.md` | 引擎技术规格：ECS API、SpriteBatch、Tilemap、数据格式、构建工具链 |
| `docs/mote-editor-spec.md` | 编辑器技术规格：Preact UI、EditorBridge、CommandHistory、Viewport、Inspector |
| `docs/mote-ecs-design.md` / `mote-ecs-api-design.md` / `mote-ecs-layer.md` | ECS 架构设计、API 设计、分层细节 |
| `docs/design-content-browser.md` | 内容浏览器（Content Browser）设计 |
| `docs/input-design.md` | 输入系统（InputManager / ActionMap）设计 |
| `docs/Audio-System-Design.md` | Web Audio API 音频系统设计 |
| `docs/batch-render.md` | GPU Instancing 批量渲染设计 |
| `docs/sprite-editor-blender-redesign.md` | Sprite 编辑器 Blender 风格重设计 |
| `docs/blender-empty-state-research.md` | Blender 空状态交互研究 |
| `docs/blender-modal-dialog-research.md` | Blender 模态对话框研究 |
| `docs/design-mote-folder-structure.md` | 项目文件夹结构设计 |
| `docs/mote-editor-scene-design.md` | 编辑器场景系统设计 |
| `docs/dev-log.md` | 开发日志（记录决策与踩坑） |

## 设计哲学（不做清单）

| 不做 | 原因 |
|------|------|
| 通用商业引擎 | 小而可控，一人 + AI 能完全掌控 |
| 可视化 Shader 编辑器 | WGSL 直接写，AI 辅助 |
| 多人实时协作 | 复杂度超出范围 |
| AAA 3D 渲染 | 2D 为主，3D 远期扩展 |
| Canvas 2D 回退 | WebGL2 覆盖率 ~97%，保留 Shader 能力 |
| React/Vue 编辑器 | Preact ~3KB，AI 生成更可靠 |
| 内置 to-do 系统 | 用 TODO.md 文件 |
| 通用测试框架 | 当前无有效测试工作空间 |

## AI 开发

使用 AI Coding Agent 时，请同时参考 [`AGENTS.md`](./AGENTS.md) 获取编码约定、架构规则与项目当前状态。
