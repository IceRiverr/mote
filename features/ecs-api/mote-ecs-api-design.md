# 微尘引擎 ECS API 设计文档

## 1. 设计原则

- **简洁**：一个小而完整的 2D 游戏引擎，API 表面积最小化
- **统一**：同一件事只有一种做法——`spawn` 创建一切，`Entity` 操作一切
- **双层架构**：外层胖句柄（`Entity`）追求开发体验，内层纯 ID（`EntityId`）追求性能
- **数据驱动**：Component 是 Class（逻辑友好），Prefab 是 JSON/TS（编辑器友好），JSDoc 是 Schema 的唯一真相源
- **插件化**：核心只保留 ECS，渲染/音频/输入等能力通过插件注册

---

## 2. 核心类型

```ts
/** 实体数字 ID —— 引擎内部的核心标识 */
type EntityId = number;

/** 组件类约束 */
type ComponentClass<T = any> = new () => T;

/** Prefab 创建和组件初始化的统一配置形状 */
type SpawnConfig = {
  [K in keyof ComponentMap]?: Partial<ComponentMap[K]>
};

/** System 可以是函数或对象 */
type SystemFn = (world: World, dt: number) => void;
type SystemObj = { name?: string; update: SystemFn };
type System = SystemFn | SystemObj;

/** Plugin 就是一个接收 World 的函数 */
type Plugin = (world: World) => void;
```

---

## 3. Component 定义

组件使用 **Class + JSDoc** 定义。Class 提供默认值和类型，JSDoc 作为编辑器 Schema 的唯一真相源。

```ts
// engine/src/core/components/transform.ts

export class Transform {
  /** X 坐标（像素） @default 0 */
  x = 0;
  /** Y 坐标（像素） @default 0 */
  y = 0;
  /** 旋转角度（弧度） @default 0 */
  rotation = 0;
}
```

```ts
// engine/src/core/components/stats.ts

export class Stats {
  /** 当前生命值 @default 100 */
  hp = 100;
  /** 最大生命值 @default 100 */
  maxHp = 100;
  /** 移动速度（像素/秒） @default 120 */
  moveSpeed = 120;
  /** 防御系数 (0~1) @default 0.05 */
  defense = 0.05;
}
```

```ts
// Tag 组件 —— 空类，仅作标记
export class PlayerTag {}
export class InvincibleTag {}
```

### 3.1 ComponentMap 类型桥接

通过 TS declaration merging，为字符串 key 提供编译时类型检查：

```ts
// engine/src/core/component.ts

export interface ComponentMap {
  // 各组件文件通过 declare module 扩展
}
```

```ts
// engine/src/core/components/transform.ts（追加）

declare module '../component' {
  interface ComponentMap {
    Transform: Transform;
  }
}
```

效果：`spawn({ Tramsform: {} })` 拼写错误会在编译时报错。

---

## 4. Entity

Entity 是胖句柄——持有 `EntityId` + `World` 引用（private）。外部使用者感知不到 world 的存在，只看到一个"可操作的实体对象"。

```ts
class Entity {
  readonly id: EntityId;
  private world: World;

  /** 实体是否仍然存活 */
  get alive(): boolean;

  /** 添加组件，返回 this 支持链式调用 */
  add<T>(cls: ComponentClass<T>, data?: Partial<T>): this;

  /** 移除组件 */
  remove<T>(cls: ComponentClass<T>): this;

  /** 获取组件（类型自动推断） */
  get<T>(cls: ComponentClass<T>): T;

  /** 判断是否拥有组件 */
  has<T>(cls: ComponentClass<T>): boolean;

  /** 销毁实体 */
  destroy(): void;
}
```

### 用法示例

```ts
const player = world.spawn({ Transform: { x: 160 }, Stats: { hp: 100 } });

// 链式添加
player.add(Knockback, { force: 100, dirX: 1 }).add(HitStun, { remaining: 0.3 });

// 读取 —— 返回类型自动推断为 Transform
const t = player.get(Transform);
t.x += 10;

// 判断 + 移除
if (player.has(InvincibleTag)) {
  player.remove(InvincibleTag);
}

// 销毁
player.destroy();
```

---

## 5. World

### 5.1 spawn —— 统一创建入口

三种用法，一个方法名，第一个参数类型自动区分语义：

