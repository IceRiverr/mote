
# Part 2: 技术规格 (Tech Spec)

## 1. 架构概述

### 1.1 混合架构

与前作（Magic Tower、Temple Escape、Road Rash）一致，采用 **真实 mote 引擎 API + 哑 GPU 对象 + Canvas2D 渲染** 的混合方案。

| 层级 | 方案 |
|---|---|
| **数据驱动** | mote 引擎的 ProjectRuntime / SceneManager / Entity / Field 系统 |
| **脚本生命周期** | mote ScriptRuntime + ScriptLifecycle (update/onCollisionEnter/onDestroy) |
| **输入系统** | mote InputManager + ActionMap (鼠标为主 + 键盘快捷键) |
| **碰撞检测** | mote CollisionSystem (AABB + SAT) |
| **音频** | mote AudioManager + MusicPlayer |
| **渲染** | Canvas2D (HTMLImageElement sprites) + 自定义 Camera/Renderer |
| **GPU** | 哑对象 (DummyDevice / DummyTexture) 满足 ProjectLoader 接口 |

### 1.2 与前作差异对比

| 维度 | Road Rash | 城战 (Siege War) |
|---|---|---|
| **视角** | 垂直滚动 | 水平侧视 |
| **相机** | 跟随玩家(纵向) | 自由平移+缩放(横向) |
| **地图层数** | 1 Tile层 + 1 Entity层 | 3+ Tile层 (地下/地面/墙体/天空) + 多 Entity层 |
| **输入焦点** | 实时操控(方向/攻击) | 指令式(选择→命令→目标) |
| **Entity 数量** | ~50 (车辆+道具) | ~200+ (士兵+器械+投射物+特效) |
| **脚本复杂度** | 中等(单一行为) | 高(状态机+AI+寻路+指令队列) |
| **数据结构** | 扁平(.track.json) | 分层(关卡JSON+单位模板+战役进度) |

### 1.3 架构流程图

```
GameLoop (60Hz)
  │
  ├── onUpdate(dt)
  │     ├── InputManager.update()
  │     ├── CommandSystem.processQueue(dt)        // 传令延迟处理
  │     ├── AISystem.updateAll(dt)                // 士兵自律AI
  │     ├── PathfindingSystem.updateAll(dt)       // 单位寻路
  │     ├── ProjectileSystem.updateAll(dt)        // 投射物弹道
  │     ├── TunnelSystem.update(dt)               // 地道挖掘进度
  │     ├── ListeningPotSystem.update(dt)         // 听瓮信号计算
  │     ├── PhaseManager.check(dt)                // 阶段推进
  │     ├── MoraleSystem.update(dt)               // 士气计算
  │     ├── ScriptRuntime.updateAll(dt)           // 全脚本 update
  │     ├── CollisionSystem.broadPhase+resolve()  // 碰撞检测
  │     └── Camera.update(dt)                     // 相机更新
  │
  └── onRender(alpha)
        ├── Canvas.clear()
        ├── renderUndergroundLayer(alpha)          // 地下层(条件可见)
        ├── renderGroundLayer(alpha)               // 地面 Tile 层
        ├── renderWallLayer(alpha)                 // 城墙 Tile 层
        ├── renderEntities(alpha)                  // 所有 Entity (Y-sort)
        ├── renderProjectiles(alpha)               // 投射物(抛物线)
        ├── renderEffects(alpha)                   // 火焰/烟雾/爆炸
        ├── renderFogOfWar(alpha)                  // 战争迷雾(可选)
        └── renderUI(alpha)                        // HUD 叠加
```

---

## 2. 引擎系统使用

### 2.1 GameLoop

```typescript
import { GameLoop } from '@mote/engine';

const loop = new GameLoop(60); // 60Hz 固定步进

loop.onUpdate = (dt: number) => {
  inputManager.update();
  commandSystem.processQueue(dt);
  aiSystem.updateAll(dt);
  projectileSystem.updateAll(dt);
  tunnelSystem.update(dt);
  listeningPotSystem.update(dt);
  phaseManager.check(dt);
  moraleSystem.update(dt);
  scriptRuntime.updateAll(dt);
  collisionSystem.resolveAll();
  camera.update(dt);
  inputManager.endFrame();
};

loop.onRender = (alpha: number) => {
  renderer.beginFrame(camera);
  renderer.renderTileLayers(sceneRuntime, camera, viewMode);
  renderer.renderEntities(entityManager.getVisible(camera), alpha);
  renderer.renderProjectiles(projectileSystem.getActive(), alpha);
  renderer.renderEffects(effectSystem.getActive(), alpha);
  renderer.renderHUD(gameState, uiState);
  renderer.endFrame();
};

loop.start();
```

### 2.2 InputManager + ActionMap

城战以鼠标指令为主，键盘快捷键辅助：

```typescript
import { InputManager, ActionMap, ActionType } from '@mote/engine';

const inputManager = new InputManager(canvas, { preventDefault: true });

// 战斗输入映射
const battleMap = new ActionMap('battle', {
  // 鼠标操作
  select:      { type: ActionType.Button, bindings: ['Mouse0'] },        // 左键选择
  contextMenu: { type: ActionType.Button, bindings: ['Mouse2'] },        // 右键上下文菜单
  panCamera:   { type: ActionType.Button, bindings: ['Mouse1'] },        // 中键拖拽平移

  // 快捷键 - 城墙段选择
  wallSeg1:    { type: ActionType.Button, bindings: ['Digit1'] },
  wallSeg2:    { type: ActionType.Button, bindings: ['Digit2'] },
  wallSeg3:    { type: ActionType.Button, bindings: ['Digit3'] },
  wallSeg4:    { type: ActionType.Button, bindings: ['Digit4'] },
  wallSeg5:    { type: ActionType.Button, bindings: ['Digit5'] },
  wallSeg6:    { type: ActionType.Button, bindings: ['Digit6'] },
  wallSeg7:    { type: ActionType.Button, bindings: ['Digit7'] },

  // 快捷键 - 全局指令
  gong:        { type: ActionType.Button, bindings: ['KeyG'] },          // 鸣金
  drum:        { type: ActionType.Button, bindings: ['KeyD'] },          // 擂鼓
  pause:       { type: ActionType.Button, bindings: ['Space'] },         // 暂停
  speedUp:     { type: ActionType.Button, bindings: ['Period'] },        // 加速
  speedDown:   { type: ActionType.Button, bindings: ['Comma'] },         // 减速

  // 快捷键 - 视图
  viewGround:     { type: ActionType.Button, bindings: ['F1'] },
  viewUnderground: { type: ActionType.Button, bindings: ['F2'] },
  viewOverlay:    { type: ActionType.Button, bindings: ['F3'] },

  // 相机控制
  cameraMove: { type: ActionType.Axis2D, composites: [{
    up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD'
  }]},
  zoom: { type: ActionType.Axis1D, axis1d: { positive: 'Equal', negative: 'Minus' } },

  // ESC 取消
  cancel:      { type: ActionType.Button, bindings: ['Escape'] },
}, inputManager);

inputManager.addMap(battleMap);
```

### 2.3 SceneManager + Entity (多层 Scene)

```typescript
import { SceneManager, Entity } from '@mote/engine';

// 城战场景包含多个 TileLayer + 多个 EntityLayer
const scene = sceneManager.loadScene('level-07-hefei');
// scene.layers:
//   [0] TileLayer "underground"  — 地下 tile 层
//   [1] TileLayer "ground"       — 地面 tile 层
//   [2] TileLayer "wall"         — 城墙 tile 层
//   [3] EntityLayer "units"      — 士兵/器械实体
//   [4] EntityLayer "projectiles" — 投射物实体
//   [5] EntityLayer "effects"    — 视觉特效实体

// Entity field 系统驱动游戏数据
const wallSegment: Entity = /* from scene */;
wallSegment.getField<number>('hp');           // 当前 HP
wallSegment.getField<number>('maxHp');        // 最大 HP
wallSegment.getField<string>('segmentType');  // 'normal' | 'bastion' | 'gate'
wallSegment.getField<boolean>('breached');    // 是否已破
wallSegment.setField('hp', 85);
wallSegment.setFrame('wall_damaged_2');       // 切换受损贴图

const soldier: Entity = /* spawned */;
soldier.getField<string>('unitId');           // 所属单位 ID
soldier.getField<string>('state');            // 'idle' | 'moving' | 'firing' | 'melee' | 'routing'
soldier.getField<number>('morale');           // 个体士气
soldier.getField<string>('currentCommand');   // 当前执行的命令
```

