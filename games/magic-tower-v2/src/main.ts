/**
 * main.ts — Magic Tower game entry point using mote engine APIs
 *
 * Orchestrates all engine systems: GameLoop, InputManager, SceneManager,
 * Entity, ScriptRuntime, and the custom Canvas2D renderer.
 */
import {
  GameLoop,
  InputManager,
  ActionMap,
  ActionType,
  SceneManager,
  Entity,
  ScriptRuntime,
} from '@mote/engine';
import type {
  SceneRuntime,
  TileLayerRuntime,
  EntityLayerRuntime,
  EntityInstanceRuntime,
} from '@mote/engine';
import { loadProject } from './canvas-loader';
import type { Canvas2DAssets } from './canvas-loader';
import { Canvas2DRenderer } from './canvas-renderer';
import { EngineContext } from './engine-context';
import { createInitialState, saveState, loadState } from './game-state';
import type { GameState } from './game-state';

// Monster book and floor teleport are utilities, not scripts
import { getMonsterBookEntries } from '../scripts/monster-book';
import { getVisitedFloors } from '../scripts/floor-teleport';

// ─── Constants ──────────────────────────────────────────────────────────────
const TILE_SIZE = 32;
const MAP_COLS = 13;
const MAP_ROWS = 13;

// ─── Globals ────────────────────────────────────────────────────────────────
let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;
let renderer: Canvas2DRenderer;
let gameLoop: GameLoop;
let input: InputManager;
let sceneManager: SceneManager;
let scriptRuntime: ScriptRuntime;
let engineCtx: EngineContext;
let state: GameState;
let assets: Canvas2DAssets;

// Player movement state (managed in main for rendering interpolation)
let playerEntity: Entity;
let isMoving = false;
let moveProgress = 0;
let moveStartX = 0;
let moveStartY = 0;
let moveTargetX = 0;
let moveTargetY = 0;
const MOVE_SPEED = 6.5; // tiles per second

// Dialog state
let dialogOpen = false;

// ─── Initialization ─────────────────────────────────────────────────────────

async function init(): Promise<void> {
  canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // 1. Load mote project
  const { runtime, assets: loadedAssets } = await loadProject(
    '/project.mote.json',
  );
  assets = loadedAssets;

  // 2. Create engine systems
  sceneManager = new SceneManager(runtime);
  scriptRuntime = new ScriptRuntime();
  state = createInitialState();
  engineCtx = new EngineContext(sceneManager, scriptRuntime, state);
  renderer = new Canvas2DRenderer(ctx, assets, runtime.spriteSheets);

  // 3. Set up input
  input = new InputManager(canvas);
  const gameMap = new ActionMap(
    'game',
    {
      MoveUp: {
        type: ActionType.Button,
        bindings: ['ArrowUp', 'KeyW'],
      },
      MoveDown: {
        type: ActionType.Button,
        bindings: ['ArrowDown', 'KeyS'],
      },
      MoveLeft: {
        type: ActionType.Button,
        bindings: ['ArrowLeft', 'KeyA'],
      },
      MoveRight: {
        type: ActionType.Button,
        bindings: ['ArrowRight', 'KeyD'],
      },
    },
    input,
  );
  gameMap.enable();
  input.addMap(gameMap);

  // 4. Set up engine context callbacks
  engineCtx.onShowDialog(showDialog);
  engineCtx.onUpdateHUD(updateHUD);
  engineCtx.onLoadScene(handleLoadScene);
  engineCtx.onStartMove((gx: number, gy: number) => {
    startSmoothMove(gx * TILE_SIZE, gy * TILE_SIZE);
  });

  // 5. Set up game loop
  gameLoop = new GameLoop();
  gameLoop.onUpdate = update;
  gameLoop.onRender = render;

  // 6. Set up HUD buttons
  document
    .getElementById('btn-book')!
    .addEventListener('click', showMonsterBook);

  document.getElementById('btn-save')!.addEventListener('click', () => {
    saveState(state);
    showDialog('存档', '游戏已保存！');
  });

  document.getElementById('btn-load')!.addEventListener('click', () => {
    const loaded = loadState();
    if (loaded) {
      state = loaded;
      engineCtx.state = state;
      handleLoadScene(state.currentScene);
      showDialog('读档', '游戏已加载！');
    } else {
      showDialog('读档', '没有找到存档。');
    }
  });

  document
    .getElementById('btn-teleport')!
    .addEventListener('click', showFloorTeleport);

  // 7. Load starting scene
  await handleLoadScene(runtime.startScene);

  // 8. Start game loop
  gameLoop.start();
}

