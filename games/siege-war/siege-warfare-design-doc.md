# 城战 (Siege War) — PRD & Tech Spec

> **Engine**: mote (微尘) · Web 2D Game Editor + Engine
> **Genre**: 侧视 2D 即时战术 · 攻城守城 · 中国古代冷兵器
> **Platform**: Web (Canvas2D + mote hybrid architecture)

---

# Part 1: 产品需求文档 (PRD)

## 1. 项目概述

| 属性 | 值 |
|---|---|
| **项目名称** | 城战 (Siege War) |
| **类型** | 侧视 2D 即时战术攻防 |
| **引擎** | mote (微尘) Web 2D Engine |
| **平台** | Web Browser (Desktop) |
| **视角** | 侧视 2D (Side-View) |
| **画布** | 1280 × 720 (16:9) |
| **操作方式** | 鼠标 + 键盘 (指挥型) |
| **时代设定** | 中国古代冷兵器时代 (战国 → 南宋) |
| **玩家角色** | 攻/守方主将 (可选阵营) |
| **战役模式** | 单人历史战役 (7 章 15 关) |
| **参考文献** | 《武备志》《守城录》《墨子·备城门》《武经总要》 |

### 核心体验

玩家作为**主将**站在最高处俯瞰战场，通过**下达命令**而非直接操控士兵来指挥攻城或守城。命令经传令兵传递后，士兵自主执行并拥有自律 AI 行为。侧视 2D 视角使城墙分层（地下→地面→墙体→墙顶→天空）在单一画面中完整呈现，无需切换视图即可同时观察投石轨迹、城墙攀爬、火油倾倒和地道挖掘。

### 核心设计原则

| 原则 | 说明 |
|---|---|
| **下令而非操控** | 玩家是指挥官不是上帝视角，传令延迟 + 士兵自律 AI 创造"不完美控制"的策略深度与历史沉浸感 |
| **信息不对称** | 攻方知道自己挖哪但看不到听瓮；守方知道自己在哪听但看不到地道 |
| **无支配策略** | 每种攻击手段都有防御反制；每种策略都有取舍（博弈矩阵） |
| **历史考据** | 所有武器/工具均取材于真实中国兵书，战役关卡基于真实历史战役 |
| **侧视 2D 差异化** | 同一视口中同时展示天空(弹道)、墙面、地面、地下层，无需切换 |
| **上下文驱动 UI** | 指令面板随选择对象动态变化，三级展开状态平衡信息密度与视口遮挡 |

---

## 2. 战场与地图设计

### 2.1 水平地形布局

战场从左（攻方）到右（守方）分为如下区域：

```
攻方营寨 → 投石车阵地 → 集结区 → 开阔地(冲锋/陷阱区) → 护城河 → 外城墙+箭楼+马面 → 瓮城 → 内城墙 → 城内(守方补给区)
```

### 2.2 地形元素

| 地形 | 功能 | 交互性 |
|---|---|---|
| **护城河** | 阻断攻方推进，必须搭桥/填壕才能通过 | 守方：倾倒火油点燃；攻方：排水/填土 |
| **外城墙** | 主防线，有 HP，可被攻城锤/投石机摧毁 | 守方部署单位于墙顶；攻方以云梯攀爬 |
| **马面 (凸出墙段)** | 提供侧射火力角度，对云梯区形成交叉火力 | 等同"塔"；可升级；HP +30% |
| **箭楼/城门楼** | 高点；射程加成；视野加成 | 可被火攻摧毁 |
| **瓮城** | 城门后封闭杀伤区，敌军破门后被包围 | 历史上最残酷的防御设计 |
| **城门** | 最高 HP 突破点，一旦破门 = 最大通道 | 攻方首要目标 |
| **地下层** | 地道系统；穿过护城河和城墙 | 守方：反地道/灌水/放烟 |

### 2.3 垂直分层 (侧视 2D 独特优势)

```
天空层          (投石轨迹、火箭弧线)
───────────────────────────────────────
箭楼顶 / 墙顶   (弓弩手射击位)
───────────────────────────────────────
                 墙体 (HP 可视化)
───────────────────────────────────────
地面    护城河              墙基             地面
═══════════════════════════════════════════  ← 地面线
地下层          地道层 (挖掘进度可视化)
───────────────────────────────────────
```

所有元素（云梯贴墙、火油从墙顶倾倒、地下地道）在单一视口中同时可见。

### 2.4 城墙段 HP 系统

城墙 **不是** 单一实体，而是由马面/城门分割成独立可破坏的段：

```
段A(HP:100%) | 马面①(HP:130%) | 段B(HP:100%) | 城门(HP:150%) | 段C(HP:100%) | 马面②(HP:130%) | 段D(HP:100%)
```

- 马面段：HP +30%，提供侧射加成
- 箭楼段：HP +20%，射程加成
- 城门段：HP 最高(150%)，但一旦破门 = 最大通道
- 当某段 HP 归零：**坍塌**形成缺口
- 攻方步兵可从缺口涌入（碎石地形 = 减速）
- 守方可在坍塌前紧急修复，或在缺口后方部署**塞门刀车**

---

## 3. 守方武器与工具

### 3.1 远程火力

| 武器 | 出处 | 效果 | 射程 | 资源消耗 |
|---|---|---|---|---|
| **弓弩手** | 基础单位 | 单体精准射击 | 中 | 箭矢 |
| **床弩/三弓弩** | 《武经总要》 | 高穿透伤害；可钉住攻城器械 | 远 | 特种弩矢 |
| **神臂弓** | 宋代 | 射程超过普通弓 | 远 | 箭矢 |
| **礌石/滚木** | 《墨子·备城门》 | 墙顶专用；墙基大范围 AoE | 近(仅墙基) | 石/木 |
| **投石机 (守方)** | 配重式 | 抛射打击集结区和攻城器械 | 超远 | 石弹 |

