# Mote Editor ECS 架构重构计划

> **目标**：将 Editor 改造成基于 ECS Prefab 的架构，实现 Editor 与 Runtime 的数据同构
> **时间预估**：3-4 周
> **状态**：规划中

---

## 1. 架构愿景

### 核心原则

| 原则 | 说明 |
|------|------|
| **数据同构** | Editor 编辑的 JSON 文件 = ECS 运行的 Prefab/Scene，零转换 |
| **一切皆 Prefab** | 地块、角色、道具、UI 元素全部是 Prefab，无特殊 Tile 层 |
| **可视化编辑** | Prefab 浏览器 + 组件编辑器 + Scene Viewport |
| **Canvas 2D** | 保留现有渲染方式，降低复杂度 |

### 架构对比

```
Before (Current)                          After (Target)
┌─────────────────┐                       ┌─────────────────┐
│ TileMap         │                       │ Scene (JSON)    │
│ ├─ TileLayer[]  │                       │ ├─ Entity[]     │
│ └─ EntityLayer[]│                       │ │  ├─ prefabId  │
│    └─ EntityInst│                       │ │  ├─ x, y      │
│       ├─ defId  │                       │ │  └─ overrides │
│       └─ x, y   │                       │ └─ ...          │
├─────────────────┤                       ├─────────────────┤
│ EntityDef[]     │                       │ Prefab (JSON)   │
│ ├─ spriteFrame  │    ─────────────────▶ │ ├─ components{} │
│ └─ fields[]     │                       │ │  ├─ Transform │
│                 │                       │ │  ├─ Sprite    │
│                 │                       │ │  └─ ...       │
└─────────────────┘                       └─────────────────┘
     两套数据模型                               单一数据模型
```

---

## 2. 数据格式定义

### 2.1 Prefab 格式（编辑器 ↔ ECS 通用）

```typescript
// prefab.schema.ts
interface Prefab {
  /** 唯一标识符，符合变量命名规范 */
  id: string;
  
  /** 显示名称 */
  name: string;
  
  /** 分类，用于浏览器分组 */
  category?: 'environment' | 'character' | 'item' | 'effect' | string;
  
  /** 组件配置 */
  components: {
    [componentName: string]: Record<string, any>;
  };
  
  /** 可选：默认缩略图（base64 或路径） */
  thumbnail?: string;
}
```

**示例：**
```json
{
  "id": "grass_01",
  "name": "草地",
  "category": "environment",
  "components": {
    "Transform": { "x": 0, "y": 0, "rotation": 0 },
    "Sprite": { "atlas": "terrain", "frame": "grass_01", "layer": 0 },
    "Collider": { "type": "none" }
  }
}
```

### 2.2 Scene 格式（纯 Entity 列表）

```typescript
// scene.schema.ts
interface Scene {
  /** 场景 ID */
  id: string;
  
  /** 场景名称 */
  name: string;
  
  /** 逻辑边界（像素） */
  bounds: {
    width: number;
    height: number;
  };
  
  /** 网格设置（仅编辑时） */
  grid?: {
    enabled: boolean;
    size: number;
    snap: boolean;
  };
  
  /** 场景中的所有实体 */
  entities: SceneEntity[];
  
  /** 引用的 Prefab 列表（可选，用于校验） */
  requiredPrefabs?: string[];
}

interface SceneEntity {
  /** 实体唯一 ID */
  id: string;
  
  /** 引用的 Prefab ID */
  prefab: string;
  
  /** 显示名称覆盖（可选） */
  name?: string;
  
  /** Transform 覆盖（最常见，单独提级） */
  x: number;
  y: number;
  rotation?: number;
  scaleX?: number;
  scaleY?: number;
  
  /** 其他组件属性覆盖 */
  overrides?: {
    [componentName: string]: Record<string, any>;
  };
}
```

**示例：**
```json
{
  "id": "forest_01",
  "name": "迷雾森林-入口",
  "bounds": { "width": 1280, "height": 960 },
  "grid": { "enabled": true, "size": 32, "snap": true },
  "entities": [
    { "id": "e_001", "prefab": "grass_01", "x": 0, "y": 0 },
    { "id": "e_002", "prefab": "grass_01", "x": 32, "y": 0 },
    { "id": "e_003", "prefab": "player", "x": 100, "y": 200, "rotation": 90 },
    { "id": "e_004", "prefab": "goblin", "x": 500, "y": 300, "overrides": { "Health": { "hp": 50 } } }
  ]
}
```

