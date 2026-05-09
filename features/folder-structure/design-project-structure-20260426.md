# mote 项目目录结构设计

> **日期**: 2026-04-26  
> **核心原则**: `editor` 和 `games/*` 是等价平行的 App，共享 `engine` 内核

---

## 1. 设计原则

### 1.1 三层架构

```
engine/          ← 唯一共享层：ECS 内核 + 官方 Plugin + 工具
├── core/        ← headless，零渲染依赖
└── plugins/     ← 可插拔能力（渲染、物理、输入、音频...）

editor/          ← 独立应用：Preact + Canvas2D ECS 预览
└── src/         ← 自己的 main.tsx，new App() + Canvas2DRenderPlugin

games/           ← 每个游戏是独立应用
├── <name>/      ← 自己的 main.ts，new App() + WebGPURenderPlugin
└── ...
```

### 1.2 硬性约束

| 约束 | 说明 |
|------|------|
| **engine 不依赖 editor/games** | engine 是纯库，不知道上层是谁 |
| **editor 不依赖 games** | editor 是通用工具，不硬编码任何游戏的组件 |
| **games 不互相依赖** | 每个游戏自包含，可独立部署 |
| **editor/games 平等依赖 engine** | 都 `import { App, World, ... } from '@mote/engine'` |
| **构建可独立** | 任何一个 game 或 editor 可以 `cd` 进去直接 `vite` 跑 |

### 1.3 为什么 editor 和 games 平级

当前 `packages/editor` + `games/*` 的结构已经隐含了这种关系，但不够清晰。关键问题是：

- **editor 和 games 都创建 `App` 实例**
- **editor 和 games 都选择自己的 Plugin 组合**
- **editor 和 games 都写自己的 Component + System**
- **editor 不是 engine 的"一部分"，它和 games 一样，是 engine 的消费者**

如果把 editor 放在 `packages/` 里，容易误解为它是 engine 的配套库。实际上它更接近一个**特殊用途的 game**——一个用来编辑其它 games 的 meta-game。

---

## 2. 目标目录结构

