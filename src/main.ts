import { GfxDevice } from './core/GfxDevice.js';
import { SpriteBatch, TextureAtlas } from './renderer/2d/SpriteBatch.js';
import { Camera2D } from './renderer/2d/Camera2D.js';
import { GameLoop } from './framework/GameLoop.js';
import { InputManager, ActionMap, ActionType } from './input/index.js';
import type { AtlasRegion } from './core/types.js';
import { Vec2 } from './math/Vec2.js';
import { Color } from './math/Color.js';

// ── Tilemap atlas constants ───────────────────────────────────────────────────
// tilemap_packed.png: 192×176, 12 cols × 11 rows, tile 16×16, gap 1px → stride 17px
const ATLAS_W    = 192;
const ATLAS_H    = 176;
const TILE_COLS  = 12;
const TILE_STRIDE = 17; // 16px tile + 1px gap
const TILE_PX    = 16;

function tileRegion(index: number): AtlasRegion {
  const col = index % TILE_COLS;
  const row = Math.floor(index / TILE_COLS);
  const u0 = (col * TILE_STRIDE) / ATLAS_W;
  const v0 = (row * TILE_STRIDE) / ATLAS_H;
  const u1 = (col * TILE_STRIDE + TILE_PX) / ATLAS_W;
  const v1 = (row * TILE_STRIDE + TILE_PX) / ATLAS_H;
  return { u0, v0, u1, v1, pixelWidth: TILE_PX, pixelHeight: TILE_PX };
}

// ── Map data ──────────────────────────────────────────────────────────────────
// Tile indices (0-based, row-major). 20 cols × 15 rows.
// Row 0 of atlas: grass/ground tiles
// Tile reference (row × 12 + col):
//   0  = grass plain
//   1  = grass with flowers
//   2  = grass with rocks
//   3  = dirt path H
//   4  = dirt path V
//   5  = dirt cross
//   12 = water top-left
//   13 = water top
//   14 = water top-right
//   24 = water left
//   25 = water center
//   26 = water right
//   36 = water bot-left
//   37 = water bot
//   38 = water bot-right
//   48 = house base left
//   49 = house base right
//   60 = house roof left
//   61 = house roof right
//   72 = tree bottom
//   73 = tree top (above)
//   84 = fence H
//   85 = fence V
//   96 = well
//   97 = barrel
//   98 = crate

// prettier-ignore
const MAP_COLS = 20;
const MAP_ROWS = 15;
const TILE_SIZE = 32; // render size in world pixels (2× upscale from 16px)

// prettier-ignore
const MAP: number[] = [
  // row 0
   0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
  // row 1
   0, 12, 13, 13, 14,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
  // row 2
   0, 24, 25, 25, 26,  0, 60, 61,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
  // row 3
   0, 24, 25, 25, 26,  0, 48, 49,  0,  0, 84, 84, 84, 84, 84,  0,  0,  0,  0,  0,
  // row 4
   0, 36, 37, 37, 38,  0,  0,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  0,
  // row 5
   0,  0,  0,  0,  0,  0,  0,  4,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  4,  0,
  // row 6
   0,  0, 72,  0,  0,  0,  0,  4,  0, 60, 61,  0,  0,  0,  0,  0,  0,  0,  4,  0,
  // row 7
   0,  0,  0,  0,  0,  0,  0,  4,  0, 48, 49,  0,  0, 96,  0,  0,  0,  0,  4,  0,
  // row 8
   0,  1,  1,  1,  1,  1,  1,  5,  1,  1,  1,  1,  1,  1,  1,  1,  1,  1,  5,  0,
  // row 9
   0,  0,  0,  0,  0,  0,  0,  4,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  4,  0,
  // row 10
   0,  0,  0,  0,  0,  0,  0,  4,  0,  0, 97, 98,  0,  0,  0,  0,  0,  0,  4,  0,
  // row 11
   0,  0, 72,  0,  0,  0,  0,  4,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  4,  0,
  // row 12
   0,  0,  0,  0,  0,  0,  0,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  3,  0,
  // row 13
   0,  0,  0,  2,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
  // row 14
   0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,  0,
];

// ── DOM ───────────────────────────────────────────────────────────────────────
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

  // ── Input setup ────────────────────────────────────────────────────────────
  const input = new InputManager(canvas);
  const gameplay = new ActionMap('Gameplay', {
    Pan: {
      type: ActionType.Axis2D,
      composites: [
        { up: 'KeyW',    down: 'KeyS',     left: 'KeyA',     right: 'KeyD'       },
        { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' },
      ],
      gamepadStick: 'Gamepad0_Stick0',
    },
  }, input);
  gameplay.enable();
  input.addMap(gameplay);

  // Load kenney tilemap atlas
  const tileAtlas = await TextureAtlas.load(gfx, '/src/assets/kenney_tiny-town/Tilemap/tilemap_packed.png');

  // Pre-compute all tile regions
  const regions = Array.from({ length: TILE_COLS * 11 }, (_, i) => tileRegion(i));

  // Camera starts centered on the map
  camera.position = new Vec2(
    (MAP_COLS * TILE_SIZE) / 2,
    (MAP_ROWS * TILE_SIZE) / 2,
  );

  const CAM_SPEED = 300;
  statusEl.textContent = 'WebGPU ✓ — Kenney Tiny Town — WASD / Arrow keys to pan';

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
        const tileIndex = MAP[row * MAP_COLS + col];
        const wx = col * TILE_SIZE + TILE_SIZE / 2;
        const wy = row * TILE_SIZE + TILE_SIZE / 2;
        batch.drawQuad(wx, wy, TILE_SIZE, TILE_SIZE, 0, regions[tileIndex], tileAtlas, Color.white());
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
