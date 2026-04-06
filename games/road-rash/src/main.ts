/**
 * Road Rash 2D — main entry point.
 *
 * Bootstraps the mote engine, wires up input, loads the track, creates all
 * race entities, binds their scripts, and runs the game loop.
 */

import {
  GameLoop,
  InputManager,
  ActionMap,
  ActionType,
  SceneManager,
  Entity,
  ScriptRuntime,
  CollisionSystem,
} from '@mote/engine';
import type {
  SceneRuntime,
  TileLayerRuntime,
  EntityLayerRuntime,
  EntityInstanceRuntime,
  ProjectRuntime,
  AABB,
} from '@mote/engine';

import { loadProject } from './canvas-loader';
import type { Canvas2DAssets } from './canvas-loader';
import { Canvas2DRenderer } from './canvas-renderer';
import { ScrollingCamera } from './scrolling-camera';
import { EntitySpawner } from './entity-spawner';
import { RoadRashContext } from './engine-context';
import { loadTrack, generateSceneFromTrack } from './track-data';
import type { TrackConfig } from './track-data';
import { createInitialState, createRaceState } from './game-state';
import type { GameState, RaceState } from './game-state';
import {
  SPEED_SCALE,
  TILE_SIZE,
  LANE_WIDTH,
  kmhToPxPerSec,
  laneToWorldX,
  worldYToRow,
  rowToWorldY,
} from '../scripts/physics';

// ---------------------------------------------------------------------------
// Display constants
// ---------------------------------------------------------------------------
const CANVAS_W = 416;
const CANVAS_H = 640;
const MAP_COLS = 21;

// ---------------------------------------------------------------------------
// Module-level state
// ---------------------------------------------------------------------------
let canvas: HTMLCanvasElement;
let ctx2d: CanvasRenderingContext2D;
let renderer: Canvas2DRenderer;
let gameLoop: GameLoop;
let input: InputManager;
let actionMap: ActionMap;
let sceneManager: SceneManager;
let scriptRuntime: ScriptRuntime;
let camera: ScrollingCamera;
let spawner: EntitySpawner;
let context: RoadRashContext;
let state: GameState;
let assets: Canvas2DAssets;
let trackConfig: TrackConfig;
let projectRuntime: ProjectRuntime;

// ============================================================================
// Initialisation
// ============================================================================

