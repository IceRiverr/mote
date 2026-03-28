# Snake 贪吃蛇游戏设计文档

## 1. 项目概述

基于 mote 引擎的贪吃蛇游戏实现，使用 WebGPU/WebGL2 渲染，支持键盘和触摸操作。

## 2. 游戏规格

### 2.1 基础参数
| 参数 | 值 |
|------|-----|
| 画布尺寸 | 640 × 480 |
| 网格大小 | 20 × 15 (每个格子 32px) |
| 游戏帧率 | 10 FPS (蛇移动速度) |
| 渲染帧率 | 60 FPS (平滑动画) |

### 2.2 颜色方案
```
背景色:   #1a1a2e (深蓝紫)
网格线:   #2a2a4e (微弱边框)
蛇头:     #4ade80 (亮绿)
蛇身:     #22c55e (绿)
蛇尾渐变: 透明度从 1.0 → 0.6
食物:     #f472b6 (粉红) + 发光效果
游戏结束: #ef4444 (红)
```

## 3. 游戏机制

### 3.1 核心规则
- 蛇初始长度：3 格
- 移动方向：上/下/左/右，不可直接反向
- 食物：随机生成在空格上
- 吃到食物：长度 +1，得分 +10，速度略微提升
- 碰撞检测：墙壁或自身 = 游戏结束

### 3.2 得分系统
| 行为 | 得分 |
|------|-----|
| 吃食物 | +10 |
| 连续吃 (加速) | +5 额外 |

### 3.3 难度曲线
- 每吃 5 个食物，移动速度增加 10%
- 最大速度：初始速度的 2 倍

## 4. 技术架构

### 4.1 文件结构
```
games/snake/
├── index.html          # 游戏页面 (参考 dungeon 结构)
├── main.ts             # 游戏主逻辑
├── Snake.ts            # 蛇类
├── Food.ts             # 食物类
├── Game.ts             # 游戏状态管理
├── plan-snake.md       # 本设计文档
└── package.json        # { "name": "snake", "dependencies": { "@mote/engine": "*" } }
```

### 4.2 类设计

#### Snake 类
```typescript
class Snake {
  segments: Vec2[];           // 蛇身段位置数组
  direction: Vec2;            // 当前移动方向
  nextDirection: Vec2;        // 下一帧要转的方向
  
  update(gridSize: Vec2): boolean;  // 返回是否存活
  grow(): void;               // 增长
  checkSelfCollision(): boolean;
  draw(batch: SpriteBatch): void;
}
```

#### Food 类
```typescript
class Food {
  position: Vec2;
  
  spawn(snake: Snake, gridSize: Vec2): void;
  draw(batch: SpriteBatch, time: number): void;  // 带呼吸动画
}
```

#### Game 类
```typescript
class Game {
  state: 'menu' | 'playing' | 'gameover';
  score: number;
  snake: Snake;
  food: Food;
  
  start(): void;
  update(dt: number): void;
  draw(batch: SpriteBatch): void;
  reset(): void;
}
```

## 5. 输入控制

| 输入方式 | 操作 |
|---------|------|
| 键盘方向键 | 上/下/左/右 |
| 键盘 WASD | 同上 |
| 触屏 D-Pad | 屏幕上的方向按钮 |
| 滑动手势 | 可选支持 |

## 6. 渲染方案

### 6.1 使用引擎 API
- `SpriteBatch` - 绘制方块（使用默认白色纹理）
- `Color` - 设置不同部分的颜色
- `Camera2D` - 固定正交相机

### 6.2 绘制顺序
1. 背景色填充
2. 网格线（可选，微弱显示）
3. 食物（带发光效果）
4. 蛇身（从尾到头渐变）
5. UI 文字（得分、游戏结束）

### 6.3 无纹理方案
贪吃蛇使用纯色方块渲染，不需要外部纹理资源：
```typescript
// 使用白色纹理 + Color 着色
batch.drawQuad(x, y, w, h, 0, atlas.fullRegion, atlas, new Color(r, g, b, a));
```

## 7. 音效设计

| 事件 | 音效类型 |
|------|---------|
| 移动 | 可选轻微 "blip" |
| 吃食物 | 清脆收集音 |
| 游戏结束 | 低沉失败音 |

使用 `AudioManager` 加载和播放。

## 8. UI 设计

### 8.1 游戏画面布局
```
┌─────────────────────────────┐
│  SCORE: 120     BEST: 250   │  ← 顶部 HUD
├─────────────────────────────┤
│                             │
│      ██                     │
│      ██ 🍎                  │  ← 游戏区域
│      ██                     │
│                             │
├─────────────────────────────┤
│  [↑]                        │
│ [←][↓][→]  (移动端 D-Pad)   │  ← 底部控制区
└─────────────────────────────┘
```

### 8.2 游戏状态
- **菜单**: 显示标题 "SNAKE" + "按空格开始"
- **游戏中**: 仅显示分数
- **结束**: 显示 "GAME OVER" + 最终分数 + "按空格重开"

## 9. 实现阶段

### Phase 1: 基础框架
- [ ] 创建 index.html (复制 dungeon 结构，调整标题)
- [ ] 创建 package.json
- [ ] 实现 Game 类基础结构
- [ ] 连接引擎，显示纯色背景

### Phase 2: 核心玩法
- [ ] 实现 Snake 类 (移动、转向、增长)
- [ ] 实现 Food 类 (随机生成)
- [ ] 碰撞检测
- [ ] 键盘输入

### Phase 3: 完善体验
- [ ] 触屏 D-Pad 控制
- [ ] 得分系统
- [ ] 游戏状态切换 (开始/结束)
- [ ] 平滑移动动画 (插值)

### Phase 4:  polish
- [ ] 添加音效
- [ ] 高分记录 (localStorage)
- [ ] 视觉效果优化 (发光、渐变)

## 10. 参考代码

### 相机设置
```typescript
const camera = new Camera2D(canvas.width, canvas.height);
camera.zoom = 1.0;  // 固定缩放
```

### 游戏循环
```typescript
const loop = new GameLoop(60);
let accumulator = 0;
const TICK_RATE = 1 / 10;  // 10 FPS for snake movement

loop.onUpdate = (dt) => {
  accumulator += dt;
  while (accumulator >= TICK_RATE) {
    game.tick();  // 蛇移动逻辑
    accumulator -= TICK_RATE;
  }
  // 渲染插值...
};
```

---

## 附录: 快速启动命令

```bash
# 开发服务器
npm run dev

# 访问游戏
http://localhost:5173/games/snake/
```