### 2.4 ScriptRuntime + ScriptLifecycle

```typescript
// scripts/soldier-ai.ts — 士兵自律 AI 脚本
import type { Entity } from '@mote/engine';

interface ScriptLifecycle {
  update?(dt: number): void;
  onCollisionEnter?(other: Entity): void;
  onCollisionExit?(other: Entity): void;
  onDestroy?(): void;
}

export default class SoldierAIScript implements ScriptLifecycle {
  private entity: Entity;
  private engine: SiegeWarContext; // 游戏上下文

  constructor(entity: Entity, engine: unknown) {
    this.entity = entity;
    this.engine = engine as SiegeWarContext;
  }

  update(dt: number): void {
    const state = this.entity.getField<string>('state');
    const morale = this.entity.getField<number>('morale');

    // 自律行为优先级
    if (morale <= 20) {
      this.panic();                    // 恐慌溃散
    } else if (this.isUnderFire()) {
      this.seekCover();                // 寻找掩体
    } else if (this.enemyOnWall()) {
      this.meleeCounter();             // 近战反击
    } else if (this.incomingProjectile()) {
      this.dodge();                    // 躲避落石
    } else if (this.nearbyFire()) {
      this.extinguishFire();           // 灭火
    } else {
      this.executeCommand(dt);         // 执行指令
    }
  }

  onCollisionEnter(other: Entity): void {
    const otherType = other.getField<string>('entityType');
    if (otherType === 'projectile' || otherType === 'enemy_soldier') {
      // 处理碰撞伤害
    }
  }

  // ... 各自律行为实现 ...
}
```

### 2.5 CollisionSystem

```typescript
import { CollisionSystem, type AABB } from '@mote/engine';

// 碰撞组定义
enum CollisionGroup {
  DefenderUnit    = 0b0001,
  AttackerUnit    = 0b0010,
  Projectile      = 0b0100,
  Structure       = 0b1000,
}

// 碰撞矩阵
const COLLISION_MATRIX: Record<number, number> = {
  [CollisionGroup.DefenderUnit]:  CollisionGroup.AttackerUnit | CollisionGroup.Projectile,
  [CollisionGroup.AttackerUnit]:  CollisionGroup.DefenderUnit | CollisionGroup.Projectile | CollisionGroup.Structure,
  [CollisionGroup.Projectile]:    CollisionGroup.DefenderUnit | CollisionGroup.AttackerUnit | CollisionGroup.Structure,
};

// 每帧碰撞检测
function resolveCollisions(entities: Entity[]): void {
  const boxes = entities.map(e => ({
    id: e.id,
    aabb: e.getBounds() as AABB,
  }));

  const pairs = CollisionSystem.broadPhase(boxes);

  for (const [idA, idB] of pairs) {
    const a = entityMap.get(idA)!;
    const b = entityMap.get(idB)!;
    const groupA = a.getField<number>('collisionGroup');
    const groupB = b.getField<number>('collisionGroup');

    if (!(COLLISION_MATRIX[groupA] & groupB)) continue;

    const result = CollisionSystem.testAABB(
      a.getBounds() as AABB,
      b.getBounds() as AABB
    );

    if (result.collided) {
      scriptRuntime.notifyCollisionEnter(idA, b);
      scriptRuntime.notifyCollisionEnter(idB, a);
    }
  }
}
```

### 2.6 Camera2D (自由平移 + 缩放)

```typescript
import { Camera2D, Vec2 } from '@mote/engine';

const camera = new Camera2D(1280, 720);
camera.pixelSnap = true;

// 城战相机：自由平移(不跟随玩家)，支持缩放
class BattlefieldCamera {
  camera: Camera2D;
  minZoom = 0.5;
  maxZoom = 2.0;
  // 战场边界 (根据关卡地图大小)
  bounds: { left: number; right: number; top: number; bottom: number };

  panTo(worldX: number, worldY: number, lerpFactor = 0.1): void {
    this.camera.follow(Vec2.from(worldX, worldY), lerpFactor);
  }

  zoomBy(delta: number): void {
    this.camera.zoom = Math.max(this.minZoom,
      Math.min(this.maxZoom, this.camera.zoom + delta));
  }

  // 鼠标拖拽平移
  handleDrag(dx: number, dy: number): void {
    const scale = 1 / this.camera.zoom;
    this.camera.position.x -= dx * scale;
    this.camera.position.y -= dy * scale;
    this.clampToBounds();
  }

  // 点击选中：屏幕坐标 → 世界坐标
  screenToWorld(sx: number, sy: number): Vec2 {
    return this.camera.screenToWorld(sx, sy);
  }

  // 震动效果(墙体坍塌/投石命中)
  shakeOnImpact(intensity: number): void {
    this.camera.shake(intensity, 0.3);
  }
}
```

### 2.7 AudioManager

```typescript
import { AudioManager } from '@mote/engine';

const audio = new AudioManager();

// 音效预加载
await audio.loadBatch([
  // 环境音
  { key: 'bgm_tension',     formats: ['ogg','mp3'], path: 'audio/bgm/' },
  { key: 'bgm_assault',     formats: ['ogg','mp3'], path: 'audio/bgm/' },
  // 指令音效
  { key: 'sfx_acknowledge',  formats: ['ogg','mp3'], path: 'audio/sfx/' }, // "得令！"
  { key: 'sfx_comply',       formats: ['ogg','mp3'], path: 'audio/sfx/' }, // "遵命！"
  { key: 'sfx_gong',         formats: ['ogg','mp3'], path: 'audio/sfx/' }, // 鸣金
  { key: 'sfx_drum',         formats: ['ogg','mp3'], path: 'audio/sfx/' }, // 擂鼓
  // 战斗音效
  { key: 'sfx_arrow_volley', formats: ['ogg','mp3'], path: 'audio/sfx/' },
  { key: 'sfx_trebuchet',    formats: ['ogg','mp3'], path: 'audio/sfx/' },
  { key: 'sfx_wall_hit',     formats: ['ogg','mp3'], path: 'audio/sfx/' },
  { key: 'sfx_wall_collapse',formats: ['ogg','mp3'], path: 'audio/sfx/' },
  { key: 'sfx_oil_pour',     formats: ['ogg','mp3'], path: 'audio/sfx/' },
  { key: 'sfx_fire_burn',    formats: ['ogg','mp3'], path: 'audio/sfx/' },
  { key: 'sfx_melee_clash',  formats: ['ogg','mp3'], path: 'audio/sfx/' },
  // 地道音效
  { key: 'sfx_digging',      formats: ['ogg','mp3'], path: 'audio/sfx/' },
  { key: 'sfx_listening',    formats: ['ogg','mp3'], path: 'audio/sfx/' },
  { key: 'sfx_tunnel_flood', formats: ['ogg','mp3'], path: 'audio/sfx/' },
]);

// 阶段切换 BGM crossfade
audio.music.play('bgm_assault', 2.0); // 2秒渐变

// 空间音效 (投石机命中)
import { worldToPan, distanceVolume } from '@mote/engine';
const pan = worldToPan(impactX, camera.position.x, 640);
const vol = distanceVolume(impactX, impactY,
  camera.position.x, camera.position.y, 800);
audio.play('sfx_trebuchet', { pan, volume: vol });
```

---

## 3. 自定义扩展

### 3.1 SiegeWarContext (游戏上下文)

```typescript
// src/engine-context.ts
import type { SceneRuntime, Entity, AudioManager } from '@mote/engine';

export class SiegeWarContext {
  // 引擎引用
  scene: SceneRuntime;
  audio: AudioManager;
  camera: BattlefieldCamera;

  // 游戏系统
  commandSystem: CommandSystem;
  aiSystem: AISystem;
  projectileSystem: ProjectileSystem;
  tunnelSystem: TunnelSystem;
  listeningPotSystem: ListeningPotSystem;
  phaseManager: PhaseManager;
  moraleSystem: MoraleSystem;
  resourceManager: ResourceManager;

  // 实体管理
  entityManager: EntityManager;     // 所有活跃 Entity
  unitRegistry: UnitRegistry;       // 单位注册表(花名册)
  wallSegments: WallSegment[];      // 城墙段

  // UI 状态
  uiState: UIState;
  selectedEntity: Entity | null;
  selectionMode: 'normal' | 'target'; // 普通 vs 目标选择模式

  // 关卡数据
  levelConfig: LevelConfig;
  campaignProgress: CampaignProgress;

  // 工具方法
  getUnitAtPosition(worldX: number, worldY: number): Entity | null;
  getWallSegmentAt(worldX: number, worldY: number): WallSegment | null;
  issueCommand(command: Command): void;
  switchViewMode(mode: ViewMode): void;
}
```

