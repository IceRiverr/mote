1. 项目概述
1.1 目标
使用 mote 引擎 + 编辑器开发一款经典 魔塔 (Magic Tower) RPG 游戏，包含 8 层塔，实现魔塔游戏的所有核心玩法。本项目同时作为 mote 引擎对 回合制 RPG / 网格策略 类游戏的能力验证。
1.2 游戏简介
魔塔是一种经典的固定视角、回合制、网格移动 RPG：
- 玩家在一座多层塔中逐层探索
- 每层是 13×13 的网格地图（含外墙）
- 所有敌人 明雷 可见，战斗 纯数值确定性 —— 无随机
- 核心策略：规划钥匙/道具/战斗顺序，以最少代价通关
- 终极目标：击败第 8 层 BOSS，逃出魔塔
1.3 验证引擎能力
引擎能力
魔塔中的验证场景
SceneManager.loadScene()
8 层楼切换
Entity.getField() / setField()
怪物 HP/ATK/DEF、门颜色、钥匙类型等属性
ScriptRuntime 生命周期
战斗脚本、拾取脚本、NPC 对话脚本、楼梯脚本
onInteract() 回调
玩家踩到怪物/道具/NPC 触发交互
TileMapRenderer
地板/墙壁/装饰渲染
CollisionSystem (AABB)
阻挡墙壁、门碰撞
Camera2D
固定视角居中 + 楼层切换动画
InputManager + ActionMap
四方向网格移动
Entity.setFrame()
怪物击杀后消失、门打开动画
ProjectLoader
加载完整 mote 项目

---
2. 核心玩法机制
2.1 玩家属性
属性
初始值
说明
HP
1000
生命值，归零 = 游戏结束
ATK
10
攻击力
DEF
10
防御力
Gold
0
金币，用于商店购买
EXP
0
经验值（可选升级系统）
Level
1
等级
yellowKeys
1
黄钥匙数量
blueKeys
0
蓝钥匙数量
redKeys
0
红钥匙数量
2.2 战斗系统（确定性回合制）
战斗发生在玩家 移动到怪物所在格子 时，纯数值计算：
playerDmgPerHit = max(0, player.ATK - monster.DEF)
monsterDmgPerHit = max(0, monster.ATK - player.DEF)

if (playerDmgPerHit == 0):
    → 无法击败，阻止移动，显示提示

hitsToKill = ceil(monster.HP / playerDmgPerHit)
totalDamage = (hitsToKill - 1) * monsterDmgPerHit

if (player.HP <= totalDamage):
    → 玩家死亡（或阻止并提示）

player.HP -= totalDamage
player.Gold += monster.gold
player.EXP += monster.exp
→ 怪物从地图消失
关键：战斗结果在踏入前即可预算，玩家可通过「怪物手册」查看每只怪的预期伤害。
2.3 钥匙与门
门类型
对应钥匙
获取难度
颜色
黄门
黄钥匙
常见
#FFD700
蓝门
蓝钥匙
稀有
#4169E1
红门
红钥匙
极稀有
#DC143C
- 玩家面朝门移动时，若有对应钥匙 → 消耗钥匙，门消失，路径打通
- 无钥匙 → 阻止移动，显示提示
2.4 道具系统
道具
效果
出现频率
红药水
HP +200
常见
蓝药水
HP +500
稀有
红宝石
ATK +3
常见
蓝宝石
DEF +3
常见
绿宝石
ATK +5, DEF +5
稀有
铁剑
ATK +10
稀有，唯一
铁盾
DEF +10
稀有，唯一
圣剑
ATK +30
极稀有，唯一
圣盾
DEF +30
极稀有，唯一
十字架
对不死系怪物伤害 ×3
唯一，关键道具
怪物手册
解锁怪物图鉴功能
唯一
传送器
在已到达楼层间传送
唯一
2.5 NPC 系统
NPC 类型
功能
老人
给予提示/剧情信息
商人
花费 Gold 购买 HP/ATK/DEF
小偷
偷取敌人钥匙（特殊事件）
公主
最终救援目标（第 8 层）
商人交易表：
购买项
价格
效果
体力
25 Gold
HP +800
攻击
25 Gold
ATK +4
防御
25 Gold
DEF +4
2.6 楼梯系统
- 每层有 上楼梯 和/或 下楼梯
- 楼梯实体记录 direction（up/down）、targetFloor、targetX、targetY
- 踩到楼梯 → 切换 Scene + 将玩家放置在目标位置
- 传送器：解锁后可在已到达楼层间任意传送（UI 选择界面）
2.7 特殊机关
机关
说明
岩浆地板
踩上去扣 HP
传送门
踏入后传送到指定位置
触发墙
击败特定怪物后墙壁消失
事件触发器
踩到触发剧情/开启隐藏通道

