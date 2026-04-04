import { createGfxDevice, SpriteBatch, TextureAtlas, Camera2D, GameLoop, InputManager, ActionMap, ActionType, Vec2, Color } from '@mote/engine';
import type { AtlasRegion } from '@mote/engine';

// ── Tileset Types ─────────────────────────────────────────────────────────────
interface TilesetRef {
  source: string;
  firstGid: number;
}

interface TilesetData {
  version: string;
  type: string;
  id: string;
  name: string;
  image: string;
  imageWidth: number;
  imageHeight: number;
  tileWidth: number;
  tileHeight: number;
  margin: number;
  spacing: number;
  columns: number;
  rows: number;
  tileCount: number;
}

// ── Map Types ─────────────────────────────────────────────────────────────────
interface MapLayer {
  id: string;
  name: string;
  type: string;
  visible: boolean;
  opacity: number;
  locked: boolean;
  data: number[];
}

interface MapData {
  version: string;
  type: string;
  id: string;
  name: string;
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  tilesets: TilesetRef[];
  layers: MapLayer[];
}

interface TileRegion {
  region: AtlasRegion;
  atlas: TextureAtlas;
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
  const mapData = await loadMap('./assets/level_01.mote.json');
  
  // ── Load tileset ─────────────────────────────────────────────────────────────
  const tilesetRef = mapData.tilesets[0];
  const tilesetData = await loadTileset(`./assets/${tilesetRef.source}`);
  
  // Calculate tileset image path (relative to tileset file)
  const tilesetDir = './assets/';
  const tilesetImagePath = tilesetDir + tilesetData.image;
  
  const tileAtlas = await TextureAtlas.load(gfx, batch.getAtlasBindGroupLayout(), tilesetImagePath);
  const regions = createRegionsFromTileset(tilesetData, tileAtlas);

  const TILE_WIDTH = mapData.tileWidth;
  const TILE_HEIGHT = mapData.tileHeight;
  const SCALE = 2; // Scale up for better visibility
  
  // Center camera on map
  camera.position = new Vec2(
    (mapData.width * TILE_WIDTH * SCALE) / 2,
    (mapData.height * TILE_HEIGHT * SCALE) / 2
  );

  const CAM_SPEED = 300;
  statusEl.textContent = 'WebGPU ✓ — Tiny Dungeon — WASD / 方向键 / 左摇杆 平移';

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
    
    // Render all layers
    for (const layer of mapData.layers) {
      if (!layer.visible) continue;
      
      for (let row = 0; row < mapData.height; row++) {
        for (let col = 0; col < mapData.width; col++) {
          const tileGid = layer.data[row * mapData.width + col];
          
          // 0 means empty tile
          if (tileGid === 0) continue;
          
          // Convert GID to local tile index (subtract firstGid)
          const tileIndex = tileGid - tilesetRef.firstGid;
          
          if (tileIndex >= 0 && tileIndex < regions.length) {
            const wx = col * TILE_WIDTH * SCALE + (TILE_WIDTH * SCALE) / 2;
            const wy = row * TILE_HEIGHT * SCALE + (TILE_HEIGHT * SCALE) / 2;
            batch.drawQuad(wx, wy, TILE_WIDTH * SCALE, TILE_HEIGHT * SCALE, 0, regions[tileIndex], tileAtlas, Color.white());
          }
        }
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

function createRegionsFromTileset(tileset: TilesetData, atlas: TextureAtlas): AtlasRegion[] {
  const imgWidth = atlas.texture.width;
  const imgHeight = atlas.texture.height;

  const regions: AtlasRegion[] = [];

  for (let i = 0; i < tileset.tileCount; i++) {
    const col = i % tileset.columns;
    const row = Math.floor(i / tileset.columns);

    const x = tileset.margin + col * (tileset.tileWidth + tileset.spacing);
    const y = tileset.margin + row * (tileset.tileHeight + tileset.spacing);

    const u0 = x / imgWidth;
    const u1 = (x + tileset.tileWidth) / imgWidth;
    const v0 = (y + tileset.tileHeight) / imgHeight;
    const v1 = y / imgHeight;

    regions.push({
      u0,
      v0,
      u1,
      v1,
      pixelWidth: tileset.tileWidth,
      pixelHeight: tileset.tileHeight,
    });
  }

  return regions;
}

init().catch(err => {
  statusEl.textContent = `Error: ${err.message}`;
  console.error(err);
});