### 3.2 Canvas2DRenderer (多层渲染器)

```typescript
// src/canvas-renderer.ts
export class SiegeRenderer {
  private ctx: CanvasRenderingContext2D;
  private camera: BattlefieldCamera;

  // 多层渲染入口
  renderFrame(scene: SceneRuntime, state: RenderState): void {
    this.ctx.clearRect(0, 0, 1280, 720);

    // 根据视图模式决定渲染层级
    switch (state.viewMode) {
      case 'ground':
        this.renderGroundTiles(scene);
        this.renderWallTiles(scene);
        this.renderEntities(state.entities);
        break;

      case 'underground':
        this.renderUndergroundTiles(scene);
        this.renderGroundOverlay(scene, 0.3);  // 地面半透明叠加
        this.renderTunnelEntities(state.tunnelEntities);
        this.renderListeningPotSignals(state.potSignals);
        this.renderSuspiciousAreas(state.suspiciousAreas);
        break;

      case 'overlay':
        this.renderUndergroundTiles(scene, 0.5);
        this.renderGroundTiles(scene, 0.7);
        this.renderWallTiles(scene, 0.7);
        this.renderEntities(state.entities, 0.7);
        this.renderTunnelEntities(state.tunnelEntities, 0.8);
        break;
    }

    // 投射物(始终可见)
    this.renderProjectiles(state.projectiles);
    // 特效层(始终可见)
    this.renderEffects(state.effects);
    // HUD 覆盖(不受相机变换)
    this.renderHUD(state.uiState);
  }

  // Tile 层渲染 (带相机裁剪)
  renderGroundTiles(scene: SceneRuntime, alpha = 1.0): void {
    const layer = scene.layers[1]; // ground layer
    const { startCol, endCol, startRow, endRow } =
      this.camera.getVisibleTileRange(layer);

    this.ctx.globalAlpha = alpha;
    for (let r = startRow; r <= endRow; r++) {
      for (let c = startCol; c <= endCol; c++) {
        // ... 标准 tile 渲染逻辑
      }
    }
    this.ctx.globalAlpha = 1.0;
  }

  // 抛物线投射物渲染
  renderProjectiles(projectiles: Projectile[]): void {
    for (const p of projectiles) {
      const screen = this.camera.worldToScreen(p.x, p.y);
      // 绘制带旋转的投射物 sprite
      this.ctx.save();
      this.ctx.translate(screen.x, screen.y);
      this.ctx.rotate(p.angle);
      this.ctx.drawImage(p.sprite, -p.width/2, -p.height/2, p.width, p.height);
      this.ctx.restore();

      // 拖尾效果(火箭)
      if (p.type === 'fire_arrow') {
        this.renderTrail(p.trail);
      }
    }
  }

  // 城墙 HP 可视化
  renderWallHP(segment: WallSegment): void {
    const ratio = segment.hp / segment.maxHp;
    const screen = this.camera.worldToScreen(segment.x, segment.y - 10);

    // HP 条
    this.ctx.fillStyle = ratio > 0.6 ? '#4CAF50' :
                         ratio > 0.3 ? '#FF9800' : '#F44336';
    this.ctx.fillRect(screen.x, screen.y, segment.width * ratio, 4);
  }

  // 听瓮信号扇形渲染
  renderListeningPotSignals(signals: PotSignal[]): void {
    for (const sig of signals) {
      const screen = this.camera.worldToScreen(sig.potX, sig.potY);
      const r = sig.intensity * 60; // 强度 → 半径

      this.ctx.save();
      this.ctx.globalAlpha = 0.25;
      this.ctx.fillStyle = '#4FC3F7';
      this.ctx.beginPath();
      this.ctx.moveTo(screen.x, screen.y);
      this.ctx.arc(screen.x, screen.y, r,
        sig.direction - Math.PI/8, // 45度扇区 = ±22.5度
        sig.direction + Math.PI/8);
      this.ctx.closePath();
      this.ctx.fill();
      this.ctx.restore();
    }
  }
}
```

### 3.3 CommandSystem (传令系统)

```typescript
// src/command-system.ts
export interface Command {
  id: string;
  type: CommandType;
  issuedAt: number;           // 下达时间
  sourceUnit?: string;        // 下令单位 ID
  targetUnit?: string;        // 目标单位 ID
  targetSegment?: string;     // 目标城墙段 ID
  targetPosition?: Vec2;      // 目标位置
  params?: Record<string, unknown>;
}

export enum CommandType {
  // 守方
  Deploy, FocusedFire, FreeFire, Pour, PushLadder, CloseGate,
  Repair, Sortie, CounterTunnel, Reinforce, ScatterCaltrops,
  // 攻方
  Advance, Charge, SetLadder, RamGate, Volley, Bombard,
  FillMoat, DigTunnel, Feint, Retreat, BuildBridge,
  // 全局
  SoundGong, BeatDrum,
}

export class CommandSystem {
  private queue: CommandInTransit[] = [];
  private gameTime: number = 0;

  issueCommand(cmd: Command, gameState: GameState): void {
    // 全局命令(鸣金/擂鼓)无延迟
    if (cmd.type === CommandType.SoundGong || cmd.type === CommandType.BeatDrum) {
      this.executeImmediately(cmd, gameState);
      return;
    }

    // 计算传令延迟
    const distance = this.calcDistance(gameState.commanderPos, cmd.targetPosition!);
    const delay = this.calcDelay(distance, gameState.skills); // 2-5秒

    this.queue.push({
      command: cmd,
      deliveryTime: this.gameTime + delay,
      progress: 0,
      totalDelay: delay,
    });

    // 触发 UI 反馈：传令兵出发
    gameState.events.emit('command:dispatched', {
      command: cmd,
      delay,
      messengerStart: gameState.commanderPos,
      messengerEnd: cmd.targetPosition,
    });
  }

  processQueue(dt: number): void {
    this.gameTime += dt;

    for (let i = this.queue.length - 1; i >= 0; i--) {
      const item = this.queue[i];
      item.progress = (this.gameTime - (item.deliveryTime - item.totalDelay))
                      / item.totalDelay;

      if (this.gameTime >= item.deliveryTime) {
        this.deliverCommand(item.command);
        this.queue.splice(i, 1);
      }
    }
  }

  private calcDelay(distance: number, skills: SkillState): number {
    const baseDelay = 2 + (distance / 200) * 3; // 2-5秒映射
    const skillReduction = skills.has('运筹') ? 0.8 : 1.0; // -20%
    return baseDelay * skillReduction;
  }

  getMessengerQueue(): CommandInTransit[] {
    return this.queue;
  }
}
```

### 3.4 EntitySpawner (实体生成 + 对象池)

```typescript
// src/entity-spawner.ts
export class EntitySpawner {
  private pools: Map<string, Entity[]> = new Map();
  private active: Map<string, Entity> = new Map();

  spawn(templateId: string, x: number, y: number,
        fields?: Record<string, unknown>): Entity {
    const pool = this.pools.get(templateId) ?? [];
    let entity: Entity;

    if (pool.length > 0) {
      entity = pool.pop()!;
      entity.x = x; entity.y = y;
      entity.visible = true;
    } else {
      entity = this.createFromTemplate(templateId, x, y);
    }

    if (fields) {
      for (const [k, v] of Object.entries(fields)) {
        entity.setField(k, v);
      }
    }

    this.active.set(entity.id, entity);
    return entity;
  }

  recycle(entity: Entity): void {
    entity.visible = false;
    this.active.delete(entity.id);
    const pool = this.pools.get(entity.templateId) ?? [];
    pool.push(entity);
    this.pools.set(entity.templateId, pool);
  }

  getActive(): Entity[] {
    return Array.from(this.active.values());
  }

  getByTemplate(templateId: string): Entity[] {
    return this.getActive().filter(e => e.templateId === templateId);
  }
}
```

