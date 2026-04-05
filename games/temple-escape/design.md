## Temple Escape 2D — 游戏设计规划

> 基于 mote 引擎 + 编辑器的验证性游戏项目

---

### 一、游戏概述

**类型**：2D 俯视角无尽跑酷
**视角**：俯视（Top-down），玩家始终向"前方"奔跑，摄像机跟随并旋转
**核心循环**：自动前进 → 躲避陷阱 → 岔路转弯 → 追兵逼近 → 速度递增 → 直到被抓或撞死

**与 Temple Run 的对应关系：**

| Temple Run 3D | 本项目 2D 映射 |
|---|---|
| 三条跑道，左右滑动换道 | 3-lane 走廊，A/D 或 ←/→ 切换车道 |
| 路口左/右转弯 | 岔路口，按方向键在正确时机转弯 |
| 前方障碍物（树桩/火焰/断桥） | 石柱、地刺、喷火机关、塌陷地板 |
| 背后怪物追赶 | 石像鬼追兵，被击中则追兵拉近 |
| 金币收集 | 神庙宝石，增加分数 |
| 无限关卡 | 关卡块(Chunk)无限拼接 |

---

### 二、与 mote 引擎的映射

这是本项目的核心价值——验证 mote 的 5 层数据模型能否支撑一个完整游戏：

```
Image (PNG)
  └─ SpriteSheet (.sprite.json)     ← 所有美术资源
       └─ Frame                      ← 每帧带碰撞体 + tags
            └─ EntityDef (.entity.json)  ← 玩家/追兵/陷阱模板
                 └─ Scene (.map.json)    ← 关卡块 (Chunk)
                      └─ Script (.ts)    ← 游戏逻辑
```

| mote 概念 | 游戏中的角色 |
|---|---|
| **SpriteSheet** (grid slicing) | 地板/墙壁瓦片、陷阱动画帧 |
| **SpriteSheet** (packed slicing) | 玩家/追兵角色精灵 |
| **EntityDef** + Script | 玩家、追兵、各种陷阱、宝石、转弯标记 |
| **Scene** (TileLayer) | 每个关卡块的地形（3-lane 走廊 + 墙壁） |
| **Scene** (EntityLayer) | 每个关卡块中放置的陷阱和道具实例 |
| **ColliderShape** | 墙壁(full)、石柱(rect)、地刺(polygon)、火圈(circle) |
| **project.mote.json** | 项目清单，列出所有 Chunk 场景 |
| **GameLoop** | 60Hz 固定步长驱动 |
| **Camera2D** | 跟随玩家 + 旋转（转弯时摄像机同步旋转） |
| **InputManager + ActionMap** | 移动(WASD/方向键)、跳跃(空格)、滑铲(Shift) |
| **SpriteBatch** | 所有渲染，10K quads/frame 绰绰有余 |
| **CollisionSystem** | 玩家 vs 陷阱/墙壁/宝石/追兵 |
| **ScriptRuntime** | 陷阱逻辑、追兵 AI、宝石收集 |

---

### 三、关卡块 (Chunk) 系统设计

这是游戏的核心机制，也是验证 mote 编辑器最重要的部分。

**每个 Chunk = 一个 mote Scene 文件**

```
┌─────────────────────────┐
│  wall  wall  wall  wall │  ← TileLayer: 墙壁
│  wall  lane  lane  lane │
│  wall  lane [spike]lane │  ← EntityLayer: 陷阱放在 lane 上
│  wall  lane  lane  lane │
│  wall  lane  lane [gem]│
│  wall  lane  lane  lane │
│  wall  lane [fire] lane │
│  wall  lane  lane  lane │
│  wall  wall  wall  wall │
└─────────────────────────┘
     ↓ exit_marker 实体
     (fields: exits = "left,right")
```

**Chunk 约定：**

