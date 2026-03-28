import {
  createGfxDevice, SpriteBatch, TextureAtlas, Camera2D,
  GameLoop, InputManager, ActionMap, ActionType, Vec2, Color,
} from '@mote/engine';

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

// ── Touch D-Pad Controller ───────────────────────────────────────────────────
class TouchDPad {
  private dirs = { up: false, down: false, left: false, right: false };
  private value = new Vec2(0, 0);
  private container: HTMLElement | null;

  constructor(containerId: string) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    this.container.classList.add('visible');

    const buttons = this.container.querySelectorAll('.dpad-btn[data-dir]');
    buttons.forEach(btn => {
      const dir = btn.getAttribute('data-dir') as keyof typeof this.dirs;

      const onStart = (e: Event) => {
        e.preventDefault();
        this.dirs[dir] = true;
        btn.classList.add('active');
        this.updateValue();
      };

      const onEnd = (e: Event) => {
        e.preventDefault();
        this.dirs[dir] = false;
        btn.classList.remove('active');
        this.updateValue();
      };

      btn.addEventListener('touchstart', onStart, { passive: false });
      btn.addEventListener('touchend', onEnd);
      btn.addEventListener('touchcancel', onEnd);
      btn.addEventListener('mousedown', onStart);
      btn.addEventListener('mouseup', onEnd);
      btn.addEventListener('mouseleave', onEnd);
    });
  }

  private updateValue(): void {
    let x = 0;
    let y = 0;
    if (this.dirs.left) x = -1;
    else if (this.dirs.right) x = 1;
    if (this.dirs.up) y = -1;
    else if (this.dirs.down) y = 1;
    this.value = new Vec2(x, y);
  }

  getVector(): Vec2 {
    return this.value;
  }
}

// ── Game Constants ───────────────────────────────────────────────────────────
const CANVAS_WIDTH = 640;
const CANVAS_HEIGHT = 480;
const GRID_COLS = 20;
const GRID_ROWS = 15;
const CELL_SIZE = 32;

// Colors - 使用更鲜明的颜色以便调试
const BG_COLOR = new Color(0.12, 0.12, 0.2, 1.0);
const SNAKE_HEAD_COLOR = new Color(0.3, 0.9, 0.5, 1.0);
const SNAKE_BODY_COLOR = new Color(0.15, 0.8, 0.4, 1.0);
const FOOD_COLOR = new Color(1.0, 0.4, 0.7, 1.0);
const GAME_OVER_COLOR = new Color(0.95, 0.25, 0.25, 1.0);

// ── Snake Class ──────────────────────────────────────────────────────────────
class Snake {
  segments: Vec2[] = [];
  direction: Vec2 = new Vec2(1, 0);
  nextDirection: Vec2 = new Vec2(1, 0);

  constructor(startCol: number, startRow: number) {
    for (let i = 0; i < 3; i++) {
      this.segments.push(new Vec2(startCol - i, startRow));
    }
  }

  setDirection(dir: Vec2): void {
    if (dir.x === 0 && dir.y === 0) return;
    if (dir.x !== -this.direction.x || dir.y !== -this.direction.y) {
      this.nextDirection = dir;
    }
  }

  move(): boolean {
    this.direction = this.nextDirection;
    const head = this.segments[0];
    const newHead = new Vec2(head.x + this.direction.x, head.y + this.direction.y);

    if (this.checkCollision(newHead)) {
      return false;
    }

    this.segments.unshift(newHead);
    this.segments.pop();
    return true;
  }

  grow(): void {
    const tail = this.segments[this.segments.length - 1];
    this.segments.push(new Vec2(tail.x, tail.y));
  }

  checkCollision(pos: Vec2): boolean {
    if (pos.x < 0 || pos.x >= GRID_COLS || pos.y < 0 || pos.y >= GRID_ROWS) {
      return true;
    }
    for (const seg of this.segments) {
      if (seg.x === pos.x && seg.y === pos.y) {
        return true;
      }
    }
    return false;
  }

  draw(batch: SpriteBatch, atlas: TextureAtlas): void {
    for (let i = 0; i < this.segments.length; i++) {
      const seg = this.segments[i];
      const x = seg.x * CELL_SIZE + CELL_SIZE / 2;
      const y = seg.y * CELL_SIZE + CELL_SIZE / 2;
      
      const alpha = i === 0 ? 1.0 : 1.0 - (i / this.segments.length) * 0.4;
      const color = i === 0 ? SNAKE_HEAD_COLOR : SNAKE_BODY_COLOR;
      const finalColor = new Color(color.r, color.g, color.b, color.a * alpha);
      
      batch.drawQuad(x, y, CELL_SIZE - 2, CELL_SIZE - 2, 0, atlas.fullRegion, atlas, finalColor);
    }
  }
}

// ── Food Class ───────────────────────────────────────────────────────────────
class Food {
  position: Vec2 = new Vec2(0, 0);

  spawn(snake: Snake): void {
    let pos: Vec2;
    do {
      pos = new Vec2(
        Math.floor(Math.random() * GRID_COLS),
        Math.floor(Math.random() * GRID_ROWS)
      );
    } while (snake.segments.some(s => s.x === pos.x && s.y === pos.y));
    this.position = pos;
  }

  draw(batch: SpriteBatch, atlas: TextureAtlas, time: number): void {
    const x = this.position.x * CELL_SIZE + CELL_SIZE / 2;
    const y = this.position.y * CELL_SIZE + CELL_SIZE / 2;
    const scale = 1.0 + Math.sin(time * 5) * 0.1;
    const size = (CELL_SIZE - 4) * scale;
    
    batch.drawQuad(x, y, size, size, 0, atlas.fullRegion, atlas, FOOD_COLOR);
  }
}