---

## 4. 数据结构设计

### 4.1 project.mote.json (项目配置)

```json
{
  "name": "siege-war",
  "tileWidth": 32,
  "tileHeight": 32,
  "startScene": "main-menu",
  "spriteSheets": [
    "sheets/terrain.sheet.json",
    "sheets/wall.sheet.json",
    "sheets/units-defender.sheet.json",
    "sheets/units-attacker.sheet.json",
    "sheets/siege-engines.sheet.json",
    "sheets/projectiles.sheet.json",
    "sheets/effects.sheet.json",
    "sheets/ui.sheet.json",
    "sheets/tunnel.sheet.json"
  ],
  "entityDefs": [
    "entities/wall-segment.entity.json",
    "entities/soldier.entity.json",
    "entities/archer.entity.json",
    "entities/engineer.entity.json",
    "entities/officer.entity.json",
    "entities/trebuchet.entity.json",
    "entities/battering-ram.entity.json",
    "entities/siege-ladder.entity.json",
    "entities/siege-tower.entity.json",
    "entities/projectile.entity.json",
    "entities/fire-effect.entity.json",
    "entities/oil-barrel.entity.json",
    "entities/listening-pot.entity.json",
    "entities/tunnel-entrance.entity.json",
    "entities/messenger.entity.json"
  ],
  "scenes": [
    "scenes/main-menu.scene.json",
    "scenes/campaign-select.scene.json",
    "scenes/level-01-mozi-basic.scene.json",
    "scenes/level-02-mozi-advanced.scene.json",
    "scenes/level-03-tiandan.scene.json",
    "scenes/level-04-baiqi.scene.json",
    "scenes/level-05-julu.scene.json",
    "scenes/level-06-xingyang.scene.json",
    "scenes/level-07-hefei.scene.json",
    "scenes/level-08-jingzhou.scene.json",
    "scenes/level-09-chencang.scene.json",
    "scenes/level-10-anshi.scene.json",
    "scenes/level-11-suiyang.scene.json",
    "scenes/level-12-taiyuan.scene.json",
    "scenes/level-13-dongjing.scene.json",
    "scenes/level-14-diaoyucheng.scene.json",
    "scenes/level-15-xiangyang.scene.json"
  ]
}
```

### 4.2 Sprite Sheet 定义

#### sheets/units-defender.sheet.json (守方单位)

```json
{
  "id": "units-defender",
  "name": "守方单位",
  "image": "assets/sprites/units-defender.png",
  "slicing": { "mode": "manual" },
  "frames": {
    "archer_idle_0":    { "x": 0,   "y": 0,   "w": 24, "h": 32 },
    "archer_idle_1":    { "x": 24,  "y": 0,   "w": 24, "h": 32 },
    "archer_fire_0":    { "x": 48,  "y": 0,   "w": 24, "h": 32 },
    "archer_fire_1":    { "x": 72,  "y": 0,   "w": 24, "h": 32 },
    "archer_fire_2":    { "x": 96,  "y": 0,   "w": 24, "h": 32 },
    "archer_walk_0":    { "x": 120, "y": 0,   "w": 24, "h": 32 },
    "archer_walk_1":    { "x": 144, "y": 0,   "w": 24, "h": 32 },
    "archer_melee_0":   { "x": 168, "y": 0,   "w": 24, "h": 32 },
    "archer_melee_1":   { "x": 192, "y": 0,   "w": 24, "h": 32 },
    "archer_dead":      { "x": 216, "y": 0,   "w": 24, "h": 32 },
    "archer_cover":     { "x": 240, "y": 0,   "w": 24, "h": 32, "tags": ["behind_battlement"] },

    "swordsman_idle_0": { "x": 0,   "y": 32,  "w": 24, "h": 32 },
    "swordsman_idle_1": { "x": 24,  "y": 32,  "w": 24, "h": 32 },
    "swordsman_attack_0":{ "x": 48, "y": 32,  "w": 28, "h": 32 },
    "swordsman_attack_1":{ "x": 76, "y": 32,  "w": 28, "h": 32 },
    "swordsman_block":  { "x": 104, "y": 32,  "w": 24, "h": 32 },
    "swordsman_walk_0": { "x": 128, "y": 32,  "w": 24, "h": 32 },
    "swordsman_walk_1": { "x": 152, "y": 32,  "w": 24, "h": 32 },

    "craftsman_idle":   { "x": 0,   "y": 64,  "w": 24, "h": 32 },
    "craftsman_repair_0":{ "x": 24, "y": 64,  "w": 24, "h": 32 },
    "craftsman_repair_1":{ "x": 48, "y": 64,  "w": 24, "h": 32 },

    "officer_idle":     { "x": 0,   "y": 96,  "w": 24, "h": 36, "tags": ["officer"] },
    "officer_command":  { "x": 24,  "y": 96,  "w": 28, "h": 36, "tags": ["officer"] },
    "officer_dead":     { "x": 52,  "y": 96,  "w": 24, "h": 36, "tags": ["officer"] },

    "tunnel_specialist_idle":  { "x": 0,  "y": 132, "w": 24, "h": 32 },
    "tunnel_specialist_listen":{ "x": 24, "y": 132, "w": 24, "h": 32 },
    "tunnel_specialist_dig":   { "x": 48, "y": 132, "w": 24, "h": 32 },

    "messenger_run_0":  { "x": 0,   "y": 164, "w": 20, "h": 28 },
    "messenger_run_1":  { "x": 20,  "y": 164, "w": 20, "h": 28 },
    "messenger_run_2":  { "x": 40,  "y": 164, "w": 20, "h": 28 }
  }
}
```

#### sheets/wall.sheet.json (城墙与结构)

```json
{
  "id": "wall",
  "name": "城墙与结构",
  "image": "assets/sprites/wall.png",
  "slicing": { "mode": "tile", "tileWidth": 32, "tileHeight": 32 },
  "frames": {
    "wall_intact":     { "x": 0,   "y": 0,   "w": 32, "h": 32, "collider": [{"type":"aabb","x":0,"y":0,"w":32,"h":32}] },
    "wall_damaged_1":  { "x": 32,  "y": 0,   "w": 32, "h": 32, "collider": [{"type":"aabb","x":0,"y":0,"w":32,"h":32}] },
    "wall_damaged_2":  { "x": 64,  "y": 0,   "w": 32, "h": 32, "collider": [{"type":"aabb","x":0,"y":0,"w":32,"h":32}] },
    "wall_breached":   { "x": 96,  "y": 0,   "w": 32, "h": 32, "properties": {"passable": true} },
    "wall_rubble":     { "x": 128, "y": 0,   "w": 32, "h": 32, "properties": {"passable": true, "slowFactor": 0.5} },
    "wall_top":        { "x": 0,   "y": 32,  "w": 32, "h": 16 },
    "battlement":      { "x": 32,  "y": 32,  "w": 32, "h": 16, "collider": [{"type":"aabb","x":4,"y":0,"w":8,"h":16}] },
    "bastion_left":    { "x": 0,   "y": 48,  "w": 48, "h": 64 },
    "bastion_right":   { "x": 48,  "y": 48,  "w": 48, "h": 64 },
    "gate_intact":     { "x": 0,   "y": 112, "w": 64, "h": 64, "collider": [{"type":"aabb","x":0,"y":0,"w":64,"h":64}] },
    "gate_damaged":    { "x": 64,  "y": 112, "w": 64, "h": 64, "collider": [{"type":"aabb","x":0,"y":0,"w":64,"h":64}] },
    "gate_breached":   { "x": 128, "y": 112, "w": 64, "h": 64, "properties": {"passable": true} },
    "arrow_tower":     { "x": 0,   "y": 176, "w": 48, "h": 80 },
    "murder_hole":     { "x": 48,  "y": 176, "w": 32, "h": 16 },
    "moat_water":      { "x": 0,   "y": 256, "w": 32, "h": 32, "tags": ["animated"] },
    "moat_bridge":     { "x": 32,  "y": 256, "w": 32, "h": 32 },
    "moat_filled":     { "x": 64,  "y": 256, "w": 32, "h": 32 }
  }
}
```