```
mote/                              ← repo root
│
├── README.md
├── AGENTS.md
├── package.json                   ← workspace root
├── tsconfig.json                  ← 共享 ts 配置
├── vite.config.ts                 ← root MPA 构建（部署用）
│
├── designs/                       ← 设计文档
│   ├── design-ecs-plugin-refactor-20260426.md
│   └── design-project-structure-20260426.md   ← 本文件
│
├── packages/
│   └── engine/                    ← @mote/engine
│       ├── package.json
│       ├── tsconfig.json
│       ├── scripts/               ← 构建时脚本（schema 提取等）
│       │   └── extract-schemas.ts
│       │
│       └── src/
│           ├── index.ts           ← 统一导出（public API）
│           ├── vite-env.d.ts
│           │
│           ├── core/              ← ECS 内核（headless）
│           │   ├── app.ts         ← App 门面（NEW）
│           │   ├── plugin.ts      ← Plugin 接口（NEW）
│           │   ├── schedule.ts    ← ScheduleLabel（NEW）
│           │   ├── world.ts       ← ECS 存储（不动）
│           │   ├── component.ts   ← ComponentRegistry（不动）
│           │   ├── entity.ts      ← Entity 胖句柄（不动）
│           │   ├── query.ts       ← QueryResult（不动）
│           │   ├── resource.ts    ← ResourceStore（不动）
│           │   ├── prefab.ts      ← PrefabStore（不动）
│           │   ├── event.ts       ← EventBus（不动）
│           │   ├── types.ts       ← 类型定义
│           │   └── index.ts       ← core 桶文件
│           │
│           ├── plugins/           ← 官方 Plugin
│           │   ├── index.ts       ← 统一导出
│           │   │
│           │   ├── core/          ← CorePlugin（Transform, Name, Parent...）
│           │   │   ├── index.ts
│           │   │   └── ...
│           │   │
│           │   ├── time/          ← TimePlugin（Time resource, FixedUpdate）
│           │   │   ├── index.ts
│           │   │   └── ...
│           │   │
│           │   ├── input/         ← InputPlugin
│           │   │   ├── index.ts
│           │   │   └── ...
│           │   │
│           │   ├── physics/       ← PhysicsPlugin（原 physics.ts 拆分）
│           │   │   ├── index.ts
│           │   │   ├── components.ts
│           │   │   └── systems.ts
│           │   │
│           │   ├── render/        ← 渲染抽象层
│           │   │   ├── index.ts
│           │   │   ├── types.ts
│           │   │   ├── components.ts       ← Sprite, Camera, SpriteAnimation
│           │   │   ├── render-plugin.ts    ← 渲染 Plugin 抽象
│           │   │   │
│           │   │   ├── webgpu/             ← WebGPU 后端
│           │   │   │   ├── device.ts
│           │   │   │   ├── renderer.ts
│           │   │   │   ├── sprite-batch.ts
│           │   │   │   └── ...
│           │   │   │
│           │   │   └── canvas2d/           ← Canvas2D 后端（编辑器用）
│           │   │       ├── plugin.ts
│           │   │       ├── renderer.ts
│           │   │       └── systems.ts
│           │   │
│           │   ├── audio/         ← AudioPlugin
│           │   │   └── ...
│           │   │
│           │   └── tilemap/       ← TilemapPlugin
│           │       └── ...
│           │
│           └── utils/             ← 共享工具（原 Math.ts, Camera2D.ts 等）
│               ├── Math.ts
│               ├── Camera2D.ts
│               └── GameLoop.ts
│
├── editor/                        ← mote-editor（独立应用）
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts             ← 独立 vite，alias 到 engine
│   ├── index.html
│   │
│   └── src/
│       ├── main.tsx               ← 入口：new App() + 加载 Canvas2DRenderPlugin
│       ├── App.tsx                ← Preact 根组件
│       ├── index.css
│       │
│       ├── core/                  ← 编辑器专属 ECS 扩展（NEW）
│       │   ├── editor-app.ts      ← Editor extends App（NEW）
│       │   └── editor-plugin.ts   ← EditorPlugin（选中框、gizmo、grid...）（NEW）
│       │
│       ├── ui/                    ← Preact UI 组件（原 components/）
│       │   ├── LayoutRoot.tsx
│       │   ├── MenuBar.tsx
│       │   ├── StatusBar.tsx
│       │   ├── SpawnMenu.tsx
│       │   ├── dialogs/
│       │   │   ├── NewProjectDialog.tsx
│       │   │   └── OpenProjectDialog.tsx
│       │   └── inspector/
│       │       ├── ComponentPanel.tsx
│       │       ├── EntityInspector.tsx
│       │       └── PropertyField.tsx
│       │
│       ├── panels/                ← 编辑器面板（原 editors/）
│       │   ├── viewport/          ← 视口（接入 ECS Canvas2D 预览）
│       │   │   ├── register.ts
│       │   │   ├── ViewportEditor.tsx
│       │   │   ├── ViewportCanvas.tsx
│       │   │   ├── ViewportHeader.tsx
│       │   │   ├── ViewportFooter.tsx
│       │   │   ├── ViewportTPanel.tsx
│       │   │   └── ecs-bridge.ts      ← EditorECSBridge（NEW）
│       │   │
│       │   ├── inspector/
│       │   │   ├── register.ts
│       │   │   ├── InspectorEditor.tsx
│       │   │   └── panels/
│       │   │       ├── BrushPalette.tsx
│       │   │       ├── EntityPanel.tsx
│       │   │       ├── ExportPanel.tsx
│       │   │       ├── LayerPanel.tsx
│       │   │       ├── LayersPanel.tsx
│       │   │       ├── MapPropsPanel.tsx
│       │   │       └── PanelShell.tsx
│       │   │
│       │   ├── scene-tree/
│       │   │   ├── register.ts
│       │   │   └── SceneTreeEditor.tsx
│       │   │
│       │   ├── content-browser/
│       │   │   ├── register.ts
│       │   │   └── ContentBrowser.tsx
│       │   │
│       │   ├── prefab-browser/
│       │   │   ├── register.ts
│       │   │   └── PrefabBrowser.tsx
│       │   │
│       │   ├── prefab-preview/
│       │   │   ├── register.ts
│       │   │   └── PrefabPreviewEditor.tsx
│       │   │
│       │   ├── sprite-editor/
│       │   │   ├── register.ts
│       │   │   ├── SpriteEditor.tsx
│       │   │   ├── SpriteEditorCanvas.tsx
│       │   │   ├── SpriteEditorHeader.tsx
│       │   │   ├── SpriteEditorProperties.tsx
│       │   │   ├── SpriteEditorToolbar.tsx
│       │   │   ├── FrameContextMenu.tsx
│       │   │   ├── ImportDialog.tsx
│       │   │   ├── GeneratePrefabDialog.tsx
│       │   │   ├── ColliderOverlay.ts
│       │   │   └── state.ts
│       │   │
│       │   └── console/
│       │       ├── register.ts
│       │       └── ConsoleEditor.tsx
│       │
│       ├── data/                  ← 编辑器数据层（不动）
│       │   ├── Scene.ts
│       │   ├── Prefab.ts
│       │   ├── TileSet.ts
│       │   ├── SpriteSheet.ts
│       │   ├── SpriteAtlas.ts
│       │   ├── Collider.ts
│       │   ├── project.ts
│       │   ├── io.ts
│       │   ├── fs-access.ts
│       │   └── export.ts
│       │
│       ├── fs/                    ← 文件系统抽象
│       │   ├── index.ts
│       │   ├── FileSystem.ts
│       │   ├── PrefabFS.ts
│       │   ├── SceneFS.ts
│       │   └── SpriteSheetFS.ts
│       │
│       ├── commands/              ← 命令模式（undo/redo）
│       │   ├── index.ts
│       │   ├── scene-commands.ts
│       │   ├── prefab-commands.ts
│       │   ├── entity-prefab-commands.ts
│       │   └── brush-tool-commands.ts
│       │
│       ├── store/                 ← Preact Signals 状态
│       │   ├── project.ts
│       │   ├── scene.ts
│       │   ├── prefabs.ts
│       │   ├── prefabEditor.ts
│       │   ├── selection.ts
│       │   ├── viewport.ts
│       │   ├── viewport-mode.ts
│       │   ├── tileSelection.ts
│       │   ├── brush.ts
│       │   ├── clipboard.ts
│       │   ├── contentBrowser.ts
│       │   ├── history.ts
│       │   ├── spriteSheet.ts
│       │   └── engineSync.ts
│       │
│       ├── tools/                 ← 工具脚本
│       │   └── frameToPrefab.ts
│       │
│       ├── utils/                 ← 工具函数
│       │   ├── entitySprite.ts
│       │   └── override-utils.ts
│       │
│       ├── hooks/                 ← Preact Hooks
│       │   └── useDrag.ts
│       │
│       ├── layout/                ← 布局系统
│       │   ├── types.ts
│       │   ├── rect.ts
│       │   └── tree.ts
│       │
│       ├── project/               ← 项目管理层
│       │   ├── index.ts
│       │   ├── Project.ts
│       │   └── projectStore.ts
│       │
│       └── types.d.ts             ← 全局类型
│
├── games/                         ← 游戏项目（每个都是独立 App）
│   │
│   ├── _template/                 ← 游戏模板（NEW）
│   │   ├── package.json           ← 继承 root workspace
│   │   ├── tsconfig.json          ← 继承 root
│   │   ├── vite.config.ts         ← 最小 vite 配置
│   │   ├── index.html
│   │   └── src/
│   │       ├── main.ts            ← new App() + 装配 Plugin
│   │       ├── game-plugin.ts     ← 游戏主 Plugin
│   │       ├── components.ts      ← 游戏专属 Component
│   │       ├── systems.ts         ← 游戏专属 System
│   │       ├── prefabs.ts         ← Prefab 定义
│   │       └── world-init.ts      ← 世界初始化
│   │
│   ├── tiny-dungeon/              ← 现有 ECS 游戏
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── vite.config.ts
│   │   ├── index.html
│   │   ├── desngin-整体游戏设计.md
│   │   ├── src/
│   │   │   ├── main.ts            ← 改写：new App()
│   │   │   ├── game-plugin.ts     ← 改写：Plugin 对象
│   │   │   ├── components.ts      ← PlayerTag, EnemyAI, Weapon...
│   │   │   ├── systems.ts         ← inputSystem, weaponFlySystem...
│   │   │   ├── prefabs.ts         ← Prefab 定义
│   │   │   └── world-init.ts      ← 关卡初始化
│   │   └── assets/
│   │       ├── ...
│   │
│   ├── breakout/                  ← 现有 OOP 游戏（暂不 ECS 化）
│   │   ├── package.json
│   │   ├── index.html
│   │   ├── main.ts                ← 保持现状
│   │   └── plan-Breakout.md
│   │
│   ├── snake/                     ← 现有 OOP 游戏（暂不 ECS 化）
│   │   ├── package.json
│   │   ├── index.html
│   │   ├── main.ts                ← 保持现状
│   │   └── plan-snake.md
│   │
│   ├── tiny-town/                 ← 现有项目
│   │   ├── package.json
│   │   ├── index.html
│   │   ├── main.ts
│   │   ├── maps/
│   │   └── assets/
│   │
│   └── gg02/                      ← 现有项目（已有 .mote-project）
│       ├── gg02.mote-project.json
│       ├── src/
│       └── assets/
│
├── shared/                        ← 公共资源（所有 game/editor 共享）
│   └── assets/
│       └── fonts/
│           └── Fonsung/
│
└── scripts/                       ← 根级别脚本
    ├── bundle-html.mjs            ← 单 HTML 打包
    └── deploy.mjs                 ← 部署
```

