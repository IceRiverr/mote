import {
  GfxDevice, SpriteBatch, TextureAtlas, Camera2D,
  GameLoop, InputManager, ActionMap, ActionType, Vec2, Color,
} from '@mote/engine';
import { Rect } from '@mote/engine';

// ── Touch D-Pad Controller ───────────────────────────────────────────────────
class TouchDPad {
  private dirs = { up: false, down: false, left: false, right: false };
  private value = new Vec2(0, 0);
  private container: HTMLElement | null;

  constructor(containerId: string) {
    this.container = document.getElementById(containerId);
    if (!this.container) return;

    // Show d-pad on touch devices or small screens (mobile)
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const isSmallScreen = window.innerWidth <= 1024 || window.innerHeight <= 600;
    if (isTouchDevice || isSmallScreen) {
      this.container.classList.add('visible');
    }

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

// 导入地图数据和瓦片定义
import { ROOM_01 } from './maps/room_01.js';
import { T, BLOCKED_TILES, SPRITE_FILES } from './TileIds.js';

const TILE = 64;
const ASSETS = '/games/dungeon/assets/kenney_scribble-dungeons/PNG/Default (64px)';
const CHAR_ASSETS = `${ASSETS}/Characters`;

// 使用导入的地图数据
const MAP_DATA = ROOM_01;
const COLS = MAP_DATA.width;
const ROWS = MAP_DATA.height;
const MAP = MAP_DATA.tiles;

// 从地图获取出生点，如果没有则使用默认值
const SPAWN_COL = MAP_DATA.spawnPoint?.x ?? Math.floor(COLS / 2);
const SPAWN_ROW = MAP_DATA.spawnPoint?.y ?? Math.floor(ROWS / 2);

function tileAt(col: number, row: number): T {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return T.VOID;
  return MAP[row * COLS + col];
}

// ── Camera Controller (Game-specific logic) ───────────────────────────────────
/**
 * 边界限制摄像机控制器
 * - 玩家在屏幕中央区域移动时，摄像机保持静止（死区）
 * - 玩家靠近地图边缘时，摄像机被边界限制
 */
class DungeonCameraController {
  private readonly camera: Camera2D;
  private readonly bounds: Rect;
  deadZoneSize = 0.4;

  constructor(camera: Camera2D, mapX: number, mapY: number, mapW: number, mapH: number) {
    this.camera = camera;
    this.bounds = new Rect(mapX, mapY, mapW, mapH);
  }

  update(target: Vec2, dt: number): void {
    const halfW = (this.camera.viewport.width * 0.5) / this.camera.zoom;
    const halfH = (this.camera.viewport.height * 0.5) / this.camera.zoom;
    const deadHalfW = halfW * this.deadZoneSize;
    const deadHalfH = halfH * this.deadZoneSize;

    const deadLeft = this.camera.position.x - deadHalfW;
    const deadRight = this.camera.position.x + deadHalfW;
    const deadTop = this.camera.position.y - deadHalfH;
    const deadBottom = this.camera.position.y + deadHalfH;

    let deltaX = 0;
    let deltaY = 0;

    if (target.x < deadLeft) deltaX = target.x - deadLeft;
    if (target.x > deadRight) deltaX = target.x - deadRight;
    if (target.y < deadTop) deltaY = target.y - deadTop;
    if (target.y > deadBottom) deltaY = target.y - deadBottom;

    if (deltaX !== 0 || deltaY !== 0) {
      const LERP = 1 - Math.pow(0.001, dt);
      this.camera.position.x += deltaX * LERP;
      this.camera.position.y += deltaY * LERP;
    }

    this._clampToBounds();
  }

  private _clampToBounds(): void {
    const halfW = (this.camera.viewport.width * 0.5) / this.camera.zoom;
    const halfH = (this.camera.viewport.height * 0.5) / this.camera.zoom;
    const minX = this.bounds.left + halfW;
    const maxX = this.bounds.right - halfW;
    const minY = this.bounds.top + halfH;
    const maxY = this.bounds.bottom - halfH;

    if (this.bounds.width <= halfW * 2) {
      this.camera.position.x = this.bounds.x + this.bounds.width * 0.5;
    } else {
      this.camera.position.x = Math.max(minX, Math.min(maxX, this.camera.position.x));
    }

    if (this.bounds.height <= halfH * 2) {
      this.camera.position.y = this.bounds.y + this.bounds.height * 0.5;
    } else {
      this.camera.position.y = Math.max(minY, Math.min(maxY, this.camera.position.y));
    }
  }
}

// ── Hero ──────────────────────────────────────────────────────────────────────
class Hero {
  col: number;
  row: number;
  x: number;
  y: number;
  private moveCooldown = 0;
  private readonly MOVE_DELAY = 0.15;

  constructor(col: number, row: number) {
    this.col = col;
    this.row = row;
    this.x = col * TILE + TILE / 2;
    this.y = row * TILE + TILE / 2;
  }

  update(dt: number, move: { x: number; y: number }): void {
    this.moveCooldown = Math.max(0, this.moveCooldown - dt);

    if (this.moveCooldown === 0 && (move.x !== 0 || move.y !== 0)) {
      const dx = move.x > 0 ? 1 : move.x < 0 ? -1 : 0;
      const dy = move.y > 0 ? 1 : move.y < 0 ? -1 : 0;

      const tryMove = (dc: number, dr: number) => {
        const nc = this.col + dc;
        const nr = this.row + dr;
        if (!BLOCKED_TILES.has(tileAt(nc, nr))) {
          this.col = nc;
          this.row = nr;
          this.moveCooldown = this.MOVE_DELAY;
          return true;
        }
        return false;
      };

      if (dx !== 0 && dy !== 0) {
        if (!tryMove(dx, 0)) tryMove(0, dy);
      } else {
        tryMove(dx, dy);
      }
    }

    const targetX = this.col * TILE + TILE / 2;
    const targetY = this.row * TILE + TILE / 2;
    const LERP = 1 - Math.pow(0.001, dt);
    this.x += (targetX - this.x) * LERP;
    this.y += (targetY - this.y) * LERP;
  }

  draw(batch: SpriteBatch, atlas: TextureAtlas): void {
    batch.drawQuad(this.x, this.y, TILE, TILE, 0, atlas.fullRegion, atlas, Color.white());
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

  const gfx = await GfxDevice.create(canvas);
  const batch = new SpriteBatch(gfx);
  const camera = new Camera2D(canvas.width, canvas.height);
  const loop = new GameLoop(60);

  const input = new InputManager(canvas);
  const gameplay = new ActionMap('Gameplay', {
    Move: {
      type: ActionType.Axis2D,
      composites: [
        { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD' },
        { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
      ],
      gamepadStick: 'Gamepad0_Stick0',
    },
  }, input);
  gameplay.enable();
  input.addMap(gameplay);

  // Touch D-pad for mobile
  const touchDPad = new TouchDPad('dpad');

  // Load tile sprites
  const uniqueFiles = [...new Set(Object.values(SPRITE_FILES).filter(Boolean))] as string[];
  const atlasMap = new Map<string, TextureAtlas>();
  await Promise.all(uniqueFiles.map(async (file) => {
    const atlas = await TextureAtlas.load(gfx, `${ASSETS}/${file}`);
    atlasMap.set(file, atlas);
  }));

  // Load hero sprite
  const heroAtlas = await TextureAtlas.load(gfx, `${CHAR_ASSETS}/green_character.png`);

  // 使用地图中的出生点
  const hero = new Hero(SPAWN_COL, SPAWN_ROW);

  // 创建自定义摄像机控制器
  const cameraCtrl = new DungeonCameraController(
    camera,
    TILE, TILE,
    (COLS - 2) * TILE,
    (ROWS - 2) * TILE,
  );
  cameraCtrl.deadZoneSize = 0.4;

  // Camera starts at hero position
  camera.position = new Vec2(hero.x, hero.y);

  const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  statusEl.textContent = `WebGPU ✓ — Dungeon (${COLS}x${ROWS}) — WASD/手柄/触屏` + (hasTouch ? ' (检测到触屏设备)' : '');

  loop.onUpdate = (dt) => {
    input.update();
    const move = input.action('Move').vec2();
    const touch = touchDPad.getVector();
    // Combine keyboard/gamepad with touch input
    const combinedMove = new Vec2(
      move.x !== 0 ? move.x : touch.x,
      move.y !== 0 ? move.y : touch.y
    );
    hero.update(dt, combinedMove);
    cameraCtrl.update(new Vec2(hero.x, hero.y), dt);
    camera.update(dt);
    input.endFrame();
  };

  loop.onRender = () => {
    batch.begin(camera);

    // Draw tilemap
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const tileId = MAP[row * COLS + col];
        const file = SPRITE_FILES[tileId];
        if (!file) continue;
        const atlas = atlasMap.get(file)!;
        const wx = col * TILE + TILE / 2;
        const wy = row * TILE + TILE / 2;
        batch.drawQuad(wx, wy, TILE, TILE, 0, atlas.fullRegion, atlas, Color.white());
      }
    }

    hero.draw(batch, heroAtlas);
    batch.end();
  };

  loop.start();
}

init().catch(err => {
  statusEl.textContent = `Error: ${err.message}`;
  console.error(err);
});
