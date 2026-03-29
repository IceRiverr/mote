# Breakout 打砖块游戏设计文档

## 1. 项目概述

基于 mote 引擎的经典打砖块游戏实现，使用 WebGPU/WebGL2 渲染，支持键盘和触摸操作。玩家控制底部挡板反弹球体，击碎所有砖块即可获胜。

## 2. 游戏规格

### 2.1 基础参数
| 参数 | 值 |
|------|-----|
| 画布尺寸 | 1280 × 960 |
| 游戏区域 | 1200 × 880 (居中) |
| 挡板尺寸 | 160 × 32 px |
| 球体尺寸 | 24 × 24 px (半径 12px) |
| 砖块尺寸 | 100 × 40 px |
| 砖块行列 | 10 列 × 6 行 = 60 块 |
| 渲染帧率 | 60 FPS |
| 球初始速度 | 300 px/s |
| 最大球速 | 600 px/s |

### 2.2 颜色方案
```
背景色:       #1a1a2e (深蓝紫)
游戏区边框:    #3d3d5c (淡紫边框)
挡板:         #60a5fa (亮蓝)
挡板发光:      #3b82f6 (蓝色光晕)
球:           #ffffff (纯白)
球拖尾:        rgba(255,255,255,0.3) (半透明白)

砖块颜色 (按行):
  第1行: #ef4444 (红) - 10分
  第2行: #f97316 (橙) - 20分
  第3行: #eab308 (黄) - 30分
  第4行: #22c55e (绿) - 40分
  第5行: #3b82f6 (蓝) - 50分
  第6行: #a855f7 (紫) - 60分

UI文字:       #ffffff (白)
游戏结束:      #ef4444 (红)
胜利:         #22c55e (绿)
```

## 3. 游戏机制

### 3.1 核心规则
- **挡板控制**: 左右移动，限制在游戏区域内
- **球体运动**: 匀速直线运动，碰撞后反弹
- **砖块**: 被球击中后消失，根据行数给予不同分数
- **球掉落**: 球触碰到底部边界（挡板下方）= 失去一条生命
- **生命系统**: 初始 3 条生命，生命耗尽 = 游戏结束
- **胜利条件**: 消除所有砖块

### 3.2 物理系统
| 碰撞对象 | 反弹行为 |
|---------|---------|
| 左右墙壁 | X 轴速度反向 |
| 顶部墙壁 | Y 轴速度反向 |
| 挡板 | Y 轴速度反向，X 轴根据击中位置调整 |
| 砖块 | Y 轴速度反向，砖块被消除 |

### 3.3 挡板反弹角度
挡板被分为 5 个区域，击中不同区域会改变球的水平速度：
```
[最左] [左] [中] [右] [最右]
  -2    -1   0   +1   +2   (水平速度系数)
```
- 击中挡板边缘时，球会以更陡峭的角度反弹
- 击中中心时，球基本垂直反弹

### 3.4 得分系统
| 行为 | 得分 |
|------|-----|
| 消除第1行砖块 | +10 |
| 消除第2行砖块 | +20 |
| 消除第3行砖块 | +30 |
| 消除第4行砖块 | +40 |
| 消除第5行砖块 | +50 |
| 消除第6行砖块 | +60 |
| 连击加成 | 连续击中砖块，每次 +5 额外 |

### 3.5 难度曲线
- 每消除 10 个砖块，球速增加 10%
- 每失去一条生命，球速重置为初始值

## 4. 技术架构

### 4.1 文件结构
```
games/breakout/
├── index.html          # 游戏页面
├── main.ts             # 游戏主逻辑
├── Paddle.ts           # 挡板类
├── Ball.ts             # 球类
├── Brick.ts            # 砖块类
├── BrickGrid.ts        # 砖块网格管理
├── Game.ts             # 游戏状态管理
├── plan-Breakout.md    # 本设计文档
└── package.json        # { "name": "breakout", "dependencies": { "@mote/engine": "*" } }
```

### 4.2 类设计

#### Paddle 类
```typescript
class Paddle {
  position: Vec2;           // 中心位置
  width: number;             // 宽度
  height: number;            // 高度
  speed: number;             // 移动速度 (px/s)
  
  update(dt: number, input: number, gameWidth: number): void;
  getBounceDirection(ballX: number): number;  // 返回水平速度系数 (-2 ~ +2)
  draw(batch: SpriteBatch, atlas: TextureAtlas): void;
}
```