```ts
class World {
  // 空实体
  spawn(): Entity;
  // 声明式创建
  spawn(config: SpawnConfig): Entity;
  // Prefab 实例化 + 可选覆盖
  spawn(prefabId: string, overrides?: SpawnConfig): Entity;
}
```

```ts
const empty  = world.spawn();
const player = world.spawn({ Transform: { x: 160 }, Stats: { hp: 100 } });
const goblin = world.spawn('goblin', { Transform: { x: 300, y: 200 } });
```

### 5.2 World 级组件操作

System 内部高频遍历时，可直接用 EntityId + World 操作，避免 Entity 对象分配：

```ts
class World {
  add<T>(eid: EntityId, cls: ComponentClass<T>, data?: Partial<T>): void;
  remove<T>(eid: EntityId, cls: ComponentClass<T>): void;
  get<T>(eid: EntityId, cls: ComponentClass<T>): T;
  has<T>(eid: EntityId, cls: ComponentClass<T>): boolean;
  destroy(eid: EntityId): void;

  /** 从 EntityId 获取 Entity 包装 */
  ref(eid: EntityId): Entity;
}
```

### 5.3 Query

```ts
class World {
  query<T extends ComponentClass[]>(...components: T): QueryResult<InstanceTypes<T>>;
}
```

两种遍历风格：

```ts
// 风格 A：for...of + world.get（灵活，适合复杂逻辑）
for (const eid of world.query(Transform, Velocity)) {
  const t = world.get(eid, Transform);
  const v = world.get(eid, Velocity);
  if (world.has(eid, HitStun)) continue;
  t.x += v.vx * dt;
}

// 风格 B：each 回调（简洁，适合简单系统）
world.query(Transform, Velocity).each((t, v, entity) => {
  t.x += v.vx * dt;
  t.y += v.vy * dt;
});
```

### 5.4 System 注册

手动显式注册，调用顺序即执行顺序：

```ts
class World {
  addSystem(system: System): void;
  update(dt: number): void;
}
```

### 5.5 Prefab 注册

```ts
class World {
  registerPrefab(prefab: Prefab): void;
}
```

### 5.6 Plugin 注册

```ts
class World {
  use(...plugins: Plugin[]): this;
}
```

### 5.7 Resource

插件注册全局共享的非 Entity 资源（渲染器实例、音频上下文等）：

```ts
class World {
  addResource<T>(key: string, value: T): void;
  getResource<T>(key: string): T;
}
```

### 5.8 事件

```ts
class World {
  emit(event: string, data: any): void;
  on(event: string, handler: Function): void;
}
```

---

## 6. Prefab

### 6.1 类型定义

```ts
interface Prefab {
  id: string;
  name?: string;
  components: SpawnConfig;
  children?: Prefab[];
}
```

### 6.2 JSON 定义（编辑器产出）

```json
{
  "id": "goblin",
  "name": "Goblin",
  "components": {
    "Transform": { "x": 0, "y": 0 },
    "Stats": { "hp": 30, "maxHp": 30, "moveSpeed": 80 },
    "Sprite": { "atlas": "enemies", "frame": "goblin_idle_0" },
    "Hurtbox": { "width": 12, "height": 16 }
  }
}
```

### 6.3 TS 定义（程序员手写）

```ts
import { definePrefab } from '../core/prefab';

export const GoblinPrefab = definePrefab({
  id: 'goblin',
  name: 'Goblin',
  components: {
    Transform: { x: 0, y: 0 },
    Stats: { hp: 30, maxHp: 30, moveSpeed: 80 },
    Sprite: { atlas: 'enemies', frame: 'goblin_idle_0' },
    Hurtbox: { width: 12, height: 16 },
  },
});
```

`definePrefab` 提供编译时类型检查，运行时原样返回：

```ts
function definePrefab(def: Prefab): Prefab {
  return def;
}
```

### 6.4 注册

```ts
// JSON —— 批量加载
const files = import.meta.glob('./data/prefabs/**/*.json', { eager: true });
for (const mod of Object.values(files)) {
  world.registerPrefab(mod as Prefab);
}

// TS —— 直接注册
world.registerPrefab(GoblinPrefab);
```

两种方式注册后无任何区别，`spawn('goblin')` 不关心来源。

---

## 7. System 定义