---

## 3. 关键设计决策

### 3.1 engine 内部的 plugins/ 目录为什么要扁平化

当前：`physics.ts` 是一个 500+ 行的单文件，包含 component + system + plugin。

目标：拆成目录结构

```
plugins/physics/
  ├── index.ts        ← export PhysicsPlugin
  ├── components.ts   ← Transform, Velocity, RigidBody...
  └── systems.ts      ← kinematicSystem, collisionDetectionSystem...
```

**理由**：
- Component 和 System 分离后，编辑器侧可以只 import component 做类型检查
- 一个 Plugin 拆成 3 个文件，心智负担反而降低（打开目录就知道有什么）
- 符合 Bevy `bevy_physics/src/` 的 crate 内组织方式

### 3.2 render 为什么要拆成 webgpu/ + canvas2d/

```
plugins/render/
  ├── types.ts              ← Sprite, Camera, SpriteAnimation（共享）
  ├── render-plugin.ts      ← 渲染 Plugin 的通用部分（注册 component）
  ├── webgpu/
  │   └── ...               ← WebGPU 后端实现
  └── canvas2d/
      └── ...               ← Canvas2D 后端实现
```

**理由**：
- `Sprite` / `Camera` 等 Component 定义是共享的——它们只是纯数据
- 两个后端注册**同一套 Component**，但注册**不同的渲染 System**
- 游戏 bundle 只 import webgpu 路径，编辑器 import canvas2d 路径
- tree-shaking 自动剔除未引用的后端代码

