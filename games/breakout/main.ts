import {
  createGfxDevice, SpriteBatch, TextureAtlas, Camera2D,
  GameLoop, Vec2, Color,
  TextRenderer,
} from '@mote/engine';
import { InputManager, ActionMap, ActionType } from '@mote/engine/Input';

// 动态创建白色纹理 Data URL
function createWhitePixelDataUrl(): string {
  const c = document.createElement('canvas');
  c.width = 2;
  c.height = 2;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 2, 2);
  return c.toDataURL();
}

// ── 游戏常量 ─────────────────────────────────────────────────────────────────
const CANVAS_WIDTH = 1280;
const CANVAS_HEIGHT = 960;
const GAME_WIDTH = 1200;
const GAME_HEIGHT = 880;
const GAME_OFFSET_X = (CANVAS_WIDTH - GAME_WIDTH) / 2;
const GAME_OFFSET_Y = (CANVAS_HEIGHT - GAME_HEIGHT) / 2;

const PADDLE_WIDTH = 160;
const PADDLE_HEIGHT = 32;
const PADDLE_SPEED = 800;
const PADDLE_Y = GAME_OFFSET_Y + GAME_HEIGHT - 60;

const BALL_SIZE = 24;
const BALL_RADIUS = 12;
const INITIAL_BALL_SPEED = 400;
const MAX_BALL_SPEED = 800;

const BRICK_WIDTH = 100;
const BRICK_HEIGHT = 40;
const BRICK_ROWS = 6;
const BRICK_COLS = 10;
const BRICK_PADDING_X = 8;
const BRICK_PADDING_Y = 8;
const BRICK_OFFSET_Y = GAME_OFFSET_Y + 80;

const INITIAL_LIVES = 3;

// ── 颜色 ──────────────────────────────────────────────────────────────────────
const BG_COLOR = new Color(0.1, 0.1, 0.18, 1.0);
const GAME_BORDER_COLOR = new Color(0.24, 0.24, 0.36, 1.0);
const PADDLE_COLOR = new Color(0.376, 0.647, 0.98, 1.0);
const PADDLE_GLOW_COLOR = new Color(0.231, 0.51, 0.965, 0.4);
const BALL_COLOR = new Color(1, 1, 1, 1.0);
// 球拖尾颜色在绘制时动态计算

const BRICK_COLORS = [
  { color: new Color(0.937, 0.267, 0.267, 1.0), score: 10 },   // 红
  { color: new Color(0.976, 0.451, 0.086, 1.0), score: 20 },   // 橙
  { color: new Color(0.918, 0.702, 0.031, 1.0), score: 30 },   // 黄
  { color: new Color(0.133, 0.773, 0.369, 1.0), score: 40 },   // 绿
  { color: new Color(0.231, 0.51, 0.965, 1.0), score: 50 },    // 蓝
  { color: new Color(0.659, 0.333, 0.969, 1.0), score: 60 },   // 紫
];

const TEXT_WHITE = new Color(1, 1, 1, 1.0);
const TEXT_WHITE_90 = new Color(1, 1, 1, 0.9);
const TEXT_WHITE_60 = new Color(1, 1, 1, 0.6);
const TEXT_DIM = new Color(0.6, 0.6, 0.6, 1.0);
const GAME_OVER_COLOR = new Color(0.937, 0.267, 0.267, 1.0);
const VICTORY_COLOR = new Color(0.133, 0.773, 0.369, 1.0);
const TITLE_COLOR = new Color(0.376, 0.647, 0.98, 1.0);

