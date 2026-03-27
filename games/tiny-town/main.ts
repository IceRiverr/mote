import { createGfxDevice, SpriteBatch, TextureAtlas, Camera2D, GameLoop, InputManager, ActionMap, ActionType, Vec2, Color } from '@mote/engine';
import type { AtlasRegion } from '@mote/engine';

// ── Tilemap atlas constants ───────────────────────────────────────────────────
const ATLAS_W     = 192;
const ATLAS_H     = 176;
const TILE_COLS   = 12;
const TILE_STRIDE = 17;
const TILE_PX     = 16;

function tileRegion(index: number): AtlasRegion {
  const col = index % TILE_COLS;
  const row = Math.floor(index / TILE_COLS);
  return {
    u0: (col * TILE_STRIDE) / ATLAS_W,
    v0: (row * TILE_STRIDE) / ATLAS_H,
    u1: (col * TILE_STRIDE + TILE_PX) / ATLAS_W,
    v1: (row * TILE_STRIDE + TILE_PX) / ATLAS_H,
    pixelWidth: TILE_PX, pixelHeight: TILE_PX,
  };
}

// ── Map data ──────────────────────────────────────────────────────────────────
const MAP_COLS = 20;
const MAP_ROWS = 15;
const TILE_SIZE = 32;

// prettier-ignore
const MAP: number[] = [
   0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
   0, 12, 13, 13, 14,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
   0, 24, 25, 25, 26,  0, 60, 61,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
   0, 24, 25, 25, 26,  0, 48, 49,  0,  0, 84, 84, 84, 84, 84,  0,  0,  0,  0,  0,
   0, 36, 37, 37, 38,  0,  0,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  0,
   0,  0,  0,  0,  0,  0,  0,  4,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  4,  0,
   0,  0, 72,  0,  0,  0,  0,  4,  0, 60, 61,  0,  0,  0,  0,  0,  0,  0,  4,  0,
   0,  0,  0,  0,  0,  0,  0,  4,  0, 48, 49,  0,  0, 96,  0,  0,  0,  0,  4,  0,
   0,  1,  1,  1,  1,  1,  1,  5,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  5,  0,
   0,  0,  0,  0,  0,  0,  0,  4,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  4,  0,
   0,  0,  0,  0,  0,  0,  0,  4,  0,  0, 97, 98,  0,  0,  0,  0,  0,  0,  4,  0,
   0,  0, 72,  0,  0,  0,  0,  4,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  4,  0,
   0,  0,  0,  0,  0,  0,  0,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  0,
   0,  0,  0,  2,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
   0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
];

const canvas   = document.getElementById('canvas') as HTMLCanvasElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const fallback = document.getElementById('fallback') as HTMLDivElement;

async function init(): Promise<void> {
  if (!navigator.gpu) {
    statusEl.textContent = 'WebGPU not supported';
    fallback.style.display = 'block';
    return;
  }

  const gfx    = await createGfxDevice(canvas);
  const batch  = new SpriteBatch(gfx);
  const camera = new Camera2D(canvas.width, canvas.height);
  const loop   = new GameLoop(60);

  const input    = new InputManager(canvas);
  const gameplay = new ActionMap('Gameplay', {
    Pan: {
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

  const tileAtlas = await TextureAtlas.load(gfx, '/games/tiny-town/assets/kenney_tiny-town/Tilemap/tilemap_packed.png');
  const regions   = Array.from({ length: TILE_COLS * 11 }, (_, i) => tileRegion(i));

  camera.position = new Vec2((MAP_COLS * TILE_SIZE) / 2, (MAP_ROWS * TILE_SIZE) / 2);

  const CAM_SPEED = 300;
  statusEl.textContent = 'WebGPU ✓ — Tiny Town — WASD / 方向键 / 左摇杆 平移';

  loop.onUpdate = (dt) => {
    input.update();
    const pan = input.action('Pan').vec2();
    camera.position.x += pan.x * CAM_SPEED * dt;
    camera.position.y += pan.y * CAM_SPEED * dt;
    camera.update(dt);
    input.endFrame();
  };

  loop.onRender = (_alpha) => {
    batch.begin(camera);
    for (let row = 0; row < MAP_ROWS; row++) {
      for (let col = 0; col < MAP_COLS; col++) {
        const wx = col * TILE_SIZE + TILE_SIZE / 2;
        const wy = row * TILE_SIZE + TILE_SIZE / 2;
        batch.drawQuad(wx, wy, TILE_SIZE, TILE_SIZE, 0, regions[MAP[row * MAP_COLS + col]], tileAtlas, Color.white());
      }
    }
    batch.end();
  };

  loop.start();
}

init().catch(err => {
  statusEl.textContent = `Error: ${err.message}`;
  console.error(err);
});