---
3. 怪物设计（8 层）
3.1 怪物列表
ID
名称
HP
ATK
DEF
Gold
EXP
分布楼层
标签
slime_green
绿色史莱姆
50
20
1
1
1
1-2
slime
slime_red
红色史莱姆
70
15
2
2
2
1-3
slime
bat
蝙蝠
100
20
5
3
3
1-3
flying
skeleton
骷髅兵
110
25
5
5
4
2-4
undead
skeleton_warrior
骷髅武士
150
40
20
8
6
3-5
undead
mage
初级法师
100
60
10
10
7
3-5
mage
orc
兽人武士
200
45
25
12
8
4-6
orc
orc_captain
兽人队长
300
65
30
15
10
5-7
orc
great_mage
高级法师
250
80
20
18
12
5-7
mage
dark_knight
黑暗骑士
400
90
50
20
15
6-8
knight
spirit
幽灵
300
120
30
22
16
6-8
undead,spirit
vampire
吸血鬼
500
100
60
25
18
7-8
undead
dragon
红龙
800
150
80
40
25
7-8
dragon
demon_lord
魔王（BOSS）
2000
200
100
100
50
8
boss
3.2 特殊怪物能力
- 幽灵 (spirit)：需要「十字架」道具才能战斗（否则无法打），实际战斗时十字架使玩家 ATK ×3
- 吸血鬼 (vampire)：每回合回复固定 HP（战斗轮数 +1）
- 魔王 (demon_lord)：分两阶段，第一阶段 HP 降至 0 后短暂恢复 500 HP 进入第二阶段

---
4. 8 层塔设计
每层地图 13×13 格（含外墙，实际可行走区域 11×11）。
4.1 楼层概览
楼层
主题
主要怪物
关键道具
特色机关
1F
入口大厅
绿色/红色史莱姆, 蝙蝠
怪物手册, 红药水×3
教学引导 NPC
2F
地牢
蝙蝠, 骷髅兵
铁剑, 蓝钥匙×1
暗门（击杀触发）
3F
法师书房
骷髅武士, 初级法师
铁盾, 红宝石×2
传送门陷阱
4F
兽人营地
兽人武士, 初级法师
商人 NPC, 传送器
商店系统解锁
5F
暗影走廊
兽人队长, 高级法师
十字架, 蓝宝石×3
岩浆地板
6F
幽灵之间
黑暗骑士, 幽灵
圣剑, 红钥匙×1
幽灵需十字架
7F
龙之巢穴
吸血鬼, 红龙
圣盾, 蓝药水×2
龙守护红门
8F
魔王宝座
魔王
公主（通关目标）
BOSS 两阶段战
4.2 层间路线图
1F ─(上楼梯)─→ 2F ─(上楼梯)─→ 3F ─(上楼梯)─→ 4F
                                                  │
8F ←(上楼梯)── 7F ←(上楼梯)── 6F ←(上楼梯)── 5F
- 部分楼层可能有 回退需求（下楼获取遗漏道具再上楼）
- 传送器（4F 获得）允许快速跳转已到达楼层

