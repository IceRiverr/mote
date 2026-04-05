基于 mote (微尘) 引擎开发 · 2D 俯视角摩托竞速+格斗游戏

---
第一部分：需求文档 (PRD)
1. 项目概述
属性
说明
项目名称
暴力摩托 2D (Road Rash 2D)
游戏类型
2D 俯视角竞速 + 格斗
引擎
mote (微尘) 引擎，Canvas2D 混合渲染
平台
Web 浏览器 (Desktop)
视角
俯视角，垂直滚动（玩家向上行驶，赛道向下滚动）
画布尺寸
416×640 像素（13×20 格，32px/格）
参考作品
EA Road Rash 系列
核心体验：在高速摩托竞速中，与对手近身格斗、躲避交通车辆、使用武器击倒敌人，以第一名冲过终点线。
2. 核心玩法
2.1 竞速系统
赛道结构：点对点赛道（起点→终点），玩家从赛道底部出发，向上方终点线行驶。
- 速度范围：0 ~ 220 km/h（取决于车型和升级）
- 加速：按住加速键持续提速，松开自然减速（风阻）
- 刹车：主动减速，速度迅速下降
- 氮气加速：消耗氮气槽，短暂突破最高速度限制（+40 km/h，持续 3 秒）
- 名次：根据所有赛车手在赛道上的 Y 坐标实时排名
- 完赛条件：前 3 名完赛可进入下一赛事；第 4 名及以下需重赛
速度与滚动映射（1 格 = 32px ≈ 3 米）：
速度 (km/h)
滚动速率 (px/s)
每帧移动 (px @60fps)
60
178
2.96
120
356
5.93
180
534
8.90
220
652
10.87
赛道长度：1500 格 = 48000px（约 4.5 公里）。以平均 140 km/h 计算，单场比赛约 115 秒（≈2 分钟）。
2.2 战斗系统
战斗发生在行驶过程中，玩家可向左/右两侧的相邻车道攻击对手。
攻击方式：
攻击类型
范围 (px)
伤害
冷却 (s)
说明
拳击
36
8
0.3
默认攻击，无需武器
铁链
52
18
0.5
可横扫，范围最大
球棒
40
28
0.7
高伤害，出手较慢
撬棍
44
22
0.4
攻守均衡
攻击判定：
1. 攻击方向（左/右）确定目标车道
2. 在目标车道内搜索 Y 坐标差 < 攻击范围的对手实体
3. 命中后扣减目标生命值，施加短暂减速
4. 生命值归零 → 触发摔车（目标失控滑行 2 秒，速度降为 0，之后恢复 30% HP）
武器获取：
- 赛道上散落武器拾取物，骑过即拾取
- 击倒持有武器的对手，有 50% 几率掉落武器
- 每次只能持有一种武器（新武器替换旧武器）
2.3 对手系统
每场比赛有 5 名 AI 对手，各有不同属性和性格。
AI 行为：
- 竞速 AI：维持目标速度，根据前方障碍自动变道
- 战斗 AI：根据 aggressiveness 值决定是否主动攻击相邻玩家
- 橡皮筋机制：领先者轻微减速，落后者轻微加速，保持比赛紧凑
- 避障：检测前方交通车辆和障碍物，提前变道闪避
对手属性变化：随赛事难度递增，对手的 maxSpeed、aggressiveness、skillLevel 逐步提升。
2.4 交通系统
赛道上有双向行驶的民用车辆作为动态障碍。
车辆类型
速度 (km/h)
尺寸 (格)
出现频率
轿车
60-80
1×2
高
卡车
40-60
1×3
中
公交车
50-70
1×3
低
对向来车
80-100（反向）
1×2
赛道两侧车道
碰撞效果：
- 轻微剐蹭（速度差 < 30 km/h）：减速 20%，扣 10 HP
- 正面碰撞（速度差 ≥ 30 km/h）：触发摔车
生成规则：交通车辆在摄像机前方 30 格处动态生成，在摄像机后方 10 格处回收。
2.5 警察系统
触发条件：连续击倒 3 名对手或在同一位置反复攻击时，警察介入。
警察行为：
- 最高速度高于普通对手（180+ km/h）
- 靠近玩家后尝试逼停（挤压变道）
- 生命值更高（150 HP），不会被轻易击倒
- 被警察逼停：罚金 $500，失去当前武器
2.6 道具系统
赛道上散落的可拾取物品：
道具类型
效果
出现频率
武器（铁链/球棒/撬棍）
替换当前武器
每 200-400 格
氮气罐
氮气 +50
每 300-500 格
修理包
HP +30
每 400-600 格
金币包
$200-500
每 300-400 格
2.7 进度系统
赛事结构：3 个级别，每级 5 条赛道。
级别
赛道数
对手强度
奖金倍率
解锁条件
业余赛
5
低
×1
初始开放
职业赛
5
中
×2
业余赛全部前3完赛
传奇赛
5
高
×3
职业赛全部前3完赛
奖金：第 1 名 $$3000 × 倍率，第 2 名 $$1500 × 倍率，第 3 名 $800 × 倍率。
车库/商店：赛间使用奖金购买摩托车或升级。
3. 摩托车
4 种可购买的摩托车：
车型
极速
加速
操控
耐久
价格
街车 (Street)
160
70
6
100
初始拥有
运动 (Sport)
190
85
5
90
$8,000
重机 (Cruiser)
150
60
4
140
$6,000
超跑 (Superbike)
220
95
7
80
$15,000
升级项（每辆车独立升级）：
- 引擎升级（3 级）：极速 +10/20/30 km/h，各 $$2000/$$4000/$8000
- 排气管（3 级）：加速 +8/15/25，各 $$1500/$$3000/$6000
- 悬挂（3 级）：操控 +1/2/3，各 $$1000/$$2000/$4000
- 装甲（3 级）：耐久 +15/30/50，各 $$1200/$$2500/$5000
4. 赛道设计
5 条核心赛道（每级共用赛道布局，难度通过对手和交通密度调整）：
赛道
场景
长度(格)
特点
城市高速
高楼/立交桥
1500
交通密集，弯道适中
山间公路
山/树/悬崖
1200
弯道多且急，交通稀疏
沙漠公路
沙丘/仙人掌
1800
直道多，极速赛道
海岸公路
海/棕榈树
1400
弯道平缓，风景路段
夜间高速
夜景/霓虹灯
1600
能见度低（渲染暗化），交通密集
弯道实现：赛道地图宽 21 格，视口宽 13 格。道路在地图内水平偏移形成弯道，摄像机跟随道路中心线平移。
5. UI/HUD
比赛中 HUD：
- 速度表（左下角）：数字显示当前 km/h + 进度条
- 生命条（左上角）：红色血条
- 氮气条（速度表旁）：蓝色能量条
- 名次（右上角）：大号字体 "1st" / "2nd" 等
- 武器图标（右下角）：当前武器图标
- 迷你地图（右侧竖条）：显示所有赛手在赛道上的相对位置
- 距离（顶部中央）：距终点距离
其他界面：
- 主菜单：开始比赛 / 车库 / 成绩
- 车库：摩托选择、升级购买
- 比赛结算：名次、用时、奖金、击倒数
- 倒计时：3-2-1-GO 动画
6. 操控方案
操作
按键
ActionMap 名称
ActionType
加速
W / ↑
Accelerate
Button
刹车
S / ↓
Brake
Button
左变道
A / ←
SteerLeft
Button
右变道
D / →
SteerRight
Button
左攻击
J
AttackLeft
Button
右攻击
K
AttackRight
Button
氮气加速
Space
Nitro
Button
后视
L
LookBack
Button

