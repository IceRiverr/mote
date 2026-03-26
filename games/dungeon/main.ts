import {
  GfxDevice, SpriteBatch, TextureAtlas, Camera2D,
  GameLoop, InputManager, ActionMap, ActionType, Vec2, Color,
} from '@mote/engine';
import { Rect } from '@mote/engine';

const TILE        = 64;
const ASSETS      = '/games/dungeon/assets/kenney_scribble-dungeons/PNG/Default (64px)';
const CHAR_ASSETS = `${ASSETS}/Characters`;

// ── Tile IDs ──────────────────────────────────────────────────────────────────
const enum T {
  VOID = 0,
  FLOOR,
  WALL,
  WALL_CORNER,
  WALL_EDGE,
  DOOR_CLOSED,
  DOOR_OPEN,
  CHEST,
  BARREL,
  STAIRS_DOWN,
  WATER,
  PLANKS,
  TRAP,
  CAMPFIRE,
}

// Tiles the hero cannot walk onto
const BLOCKED = new Set<T>([T.VOID, T.WALL, T.WALL_CORNER, T.WALL_EDGE, T.DOOR_CLOSED, T.WATER]);

// ── Map ───────────────────────────────────────────────────────────────────────
const COLS = 16;
const ROWS = 12;

// prettier-ignore
const MAP: T[] = [
  T.VOID,  T.VOID,  T.VOID,  T.VOID,  T.VOID,  T.VOID,  T.VOID,  T.VOID,  T.VOID,  T.VOID,  T.VOID,  T.VOID,  T.VOID,  T.VOID,  T.VOID,  T.VOID,
  T.VOID,  T.WALL,  T.WALL,  T.WALL,  T.WALL,  T.WALL,  T.WALL,  T.WALL,  T.WALL,  T.WALL,  T.WALL,  T.WALL,  T.WALL,  T.WALL,  T.WALL,  T.VOID,
  T.VOID,  T.WALL,  T.FLOOR, T.FLOOR, T.FLOOR, T.FLOOR, T.FLOOR, T.FLOOR, T.FLOOR, T.FLOOR, T.FLOOR, T.FLOOR, T.FLOOR, T.FLOOR, T.WALL,  T.VOID,
  T.VOID,  T.WALL,  T.FLOOR, T.BARREL,T.FLOOR, T.FLOOR, T.FLOOR, T.FLOOR, T.FLOOR, T.FLOOR, T.FLOOR, T.FLOOR, T.FLOOR, T.CHEST, T.WALL,  T.VOID,
  T.VOID,  T.WALL,  T.FLOOR, T.FLOOR, T.FLOOR, T.WATER, T.WATER, T.FLOOR, T.FLOOR, T.FLOOR, T.FLOOR, T.FLOOR, T.FLOOR, T.FLOOR, T.WALL,  T.VOID,
  T.VOID,  T.WALL,  T.FLOOR, T.FLOOR, T.WATER, T.WATER, T.WATER, T.FLOOR, T.FLOOR, T.PLANKS,T.PLANKS,T.FLOOR, T.FLOOR, T.FLOOR, T.WALL,  T.VOID,
  T.VOID,  T.WALL,  T.FLOOR, T.FLOOR, T.FLOOR, T.WATER, T.FLOOR, T.FLOOR, T.FLOOR, T.PLANKS,T.PLANKS,T.FLOOR, T.TRAP,  T.FLOOR, T.WALL,  T.VOID,
  T.VOID,  T.WALL,  T.FLOOR, T.FLOOR, T.FLOOR, T.FLOOR, T.FLOOR, T.FLOOR, T.FLOOR, T.FLOOR, T.FLOOR, T.FLOOR, T.FLOOR, T.FLOOR, T.WALL,  T.VOID,
  T.VOID,  T.WALL,  T.FLOOR, T.CAMPFIRE,T.FLOOR,T.FLOOR,T.FLOOR, T.FLOOR, T.FLOOR, T.FLOOR, T.FLOOR, T.FLOOR, T.FLOOR, T.FLOOR, T.WALL,  T.VOID,
  T.VOID,  T.WALL,  T.FLOOR, T.FLOOR, T.FLOOR, T.FLOOR, T.FLOOR, T.FLOOR, T.FLOOR, T.FLOOR, T.FLOOR, T.FLOOR, T.STAIRS_DOWN, T.FLOOR, T.WALL, T.VOID,
  T.VOID,  T.WALL,  T.WALL,  T.WALL,  T.WALL,  T.WALL,  T.WALL,  T.DOOR_CLOSED, T.WALL, T.WALL, T.WALL, T.WALL, T.WALL, T.WALL, T.WALL, T.VOID,
  T.VOID,  T.VOID,  T.VOID,  T.VOID,  T.VOID,  T.VOID,  T.VOID,  T.VOID,  T.VOID,  T.VOID,  T.VOID,  T.VOID,  T.VOID,  T.VOID,  T.VOID,  T.VOID,
];