// ─── Scene Loading ──────────────────────────────────────────────────────────

async function handleLoadScene(sceneId: string): Promise<void> {
  // Destroy old scripts
  scriptRuntime.destroyAll();

  // Load scene via engine SceneManager
  const scene: SceneRuntime = sceneManager.loadScene(sceneId);
  engineCtx.currentSceneId = sceneId;
  state.currentScene = sceneId;

  // Parse floor number from scene id (e.g. "floor-3" → 3)
  const match = sceneId.match(/(\d+)/);
  if (match) {
    state.floor = parseInt(match[1], 10);
    state.visitedFloors.add(state.floor);
  }

  // Create Entity instances from entity layers
  const entities: Entity[] = [];
  let newPlayerEntity: Entity | null = null;

  for (const layer of scene.layers) {
    if (layer.type === 'entity') {
      const entityLayer = layer as EntityLayerRuntime;
      for (const inst of entityLayer.entities) {
        // Skip entities that were removed in a previous visit
        if (engineCtx.isEntityRemoved(sceneId, inst.id)) continue;

        const def = sceneManager.getEntityDef(inst.template);
        if (!def) continue;

        const entity = new Entity(inst, def, sceneManager);

        if (inst.template === 'player') {
          // Position player from saved state (may differ from JSON after save/load)
          entity.x = state.playerX * TILE_SIZE;
          entity.y = state.playerY * TILE_SIZE;
          entity.setFrame(`player_${state.direction}`, 'characters');
          newPlayerEntity = entity;
        }

        entities.push(entity);

        // Bind script if the entity definition specifies one
        if (def.scriptPath) {
          const scriptUrl = '/' + def.scriptPath.replace(/\.ts$/, import.meta.env.PROD ? '.js' : '.ts');
          await scriptRuntime.bindScript(entity, scriptUrl, engineCtx);
        }
      }
    }
  }

  // If no player entity was found in the scene, create a virtual one
  if (!newPlayerEntity) {
    const playerDef = sceneManager.getEntityDef('player');
    if (playerDef) {
      const playerInst: EntityInstanceRuntime = {
        id: '__player__',
        template: 'player',
        name: 'Player',
        x: state.playerX * TILE_SIZE,
        y: state.playerY * TILE_SIZE,
        width: TILE_SIZE,
        height: TILE_SIZE,
        fields: { direction: state.direction },
      };
      newPlayerEntity = new Entity(playerInst, playerDef, sceneManager);
      newPlayerEntity.setFrame(`player_${state.direction}`, 'characters');
      entities.push(newPlayerEntity);
    }
  }

  playerEntity = newPlayerEntity!;
  engineCtx.entities = entities;
  engineCtx.player = playerEntity;

  // Reset movement state
  isMoving = false;
  moveProgress = 0;

  updateHUD();
}

// ─── Update ─────────────────────────────────────────────────────────────────

function update(dt: number): void {
  input.update();

  // Handle player movement input when idle and no dialog is open
  if (!isMoving && !dialogOpen) {
    if (input.action('MoveUp').pressed) handlePlayerInput(0, -1);
    else if (input.action('MoveDown').pressed) handlePlayerInput(0, 1);
    else if (input.action('MoveLeft').pressed) handlePlayerInput(-1, 0);
    else if (input.action('MoveRight').pressed) handlePlayerInput(1, 0);
  }

  // Advance smooth movement
  if (isMoving) {
    moveProgress += MOVE_SPEED * dt;
    if (moveProgress >= 1) {
      // Snap to target
      playerEntity.x = moveTargetX;
      playerEntity.y = moveTargetY;
      isMoving = false;
      moveProgress = 0;

      state.playerX = moveTargetX / TILE_SIZE;
      state.playerY = moveTargetY / TILE_SIZE;

      // Post-move: interact with non-blocking entities at new position
      checkPostMove();
    } else {
      // Interpolate position
      playerEntity.x =
        moveStartX + (moveTargetX - moveStartX) * moveProgress;
      playerEntity.y =
        moveStartY + (moveTargetY - moveStartY) * moveProgress;
    }
  }

  // Update all bound scripts (trigger-wall checks, animation, etc.)
  scriptRuntime.updateAll(dt);

  input.endFrame();
}