#### sheets/tunnel.sheet.json (地道系统)

```json
{
  "id": "tunnel",
  "name": "地道系统",
  "image": "assets/sprites/tunnel.png",
  "slicing": { "mode": "tile", "tileWidth": 32, "tileHeight": 32 },
  "frames": {
    "soil_diggable":     { "x": 0,   "y": 0,  "w": 32, "h": 32 },
    "soil_hard":         { "x": 32,  "y": 0,  "w": 32, "h": 32 },
    "rock_impassable":   { "x": 64,  "y": 0,  "w": 32, "h": 32, "collider": [{"type":"aabb","x":0,"y":0,"w":32,"h":32}] },
    "tunnel_horizontal": { "x": 96,  "y": 0,  "w": 32, "h": 32 },
    "tunnel_vertical":   { "x": 128, "y": 0,  "w": 32, "h": 32 },
    "tunnel_junction":   { "x": 160, "y": 0,  "w": 32, "h": 32 },
    "tunnel_entrance":   { "x": 0,   "y": 32, "w": 32, "h": 32 },
    "tunnel_exit":       { "x": 32,  "y": 32, "w": 32, "h": 32 },
    "tunnel_collapsed":  { "x": 64,  "y": 32, "w": 32, "h": 32 },
    "tunnel_flooded":    { "x": 96,  "y": 32, "w": 32, "h": 32 },
    "tunnel_smoky":      { "x": 128, "y": 32, "w": 32, "h": 32 },
    "support_pillar":    { "x": 160, "y": 32, "w": 32, "h": 32 },
    "vent_shaft":        { "x": 0,   "y": 64, "w": 32, "h": 32 },
    "listening_pot_tile":{ "x": 32,  "y": 64, "w": 32, "h": 32 },
    "wall_foundation":   { "x": 64,  "y": 64, "w": 32, "h": 32, "properties": {"digTime": 4.0} },
    "suspicious_low":    { "x": 0,   "y": 96, "w": 32, "h": 32, "tags": ["overlay"] },
    "suspicious_med":    { "x": 32,  "y": 96, "w": 32, "h": 32, "tags": ["overlay"] },
    "suspicious_high":   { "x": 64,  "y": 96, "w": 32, "h": 32, "tags": ["overlay"] },
    "suspicious_certain":{ "x": 96,  "y": 96, "w": 32, "h": 32, "tags": ["overlay"] }
  }
}
```

### 4.3 Entity 定义

#### entities/wall-segment.entity.json

```json
{
  "id": "wall-segment",
  "name": "城墙段",
  "shape": "rect",
  "width": 32,
  "height": 128,
  "sprite": { "sheetId": "wall", "frameId": "wall_intact" },
  "collider": [{ "type": "aabb", "x": 0, "y": 0, "w": 32, "h": 128 }],
  "fields": [
    { "id": "segmentId",    "type": "string",  "default": "" },
    { "id": "segmentType",  "type": "string",  "default": "normal" },
    { "id": "hp",           "type": "number",  "default": 100 },
    { "id": "maxHp",        "type": "number",  "default": 100 },
    { "id": "breached",     "type": "boolean", "default": false },
    { "id": "garrisonIds",  "type": "string",  "default": "[]" },
    { "id": "ladderCount",  "type": "number",  "default": 0 },
    { "id": "onFire",       "type": "boolean", "default": false },
    { "id": "repairActive", "type": "boolean", "default": false }
  ],
  "scriptPath": "scripts/wall-segment.ts"
}
```

#### entities/soldier.entity.json

```json
{
  "id": "soldier",
  "name": "士兵",
  "shape": "rect",
  "width": 24,
  "height": 32,
  "sprite": { "sheetId": "units-defender", "frameId": "archer_idle_0" },
  "collider": [{ "type": "aabb", "x": 2, "y": 8, "w": 20, "h": 24 }],
  "fields": [
    { "id": "entityType",      "type": "string",  "default": "soldier" },
    { "id": "side",            "type": "string",  "default": "defender" },
    { "id": "unitType",        "type": "string",  "default": "archer" },
    { "id": "unitId",          "type": "string",  "default": "" },
    { "id": "isOfficer",       "type": "boolean", "default": false },
    { "id": "state",           "type": "string",  "default": "idle" },
    { "id": "hpCurrent",       "type": "number",  "default": 100 },
    { "id": "hpMax",           "type": "number",  "default": 100 },
    { "id": "morale",          "type": "number",  "default": 100 },
    { "id": "attackPower",     "type": "number",  "default": 10 },
    { "id": "defense",         "type": "number",  "default": 5 },
    { "id": "range",           "type": "number",  "default": 180 },
    { "id": "moveSpeed",       "type": "number",  "default": 40 },
    { "id": "currentCommand",  "type": "string",  "default": "" },
    { "id": "targetX",         "type": "number",  "default": 0 },
    { "id": "targetY",         "type": "number",  "default": 0 },
    { "id": "collisionGroup",  "type": "number",  "default": 1 },
    { "id": "fireMode",        "type": "string",  "default": "free" },
    { "id": "targetPriority",  "type": "string",  "default": "nearest" }
  ],
  "scriptPath": "scripts/soldier-ai.ts"
}
```

#### entities/listening-pot.entity.json

```json
{
  "id": "listening-pot",
  "name": "听瓮",
  "shape": "rect",
  "width": 32,
  "height": 32,
  "sprite": { "sheetId": "tunnel", "frameId": "listening_pot_tile" },
  "fields": [
    { "id": "entityType",     "type": "string",  "default": "listening_pot" },
    { "id": "detectionRadius","type": "number",  "default": 160 },
    { "id": "assignedSpecialist","type": "string","default": "" },
    { "id": "signalIntensity","type": "number",  "default": 0 },
    { "id": "signalDirection","type": "number",  "default": 0 },
    { "id": "signalActive",   "type": "boolean", "default": false },
    { "id": "noiseLevel",     "type": "number",  "default": 0 }
  ],
  "scriptPath": "scripts/listening-pot.ts"
}
```

### 4.4 Scene / 关卡设计

#### scenes/level-07-hefei.scene.json (示例)

```json
{
  "id": "level-07-hefei",
  "name": "张辽守合肥",
  "width": 120,
  "height": 25,
  "layers": [
    {
      "type": "tile",
      "name": "underground",
      "visible": false,
      "data": ["soil_diggable*120*8", "rock_impassable*40,wall_foundation*4,soil_diggable*76", "..."]
    },
    {
      "type": "tile",
      "name": "ground",
      "data": ["grass*30,road*10,dirt*15,moat_water*6,stone*4,city_ground*55", "..."]
    },
    {
      "type": "tile",
      "name": "wall",
      "data": ["_*65,wall_intact*4,gate_intact*2,wall_intact*4,_*45", "..."]
    },
    {
      "type": "entity",
      "name": "structures",
      "instances": [
        { "id": "seg-a",  "template": "wall-segment", "x": 2080, "y": 160, "fields": {"segmentId":"A","segmentType":"normal","maxHp":100,"hp":100} },
        { "id": "seg-b1", "template": "wall-segment", "x": 2176, "y": 160, "fields": {"segmentId":"B1","segmentType":"bastion","maxHp":130,"hp":130} },
        { "id": "seg-b",  "template": "wall-segment", "x": 2272, "y": 160, "fields": {"segmentId":"B","segmentType":"normal","maxHp":100,"hp":100} },
        { "id": "gate",   "template": "wall-segment", "x": 2336, "y": 160, "fields": {"segmentId":"Gate","segmentType":"gate","maxHp":150,"hp":150} },
        { "id": "seg-c",  "template": "wall-segment", "x": 2464, "y": 160, "fields": {"segmentId":"C","segmentType":"normal","maxHp":100,"hp":100} },
        { "id": "seg-c1", "template": "wall-segment", "x": 2560, "y": 160, "fields": {"segmentId":"C1","segmentType":"bastion","maxHp":130,"hp":130} },
        { "id": "seg-d",  "template": "wall-segment", "x": 2656, "y": 160, "fields": {"segmentId":"D","segmentType":"normal","maxHp":100,"hp":100} }
      ]
    },
    {
      "type": "entity",
      "name": "units",
      "instances": []
    },
    {
      "type": "entity",
      "name": "projectiles",
      "instances": []
    },
    {
      "type": "entity",
      "name": "effects",
      "instances": []
    }
  ]
}
```