function tileAt(col: number, row: number): T {
  if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return T.VOID;
  return MAP[row * COLS + col];
}

// ── Sprite map ────────────────────────────────────────────────────────────────
const SPRITE_FILES: Record<T, string | null> = {
  [T.VOID]:        null,
  [T.FLOOR]:       'tile.png',
  [T.WALL]:        'wall.png',
  [T.WALL_CORNER]: 'wall_corner.png',
  [T.WALL_EDGE]:   'wall_edge.png',
  [T.DOOR_CLOSED]: 'door_closed.png',
  [T.DOOR_OPEN]:   'door_open.png',
  [T.CHEST]:       'floor_chest.png',
  [T.BARREL]:      'floor_barrel.png',
  [T.STAIRS_DOWN]: 'stairs_down.png',
  [T.WATER]:       'water.png',
  [T.PLANKS]:      'planks.png',
  [T.TRAP]:        'floor_trap.png',
  [T.CAMPFIRE]:    'floor_campfire.png',
};

// ── Camera Controller (Game-specific logic) ───────────────────────────────────
/**
 * 边界限制摄像机控制器
 * - 玩家在屏幕中央区域移动时，摄像机保持静止（死区）
 * - 玩家靠近地图边缘时，摄像机被边界限制
 */
class DungeonCameraController {
  private readonly camera: Camera2D;

  // 地图边界
  private readonly bounds: Rect;

  // 死区大小（0-1，表示占视口的比例）
  deadZoneSize = 0.4;

  constructor(camera: Camera2D, mapX: number, mapY: number, mapW: number, mapH: number) {
    this.camera = camera;
    this.bounds = new Rect(mapX, mapY, mapW, mapH);
  }

  /**
   * 更新摄像机位置
   * @param target 目标位置（玩家位置）
   * @param dt 时间增量
   */
  update(target: Vec2, dt: number): void {
    const halfW = (this.camera.viewport.width  * 0.5) / this.camera.zoom;
    const halfH = (this.camera.viewport.height * 0.5) / this.camera.zoom;

    // 计算死区边界（以摄像机当前位置为中心）
    const deadHalfW = halfW * this.deadZoneSize;
    const deadHalfH = halfH * this.deadZoneSize;

    const deadLeft   = this.camera.position.x - deadHalfW;
    const deadRight  = this.camera.position.x + deadHalfW;
    const deadTop    = this.camera.position.y - deadHalfH;
    const deadBottom = this.camera.position.y + deadHalfH;

    // 计算目标位置需要移动多少才能让玩家回到死区内
    let deltaX = 0;
    let deltaY = 0;

    if (target.x < deadLeft)   deltaX = target.x - deadLeft;
    if (target.x > deadRight)  deltaX = target.x - deadRight;
    if (target.y < deadTop)    deltaY = target.y - deadTop;
    if (target.y > deadBottom) deltaY = target.y - deadBottom;

    // 只在需要时移动摄像机
    if (deltaX !== 0 || deltaY !== 0) {
      const LERP = 1 - Math.pow(0.001, dt);
      this.camera.position.x += deltaX * LERP;
      this.camera.position.y += deltaY * LERP;
    }

    // 应用边界限制
    this._clampToBounds();
  }