### 3.3 editor 从 packages/ 移到根目录（已完成）

**已完成**：`packages/editor` → `editor/`

**涉及变更**：
- `package.json`：`workspaces` 增加 `"editor"`
- `tsconfig.json`：`"include"` 增加 `"editor"`
- `vite.config.ts`：MPA `editor` 入口路径从 `packages/editor/index.html` → `editor/index.html`
- `editor/vite.config.ts`：`@mote/engine` alias 从 `../engine/src` → `../packages/engine/src`

**理由**：

| 角度 | packages/editor | editor/ |
|------|-----------------|---------|
| 语义 | 像是 engine 的"配套库" | 明确是独立应用 |
| 和 games 的关系 | 隐晦（都在 workspaces，但目录层级不同） | 明确平行 |
| import 路径 | `@mote/engine`（和 games 一样） | `@mote/engine`（和 games 一样） |
| 构建入口 | 被 root vite MPA 包含 | 被 root vite MPA 包含 |
| 独立开发 | `cd packages/editor && vite` | `cd editor && vite` |

editor 内部没有硬编码的 `packages/engine` 路径，所有引用都走 `@mote/engine` alias，因此目录移动**不需要改任何源码文件**，只需更新 4 个配置文件。

### 3.4 games/_template/ 的作用

新建一个**游戏项目模板**，包含：

```
games/_template/
  ├── package.json        ← 最小配置
  ├── tsconfig.json       ← extends root
  ├── vite.config.ts      ← 最小 alias + port 配置
  ├── index.html
  └── src/
      ├── main.ts         ← new App() + addPlugins 示例
      ├── game-plugin.ts  ← Plugin 对象模板
      ├── components.ts   ← 空文件 + 注释
      ├── systems.ts      ← 空文件 + 注释
      ├── prefabs.ts      ← 空文件 + 注释
      └── world-init.ts   ← 空文件 + 注释
```

新建游戏时复制一份改名字即可。也可以做成 `npm create mote-game` 的脚手架（未来）。