### 2.3 Component Schema 格式（从 JSDoc 提取）

```typescript
// component-schema.schema.ts
interface ComponentSchema {
  /** 组件类名 */
  name: string;
  
  /** 显示名称 */
  displayName?: string;
  
  /** 组件描述 */
  description?: string;
  
  /** 可编辑属性列表 */
  properties: {
    [propName: string]: PropertySchema;
  };
  
  /** 组件图标（用于 UI） */
  icon?: string;
  
  /** 是否允许在 Editor 中添加/移除 */
  editable?: boolean;
}

interface PropertySchema {
  /** 属性类型 */
  type: 'number' | 'string' | 'boolean' | 'enum' | 'color' | 'vec2' | 'ref';
  
  /** 默认值 */
  default: any;
  
  /** 显示名称 */
  label?: string;
  
  /** 属性描述 */
  description?: string;
  
  /** 约束条件 */
  constraints?: {
    min?: number;
    max?: number;
    step?: number;
    options?: string[];        // for enum
    nullable?: boolean;
  };
}
```

**示例（从 JSDoc 提取）：**
```json
{
  "name": "Transform",
  "displayName": "变换",
  "description": "位置、旋转、缩放",
  "properties": {
    "x": { "type": "number", "default": 0, "label": "X", "constraints": { "step": 1 } },
    "y": { "type": "number", "default": 0, "label": "Y", "constraints": { "step": 1 } },
    "rotation": { "type": "number", "default": 0, "label": "旋转", "constraints": { "min": -360, "max": 360, "step": 15 } },
    "scaleX": { "type": "number", "default": 1, "label": "缩放 X" },
    "scaleY": { "type": "number", "default": 1, "label": "缩放 Y" }
  },
  "editable": false  // Transform 不允许移除
}
```

---

## 3. 阶段规划

### Phase 1: 基础设施（Week 1）

#### 3.1.1 组件 Schema 提取系统
**目标**：从 Engine 的 JSDoc 生成组件编辑器可用的 Schema

**任务清单：**
- [ ] 创建 `packages/engine/scripts/extract-schemas.ts`
  - 使用 TypeScript Compiler API 解析组件文件
  - 提取 JSDoc 标签：`@default`, `@range`, `@step`, `@category`
  - 输出 `packages/engine/dist/component-schemas.json`
- [ ] 添加 npm script: `"build:schemas": "tsx scripts/extract-schemas.ts"`
- [ ] 修改组件定义，添加完整 JSDoc
  - Transform, Sprite, Rigidbody, Collider 等核心组件
- [ ] 验证 Schema 文件可被 Editor 加载

**文件变更：**
```
packages/engine/
├── scripts/
│   └── extract-schemas.ts          [NEW]
├── src/components/
│   ├── Transform.ts                [ADD JSDoc]
│   ├── Sprite.ts                   [ADD JSDoc]
│   └── ...
└── dist/
    └── component-schemas.json      [GENERATED]
```

#### 3.1.2 Prefab 数据层
**目标**：创建 Prefab 的数据模型和存储

**任务清单：**
- [ ] 创建 `packages/editor/src/data/Prefab.ts`
  - 定义 Prefab 类型（与 ECS 完全一致）
  - Prefab 加载/保存函数
  - Prefab 验证（schema-based）
- [ ] 创建 `packages/editor/src/store/prefabs.ts`
  - Signal-based prefab 存储
  - 分类/搜索/过滤
  - 内置 Prefab 注册
- [ ] 创建 Prefab 文件系统操作
  - 扫描 `assets/prefabs/*.json`
  - 文件监听（热重载）

#### 3.1.3 Scene 数据层改造
**目标**：将现有 TileMap 系统改造为 Entity-based Scene

**任务清单：**
- [ ] 修改 `packages/editor/src/data/Scene.ts`
  - 替换 TileLayer/EntityLayer 为统一 Entity 列表
  - 保留网格设置（仅用于吸附）
  - 迁移工具：旧格式 → 新格式
- [ ] 更新 `packages/editor/src/store/scene.ts`
  - Entity CRUD 操作
  - 批量操作（多选、复制粘贴）