  private _clampToBounds(): void {
    const halfW = (this.camera.viewport.width  * 0.5) / this.camera.zoom;
    const halfH = (this.camera.viewport.height * 0.5) / this.camera.zoom;

    // 计算摄像机中心的最小/最大允许位置
    const minX = this.bounds.left + halfW;
    const maxX = this.bounds.right - halfW;
    const minY = this.bounds.top + halfH;
    const maxY = this.bounds.bottom - halfH;

    // 如果地图比视口小，居中显示
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

  // pixel position (smoothly interpolated toward tile center)
  x: number;
  y: number;

  // seconds to wait before accepting the next move input
  private moveCooldown = 0;
  private readonly MOVE_DELAY = 0.15; // s between steps when key held

  constructor(col: number, row: number) {
    this.col = col;
    this.row = row;
    this.x   = col * TILE + TILE / 2;
    this.y   = row * TILE + TILE / 2;
  }

  update(dt: number, move: { x: number; y: number }): void {
    this.moveCooldown = Math.max(0, this.moveCooldown - dt);

    if (this.moveCooldown === 0 && (move.x !== 0 || move.y !== 0)) {
      // Prefer cardinal: if both axes active, pick the dominant one
      const dx = move.x > 0 ? 1 : move.x < 0 ? -1 : 0;
      const dy = move.y > 0 ? 1 : move.y < 0 ? -1 : 0;

      // Try horizontal first, then vertical
      const tryMove = (dc: number, dr: number) => {
        const nc = this.col + dc;
        const nr = this.row + dr;
        if (!BLOCKED.has(tileAt(nc, nr))) {
          this.col = nc;
          this.row = nr;
          this.moveCooldown = this.MOVE_DELAY;
          return true;
        }
        return false;
      };

      if (dx !== 0 && dy !== 0) {
        // diagonal input: try each axis independently
        if (!tryMove(dx, 0)) tryMove(0, dy);
      } else {
        tryMove(dx, dy);
      }
    }

    // Smooth pixel position toward tile center
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
const canvas   = document.getElementById('canvas') as HTMLCanvasElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const fallback = document.getElementById('fallback') as HTMLDivElement;

async function init(): Promise<void> {
  if (!navigator.gpu) {
    statusEl.textContent = 'WebGPU not supported';
    fallback.style.display = 'block';
    return;
  }

  const gfx    = await GfxDevice.create(canvas);
  const batch  = new SpriteBatch(gfx);
  const camera = new Camera2D(canvas.width, canvas.height);
  const loop   = new GameLoop(60);

  const input    = new InputManager(canvas);
  const gameplay = new ActionMap('Gameplay', {
    Move: {
      type: ActionType.Axis2D,
      composites: [
        { up: 'KeyW',    down: 'KeyS',     left: 'KeyA',     right: 'KeyD'        },
        { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
      ],
      gamepadStick: 'Gamepad0_Stick0',
    },
  }, input);
  gameplay.enable();
  input.addMap(gameplay);

  // Load tile sprites
  const uniqueFiles = [...new Set(Object.values(SPRITE_FILES).filter(Boolean))] as string[];
  const atlasMap = new Map<string, TextureAtlas>();
  await Promise.all(uniqueFiles.map(async (file) => {
    const atlas = await TextureAtlas.load(gfx, `${ASSETS}/${file}`);
    atlasMap.set(file, atlas);
  }));

  // Load hero sprite
  const heroAtlas = await TextureAtlas.load(gfx, `${CHAR_ASSETS}/green_character.png`);

  // Spawn hero on a walkable tile near the center
  const hero = new Hero(7, 7);

  // 创建自定义摄像机控制器
  // 地图边界：从 (TILE, TILE) 开始，到 ((COLS-1)*TILE, (ROWS-1)*TILE) 结束
  const cameraCtrl = new DungeonCameraController(
    camera,
    TILE, TILE,                    // 地图起点（排除外圈 VOID）
    (COLS - 2) * TILE,             // 地图宽度
    (ROWS - 2) * TILE,             // 地图高度
  );
  cameraCtrl.deadZoneSize = 0.4;   // 40% 死区

  // Camera starts at hero position
  camera.position = new Vec2(hero.x, hero.y);

  statusEl.textContent = 'WebGPU ✓ — Dungeon — WASD / 方向键 移动';

  loop.onUpdate = (dt) => {
    input.update();
    const move = input.action('Move').vec2();
    hero.update(dt, move);

    // 使用自定义摄像机控制器更新
    cameraCtrl.update(new Vec2(hero.x, hero.y), dt);
    camera.update(dt);
    input.endFrame();
  };

  loop.onRender = (_alpha) => {
    batch.begin(camera);

    // Draw tilemap
    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const tileId = MAP[row * COLS + col];
        const file   = SPRITE_FILES[tileId];
        if (!file) continue;
        const atlas = atlasMap.get(file)!;
        const wx = col * TILE + TILE / 2;
        const wy = row * TILE + TILE / 2;
        batch.drawQuad(wx, wy, TILE, TILE, 0, atlas.fullRegion, atlas, Color.white());
      }
    }

    // Draw hero on top
    hero.draw(batch, heroAtlas);

    batch.end();
  };

  loop.start();
}

init().catch(err => {
  statusEl.textContent = `Error: ${err.message}`;
  console.error(err);
});