### 3.5 root vite.config.ts 的 MPA 配置

当前 root vite.config.ts 已经用 `rollupOptions.input` 配置多页。目标结构下保持不变，但更新路径：

```ts
// vite.config.ts
build: {
  rollupOptions: {
    input: {
      main:        resolve(__dirname, 'index.html'),
      editor:      resolve(__dirname, 'editor/index.html'),
      snake:       resolve(__dirname, 'games/snake/index.html'),
      breakout:    resolve(__dirname, 'games/breakout/index.html'),
      tinyTown:    resolve(__dirname, 'games/tiny-town/index.html'),
      tinyDungeon: resolve(__dirname, 'games/tiny-dungeon/index.html'),
    },
  },
},
```

如果 game 数量变多（>10），可以考虑让 games 自己管理构建，root 只负责 editor + landing page。

### 3.6 构建时的 schema 提取

```
packages/engine/scripts/extract-schemas.ts
```

这个脚本扫描 engine + games 的 component class 文件，提取 JSDoc 生成 `component-schemas.json`。

目标位置不变，但扫描范围需要调整：
- 扫描 `packages/engine/src/plugins/**/components.ts`
- 扫描 `games/*/src/components.ts`
- 不扫描 `editor/`（editor 没有 ECS component，至少现在没有）

产物 `component-schemas.json` 被编辑器在启动时加载，用于 Inspector UI。

---

## 4. package.json workspace 配置

### 4.1 root package.json

```json
{
  "private": true,
  "type": "module",
  "workspaces": [
    "packages/*",
    "editor",
    "games/*"
  ],
  "scripts": {
    "dev:editor": "npm run dev -w editor",
    "dev:tiny-dungeon": "npm run dev -w tiny-dungeon",
    "build:engine": "npm run build -w @mote/engine",
    "build:schemas": "npm run build:schemas -w @mote/engine"
  }
}
```

### 4.2 game 的 package.json（模板）

```json
{
  "name": "tiny-dungeon",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview"
  }
}
```

不需要 `dependencies`，因为 `@mote/engine` 通过 root workspace + path alias 解析。

### 4.3 editor 的 package.json

```json
{
  "name": "mote-editor",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "preact": "^10.22.0",
    "@preact/signals": "^1.3.0"
  }
}
```

---

## 5. Path Alias 策略

### 5.1 root tsconfig.json

```json
{
  "compilerOptions": {
    "paths": {
      "@mote/engine": ["./packages/engine/src/index.ts"],
      "@mote/engine/*": ["./packages/engine/src/*"]
    }
  },
  "include": ["packages", "editor", "games"]
}
```

### 5.2 game 的 vite.config.ts（模板）

```ts
import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@mote/engine': resolve(__dirname, '../../packages/engine/src/index.ts'),
    },
  },
  server: {
    port: 5100, // 每个 game 分配不同端口
  },
});
```

### 5.3 editor 的 vite.config.ts

```ts
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { resolve } from 'path';

export default defineConfig({
  plugins: [preact()],
  resolve: {
    alias: {
      '@mote/engine': resolve(__dirname, '../packages/engine/src/index.ts'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
```

---

## 6. 编辑器 Viewport 的 ECS 接入点

这是 editor 和 engine 交汇的关键位置：

```
editor/src/panels/viewport/
  ├── ViewportEditor.tsx     ← Preact 组件：布局、工具栏
  ├── ViewportCanvas.tsx     ← <canvas> 挂载
  ├── ecs-bridge.ts          ← EditorECSBridge（NEW）
  └── register.ts            ← 面板注册
```

`ecs-bridge.ts` 的职责：
1. 创建 `new App()`
2. 加载 `CorePlugin` + `Canvas2DRenderPlugin`
3. 把 `<canvas>` 注入为 RenderTarget
4. 提供 `syncFromScene(scene)` 把 editor 的 `Scene` 数据转换成 ECS entity
5. 每帧调用 `app.update(0)` 触发渲染

```ts
// editor/src/panels/viewport/ecs-bridge.ts
import { App, CorePlugin } from '@mote/engine';
import { Canvas2DRenderPlugin } from '@mote/engine/plugins/render/canvas2d';

export class EditorECSBridge {
  readonly app: App;

  constructor(canvas: HTMLCanvasElement) {
    this.app = new App();
    this.app.addPlugins([
      CorePlugin,
      [Canvas2DRenderPlugin, { canvas }],
    ]);
  }

  syncFromScene(scene: Scene): void {
    // TODO: 把 scene.entities 转换成 ECS spawn
  }

  render(): void {
    this.app.update(0);
  }
}
```