---
第二部分：技术规格文档 (Tech Spec)
1. 架构概览
沿用 Magic Tower 验证过的 混合架构：使用 mote 引擎全部逻辑 API（GameLoop、InputManager、SceneManager、Entity、ScriptRuntime、CollisionSystem），渲染层使用 Canvas2D。
关键差异对比：
维度
Magic Tower
Road Rash 2D
视角
固定单屏 (13×13)
滚动视口 (13×20 于 21×1500 地图)
移动
格子步进
亚像素连续移动
帧率需求
低（回合制）
高（实时 60fps 竞速）
实体数量
~20/场景
~50-100（动态增减）
摄像机
无（1:1 映射）
滚动摄像机（跟踪玩家+道路）
动态生成
无
交通车辆动态生成/回收
暂时无法在飞书文档外展示此内容
2. mote 引擎系统使用
2.1 GameLoop
const gameLoop = new GameLoop(60); // 固定 60Hz
gameLoop.onUpdate = (dt: number) => { /* 物理+逻辑 */ };
gameLoop.onRender = (alpha: number) => { /* 插值渲染 */ };
gameLoop.start();
竞速游戏对帧率敏感，GameLoop 的 semi-fixed timestep 确保物理计算稳定。alpha 用于渲染插值实现平滑画面。
2.2 InputManager + ActionMap
const racingMap = new ActionMap('racing', {
  Accelerate:  { type: ActionType.Button, bindings: ['ArrowUp', 'KeyW'] },
  Brake:       { type: ActionType.Button, bindings: ['ArrowDown', 'KeyS'] },
  SteerLeft:   { type: ActionType.Button, bindings: ['ArrowLeft', 'KeyA'] },
  SteerRight:  { type: ActionType.Button, bindings: ['ArrowRight', 'KeyD'] },
  AttackLeft:  { type: ActionType.Button, bindings: ['KeyJ'] },
  AttackRight: { type: ActionType.Button, bindings: ['KeyK'] },
  Nitro:       { type: ActionType.Button, bindings: ['Space'] },
  LookBack:    { type: ActionType.Button, bindings: ['KeyL'] },
}, input);
racingMap.enable();
每帧调用 input.update() 读取状态，input.endFrame() 重置边沿信号。使用 action.pressed 检测单次触发（变道、攻击），action.down 检测持续按压（加速、刹车）。
2.3 SceneManager + Entity
const sceneManager = new SceneManager(runtime);
const scene: SceneRuntime = sceneManager.loadScene('track-city');

// 从场景实体层创建 Entity 实例
for (const inst of entityLayer.entities) {
  const def = sceneManager.getEntityDef(inst.template);
  const entity = new Entity(inst, def!, sceneManager);
  entities.push(entity);
}

// 运行时读写实体字段
const speed = entity.getField<number>('currentSpeed');
entity.setField('currentSpeed', speed + acceleration * dt);

// 切换精灵帧（不同朝向/动画）
entity.setFrame('player_lean_left', 'bikes');
2.4 ScriptRuntime
所有游戏逻辑通过 ScriptLifecycle 脚本实现：
// ScriptRuntime 加载并绑定脚本
await scriptRuntime.bindScript(entity, '/scripts/player-bike.ts', engineCtx);

// 每帧驱动
scriptRuntime.updateAll(dt);

// 碰撞通知
scriptRuntime.notifyCollisionEnter(entityA.id, entityB);
2.5 CollisionSystem
使用 AABB 碰撞检测（足够应对矩形摩托/车辆）：
import { CollisionSystem } from '@mote/engine';

// 宽相：筛选附近实体对
const pairs = CollisionSystem.broadPhase(allEntities);

// 逐对精确检测
for (const [a, b] of pairs) {
  if (CollisionSystem.testAABB(a.getBounds(), b.getBounds())) {
    scriptRuntime.notifyCollisionEnter(a.id, b);
    scriptRuntime.notifyCollisionEnter(b.id, a);
  }
}
3. 自定义扩展
3.1 ScrollingCamera
Magic Tower 不需要摄像机（一屏一层）。Road Rash 需要滚动摄像机：
export class ScrollingCamera {
  x: number = 0;           // 摄像机世界X（左上角）
  y: number = 0;           // 摄像机世界Y（左上角）
  readonly viewW: number;  // 视口宽 (416)
  readonly viewH: number;  // 视口高 (640)

  constructor(viewW: number, viewH: number) {
    this.viewW = viewW;
    this.viewH = viewH;
  }

  /** 跟踪目标位置，玩家位于屏幕下方 1/4 处，看到更多前方道路 */
  follow(targetX: number, targetY: number, roadCenterX: number): void {
    // Y: 玩家在屏幕 3/4 位置（底部 1/4），看到上方 3/4 的前方道路
    this.y = targetY - this.viewH * 0.75;
    // X: 基于道路中心线，略微偏向玩家
    this.x = roadCenterX - this.viewW / 2 + (targetX - roadCenterX) * 0.3;
    // 钳制边界
    this.x = Math.max(0, this.x);
    this.y = Math.max(0, this.y);
  }

  /** 世界坐标 → 屏幕坐标 */
  worldToScreen(wx: number, wy: number): { sx: number; sy: number } {
    return { sx: wx - this.x, sy: wy - this.y };
  }

  /** 判断世界矩形是否在视口内 */
  isVisible(wx: number, wy: number, w: number, h: number): boolean {
    return wx + w > this.x && wx < this.x + this.viewW
        && wy + h > this.y && wy < this.y + this.viewH;
  }

  /** 获取可见的 tile 行列范围（避免渲染全部地图） */
  getVisibleTileRange(tw: number, th: number, mapCols: number, mapRows: number) {
    const startCol = Math.max(0, Math.floor(this.x / tw));
    const endCol = Math.min(mapCols, Math.ceil((this.x + this.viewW) / tw));
    const startRow = Math.max(0, Math.floor(this.y / th));
    const endRow = Math.min(mapRows, Math.ceil((this.y + this.viewH) / th));
    return { startCol, endCol, startRow, endRow };
  }
}
3.2 Canvas2DRenderer 增强
在 Magic Tower 的基础上添加摄像机支持：
export class Canvas2DRenderer {
  // ... 沿用 Magic Tower 的 assets/spriteSheets 字段

  /** 使用摄像机偏移渲染 tile 层（仅渲染可见区域） */
  renderTileLayerWithCamera(
    layer: TileLayerRuntime,
    mapCols: number, mapRows: number,
    tw: number, th: number,
    camera: ScrollingCamera
  ): void {
    const { startCol, endCol, startRow, endRow } =
      camera.getVisibleTileRange(tw, th, mapCols, mapRows);
    const sheet = this.spriteSheets.get(layer.spriteSheet);
    const img = this.assets.images.get(layer.spriteSheet);
    if (!sheet || !img) return;

    for (let row = startRow; row < endRow; row++) {
      for (let col = startCol; col < endCol; col++) {
        const frameId = layer.data[row * mapCols + col];
        if (!frameId) continue;
        const frame = sheet.frames.get(frameId);
        if (!frame) continue;
        ctx.drawImage(img,
          frame.x, frame.y, frame.w, frame.h,
          col * tw - camera.x, row * th - camera.y, tw, th);
      }
    }
  }

