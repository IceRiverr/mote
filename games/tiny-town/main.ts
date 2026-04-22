import { createGfxDevice, SpriteBatch, TextureAtlas, Camera2D, GameLoop, Vec2, Color } from '@mote/engine';
import type { AtlasRegion } from '@mote/engine';
import { InputManager, ActionMap, ActionType } from '@mote/engine/Input';

// ── Tileset Types ─────────────────────────────────────────────────────────────
interface TilesetTile {
  id: number;
  name: string;
  x?: number;
  y?: number;
  width: number;
  height: number;
  image?: string;
}

interface TilesetData {
  image?: string;
  tileSize: number;
  spacing?: number;
  tiles: TilesetTile[];
}

// ── Map Types ─────────────────────────────────────────────────────────────────
interface MapData {
  version: number;
  name: string;
  width: number;
  height: number;
  tileSize: number;
  tileset: string;
  tiles: number[];
  spawnPoint: { x: number; y: number };
}

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

  // ── Load map data ────────────────────────────────────────────────────────────
  const mapData = await loadMap('/games/tiny-town/maps/tiny-town01.json');
  
  // ── Load tileset ─────────────────────────────────────────────────────────────
  const tilesetData = await loadTileset(mapData.tileset);
  
  const isSpritesheet = !!tilesetData.image;
  let tileAtlas: TextureAtlas;
  let regions: AtlasRegion[];
  
  if (isSpritesheet) {
    tileAtlas = await TextureAtlas.load(gfx, batch.getAtlasBindGroupLayout(), tilesetData.image!);
    regions = createRegionsFromSpritesheet(tilesetData, tileAtlas);
  } else {
    const result = await createAtlasesFromIndividualImages(tilesetData, gfx, batch);
    tileAtlas = result.atlas;
    regions = result.regions;
  }

  const TILE_SIZE = 32;
  camera.position = new Vec2((mapData.width * TILE_SIZE) / 2, (mapData.height * TILE_SIZE) / 2);

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
    for (let row = 0; row < mapData.height; row++) {
      for (let col = 0; col < mapData.width; col++) {
        const wx = col * TILE_SIZE + TILE_SIZE / 2;
        const wy = row * TILE_SIZE + TILE_SIZE / 2;
        const tileIndex = mapData.tiles[row * mapData.width + col];
        batch.drawQuad(wx, wy, TILE_SIZE, TILE_SIZE, 0, regions[tileIndex], tileAtlas, Color.white());
      }
    }
    batch.end();
  };

  loop.start();
}

async function loadMap(path: string): Promise<MapData> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load map: ${response.status} ${response.statusText}`);
  }
  return await response.json();
}

async function loadTileset(path: string): Promise<TilesetData> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Failed to load tileset: ${response.status} ${response.statusText}`);
  }
  return await response.json();
}

function createRegionsFromSpritesheet(tileset: TilesetData, atlas: TextureAtlas): AtlasRegion[] {
  const imgWidth = atlas.texture.width;
  const imgHeight = atlas.texture.height;

  return tileset.tiles.map(tile => ({
    u0: (tile.x ?? 0) / imgWidth,
    v0: (tile.y ?? 0) / imgHeight,
    u1: ((tile.x ?? 0) + tile.width) / imgWidth,
    v1: ((tile.y ?? 0) + tile.height) / imgHeight,
    pixelWidth: tile.width,
    pixelHeight: tile.height,
  }));
}

async function createAtlasesFromIndividualImages(
  tileset: TilesetData, 
  gfx: any, 
  batch: SpriteBatch
): Promise<{ atlas: TextureAtlas; regions: AtlasRegion[] }> {
  const tilesWithImage = tileset.tiles.filter(t => t.image);
  
  const images = await Promise.all(
    tilesWithImage.map(async tile => {
      const img = new Image();
      img.src = tile.image!;
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error(`Failed to load: ${tile.image}`));
      });
      return { img };
    })
  );

  const maxWidth = Math.max(...images.map(({ img }) => img.width));
  const totalHeight = images.reduce((sum, { img }) => sum + img.height, 0);
  
  const canvas = document.createElement('canvas');
  canvas.width = maxWidth;
  canvas.height = totalHeight;
  const ctx = canvas.getContext('2d')!;
  
  let currentY = 0;
  const regions: AtlasRegion[] = [];
  
  for (const { img } of images) {
    ctx.drawImage(img, 0, currentY);
    
    regions.push({
      u0: 0 / maxWidth,
      v0: currentY / totalHeight,
      u1: img.width / maxWidth,
      v1: (currentY + img.height) / totalHeight,
      pixelWidth: img.width,
      pixelHeight: img.height,
    });
    
    currentY += img.height;
  }
  
  const blob = await new Promise<Blob>((resolve) => canvas.toBlob(blob => resolve(blob!), 'image/png'));
  const url = URL.createObjectURL(blob);
  
  try {
    const atlas = await TextureAtlas.load(gfx, batch.getAtlasBindGroupLayout(), url);
    return { atlas, regions };
  } finally {
    URL.revokeObjectURL(url);
  }
}

init().catch(err => {
  statusEl.textContent = `Error: ${err.message}`;
  console.error(err);
});