#### Ball 类
```typescript
class Ball {
  position: Vec2;           // 中心位置
  velocity: Vec2;           // 速度向量
  radius: number;           // 半径
  trail: Vec2[];            // 拖尾位置历史
  
  update(dt: number, gameBounds: Rect): 'bounce' | 'dead' | null;
  checkPaddleCollision(paddle: Paddle): boolean;
  checkBrickCollision(bricks: BrickGrid): Brick | null;
  reset(paddle: Paddle): void;  // 重置到挡板上方
  draw(batch: SpriteBatch, atlas: TextureAtlas): void;
}
```

#### Brick 类
```typescript
class Brick {
  position: Vec2;           // 中心位置
  width: number;
  height: number;
  color: Color;
  score: number;
  active: boolean;          // 是否还存在
  
  draw(batch: SpriteBatch, atlas: TextureAtlas): void;
}
```

#### BrickGrid 类
```typescript
class BrickGrid {
  bricks: Brick[];
  rows: number = 6;
  cols: number = 10;
  padding: number = 4;
  
  init(gameBounds: Rect): void;  // 初始化砖块布局
  getActiveCount(): number;
  checkCollision(ball: Ball): Brick | null;
  draw(batch: SpriteBatch, atlas: TextureAtlas): void;
}
```

#### Game 类
```typescript
class Game {
  state: 'menu' | 'playing' | 'gameover' | 'victory';
  score: number;
  lives: number;
  highScore: number;
  paddle: Paddle;
  ball: Ball;
  bricks: BrickGrid;
  combo: number;            // 连击计数
  
  start(): void;
  update(dt: number, inputX: number): void;
  draw(batch: SpriteBatch, atlas: TextureAtlas): void;
  resetBall(): void;
  onLifeLost(): void;
  onVictory(): void;
}
```

## 5. 输入控制

| 输入方式 | 操作 |
|---------|------|
| 键盘方向键 | 左/右移动挡板 |
| 键盘 A/D | 左/右移动挡板 |
| 空格键 | 菜单/游戏结束时开始游戏 |
| 触屏滑动 | 手指水平滑动控制挡板 |
| 触屏点击 | 菜单/游戏结束时开始游戏 |

## 6. 渲染方案

### 6.1 使用引擎 API
- `SpriteBatch` - 绘制矩形（使用默认白色纹理）
- `Color` - 设置不同元素的颜色
- `Camera2D` - 固定正交相机
- `TextRenderer` - 显示分数和 UI

### 6.2 绘制顺序
1. 背景色填充
2. 游戏区域边框
3. 砖块网格
4. 挡板（带发光效果）
5. 球拖尾
6. 球体
7. UI 层（分数、生命、消息）

### 6.3 无纹理方案
所有元素使用纯色方块渲染，不需要外部纹理资源：
```typescript
// 球体使用圆角矩形模拟
batch.drawQuad(x, y, ballSize, ballSize, 0, atlas.fullRegion, atlas, BALL_COLOR);

// 发光效果使用半透明大矩形叠加
batch.drawQuad(x, y, paddleWidth + 10, paddleHeight + 10, 0, atlas.fullRegion, atlas, GLOW_COLOR);
```

### 6.4 视觉效果
- **球拖尾**: 记录最近 5 帧位置，透明度递减
- **挡板发光**: 挡板下方叠加半透明蓝色矩形
- **砖块破碎**: 砖块被击中时短暂闪烁后消失

## 7. 音效设计

| 事件 | 音效类型 |
|------|---------|
| 球碰墙壁 | 轻微 "tick" |
| 球碰挡板 | 低沉 "pong" |
| 砖块破碎 | 清脆破碎音，音高随行数变化 |
| 生命损失 | 沉闷 "buzz" |
| 游戏胜利 | 胜利旋律 |
| 游戏结束 | 失败音效 |

使用 `AudioManager` 加载和播放。

## 8. UI 设计