---
5. mote 数据结构映射
5.1 项目清单 — project.mote.json
{
  "name": "Magic Tower",
  "version": "1.0.0",
  "engine": "mote-0.1",
  "tileWidth": 32,
  "tileHeight": 32,
  "spriteSheets": [
    "sheets/tower-tiles.sprite.json",
    "sheets/characters.sprite.json",
    "sheets/items.sprite.json",
    "sheets/ui.sprite.json"
  ],
  "entities": [
    "entities/player.entity.json",
    "entities/monster.entity.json",
    "entities/door.entity.json",
    "entities/key.entity.json",
    "entities/potion.entity.json",
    "entities/gem.entity.json",
    "entities/equipment.entity.json",
    "entities/special_item.entity.json",
    "entities/stair.entity.json",
    "entities/npc.entity.json",
    "entities/shop.entity.json",
    "entities/lava.entity.json",
    "entities/teleporter.entity.json",
    "entities/trigger_wall.entity.json",
    "entities/event_trigger.entity.json"
  ],
  "scenes": [
    "scenes/floor-1.map.json",
    "scenes/floor-2.map.json",
    "scenes/floor-3.map.json",
    "scenes/floor-4.map.json",
    "scenes/floor-5.map.json",
    "scenes/floor-6.map.json",
    "scenes/floor-7.map.json",
    "scenes/floor-8.map.json"
  ],
  "scripts": "scripts",
  "startScene": "floor-1"
}
5.2 SpriteSheet 定义
sheets/tower-tiles.sprite.json
16×16 像素 tile（渲染时缩放到 32×32），128×128 图片，8×8 grid = 64 帧：
帧 ID
用途
floor_stone
地板（石砖）
floor_dark
地板（暗石砖）
wall_gray
墙壁（灰石，带 full collider）
wall_dark
墙壁（暗石，带 full collider）
door_yellow / door_blue / door_red
三色门
door_open
已开门
stair_up / stair_down
楼梯
lava / teleport_pad
特殊地板
sheets/characters.sprite.json
玩家 4 方向 + 14 种怪物 + 4 个 NPC = 22 帧，packed 模式。
sheets/items.sprite.json
钥匙(3) + 药水(2) + 宝石(3) + 装备(4) + 特殊道具(3) = 15 帧。
5.3 EntityDef 定义（15 个模板）
entities/monster.entity.json — 通用怪物模板
{
  "id": "monster",
  "name": "Monster",
  "sprite": "characters:slime_green",
  "shape": "rect",
  "width": 32, "height": 32,
  "resizable": false,
  "color": "#FF4444",
  "icon": "👹",
  "script": "scripts/monster.ts",
  "collider": [{ "type": "full" }],
  "fields": [
    { "id": "monsterType", "label": "怪物类型", "type": "string", "default": "slime_green" },
    { "id": "hp",    "label": "HP",    "type": "number", "default": 50 },
    { "id": "atk",   "label": "ATK",   "type": "number", "default": 20 },
    { "id": "def",   "label": "DEF",   "type": "number", "default": 1 },
    { "id": "gold",  "label": "Gold",  "type": "number", "default": 1 },
    { "id": "exp",   "label": "EXP",   "type": "number", "default": 1 },
    { "id": "tags",  "label": "标签",   "type": "string", "default": "slime" },
    { "id": "boss",  "label": "是否BOSS", "type": "bool", "default": false }
  ]
}
编辑器工作流：放置 monster 模板 → Inspector 中修改 fields（hp=110, atk=25, monsterType="skeleton"），设 sprite 为 characters:skeleton。
entities/door.entity.json
fields: color（yellow/blue/red），脚本检查钥匙 → 消耗 → 门消失。
entities/key.entity.json / potion.entity.json / gem.entity.json / equipment.entity.json / special_item.entity.json
统一使用 item-pickup.ts 脚本，通过 itemType field 区分拾取逻辑。
entities/stair.entity.json
fields: direction(up/down) + targetFloor + targetX + targetY，踩上触发 SceneManager.loadScene()。
entities/npc.entity.json / shop.entity.json
NPC 通过 dialog field 存对话文本；Shop 通过 price/amount fields 配置交易。
entities/lava.entity.json / teleporter.entity.json / trigger_wall.entity.json / event_trigger.entity.json
机关类实体，各自独立脚本。
5.4 Scene 定义 (8 层 .map.json)
每层结构：
{
  "id": "floor-1",
  "name": "1F 入口大厅",
  "width": 13, "height": 13,
  "tileWidth": 32, "tileHeight": 32,
  "spriteSheets": ["tower-tiles"],
  "layers": [
    { "id": "ground", "type": "tile", "spriteSheet": "tower-tiles", "encoding": "names", "data": ["wall_gray", "..."] },
    { "id": "entities", "type": "entity", "entities": [ ... ] }
  ]
}
5.5 全部文件清单
magic-tower/
├── project.mote.json
├── images/         (4 张 sprite PNG)
├── sheets/         (4 个 .sprite.json)
├── entities/       (15 个 .entity.json)
├── scenes/         (8 个 .map.json)
├── scripts/        (14 个 .ts 脚本)
├── src/main.ts     (游戏入口)
├── index.html
├── package.json / tsconfig.json / vite.config.ts
总计：4 SpriteSheet + 15 EntityDef + 8 Scene + 14 Script