---

## 7. 迁移路线图

### Phase A: engine 内部重组（1-2 天）

1. `packages/engine/src/plugins/` 下新建子目录：
   - `core/`
   - `time/`
   - `input/`
   - `physics/`（把 physics.ts 拆分）
   - `render/`（把 render/ 整理，新建 canvas2d/）
   - `audio/`
   - `tilemap/`

2. 更新 `packages/engine/src/plugins/index.ts` 导出

3. 更新 `packages/engine/src/index.ts`

### Phase B: 新建 App 门面（2-3 天）

1. 新建 `core/app.ts`、`core/plugin.ts`、`core/schedule.ts`
2. `App` 内部调用 `World` 旧 API
3. 逐个改写 engine Plugin 为对象形态
4. `tiny-dungeon` 同步迁移验证

### Phase C: editor viewport 接入 ECS（2-3 天）

> editor 目录移动（`packages/editor` → `editor/`）已完成。

1. 新建 `editor/src/core/editor-app.ts`
2. 新建 `editor/src/panels/viewport/ecs-bridge.ts`
3. `ViewportCanvas.tsx` 接入 ECS Bridge
4. `Canvas2DRenderPlugin` 最小实现（只画 Sprite + Transform）

### Phase D: 游戏模板 + 文档（1 天）

1. 新建 `games/_template/`
2. 更新 `README.md`
3. 更新 `AGENTS.md` 里的目录描述

---

## 8. 当前 → 目标 的变更清单

### 需要新建的文件/目录

```
packages/engine/src/core/app.ts
packages/engine/src/core/plugin.ts
packages/engine/src/core/schedule.ts
packages/engine/src/core/system.ts

packages/engine/src/plugins/core/
packages/engine/src/plugins/time/
packages/engine/src/plugins/input/
packages/engine/src/plugins/physics/
packages/engine/src/plugins/render/canvas2d/
packages/engine/src/plugins/audio/
packages/engine/src/plugins/tilemap/

editor/src/core/
editor/src/panels/viewport/ecs-bridge.ts

games/_template/
```

### 已完成的移动

```
packages/editor/ → editor/          （已完成，2026-04-26）
```

### 需要重命名的文件

```
packages/engine/src/plugins/render/plugin.ts → .../render/webgpu/plugin.ts
packages/engine/src/plugins/physics.ts → .../plugins/physics/index.ts
```

### 保持不变的核心文件

```
packages/engine/src/core/component.ts
packages/engine/src/core/world.ts
packages/engine/src/core/entity.ts
packages/engine/src/core/query.ts
packages/engine/src/core/resource.ts
packages/engine/src/core/prefab.ts
packages/engine/src/core/event.ts

editor/src/data/*
editor/src/store/*
editor/src/commands/*
editor/src/fs/*
```

---

## 9. 附录：Bevy 目录对照

| Bevy | mote（本设计） | 说明 |
|------|---------------|------|
| `bevy_ecs/` | `packages/engine/src/core/` | ECS 内核 |
| `bevy_app/` | `packages/engine/src/core/app.ts` | App + Plugin |
| `bevy_render/` | `packages/engine/src/plugins/render/` | 渲染层 |
| `bevy_sprite/` | `.../render/components.ts` | Sprite 组件 |
| `bevy_wgpu/` | `.../render/webgpu/` | WebGPU 后端 |
| `bevy_editor/` | `editor/` | 编辑器（独立应用） |
| `examples/game/` | `games/<name>/` | 游戏项目 |
| `bevy_reflect/` | `scripts/extract-schemas.ts` | 反射/schema |

---

## 10. 待确认问题

1. **game 是否各自需要独立的 `vite.config.ts`？**
   - 要：可以独立开发（`cd games/foo && vite`），端口不冲突
   - 不要：全部走 root MPA，game 数量少时更简单

2. **Canvas2DRenderPlugin 放在 `engine` 还是 `editor`？**
   - engine：它是一个"渲染后端"，和 WebGPU 同级，未来其他工具也可能需要
   - editor：只有编辑器用它，放 editor 里 engine 更干净