| 属性 | 说明 |
|---|---|
| 尺寸 | 宽 5 tiles (1墙+3道+1墙) × 长 N tiles (8/12/16 三种规格) |
| TileLayer "ground" | 地板和墙壁瓦片 |
| TileLayer "decoration" | 装饰物（地砖花纹、裂缝等） |
| EntityLayer "gameplay" | 陷阱、宝石、转弯标记等游戏实体 |
| exit_marker 实体 | 放在末端，`fields.exits` 指定可转方向 |

**Chunk 拼接逻辑（运行时）：**

```
ChunkA (方向=UP) ──→ exit(left,right) ──→ 玩家按←
                                              ↓
                                  ChunkB (方向=LEFT) 旋转90°拼接
                                              ↓
                                  ChunkC ──→ ...
```

1. 当前 Chunk 的 `exit_marker` 指定可转方向
2. 玩家到达出口区域时，必须按对应方向键转弯
3. 下一个 Chunk 从 Chunk 池中随机抽取，旋转后拼接在出口位置
4. 离玩家 2 个 Chunk 以上的旧 Chunk 被卸载

**Chunk 难度分级：**

| 难度 | 障碍物密度 | 宝石量 | 出现时机 |
|---|---|---|---|
| ★☆☆ Easy | 1-2 个障碍 | 多 | 距离 0-500m |
| ★★☆ Medium | 3-4 个障碍 | 中 | 距离 300-1500m |
| ★★★ Hard | 5-6 个 + 组合陷阱 | 少 | 距离 1000m+ |

---

### 四、实体定义 (EntityDef)

#### 4.1 玩家

```json
{
  "id": "player",
  "name": "Explorer",
  "sprite": "characters:explorer_run_0",
  "shape": "rect",
  "width": 14, "height": 14,
  "collider": [{ "type": "rect", "x": 1, "y": 1, "w": 12, "h": 12 }],
  "script": "scripts/player.ts",
  "fields": [
    { "id": "health", "type": "number", "default": 3 },
    { "id": "speed", "type": "number", "default": 80 }
  ]
}
```

#### 4.2 追兵

```json
{
  "id": "chaser",
  "name": "Stone Guardian",
  "sprite": "characters:guardian_0",
  "shape": "rect",
  "width": 18, "height": 18,
  "collider": [{ "type": "circle", "cx": 9, "cy": 9, "r": 8 }],
  "script": "scripts/chaser.ts",
  "fields": [
    { "id": "baseSpeed", "type": "number", "default": 70 },
    { "id": "catchDistance", "type": "number", "default": 8 }
  ]
}
```

#### 4.3 陷阱类型

| ID | 名称 | 碰撞体 | 行为 |
|---|---|---|---|
| `spike_trap` | 地刺 | polygon (三角) | 周期性升降，触碰扣血 + 减速 |
| `fire_trap` | 喷火机关 | rect (喷射范围) | 周期性喷火，触碰扣血 |
| `collapse_floor` | 塌陷地板 | full (整格) | 玩家经过后延迟塌陷，再过为深渊 |
| `stone_pillar` | 石柱 | rect | 静态障碍，撞上减速+追兵拉近 |
| `swinging_blade` | 摆锤 | circle | 来回摆动，时机通过 |

#### 4.4 道具 & 标记

| ID | 名称 | 行为 |
|---|---|---|
| `gem` | 宝石 | 收集加分 |
| `gem_line` | 宝石线 | 一排宝石引导最佳路线 |
| `speed_boost` | 加速道具 | 短暂无敌 + 加速冲刺 |
| `exit_marker` | 出口标记 | 标记 Chunk 末端，fields.exits 指定转向 |
| `turn_arrow` | 转弯提示 | 视觉提示，告诉玩家可以转弯 |

---

### 五、脚本系统设计

#### 5.1 核心脚本

