// ═══════════════════════════════════════════════════════════════════════════════
// Tiny Dungeon — Main Entry Point
// ═══════════════════════════════════════════════════════════════════════════════

import {
  createGfxDevice, SpriteBatch, TextureAtlas, Camera2D,
  GameLoop, InputManager, ActionMap, ActionType, Vec2,
} from '@mote/engine';
import type { AtlasRegion } from '@mote/engine';
import type { World, TilemapData, TileLayerData } from './game-types';
import { createEntity, createWeapon } from './game-types';
import { gameUpdate, gameRender } from './game-logic';

// ── DOM ───────────────────────────────────────────────────────────────────────

const canvas   = document.getElementById('canvas') as HTMLCanvasElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const fallback = document.getElementById('fallback') as HTMLDivElement;

// ── Tileset Loader ────────────────────────────────────────────────────────────

interface TilesetJson {
  image: string;
  imageWidth: number; imageHeight: number;
  tileWidth: number;  tileHeight: number;
  margin: number;     spacing: number;
  columns: number;    rows: number;
  tileCount: number;
}

interface MapJson {
  width: number; height: number;
  tileWidth: number; tileHeight: number;
  tilesets: { source: string; firstGid: number }[];
  layers: {
    id: string; name: string; type: string;
    visible: boolean; data: number[];
  }[];
}

function cutRegions(ts: TilesetJson, texW: number, texH: number): AtlasRegion[] {
  const regions: AtlasRegion[] = [];
  for (let i = 0; i < ts.tileCount; i++) {
    const col = i % ts.columns;
    const row = Math.floor(i / ts.columns);
    const x = ts.margin + col * (ts.tileWidth + ts.spacing);
    const y = ts.margin + row * (ts.tileHeight + ts.spacing);
    regions.push({
      u0: x / texW,
      v0: y / texH,
      u1: (x + ts.tileWidth) / texW,
      v1: (y + ts.tileHeight) / texH,
      pixelWidth: ts.tileWidth,
      pixelHeight: ts.tileHeight,
    });
  }
  return regions;
}

// ── Init ──────────────────────────────────────────────────────────────────────

async function init(): Promise<void> {
  const gfx    = await createGfxDevice(canvas);
  const batch  = new SpriteBatch(gfx);
  const camera = new Camera2D(canvas.width, canvas.height);
  const loop   = new GameLoop(60);
  const SCALE  = 2;

  // ── Input ──
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
    Attack: {
      type: ActionType.Button,
      bindings: ['Space', 'KeyJ', 'Gamepad0_Button0'],
    },
  }, input);
  gameplay.enable();
  input.addMap(gameplay);

  // ── Load Assets ──
  const mapJson: MapJson = await fetch('./assets/level_01.mote.json').then(r => r.json());
  const tsJson: TilesetJson = await fetch(`./assets/${mapJson.tilesets[0].source}`).then(r => r.json());
  const tileAtlas = await TextureAtlas.load(gfx, batch.getAtlasBindGroupLayout(), `./assets/${tsJson.image}`);
  const regions = cutRegions(tsJson, tileAtlas.texture.width, tileAtlas.texture.height);

  // ── Build TilemapData ──
  const tilemapData: TilemapData = {
    width:      mapJson.width,
    height:     mapJson.height,
    tileWidth:  mapJson.tileWidth,
    tileHeight: mapJson.tileHeight,
    layers:     mapJson.layers.map(l => ({
      name:    l.name,
      data:    l.data,
      visible: l.visible,
    })),
  };

  // ── Spawn Entities ──
  // 将来这些从编辑器的 Entity Layer 导出读取
  // 现在硬编码位置（单位：像素，已乘 scale）

  const player = createEntity('player', 14 * 16 * SCALE, 18 * 16 * SCALE);
  const weapon = createWeapon('axe', player.id);

  const enemies = [
    createEntity('skeleton', 20 * 16 * SCALE, 8 * 16 * SCALE),
    createEntity('skeleton', 14 * 16 * SCALE, 22 * 16 * SCALE),
  ];

  const pickups = [
    createEntity('potion_red',  11 * 16 * SCALE, 19 * 16 * SCALE),
    createEntity('potion_blue', 17 * 16 * SCALE, 17 * 16 * SCALE),
  ];

  // ── Build World ──
  const world: World = {
    map:          tilemapData,
    entities:     [player, ...enemies, ...pickups],
    playerId:     player.id,
    weapon,
    nextEntityId: 100,
    scale:        SCALE,
  };

  // ── Camera ──
  camera.position = player.pos.clone();

  statusEl.textContent = 'WASD 移动 · Space 攻击 · 碰药水拾取';

  // ── Loop ──
  loop.onUpdate = (dt) => {
    input.update();
    gameUpdate(world, input, dt);

    // Camera follow player
    const p = world.entities.find(e => e.id === world.playerId);
    if (p?.active) {
      camera.follow(p.pos, 0.08);

      // Clamp camera to map bounds
      const mapW = world.map.width  * world.map.tileWidth  * SCALE;
      const mapH = world.map.height * world.map.tileHeight * SCALE;
      const hw = camera.viewport.width / 2;
      const hh = camera.viewport.height / 2;
      camera.position.x = Math.max(hw, Math.min(mapW - hw, camera.position.x));
      camera.position.y = Math.max(hh, Math.min(mapH - hh, camera.position.y));
    }

    camera.update(dt);
    input.endFrame();
  };

  loop.onRender = () => {
    gameRender(world, batch, camera, tileAtlas, regions);
  };

  loop.start();
}

init().catch(err => {
  statusEl.textContent = `Error: ${err.message}`;
  fallback.style.display = 'block';
  console.error(err);
});