### 8.1 游戏画面布局
```
┌───────────────────────────────────────────────────────────────────────────┐
│  BREAKOUT              生命: ❤❤❤    分数: 1250    最高: 5000             │  ← 顶部 HUD
├───────────────────────────────────────────────────────────────────────────┤
│  ┌────────────────────────────────────────────────────────────────────┐   │
│  │  ■ ■ ■ ■ ■ ■ ■ ■ ■ ■  (红 10分)                                   │   │
│  │  ■ ■ ■ ■ ■ ■ ■ ■ ■ ■  (橙 20分)                                   │   │
│  │  ■ ■ ■ ■ ■ ■ ■ ■ ■ ■  (黄 30分)                                   │   │
│  │  ■ ■ ■ ■ ■ ■ ■ ■ ■ ■  (绿 40分)                                   │   │
│  │  ■ ■ ■ ■ ■ ■ ■ ■ ■ ■  (蓝 50分)                                   │   │
│  │  ■ ■ ■ ■ ■ ■ ■ ■ ■ ■  (紫 60分)                                   │   │
│  │                                                                    │   │
│  │                                          ●                         │   │  ← 球
│  │                                                                    │   │
│  │                              ━━━━━━━━━━━━                          │   │  ← 挡板
│  │                                                                    │   │
│  └────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────────────────────────────────────────────┘
```

### 8.2 游戏状态
- **菜单**: 显示标题 "BREAKOUT" + "按空格或点击开始"
- **游戏中**: 显示分数、生命、连击数
- **游戏结束**: 显示 "GAME OVER" + 最终分数 + "按空格重开"
- **胜利**: 显示 "YOU WIN!" + 最终分数 + "按空格重开"

## 9. 实现阶段

### Phase 1: 基础框架
- [ ] 创建 index.html (参考 snake 结构)
- [ ] 创建 package.json
- [ ] 实现 Game 类基础结构
- [ ] 连接引擎，显示纯色背景和边框

### Phase 2: 核心玩法
- [ ] 实现 Paddle 类 (移动、边界限制)
- [ ] 实现 Ball 类 (运动、反弹)
- [ ] 实现 Brick 和 BrickGrid 类
- [ ] 碰撞检测 (球-墙、球-挡板、球-砖块)
- [ ] 键盘输入

### Phase 3: 游戏逻辑
- [ ] 生命系统
- [ ] 得分系统
- [ ] 游戏状态切换 (菜单/游戏中/结束/胜利)
- [ ] 球重置机制
- [ ] 连击系统

### Phase 4: 完善体验
- [ ] 触屏滑动控制
- [ ] 球拖尾效果
- [ ] 挡板发光效果
- [ ] 高分记录 (localStorage)
- [ ] 胜利判定

### Phase 5: Polish
- [ ] 添加音效
- [ ] 砖块破碎动画
- [ ] 屏幕震动效果 (击中砖块时)
- [ ] 粒子效果 (砖块破碎)

## 10. 参考代码

### 相机设置
```typescript
const camera = new Camera2D(canvas.width, canvas.height);
camera.position = new Vec2(GAME_WIDTH / 2, GAME_HEIGHT / 2);
```

### 游戏循环
```typescript
const loop = new GameLoop(60);

loop.onUpdate = (dt) => {
  input.update();
  const moveInput = input.action('Move').vec2().x;
  game.update(dt, moveInput);
  camera.update(dt);
  input.endFrame();
};

loop.onRender = () => {
  game.draw(batch, whiteAtlas);
};
```

### 碰撞检测 AABB
```typescript
function checkAABBCollision(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width &&
         a.x + a.width > b.x &&
         a.y < b.y + b.height &&
         a.y + a.height > b.y;
}
```

### 挡板反弹计算
```typescript
getBounceDirection(ballX: number): number {
  const relativeX = (ballX - this.position.x) / (this.width / 2);
  // relativeX 范围: -1 ~ +1
  // 映射到: -2 ~ +2
  return Math.max(-2, Math.min(2, relativeX * 2));
}
```

---

## 附录: 快速启动命令

```bash
# 开发服务器
npm run dev

# 访问游戏
http://localhost:5173/games/breakout/
```

## 附录: 游戏常量

```typescript
const GAME_WIDTH = 1200;
const GAME_HEIGHT = 880;
const PADDLE_WIDTH = 160;
const PADDLE_HEIGHT = 32;
const BALL_SIZE = 24;
const BALL_RADIUS = 12;
const BRICK_WIDTH = 100;
const BRICK_HEIGHT = 40;
const BRICK_ROWS = 6;
const BRICK_COLS = 10;
const BRICK_PADDING = 4;
const INITIAL_LIVES = 3;
const INITIAL_BALL_SPEED = 300;
const MAX_BALL_SPEED = 600;
```