// ── Game State ────────────────────────────────────────────────────────────────
type GameState = 'menu' | 'playing' | 'gameover';

class Game {
  state: GameState = 'menu';
  score = 0;
  highScore = 0;
  snake: Snake;
  food: Food;
  tickAccumulator = 0;
  tickRate = 0.15;
  movePending = false;

  constructor() {
    this.snake = new Snake(5, 7);
    this.food = new Food();
    this.food.spawn(this.snake);
    this.loadHighScore();
  }

  loadHighScore(): void {
    const saved = localStorage.getItem('snake-highscore');
    if (saved) this.highScore = parseInt(saved, 10);
  }

  saveHighScore(): void {
    localStorage.setItem('snake-highscore', this.highScore.toString());
  }

  start(): void {
    this.state = 'playing';
    this.score = 0;
    this.snake = new Snake(5, 7);
    this.food.spawn(this.snake);
    this.tickRate = 0.15;
  }

  update(dt: number, moveInput: Vec2): void {
    if (this.state !== 'playing') {
      if (this.state === 'menu' && (moveInput.x !== 0 || moveInput.y !== 0)) {
        this.start();
      }
      if (this.state === 'gameover' && (moveInput.x !== 0 || moveInput.y !== 0)) {
        this.start();
      }
      return;
    }

    this.snake.setDirection(moveInput);

    this.tickAccumulator += dt;
    while (this.tickAccumulator >= this.tickRate) {
      this.tick();
      this.tickAccumulator -= this.tickRate;
    }
  }

  tick(): void {
    const alive = this.snake.move();
    if (!alive) {
      this.state = 'gameover';
      if (this.score > this.highScore) {
        this.highScore = this.score;
        this.saveHighScore();
      }
      return;
    }

    const head = this.snake.segments[0];
    if (head.x === this.food.position.x && head.y === this.food.position.y) {
      this.snake.grow();
      this.score += 10;
      this.food.spawn(this.snake);
      
      if (this.score % 50 === 0) {
        this.tickRate = Math.max(0.06, this.tickRate * 0.9);
      }
    }
  }

  draw(batch: SpriteBatch, atlas: TextureAtlas, time: number, camera: Camera2D): void {
    batch.begin(camera);

    // 绘制背景 - 使用一个大的纯色矩形代替多个格子
    batch.drawQuad(CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2, CANVAS_WIDTH, CANVAS_HEIGHT, 0, atlas.fullRegion, atlas, BG_COLOR);

    this.snake.draw(batch, atlas);
    this.food.draw(batch, atlas, time);

    if (this.state === 'menu') {
      this.drawCenteredText(batch, atlas, 'SNAKE', 0, -40, 2.5, new Color(0.29, 0.87, 0.5, 1.0));
      this.drawCenteredText(batch, atlas, 'Press Arrow Keys to Start', 0, 20, 1.0, new Color(0.6, 0.6, 0.6, 1.0));
    } else if (this.state === 'gameover') {
      this.drawCenteredText(batch, atlas, 'GAME OVER', 0, -20, 2.0, GAME_OVER_COLOR);
      this.drawCenteredText(batch, atlas, `Score: ${this.score}`, 0, 30, 1.2, new Color(1, 1, 1, 1));
      this.drawCenteredText(batch, atlas, 'Press Arrow Keys to Restart', 0, 70, 1.0, new Color(0.6, 0.6, 0.6, 1.0));
    }

    batch.end();
  }

  drawCenteredText(batch: SpriteBatch, atlas: TextureAtlas, _text: string, offsetX: number, offsetY: number, scale: number, color: Color): void {
    const x = CANVAS_WIDTH / 2 + offsetX;
    const y = CANVAS_HEIGHT / 2 + offsetY;
    batch.drawQuad(x, y, 100 * scale, 20 * scale, 0, atlas.fullRegion, atlas, color);
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
const canvas = document.getElementById('canvas') as HTMLCanvasElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const fallback = document.getElementById('fallback') as HTMLDivElement;

async function init(): Promise<void> {
  if (!navigator.gpu) {
    statusEl.textContent = 'WebGPU not supported';
    fallback.style.display = 'block';
    return;
  }

  const gfx = await createGfxDevice(canvas);
  const batch = new SpriteBatch(gfx);
  const camera = new Camera2D(canvas.width, canvas.height);
  // 相机看向网格中心
  camera.position = new Vec2((GRID_COLS * CELL_SIZE) / 2, (GRID_ROWS * CELL_SIZE) / 2);
  const loop = new GameLoop(60);

  // Create white texture for solid color rendering
  const whiteAtlas = await TextureAtlas.load(gfx, createWhitePixelDataUrl());

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

  const touchDPad = new TouchDPad('dpad');
  const game = new Game();

  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  statusEl.textContent = `WebGPU ✓ — Snake ${GRID_COLS}x${GRID_ROWS} — WASD/方向键/触屏` + (hasTouch ? ' (触屏支持)' : '');

  loop.onUpdate = (dt) => {
    input.update();
    const move = input.action('Move').vec2();
    const touch = touchDPad.getVector();
    const combinedMove = new Vec2(
      move.x !== 0 ? move.x : touch.x,
      move.y !== 0 ? move.y : touch.y
    );
    game.update(dt, combinedMove);
    camera.update(dt);
    input.endFrame();
  };

  let time = 0;
  loop.onRender = () => {
    time += 0.016;
    game.draw(batch, whiteAtlas, time, camera);
  };

  loop.start();
}

init().catch(err => {
  statusEl.textContent = `Error: ${err.message}`;
  console.error(err);
});