### 3.2 热化学武器

| 武器 | 出处 | 效果 |
|---|---|---|
| **金汁 (沸粪水)** | 《守城录》 | 墙顶倾倒；DoT + 感染(降低攻速) |
| **火油/猛火油** | 宋代猛火油柜 | AoE 火焰伤害；点燃攻城器械；持续燃烧区域控制 |
| **万人敌 (火球)** | 《武备志》 | 大型燃烧弹从墙顶投掷；大范围 AoE |
| **石灰罐** | 《墨子·备蛾傅》 | 投掷后扩散为致盲烟雾；降低命中率 |
| **铁蒺藜** | 通用 | 撒布于墙基/道路；减速 + 轻伤 |
| **毒烟** | 《武备志》烟球 | 封闭空间(地道/瓮城)中 DoT |

### 3.3 结构防御

| 设施 | 效果 |
|---|---|
| **女墙/垛口** | 弓弩手掩体；降低被远程命中概率 |
| **悬眼/射孔** | 向下开口；安全攻击墙基敌人 |
| **战棚** | 墙顶临时木棚；防御投石机打击 |
| **壕桥回收** | 收回吊桥；瞬断护城河通道 |
| **塞门刀车** | 推出堵塞已破城门开口 |
| **瓮城闸门** | 放敌入瓮城后关门；围而歼之 |

### 3.4 反制手段

| 手段 | 反制对象 |
|---|---|
| **反地道** | 埋大罐听音 → 灌水/放烟/反挖 |
| **长钩/叉竿** | 推开云梯；钩住攀爬敌人 |
| **悬板** | 绳索放下厚木板遮挡城墙缺口 |
| **出城夜袭** | 从侧门派精锐小队烧毁攻方器械 |

---

## 4. 攻方武器与工具

### 4.1 攻城器械

| 器械 | 效果 | 弱点 |
|---|---|---|
| **云梯** | 基础攀墙工具 | 可被推倒/点燃 |
| **巢车/望楼车** | 移动高台；弓手从上射墙顶 | 移动慢；易被投石机摧毁 |
| **攻城锤** | 对城门巨大结构伤害 | 暴露于箭楼火力 |
| **尖头木驴** | 移动防护罩保护墙基工兵 | 可被火油点燃 |
| **投石车/砲** | 远程轰击墙体/塔楼，削减结构 HP | 需校准时间；装填慢 |
| **填壕车** | 运土填壕 | 推进中极度脆弱 |
| **冲车** | 大型有顶撞门车 | 笨重；可能卡在壕沟 |
| **火箭/火箭车** | 群射火箭；点燃墙顶木制防御 | 对石墙无效 |

### 4.2 战术手段

| 战术 | 效果 | 风险 |
|---|---|---|
| **挖地道** | 绕过城墙；可坍塌城墙或直入城内 | 被反地道则全灭 |
| **水攻** | 引河灌城(地形依赖) | 需大量时间；堤坝可被破坏 |
| **断粮围困** | 不强攻；围城耗尽士气和粮食 | 需绝对数量优势 |
| **声东击西** | 一侧佯攻，另一侧主攻 | 需精确配合 |
| **内应** | 花金收买守军；计时后打开城门 | 可被守方发现 |
| **烟雾掩护** | 大规模烟雾遮蔽冲锋路线 | 双方视野均受限 |

### 4.3 步兵单位

| 单位 | 职责 |
|---|---|
| **刀盾兵** | 前排坦克；掩护后排推进 |
| **弓弩手** | 远程压制墙顶守军 |
| **工兵** | 操作器械/挖地道/填壕 |
| **精锐登墙队** | 高攻高速；专精云梯突击 |
| **火兵** | 投掷火把点燃墙顶木制结构 |

---

## 5. 指令系统

### 5.1 核心理念："下令而非操控"

玩家角色为**主将/城守**，站在最高点俯瞰战场，通过命令指挥，**不直接控制**每个士兵。

#### 指令结构：WHO → WHAT → WHERE

```
① 选择单位/设施  →  ② 选择指令  →  ③ 指定目标
   弓弩营·甲           集中射击         城墙段C
```

下达后：[传令延迟] → 单位自动执行。执行期间，士兵拥有自律 AI 行为。

### 5.2 守方指令表

| 指令 | 目标 | 效果 | 冷却/限制 |
|---|---|---|---|
| **部署** | 任意单位 | 将单位移动到指定城墙段/区域 | 移动需时间 |
| **集中射击** | 弓弩手 | 集火指定区域；+50% 火力但忽略其他区域 | 持续直至取消 |
| **自由射击** | 弓弩手 | AI 自选最近/最危险目标(默认状态) | — |
| **倾倒** | 火油/粪水/滚石 | 墙顶倾倒；墙基大范围伤害 | 消耗资源；装填时间 |
| **推倒云梯** | 墙顶士兵 | 推开指定位置云梯 | 需 2 名士兵；动画时间 |
| **关闭闸门** | 瓮城机关 | 关闭瓮城入口；困住内部敌人 | 一次性；无法重开 |
| **修复** | 工匠 | 修复指定城墙段 HP | 消耗石材；修复期间工匠无法战斗 |
| **出城突袭** | 精锐小队 | 从侧门出击攻击指定目标后撤回 | 高风险高回报；长冷却 |
| **反地道** | 穴师部队 | 在指定位置部署听瓮/挖反地道 | 需猜测敌地道位置 |
| **增援** | 预备队 | 从城内调预备队上墙 | 预备队有限 |
| **撒铁蒺藜** | 守城士兵 | 在墙基撒布铁蒺藜 | 消耗资源 |