async function init(): Promise<void> {
  // -----------------------------------------------------------------------
  // 1. Canvas
  // -----------------------------------------------------------------------
  canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  ctx2d = canvas.getContext('2d')!;
  ctx2d.imageSmoothingEnabled = false;

  // -----------------------------------------------------------------------
  // 2. Load mote project (sprite sheets, entity defs, etc.)
  // -----------------------------------------------------------------------
  const loaded = await loadProject('/project.mote.json');
  projectRuntime = loaded.runtime;
  assets = loaded.assets;

  // -----------------------------------------------------------------------
  // 3. Load track data
  // -----------------------------------------------------------------------
  trackConfig = await loadTrack('/tracks/track-city.track.json');

  // -----------------------------------------------------------------------
  // 4. Generate the tile-map scene from track config and register it
  // -----------------------------------------------------------------------
  const sceneData = generateSceneFromTrack(trackConfig);
  projectRuntime.scenes.set(trackConfig.id, sceneData);

  // -----------------------------------------------------------------------
  // 5. Core engine systems
  // -----------------------------------------------------------------------
  sceneManager = new SceneManager(projectRuntime);
  scriptRuntime = new ScriptRuntime();
  camera = new ScrollingCamera(CANVAS_W, CANVAS_H);
  state = createInitialState();
  state.currentTrack = trackConfig.id;
  state.raceState = createRaceState(trackConfig.id);

  // Renderer — needs the sprite-sheet map from the project
  renderer = new Canvas2DRenderer(ctx2d, assets, projectRuntime.spriteSheets);

  // -----------------------------------------------------------------------
  // 6. Game context (shared "engine" object passed to every script)
  // -----------------------------------------------------------------------
  context = new RoadRashContext(
    sceneManager,
    scriptRuntime,
    camera,
    new EntitySpawner(sceneManager, scriptRuntime, null as unknown), // temp
    state,
  );
  context.trackConfig = trackConfig;

  // Recreate spawner with the real context reference
  spawner = new EntitySpawner(sceneManager, scriptRuntime, context);
  context.spawner = spawner;

  // -----------------------------------------------------------------------
  // 7. Input system
  // -----------------------------------------------------------------------
  input = new InputManager(canvas);
  actionMap = new ActionMap(
    'race',
    {
      Accelerate: { type: ActionType.Button, bindings: ['ArrowUp', 'KeyW'] },
      Brake:      { type: ActionType.Button, bindings: ['ArrowDown', 'KeyS'] },
      SteerLeft:  { type: ActionType.Button, bindings: ['ArrowLeft', 'KeyA'] },
      SteerRight: { type: ActionType.Button, bindings: ['ArrowRight', 'KeyD'] },
      AttackLeft: { type: ActionType.Button, bindings: ['KeyZ', 'KeyQ'] },
      AttackRight:{ type: ActionType.Button, bindings: ['KeyX', 'KeyE'] },
      Nitro:      { type: ActionType.Button, bindings: ['Space', 'ShiftLeft'] },
      Pause:      { type: ActionType.Button, bindings: ['Escape', 'KeyP'] },
    },
    input,
  );
  input.addMap(actionMap);
  actionMap.enable();

  // Expose input on the context so scripts can read actions
  (context as Record<string, unknown>).input = input;

  // -----------------------------------------------------------------------
  // 8. HUD / overlay callbacks
  // -----------------------------------------------------------------------
  // The RoadRashContext may expose callbacks OR the main loop calls these
  // directly. We wire both approaches for robustness.

  // -----------------------------------------------------------------------
  // 9. Load race entities
  // -----------------------------------------------------------------------
  await loadRace();

  // -----------------------------------------------------------------------
  // 10. Game loop
  // -----------------------------------------------------------------------
  gameLoop = new GameLoop();
  gameLoop.onUpdate = update;
  gameLoop.onRender = render;
  gameLoop.start();

  // -----------------------------------------------------------------------
  // 11. UI button wiring
  // -----------------------------------------------------------------------
  const restartBtn = document.getElementById('restart-btn');
  if (restartBtn) {
    restartBtn.addEventListener('click', async () => {
      const overlay = document.getElementById('result-overlay');
      if (overlay) overlay.style.display = 'none';
      await restartRace();
    });
  }

  // Attack button (weapon display) - triggers attack via context flag
  const attackBtn = document.getElementById('weapon-display');
  if (attackBtn) {
    attackBtn.addEventListener('click', () => {
      // Set attack request flag for player script to consume
      context.attackRequested = 'right';
    });
  }
}

// ============================================================================
// Race loading — creates all entities for a fresh race
// ============================================================================