// ── 工具函数 ─────────────────────────────────────────────────────────────────
class Rect {
  constructor(public x: number, public y: number, public width: number, public height: number) {}
  contains(point: Vec2): boolean {
    return point.x >= this.x && point.x <= this.x + this.width &&
           point.y >= this.y && point.y <= this.y + this.height;
  }
  center(): Vec2 {
    return new Vec2(this.x + this.width / 2, this.y + this.height / 2);
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function checkAABBCollision(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x &&
         a.y < b.y + b.height && a.y + a.height > b.y;
}

// ── 挡板类 ────────────────────────────────────────────────────────────────────
class Paddle {
  position: Vec2;
  width: number;
  height: number;
  speed: number;

  constructor() {
    this.position = new Vec2(CANVAS_WIDTH / 2, PADDLE_Y);
    this.width = PADDLE_WIDTH;
    this.height = PADDLE_HEIGHT;
    this.speed = PADDLE_SPEED;
  }

  update(dt: number, inputX: number): void {
    this.position.x += inputX * this.speed * dt;
    const halfWidth = this.width / 2;
    const minX = GAME_OFFSET_X + halfWidth;
    const maxX = GAME_OFFSET_X + GAME_WIDTH - halfWidth;
    this.position.x = clamp(this.position.x, minX, maxX);
  }

  getBounds(): Rect {
    return new Rect(
      this.position.x - this.width / 2,
      this.position.y - this.height / 2,
      this.width,
      this.height
    );
  }

  // 返回水平速度系数 (-2 ~ +2)
  getBounceDirection(ballX: number): number {
    const relativeX = (ballX - this.position.x) / (this.width / 2);
    return clamp(relativeX * 2, -2, 2);
  }

  draw(batch: SpriteBatch, atlas: TextureAtlas): void {
    // 发光效果
    batch.drawQuad(
      this.position.x, this.position.y,
      this.width + 20, this.height + 10,
      0, atlas.fullRegion, atlas, PADDLE_GLOW_COLOR
    );
    // 挡板主体
    batch.drawQuad(
      this.position.x, this.position.y,
      this.width, this.height,
      0, atlas.fullRegion, atlas, PADDLE_COLOR
    );
  }
}

// ── 球类 ──────────────────────────────────────────────────────────────────────
class Ball {
  position: Vec2;
  velocity: Vec2;
  radius: number;
  active: boolean;
  trail: Vec2[];
  private trailTimer: number;

  constructor() {
    this.position = new Vec2(0, 0);
    this.velocity = new Vec2(0, 0);
    this.radius = BALL_RADIUS;
    this.active = false;
    this.trail = [];
    this.trailTimer = 0;
  }

  reset(paddle: Paddle): void {
    this.position = new Vec2(paddle.position.x, paddle.position.y - PADDLE_HEIGHT / 2 - BALL_RADIUS - 5);
    this.velocity = new Vec2(0, 0);
    this.active = false;
    this.trail = [];
  }

  launch(): void {
    if (this.active) return;
    this.active = true;
    const angle = (Math.random() * 0.5 - 0.25) * Math.PI; // -45° ~ +45°
    this.velocity = new Vec2(
      Math.sin(angle) * INITIAL_BALL_SPEED,
      -Math.cos(angle) * INITIAL_BALL_SPEED
    );
  }

  update(dt: number): 'bounce' | 'dead' | null {
    if (!this.active) return null;

    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;

    // 更新拖尾
    this.trailTimer += dt;
    if (this.trailTimer >= 0.016) { // 约60fps记录一次
      this.trail.unshift(new Vec2(this.position.x, this.position.y));
      if (this.trail.length > 8) this.trail.pop();
      this.trailTimer = 0;
    }

    // 左右墙壁碰撞
    const leftBound = GAME_OFFSET_X + this.radius;
    const rightBound = GAME_OFFSET_X + GAME_WIDTH - this.radius;
    if (this.position.x <= leftBound) {
      this.position.x = leftBound;
      this.velocity.x = Math.abs(this.velocity.x);
      return 'bounce';
    }
    if (this.position.x >= rightBound) {
      this.position.x = rightBound;
      this.velocity.x = -Math.abs(this.velocity.x);
      return 'bounce';
    }

    // 顶部墙壁碰撞
    const topBound = GAME_OFFSET_Y + this.radius;
    if (this.position.y <= topBound) {
      this.position.y = topBound;
      this.velocity.y = Math.abs(this.velocity.y);
      return 'bounce';
    }

    // 底部检测
    const bottomBound = GAME_OFFSET_Y + GAME_HEIGHT - this.radius;
    if (this.position.y >= bottomBound) {
      return 'dead';
    }

    return null;
  }

  checkPaddleCollision(paddle: Paddle): boolean {
    const paddleBounds = paddle.getBounds();
    const ballLeft = this.position.x - this.radius;
    const ballRight = this.position.x + this.radius;
    const ballTop = this.position.y - this.radius;
    const ballBottom = this.position.y + this.radius;

    if (ballRight >= paddleBounds.x &&
        ballLeft <= paddleBounds.x + paddleBounds.width &&
        ballBottom >= paddleBounds.y &&
        ballTop <= paddleBounds.y + paddleBounds.height) {
      
      // 计算反弹
      const bounceDir = paddle.getBounceDirection(this.position.x);
      const speed = Math.sqrt(this.velocity.x ** 2 + this.velocity.y ** 2);
      const newSpeed = Math.min(speed * 1.02, MAX_BALL_SPEED); // 略微加速
      
      this.velocity.x = bounceDir * newSpeed * 0.5;
      this.velocity.y = -Math.abs(newSpeed * 0.866); // 保持约30°~60°角度
      this.position.y = paddleBounds.y - this.radius - 1;
      
      return true;
    }
    return false;
  }

  getBounds(): Rect {
    return new Rect(
      this.position.x - this.radius,
      this.position.y - this.radius,
      this.radius * 2,
      this.radius * 2
    );
  }

  draw(batch: SpriteBatch, atlas: TextureAtlas): void {
    // 绘制拖尾
    for (let i = 0; i < this.trail.length; i++) {
      const alpha = 0.3 * (1 - i / this.trail.length);
      const size = BALL_SIZE * (1 - i * 0.08);
      const color = new Color(1, 1, 1, alpha);
      batch.drawQuad(
        this.trail[i].x, this.trail[i].y,
        size, size,
        0, atlas.fullRegion, atlas, color
      );
    }

    // 绘制球
    batch.drawQuad(
      this.position.x, this.position.y,
      BALL_SIZE, BALL_SIZE,
      0, atlas.fullRegion, atlas, BALL_COLOR
    );
  }
}

// ── 砖块类 ────────────────────────────────────────────────────────────────────
class Brick {
  position: Vec2;
  width: number;
  height: number;
  color: Color;
  score: number;
  active: boolean;

  constructor(x: number, y: number, width: number, height: number, color: Color, score: number) {
    this.position = new Vec2(x, y);
    this.width = width;
    this.height = height;
    this.color = color;
    this.score = score;
    this.active = true;
  }

  getBounds(): Rect {
    return new Rect(
      this.position.x - this.width / 2,
      this.position.y - this.height / 2,
      this.width,
      this.height
    );
  }

  draw(batch: SpriteBatch, atlas: TextureAtlas): void {
    if (!this.active) return;
    batch.drawQuad(
      this.position.x, this.position.y,
      this.width - 4, this.height - 4,
      0, atlas.fullRegion, atlas, this.color
    );
  }
}

// ── 砖块网格类 ────────────────────────────────────────────────────────────────
class BrickGrid {
  bricks: Brick[] = [];
  rows: number = BRICK_ROWS;
  cols: number = BRICK_COLS;

  init(): void {
    this.bricks = [];
    const totalWidth = this.cols * BRICK_WIDTH + (this.cols - 1) * BRICK_PADDING_X;
    const startX = GAME_OFFSET_X + (GAME_WIDTH - totalWidth) / 2 + BRICK_WIDTH / 2;

    for (let row = 0; row < this.rows; row++) {
      const colorData = BRICK_COLORS[row];
      for (let col = 0; col < this.cols; col++) {
        const x = startX + col * (BRICK_WIDTH + BRICK_PADDING_X);
        const y = BRICK_OFFSET_Y + row * (BRICK_HEIGHT + BRICK_PADDING_Y);
        this.bricks.push(new Brick(x, y, BRICK_WIDTH, BRICK_HEIGHT, colorData.color, colorData.score));
      }
    }
  }

  getActiveCount(): number {
    return this.bricks.filter(b => b.active).length;
  }

  checkCollision(ball: Ball): Brick | null {
    const ballBounds = ball.getBounds();
    for (const brick of this.bricks) {
      if (!brick.active) continue;
      if (checkAABBCollision(ballBounds, brick.getBounds())) {
        brick.active = false;
        // 反弹
        const brickCenter = brick.position;
        const dx = ball.position.x - brickCenter.x;
        const dy = ball.position.y - brickCenter.y;
        if (Math.abs(dx) / brick.width > Math.abs(dy) / brick.height) {
          ball.velocity.x = -ball.velocity.x;
        } else {
          ball.velocity.y = -ball.velocity.y;
        }
        return brick;
      }
    }
    return null;
  }

  draw(batch: SpriteBatch, atlas: TextureAtlas): void {
    for (const brick of this.bricks) {
      brick.draw(batch, atlas);
    }
  }
}

// ── 游戏状态 ──────────────────────────────────────────────────────────────────
type GameState = 'menu' | 'playing' | 'gameover' | 'victory';

class Game {
  state: GameState = 'menu';
  score: number = 0;
  lives: number = INITIAL_LIVES;
  highScore: number = 0;
  combo: number = 0;
  comboTimer: number = 0;
  
  paddle: Paddle;
  ball: Ball;
  bricks: BrickGrid;
  
  private font: ReturnType<TextRenderer['getFont']> | null = null;
  private textRenderer: TextRenderer | null = null;

  constructor() {
    this.paddle = new Paddle();
    this.ball = new Ball();
    this.bricks = new BrickGrid();
    this.loadHighScore();
    this.resetBall();
  }

  setFont(font: ReturnType<TextRenderer['getFont']>, textRenderer: TextRenderer): void {
    this.font = font;
    this.textRenderer = textRenderer;
  }

  loadHighScore(): void {
    const saved = localStorage.getItem('breakout-highscore');
    if (saved) this.highScore = parseInt(saved, 10);
  }

  saveHighScore(): void {
    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('breakout-highscore', this.highScore.toString());
    }
  }

  start(): void {
    this.state = 'playing';
    this.score = 0;
    this.lives = INITIAL_LIVES;
    this.combo = 0;
    this.bricks.init();
    this.resetBall();
  }

  resetBall(): void {
    this.ball.reset(this.paddle);
    this.combo = 0;
  }

  launchBall(): void {
    this.ball.launch();
  }

  onLifeLost(): void {
    this.lives--;
    if (this.lives <= 0) {
      this.state = 'gameover';
      this.saveHighScore();
    } else {
      this.resetBall();
    }
  }

  onVictory(): void {
    this.state = 'victory';
    this.saveHighScore();
  }

  update(dt: number, inputX: number, launchPressed: boolean): void {
    if (this.state === 'menu') {
      if (launchPressed) {
        this.start();
        this.launchBall();
      }
      return;
    }

    if (this.state === 'gameover' || this.state === 'victory') {
      if (launchPressed) {
        this.start();
        this.launchBall();
      }
      return;
    }

    if (this.state !== 'playing') return;

    // 更新连击计时器
    if (this.combo > 0) {
      this.comboTimer += dt;
      if (this.comboTimer > 1.5) {
        this.combo = 0;
      }
    }

    // 更新挡板
    this.paddle.update(dt, inputX);

    // 更新球（如果未发射，跟随挡板）
    if (!this.ball.active) {
      this.ball.position.x = this.paddle.position.x;
      if (launchPressed) {
        this.launchBall();
      }
    } else {
      const result = this.ball.update(dt);
      if (result === 'dead') {
        this.onLifeLost();
      }

      // 检测碰撞
      this.ball.checkPaddleCollision(this.paddle);
      
      const hitBrick = this.bricks.checkCollision(this.ball);
      if (hitBrick) {
        this.combo++;
        this.comboTimer = 0;
        const comboBonus = (this.combo - 1) * 5;
        this.score += hitBrick.score + comboBonus;
        
        // 检查胜利
        if (this.bricks.getActiveCount() === 0) {
          this.onVictory();
        }
      }
    }
  }

  draw(batch: SpriteBatch, atlas: TextureAtlas, camera: Camera2D): void {
    batch.begin(camera);

    // 绘制背景
    batch.drawQuad(
      CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2,
      CANVAS_WIDTH, CANVAS_HEIGHT,
      0, atlas.fullRegion, atlas, BG_COLOR
    );

    // 绘制游戏区域边框
    batch.drawQuad(
      GAME_OFFSET_X + GAME_WIDTH / 2, GAME_OFFSET_Y + GAME_HEIGHT / 2,
      GAME_WIDTH + 4, GAME_HEIGHT + 4,
      0, atlas.fullRegion, atlas, GAME_BORDER_COLOR
    );

    // 绘制游戏对象
    this.bricks.draw(batch, atlas);
    this.paddle.draw(batch, atlas);
    this.ball.draw(batch, atlas);

    // 绘制UI
    if (this.font && this.textRenderer) {
      this.drawUI();
    }

    batch.end();
  }

  private drawUI(): void {
    if (!this.font || !this.textRenderer) return;
    const tr = this.textRenderer;

    // 顶部HUD
    const hudY = 30;
    tr.drawText(`生命: ${'❤'.repeat(this.lives)}`, GAME_OFFSET_X + 20, hudY, {
      font: this.font, fontSize: 20, color: TEXT_WHITE_90, align: 'left'
    });
    tr.drawText(`分数: ${this.score}`, CANVAS_WIDTH / 2, hudY, {
      font: this.font, fontSize: 24, color: TEXT_WHITE, align: 'center'
    });
    tr.drawText(`最高: ${this.highScore}`, GAME_OFFSET_X + GAME_WIDTH - 20, hudY, {
      font: this.font, fontSize: 20, color: TEXT_WHITE_60, align: 'right'
    });

    const centerX = CANVAS_WIDTH / 2;
    const centerY = CANVAS_HEIGHT / 2;

    if (this.state === 'menu') {
      tr.drawText('BREAKOUT', centerX, centerY - 80, {
        font: this.font, fontSize: 64, color: TITLE_COLOR, align: 'center'
      });
      tr.drawText('按空格或点击开始游戏', centerX, centerY + 20, {
        font: this.font, fontSize: 24, color: TEXT_DIM, align: 'center'
      });
      tr.drawText('方向键或 A/D 移动挡板', centerX, centerY + 60, {
        font: this.font, fontSize: 18, color: TEXT_WHITE_60, align: 'center'
      });
    } else if (this.state === 'playing') {
      if (!this.ball.active) {
        tr.drawText('按空格或点击发射', centerX, CANVAS_HEIGHT - 100, {
          font: this.font, fontSize: 20, color: TEXT_DIM, align: 'center'
        });
      }
      if (this.combo > 1) {
        tr.drawText(`${this.combo} 连击!`, centerX, 70, {
          font: this.font, fontSize: 20, color: new Color(1, 0.8, 0, 1), align: 'center'
        });
      }
    } else if (this.state === 'gameover') {
      tr.drawText('游戏结束', centerX, centerY - 60, {
        font: this.font, fontSize: 56, color: GAME_OVER_COLOR, align: 'center'
      });
      tr.drawText(`最终得分: ${this.score}`, centerX, centerY + 20, {
        font: this.font, fontSize: 28, color: TEXT_WHITE, align: 'center'
      });
      tr.drawText('按空格或点击重新开始', centerX, centerY + 100, {
        font: this.font, fontSize: 20, color: TEXT_DIM, align: 'center'
      });
    } else if (this.state === 'victory') {
      tr.drawText('恭喜通关!', centerX, centerY - 60, {
        font: this.font, fontSize: 56, color: VICTORY_COLOR, align: 'center'
      });
      tr.drawText(`最终得分: ${this.score}`, centerX, centerY + 20, {
        font: this.font, fontSize: 28, color: TEXT_WHITE, align: 'center'
      });
      tr.drawText('按空格或点击重新开始', centerX, centerY + 100, {
        font: this.font, fontSize: 20, color: TEXT_DIM, align: 'center'
      });
    }
  }
}

// ── 触屏控制 ─────────────────────────────────────────────────────────────────
class TouchController {
  private touchStartX: number = 0;
  private currentX: number = 0;
  private isTouching: boolean = false;
  private tapCallback: () => void;