### 5.3 攻方指令表

| 指令 | 目标 | 效果 | 冷却/限制 |
|---|---|---|---|
| **推进** | 器械/单位 | 向城墙推进至指定位置 | 推进中受火力杀伤 |
| **冲锋** | 步兵 | 全速冲向城墙；无视伤亡 | 士气消耗大 |
| **架设云梯** | 工兵 | 在指定城墙段架设云梯 | 需先到达墙基 |
| **撞门** | 攻城锤 | 持续撞击城门 | 需先过壕 |
| **齐射** | 弓弩手 | 压制指定城墙段守军 | 箭矢消耗 |
| **投石** | 投石机 | 轰击指定城墙段/建筑 | 长装填；有限弹药 |
| **填壕** | 工兵 | 在指定位置填壕 | 极度危险；消耗沙袋 |
| **挖地道** | 工兵 | 从指定位置开始挖掘地道 | 最长耗时；不可见 |
| **佯攻** | 任意单位 | 模拟进攻姿态引诱守方火力 | 低资源消耗 |
| **撤退** | 任意单位 | 后撤至安全区 | — |
| **搭桥** | 工兵 | 在护城河上搭建简易桥 | 消耗木材 |

### 5.4 传令延迟 — 核心策略机制

```
下达命令 → 传令兵奔跑传递 → 单位开始执行 → 执行完成
  t=0       t=2~5秒游戏时间    t=不定
          (距离越远越慢)      (取决于命令复杂度)
```

- 命令**不是**即时的；存在 **2-5 秒游戏时间**的传令延迟
- 延迟取决于指挥官到目标单位的距离
- 玩家必须**预判**而非实时反应
- **紧急全局指令**（粗粒度但即时）：
  - **鸣金** = 全军撤退（即时但无差别）
  - **擂鼓** = 全军进攻（即时但无差别）

### 5.5 士兵自律 AI 行为

| 自律行为 | 触发条件 | 效果 |
|---|---|---|
| **寻找掩体** | 被远程火力打击 | 自动躲藏于垛口后 |
| **近战反击** | 敌人登上城墙 | 自动拔刀近战 |
| **躲避落石** | 投石机弹着点在头顶 | 自动散开躲避 |
| **灭火** | 附近着火 | 部分士兵尝试扑灭 |
| **恐慌溃散** | 士气过低 | 弃守逃向后方（需军官稳定） |

### 5.6 军官单位

每个单位配属一名军官。军官存在时：
- 稳定本单位士气
- 加速命令执行
- 提供属性加成（如命中 +10%）

军官阵亡后：
- 单位执行力下降
- 容易溃散
- 属性加成消失

---

## 6. 资源与士气系统

### 6.1 共享资源

| 资源 | 用途 |
|---|---|
| **金币** | 招募/贿赂 |
| **木材** | 器械/防御设施 |
| **石材** | 城墙修复/弹药 |

### 6.2 阵营特有资源

| 守方资源 | 攻方资源 |
|---|---|
| 火油储量 | 工程进度 |
| 士气 | 士气 |
| 粮食 | 补给线 |

### 6.3 士气系统

- **守方士气**：城墙被破时大幅下降；击退攻势时回升。士气 = 0 → 开城投降（败）
- **攻方士气**：重大伤亡时下降；破墙/破门时激增。士气 = 0 → 撤围（败）
- **军官**稳定所在单位士气；军官阵亡 → 士气加速下降

---

## 7. 阶段系统

| 阶段 | 持续 | 特征 |
|---|---|---|
| **试探期** | 1-2 回合 | 双方远程火力交换；侦察对方布局 |
| **推进期** | 3-5 回合 | 攻方开始填壕/推器械/挖地道 |
| **总攻期** | 2-3 回合 | 全面进攻；多点突破 |
| **巷战期** | 1-2 回合 (若城破) | 瓮城/内城战斗 |

阶段之间守方获得**喘息时间**进行修墙和重新部署。

---

## 8. 地道系统

### 8.1 地下 Tile 层设计

地道**不是**抽象的"进度条"——它是地面之下的**真实空间层**：

```
═══════════ 地面层 ═══════════════════════════
     攻方地面      护城河        城墙基础         城内地面
▒▒▒▒▒▒▒▒▒▒▒▒  ≈≈≈≈≈≈≈≈≈≈  ▓▓▓▓▓▓▓▓▓▓▓▓  ▒▒▒▒▒▒▒▒▒▒

═══════════ 地下层 ═══════════════════════════
░░░░░░░░░░░░  ░░░░░░░░░░  ░░██████░░░░  ░░░░░░░░░░░░
░░░░░░░░░░░░  ░░░░░░░░░░  ░░██基础██░░  ░░░░░░░░░░░░
░░░░░░░░░░░░  ░░░░░░░░░░  ░░██████░░░░  ░░░░░░░░░░░░

░ = 可挖掘土壤     ██ = 城墙基础 (极难挖掘, 4倍耗时)
```

### 8.2 地道物理规则