async function loadRace(): Promise<void> {
  scriptRuntime.destroyAll();

  // Load the tile-map scene
  sceneManager.loadScene(trackConfig.id);

  const entities: Entity[] = [];

  // Determine whether we should append .js or .ts based on build mode
  const ext = isProduction() ? '.js' : '.ts';

  // -------------------------------------------------------------------
  // Player bike
  // -------------------------------------------------------------------
  const playerDef = sceneManager.getEntityDef('player-bike');
  const playerInst: EntityInstanceRuntime = {
    id: 'player',
    template: 'player-bike',
    name: 'Player',
    x: laneToWorldX(2, trackConfig.defaultRoadCenter),
    y: rowToWorldY(trackConfig.startLine),
    width: 32,
    height: 48,
    fields: {},
  };
  const playerEntity = new Entity(playerInst, playerDef!, sceneManager);
  playerEntity.setFrame('player_up', 'bikes');
  entities.push(playerEntity);
  await scriptRuntime.bindScript(playerEntity, `/scripts/player-bike${ext}`, context);

  // -------------------------------------------------------------------
  // Opponents
  // -------------------------------------------------------------------
  const opponentEntities: Entity[] = [];
  for (const opp of trackConfig.opponents) {
    const oppDef = sceneManager.getEntityDef('opponent-bike');
    const oppInst: EntityInstanceRuntime = {
      id: `opponent-${opp.riderName.toLowerCase().replace(/\s+/g, '-')}`,
      template: 'opponent-bike',
      name: opp.riderName,
      x: laneToWorldX(opp.startLane, trackConfig.defaultRoadCenter),
      y: rowToWorldY(opp.startRow),
      width: 32,
      height: 48,
      fields: {
        riderName: opp.riderName,
        color: opp.color,
        maxSpeed: opp.maxSpeed,
        acceleration: opp.acceleration,
        aggressiveness: opp.aggressiveness,
        skillLevel: opp.skillLevel,
        lane: opp.startLane,
        targetLane: opp.startLane,
      },
    };
    const oppEntity = new Entity(oppInst, oppDef!, sceneManager);
    oppEntity.setFrame(`opponent_${opp.color}_up`, 'bikes');
    entities.push(oppEntity);
    opponentEntities.push(oppEntity);
    await scriptRuntime.bindScript(oppEntity, `/scripts/opponent-ai${ext}`, context);
  }

  // -------------------------------------------------------------------
  // Race controller (invisible manager entity)
  // -------------------------------------------------------------------
  const rcDef = sceneManager.getEntityDef('race-controller');
  const rcInst: EntityInstanceRuntime = {
    id: 'race-controller',
    template: 'race-controller',
    name: 'Race Controller',
    x: 0,
    y: 0,
    width: 1,
    height: 1,
    fields: { trackLength: trackConfig.length },
  };
  const rcEntity = new Entity(rcInst, rcDef!, sceneManager);
  entities.push(rcEntity);
  await scriptRuntime.bindScript(rcEntity, `/scripts/race-manager${ext}`, context);

  // -------------------------------------------------------------------
  // Pickups (weapon / nitro / health)
  // -------------------------------------------------------------------
  for (const pickup of trackConfig.pickups) {
    let templateId: string;
    const fields: Record<string, unknown> = {};
    let frameId: string;

    switch (pickup.type) {
      case 'weapon':
        templateId = 'weapon-pickup';
        fields.weaponType = pickup.weaponType ?? 'chain';
        frameId = 'pickup_weapon';
        break;
      case 'nitro':
        templateId = 'nitro-pickup';
        fields.nitroAmount = pickup.amount ?? 50;
        frameId = 'pickup_nitro';
        break;
      default: // 'health'
        templateId = 'health-pickup';
        fields.healAmount = pickup.amount ?? 30;
        frameId = 'pickup_health';
        break;
    }

    const def = sceneManager.getEntityDef(templateId);
    if (!def) continue;

    const inst: EntityInstanceRuntime = {
      id: `pickup-${pickup.type}-${pickup.row}-${pickup.lane}`,
      template: templateId,
      name: pickup.type,
      x: laneToWorldX(pickup.lane, trackConfig.defaultRoadCenter),
      y: rowToWorldY(pickup.row),
      width: 24,
      height: 24,
      fields,
    };
    const e = new Entity(inst, def, sceneManager);
    e.setFrame(frameId, 'effects');
    entities.push(e);
    await scriptRuntime.bindScript(e, `/scripts/${templateId}${ext}`, context);
  }

  // -------------------------------------------------------------------
  // Road hazards
  // -------------------------------------------------------------------
  for (const hazard of trackConfig.hazards) {
    const def = sceneManager.getEntityDef('road-hazard');
    if (!def) continue;

    // Map hazard type to a sprite frame
    const hazardFrames: Record<string, string> = {
      oil_slick: 'oil_slick',
      pothole: 'pothole',
      cone: 'cone',
    };
    const frameId = hazardFrames[hazard.type] ?? 'oil_slick';

    const inst: EntityInstanceRuntime = {
      id: `hazard-${hazard.type}-${hazard.row}-${hazard.lane}`,
      template: 'road-hazard',
      name: hazard.type,
      x: laneToWorldX(hazard.lane, trackConfig.defaultRoadCenter),
      y: rowToWorldY(hazard.row),
      width: (hazard.width ?? 1) * TILE_SIZE,
      height: 24,
      fields: {
        hazardType: hazard.type,
        damage: 10,
        slowdown: 0.3,
      },
    };
    const e = new Entity(inst, def, sceneManager);
    e.setFrame(frameId, 'effects');
    entities.push(e);
    await scriptRuntime.bindScript(e, `/scripts/road-hazard${ext}`, context);
  }

  // -------------------------------------------------------------------
  // Assign everything to the shared context
  // -------------------------------------------------------------------
  context.entities = entities;
  context.player = playerEntity;
  context.opponents = opponentEntities;
  context.traffic = [];
  context.raceState = state.raceState!;

  // Centre camera on the player
  camera.follow(playerEntity.x, playerEntity.y);
}