- [ ] 导出功能适配新格式
  - Scene → ECS World 可加载的 JSON

#### 3.1.4 Sprite/Prefab 集成
**目标**：从 Sprite Editor 直接生成 Prefab，建立精灵图与 Prefab 的桥梁

**任务清单：**
- [ ] 创建 `packages/editor/src/tools/frameToPrefab.ts`
  - 从 Sprite Frame 生成最小化 Prefab
  - 自动继承 collider 信息（如果 frame 中有定义）
  - 支持批量生成（前缀+序号命名）
- [ ] 扩展 Sprite Editor
  - 添加 "Generate Prefab" 工具栏按钮
  - 右键菜单：选中 Frame → Create Prefab
  - 批量生成对话框（命名规则、分类选择）
- [ ] 集成到 Prefab Store
  - 生成的 Prefab 直接进入 Prefab Browser
  - 自动分类（基于用户选择或 Sprite 路径）
- [ ] Sprite Frame 选择器（供 Prefab 编辑器使用）
  - 在 Prefab 编辑器中可视化选择 Atlas+Frame
  - 显示 Frame 缩略图网格

**生成规则：**
```typescript
// 最小化 Prefab 生成
{
  "id": "${prefix}_${frameId}",      // 用户前缀 + frame id
  "name": frameId,
  "category": userSelectedCategory,   // 用户选择，默认 "from-sprite"
  "components": {
    "Transform": { "x": 0, "y": 0, "rotation": 0 },
    "Sprite": {
      "atlas": spriteAtlasId,
      "frame": frameId
    },
    // 如果 frame 有 collider，自动添加
    "Collider": frame.collider  // 可选
  }
}
```

#### 3.2.1 Prefab 浏览器
**目标**：可视化浏览和拖放 Prefab

**任务清单：**
- [ ] 创建 `packages/editor/src/editors/prefab-browser/`
  - PrefabBrowser.tsx - 主面板
  - PrefabCard.tsx - 单个 Prefab 预览
  - PrefabCategory.tsx - 分类折叠
  - SearchBar.tsx - 搜索过滤
- [ ] 实现拖放系统
  - 从浏览器拖出 Prefab
  - Viewport 接收并创建 Entity
  - 拖放预览（半透明）
- [ ] 右键菜单
  - 编辑 Prefab
  - 复制/删除 Prefab
  - 创建新 Prefab（从选中的 Entity）

**UI 草图：**
```
┌─────────────────────────┐
│ 🔍 Search...            │
├─────────────────────────┤
│ ▼ Environment (12)      │
│   ┌────┐ ┌────┐ ┌────┐  │
│   │🌿  │ │🌳  │ │🪨  │  │
│   │grass│ │tree│ │rock│  │
│   └────┘ └────┘ └────┘  │
├─────────────────────────┤
│ ▶ Characters (5)        │
│ ▶ Items (8)             │
└─────────────────────────┘
```

#### 3.2.2 Viewport 渲染适配
**目标**：从 Tile-based 渲染改为 Entity-based

**任务清单：**
- [ ] 重构 `ViewportCanvas.tsx`
  - 移除 TileLayer 渲染逻辑
  - 实现 Entity 渲染循环
  - 支持选择框、Gizmo
- [ ] 实现 Entity 选择系统
  - 点击选择（box/point shape）
  - 框选多选
  - 选择高亮渲染
- [ ] 实现 Transform Gizmo
  - 移动（X/Y 轴拖拽）
  - 旋转（角度拖拽）
  - 缩放（边角拖拽）
  - 网格吸附

#### 3.2.3 Inspector 属性面板
**目标**：编辑 Entity 的组件属性

**任务清单：**
- [ ] 创建 `packages/editor/src/components/inspector/`
  - EntityInspector.tsx - 当前选中 Entity
  - ComponentPanel.tsx - 单个组件编辑
  - PropertyField.tsx - 属性字段（根据 type）
- [ ] 实现 PropertyField 类型
  - number: 带 step、range 的 input
  - string: text input
  - boolean: checkbox/toggle
  - enum: select/dropdown
  - color: color picker
  - vec2: x,y 双输入
  - ref: 引用选择器（Entity/Prefab）