  constructor(canvas: HTMLCanvasElement, tapCallback: () => void) {
    this.tapCallback = tapCallback;
    
    canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.isTouching = true;
      this.touchStartX = e.touches[0].clientX;
      this.currentX = this.touchStartX;
    }, { passive: false });

    canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      if (this.isTouching) {
        this.currentX = e.touches[0].clientX;
      }
    }, { passive: false });

    canvas.addEventListener('touchend', (e) => {
      e.preventDefault();
      // 检测点击（移动距离小）
      const moveDistance = Math.abs(this.currentX - this.touchStartX);
      if (moveDistance < 10) {
        this.tapCallback();
      }
      this.isTouching = false;
    });

    canvas.addEventListener('click', () => {
      this.tapCallback();
    });
  }

  getInputX(): number {
    if (!this.isTouching) return 0;
    const delta = (this.currentX - this.touchStartX) / 50; // 灵敏度调整
    return clamp(delta, -1, 1);
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const fallback = document.getElementById('fallback') as HTMLDivElement;
const touchHint = document.getElementById('touchHint') as HTMLDivElement;

async function init(): Promise<void> {
  if (!navigator.gpu) {
    statusEl.textContent = 'WebGPU not supported';
    fallback.style.display = 'block';
    return;
  }

  const gfx = await createGfxDevice(canvas);
  const batch = new SpriteBatch(gfx);
  const textRenderer = new TextRenderer(gfx, batch);
  const camera = new Camera2D(canvas.width, canvas.height);
  camera.position = new Vec2(canvas.width / 2, canvas.height / 2);
  const loop = new GameLoop(60);

  // 创建白色纹理
  const whiteAtlas = await TextureAtlas.load(gfx, batch.getAtlasBindGroupLayout(), createWhitePixelDataUrl());

  // 加载字体
  let fontLoaded = false;
  try {
    await textRenderer.loadBitmapFontJsonMulti('fonsung', [
      {
        atlasUrl: '/assets/fonts/Fonsung/Fonsung-16-3000.png',
        jsonUrl: '/assets/fonts/Fonsung/Fonsung-16-3000.json'
      },
      {
        atlasUrl: '/assets/fonts/Fonsung/Fonsung-16-3500.png',
        jsonUrl: '/assets/fonts/Fonsung/Fonsung-16-3500.json'
      },
    ]);
    fontLoaded = true;
  } catch (e) {
    console.warn('Failed to load font:', e);
  }

  // 状态显示
  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  statusEl.textContent = `WebGPU ✓ — Breakout ${CANVAS_WIDTH}×${CANVAS_HEIGHT}` +
    (hasTouch ? ' (触屏支持)' : '') +
    (fontLoaded ? ' [中文字体✓]' : ' [中文字体✗]');
  
  if (hasTouch) {
    touchHint.classList.add('visible');
  }

  // 输入系统
  const input = new InputManager(canvas);
  const gameplay = new ActionMap('Gameplay', {
    Move: {
      type: ActionType.Axis2D,
      composites: [
        { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' },
        { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
      ],
    },
  }, input);
  gameplay.enable();
  input.addMap(gameplay);

  // 直接键盘检测
  const keysPressed = new Set<string>();
  window.addEventListener('keydown', (e) => keysPressed.add(e.code));
  window.addEventListener('keyup', (e) => keysPressed.delete(e.code));

  // 游戏实例
  const game = new Game();
  if (fontLoaded) game.setFont(textRenderer.getFont('fonsung'), textRenderer);

  // 触屏控制
  let touchLaunch = false;
  const touchCtrl = new TouchController(canvas, () => {
    touchLaunch = true;
  });

  loop.onUpdate = (dt) => {
    input.update();
    
    const moveInput = input.action('Move').vec2().x;
    const keyboardLaunch = keysPressed.has('Space') || keysPressed.has('Enter');
    const launchPressed = keyboardLaunch || touchLaunch;
    touchLaunch = false;
    
    const touchInput = touchCtrl.getInputX();
    const combinedMove = moveInput !== 0 ? moveInput : touchInput;
    
    game.update(dt, combinedMove, launchPressed);
    camera.update(dt);
    input.endFrame();
  };

  loop.onRender = () => {
    game.draw(batch, whiteAtlas, camera);
  };

  loop.start();
}

init().catch(err => {
  statusEl.textContent = `Error: ${err.message}`;
  console.error(err);
});