// ============================================================================
// Update loop (fixed timestep from GameLoop)
// ============================================================================

function update(dt: number): void {
  input.update();

  if (!state.raceState) return;

  // Check pause toggle
  const pauseAction = input.action('Pause');
  if (pauseAction && pauseAction.pressed) {
    // Simple pause — just skip this frame's logic (could be expanded)
    // For now we let the game keep running
  }

  // Drive all bound scripts (player, opponents, race manager, pickups, …)
  scriptRuntime.updateAll(dt);

  // Camera follows player
  if (context.player) {
    camera.follow(context.player.x, context.player.y);
  }

  // Update the on-screen HUD
  updateHUD();

  input.endFrame();
}

// ============================================================================
// Render loop
// ============================================================================

function render(_alpha: number): void {
  renderer.clear();

  const scene = sceneManager.getCurrentScene();
  if (!scene) return;

  const tw = scene.data?.tileWidth ?? TILE_SIZE;
  const th = scene.data?.tileHeight ?? TILE_SIZE;
  const mapCols = scene.data ? scene.data.width / tw : MAP_COLS;
  const mapRows = scene.data ? scene.data.height / th : 1500;

  // -------------------------------------------------------------------
  // 1. Tile layers (road, scenery, decorations)
  // -------------------------------------------------------------------
  for (const layer of scene.layers) {
    if (layer.type === 'tile') {
      renderer.renderTileLayerWithCamera(
        layer as TileLayerRuntime,
        mapCols,
        mapRows,
        tw,
        th,
        camera.x,
        camera.y,
        CANVAS_W,
        CANVAS_H,
      );
    }
  }

  // -------------------------------------------------------------------
  // 2. Traffic vehicles
  // -------------------------------------------------------------------
  for (const t of context.traffic) {
    if (t.visible && camera.isVisible(t.x, t.y, t.width, t.height)) {
      renderer.renderEntityWithCamera(t, camera.x, camera.y);
    }
  }

  // -------------------------------------------------------------------
  // 3. Pickups and hazards
  // -------------------------------------------------------------------
  for (const e of context.entities) {
    if (e === context.player) continue;
    if (e.templateId === 'race-controller') continue;
    if (context.opponents.includes(e)) continue;
    if (e.visible && camera.isVisible(e.x, e.y, e.width, e.height)) {
      renderer.renderEntityWithCamera(e, camera.x, camera.y);
    }
  }

  // -------------------------------------------------------------------
  // 4. Opponents
  // -------------------------------------------------------------------
  for (const opp of context.opponents) {
    if (opp.visible && camera.isVisible(opp.x, opp.y, opp.width, opp.height)) {
      renderer.renderEntityWithCamera(opp, camera.x, camera.y);
    }
  }

  // -------------------------------------------------------------------
  // 5. Player (rendered last = on top)
  // -------------------------------------------------------------------
  if (context.player && context.player.visible) {
    renderer.renderEntityWithCamera(context.player, camera.x, camera.y);
  }

  // -------------------------------------------------------------------
  // 6. Minimap overlay (drawn via DOM, not canvas)
  // -------------------------------------------------------------------
  renderMinimap();
}