| 脚本 | 职责 |
|---|---|
| `scripts/game_manager.ts` | 全局管理：Chunk 加载/卸载、分数、难度递增、游戏状态 |
| `scripts/player.ts` | 玩家移动：自动前进、3-lane 切换、转弯、受击反馈 |
| `scripts/chaser.ts` | 追兵 AI：沿路径追踪、玩家受击时加速、追上触发 Game Over |
| `scripts/spike_trap.ts` | 地刺：周期升降 + 碰撞伤害 |
| `scripts/fire_trap.ts` | 喷火：周期喷射 + 范围伤害 |
| `scripts/collapse_floor.ts` | 塌陷：踩上后延迟消失 |
| `scripts/gem.ts` | 宝石：碰撞收集 + 粒子效果 |

#### 5.2 玩家脚本伪代码

```typescript
export default class PlayerScript {
  private lane = 1; // 0=左, 1=中, 2=右
  private targetLane = 1;
  private speed: number;
  private direction = 0; // 0=上, 1=右, 2=下, 3=左
  
  update(dt: number) {
    // 1. 自动前进
    this.entity.y -= this.speed * dt;
    
    // 2. 读取输入：左右切换车道
    if (input.action('MoveLeft').pressed) this.targetLane = max(0, this.lane - 1);
    if (input.action('MoveRight').pressed) this.targetLane = min(2, this.lane + 1);
    
    // 3. 平滑移动到目标车道
    this.entity.x = lerp(this.entity.x, laneX[this.targetLane], 10 * dt);
    
    // 4. 检测是否到达出口区域 → 等待转弯输入
    if (nearExit()) this.handleTurn();
    
    // 5. 速度随时间递增
    this.speed += 0.5 * dt;
  }
  
  onCollisionEnter(other: Entity) {
    if (other.templateId === 'gem') { score += 10; other.destroy(); }
    if (other.hasTag('hazard')) { health--; chaser.speedBoost(); }
    if (other.templateId === 'chaser') { gameOver(); }
  }
}
```

#### 5.3 追兵脚本伪代码

```typescript
export default class ChaserScript {
  private distanceBehind = 200; // 像素距离
  
  update(dt: number) {
    // 跟随玩家路径，保持 distanceBehind 的距离
    // 距离越近，画面边缘越红（紧迫感）
    this.distanceBehind -= (this.speed - player.speed) * dt;
    
    if (this.distanceBehind <= this.catchDistance) {
      gameOver();
    }
  }
  
  // 玩家受击时调用
  speedBoost() {
    this.distanceBehind -= 30; // 追兵拉近 30px
  }
}
```

---

### 六、视觉设计

**色调**：暗色神庙风格，石质灰 + 金色点缀 + 红色危险

| 元素 | 配色 |
|---|---|
| 地板 | 深灰石砖 `#3a3a4a` / `#4a4a5a` 交替 |
| 墙壁 | 更深灰 `#2a2a3a`，边缘高光 |
| 玩家 | 金色/琥珀色 `#FFD700` |
| 追兵 | 暗红 `#881111`，发光眼睛 |
| 地刺 | 银色 `#C0C0C0` |
| 火焰 | 橙红 `#FF4500` |
| 宝石 | 翡翠绿 `#50C878` / 宝蓝 `#4169E1` |
| 背景 | 深黑 `#0a0a12` |

**摄像机行为：**
- 正常：跟随玩家，前方 60% 可视
- 转弯时：平滑旋转 90°，持续 0.3s
- 受击时：Camera2D.shake(3, 0.2)
- 追兵逼近时：画面边缘红色渐变警告

---

### 七、项目文件结构