- [ ] 组件操作
  - 添加组件（从可用列表选择）
  - 移除组件（不可编辑的除外）
  - 重置为 Prefab 默认值

### Phase 3: Prefab 编辑器（Week 3）

#### 3.3.1 Prefab 编辑器面板
**目标**：创建和编辑 Prefab 定义

**任务清单：**
- [ ] 创建 `packages/editor/src/editors/prefab-editor/`
  - PrefabEditor.tsx - 完整编辑器
  - ComponentList.tsx - 已添加组件列表
  - AddComponentDialog.tsx - 添加组件弹窗
- [ ] 功能实现
  - 新建 Prefab（从空白或从 Entity）
  - 编辑 Prefab 组件
  - 设置 Prefab 默认属性
  - 设置 Prefab 分类/图标
- [ ] Prefab 预览
  - 孤立渲染（无场景背景）
  - 预览不同变体（测试 overrides）

#### 3.3.2 组件 Schema 编辑器（进阶）
**目标**：可视化编辑组件定义（可选，Phase 4）

**任务清单：**
- [ ] Component Schema 的可视化编辑
  - 添加/移除属性
  - 设置属性类型和约束
  - 生成对应的 TypeScript 代码

### Phase 4: 集成与优化（Week 4）

#### 3.4.1 运行时集成
**目标**：Editor 可直接运行 ECS World

**任务清单：**
- [ ] 创建 `packages/editor/src/runtime/EditorRuntime.ts`
  - 集成 @mote/engine World
  - Scene ↔ World 双向同步
  - Play Mode（在 Editor 中运行游戏）
- [ ] 实现 Play-in-Editor
  - Play/Pause/Step 按钮
  - 运行时修改是否同步回 Scene
  - 停止时恢复编辑状态

#### 3.4.2 性能优化
**目标**：处理大量 Entity 的场景

**任务清单：**
- [ ] 空间索引（Spatial Hash）
  - 加速 Entity 拾取（点击测试）
  - 加速视锥剔除
- [ ] 渲染优化
  - 视锥外 Entity 不渲染
  - 相同 Prefab 批量渲染
  - 缩放级别简化（LOD）
- [ ] 大数据场景测试
  - 10k+ Entity 场景流畅度
  - 内存占用监控

#### 3.4.3 导入导出
**目标**：完整的资产管线

**任务清单：**
- [ ] 批量导入
  - 从图集批量生成 Prefab（每个 frame 一个）
  - 从 Tiled 地图导入（转换为 Prefab Scene）
- [ ] 导出构建
  - Scene 压缩（移除 Editor 专用数据）
  - Prefab 打包（依赖分析）
  - 生成游戏可直接加载的 bundle

---

## 4. 文件结构变更

### 新增文件

```
packages/editor/src/
├── data/
│   ├── Prefab.ts                    # Prefab 类型定义
│   ├── Scene.ts                     # 重写：Entity-based Scene
│   ├── ComponentSchema.ts           # 组件 Schema 类型
│   └── SpriteAtlas.ts               # 复用/改造：Sprite 图集数据
│
├── store/
│   ├── prefabs.ts                   # Prefab store
│   └── scene.ts                     # 重写：Entity CRUD
│
├── editors/
│   ├── prefab-browser/              # NEW
│   │   ├── PrefabBrowser.tsx
│   │   ├── PrefabCard.tsx
│   │   ├── PrefabCategory.tsx
│   │   └── register.ts
│   │
│   ├── prefab-editor/               # NEW
│   │   ├── PrefabEditor.tsx
│   │   ├── ComponentList.tsx
│   │   ├── AddComponentDialog.tsx
│   │   ├── SpriteFrameSelector.tsx  # NEW：可视化选择 Sprite Frame
│   │   └── register.ts
│   │
│   ├── sprite-editor/               # 扩展
│   │   ├── ...existing files
│   │   ├── GeneratePrefabDialog.tsx # NEW：批量生成 Prefab 对话框
│   │   └── frameToPrefab.ts         # NEW：Frame 转 Prefab 逻辑
│   │
│   └── viewport/
│       └── ViewportCanvas.tsx       # 重写：Entity 渲染
│
├── components/inspector/            # NEW
│   ├── EntityInspector.tsx
│   ├── ComponentPanel.tsx
│   └── PropertyField.tsx            # 包含 Sprite 选择器
│
├── tools/                           # NEW：资产处理工具
│   └── frameToPrefab.ts             # Sprite Frame → Prefab 生成
│
├── runtime/                         # NEW
│   ├── EditorRuntime.ts             # ECS 运行时集成
│   └── SceneSync.ts                 # Scene ↔ World 同步
│
└── bridge/                          # NEW
    ├── entityToPrefab.ts            # Entity → Prefab 转换
    └── prefabToEntity.ts            # Prefab → Entity 实例化

packages/engine/
├── scripts/
│   └── extract-schemas.ts           # NEW：Schema 提取脚本
│
└── src/components/
    ├── Transform.ts                 # 修改：完整 JSDoc
    ├── Sprite.ts                    # 修改：完整 JSDoc
    └── ...
```