// ============================================================================
// Minimap
// ============================================================================

function renderMinimap(): void {
  const minimap = document.getElementById('minimap');
  if (!minimap) return;

  // Clear existing dots
  minimap.innerHTML = '';

  const trackLen = trackConfig.length;
  const mmH = minimap.clientHeight || 200;

  // Player dot
  if (context.player) {
    const row = worldYToRow(context.player.y);
    const pct = 1 - row / trackLen;
    const dot = document.createElement('div');
    dot.style.cssText = `position:absolute;left:3px;top:${clampPx(pct * mmH, mmH)}px;width:14px;height:5px;background:#0f0;border-radius:2px;`;
    minimap.appendChild(dot);
  }

  // Opponent dots
  for (const opp of context.opponents) {
    const row = worldYToRow(opp.y);
    const pct = 1 - row / trackLen;
    const color = oppDotColor(opp.getField<string>('color') ?? 'red');
    const dot = document.createElement('div');
    dot.style.cssText = `position:absolute;left:3px;top:${clampPx(pct * mmH, mmH)}px;width:14px;height:4px;background:${color};border-radius:1px;`;
    minimap.appendChild(dot);
  }
}

function clampPx(v: number, max: number): number {
  return Math.max(0, Math.min(max - 5, v));
}

function oppDotColor(color: string): string {
  switch (color) {
    case 'red': return '#f44';
    case 'blue': return '#44f';
    case 'green': return '#4f4';
    case 'yellow': return '#ff4';
    case 'police': return '#fff';
    default: return '#fa0';
  }
}

// ============================================================================
// HUD
// ============================================================================

function updateHUD(): void {
  if (!context.player || !state.raceState) return;

  // Speed
  const speed = Math.round(context.player.getField<number>('currentSpeed') ?? 0);
  const speedEl = document.getElementById('speed-display');
  if (speedEl) {
    speedEl.innerHTML = `${speed} <span id="speed-unit">km/h</span>`;
  }

  // Health bar
  const health = context.player.getField<number>('health') ?? 0;
  const maxHealth = context.player.getField<number>('durability') ?? 100;
  const healthPct = Math.max(0, (health / maxHealth) * 100);
  const healthBar = document.getElementById('health-bar') as HTMLElement | null;
  if (healthBar) healthBar.style.width = `${healthPct}%`;

  // Nitro bar
  const nitro = context.player.getField<number>('nitro') ?? 0;
  const nitroPct = Math.max(0, Math.min(100, nitro));
  const nitroBar = document.getElementById('nitro-bar') as HTMLElement | null;
  if (nitroBar) nitroBar.style.width = `${nitroPct}%`;

  // Position
  const pos = state.raceState.playerPosition;
  const suffixes = ['st', 'nd', 'rd', 'th', 'th', 'th'];
  const posEl = document.getElementById('position-display');
  if (posEl) {
    posEl.innerHTML = `${pos}<span id="position-suffix">${suffixes[pos - 1] ?? 'th'}</span>`;
  }

  // Weapon display
  const weapon = context.player.getField<string>('weapon') ?? 'fist';
  const weaponEmojis: Record<string, string> = {
    fist: '\u{1F44A}',
    chain: '\u26D3',
    bat: '\u{1F3CF}',
    pipe: '\u{1F527}',
  };
  const wName = weapon.charAt(0).toUpperCase() + weapon.slice(1);
  const weaponEl = document.getElementById('weapon-display');
  if (weaponEl) weaponEl.textContent = `${weaponEmojis[weapon] ?? '\u{1F44A}'} ${wName}`;

  // Distance to finish
  const playerRow = worldYToRow(context.player.y);
  const finishRow = trackConfig.finishLine;
  const remainingRows = Math.max(0, playerRow - finishRow);
  // Each row is TILE_SIZE (32) px. We scale to a virtual "km" for display.
  // Scale: 1500 rows * 32 px ~ 4.5 km  => 1 row = 4.5/1500 km = 0.003 km
  const rowsInTrack = trackConfig.startLine - trackConfig.finishLine;
  const totalKm = 4.5; // display distance for the full track
  const remainKm = (remainingRows / rowsInTrack) * totalKm;
  const distEl = document.getElementById('distance-display');
  if (distEl) distEl.textContent = `${Math.max(0, remainKm).toFixed(1)} km to finish`;
}