| 属性 | 规则 |
|---|---|
| **挖掘速度** | 普通土壤：1 格/10 秒；城墙基础：1 格/40 秒；岩石：不可通过 |
| **宽度** | 固定 1 格宽（单人通道）；节点可扩展为 2×2（战斗/作业空间） |
| **深度** | 统一 1 层地下（不做多层，保持可读性） |
| **坍塌风险** | 无支撑的地道段在地面重型器械通过时可能坍塌 |
| **支撑柱** | 工兵可放置支撑柱（消耗木材）防止坍塌 |
| **通风** | 超过一定长度的地道需挖通风井；否则工兵效率下降 |

### 8.3 攻方挖掘 — 三种用途

#### 用途一：穿越型 — 绕过城墙直入城内

```
攻方营寨 → (地下) → 穿过护城河和城墙下方 → 在城内出口冒出
结果: 出口点生成在城内；部队从出口涌入
```

#### 用途二：塌陷型 — 掏空城墙基础导致坍塌

```
挖到城墙基础 → 掏空基础 → 触发坍塌
结果: 目标城墙段 HP -60%（瞬间）；可能形成缺口
```

#### 用途三：侦察型 — 短距离情报探测

```
挖短距离 → 停下 → 放置听音设备 → 探测守方地下活动
```

### 8.4 路线选择博弈

| 路线特征 | 优势 | 劣势 |
|---|---|---|
| **短直线** | 完成快；暴露时间窗口短 | 路径可预测；守方可能重点监控 |
| **长弯绕行** | 难以预判；避开密集监听区 | 耗时长；工兵疲劳；通风问题 |
| **分支型** | 迷惑守方判断——哪条是真的？ | 资源消耗高；每条分支进度慢 |

攻方可**完整看到自己的地道**，但**看不到**守方的反地道或听瓮位置。

### 8.5 守方听瓮系统

历史出处：《墨子·备穴》——完整的反地道体系。

**物理原理**：大陶罐埋于地下，罐口覆以薄皮。训练有素的穴师伏于皮上探测挖掘震动。

**游戏抽象**：听瓮 = 圆形探测半径。半径内任何挖掘活动产生"声音信号"。

#### 信号系统 — 模糊信息（非精确定位）

听瓮**不直接**显示敌方地道位置，提供模糊信号：

| 维度 | 信息 | 精度 |
|---|---|---|
| **强度** | 挖掘点到听瓮的距离 | 仅 3 级：远/中/近 |
| **方向** | 声音的大致方向 | 45 度扇区精度（非精确角度） |
| **频率** | 是否正在挖掘 | 工兵停工时信号消失 |

**关键设计：信号有噪声和误导**
- 硬土挖掘声音更大（信号更强）；软土更安静
- 护城河水流干扰声音判断
- 攻方可故意制造噪声（锤击诱饵）同时真正地道从另一方向挖

### 8.6 多瓮三角定位

单个听瓮只给方向。**多瓮交叉参照**可缩小范围：

- 瓮 A 给出方向扇区（半透明蓝）
- 瓮 B 给出方向扇区（半透明蓝）
- 重叠区域（高亮黄）= "最可能的挖掘位置"
- **三瓮**可精确到很小区域

**资源约束**：听瓮有成本 + 需分配穴师。例：5 个瓮位和 3 名穴师——如何分配？

#### 听瓮部署策略

| 策略 | 说明 |
|---|---|
| **A. 均匀分布** | 等间距；无盲区但信号精度低 |
| **B. 城门集中** | 城门两翼密集；其他区域稀疏 |
| **C. 前置部署** | 瓮位放在墙前方（护城河下方）；更早预警 |
| **D. 纵深部署** | 两排瓮位；前排预警 + 后排精确定位 |

### 8.7 地下遭遇战

#### 守方反制（升级层级）

| 层级 | 方法 | 条件 | 效果 | 代价 | 局限 |
|---|---|---|---|---|---|
| **LV1** | 灌水 | 知道大致方向 | 灌入地道；攻方被迫放弃该段 | 大量用水(可引护城河) | 攻方有防水闸时效果减弱 |
| **LV2** | 放烟 | 知道大致方向 | 毒烟充满地道；工兵持续伤害+被迫后撤 | 燃料消耗 | 攻方挖了通风井时效果减弱 |
| **LV3** | 反向挖掘截击 | 需较精确位置(至少双瓮定位) | 守方工兵从城内方向挖反地道与攻方连通 → 触发遭遇战 | 时间 + 工兵 | 可能偏离方向 |
| **LV4** | 地下伏击 | 精确位置 + 预挖反地道等待 | 在攻方工兵不知情时连通；精锐冲入 | 精锐被困地下无法守城面 | 几乎必胜遭遇战 |

#### 地下遭遇战规则

当攻守双方地道连通时，进入**特殊地下战斗场景**（自动缩放至地下层）：

```
守方反地道 ←←←←← 交汇点 →→→→→ 攻方地道

♦♦♦♦← ┃ 交汇 ┃ →☠☠☠☠
(守方)           (攻方)
```

| 规则 | 效果 | 战略意义 |
|---|---|---|
| **狭窄空间** | 最多 2v2 近战；弓弩不可用 | 精锐近战兵 >> 大量弓手 |
| **火把照明** | 无火把方视野极短 | 先看到 = 先手优势 |
| **烟火效果翻倍** | 封闭空间中烟火伤害和范围翻倍 | 火攻是地下大杀器 |
| **坍塌风险** | 激烈战斗可能触发坍塌；双方受伤 | 有时主动坍塌 = 止损 |
| **撤退困难** | 地道中无法快速撤退；容易被追杀 | 进入前要规划退路 |
| **极端士气影响** | 黑暗地下环境；士气下降远快于地面 | 军官在地下价值巨大 |