### 删除/废弃文件

```
packages/editor/src/
├── data/
│   ├── TileMap.ts                   # 删除：替换为 Scene.ts
│   └── EntityDef.ts                 # 删除：替换为 Prefab.ts
│
└── store/
    └── project.ts                   # 修改：移除 Tile 相关
```

**注意**: `SpriteAtlas.ts` 不会被删除，而是复用/改造为支持 ECS Sprite 组件的图集数据管理。

---

## 5. 技术细节

### 5.1 JSDoc 标签规范

组件属性支持的 JSDoc 标签：

```typescript
export class Sprite {
  /** 
   * 图集名称
   * @default ""
   * @category "外观"
   */
  atlas = "";
  
  /**
   * 帧名称
   * @default ""
   */
  frame = "";
  
  /**
   * 渲染层级
   * @default 0
   * @range [0, 100]
   * @step 1
   */
  layer = 0;
  
  /**
   * 颜色叠加
   * @default "#ffffff"
   * @type color
   */
  tint = "#ffffff";
  
  /**
   * 是否可见
   * @default true
   */
  visible = true;
}
```

支持的标签：
- `@default` - 默认值（必需）
- `@range [min, max]` - 数值范围
- `@step` - 步进值
- `@type` - 覆盖推断类型（color, vec2, ref）
- `@category` - 属性分组
- `@readonly` - 只读（不在 Editor 显示）

### 5.2 组件分类

Editor 中组件按以下分组显示：

| 分组 | 组件示例 | 说明 |
|------|----------|------|
| **变换** | Transform | 位置、旋转、缩放，不可移除 |
| **渲染** | Sprite, Camera, Light | 视觉相关 |
| **物理** | Rigidbody, Collider | 物理模拟 |
| **游戏** | Health, Inventory, AI | 游戏逻辑 |
| **输入** | PlayerInput | 输入处理 |

### 5.3 Entity 选择算法

```typescript
// 屏幕坐标 → World 坐标 → Entity 拾取
function pickEntity(screenX: number, screenY: number): EntityId | null {
  // 1. 屏幕 → 世界
  const worldPos = screenToWorld(screenX, screenY);
  
  // 2. 空间索引查询候选
  const candidates = spatialHash.query(worldPos, tolerance);
  
  // 3. 精确 hit test（从后往前，上层优先）
  for (const eid of candidates.reverse()) {
    const bounds = getEntityBounds(eid); // 从 Sprite 或 Collider
    if (bounds.contains(worldPos)) {
      return eid;
    }
  }
  return null;
}
```

---

## 6. 风险与缓解

### 5.4 Sprite 与 Prefab 集成

#### 5.4.1 关系模型

```
┌─────────────────┐     生成      ┌─────────────────┐
│  Sprite Atlas   │ ────────────▶ │     Prefab      │
│  (.mote-sprite) │               │   (.prefab.json)│
│                 │               │                 │
│  ┌───────────┐  │               │  components:    │
│  │ Frame 7   │  │               │    Sprite: {    │
│  │ ┌───┐     │  │               │      atlas: ref │
│  │ │🧱 │     │  │               │      frame: ref │
│  │ └───┘     │  │               │    }            │
│  │ collider  │  │               │    Collider?    │
│  └───────────┘  │               │  (optional)     │
└─────────────────┘               └─────────────────┘
```

#### 5.4.2 一键生成流程