function handlePlayerInput(dx: number, dy: number): void {
  const targetGX = state.playerX + dx;
  const targetGY = state.playerY + dy;

  // Update facing direction
  if (dx === 1) state.direction = 'right';
  else if (dx === -1) state.direction = 'left';
  else if (dy === -1) state.direction = 'up';
  else if (dy === 1) state.direction = 'down';
  playerEntity.setFrame(`player_${state.direction}`, 'characters');

  // Bounds check
  if (
    targetGX < 0 ||
    targetGX >= MAP_COLS ||
    targetGY < 0 ||
    targetGY >= MAP_ROWS
  ) {
    return;
  }

  // Check tile-layer collision (walls)
  const scene = sceneManager.getCurrentScene();
  if (scene) {
    for (const layer of scene.layers) {
      if (layer.type === 'tile') {
        const tileLayer = layer as TileLayerRuntime;
        const frameId = tileLayer.data[targetGY * MAP_COLS + targetGX];
        if (frameId) {
          const sheet = sceneManager.getSpriteSheet(tileLayer.spriteSheet);
          if (sheet) {
            const frame = sheet.frames.get(frameId);
            if (frame?.collider && frame.collider.length > 0) {
              // Tile has a collider — it is a wall, block movement
              return;
            }
          }
        }
      }
    }
  }

  // Check blocking entities at target position
  const entitiesAtTarget = engineCtx.getEntitiesAt(targetGX, targetGY);
  for (const e of entitiesAtTarget) {
    if (e === playerEntity || !e.visible) continue;
    const collider = e.getCollider();
    if (collider && collider.length > 0) {
      // Blocking entity — interact (fight monster, open door, talk to NPC, etc.)
      scriptRuntime.notifyInteract(e.id, playerEntity);
      return;
    }
  }

  // All clear — start smooth movement toward target tile
  startSmoothMove(targetGX * TILE_SIZE, targetGY * TILE_SIZE);
}

function startSmoothMove(targetPX: number, targetPY: number): void {
  moveStartX = playerEntity.x;
  moveStartY = playerEntity.y;
  moveTargetX = targetPX;
  moveTargetY = targetPY;
  isMoving = true;
  moveProgress = 0;
}

function checkPostMove(): void {
  const entities = engineCtx.getEntitiesAt(state.playerX, state.playerY);
  for (const e of entities) {
    if (e === playerEntity || !e.visible) continue;
    const collider = e.getCollider();
    if (!collider || collider.length === 0) {
      // Non-blocking entity: interact (item pickup, lava, teleporter, event trigger)
      scriptRuntime.notifyInteract(e.id, playerEntity);
    }
  }
  updateHUD();
}

// ─── Render ─────────────────────────────────────────────────────────────────

function render(_alpha: number): void {
  renderer.clear();

  const scene = sceneManager.getCurrentScene();
  if (!scene) return;

  const tw = scene.data.tileWidth;
  const th = scene.data.tileHeight;
  const mapCols = scene.data.width / tw;
  const mapRows = scene.data.height / th;

  // Render tile layers first (floor, walls)
  for (const layer of scene.layers) {
    if (layer.type === 'tile') {
      renderer.renderTileLayer(
        layer as TileLayerRuntime,
        mapCols,
        mapRows,
        TILE_SIZE,
        TILE_SIZE,
      );
    }
  }

  // Render entities (except the player, who draws on top)
  for (const entity of engineCtx.entities) {
    if (entity === playerEntity) continue;
    renderer.renderEntity(entity);
  }

  // Render player last so it draws on top of everything
  if (playerEntity && playerEntity.visible) {
    renderer.drawFrame(
      'characters',
      `player_${state.direction}`,
      playerEntity.x,
      playerEntity.y,
      TILE_SIZE,
      TILE_SIZE,
    );
  }
}

// ─── HUD ────────────────────────────────────────────────────────────────────

function updateHUD(): void {
  const el = (id: string) => document.getElementById(id);
  el('hp')!.textContent = state.hp.toString();
  el('atk')!.textContent = state.atk.toString();
  el('def')!.textContent = state.def.toString();
  el('gold')!.textContent = state.gold.toString();
  el('keys-y')!.textContent = state.yellowKeys.toString();
  el('keys-b')!.textContent = state.blueKeys.toString();
  el('keys-r')!.textContent = state.redKeys.toString();
  el('level')!.textContent = state.level.toString();

  const scene = sceneManager.getCurrentScene();
  el('floor-label')!.textContent =
    `${state.floor}F ${scene?.data.name || ''}`;
}