### 4.5 关卡配置数据

#### data/levels.json (战役配置)

```json
{
  "campaign": {
    "chapters": [
      {
        "id": "ch1",
        "name": "墨子之道",
        "subtitle": "教学",
        "levels": ["level-01", "level-02"]
      },
      {
        "id": "ch2",
        "name": "战国烽烟",
        "levels": ["level-03", "level-04"]
      },
      {
        "id": "ch3",
        "name": "楚汉风云",
        "levels": ["level-05", "level-06"]
      },
      {
        "id": "ch4",
        "name": "三国争霸",
        "levels": ["level-07", "level-08", "level-09"]
      },
      {
        "id": "ch5",
        "name": "铁血大唐",
        "levels": ["level-10", "level-11"]
      },
      {
        "id": "ch6",
        "name": "靖康前夜",
        "levels": ["level-12", "level-13"]
      },
      {
        "id": "ch7",
        "name": "钓鱼城——最终之战",
        "levels": ["level-14", "level-15"]
      }
    ]
  },
  "levels": {
    "level-01": {
      "name": "墨子守宋·基础防御",
      "scene": "level-01-mozi-basic",
      "side": "defender",
      "budget": 2000,
      "rounds": 3,
      "tutorialFlags": ["basic_deploy", "basic_fire", "push_ladder", "rolling_logs"],
      "enemyWaves": [
        { "round": 1, "type": "infantry_charge", "count": 30 },
        { "round": 2, "type": "ladder_assault", "count": 40, "ladders": 3 },
        { "round": 3, "type": "ram_advance", "count": 50, "rams": 1 }
      ],
      "winCondition": { "type": "survive_rounds", "rounds": 3 },
      "loseConditions": [
        { "type": "gate_hp_zero" },
        { "type": "enemies_in_city", "threshold": 20 }
      ],
      "stars": [
        { "condition": "win", "label": "击退全部" },
        { "condition": "wall_intact", "label": "城墙完好" },
        { "condition": "casualties_lt", "value": 10, "label": "伤亡<10" }
      ],
      "availableUnits": ["archer_basic", "swordsman_basic"],
      "availableEquipment": ["rolling_logs", "rocks"]
    }
  }
}
```

### 4.6 单位模板数据

#### data/unit-templates.json

```json
{
  "units": {
    "archer_basic": {
      "name": "弓弩营",
      "side": "defender",
      "type": "archer",
      "cost": 800,
      "count": 100,
      "stats": {
        "hp": 80, "attack": 12, "defense": 4,
        "range": 180, "moveSpeed": 40,
        "fireRate": 1.5, "accuracy": 0.7
      },
      "sprite": { "sheet": "units-defender", "prefix": "archer" },
      "abilities": ["free_fire", "focused_fire", "hold_fire"]
    },
    "swordsman_basic": {
      "name": "刀盾营",
      "side": "defender",
      "type": "melee",
      "cost": 600,
      "count": 80,
      "stats": {
        "hp": 120, "attack": 15, "defense": 12,
        "range": 0, "moveSpeed": 35,
        "blockChance": 0.3
      },
      "sprite": { "sheet": "units-defender", "prefix": "swordsman" },
      "abilities": ["defensive_formation", "offensive_formation"]
    },
    "craftsman": {
      "name": "工匠队",
      "side": "defender",
      "type": "support",
      "cost": 400,
      "count": 20,
      "stats": {
        "hp": 60, "attack": 5, "defense": 3,
        "range": 0, "moveSpeed": 30,
        "repairSpeed": 5
      },
      "sprite": { "sheet": "units-defender", "prefix": "craftsman" },
      "abilities": ["repair", "transport_supplies"]
    },
    "elite_striker": {
      "name": "精锐突击队",
      "side": "defender",
      "type": "elite",
      "cost": 1000,
      "count": 30,
      "stats": {
        "hp": 150, "attack": 25, "defense": 15,
        "range": 0, "moveSpeed": 60,
        "moraleDamageBonus": 1.5
      },
      "sprite": { "sheet": "units-defender", "prefix": "swordsman" },
      "abilities": ["sortie", "ambush"]
    },
    "tunnel_specialist": {
      "name": "穴师",
      "side": "defender",
      "type": "specialist",
      "cost": 500,
      "count": 5,
      "stats": {
        "hp": 70, "attack": 8, "defense": 5,
        "range": 0, "moveSpeed": 25,
        "listenAccuracy": 0.8, "digSpeed": 1.2
      },
      "sprite": { "sheet": "units-defender", "prefix": "tunnel_specialist" },
      "abilities": ["listen", "counter_dig", "detect"]
    },
    "attacker_infantry": {
      "name": "刀盾兵",
      "side": "attacker",
      "type": "melee",
      "cost": 500,
      "count": 100,
      "stats": {
        "hp": 100, "attack": 12, "defense": 8,
        "range": 0, "moveSpeed": 45
      },
      "sprite": { "sheet": "units-attacker", "prefix": "infantry" }
    },
    "attacker_archer": {
      "name": "弓弩手",
      "side": "attacker",
      "type": "archer",
      "cost": 700,
      "count": 80,
      "stats": {
        "hp": 70, "attack": 10, "defense": 3,
        "range": 160, "moveSpeed": 35,
        "fireRate": 1.2
      },
      "sprite": { "sheet": "units-attacker", "prefix": "archer" }
    },
    "attacker_engineer": {
      "name": "工兵",
      "side": "attacker",
      "type": "engineer",
      "cost": 400,
      "count": 30,
      "stats": {
        "hp": 60, "attack": 5, "defense": 3,
        "range": 0, "moveSpeed": 30,
        "digSpeed": 1.0, "buildSpeed": 1.0
      },
      "sprite": { "sheet": "units-attacker", "prefix": "engineer" },
      "abilities": ["dig_tunnel", "fill_moat", "set_ladder", "build_bridge"]
    },
    "attacker_elite_climber": {
      "name": "精锐登墙队",
      "side": "attacker",
      "type": "elite",
      "cost": 1200,
      "count": 30,
      "stats": {
        "hp": 130, "attack": 22, "defense": 10,
        "range": 0, "moveSpeed": 55,
        "climbSpeed": 2.0
      },
      "sprite": { "sheet": "units-attacker", "prefix": "climber" },
      "abilities": ["climb_ladder", "wall_breach"]
    }
  }
}
```

### 4.7 指挥官技能数据

#### data/skill-tree.json

```json
{
  "defender": {
    "坚壁": {
      "id": "fortify",
      "effect": { "wallBaseHp": 1.10 },
      "cost": 1,
      "children": {
        "铁壁": { "id": "iron_wall", "effect": { "wallHp": 1.25 }, "cost": 2 },
        "速修": { "id": "quick_repair", "effect": { "repairSpeed": 1.30 }, "cost": 2 }
      }
    },
    "神射": {
      "id": "marksman",
      "effect": { "archerRange": 1.15 },
      "cost": 1,
      "children": {
        "齐射": { "id": "volley", "effect": { "focusedFireDmg": 1.40 }, "cost": 2 },
        "火箭": { "id": "fire_arrow", "effect": { "unlockAbility": "fire_arrow" }, "cost": 2 }
      }
    },
    "运筹": {
      "id": "strategist",
      "effect": { "transmissionDelay": 0.80 },
      "cost": 1,
      "children": {
        "料敌": { "id": "foresight", "effect": { "showEnemyOverview": true }, "cost": 2 },
        "伏兵": { "id": "ambush", "effect": { "unlockAbility": "improved_sortie" }, "cost": 2 }
      }
    },
    "厚积": {
      "id": "stockpile",
      "effect": { "resourceGain": 1.20 },
      "cost": 1,
      "children": {
        "屯粮": { "id": "food_reserve", "effect": { "startingFood": 1.50 }, "cost": 2 },
        "军工": { "id": "arsenal", "effect": { "reloadSpeed": 1.25 }, "cost": 2 }
      }
    }
  }
}
```

---

## 5. 脚本架构

### 5.1 脚本文件清单