// ============================================================================
// Overlay helpers — called from race-manager via context delegation
// ============================================================================

// These functions are wired to the RoadRashContext. The context's methods
// delegate to them. If the context has its own implementation, that's fine
// too — we also call them from updateHUD / the main loop for safety.

/** Show the pre-race countdown number (or "GO!"). */
function showCountdown(n: number): void {
  const overlay = document.getElementById('countdown-overlay');
  const textEl = document.getElementById('countdown-text');
  if (!overlay || !textEl) return;

  if (n <= 0) {
    textEl.textContent = 'GO!';
    setTimeout(() => {
      overlay.style.display = 'none';
    }, 500);
  } else {
    overlay.style.display = 'flex';
    textEl.textContent = Math.ceil(n).toString();
  }
}

/** Display race-end results. */
function showRaceResult(title: string, details: string): void {
  const overlay = document.getElementById('result-overlay');
  const titleEl = document.getElementById('result-title');
  const detailsEl = document.getElementById('result-details');
  if (!overlay || !titleEl || !detailsEl) return;

  titleEl.textContent = title;
  detailsEl.innerHTML = details;
  overlay.style.display = 'flex';
}

/** Brief red flash on player damage. */
function flashDamage(): void {
  const flash = document.getElementById('damage-flash');
  if (!flash) return;
  flash.style.display = 'block';
  setTimeout(() => {
    flash.style.display = 'none';
  }, 150);
}

// ============================================================================
// Wire overlay callbacks to context
// ============================================================================

function wireContextCallbacks(): void {
  // The RoadRashContext exposes show* / damageFlash methods. If they are
  // configurable via callbacks, bind them. Otherwise the context's own
  // implementations should delegate to the DOM directly.
  //
  // Approach: monkey-patch the context so these methods always work
  // regardless of how the other agent implemented RoadRashContext.
  (context as Record<string, unknown>).showCountdown = showCountdown;
  (context as Record<string, unknown>).showResult = showRaceResult;
  (context as Record<string, unknown>).damageFlash = flashDamage;
  (context as Record<string, unknown>).updateHUD = updateHUD;
}

// ============================================================================
// Restart
// ============================================================================

async function restartRace(): Promise<void> {
  state.raceState = createRaceState(trackConfig.id);
  spawner.clear();
  context.traffic = [];
  await loadRace();
  wireContextCallbacks();
}

// ============================================================================
// Utilities
// ============================================================================

function isProduction(): boolean {
  try {
    return import.meta.env?.PROD === true;
  } catch {
    return false;
  }
}

// ============================================================================
// Bootstrap
// ============================================================================

init()
  .then(() => {
    wireContextCallbacks();
  })
  .catch((err) => {
    console.error('Road Rash init failed:', err);
  });