// ─── Dialog System ──────────────────────────────────────────────────────────

function showDialog(
  title: string,
  content: string,
  buttons?: { label: string; action: () => void }[],
): void {
  dialogOpen = true;
  const overlay = document.getElementById('dialog-overlay')!;
  const box = document.getElementById('dialog-box')!;

  let html = `<h3>${title}</h3><p>${content}</p>`;

  if (!buttons || buttons.length === 0) {
    buttons = [{ label: '确定', action: () => {} }];
  }

  html +=
    '<div style="margin-top:12px; display:flex; gap:8px; justify-content:center; flex-wrap:wrap;">';
  buttons.forEach((_btn, i) => {
    html += `<button class="dialog-btn" data-idx="${i}">${buttons![i].label}</button>`;
  });
  html += '</div>';

  box.innerHTML = html;
  overlay.style.display = 'flex';

  // Bind button clicks — capture the current buttons array
  const currentButtons = buttons;
  box.querySelectorAll('.dialog-btn').forEach((el) => {
    el.addEventListener('click', () => {
      const idx = parseInt((el as HTMLElement).dataset.idx || '0', 10);
      overlay.style.display = 'none';
      dialogOpen = false;
      currentButtons[idx].action();
    });
  });
}

function closeDialog(): void {
  document.getElementById('dialog-overlay')!.style.display = 'none';
  dialogOpen = false;
}

// ─── Monster Book UI ────────────────────────────────────────────────────────

function showMonsterBook(): void {
  if (!state.specialItems.has('monster_book')) {
    showDialog('提示', '你还没有获得怪物图鉴。');
    return;
  }

  const entries = getMonsterBookEntries(state, engineCtx.entities);
  if (entries.length === 0) {
    showDialog('怪物图鉴', '当前楼层没有怪物。');
    return;
  }

  let html =
    '<div style="text-align:left; font-size:12px; max-height:300px; overflow-y:auto;">';
  for (const entry of entries) {
    const dmgStr =
      entry.predictedDamage < 0
        ? '<span style="color:#f44">无法击败</span>'
        : entry.predictedDamage === 0
          ? '<span style="color:#4f4">无伤</span>'
          : `<span style="color:#ff4">-${entry.predictedDamage}HP</span>`;
    html += '<div style="margin:4px 0; padding:4px; border-bottom:1px solid #444;">';
    html += `<b>${entry.name}</b> HP:${entry.hp} ATK:${entry.atk} DEF:${entry.def} Gold:${entry.gold}`;
    html += ` → ${dmgStr}</div>`;
  }
  html += '</div>';

  showDialog('怪物图鉴', html);
}

// ─── Floor Teleport UI ──────────────────────────────────────────────────────

function showFloorTeleport(): void {
  if (!state.specialItems.has('teleporter_item')) {
    showDialog('提示', '你还没有获得传送器。');
    return;
  }

  const floors = getVisitedFloors(state);
  if (floors.length === 0) {
    showDialog('传送', '没有可传送的楼层。');
    return;
  }

  const buttons: { label: string; action: () => void }[] = floors.map(
    (floorNum) => ({
      label: `${floorNum}F`,
      action: async () => {
        closeDialog();

        // Default landing position (center-bottom of map)
        state.playerX = 6;
        state.playerY = 11;
        state.floor = floorNum;

        await handleLoadScene(`floor-${floorNum}`);

        // Try to land near the downward staircase
        for (const e of engineCtx.entities) {
          if (
            e.templateId === 'stair' &&
            e.getField<string>('direction') === 'down'
          ) {
            state.playerX = e.x / TILE_SIZE;
            state.playerY = e.y / TILE_SIZE;
            if (playerEntity) {
              playerEntity.x = e.x;
              playerEntity.y = e.y;
            }
            break;
          }
        }

        updateHUD();
      },
    }),
  );

  buttons.push({ label: '取消', action: () => {} });

  showDialog('楼层传送', '选择要传送到的楼层：', buttons);
}

// ─── Start ──────────────────────────────────────────────────────────────────

init().catch((err) => {
  console.error('Magic Tower initialization failed:', err);
});
