// ═══════════════════════════════════════════════════════════════════════════════
// Tiny Dungeon — Main Entry Point
// ═══════════════════════════════════════════════════════════════════════════════

import {
  createGfxDevice, SpriteBatch, TextureAtlas, Camera2D,
  GameLoop, InputManager, ActionMap, ActionType, Vec2,
} from '@mote/engine';
import type { AtlasRegion } from '@mote/engine';
import type { World, TilemapData, TileLayerData } from './game-types';
import { ENTITY_DEFS, EDITOR_TO_GAME_DEF, createEntity, createWeapon } from './game-types';
import { gameUpdate, gameRender } from './game-logic';

// ── DOM ───────────────────────────────────────────────────────────────────────

const canvas   = document.getElementById('canvas') as HTMLCanvasElement;
const statusEl = document.getElementById('status') as HTMLDivElement;
const fallback = document.getElementById('fallback') as HTMLDivElement;

// ── Tileset JSON 类型 ─────────────────────────────────────────────────────────

/** 单个 tile 的元数据（来自编辑器 TileContextMenu 标记） */
interface TileData {
  collision?: boolean;
  tags?:      string[];
  properties?: Record<string, string | number | boolean>;
}

interface TilesetJson {
  image: string;
  imageWidth: number; imageHeight: number;
  tileWidth: number;  tileHeight: number;
  margin: number;     spacing: number;
  columns: number;    rows: number;
  tileCount: number;
  /** P3: 编辑器导出的 tile 元数据，key = tile index (0-based) */
  tileData?: Record<string, TileData>;
}

// ── Map JSON 类型 ─────────────────────────────────────────────────────────────

/** 编辑器导出的 EntityInstance（与 TileMap.ts 里的 EntityInstance 一致） */
interface MapEntityInstance {
  id:          string;
  defId:       string;       // 编辑器 EntityDef.id (如 "enemy_skeleton")
  name:        string;
  x:           number;       // 编辑器像素坐标 (Y-down)
  y:           number;
  width:       number;
  height:      number;
  fieldValues: Record<string, string | number | boolean>;
  visible:     boolean;
}

interface MapLayerJson {
  id: string; name: string; type: string;
  visible: boolean;
  data?: number[];                    // tile layer
  entities?: MapEntityInstance[];     // entity layer
}