### 7.1 函数式（推荐，多数场景）

```ts
function movementSystem(world: World, dt: number): void {
  world.query(Transform, Velocity).each((t, v) => {
    t.x += v.vx * dt;
    t.y += v.vy * dt;
  });
}
```

### 7.2 对象式（需要内部状态时）

```ts
class HitDetectionSystem {
  readonly name = 'HitDetection';

  update(world: World, dt: number): void {
    for (const eid of world.query(Hitbox, Transform)) {
      // ...碰撞检测逻辑
    }
  }
}
```

### 7.3 注册

```ts
world.addSystem(movementSystem);
world.addSystem(new HitDetectionSystem());
```

---

## 8. Plugin 系统

### 8.1 设计理念

核心只保留 ECS（World、Entity、Component、Query、Prefab、Event），渲染、音频、输入等外围能力全部通过插件注入。Plugin 就是一个接收 World 的函数，内部注册自己的 Component、System、Resource。

### 8.2 Plugin 定义

```ts
type Plugin = (world: World) => void;
```

### 8.3 单文件插件示例

```ts
// engine/src/plugins/input.ts

export class PlayerInput {
  moveX = 0;
  moveY = 0;
  attack = false;
  dash = false;
}

function keyboardSystem(world: World, dt: number) {
  // ...键盘读取逻辑
}

export function InputPlugin(world: World) {
  world.registerComponent(PlayerInput);
  world.addSystem(keyboardSystem);
}
```

```ts
// engine/src/plugins/audio.ts

export function AudioPlugin(world: World) {
  const ctx = new AudioContext();
  world.addResource('audio', ctx);
  world.addSystem(audioSystem);
}
```

### 8.4 目录插件示例（复杂场景）

```ts
// engine/src/plugins/render/plugin.ts

export function WebGPURenderPlugin(world: World) {
  const renderer = new WebGPURenderer(world);
  world.addResource('renderer', renderer);
  world.registerComponent(Sprite);
  world.registerComponent(Camera);
  world.addSystem(spriteRenderSystem);
  world.addSystem(tilemapRenderSystem);
}
```

### 8.5 游戏逻辑也可以是插件

```ts
// game/src/plugins/combat.ts

export function CombatPlugin(world: World) {
  world.registerComponent(Hitbox);
  world.registerComponent(DamageSource);
  world.addSystem(hitDetectionSystem);
  world.addSystem(damageSystem);
  world.addSystem(knockbackSystem);
}
```

### 8.6 注册

支持链式和批量两种写法：

```ts
// 链式（适合需要注释或分组）
const world = new World()
  .use(InputPlugin)
  .use(AudioPlugin)
  .use(WebGPURenderPlugin);

// 批量（适合简短列表）
const world = new World()
  .use(InputPlugin, AudioPlugin, WebGPURenderPlugin);
```

---

## 9. 目录结构

```
engine/src/
├── core/                       # ECS 核心（零依赖）
│   ├── world.ts
│   ├── entity.ts
│   ├── query.ts
│   ├── prefab.ts
│   ├── component.ts
│   ├── resource.ts
│   ├── event.ts
│   ├── types.ts
│   └── index.ts
│
├── plugins/                    # 官方插件
│   ├── input.ts                # InputPlugin（单文件）
│   ├── audio.ts                # AudioPlugin（单文件）
│   ├── physics.ts              # PhysicsPlugin（单文件）
│   ├── tilemap.ts              # TilemapPlugin（单文件）
│   └── render/                 # WebGPURenderPlugin（复杂，用目录）
│       ├── plugin.ts
│       ├── renderer.ts
│       ├── sprite-system.ts
│       └── index.ts
│
└── index.ts                    # 引擎总入口
```

**规则：一个文件能装下就是单文件，装不下再升级成目录。** 单文件和目录对外 import 体验一致，后续拆分不影响使用方。

---

## 10. 完整使用示例