| 脚本 | 职责 |
|---|---|
| **scripts/soldier-ai.ts** | 士兵自律 AI：状态机(idle/moving/firing/melee/routing) + 5 种自律行为 |
| **scripts/wall-segment.ts** | 城墙段逻辑：HP 管理、受损贴图切换、坍塌检测、驻军管理 |
| **scripts/projectile.ts** | 投射物：抛物线弹道计算、着弹检测、AOE 伤害 |
| **scripts/siege-engine.ts** | 攻城器械：移动、操作、HP、被摧毁 |
| **scripts/fire-effect.ts** | 火焰特效：扩散、伤害、自然熄灭 |
| **scripts/oil-barrel.ts** | 油桶设施：待命/倾倒/运输状态切换 |
| **scripts/listening-pot.ts** | 听瓮：探测计算、信号生成、噪声处理 |
| **scripts/tunnel-digger.ts** | 地道挖掘：进度、方向、支撑柱、通风 |
| **scripts/messenger.ts** | 传令兵：从指挥官跑向目标单位的移动逻辑 |
| **scripts/moat.ts** | 护城河：水位、填壕进度、桥梁搭建 |
| **scripts/barbican-trap.ts** | 瓮城陷阱：闸门控制、包围判定 |

### 5.2 核心系统类

| 系统类 | 职责 |
|---|---|
| **src/command-system.ts** | 传令系统：指令排队、延迟计算、传达、执行分发 |
| **src/ai-system.ts** | AI 管理：敌方波次生成、攻城 AI 决策、单位自律行为协调 |
| **src/projectile-system.ts** | 投射物系统：创建、弹道更新、碰撞检测、回收 |
| **src/tunnel-system.ts** | 地道系统：挖掘进度、路线计算、坍塌判定、遭遇战触发 |
| **src/listening-pot-system.ts** | 听瓮系统：信号计算、三角定位、可信度评估 |
| **src/phase-manager.ts** | 阶段管理：试探→推进→总攻→巷战的条件检测与切换 |
| **src/morale-system.ts** | 士气系统：全局/单位士气计算、军官效果、溃散判定 |
| **src/resource-manager.ts** | 资源管理：金/木/石/油/粮食的收支与约束 |
| **src/pathfinding.ts** | 寻路：地面 A* + 墙面垂直移动 + 地下通道导航 |
| **src/engine-context.ts** | 游戏上下文：SiegeWarContext 全局引用容器 |
| **src/canvas-renderer.ts** | 渲染器：多层 Canvas2D 渲染 + 视图模式切换 |
| **src/canvas-loader.ts** | 加载器：哑 GPU + HTMLImageElement + ProjectLoader |
| **src/game-state.ts** | 游戏状态：GameState / BattleState / CampaignProgress 接口 |
| **src/ui-manager.ts** | UI 管理：HTML 覆盖层的资源栏/花名册/状态栏/指令面板 |
| **src/main.ts** | 入口：初始化、加载、主循环绑定、场景切换 |

### 5.3 关键脚本详细设计

#### scripts/projectile.ts — 投射物弹道

```typescript
export default class ProjectileScript implements ScriptLifecycle {
  private entity: Entity;
  private engine: SiegeWarContext;

  // 抛物线参数
  private vx: number = 0;      // 水平速度
  private vy: number = 0;      // 垂直速度
  private gravity: number = 400; // 重力加速度(px/s²)
  private startX: number = 0;
  private startY: number = 0;

  constructor(entity: Entity, engine: unknown) {
    this.entity = entity;
    this.engine = engine as SiegeWarContext;
    this.initTrajectory();
  }

  private initTrajectory(): void {
    const targetX = this.entity.getField<number>('targetX');
    const targetY = this.entity.getField<number>('targetY');
    this.startX = this.entity.x;
    this.startY = this.entity.y;

    // 计算初速度使抛物线过(startX, startY) → (targetX, targetY)
    const dx = targetX - this.startX;
    const dy = targetY - this.startY;
    const t = Math.abs(dx) / 200; // 飞行时间基于水平距离
    this.vx = dx / t;
    this.vy = (dy - 0.5 * this.gravity * t * t) / t;
  }

  update(dt: number): void {
    // 更新位置
    this.entity.x += this.vx * dt;
    this.vy += this.gravity * dt;
    this.entity.y += this.vy * dt;

    // 旋转角度跟随速度方向
    const angle = Math.atan2(this.vy, this.vx);
    this.entity.setField('rotation', angle);

    // 着地检测
    const groundY = this.engine.getGroundY(this.entity.x);
    if (this.entity.y >= groundY) {
      this.onImpact();
    }
  }

  private onImpact(): void {
    const type = this.entity.getField<string>('projectileType');
    const damage = this.entity.getField<number>('damage');
    const aoeRadius = this.entity.getField<number>('aoeRadius');

    // AOE 伤害
    const targets = this.engine.entityManager.getInRadius(
      this.entity.x, this.entity.y, aoeRadius);
    for (const target of targets) {
      const dist = Vec2.from(target.x - this.entity.x,
                             target.y - this.entity.y).length();
      const falloff = 1 - (dist / aoeRadius);
      this.engine.dealDamage(target, damage * falloff);
    }

    // 特效
    if (type === 'fire') {
      this.engine.effectSystem.spawnFire(this.entity.x, this.entity.y);
    }

    // 相机震动
    this.engine.camera.shakeOnImpact(damage / 50);

    // 回收
    this.engine.spawner.recycle(this.entity);
  }
}
```

#### scripts/listening-pot.ts — 听瓮探测

```typescript
export default class ListeningPotScript implements ScriptLifecycle {
  private entity: Entity;
  private engine: SiegeWarContext;

  constructor(entity: Entity, engine: unknown) {
    this.entity = entity;
    this.engine = engine as SiegeWarContext;
  }

  update(dt: number): void {
    const radius = this.entity.getField<number>('detectionRadius');
    const specialist = this.entity.getField<string>('assignedSpecialist');

    // 无穴师则不产生信号
    if (!specialist) {
      this.entity.setField('signalActive', false);
      return;
    }

    // 搜索半径内所有挖掘活动
    const digActivities = this.engine.tunnelSystem.getActiveDigging();
    let strongestSignal = { intensity: 0, direction: 0 };

    for (const dig of digActivities) {
      const dx = dig.x - this.entity.x;
      const dy = dig.y - this.entity.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist > radius) continue;

      // 强度：3 级 (far/medium/near)
      const rawIntensity = 1 - (dist / radius);
      const soilHardness = dig.soilType === 'hard' ? 1.3 : 1.0; // 硬土更响
      const moatNoise = this.isNearMoat() ? 0.7 : 1.0;          // 护城河噪声
      const intensity = rawIntensity * soilHardness * moatNoise;

      // 方向：量化到 45 度扇区
      const rawAngle = Math.atan2(dy, dx);
      const quantizedAngle = Math.round(rawAngle / (Math.PI / 4)) * (Math.PI / 4);

      // 加入随机噪声 (±15 度)
      const noise = (Math.random() - 0.5) * (Math.PI / 6);
      const direction = quantizedAngle + noise;

      if (intensity > strongestSignal.intensity) {
        strongestSignal = { intensity, direction };
      }
    }

    // 量化强度到 3 级
    const level = strongestSignal.intensity > 0.7 ? 3 :
                  strongestSignal.intensity > 0.4 ? 2 :
                  strongestSignal.intensity > 0.1 ? 1 : 0;

    this.entity.setField('signalIntensity', level);
    this.entity.setField('signalDirection', strongestSignal.direction);
    this.entity.setField('signalActive', level > 0);
  }
}
```

---

## 6. 渲染策略

### 6.1 每帧渲染管线

1. `ctx.clearRect(0, 0, 1280, 720)`
2. 设置相机变换矩阵（translate + scale）
3. 渲染地下 Tile 层（仅在 underground/overlay 模式）
4. 渲染地面 Tile 层
5. 渲染城墙 Tile 层（含 HP 可视化）
6. 渲染所有 Entity（按 Y 坐标排序）
7. 渲染投射物（抛物线 + 拖尾）
8. 渲染特效层（火焰/烟雾/爆炸粒子）
9. 渲染听瓮信号扇形（仅 underground/overlay 模式）
10. 渲染可疑区域标记
11. 重置变换矩阵
12. 渲染 HUD 覆盖（资源栏/花名册/状态栏/指令面板/传令队列）