### 8.8 视图切换

三种视图模式（切换按钮，左上角）：

| 模式 | 说明 |
|---|---|
| **🏗 地面视图** (默认) | 正常战场；地道完全不可见 |
| **⛏ 地下视图** | 纯地下层；地面建筑变为半透明参考叠加 |
| **📐 叠加视图** | 地面半透明 + 地下叠加；用于综合判断 |

### 8.9 可疑区域标记系统

守方**不直接看到**地道。而是根据听瓮信号在地图上标记**可疑区域**：

1. 选择听瓮 → 查看信号方向
2. 点击"📍 标记可疑区域"
3. 在地下视图中框选矩形区域
4. 系统根据信号数据赋予可信度评分
5. 多瓮信号交叉提升可信度

| 可信度 | 可执行操作 | 风险 |
|---|---|---|
| **< 30%** | 仅标记观察；部署更多听瓮 | — |
| **30-60%** | 灌水/放烟（大面积低精度反制） | 可能浪费资源在空区域 |
| **60-80%** | 挖反地道截击 | 可能偏离方向 |
| **> 80%** | 精确伏击 | 几乎必中 |

### 8.10 信息战 — 欺骗与反情报

#### 攻方欺骗工具

| 工具 | 说明 |
|---|---|
| **噪声诱骗** | 在假方向持续锤击岩石制造挖掘声。守方听瓮接收到假信号。真正地道从另一方向静默挖掘。 |
| **多路同挖** | 同时挖 2-3 条地道；仅 1 条是真目标。守方资源不足以全部反制。 |
| **停工欺骗** | 挖到一半停工。守方以为放弃，撤走穴师。然后突然恢复。 |
| **深层绕行** | 从更深位置挖掘（如地图允许）。更慢但超出守方听瓮有效探测深度。 |

#### 守方反情报工具

| 工具 | 说明 |
|---|---|
| **移动听瓮** | 根据信号变化移动瓮位至新位置。逐步缩小搜索范围。但转移期间该区域无监控。 |
| **探针侦察** | 从城墙基础向下钻极细的探孔。若打到空洞 = 确认地道位置。但探针可能被攻方察觉（透光）。 |
| **水位观测** | 在墙内挖浅坑灌水。水位异常下降 = 附近地道在排水。粗略但零成本补充手段。 |
| **诱捕地道** | 故意在外墙暴露明显"弱点"。攻方可能优先向此挖掘。守方在此预设伏击。 |

#### 博弈矩阵

```
                               攻方策略
                    直挖      侧面绕行    多路同挖    噪声诱骗+隐蔽
守方    均匀分布     中等      慢速发现    兵力分散    被欺骗
策略    重点集中     快速发现  可能遗漏    资源不足    被欺骗
        纵深部署     快+精确   中速发现    各个击破    可能识破
        诱捕策略     无效      无效        可能诱中一条  无效
```

无单一支配策略——这是优秀的博弈设计。

### 8.11 地道系统教学梯度（战役集成）

| 关卡 | 地道元素 | 教学内容 |
|---|---|---|
| 第 1-4 关 | 无地道 | 先学会地面攻防 |
| **第 5 关 (巨鹿)** | 攻方视角，**首次使用地道** | 学习挖掘命令、路线选择 |
| 第 6 关 (荥阳) | 守方视角，敌方挖地道 | 学习听瓮、灌水、基础反地道 |
| 第 9 关 (陈仓) | 攻方视角，复杂地道 | 多路挖掘、噪声欺骗 |
| **第 11 关 (睢阳)** | 守方，频繁地道威胁 | 完整听瓮网络 + 全套反地道系统 |
| 第 14 关 (钓鱼城) | 守方，山城复杂地质 | 岩石层阻挡、地下水干扰 |

### 8.12 地道结果 → 地面战链式反应

**地道成功（穿越型）**：
- 城内出现敌出口 → 敌军涌出 → 守方调城墙守军回援 → 城墙防御削弱 → 攻方同时发起正面突击

**地道成功（塌陷型）**：
- 城墙基础被掏空+触发 → 城墙段 HP 瞬降 60% → 可能坍塌形成缺口 → 巨大碎石 + 扬尘 VFX → 段上守军坠落(伤亡+混乱) → 攻方步兵冲向缺口

**地道失败（被截击）**：
- 反地道连通 → 地下遭遇战 → 无直接地面影响但攻方损失工兵 → 需重新规划路线 → 时间损失 = 守方多获一个阶段的安全

---

## 9. 历史战役

### 9.1 冷兵器边界规则

| 允许（冷兵器时代） | 不允许（火药时代） |
|---|---|
| 弓、弩、床弩、神臂弓 | 火铳、鸟铳 |
| 投石机（人力/配重式） | 火炮、红夷大炮 |
| 火油、猛火油柜（石油基） | 火药炸弹、震天雷 |
| 火箭（布裹浸油箭头） | 火药推进火箭 |
| 云梯、攻城锤、巢车 | 地雷 |
| 滚木、礌石、金汁 | — |
| 铁蒺藜、拒马、鹿角 | — |
| 地道（人工挖掘） | — |
| **回回砲（配重投石机）** | — |

**说明**：回回砲虽出现在南宋末年，但属于纯机械装置（无火药），作为最终章的"终极武器"。

### 9.2 七章十五关战役设计

#### 第一章：墨子之道 — 教学