---
6. 脚本设计
6.1 全局游戏状态 — game-state.ts
单例管理跨场景持久数据：
class GameState {
  // 玩家属性
  hp = 1000; atk = 10; def = 10;
  gold = 0; exp = 0; level = 1;
  yellowKeys = 1; blueKeys = 0; redKeys = 0;

  // 已获得特殊道具
  hasMonsterBook = false;
  hasTeleporter = false;
  hasCross = false;

  // 装备
  weapon = ''; shield = '';

  // 已到达楼层
  visitedFloors: Set<string>;

  // 已消灭怪物/已拾取道具
  removedEntities: Set<string>;

  // 已触发事件
  triggeredEvents: Set<string>;

  // 当前楼层
  currentFloor = 'floor-1';
  playerGridX = 6; playerGridY = 11;
}
6.2 玩家控制器 — player-controller.ts
ScriptLifecycle.update(dt):
  1. 读取 InputManager.action('Move').vec2()
  2. 网格移动：每 0.15s 允许一步 (32px)
  3. 移动前检查目标格：
     a. 墙壁 → 阻止
     b. 门 → tryOpen()
     c. 怪物 → tryFight()
     d. 道具 → 自动拾取
     e. NPC → 触发对话
     f. 楼梯 → 切换楼层
     g. 空地 → 移动
  4. 移动后检查当前格：岩浆/传送/事件触发
6.3 战斗计算 — combat.ts
function calcBattleResult(player, monster): BattleResult {
  let playerAtk = player.atk + weaponBonus;
  // 十字架对 undead 标签 ATK ×3
  if (player.hasCross && tags.includes('undead')) playerAtk *= 3;

  const dmgToMonster = max(0, playerAtk - monster.def);
  const dmgToPlayer  = max(0, monster.atk - playerDef);

  if (dmgToMonster === 0) return { canWin: false };

  const hitsNeeded = ceil(monster.hp / dmgToMonster);
  const totalDamage = max(0, hitsNeeded - 1) * dmgToPlayer;

  return { canWin: player.hp > totalDamage, damage: totalDamage };
}
6.4 引擎 API 调用映射
游戏功能
引擎 API
网格移动
InputManager.action('Move').vec2() → 更新 entity.x/y
踩到怪物
ScriptRuntime.notifyCollisionEnter() 或 onInteract()
拾取道具
移动到道具格 → item-pickup.ts.onInteract() → 隐藏实体
开门
door.ts.onInteract() → 检查钥匙 → 门消失
楼层切换
SceneManager.loadScene(targetFloor) → 恢复玩家位置
怪物图鉴
遍历 scene entities → calcBattleResult 预算
商店
shop.ts.onInteract() → 显示 UI
相机
Camera2D.position = 玩家世界坐标
渲染
TileMapRenderer.render() + SpriteBatch