### 6.2 Y-Sort 渲染

Entity 按 `y + height` 排序，确保下方的实体绘制在上方实体前面，维持正确的视觉遮挡关系。城墙上的单位需要特殊处理——它们的渲染 Y 坐标为墙顶 Y，但排序优先级高于墙体。

### 6.3 视觉特效

| 特效 | 实现 |
|---|---|
| **火焰** | 帧动画序列(8帧) + 发光混合模式 + 扩散到相邻 tile |
| **烟雾** | 半透明灰色帧动画 + 向上飘动 + 逐渐消散 |
| **投石弹着** | 尘土粒子 + 震动帧 + 相机 shake |
| **城墙坍塌** | 砖块粒子下落动画 + 灰尘扩散 + 墙体帧切换 |
| **传令兵** | 小人奔跑帧动画 + 从指挥官到目标的路径 |
| **箭雨** | 多个小箭帧同时抛物线飞行 + 随机偏移 |
| **油倾倒** | 从墙顶向下的流体帧动画 + 着地后点燃 |

---

## 7. 碰撞系统设计

### 7.1 碰撞组

| 组 | 位掩码 | 碰撞目标 |
|---|---|---|
| DefenderUnit | 0b0001 | AttackerUnit, Projectile |
| AttackerUnit | 0b0010 | DefenderUnit, Projectile, Structure |
| Projectile | 0b0100 | DefenderUnit, AttackerUnit, Structure |
| Structure | 0b1000 | AttackerUnit, Projectile |

### 7.2 碰撞检测频率

- **全量广相位**：每 3 帧执行一次（性能优化）
- **关键对**：投射物 vs 所有，每帧检测
- **墙体碰撞**：使用 `CollisionSystem.mergeTileColliders()` 合并为大 AABB

---

## 8. 性能优化

| 策略 | 说明 |
|---|---|
| **对象池** | 所有 Entity（士兵/投射物/特效）使用 EntitySpawner 对象池 |
| **视口裁剪** | 仅渲染相机可见范围内的 Tile 和 Entity |
| **Tile 合并** | 连续相同 Tile 合并为单次 `drawImage` 调用 |
| **Entity 距离 LOD** | 远处士兵合并为"密度图标"，不渲染个体 |
| **碰撞降频** | 非关键碰撞对每 3 帧检测一次 |
| **AI 分帧** | 200+ 士兵 AI 分散到多帧执行，每帧仅更新 1/3 |
| **寻路缓存** | A* 结果缓存，相同起终点在地图不变时复用 |
| **脏标记** | UI 面板仅在状态变化时重绘，非每帧 |

---

## 9. 完整文件结构

```
siege-war/
├── package.json
├── tsconfig.json
├── vite.config.ts
├── index.html
│
├── src/
│   ├── main.ts                    # 入口：初始化 + 主循环
│   ├── canvas-loader.ts           # 哑 GPU + ProjectLoader
│   ├── canvas-renderer.ts         # 多层 Canvas2D 渲染器
│   ├── engine-context.ts          # SiegeWarContext 游戏上下文
│   ├── game-state.ts              # GameState / BattleState 接口
│   ├── battlefield-camera.ts      # 自由平移+缩放相机
│   ├── entity-spawner.ts          # Entity 对象池
│   ├── command-system.ts          # 传令系统
│   ├── ai-system.ts               # 敌方 AI + 波次管理
│   ├── projectile-system.ts       # 投射物系统
│   ├── tunnel-system.ts           # 地道系统
│   ├── listening-pot-system.ts    # 听瓮系统
│   ├── phase-manager.ts           # 阶段管理
│   ├── morale-system.ts           # 士气系统
│   ├── resource-manager.ts        # 资源管理
│   ├── pathfinding.ts             # A* 寻路
│   ├── effect-system.ts           # 视觉特效管理
│   └── ui-manager.ts              # HTML UI 覆盖层
│
├── scripts/                        # ScriptLifecycle 脚本
│   ├── soldier-ai.ts              # 士兵自律 AI
│   ├── wall-segment.ts            # 城墙段逻辑
│   ├── projectile.ts              # 投射物弹道
│   ├── siege-engine.ts            # 攻城器械
│   ├── fire-effect.ts             # 火焰特效
│   ├── oil-barrel.ts              # 油桶设施
│   ├── listening-pot.ts           # 听瓮探测
│   ├── tunnel-digger.ts           # 地道挖掘
│   ├── messenger.ts               # 传令兵
│   ├── moat.ts                    # 护城河
│   └── barbican-trap.ts           # 瓮城陷阱
│
├── data/                           # 游戏数据 (JSON)
│   ├── levels.json                # 战役 + 关卡配置
│   ├── unit-templates.json        # 单位模板
│   ├── skill-tree.json            # 技能树
│   ├── equipment.json             # 装备/器械数据
│   └── campaign-progress.json     # 存档结构
│
├── assets/
│   ├── sprites/
│   │   ├── terrain.png            # 地形 Tile 图集
│   │   ├── wall.png               # 城墙结构图集
│   │   ├── units-defender.png     # 守方单位图集
│   │   ├── units-attacker.png     # 攻方单位图集
│   │   ├── siege-engines.png      # 攻城器械图集
│   │   ├── projectiles.png        # 投射物图集
│   │   ├── effects.png            # 特效图集
│   │   ├── tunnel.png             # 地道系统图集
│   │   └── ui.png                 # UI 元素图集
│   └── audio/
│       ├── bgm/                   # 背景音乐
│       └── sfx/                   # 音效
│
├── sheets/                         # Sprite Sheet 定义 (JSON)
│   ├── terrain.sheet.json
│   ├── wall.sheet.json
│   ├── units-defender.sheet.json
│   ├── units-attacker.sheet.json
│   ├── siege-engines.sheet.json
│   ├── projectiles.sheet.json
│   ├── effects.sheet.json
│   ├── tunnel.sheet.json
│   └── ui.sheet.json
│
├── entities/                       # Entity 定义 (JSON)
│   ├── wall-segment.entity.json
│   ├── soldier.entity.json
│   ├── archer.entity.json
│   ├── engineer.entity.json
│   ├── officer.entity.json
│   ├── trebuchet.entity.json
│   ├── battering-ram.entity.json
│   ├── siege-ladder.entity.json
│   ├── siege-tower.entity.json
│   ├── projectile.entity.json
│   ├── fire-effect.entity.json
│   ├── oil-barrel.entity.json
│   ├── listening-pot.entity.json
│   ├── tunnel-entrance.entity.json
│   └── messenger.entity.json
│
└── scenes/                         # 场景定义 (JSON)
    ├── main-menu.scene.json
    ├── campaign-select.scene.json
    ├── level-01-mozi-basic.scene.json
    ├── level-02-mozi-advanced.scene.json
    ├── level-03-tiandan.scene.json
    ├── level-04-baiqi.scene.json
    ├── level-05-julu.scene.json
    ├── level-06-xingyang.scene.json
    ├── level-07-hefei.scene.json
    ├── level-08-jingzhou.scene.json
    ├── level-09-chencang.scene.json
    ├── level-10-anshi.scene.json
    ├── level-11-suiyang.scene.json
    ├── level-12-taiyuan.scene.json
    ├── level-13-dongjing.scene.json
    ├── level-14-diaoyucheng.scene.json
    └── level-15-xiangyang.scene.json
```

---

## 10. 与前作代码复用

| 模块 | 来源 | 复用程度 | 改动 |
|---|---|---|---|
| **canvas-loader.ts** | Road Rash | 90% 直接复用 | 无需改动 |
| **EntitySpawner** | Road Rash | 80% 复用 | 添加 `getByTemplate` / `getInRadius` |
| **GameLoop 集成** | Road Rash | 100% 直接复用 | — |
| **InputManager** | Road Rash | 70% 复用 | 重新定义 ActionMap（鼠标指令式） |
| **CollisionSystem** | Road Rash | 90% 复用 | 添加碰撞组矩阵过滤 |
| **canvas-renderer.ts** | Road Rash | 30% 参考 | 重写为多层渲染器 |
| **Camera** | Road Rash (ScrollingCamera) | 40% 参考 | 重写为自由平移+缩放 |
| **vite.config.ts** | Road Rash | 95% 直接复用 | 更新脚本路径 |