| 关 | 名称 | 阵营 | 简述 |
|---|---|---|---|
| **1** | 墨子守宋·基础防御 | 守方 | 公元前 440 年。楚攻宋，公输班造云梯，墨子守城。教学：弓箭命令、部署、滚木礌石、推梯。简单地图：单面城墙 + 浅壕 + 一座城门。3 波：①纯步兵冲锋 ②云梯攀爬 ③简单攻城锤。工具：2 支弓弩队、10 根滚木、20 块礌石。胜利：击退 3 波。失败：城门 HP=0 或 20+ 敌人进城。星级：★击退全部 ★★城墙完好 ★★★伤亡<10 |
| **2** | 墨子守宋·全面防线 | 守方 | 进阶教学：多种防守武器配合使用 |

#### 第二章：战国烽烟

| 关 | 名称 | 阵营 | 简述 |
|---|---|---|---|
| **3** | 田单守即墨 | 守方 | 火牛阵奇谋 |
| **4** | 白起攻鄢城 | 攻方 | 水攻战术 |

#### 第三章：楚汉风云

| 关 | 名称 | 阵营 | 简述 |
|---|---|---|---|
| **5** | 巨鹿之战 | 攻方 | "破釜沉舟"。**首次使用地道**（教学） |
| **6** | 荥阳守城 | 守方 | 拖延战术。教学：听瓮、灌水、基础反地道 |

#### 第四章：三国争霸

| 关 | 名称 | 阵营 | 简述 |
|---|---|---|---|
| **7** | 张辽守合肥 | 守方 | 公元 215 年。10 万大军 vs 张辽 800 精骑出击。核心机制：**出城突袭指令**。必须趁敌军未成阵形时出击。阶段：①选出击时机(半渡而击) ②成功出击→敌军士气崩溃 ③围城阶段 ④最终猛攻。隐藏事件：首次出击若到达敌方主帅→触发"恐慌"事件→敌军士气 -30%。胜利：守住 7 回合。星级：★存活 ★★首次出击杀敌>100 ★★★城墙未被攻破 |
| **8** | 陆逊攻荆州 | 攻方 | 智取 |
| **9** | 诸葛亮攻陈仓 | 攻方 | 器械战。复杂地道：多路挖掘、噪声欺骗 |

#### 第五章：铁血大唐

| 关 | 名称 | 阵营 | 简述 |
|---|---|---|---|
| **10** | 安市城之战 | 守方 | 抵抗唐太宗 |
| **11** | 张巡守睢阳 | 守方 | 公元 757 年。安史之乱。张巡以 6,800 守军对抗 130,000 叛军坚守 10 个月。**极端匮乏**：箭矢、石材、粮食极少。特殊机制：①"草人借箭"——夜间放下草人诱敌射箭，次日回收 ②粮食系统——每回合消耗粮食；不足则战力下降 ③夜袭敌营抢夺物资。10 回合，敌军逐回合增加，己方资源递减。胜利：坚守 10 回合等待援军。星级：★坚持到底 ★★使用草人借箭≤3 次 ★★★最终城墙 HP>30%。完整听瓮网络 + 全套反地道系统 |

#### 第六章：靖康前夜

| 关 | 名称 | 阵营 | 简述 |
|---|---|---|---|
| **12** | 太原保卫战 | 守方 | 孤城最后抵抗 |
| **13** | 东京保卫战 | 守方 | 全民守都 |

#### 第七章：钓鱼城 — 最终之战

| 关 | 名称 | 阵营 | 简述 |
|---|---|---|---|
| **14** | 钓鱼城 | 守方 | 1259 年。蒙古大汗蒙哥攻钓鱼城。守将王坚。三面环江山城要塞。特色：①地形优势——蒙军只能单面攻 ②**回回砲首次出现**（超远射程，巨大伤害）③最高 AI 敌人：蒙古精骑 + 攻城工程师。特殊：水门经长江补给（敌方可能封锁）。隐藏条件："命中蒙哥"——特定回合精准投石命中敌方本营。5 大回合，每回合多波攻势。胜利：守住全部回合。**隐藏结局**：击杀蒙哥 → 敌全军撤退，大获全胜。复杂地质：岩石层阻挡、地下水干扰 |
| **15** | 襄阳之战 | 守方 | 回回砲初现 |

### 9.3 指挥官技能树

每关完成获取经验值 → 解锁指挥官技能。

**守方技能树（4 分支）**：

```
├── 【坚壁】城墙基础 HP +10%
│   ├── 【铁壁】城墙 HP +25%
│   └── 【速修】修复速度 +30%
├── 【神射】弓弩射程 +15%
│   ├── 【齐射】集中射击伤害 +40%
│   └── 【火箭】解锁火箭能力
├── 【运筹】传令延迟 -20%
│   ├── 【料敌】可查看敌方部署概况
│   └── 【伏兵】解锁改良"出城突袭"变体
└── 【厚积】资源获取 +20%
    ├── 【屯粮】初始粮食 +50%
    └── 【军工】火油/礌石装填速度 +25%
```

### 9.4 战前编组选择

每关开始前，在预算内选择单位组合：

**示例预算：5000**

| 类别 | 物品 | 花费 |
|---|---|---|
| **单位** | 弓弩营·甲 (100 弓手) | 800 |
| | 弓弩营·乙 (100 弓手) | 800 |
| | 刀盾营 (80 士兵) | 600 |
| | 精锐突击队 (30 士兵) | 1000 |
| | 工匠队 (20 工匠) | 400 |
| **装备** | 火油桶 ×20 | 600 |
| | 滚木 ×30 | 300 |
| | 床弩 ×2 | 800 |
| | 铁蒺藜 ×10 | 200 |