**单帧生成（右键菜单）：**
```typescript
// 1. 在 Sprite Editor 中选中 Frame
const frame = selectedFrames[0];  // { id: "frame_7", x, y, w, h, collider? }

// 2. 弹出快速生成对话框
const config = {
  id: "wall_brick",           // 用户输入，默认：frame.id
  name: "砖墙",               // 用户输入，默认：frame.id
  category: "walls",          // 用户选择，默认："from-sprite"
  autoCollider: true          // 复选框，默认：true
};

// 3. 生成 Prefab
const prefab = {
  id: config.id,
  name: config.name,
  category: config.category,
  components: {
    Transform: { x: 0, y: 0, rotation: 0 },
    Sprite: {
      atlas: currentAtlas.id,
      frame: frame.id
    },
    ...(config.autoCollider && frame.collider && {
      Collider: frame.collider
    })
  }
};

// 4. 保存并刷新 Prefab Browser
prefabStore.addPrefab(prefab);
```

**批量生成（工具栏按钮）：**
```typescript
// 选中多个 Frame，使用前缀+序号命名
const frames = selectedFrames;  // [frame_7, frame_8, frame_14, ...]
const config = {
  prefix: "wall",              // 用户输入
  category: "walls",
  autoCollider: true
};

frames.forEach((frame, index) => {
  const num = (index + 1).toString().padStart(2, '0');
  const prefab = {
    id: `${config.prefix}_${num}`,  // wall_01, wall_02...
    name: `${config.prefix}_${num}`,
    // ...其余同上
  };
});
```

#### 5.4.3 Sprite 组件设计

```typescript
// Engine 组件
export class Sprite {
  /** 
   * 图集 ID（对应 .mote-sprite.json 的 id）
   * @default ""
   */
  atlas = "";
  
  /** 
   * 帧 ID（对应 frames 数组中的 id）
   * @default ""
   */
  frame = "";
  
  /** 
   * 渲染层级
   * @default 0
   * @range [-100, 100]
   * @step 1
   */
  layer = 0;
  
  /** 
   * 颜色叠加
   * @default "#ffffff"
   * @type color
   */
  tint = "#ffffff";
  
  /** @default false */
  flipX = false;
  
  /** @default false */
  flipY = false;
}
```

#### 5.4.4 运行时资源管理

```typescript
// Engine 资源管理
class ResourceManager {
  private atlases = new Map<string, SpriteAtlas>();
  
  async loadAtlas(path: string): Promise<SpriteAtlas> {
    const json = await fetch(path).then(r => r.json());
    const image = await loadImage(json.image);  // 相对路径解析
    
    return {
      id: json.id,
      image,
      frames: new Map(json.frames.map(f => [f.id, f]))
    };
  }
  
  getFrame(atlasId: string, frameId: string): SpriteFrame | undefined {
    return this.atlases.get(atlasId)?.frames.get(frameId);
  }
}

// 渲染系统使用
function spriteRenderSystem(world: World, dt: number) {
  const renderer = world.getResource<Renderer>('renderer');
  
  for (const eid of world.query(Transform, Sprite)) {
    const t = world.get(eid, Transform);
    const s = world.get(eid, Sprite);
    
    const frame = renderer.getFrame(s.atlas, s.frame);
    if (!frame) continue;
    
    renderer.drawImage(
      atlas.image,
      frame.x, frame.y, frame.w, frame.h,  // src
      t.x, t.y, frame.w, frame.h           // dst
    );
  }
}
```

#### 5.4.5 Prefab 编辑器中的 Sprite 选择器

```tsx
// PropertyField.tsx 中的 Sprite 类型字段
function SpritePropertyField({ value, onChange }) {
  return (
    <div class="sprite-property">
      {/* 图集选择下拉框 */}
      <select 
        value={value.atlas}
        onChange={e => onChange({ ...value, atlas: e.target.value, frame: '' })}
      >
        <option value="">选择图集...</option>
        {availableAtlases.map(a => (
          <option value={a.id}>{a.name}</option>
        ))}
      </select>
      
      {/* 帧选择网格（选中图集后显示） */}
      {value.atlas && (
        <FrameGrid 
          atlas={value.atlas}
          selectedFrame={value.frame}
          onSelect={frameId => onChange({ ...value, frame: frameId })}
        />
      )}
    </div>
  );
}

// 帧网格组件
function FrameGrid({ atlas, selectedFrame, onSelect }) {
  const atlasData = useAtlas(atlas);
  
  return (
    <div class="frame-grid">
      {atlasData.frames.map(frame => (
        <div 
          key={frame.id}
          class={cn('frame-thumb', selectedFrame === frame.id && 'selected')}
          onClick={() => onSelect(frame.id)}
          style={{
            backgroundImage: `url(${atlasData.image.src})`,
            backgroundPosition: `-${frame.x}px -${frame.y}px`,
            width: frame.w,
            height: frame.h
          }}
        />
      ))}
    </div>
  );
}
```