---
7. UI 系统
7.1 HUD（常驻显示）
┌─────────────────────────────────┐
│  1F 入口大厅                     │
├─────────────────────────────────┤
│  ♥ 1000  ⚔ 10  🛡 10           │
│  💰 0    🔑Y:1 B:0 R:0          │
├─────────────────────────────────┤
│         13×13 游戏地图           │
│         (416×416px)              │
├─────────────────────────────────┤
│  [图鉴] [存档] [传送]            │
└─────────────────────────────────┘
7.2 弹窗 UI
弹窗
触发方式
内容
战斗预览
移动到怪物前
怪物属性 + 预计伤害
对话框
面对 NPC
NPC 头像 + 对话文本
商店菜单
面对商人
三选一购买
怪物图鉴
点击 [图鉴]
当前楼层怪物列表 + 预计伤害
传送选择
点击 [传送]
已到达楼层列表
游戏结束
HP ≤ 0
"你被击败了" + [重新开始]
游戏胜利
击败魔王
"公主已救出" + 统计信息

---
8. 开发计划
8.1 分步实施（7 个阶段）
阶段
内容
产出物
验证的引擎能力
Phase 1
资源文件
project.mote.json + 4 SpriteSheet + 15 EntityDef + 占位图
ProjectLoader
Phase 2
8 层地图
8 个 .map.json (13×13 tiles + entities)
SceneManager + TileMapRenderer
Phase 3
玩家移动
player-controller.ts + game-state.ts
InputManager + Camera2D
Phase 4
战斗 + 门 + 拾取
combat.ts + monster.ts + door.ts + item-pickup.ts
ScriptRuntime + Entity fields
Phase 5
楼梯 + 场景切换
stair.ts + 场景持久化
SceneManager.loadScene()
Phase 6
NPC + 商店 + 机关
npc-dialog.ts + shop.ts + lava/teleporter/trigger
onInteract() 回调
Phase 7
UI + 图鉴 + 打磨
HUD、弹窗、怪物图鉴、存档
TextRenderer + 完整闭环

---
9. 引擎能力差距分析
9.1 已覆盖（可直接使用）
- ✅ 网格地图渲染 (TileMapRenderer)
- ✅ 实体放置与属性 (EntityDef.fields 支持 string/number/bool)
- ✅ 脚本生命周期 (update, onInteract, onCollisionEnter, onDestroy)
- ✅ 场景加载/切换 (SceneManager.loadScene)
- ✅ 输入系统 (ActionMap 四方向 + 按钮)
- ✅ 相机跟随 (Camera2D.follow)
- ✅ 碰撞检测 (CollisionSystem.testAABB)
- ✅ 精灵渲染 (SpriteBatch.drawQuad)
9.2 需要游戏侧实现
需求
引擎状态
游戏侧方案
全局状态跨场景持久
引擎无全局存储
GameState 单例 + localStorage
UI 弹窗系统
引擎无 UI 框架
Canvas2D 叠加层 / HTML DOM overlay
对话系统
引擎无内置
自定义 Dialog 渲染
存档/读档
引擎无内置
GameState.serialize() → localStorage
怪物图鉴
引擎无内置
遍历 scene entities + 战斗预算
网格对齐移动
引擎无内置
脚本实现 tile-snap 移动
9.3 结论
mote 引擎完全能支撑魔塔游戏的开发。核心 数据驱动 设计（SpriteSheet → EntityDef → Scene）与魔塔的 网格地图 + 实体属性 + 脚本交互 模式高度匹配。主要工作量在游戏逻辑脚本，引擎提供了必要的底层能力。