剩余：1300。点击"开始部署"。

---

## 10. UI/UX 设计

### 10.1 整体屏幕布局 — 四区域

```
┌──────────────────────────────────────────────────────────────┐
│ 资源栏  [金:2400] [木:180] [石:320] [油:8桶]  回合:3/7       │
│ 士气条 ████████████░░░░ 72%                  [暂停] [倍速]   │
├────┬──────────────────────────────────────────────┬──────────┤
│    │                                              │          │
│部队│                                              │ 城墙     │
│花名│             主战场视口                        │ 状态栏   │
│册  │          (平移/缩放)                          │          │
│    │                                              │          │
│    │                                              │          │
├────┴──────────────────────────────────────────────┴──────────┤
│                   指令面板 (上下文敏感)                        │
│ [部署] [射击] [倾倒] [推梯] [修复] [突袭]      [待传达:2]     │
└──────────────────────────────────────────────────────────────┘
```

| 区域 | 位置 | 固定/动态 | 功能 |
|---|---|---|---|
| **资源栏** | 顶部横条 | 固定 | 金/木/石、火油储量、士气条、回合信息 |
| **部队花名册** | 左侧窄列 | 固定 | 全部单位列表（位置/状态/兵力） |
| **城墙状态栏** | 右侧窄列 | 固定 | 城墙段 HP 一览 |
| **指令面板** | 底部 | **上下文动态** | 根据当前选中对象变化；核心交互区 |

主视口占屏幕面积约 **70%**。

### 10.2 城墙段选择 — 三种方式

**方式一：直接点击城墙段**
- 悬停：段高亮轮廓 + 显示名称 + 气泡（HP、驻军、状态）
- 点击：选中该段；底部面板切换为该段可用指令

**方式二：右侧城墙状态栏快选**

```
┌─── 城墙状态 ───┐
│ 段A ████░ 80%   │  ← 绿色，健康
│ 马面① ███ 100%  │  ← 蓝标
│ 段B █████ 100%  │
│ 城门 ██░░ 45%   │  ← 橙色，危险！
│ 段C ████░ 75%   │
│ 马面② ███ 95%   │
│ 段D █████ 100%  │
│ [城门] ← 闪烁    │  ← 被攻击时闪烁
└──────────────────┘
```

点击侧栏段 → 主视口自动平移居中 → 同时选中。

**方式三：快捷键**
数字键 1-7 直接选择对应城墙段。

#### 选中反馈

选中段在顶部显示**段信息条**：

```
段B · 外城墙    HP: ████████░░ 85/100    驻军: [弓弩营·甲] 92/100
状态: 被架梯(×2)    威胁等级: ██ 中等
```

### 10.3 部队花名册交互

| 操作 | 效果 |
|---|---|
| **悬停**单位 | 该单位在主视口中头顶出现高亮旗帜标记 |
| **单击**单位 | 选中；视口移动到其位置；面板切换为单位指令 |
| **双击**单位 | 快速居中 + 选中 |
| **拖拽**单位到城墙状态栏段 | 快捷"部署到该段"指令 |

#### 选中单位指令面板

```
┌──────── 弓弩营·甲 (段B · 92人) ─────────────────────┐
│ 射击模式: (●)自由射击  (○)集中射击  (○)停火          │
│ [📍 移动至...] [🪜 推梯] [🗡 近战] [🔙 撤退]         │
│ 优先目标: [最近] [器械优先] [登墙者优先] [军官优先]    │
└────────────────────────────────────────────────────────┘
```

### 10.4 指令面板 — 三级展开

**上下文切换全表**：

| 选中对象 | 面板内容 |
|---|---|
| 无选中(默认) | 全局指令：[鸣金] [擂鼓] [全军射击] |
| 城墙段 | 段指令：[倾倒] [推梯] [修复] [部署部队至此] |
| 弓弩单位 | 射击模式 + 移动 + 优先目标 |
| 刀盾单位 | 部署位置 + 阵型模式(防守/进攻) |
| 工匠 | 修复目标 + 运输物资 |
| 精锐突击队 | 出城方向 + 攻击目标 + 撤退条件 |
| 器械(床弩/投石机) | 瞄准目标 + 装填状态 |
| 设施(油桶) | 待命 / 倾倒 / 运往其他段 |

**三级展开**：

**状态一 — 折叠（默认，最小视口遮挡）**：
```
┌──────────────────────────────────────────────────┐
│ 已选: 弓弩甲(段B) │ [🏹射击] [📍移动] [🗡近战] │ [▲展开] │
└──────────────────────────────────────────────────┘
```

**状态二 — 半展开（详细选项）**：
```
┌──────────────────────────────────────────────────┐
│ 弓弩营·甲  92/100  位置:段B  状态:自由射击        │
│ 射击: (●)自由  (○)集中  (○)停火  目标: [最近▼]    │
│ [📍 移动...] [🪜 推梯] [🗡 近战] [🔙 撤退] [▲详情] │
└──────────────────────────────────────────────────┘
```

**状态三 — 全展开（完整单位数据）**：
```
┌──────────────────────────────────────────────────┐
│ 弓弩营·甲                                        │
│ ──────────────────────────────────                │
│ 兵力: 92/100   士气: 78%   疲劳: 低               │
│ 装备: 军弩(射程180px)  箭矢: 450/600              │
│ 军官: 张队正(存活)  加成: 命中+10%, 士气稳定        │
│ 击杀: 34   损失: 8                                │
│ ──────────────────────────────────                │
│ 射击: (●)自由  (○)集中  (○)停火                    │
│ 优先目标: [最近] [器械] [登墙者] [军官]             │
│ [📍移动] [🪜推梯] [🗡近战] [🔙撤退]    [▼折叠]     │
└──────────────────────────────────────────────────┘
```