interface MapJson {
  width: number; height: number;
  tileWidth: number; tileHeight: number;
  tilesets: { source: string; firstGid: number }[];
  layers: MapLayerJson[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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

/**
 * P3: 从 tileset JSON 的 tileData 构建 solid GID 集合
 *
 * tileData 的 key 是 tile index (0-based)，GID = tileIndex + firstGid
 * 只要 tileData[idx].collision === true，对应 GID 就是 solid
 */
function buildSolidTiles(tsJson: TilesetJson, firstGid: number): Set<number> {
  const solids = new Set<number>();
  if (!tsJson.tileData) return solids;

  for (const [idxStr, data] of Object.entries(tsJson.tileData)) {
    if (data.collision) {
      const gid = Number(idxStr) + firstGid;
      solids.add(gid);
    }
  }
  return solids;
}

/**
 * P4: 从 entitylayer 自动 spawn 实体
 *
 * 坐标转换：编辑器 Y-down → 游戏 Y-up
 *   gameX = editorX * scale
 *   gameY = (mapHeightPx - editorY) * scale
 *
 * defId 映射：编辑器 defId → 游戏 defId (通过 EDITOR_TO_GAME_DEF)
 *
 * 返回 { entities, playerId, weapon }
 */
function spawnFromEntityLayer(
  layers: MapLayerJson[],
  mapHeightPx: number,
  scale: number,
): { entities: import('./game-types').Entity[]; playerId: number; weapon: import('./game-types').Weapon } {
  const entities: import('./game-types').Entity[] = [];
  let playerId = -1;
  let weapon: import('./game-types').Weapon | null = null;

  for (const layer of layers) {
    if (layer.type !== 'entitylayer' || !layer.entities) continue;

    for (const inst of layer.entities) {
      if (!inst.visible) continue;

      // 映射 defId
      const gameDefId = EDITOR_TO_GAME_DEF[inst.defId] ?? inst.defId;
      const def = ENTITY_DEFS[gameDefId];
      if (!def) {
        console.warn(`[spawn] Unknown defId "${inst.defId}" → "${gameDefId}", skipping`);
        continue;
      }

      // 坐标转换：编辑器 Y-down → 游戏 Y-up
      const gameX = inst.x * scale;
      const gameY = (mapHeightPx - inst.y) * scale;

      const entity = createEntity(gameDefId, gameX, gameY);

      // 用编辑器 fieldValues 覆盖默认值
      if (inst.fieldValues.health !== undefined) {
        entity.health    = Number(inst.fieldValues.health);
        entity.maxHealth = Number(inst.fieldValues.health);
      }

      entities.push(entity);

      // 标记 player
      if (def.category === 'player') {
        playerId = entity.id;
        // 自动给 player 配武器
        weapon = createWeapon('axe', entity.id);
      }
    }
  }

  // 如果编辑器没放 player，fallback 不会有 weapon
  if (!weapon && playerId !== -1) {
    weapon = createWeapon('axe', playerId);
  }

  return {
    entities,
    playerId,
    weapon: weapon!,
  };
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
  const mapJson: MapJson = await fetch('./assets/level_02.mote.json').then(r => r.json());
  const tsJson: TilesetJson = await fetch(`./assets/${mapJson.tilesets[0].source}`).then(r => r.json());
  const tileAtlas = await TextureAtlas.load(gfx, batch.getAtlasBindGroupLayout(), `./assets/${tsJson.image}`);
  const regions = cutRegions(tsJson, tileAtlas.texture.width, tileAtlas.texture.height);

  // ── P3: Build Solid Tiles from tileData ──
  const firstGid = mapJson.tilesets[0].firstGid;
  const solidTiles = buildSolidTiles(tsJson, firstGid);
  console.log(`[P3] Built solidTiles from tileData: ${solidTiles.size} solid GIDs`, [...solidTiles]);

  // ── Build TilemapData ──
  const tilemapData: TilemapData = {
    width:      mapJson.width,
    height:     mapJson.height,
    tileWidth:  mapJson.tileWidth,
    tileHeight: mapJson.tileHeight,
    layers:     mapJson.layers
      .filter(l => l.type !== 'entitylayer')   // 只取 tile layers
      .map(l => ({
        name:    l.name,
        data:    l.data!,
        visible: l.visible,
      })),
  };

  // ── P4: Spawn Entities from Entity Layer ──
  const mapHeightPx = mapJson.height * mapJson.tileHeight;  // 编辑器像素高度
  const hasEntityLayer = mapJson.layers.some(l => l.type === 'entitylayer' && l.entities && l.entities.length > 0);

  let entities: import('./game-types').Entity[];
  let playerId: number;
  let weapon: import('./game-types').Weapon;

  if (hasEntityLayer) {
    // ── 从编辑器 entitylayer 自动 spawn ──
    console.log('[P4] Spawning entities from entitylayer...');
    const spawned = spawnFromEntityLayer(mapJson.layers, mapHeightPx, SCALE);
    entities = spawned.entities;
    playerId = spawned.playerId;
    weapon   = spawned.weapon;

    if (playerId === -1) {
      console.warn('[P4] No player entity in entitylayer, falling back to hardcoded spawn');
    } else {
      console.log(`[P4] Spawned ${entities.length} entities from entitylayer, playerId=${playerId}`);
    }
  }

  // ── Fallback: 没有 entitylayer 或没有 player → 硬编码 spawn ──
  if (!hasEntityLayer || playerId! === -1) {
    console.log('[spawn] Using hardcoded entity spawn (no entitylayer)');
    const mapH = tilemapData.height;
    const T = mapJson.tileWidth * SCALE;
    const tileY = (row: number) => (mapH - 1 - row) * T;

    const player = createEntity('player', 14 * T, tileY(18));
    weapon = createWeapon('axe', player.id);

    const enemyList = [
      createEntity('skeleton', 20 * T, tileY(8)),
      createEntity('skeleton', 14 * T, tileY(22)),
    ];

    const pickups = [
      createEntity('potion_red',  11 * T, tileY(19)),
      createEntity('potion_blue', 17 * T, tileY(17)),
    ];

    entities = [player, ...enemyList, ...pickups];
    playerId = player.id;
  }

  // ── Build World ──
  const world: World = {
    map:          tilemapData,
    entities:     entities!,
    playerId:     playerId!,
    weapon:       weapon!,
    nextEntityId: 100,
    scale:        SCALE,
    solidTiles,                   // P3: 从 tileData 构建
  };

  // ── Camera ──
  const playerEntity = world.entities.find(e => e.id === world.playerId);
  if (playerEntity) {
    camera.position = playerEntity.pos.clone();
  }

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
      const mapPxH = world.map.height * world.map.tileHeight * SCALE;
      const hw = camera.viewport.width / 2;
      const hh = camera.viewport.height / 2;
      camera.position.x = Math.max(hw, Math.min(mapW - hw, camera.position.x));
      camera.position.y = Math.max(hh, Math.min(mapPxH - hh, camera.position.y));
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