```ts
import { World } from './engine/core';
import { InputPlugin } from './engine/plugins/input';
import { AudioPlugin } from './engine/plugins/audio';
import { WebGPURenderPlugin } from './engine/plugins/render';
import { CombatPlugin } from './game/plugins/combat';
import { GoblinPrefab } from './game/prefabs/goblin';
import { Transform, Stats, Sprite, PlayerTag } from './engine/core';

// 1. 创建世界 + 注册插件
const world = new World()
  .use(InputPlugin)
  .use(AudioPlugin)
  .use(WebGPURenderPlugin)
  .use(CombatPlugin);

// 2. 注册 Prefab
world.registerPrefab(GoblinPrefab);

// 3. 创建玩家
const player = world.spawn({
  Transform: { x: 160, y: 120 },
  Velocity: {},
  Stats: { hp: 100, moveSpeed: 140 },
  Sprite: { atlas: 'player', frame: 'idle_down_0' },
  PlayerTag: {},
});

// 4. 从 Prefab 创建敌人
const goblin = world.spawn('goblin', {
  Transform: { x: 300, y: 200 },
});

// 5. 运行时动态操作
player.add(Knockback, { force: 100, dirX: -1, dirY: 0, decay: 500 });
player.get(Transform).x += 10;

// 6. 事件监听
world.on('HitEvent', (e) => {
  const target = world.ref(e.target);
  target.add(HitStun, { remaining: 0.2 });
});

// 7. 游戏循环
let last = performance.now();
function tick(now: number) {
  const dt = Math.min((now - last) / 1000, 0.05);
  last = now;
  world.update(dt);
  requestAnimationFrame(tick);
}
requestAnimationFrame(tick);
```

---

## 11. API 速查

| 操作 | API | Key 类型 |
|---|---|---|
| 空实体 | `world.spawn()` | — |
| 声明式创建 | `world.spawn({ Transform: {...} })` | 字符串（ComponentMap 类型守护） |
| Prefab 创建 | `world.spawn('goblin', overrides?)` | 字符串 |
| 添加组件 | `entity.add(Cls, data?)` | Class 引用 |
| 移除组件 | `entity.remove(Cls)` | Class 引用 |
| 读取组件 | `entity.get(Cls)` → `T` | Class 引用 |
| 判断组件 | `entity.has(Cls)` → `boolean` | Class 引用 |
| 销毁实体 | `entity.destroy()` | — |
| EID → Entity | `world.ref(eid)` | 数字 → Entity |
| 查询 | `world.query(A, B)` | Class 引用 |
| 遍历 | `.each((a, b, entity) => {})` | 自动推断 |
| 注册预制体 | `world.registerPrefab(prefab)` | — |
| 注册插件 | `world.use(plugin)` / `world.use(a, b, c)` | — |
| 添加资源 | `world.addResource(key, value)` | 字符串 |
| 获取资源 | `world.getResource<T>(key)` | 字符串 |
| 注册系统 | `world.addSystem(system)` | — |
| 发事件 | `world.emit(name, data)` | 字符串 |
| 监听事件 | `world.on(name, handler)` | 字符串 |

---

## 12. 设计决策记录

| 决策 | 选择 | 理由 |
|---|---|---|
| 创建 API 命名 | `spawn` 统一 | 一个词覆盖空/声明式/Prefab 三种场景 |
| 实体句柄命名 | `Entity` | 最直觉，使用者心智模型里它就是实体 |
| 句柄设计 | 胖句柄（ID + private World） | 单 World 小引擎，API 体验优先于极致纯粹 |
| 预制体命名 | `Prefab` | 简洁，ECS 上下文无歧义 |
| 组件定义 | Class + JSDoc | 编辑器 Schema 唯一真相源，零运行时开销 |
| 组件操作 key | spawn 用字符串，add/get/remove 用 Class 引用 | 创建走声明式（匹配 JSON），操作走类型安全 |
| System 注册 | 手动显式 `addSystem` | 小引擎，简单直接，执行顺序一目了然 |
| 组件类型安全 | ComponentMap declaration merging | 零运行时开销，纯编译时检查 |
| 插件设计 | `Plugin = (world) => void` + `world.use()` | 最薄抽象，ECS 天然支持，无需依赖图/版本号/生命周期钩子 |
| 插件注册 API | `.use()` 链式 + rest 参数批量 | JS/TS 生态事实标准（Express/Vue/Koa/Hono），支持链式和批量 |
| 全局资源 | `world.addResource(key, value)` | 插件需要注册非 Entity 的共享对象（renderer、audio context） |
| 目录结构 | 单文件为主，复杂插件用目录 | 一个文件能装下就是单文件，装不下再升级成目录 |