  /** 渲染实体（带摄像机偏移+可见性裁剪） */
  renderEntityWithCamera(entity: Entity, camera: ScrollingCamera): void {
    if (!entity.visible) return;
    if (!camera.isVisible(entity.x, entity.y, entity.width, entity.height)) return;
    const { sx, sy } = camera.worldToScreen(entity.x, entity.y);
    // ... 使用 sx, sy 替代 entity.x, entity.y 绘制
  }
}
3.3 EntitySpawner（动态实体生成）
交通车辆需要在摄像机前方动态生成，后方回收：
export class EntitySpawner {
  private pool: Entity[] = [];
  private active: Entity[] = [];

  /** 在指定世界坐标生成实体 */
  spawn(template: string, x: number, y: number,
        fields: Record<string, unknown>,
        sceneManager: SceneManager): Entity {
    const def = sceneManager.getEntityDef(template)!;
    const inst: EntityInstanceRuntime = {
      id: `dyn_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      template, name: def.name,
      x, y, width: def.width, height: def.height,
      fields,
    };
    const entity = new Entity(inst, def, sceneManager);
    this.active.push(entity);
    return entity;
  }

  /** 回收视口外实体 */
  recycle(camera: ScrollingCamera, margin: number): Entity[] {
    const removed: Entity[] = [];
    this.active = this.active.filter(e => {
      if (e.y > camera.y + camera.viewH + margin * 32) {
        e.visible = false;
        this.pool.push(e);
        removed.push(e);
        return false;
      }
      return true;
    });
    return removed;
  }
}
4. 数据结构设计
4.1 project.mote.json
{
  "name": "Road Rash 2D",
  "version": "1.0.0",
  "engine": "mote-0.1",
  "tileWidth": 32,
  "tileHeight": 32,
  "spriteSheets": [
    "sheets/road-tiles.sprite.json",
    "sheets/bikes.sprite.json",
    "sheets/vehicles.sprite.json",
    "sheets/effects.sprite.json",
    "sheets/scenery.sprite.json",
    "sheets/ui.sprite.json"
  ],
  "entities": [
    "entities/player-bike.entity.json",
    "entities/opponent-bike.entity.json",
    "entities/traffic-vehicle.entity.json",
    "entities/police-bike.entity.json",
    "entities/weapon-pickup.entity.json",
    "entities/nitro-pickup.entity.json",
    "entities/health-pickup.entity.json",
    "entities/road-hazard.entity.json",
    "entities/race-controller.entity.json"
  ],
  "scenes": [
    "scenes/menu.map.json",
    "scenes/garage.map.json",
    "scenes/track-city.map.json",
    "scenes/track-mountain.map.json",
    "scenes/track-desert.map.json",
    "scenes/track-coast.map.json",
    "scenes/track-night.map.json"
  ],
  "scripts": "scripts",
  "startScene": "menu"
}
4.2 精灵图集 (Sprite Sheets)
bikes.sprite.json
{
  "id": "bikes",
  "name": "Motorcycles",
  "image": "../images/bikes.png",
  "imageWidth": 256,
  "imageHeight": 256,
  "slicing": { "mode": "packed" },
  "frames": {
    "player_up":          { "x": 0,  "y": 0,  "w": 16, "h": 24 },
    "player_lean_left":   { "x": 16, "y": 0,  "w": 16, "h": 24 },
    "player_lean_right":  { "x": 32, "y": 0,  "w": 16, "h": 24 },
    "player_attack_left": { "x": 48, "y": 0,  "w": 24, "h": 24 },
    "player_attack_right":{ "x": 72, "y": 0,  "w": 24, "h": 24 },
    "player_crash_1":     { "x": 96, "y": 0,  "w": 24, "h": 24 },
    "player_crash_2":     { "x": 120,"y": 0,  "w": 24, "h": 24 },
    "player_nitro":       { "x": 144,"y": 0,  "w": 16, "h": 28 },

    "opponent_red_up":          { "x": 0,  "y": 24, "w": 16, "h": 24 },
    "opponent_red_lean_left":   { "x": 16, "y": 24, "w": 16, "h": 24 },
    "opponent_red_lean_right":  { "x": 32, "y": 24, "w": 16, "h": 24 },
    "opponent_red_attack_left": { "x": 48, "y": 24, "w": 24, "h": 24 },
    "opponent_red_attack_right":{ "x": 72, "y": 24, "w": 24, "h": 24 },
    "opponent_red_crash":       { "x": 96, "y": 24, "w": 24, "h": 24 },

    "opponent_blue_up":         { "x": 0,  "y": 48, "w": 16, "h": 24 },
    "opponent_blue_lean_left":  { "x": 16, "y": 48, "w": 16, "h": 24 },
    "opponent_blue_lean_right": { "x": 32, "y": 48, "w": 16, "h": 24 },
    "opponent_blue_attack_left":{ "x": 48, "y": 48, "w": 24, "h": 24 },
    "opponent_blue_crash":      { "x": 96, "y": 48, "w": 24, "h": 24 },

    "opponent_green_up":        { "x": 0,  "y": 72, "w": 16, "h": 24 },
    "opponent_green_lean_left": { "x": 16, "y": 72, "w": 16, "h": 24 },
    "opponent_green_lean_right":{ "x": 32, "y": 72, "w": 16, "h": 24 },
    "opponent_green_crash":     { "x": 96, "y": 72, "w": 24, "h": 24 },

    "police_up":          { "x": 0,  "y": 96, "w": 16, "h": 24 },
    "police_lean_left":   { "x": 16, "y": 96, "w": 16, "h": 24 },
    "police_lean_right":  { "x": 32, "y": 96, "w": 16, "h": 24 },

    "sport_up":           { "x": 0,  "y": 120, "w": 16, "h": 24 },
    "cruiser_up":         { "x": 16, "y": 120, "w": 16, "h": 24 },
    "superbike_up":       { "x": 32, "y": 120, "w": 16, "h": 24 }
  }
}
road-tiles.sprite.json
{
  "id": "road-tiles",
  "name": "Road Tiles",
  "image": "../images/road-tiles.png",
  "imageWidth": 128,
  "imageHeight": 128,
  "slicing": { "mode": "grid", "tileWidth": 16, "tileHeight": 16 },
  "frames": {
    "asphalt":     { "x": 0,  "y": 0,  "w": 16, "h": 16 },
    "lane_dash":   { "x": 16, "y": 0,  "w": 16, "h": 16 },
    "lane_solid":  { "x": 32, "y": 0,  "w": 16, "h": 16 },
    "shoulder_l":  { "x": 48, "y": 0,  "w": 16, "h": 16 },
    "shoulder_r":  { "x": 64, "y": 0,  "w": 16, "h": 16 },
    "curb_l":      { "x": 80, "y": 0,  "w": 16, "h": 16, "collider": [{"type":"full"}] },
    "curb_r":      { "x": 96, "y": 0,  "w": 16, "h": 16, "collider": [{"type":"full"}] },
    "grass":       { "x": 0,  "y": 16, "w": 16, "h": 16, "collider": [{"type":"full"}] },
    "dirt":        { "x": 16, "y": 16, "w": 16, "h": 16 },
    "sand":        { "x": 32, "y": 16, "w": 16, "h": 16 },
    "barrier":     { "x": 48, "y": 16, "w": 16, "h": 16, "collider": [{"type":"full"}] },
    "start_line":  { "x": 64, "y": 16, "w": 16, "h": 16 },
    "finish_line": { "x": 80, "y": 16, "w": 16, "h": 16 },
    "oil_slick":   { "x": 96, "y": 16, "w": 16, "h": 16 },
    "pothole":     { "x": 0,  "y": 32, "w": 16, "h": 16 },
    "asphalt_wet": { "x": 16, "y": 32, "w": 16, "h": 16 },
    "road_arrow":  { "x": 32, "y": 32, "w": 16, "h": 16 }
  }
}
vehicles.sprite.json
{
  "id": "vehicles",
  "name": "Traffic Vehicles",
  "image": "../images/vehicles.png",
  "imageWidth": 128,
  "imageHeight": 128,
  "slicing": { "mode": "packed" },
  "frames": {
    "sedan_up":    { "x": 0,  "y": 0,  "w": 16, "h": 28 },
    "sedan_down":  { "x": 16, "y": 0,  "w": 16, "h": 28 },
    "truck_up":    { "x": 32, "y": 0,  "w": 16, "h": 40 },
    "truck_down":  { "x": 48, "y": 0,  "w": 16, "h": 40 },
    "bus_up":      { "x": 64, "y": 0,  "w": 16, "h": 44 },
    "bus_down":    { "x": 80, "y": 0,  "w": 16, "h": 44 },
    "police_car":  { "x": 96, "y": 0,  "w": 16, "h": 28 }
  }
}
4.3 实体定义 (Entity Definitions)
player-bike.entity.json
{
  "id": "player-bike",
  "name": "Player Bike",
  "sprite": "bikes:player_up",
  "shape": "rect",
  "width": 32,
  "height": 48,
  "script": "scripts/player-bike.ts",
  "collider": [{ "type": "aabb", "x": 4, "y": 8, "w": 24, "h": 32 }],
  "fields": [
    { "id": "bikeType",      "type": "string",  "default": "street" },
    { "id": "maxSpeed",      "type": "number",  "default": 160 },
    { "id": "acceleration",  "type": "number",  "default": 70 },
    { "id": "handling",      "type": "number",  "default": 6 },
    { "id": "durability",    "type": "number",  "default": 100 },
    { "id": "health",        "type": "number",  "default": 100 },
    { "id": "currentSpeed",  "type": "number",  "default": 0 },
    { "id": "lane",          "type": "number",  "default": 2 },
    { "id": "targetLane",    "type": "number",  "default": 2 },
    { "id": "laneProgress",  "type": "number",  "default": 1.0 },
    { "id": "weapon",        "type": "string",  "default": "fist" },
    { "id": "nitro",         "type": "number",  "default": 0 },
    { "id": "nitroActive",   "type": "boolean", "default": false },
    { "id": "crashed",       "type": "boolean", "default": false },
    { "id": "crashTimer",    "type": "number",  "default": 0 },
    { "id": "attackCooldown","type": "number",  "default": 0 },
    { "id": "attackAnim",    "type": "string",  "default": "" },
    { "id": "distance",      "type": "number",  "default": 0 }
  ]
}
opponent-bike.entity.json
{
  "id": "opponent-bike",
  "name": "Opponent Bike",
  "sprite": "bikes:opponent_red_up",
  "shape": "rect",
  "width": 32,
  "height": 48,
  "script": "scripts/opponent-ai.ts",
  "collider": [{ "type": "aabb", "x": 4, "y": 8, "w": 24, "h": 32 }],
  "fields": [
    { "id": "riderName",      "type": "string",  "default": "Rival" },
    { "id": "color",          "type": "string",  "default": "red" },
    { "id": "maxSpeed",       "type": "number",  "default": 150 },
    { "id": "acceleration",   "type": "number",  "default": 65 },
    { "id": "handling",       "type": "number",  "default": 5 },
    { "id": "health",         "type": "number",  "default": 100 },
    { "id": "currentSpeed",   "type": "number",  "default": 0 },
    { "id": "lane",           "type": "number",  "default": 1 },
    { "id": "targetLane",     "type": "number",  "default": 1 },
    { "id": "weapon",         "type": "string",  "default": "fist" },
    { "id": "aggressiveness", "type": "number",  "default": 50 },
    { "id": "skillLevel",     "type": "number",  "default": 50 },
    { "id": "crashed",        "type": "boolean", "default": false },
    { "id": "crashTimer",     "type": "number",  "default": 0 },
    { "id": "distance",       "type": "number",  "default": 0 },
    { "id": "finished",       "type": "boolean", "default": false }
  ]
}
traffic-vehicle.entity.json
{
  "id": "traffic-vehicle",
  "name": "Traffic Vehicle",
  "sprite": "vehicles:sedan_up",
  "shape": "rect",
  "width": 32,
  "height": 56,
  "script": "scripts/traffic-vehicle.ts",
  "collider": [{ "type": "aabb", "x": 2, "y": 4, "w": 28, "h": 48 }],
  "fields": [
    { "id": "vehicleType", "type": "string",  "default": "sedan" },
    { "id": "speed",       "type": "number",  "default": 60 },
    { "id": "direction",   "type": "string",  "default": "up" },
    { "id": "lane",        "type": "number",  "default": 2 }
  ]
}
race-controller.entity.json
{
  "id": "race-controller",
  "name": "Race Controller",
  "sprite": null,
  "shape": "point",
  "width": 1,
  "height": 1,
  "script": "scripts/race-manager.ts",
  "collider": null,
  "fields": [
    { "id": "trackLength",    "type": "number",  "default": 1500 },
    { "id": "raceStarted",    "type": "boolean", "default": false },
    { "id": "raceFinished",   "type": "boolean", "default": false },
    { "id": "countdown",      "type": "number",  "default": 4 },
    { "id": "raceTime",       "type": "number",  "default": 0 },
    { "id": "playerPosition", "type": "number",  "default": 6 },
    { "id": "trafficDensity", "type": "number",  "default": 0.3 },
    { "id": "policeEnabled",  "type": "boolean", "default": false }
  ]
}
weapon-pickup.entity.json / nitro-pickup.entity.json / road-hazard.entity.json
// weapon-pickup.entity.json
{
  "id": "weapon-pickup", "name": "Weapon Pickup",
  "sprite": "effects:pickup_weapon", "shape": "rect",
  "width": 32, "height": 32,
  "script": "scripts/weapon-pickup.ts",
  "collider": [{ "type": "aabb", "x": 4, "y": 4, "w": 24, "h": 24 }],
  "fields": [
    { "id": "weaponType", "type": "string",  "default": "chain" },
    { "id": "collected",  "type": "boolean", "default": false }
  ]
}
// road-hazard.entity.json
{
  "id": "road-hazard", "name": "Road Hazard",
  "sprite": "road-tiles:oil_slick", "shape": "rect",
  "width": 64, "height": 32,
  "script": "scripts/road-hazard.ts",
  "collider": [{ "type": "aabb", "x": 0, "y": 0, "w": 64, "h": 32 }],
  "fields": [
    { "id": "hazardType", "type": "string",  "default": "oil_slick" },
    { "id": "damage",     "type": "number",  "default": 15 },
    { "id": "slowdown",   "type": "number",  "default": 0.5 }
  ]
}
4.4 赛道场景设计
紧凑赛道定义格式（构建工具输入）
由于完整 tile 地图数据量大（21×1500 = 31500 个 tile），使用紧凑格式定义赛道，通过构建脚本生成完整 .map.json：
{
  "id": "track-city",
  "name": "城市高速公路",
  "length": 1500,
  "roadWidth": 5,
  "mapWidth": 21,
  "defaultRoadCenter": 10,
  "segments": [
    { "from": 0,    "to": 300,  "centerOffset": 0,  "scenery": "city" },
    { "from": 300,  "to": 450,  "centerOffset": 2,  "scenery": "city" },
    { "from": 450,  "to": 800,  "centerOffset": 2,  "scenery": "highway" },
    { "from": 800,  "to": 950,  "centerOffset": 0,  "scenery": "highway" },
    { "from": 950,  "to": 1100, "centerOffset": -2, "scenery": "bridge" },
    { "from": 1100, "to": 1500, "centerOffset": 0,  "scenery": "city" }
  ],
  "startLine": 1450,
  "finishLine": 50,
  "opponents": [
    { "riderName": "Viper",   "color": "red",   "startLane": 1, "startRow": 1460, "maxSpeed": 155, "aggressiveness": 70, "skillLevel": 65 },
    { "riderName": "Slash",   "color": "blue",  "startLane": 3, "startRow": 1465, "maxSpeed": 148, "aggressiveness": 80, "skillLevel": 55 },
    { "riderName": "Bones",   "color": "green", "startLane": 0, "startRow": 1470, "maxSpeed": 152, "aggressiveness": 40, "skillLevel": 70 },
    { "riderName": "Natasha", "color": "red",   "startLane": 4, "startRow": 1458, "maxSpeed": 158, "aggressiveness": 60, "skillLevel": 75 },
    { "riderName": "Rex",     "color": "blue",  "startLane": 2, "startRow": 1468, "maxSpeed": 145, "aggressiveness": 90, "skillLevel": 50 }
  ],
  "pickups": [
    { "type": "weapon", "weaponType": "chain",  "lane": 2, "row": 1200 },
    { "type": "weapon", "weaponType": "bat",    "lane": 0, "row": 800 },
    { "type": "weapon", "weaponType": "pipe",   "lane": 4, "row": 400 },
    { "type": "nitro",  "amount": 50,           "lane": 1, "row": 1000 },
    { "type": "nitro",  "amount": 50,           "lane": 3, "row": 600 },
    { "type": "health", "amount": 30,           "lane": 2, "row": 500 },
    { "type": "money",  "amount": 300,          "lane": 1, "row": 300 }
  ],
  "hazards": [
    { "type": "oil_slick", "lane": 1, "row": 1100, "width": 2 },
    { "type": "pothole",   "lane": 3, "row": 700,  "width": 1 },
    { "type": "oil_slick", "lane": 2, "row": 250,  "width": 2 }
  ]
}
生成的 .map.json 结构
{
  "id": "track-city",
  "name": "城市高速公路",
  "width": 672,
  "height": 48000,
  "tileWidth": 32,
  "tileHeight": 32,
  "spriteSheets": ["road-tiles", "scenery"],
  "layers": [
    {
      "id": "road-surface",
      "name": "Road Surface",
      "type": "tile",
      "spriteSheet": "road-tiles",
      "encoding": "names",
      "data": ["grass","grass","...(21×1500 tile names)..."]
    },
    {
      "id": "scenery-overlay",
      "name": "Scenery",
      "type": "tile",
      "spriteSheet": "scenery",
      "encoding": "names",
      "data": ["","","tree_1","...(路边装饰物)..."]
    },
    {
      "id": "race-entities",
      "name": "Race Entities",
      "type": "entity",
      "entities": [
        {
          "id": "race-ctrl", "template": "race-controller",
          "name": "RaceController", "x": 0, "y": 0,
          "width": 1, "height": 1,
          "fields": { "trackLength": 1500, "trafficDensity": 0.3 }
        },
        {
          "id": "player", "template": "player-bike",
          "name": "Player", "x": 320, "y": 46720,
          "width": 32, "height": 48, "fields": {}
        },
        {
          "id": "opp-viper", "template": "opponent-bike",
          "name": "Viper", "x": 256, "y": 46784,
          "width": 32, "height": 48,
          "fields": { "riderName": "Viper", "color": "red", "maxSpeed": 155, "aggressiveness": 70, "lane": 1 }
        }
      ]
    }
  ]
}
4.5 弯道原理图
地图宽 21 列，视口宽 13 列：

直道段 (centerOffset = 0):        弯道段 (centerOffset = +2):
  列: 0123456789012345678901          列: 0123456789012345678901
  ┌────────────────────┐              ┌────────────────────┐
  │GGG SL1L2CL3L4SR GGG│              │GGGGG SL1L2CL3L4SR G│
  │    ▲           ▲    │              │      ▲           ▲  │
  │  视口左边    视口右边  │              │   视口左边    视口右边│
  └────────────────────┘              └────────────────────┘
  G=草地 S=路肩 L=车道 C=中线 R=路肩     道路整体右移2列 → 弯道效果
  摄像机X居中于道路中心                  摄像机X跟踪新的道路中心
5. 脚本架构设计
5.1 EngineContext 扩展
import { EngineContext as BaseContext } from './engine-context-base';

export class RoadRashContext extends BaseContext {
  readonly camera: ScrollingCamera;
  readonly spawner: EntitySpawner;

  // Race state (shared across all scripts)
  raceState: RaceState;

  // Callbacks for UI
  private _onUpdateSpeedometer: ((speed: number, maxSpeed: number) => void) | null = null;
  private _onUpdateHealthBar: ((hp: number, maxHp: number) => void) | null = null;
  private _onUpdateNitroBar: ((nitro: number) => void) | null = null;
  private _onUpdatePosition: ((pos: number, total: number) => void) | null = null;
  private _onShowCountdown: ((n: number) => void) | null = null;
  private _onShowRaceResult: ((result: RaceResult) => void) | null = null;
  private _onShowDamageFlash: (() => void) | null = null;

  /** 获取指定车道、Y 范围内的实体 */
  getEntitiesInLane(lane: number, yMin: number, yMax: number): Entity[] {
    const laneX = this.laneToWorldX(lane);
    return this.entities.filter(e =>
      e.visible &&
      Math.abs(e.x - laneX) < 16 &&
      e.y >= yMin && e.y <= yMax
    );
  }

  /** 车道编号 → 世界 X 坐标 */
  laneToWorldX(lane: number): number {
    const roadCenter = this.getRoadCenterAtY(/* player Y */);
    return (roadCenter - 2 + lane) * 32;
  }

  /** 获取指定 Y 位置的道路中心列 */
  getRoadCenterAtY(worldY: number): number {
    // 从赛道 segment 数据计算
    return this.raceState.trackData.getCenterAt(Math.floor(worldY / 32));
  }

  // UI 回调注册
  onUpdateSpeedometer(fn: (speed: number, max: number) => void) { this._onUpdateSpeedometer = fn; }
  onUpdateHealthBar(fn: (hp: number, max: number) => void) { this._onUpdateHealthBar = fn; }
  onUpdateNitroBar(fn: (n: number) => void) { this._onUpdateNitroBar = fn; }
  onUpdatePosition(fn: (pos: number, total: number) => void) { this._onUpdatePosition = fn; }
  onShowCountdown(fn: (n: number) => void) { this._onShowCountdown = fn; }
  onShowRaceResult(fn: (r: RaceResult) => void) { this._onShowRaceResult = fn; }

  updateSpeedometer(speed: number, max: number) { this._onUpdateSpeedometer?.(speed, max); }
  updateHealthBar(hp: number, max: number) { this._onUpdateHealthBar?.(hp, max); }
  updateNitroBar(n: number) { this._onUpdateNitroBar?.(n); }
  updatePosition(pos: number, total: number) { this._onUpdatePosition?.(pos, total); }
  showCountdown(n: number) { this._onShowCountdown?.(n); }
  showRaceResult(r: RaceResult) { this._onShowRaceResult?.(r); }
  showDamageFlash() { this._onShowDamageFlash?.(); }
}
5.2 GameState
export interface BikeConfig {
  type: string;           // "street" | "sport" | "cruiser" | "superbike"
  maxSpeed: number;
  acceleration: number;
  handling: number;
  durability: number;
  upgrades: {
    engine: number;       // 0-3
    exhaust: number;      // 0-3
    suspension: number;   // 0-3
    armor: number;        // 0-3
  };
}

export interface RaceResult {
  trackId: string;
  position: number;       // 1-6
  time: number;           // seconds
  earnings: number;       // prize money
  knockdowns: number;     // enemies knocked down
}

export interface RaceState {
  trackId: string;
  raceStarted: boolean;
  raceFinished: boolean;
  raceTime: number;
  playerPosition: number;
  rankings: { entityId: string; distance: number }[];
  knockdownCount: number;
  policeAlertLevel: number; // 0-3
  trackData: TrackData;     // parsed from compact format
}

export interface GameState {
  // Progression
  money: number;
  currentLeague: number;       // 0=amateur, 1=pro, 2=legend
  completedRaces: Map<string, RaceResult>;

  // Bikes
  currentBike: string;
  ownedBikes: Map<string, BikeConfig>;

  // Player runtime (persisted between races)
  playerHealth: number;
  playerWeapon: string;
  playerNitro: number;
}

export function createInitialState(): GameState {
  return {
    money: 0,
    currentLeague: 0,
    completedRaces: new Map(),
    currentBike: 'street',
    ownedBikes: new Map([
      ['street', {
        type: 'street', maxSpeed: 160, acceleration: 70,
        handling: 6, durability: 100,
        upgrades: { engine: 0, exhaust: 0, suspension: 0, armor: 0 }
      }]
    ]),
    playerHealth: 100,
    playerWeapon: 'fist',
    playerNitro: 0,
  };
}
5.3 ScriptLifecycle 脚本设计
scripts/player-bike.ts — 玩家摩托控制
import { Entity } from '@mote/engine';
import type { ScriptLifecycle } from '@mote/engine';
import type { RoadRashContext } from '../src/engine-context';

export default class PlayerBikeScript implements ScriptLifecycle {
  private entity: Entity;
  private engine: RoadRashContext;

  constructor(entity: Entity, engine: unknown) {
    this.entity = entity;
    this.engine = engine as RoadRashContext;
  }

  update(dt: number): void {
    if (!this.engine.raceState.raceStarted) return;
    const e = this.entity;
    const crashed = e.getField<boolean>('crashed');
    if (crashed) { this.updateCrash(dt); return; }

    // === 加速/刹车 ===
    this.updateSpeed(dt);

    // === 变道 ===
    this.updateLane(dt);

    // === 攻击 ===
    this.updateAttack(dt);

    // === 氮气 ===
    this.updateNitro(dt);

    // === 位移 ===
    const speed = e.getField<number>('currentSpeed');
    const pxPerSec = speed * (1000 / 3600) / 3 * 32; // km/h → px/s
    e.y -= pxPerSec * dt; // Y 减小 = 向前行驶
    e.setField('distance', e.getField<number>('distance') + pxPerSec * dt);

    // === 更新精灵帧 ===
    this.updateFrame();

    // === 更新 HUD ===
    this.engine.updateSpeedometer(speed, e.getField<number>('maxSpeed'));
    this.engine.updateHealthBar(
      e.getField<number>('health'), e.getField<number>('durability'));
    this.engine.updateNitroBar(e.getField<number>('nitro'));
  }

  private updateSpeed(dt: number): void { /* input → acceleration/brake/drag */ }
  private updateLane(dt: number): void { /* smooth lane interpolation */ }
  private updateAttack(dt: number): void { /* cooldown, hit detection, damage */ }
  private updateNitro(dt: number): void { /* activate/deactivate/drain */ }
  private updateCrash(dt: number): void { /* crash recovery timer */ }
  private updateFrame(): void { /* set sprite based on state */ }

  onCollisionEnter(other: Entity): void {
    const template = other.templateId;
    if (template === 'traffic-vehicle' || template === 'opponent-bike') {
      this.handleVehicleCollision(other);
    } else if (template === 'weapon-pickup') {
      this.collectWeapon(other);
    } else if (template === 'nitro-pickup') {
      this.collectNitro(other);
    } else if (template === 'road-hazard') {
      this.hitHazard(other);
    }
  }

  private handleVehicleCollision(other: Entity): void { /* crash logic */ }
  private collectWeapon(other: Entity): void { /* pickup weapon */ }
  private collectNitro(other: Entity): void { /* add nitro */ }
  private hitHazard(other: Entity): void { /* apply hazard effect */ }

  onDestroy(): void { /* cleanup */ }
}
scripts/opponent-ai.ts — AI 对手
export default class OpponentAIScript implements ScriptLifecycle {
  constructor(entity: Entity, engine: unknown) { /* ... */ }

  update(dt: number): void {
    if (!this.engine.raceState.raceStarted) return;

    // 1. 目标速度（基于 maxSpeed + 橡皮筋调整）
    this.updateTargetSpeed();

    // 2. 避障变道（检测前方交通/障碍）
    this.avoidObstacles();

    // 3. 战斗决策（是否攻击相邻玩家）
    this.combatDecision();

    // 4. 应用速度和位移
    this.applyMovement(dt);

    // 5. 更新精灵帧
    this.updateFrame();
  }

  private updateTargetSpeed(): void {
    const myDist = this.entity.getField<number>('distance');
    const playerDist = this.engine.player!.getField<number>('distance');
    const diff = myDist - playerDist;
    // 橡皮筋：领先太多减速，落后太多加速
    const rubberBand = Math.max(-20, Math.min(20, -diff * 0.01));
    this.targetSpeed = this.entity.getField<number>('maxSpeed') + rubberBand;
  }

  private avoidObstacles(): void {
    // 扫描前方 5 格范围内的交通车辆和障碍物
    // 如果当前车道被阻挡，选择空闲车道变道
  }

  private combatDecision(): void {
    const aggro = this.entity.getField<number>('aggressiveness');
    // 如果玩家在相邻车道且 Y 距离 < 48px，以 aggro% 概率攻击
  }

  onCollisionEnter(other: Entity): void {
    // 与交通碰撞 → 减速或摔车
    // 被攻击 → 扣血
  }
}
scripts/race-manager.ts — 比赛管理器
export default class RaceManagerScript implements ScriptLifecycle {
  constructor(entity: Entity, engine: unknown) { /* ... */ }

  update(dt: number): void {
    const state = this.engine.raceState;

    // === 倒计时阶段 ===
    if (!state.raceStarted) {
      this.updateCountdown(dt);
      return;
    }
    if (state.raceFinished) return;

    // === 比赛计时 ===
    state.raceTime += dt;

    // === 动态交通生成/回收 ===
    this.manageTraffic(dt);

    // === 排名计算 ===
    this.updateRankings();

    // === 警察触发检查 ===
    this.checkPoliceAlert();

    // === 终点检测 ===
    this.checkFinishLine();
  }

  private manageTraffic(dt: number): void {
    const camera = this.engine.camera;
    // 回收摄像机后方的交通
    this.engine.spawner.recycle(camera, 10);
    // 在摄像机前方生成新交通（基于密度参数）
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTrafficVehicle();
      this.spawnTimer = 1.0 / density; // 基于密度的间隔
    }
  }

  private updateRankings(): void {
    // 按 distance 降序排列所有赛车手
    // 更新 playerPosition
    this.engine.updatePosition(state.playerPosition, totalRacers);
  }

  private checkFinishLine(): void {
    const finishY = this.entity.getField<number>('trackLength') * 32 * 0.033;
    // 检查每个赛车手是否越过终点线
  }
}
scripts/traffic-vehicle.ts — 交通车辆
export default class TrafficVehicleScript implements ScriptLifecycle {
  update(dt: number): void {
    const speed = this.entity.getField<number>('speed');
    const dir = this.entity.getField<string>('direction');
    const pxPerSec = speed * (1000 / 3600) / 3 * 32;
    // 同向车辆向上移动，对向车辆向下移动
    this.entity.y += (dir === 'up' ? -1 : 1) * pxPerSec * dt;
  }
  // 交通车辆不主动碰撞回调，由摩托车侧处理
}
scripts/weapon-pickup.ts — 武器拾取
export default class WeaponPickupScript implements ScriptLifecycle {
  onCollisionEnter(other: Entity): void {
    if (other.templateId !== 'player-bike' && other.templateId !== 'opponent-bike') return;
    if (this.entity.getField<boolean>('collected')) return;
    // 将武器赋予碰撞者
    const weaponType = this.entity.getField<string>('weaponType');
    other.setField('weapon', weaponType);
    this.entity.setField('collected', true);
    this.entity.visible = false;
    this.engine.removeEntity(this.entity);
  }
}
scripts/road-hazard.ts — 路面障碍
export default class RoadHazardScript implements ScriptLifecycle {
  onCollisionEnter(other: Entity): void {
    if (other.templateId !== 'player-bike' && other.templateId !== 'opponent-bike') return;
    const damage = this.entity.getField<number>('damage');
    const slowdown = this.entity.getField<number>('slowdown');
    // 扣血
    const hp = other.getField<number>('health');
    other.setField('health', Math.max(0, hp - damage));
    // 减速
    const speed = other.getField<number>('currentSpeed');
    other.setField('currentSpeed', speed * slowdown);
    // 如果是玩家，闪烁提示
    if (other.templateId === 'player-bike') {
      this.engine.showDamageFlash();
    }
  }
}
5.4 工具模块
scripts/combat.ts — 战斗计算
export interface WeaponData {
  name: string;
  range: number;      // pixels
  damage: number;
  cooldown: number;    // seconds
  knockback: number;   // px
}

export const WEAPONS: Record<string, WeaponData> = {
  fist:  { name: '拳击', range: 36, damage: 8,  cooldown: 0.3, knockback: 5  },
  chain: { name: '铁链', range: 52, damage: 18, cooldown: 0.5, knockback: 10 },
  bat:   { name: '球棒', range: 40, damage: 28, cooldown: 0.7, knockback: 15 },
  pipe:  { name: '撬棍', range: 44, damage: 22, cooldown: 0.4, knockback: 8  },
};

/** 执行攻击判定，返回是否命中 */
export function performAttack(
  attacker: Entity, direction: 'left' | 'right',
  targets: Entity[], weapon: WeaponData
): Entity | null {
  const ax = attacker.x;
  const ay = attacker.y + attacker.height / 2;
  for (const t of targets) {
    const tx = t.x;
    const ty = t.y + t.height / 2;
    const dx = direction === 'left' ? ax - tx : tx - ax;
    const dy = Math.abs(ay - ty);
    if (dx > 0 && dx < weapon.range && dy < weapon.range) {
      // 命中！
      const hp = t.getField<number>('health');
      t.setField('health', Math.max(0, hp - weapon.damage));
      return t;
    }
  }
  return null;
}

/** 检查是否触发摔车 */
export function checkCrash(entity: Entity): boolean {
  return entity.getField<number>('health') <= 0;
}

/** 执行摔车 */
export function triggerCrash(entity: Entity): void {
  entity.setField('crashed', true);
  entity.setField('crashTimer', 2.5); // 2.5 秒恢复
  entity.setField('currentSpeed', 0);
}

/** 摔车恢复 */
export function recoverFromCrash(entity: Entity): void {
  entity.setField('crashed', false);
  entity.setField('crashTimer', 0);
  entity.setField('health', entity.getField<number>('durability') * 0.3);
}
scripts/physics.ts — 速度物理
/** 加速度公式：基于油门、当前速度、极速的关系 */
export function calculateAcceleration(
  currentSpeed: number, maxSpeed: number,
  accelStat: number, throttle: boolean, brake: boolean
): number {
  if (brake) return -accelStat * 2.5; // 刹车力度是加速的 2.5 倍
  if (!throttle) return -accelStat * 0.3; // 自然减速（风阻）
  // 加速力随接近极速而衰减
  const ratio = currentSpeed / maxSpeed;
  return accelStat * (1 - ratio * ratio);
}

/** km/h → pixels/second (1 tile = 32px ≈ 3m) */
export function speedToPxPerSec(kmh: number): number {
  return kmh * (1000 / 3600) / 3 * 32; // ≈ kmh * 2.963
}

/** 车道插值（平滑变道） */
export function interpolateLane(
  currentX: number, targetX: number,
  handling: number, dt: number
): number {
  const laneChangeSpeed = handling * 80; // px/s
  const diff = targetX - currentX;
  if (Math.abs(diff) < 1) return targetX;
  const step = Math.sign(diff) * Math.min(Math.abs(diff), laneChangeSpeed * dt);
  return currentX + step;
}
scripts/bike-data.ts — 摩托车数据
export interface BikeStats {
  type: string;
  name: string;
  maxSpeed: number;
  acceleration: number;
  handling: number;
  durability: number;
  price: number;
  sprite: string; // frame prefix in bikes.sprite.json
}

export const BIKES: Record<string, BikeStats> = {
  street:    { type: 'street',    name: '街车',   maxSpeed: 160, acceleration: 70, handling: 6, durability: 100, price: 0,     sprite: 'player' },
  sport:     { type: 'sport',     name: '运动',   maxSpeed: 190, acceleration: 85, handling: 5, durability: 90,  price: 8000,  sprite: 'sport' },
  cruiser:   { type: 'cruiser',   name: '重机',   maxSpeed: 150, acceleration: 60, handling: 4, durability: 140, price: 6000,  sprite: 'cruiser' },
  superbike: { type: 'superbike', name: '超跑',   maxSpeed: 220, acceleration: 95, handling: 7, durability: 80,  price: 15000, sprite: 'superbike' },
};

export const UPGRADES = {
  engine:     { levels: [0, 10, 20, 30], costs: [0, 2000, 4000, 8000] },
  exhaust:    { levels: [0, 8, 15, 25],  costs: [0, 1500, 3000, 6000] },
  suspension: { levels: [0, 1, 2, 3],    costs: [0, 1000, 2000, 4000] },
  armor:      { levels: [0, 15, 30, 50], costs: [0, 1200, 2500, 5000] },
};

export function getEffectiveStats(bike: BikeConfig): BikeStats {
  const base = BIKES[bike.type];
  return {
    ...base,
    maxSpeed:     base.maxSpeed + UPGRADES.engine.levels[bike.upgrades.engine],
    acceleration: base.acceleration + UPGRADES.exhaust.levels[bike.upgrades.exhaust],
    handling:     base.handling + UPGRADES.suspension.levels[bike.upgrades.suspension],
    durability:   base.durability + UPGRADES.armor.levels[bike.upgrades.armor],
  };
}
6. 渲染策略
6.1 渲染流程（每帧）
1. ctx.clearRect() 清屏
2. ctx.save() + ctx.translate(-camera.x, -camera.y) 应用摄像机
3. 渲染 road-surface 层（仅可见 tile 行列）
4. 渲染 scenery-overlay 层（仅可见 tile 行列）
5. 收集所有可见实体，按 Y 坐标排序（远处先画）
6. 逐个渲染实体（带精灵帧）
7. ctx.restore() 还原变换
8. 渲染 HUD（不受摄像机影响，固定屏幕位置）
6.2 Y 排序渲染
俯视角游戏中 Y 值较大（更靠近屏幕下方）的实体应后绘制（覆盖在前），实现伪深度感：
const visibleEntities = entities
  .filter(e => e.visible && camera.isVisible(e.x, e.y, e.width, e.height))
  .sort((a, b) => a.y - b.y); // Y 小的先画（远处）

for (const entity of visibleEntities) {
  renderer.renderEntityWithCamera(entity, camera);
}
6.3 速度感特效
- 速度线：当速度 > 120 km/h，在画面两侧绘制半透明白色短线，数量和长度随速度增加
- 背景模糊感：路旁景物快速掠过本身就产生速度感
- 氮气特效：激活时在摩托后方绘制蓝色火焰帧
7. 碰撞系统设计
7.1 碰撞分组
碰撞对
检测方式
响应
摩托 ↔ 摩托
AABB
推挤/弹开，若速度差大则摔车
摩托 ↔ 交通车辆
AABB
摩托减速/摔车
摩托 ↔ 道具
AABB
拾取道具，道具消失
摩托 ↔ 路面障碍
AABB
扣血+减速
摩托 ↔ 路肩/护栏
Tile collider
弹回+减速
攻击 ↔ 摩托
范围判定
扣血，可能触发摔车
7.2 碰撞检测流程（每帧 update）
// 1. 宽相：仅检测可见实体（摄像机视口 + margin）
const visibleEntities = entities.filter(e =>
  camera.isVisible(e.x, e.y - 64, e.width, e.height + 128));

// 2. AABB 碰撞对检测
for (let i = 0; i < visibleEntities.length; i++) {
  for (let j = i + 1; j < visibleEntities.length; j++) {
    const a = visibleEntities[i], b = visibleEntities[j];
    if (CollisionSystem.testAABB(a.getBounds(), b.getBounds())) {
      scriptRuntime.notifyCollisionEnter(a.id, b);
      scriptRuntime.notifyCollisionEnter(b.id, a);
    }
  }
}

// 3. Tile 碰撞（摩托 vs 路肩/护栏）
for (const bike of bikeEntities) {
  const tileCol = Math.floor(bike.x / 32);
  const tileRow = Math.floor(bike.y / 32);
  const tileFrame = getTileFrameAt(tileCol, tileRow);
  if (tileFrame?.collider) {
    handleTileCollision(bike, tileCol, tileRow);
  }
}
8. 性能优化
策略
说明
视口裁剪
仅渲染摄像机可见范围内的 tile 和实体
实体回收池
交通车辆复用，避免频繁 GC
碰撞过滤
仅检测可见区域内实体的碰撞
帧预算
update + render 控制在 12ms 内（留余量给浏览器）
距离裁剪
距玩家 > 40 格的 AI 使用简化逻辑（仅更新距离）
9. 完整文件结构
road-rash/
├── public/
│   ├── project.mote.json            # mote 项目描述
│   ├── images/
│   │   ├── bikes.png                # 摩托精灵图 (256×256)
│   │   ├── road-tiles.png           # 道路 tile 图 (128×128)
│   │   ├── vehicles.png             # 交通车辆图 (128×128)
│   │   ├── effects.png              # 特效/道具图 (128×128)
│   │   ├── scenery.png              # 路旁景物图 (256×128)
│   │   └── ui.png                   # UI 元素图 (128×64)
│   ├── sheets/
│   │   ├── bikes.sprite.json
│   │   ├── road-tiles.sprite.json
│   │   ├── vehicles.sprite.json
│   │   ├── effects.sprite.json
│   │   ├── scenery.sprite.json
│   │   └── ui.sprite.json
│   ├── entities/
│   │   ├── player-bike.entity.json
│   │   ├── opponent-bike.entity.json
│   │   ├── traffic-vehicle.entity.json
│   │   ├── police-bike.entity.json
│   │   ├── weapon-pickup.entity.json
│   │   ├── nitro-pickup.entity.json
│   │   ├── health-pickup.entity.json
│   │   ├── road-hazard.entity.json
│   │   └── race-controller.entity.json
│   └── scenes/
│       ├── menu.map.json
│       ├── garage.map.json
│       ├── track-city.map.json
│       ├── track-mountain.map.json
│       ├── track-desert.map.json
│       ├── track-coast.map.json
│       └── track-night.map.json
├── src/
│   ├── main.ts                      # 入口：init + GameLoop + update/render
│   ├── engine-context.ts            # RoadRashContext (扩展 EngineContext)
│   ├── game-state.ts                # GameState + 存档
│   ├── canvas-loader.ts             # 沿用 Magic Tower 的混合加载器
│   ├── canvas-renderer.ts           # 增强版 Canvas2D 渲染器（带摄像机）
│   ├── scrolling-camera.ts          # 滚动摄像机
│   ├── entity-spawner.ts            # 动态实体生成/回收池
│   └── track-generator.ts           # 紧凑赛道 → mote scene 转换
├── scripts/
│   ├── player-bike.ts               # 玩家摩托控制 (ScriptLifecycle)
│   ├── opponent-ai.ts               # AI 对手 (ScriptLifecycle)
│   ├── traffic-vehicle.ts           # 交通车辆 (ScriptLifecycle)
│   ├── police-ai.ts                 # 警察 AI (ScriptLifecycle)
│   ├── race-manager.ts              # 比赛管理器 (ScriptLifecycle)
│   ├── weapon-pickup.ts             # 武器拾取 (ScriptLifecycle)
│   ├── road-hazard.ts               # 路面障碍 (ScriptLifecycle)
│   ├── nitro-pickup.ts              # 氮气拾取 (ScriptLifecycle)
│   ├── combat.ts                    # 战斗计算工具
│   ├── physics.ts                   # 速度/物理工具
│   └── bike-data.ts                 # 摩托车数据定义
├── tools/
│   └── generate-tracks.ts           # 从紧凑格式生成 .map.json 的构建脚本
├── index.html                       # HUD 布局 + Canvas
├── package.json
├── tsconfig.json
└── vite.config.ts                   # 沿用 Magic Tower 的配置模式
10. 与 Magic Tower 的代码复用
模块
复用方式
canvas-loader.ts
直接复用，dummy GPU 对象方案不变
vite.config.ts
复用脚本入口点动态发现模式
ActionMap 模式
相同设计模式，不同按键绑定
ScriptLifecycle 模式
相同 export default class + 生命周期钩子
EngineContext 模式
扩展而非重写，添加竞速专用 API
项目结构
相同的 public/src/scripts 三层结构
这验证了 mote 引擎的通用性：从回合制 RPG 到实时竞速格斗，核心 API 全程适用，仅需针对游戏类型扩展 EngineContext 和渲染器。