### 10.5 命令执行视觉反馈链

5 步反馈序列：

| 步骤 | 反馈 |
|---|---|
| ① 下达命令 | 面板闪烁确认 + 音效"得令！" |
| ② 传令阶段 | 小传令兵图标从指挥官位置跑向目标单位 + 底部"传达中... 预计 3 秒到达" + 进度条 |
| ③ 传令到达 | 目标单位旗帜闪烁 + 音效"遵命！" + 花名册状态更新为"执行中: [命令名]" |
| ④ 执行中 | 单位执行动作（移动/射击/倾倒...）在花名册实时可见 |
| ⑤ 执行完成/中断 | 完成：状态恢复"待命" + 简要提示；中断：红色警告 + 音效 |

**传令队列显示**（指令面板右侧常驻）：

```
┌── 传令队列 ──┐
│ 📯 弓弩甲→段C  │ ████░ 70%  ← 快到了
│ 📯 工匠→修复A  │ ██░░░ 40%
│ 📯 倾倒·段B    │ █░░░░ 排队  ← 等待中
└────────────────┘
```

### 10.6 信息层级

| 层级 | 内容 |
|---|---|
| **默认层（常驻可见）** | 单位旗帜(🚩)、兵力密度图标(♣/♦)、云梯(🪜)、敌方单位(☠) |
| **按需层（选中/悬停时显示）** | 选中墙段→HP条+射程指示；集中射击命令后→半透明红色扇形火力覆盖；悬停投石机→抛物线轨迹+落点圆 |
| **警报层（紧急事件）** | 位置弹出警告("⚠ 段B被架梯！")；屏幕底部事件日志(半透明，可展开) |

### 10.7 战前部署 UI

```
┌────────────────────────────────────────────────────────────┐
│ 第7关: 张辽守合肥   预算: 5000/5000    [情报] [开战!]       │
├───────────────────────────────────────────┬─────────────────┤
│                                           │ 已部署:          │
│   城墙段显示为可放置的目标区域              │ 弓弩甲→段B       │
│   虚线轮廓显示每段容量限制                  │ 弓弩乙→段D       │
│   已部署单位显示在其位置上                  │ 刀盾→瓮城        │
│                                           │ 工匠→段A          │
│   ╔══段A══╗   ╔══段B══╗   ╔══城门══╗      │                  │
│   ║ [空位] ║  ║弓弩甲  ║  ║        ║      │ 预算剩余:        │
│   ║拖到这里║  ║ 92 人  ║  ║ [空位] ║      │ 1300             │
│   ╚════════╝  ╚════════╝  ╚════════╝      │                  │
├───────────────────────────────────────────┴─────────────────┤
│ ┌── 可购买单位 ──────────┐  ┌── 装备商店 ────────────┐      │
│ │ [弓弩]800 [刀盾]600    │  │ [油桶×1]150 [礌石×10]100│     │
│ │ [工匠]400 [精锐]1000   │  │ [蒺藜×5]100 [床弩]800   │     │
│ └─────────────────────────┘  └──────────────────────────┘    │
│ 将单位/装备卡牌拖放到上方城墙段部署区域                        │
└────────────────────────────────────────────────────────────┘
```

- **拖拽**单位卡到城墙段 → 部署
- **右键**已部署单位 → 召回（退还预算）
- 每段有**容量限制**（1-2 单位）；满 = 无法再部署
- 油桶、礌石等也需部署到特定段

### 10.8 攻方视角 UI

攻方 UI 布局**镜像**，指令面板内容完全变化：

**左侧栏**：攻方编队列表，带拖拽路径指示器显示推进方向

**攻击轴选择器**：
```
攻击轴: [左翼·段A-D] [正面·城门] [右翼·段C-D]
```

**攻方指令按钮**：
```
[🏃 冲锋] [🪜 架梯] [🪵 推锤] [⛏ 开挖地道]
[🏹 齐射压制] [🎯 投石轰击] [🌊 填壕] [🎭 佯攻]
```

### 10.9 核心交互循环

```
         ┌──────────────────┐
         │  战前部署         │
         │  购买 + 拖拽部署  │
         └────────┬─────────┘
                  ▼
     ┌──────── 战斗开始 ──────────┐
     │                            │
     ▼                            ▼
┌─────────────┐          ┌────────────────┐
│ 观察战场     │          │ 接收警报       │
│ (平移视口)   │◄─────────│ (自动弹出)     │
└──────┬──────┘          └────────────────┘
       │ 发现需要干预的情况
       ▼
┌─────────────┐
│ 选择目标     │  ← 点击墙段 / 点击单位 / 点击花名册 / 快捷键
└──────┬──────┘
       ▼
┌─────────────┐
│ 选择指令     │  ← 底部指令面板(上下文敏感)
└──────┬──────┘
       │ (部分指令需二次目标)
       ▼
┌─────────────┐
│ 指定目标     │  ← 进入目标选择模式，点击地图
└──────┬──────┘
       ▼
┌─────────────┐
│ 传令延迟     │  ← 等待传令兵到达
└──────┬──────┘
       ▼
┌─────────────┐
│ 自动执行     │  ← 士兵 AI 接管；玩家观察结果
└──────┬──────┘
       │
       ▼
继续观察 / 下一条命令...
```

核心循环：**观察 → 决策 → 等待 → 观察**

---

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