**症状**：10k+ 地块场景卡顿

**缓解措施：**
- 实现空间索引（Spatial Hash 或 QuadTree）
- 视锥剔除（Frustum Culling）
- 考虑保留可选的 TilemapComponent（内部优化，对外 Prefab-like）

**决策点**：Phase 4 性能测试后决定是否保留 Tilemap 优化路径

### 风险 2：数据迁移

**症状**：旧项目无法打开

**缓解措施：**
- 提供自动迁移工具
- 保留旧版 Editor 分支供旧项目使用
- 清晰的版本检测和错误提示

### 风险 3：Prefab 循环依赖

**症状**：Prefab A 引用了 Prefab B，B 又引用 A

**缓解措施：**
- Prefab 验证阶段检测循环依赖
- 加载时深度限制和错误处理
- 建议的 Prefab 设计规范

### 风险 4：组件 Schema 不同步

**症状**：Engine 组件修改后，Editor 显示不正确

**缓解措施：**
- 开发时监听组件文件变化，自动重建 Schema
- CI 检查 Schema 是否最新
- 运行时 Schema 版本校验

---

## 7. 里程碑

| 里程碑 | 日期 | 验收标准 |
|--------|------|----------|
| **M1: Schema 系统** | Week 1 结束 | 可从 JSDoc 生成组件 Schema，Editor 能加载 |
| **M2: Prefab 系统** | Week 2 中 | Prefab 浏览器可用，可拖放创建 Entity |
| **M3: 完整编辑** | Week 3 结束 | 可创建/编辑 Prefab，可编辑 Entity 组件，Scene 可保存/加载 |
| **M4: 运行时** | Week 4 结束 | 可在 Editor 中 Play，性能达标，Tiny Dungeon 完全迁移 |

---

## 8. 附录

### 8.1 命名规范

| 概念 | 命名规范 | 示例 |
|------|----------|------|
| Prefab ID | snake_case | `grass_01`, `goblin_warrior` |
| Entity ID | e_前缀+序号 | `e_001`, `e_player` |
| Scene ID | 场景名 | `forest_01`, `dungeon_boss` |
| Component | PascalCase | `Transform`, `SpriteRenderer` |
| Property | camelCase | `moveSpeed`, `attackDamage` |

### 8.2 参考资源

- ECS 设计文档：`@docs/mote-ecs-api-design.md`
- Engine 组件目录：`packages/engine/src/components/`
- Editor 当前实现：`packages/editor/src/editors/`

### 8.3 决策记录

**ADR-001**: 移除 TileLayer，全部使用 Prefab
- **状态**: 已接受
- **原因**: 架构统一，灵活度高
- **风险**: 性能问题（待验证）

**ADR-002**: 保留 Canvas 2D 渲染
- **状态**: 已接受
- **原因**: 实现简单，满足当前需求
- **未来**: 可迁移到 WebGL 批量渲染

**ADR-003**: JSDoc 作为 Schema 唯一真相源
- **状态**: 已接受
- **原因**: 单一来源，自动生成
- **约束**: 需要构建时步骤

**ADR-004**: Sprite Frame 一键生成 Prefab
- **状态**: 已接受
- **原因**: 美术资源到游戏对象的最短路径，减少手动创建 Prefab 的重复工作
- **实现**: Sprite Editor 中选择 Frame → 生成最小化 Prefab（Transform + Sprite + 可选 Collider）
- **规则**: 
  - 单帧：用户命名或使用 Frame ID
  - 批量：前缀+序号（wall_01, wall_02）
  - 自动继承：Frame 中的 collider 数据自动转为 Collider 组件

---  
*负责人: 待定*  
*审核状态: 待 Review*