```
temple-escape/
├── project.mote.json              ← 项目清单
├── sheets/
│   ├── temple-tiles.sprite.json   ← 地形瓦片 (grid 16×16)
│   ├── characters.sprite.json     ← 玩家+追兵精灵 (packed)
│   ├── traps.sprite.json          ← 陷阱动画帧 (packed)
│   └── ui.sprite.json             ← UI元素 (packed)
├── entities/
│   ├── player.entity.json
│   ├── chaser.entity.json
│   ├── spike-trap.entity.json
│   ├── fire-trap.entity.json
│   ├── collapse-floor.entity.json
│   ├── stone-pillar.entity.json
│   ├── gem.entity.json
│   ├── speed-boost.entity.json
│   └── exit-marker.entity.json
├── scenes/                        ← 关卡块 (用编辑器制作)
│   ├── chunk-straight-easy-01.map.json
│   ├── chunk-straight-easy-02.map.json
│   ├── chunk-straight-medium-01.map.json
│   ├── chunk-turn-left-01.map.json
│   ├── chunk-turn-right-01.map.json
│   ├── chunk-turn-both-01.map.json
│   └── chunk-hard-gauntlet-01.map.json
├── scripts/
│   ├── game-manager.ts
│   ├── player.ts
│   ├── chaser.ts
│   ├── spike-trap.ts
│   ├── fire-trap.ts
│   ├── collapse-floor.ts
│   ├── gem.ts
│   └── chunk-loader.ts
└── images/
    ├── temple-tiles.png
    ├── characters.png
    ├── traps.png
    └── ui.png
```

---

### 八、开发计划

| 阶段 | 内容 | 验证点 |
|---|---|---|
| **Step 1** | 创建所有资源文件 (SpriteSheet JSON + EntityDef JSON) | 验证 mote 数据格式完整性 |
| **Step 2** | 用编辑器制作 3-5 个基础 Chunk 场景 | 验证编辑器 TileLayer + EntityLayer 工作流 |
| **Step 3** | 实现 game-manager.ts + player.ts | 验证 ScriptRuntime + GameLoop + Input + Camera |
| **Step 4** | 实现 Chunk 拼接加载系统 | 验证 ProjectLoader + SceneManager 多场景切换 |
| **Step 5** | 实现碰撞 + 陷阱脚本 | 验证 CollisionSystem + ColliderShape 继承 |
| **Step 6** | 实现追兵 AI | 验证 Entity 系统 + 脚本间通信 |
| **Step 7** | UI + 打磨 + 难度曲线 | 验证 SpriteBatch 渲染性能 |

---

### 九、对 mote 引擎的验证清单

本游戏将验证以下引擎/编辑器能力：

| # | 能力 | 验证方式 |
|---|---|---|
| 1 | SpriteSheet grid slicing | 地形瓦片加载 |
| 2 | SpriteSheet packed slicing | 角色精灵加载 |
| 3 | Frame 碰撞体 (5种形状) | 各类陷阱的不同碰撞形状 |
| 4 | EntityDef + Fields | 玩家血量、追兵速度等可配置参数 |
| 5 | EntityInstance 字段覆盖 | 同一陷阱不同实例的参数差异 |
| 6 | Scene TileLayer (names编码) | 地形绘制 |
| 7 | Scene EntityLayer | 陷阱/道具放置 |
| 8 | ScriptRuntime 生命周期 | update + onCollisionEnter + onDestroy |
| 9 | 多 Scene 加载/卸载 | Chunk 动态拼接 |
| 10 | Camera2D 旋转 + 跟随 + 震屏 | 转弯旋转 + 受击震动 |
| 11 | CollisionSystem (AABB + SAT) | 玩家 vs 各种碰撞体 |
| 12 | SpriteBatch 批量渲染 | 大量瓦片 + 实体同屏 |
| 13 | InputManager ActionMap | 键盘操作映射 |
| 14 | 编辑器关卡设计工作流 | 用编辑器直接制作 Chunk |

---

以上就是完整的游戏设计规划。方案的核心思路是**把每个关卡块 (Chunk) 做成一个 mote Scene**，用编辑器可视化制作，运行时动态拼接实现无限关卡。这样既验证了编辑器的关卡设计能力，也验证了引擎的多场景管理、碰撞、脚本等核心系统。

你看这个方案是否可以？有没有需要调整的地方？确认后我开始开发。