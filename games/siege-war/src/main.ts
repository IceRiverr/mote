/**
 * main.ts — Siege War main entry point.
 *
 * Bootstraps the mote engine, loads project assets, creates all game
 * sub-systems, wires input, loads levels, and runs the game loop.
 *
 * Follows the same init/loop/render pattern as road-rash main.ts but
 * adapted for command-based siege warfare with multi-layer rendering,
 * free camera, and HTML overlay UI.
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
import { SiegeRenderer } from './canvas-renderer';
import type { RenderState, ViewMode, ProjectileState, EffectState, WallSegmentRender } from './canvas-renderer';
import { UIManager } from './ui-manager';
import type { UnitRosterEntry, WallSegmentStatus } from './ui-manager';
import { SiegeWarContext } from './engine-context';
import type {
  UnitState,
  WallSegmentState,
  LevelConfig,
  CommandSystemLike,
  AISystemLike,
  ProjectileSystemLike,
  TunnelSystemLike,
  ListeningPotSystemLike,
  PhaseManagerLike,
  MoraleSystemLike,
  ResourceManagerLike,
  EffectSystemLike,
  PathfindingLike,
  EntitySpawnerLike,
  ResourceState,
} from './engine-context';
import type { BattlefieldCamera } from './battlefield-camera';
import { CommandType } from './command-system';
import type { Command } from './command-system';
import { BattlePhase } from './phase-manager';
import type { PotSignal, SuspiciousArea } from './listening-pot-system';

// We import level data with resolveJsonModule
import levelsData from '../data/levels.json';

// ── Display constants ───────────────────────────────────────────────────────

const CANVAS_W = 1280;
const CANVAS_H = 720;
const TILE_SIZE = 32;
const CAMERA_PAN_SPEED = 400;     // px/s
const CAMERA_ZOOM_SPEED = 0.1;
const GAME_SPEEDS = [0.5, 1.0, 1.5, 2.0, 3.0];

// ── Battle state ────────────────────────────────────────────────────────────

interface BattleState {
  started: boolean;
  finished: boolean;
  won: boolean;
  paused: boolean;
  gameSpeed: number;
  gameTime: number;
  round: number;
  maxRounds: number;
  phase: BattlePhase;
  defenderMorale: number;
  attackerMorale: number;
  side: 'attacker' | 'defender';
  commanderPos: { x: number; y: number };
}

// ── Module-level state ──────────────────────────────────────────────────────

let canvas: HTMLCanvasElement;
let ctx2d: CanvasRenderingContext2D;
let renderer: SiegeRenderer;
let gameLoop: GameLoop;
let input: InputManager;
let actionMap: ActionMap;
let sceneManager: SceneManager;
let scriptRuntime: ScriptRuntime;
let camera: BattlefieldCamera;
let context: SiegeWarContext;
let ui: UIManager;
let assets: Canvas2DAssets;
let projectRuntime: ProjectRuntime;

let battleState: BattleState;
let currentLevelId: string = 'level-01';
let eventLog: Array<{ message: string; type: 'info' | 'warning' | 'success'; timestamp: number }> = [];

// Camera dragging state
let isDragging = false;
let dragLastX = 0;
let dragLastY = 0;

// ── Stub system factories ───────────────────────────────────────────────────
// These create lightweight implementations of each system interface.
// In a full build, each would be imported from its own module.

function createCommandSystem(): CommandSystemLike {
  const queue: Array<{
    id: string; command: Command; deliveryTime: number;
    progress: number; totalDelay: number;
  }> = [];
  let gameTime = 0;

  return {
    issueCommand(cmd: Command, _gameState: unknown): void {
      if (cmd.type === CommandType.SoundGong || cmd.type === CommandType.BeatDrum) {
        // Immediate: emit event
        context?.events.emit('command:executed', cmd);
        return;
      }
      const delay = 2 + Math.random() * 3; // 2-5s
      queue.push({
        id: cmd.id,
        command: cmd,
        deliveryTime: gameTime + delay,
        progress: 0,
        totalDelay: delay,
      });
    },
    processQueue(dt: number): void {
      gameTime += dt;
      for (let i = queue.length - 1; i >= 0; i--) {
        const item = queue[i];
        item.progress = Math.min(1, (gameTime - (item.deliveryTime - item.totalDelay)) / item.totalDelay);
        if (gameTime >= item.deliveryTime) {
          context?.events.emit('command:executed', item.command);
          queue.splice(i, 1);
        }
      }
    },
    getMessengerQueue() {
      return queue.map((q) => ({
        id: q.id,
        progress: q.progress,
        totalDelay: q.totalDelay,
        command: q.command,
      }));
    },
  };
}

function createAISystem(): AISystemLike {
  let waveTimer = 0;
  let currentWaveIdx = 0;

  return {
    update(dt: number, _battleState: unknown): void {
      if (!context?.levelConfig) return;
      const waves = context.levelConfig.enemyWaves;
      if (currentWaveIdx >= waves.length) return;

      waveTimer += dt;
      const wave = waves[currentWaveIdx];
      const waveStartTime = (wave.round - 1) * 60; // ~60s per round

      if (waveTimer >= waveStartTime) {
        context.events.emit('wave:start', { waveIndex: currentWaveIdx, wave });
        addEventLog(`Wave ${currentWaveIdx + 1}: ${wave.type} x${wave.count}`, 'warning');
        currentWaveIdx++;
      }
    },
  };
}

function createProjectileSystem(): ProjectileSystemLike {
  const active: ProjectileState[] = [];

  return {
    update(dt: number): void {
      const gravity = 400;
      for (let i = active.length - 1; i >= 0; i--) {
        const p = active[i];
        const vx = (p as unknown as Record<string, number>)._vx ?? 0;
        let vy = (p as unknown as Record<string, number>)._vy ?? 0;
        vy += gravity * dt;
        (p as unknown as Record<string, number>)._vy = vy;

        p.x += vx * dt;
        p.y += vy * dt;
        p.rotation = Math.atan2(vy, vx);

        // Trail for fire arrows
        if (p.type === 'fire_arrow') {
          if (!p.trail) p.trail = [];
          p.trail.push({ x: p.x, y: p.y, alpha: 1 });
          if (p.trail.length > 10) p.trail.shift();
          for (const pt of p.trail) pt.alpha *= 0.9;
        }

        // Ground impact check
        const groundY = context?.getGroundY(p.x) ?? 600;
        if (p.y >= groundY) {
          context?.events.emit('projectile:impact', { x: p.x, y: p.y, type: p.type });
          active.splice(i, 1);
        }
      }
    },
    getActive(): ProjectileState[] {
      return active;
    },
  };
}

function createTunnelSystem(): TunnelSystemLike {
  const routes: import('./tunnel-system').TunnelRoute[] = [];
  const digging: Array<{ x: number; y: number; soilType: string }> = [];

  return {
    update(dt: number): void {
      for (const route of routes) {
        if (route.progress >= 1) continue;
        const speed = 0.02 * route.engineerCount * dt;
        route.progress = Math.min(1, route.progress + speed);

        // Update digging position
        const tiles = route.path;
        const currentIdx = Math.floor(route.progress * (tiles.length - 1));
        if (currentIdx < tiles.length) {
          const tile = tiles[currentIdx];
          if (!tile.dug) {
            tile.dug = true;
            const existing = digging.find(
              (d) => d.x === tile.col * TILE_SIZE && d.y === tile.row * TILE_SIZE,
            );
            if (!existing) {
              digging.push({
                x: tile.col * TILE_SIZE + TILE_SIZE / 2,
                y: tile.row * TILE_SIZE + TILE_SIZE / 2,
                soilType: 'normal',
              });
            }
          }
        }

        // Collapse risk without support
        if (!route.hasVent && route.progress > 0.5 && Math.random() < 0.001 * dt) {
          context?.events.emit('tunnel:collapse', { routeId: route.id });
          route.progress = Math.max(0, route.progress - 0.2);
        }
      }
    },
    getActiveDigging() {
      return digging;
    },
    getRoutes() {
      return routes;
    },
  };
}

function createListeningPotSystem(): ListeningPotSystemLike {
  const signals: PotSignal[] = [];
  const suspicious: SuspiciousArea[] = [];

  return {
    update(): void {
      // Signals are updated by listening-pot entity scripts
      // This system aggregates and triangulates
      if (signals.length >= 2) {
        // Simple triangulation: if two pots have signals, mark intersection
        // Full implementation in listening-pot-system.ts
      }
    },
    getSignals() {
      return signals;
    },
    getSuspiciousAreas() {
      return suspicious;
    },
  };
}

function createPhaseManager(): PhaseManagerLike {
  let currentPhase = BattlePhase.Probing;
  let phaseTimer = 0;

  return {
    update(dt: number, _battleState: unknown): void {
      phaseTimer += dt;

      // Phase transitions based on time and battle conditions
      if (currentPhase === BattlePhase.Probing && phaseTimer > 30) {
        currentPhase = BattlePhase.Advance;
        phaseTimer = 0;
        context?.events.emit('phase:changed', { phase: currentPhase });
        addEventLog('Phase: Advance', 'info');
      } else if (currentPhase === BattlePhase.Advance && phaseTimer > 60) {
        currentPhase = BattlePhase.Assault;
        phaseTimer = 0;
        context?.events.emit('phase:changed', { phase: currentPhase });
        addEventLog('Phase: Assault!', 'warning');
      }

      // Check for street fight (wall breached)
      if (currentPhase === BattlePhase.Assault && context) {
        const breached = context.wallSegments.some((s) => s.breached);
        if (breached) {
          currentPhase = BattlePhase.StreetFight;
          context.events.emit('phase:changed', { phase: currentPhase });
          addEventLog('BREACH! Street fighting!', 'warning');
        }
      }
    },
    getCurrentPhase() {
      return currentPhase;
    },
  };
}

function createMoraleSystem(): MoraleSystemLike {
  let defenderMorale = 100;
  let attackerMorale = 100;

  return {
    update(dt: number): void {
      if (!context) return;

      // Morale decay during assault
      const phase = context.phaseManager.getCurrentPhase();
      if (phase === BattlePhase.Assault || phase === BattlePhase.StreetFight) {
        attackerMorale -= 0.5 * dt; // slow drain
      }

      // Wall breaches hurt defender morale
      const breachedCount = context.wallSegments.filter((s) => s.breached).length;
      if (breachedCount > 0) {
        defenderMorale = Math.max(0, defenderMorale - breachedCount * 0.2 * dt);
      }

      // Clamp
      defenderMorale = Math.max(0, Math.min(100, defenderMorale));
      attackerMorale = Math.max(0, Math.min(100, attackerMorale));

      battleState.defenderMorale = defenderMorale;
      battleState.attackerMorale = attackerMorale;
    },
    getDefenderMorale() { return defenderMorale; },
    getAttackerMorale() { return attackerMorale; },
  };
}

function createResourceManager(): ResourceManagerLike {
  const resources: ResourceState = { gold: 5000, wood: 3000, stone: 2000, oil: 500 };

  return {
    getResources() { return { ...resources }; },
    spend(type: keyof ResourceState, amount: number): boolean {
      if (resources[type] < amount) return false;
      resources[type] -= amount;
      return true;
    },
    add(type: keyof ResourceState, amount: number): void {
      resources[type] += amount;
    },
  };
}

function createEffectSystem(): EffectSystemLike {
  const active: EffectState[] = [];
  let nextId = 0;

  return {
    update(dt: number): void {
      for (let i = active.length - 1; i >= 0; i--) {
        const eff = active[i];
        eff.elapsed += dt;
        if (eff.elapsed >= eff.duration) {
          active.splice(i, 1);
        }
      }
    },
    spawnEffect(type: string, x: number, y: number, params?: Record<string, unknown>): void {
      active.push({
        id: `eff-${nextId++}`,
        x, y,
        width: (params?.width as number) ?? 32,
        height: (params?.height as number) ?? 32,
        sheetId: 'effects',
        frameId: type,
        alpha: (params?.alpha as number) ?? 1.0,
        scale: (params?.scale as number) ?? 1.0,
        elapsed: 0,
        duration: (params?.duration as number) ?? 1.0,
      });
    },
    spawnFire(x: number, y: number): void {
      active.push({
        id: `fire-${nextId++}`,
        x, y,
        width: 32, height: 48,
        sheetId: 'effects',
        frameId: 'fire_0',
        alpha: 0.9,
        scale: 1.0,
        elapsed: 0,
        duration: 3.0,
      });
    },
    getActive() { return active; },
  };
}

function createPathfinding(): PathfindingLike {
  return {
    findPath(startX: number, startY: number, endX: number, endY: number) {
      // Simplified A* — returns a straight-line path for now
      const steps: Array<{ x: number; y: number }> = [];
      const dx = endX - startX;
      const dy = endY - startY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const numSteps = Math.max(1, Math.floor(dist / TILE_SIZE));

      for (let i = 0; i <= numSteps; i++) {
        const t = i / numSteps;
        steps.push({
          x: startX + dx * t,
          y: startY + dy * t,
        });
      }
      return steps;
    },
  };
}

function createEntitySpawner(): EntitySpawnerLike {
  const pools = new Map<string, Entity[]>();
  const active = new Map<string, Entity>();
  let nextId = 0;

  return {
    spawn(templateId: string, x: number, y: number, fields?: Record<string, unknown>): Entity {
      const pool = pools.get(templateId) ?? [];
      let entity: Entity;

      if (pool.length > 0) {
        entity = pool.pop()!;
        entity.x = x;
        entity.y = y;
        entity.visible = true;
      } else {
        // Create from template via scene manager
        const def = sceneManager.getEntityDef(templateId);
        const inst: EntityInstanceRuntime = {
          id: `${templateId}-${nextId++}`,
          template: templateId,
          name: templateId,
          x, y,
          width: def?.width ?? 24,
          height: def?.height ?? 32,
          fields: {},
        };
        entity = new Entity(inst, def!, sceneManager);
      }

      if (fields) {
        for (const [k, v] of Object.entries(fields)) {
          entity.setField(k, v);
        }
      }

      active.set(entity.id, entity);
      return entity;
    },
    recycle(entity: Entity): void {
      entity.visible = false;
      active.delete(entity.id);
      const templateId = entity.templateId;
      const pool = pools.get(templateId) ?? [];
      pool.push(entity);
      pools.set(templateId, pool);
    },
    getActive(): Entity[] {
      return Array.from(active.values());
    },
    getByTemplate(templateId: string): Entity[] {
      return Array.from(active.values()).filter((e) => e.templateId === templateId);
    },
    clear(): void {
      active.clear();
      pools.clear();
    },
  };
}

// ── BattlefieldCamera factory ───────────────────────────────────────────────

function createBattlefieldCamera(): BattlefieldCamera {
  // Returns a camera object matching the BattlefieldCamera interface
  // In a full build this would come from ./battlefield-camera.ts
  const cam = {
    x: 0,
    y: 0,
    zoom: 1.0,
    minZoom: 0.5,
    maxZoom: 2.0,
    viewportWidth: CANVAS_W,
    viewportHeight: CANVAS_H,
    bounds: { left: 0, right: 3840, top: 0, bottom: 800 },
    shakeIntensity: 0,
    shakeTimer: 0,
    shakeOffsetX: 0,
    shakeOffsetY: 0,

    panTo(worldX: number, worldY: number, _lerpFactor = 0.1): void {
      cam.x = worldX - (cam.viewportWidth / cam.zoom) / 2;
      cam.y = worldY - (cam.viewportHeight / cam.zoom) / 2;
      cam.clampToBounds();
    },

    zoomBy(delta: number): void {
      cam.zoom = Math.max(cam.minZoom, Math.min(cam.maxZoom, cam.zoom + delta));
      cam.clampToBounds();
    },

    handleDrag(dx: number, dy: number): void {
      const scale = 1 / cam.zoom;
      cam.x -= dx * scale;
      cam.y -= dy * scale;
      cam.clampToBounds();
    },

    screenToWorld(sx: number, sy: number): { x: number; y: number } {
      return {
        x: cam.x + sx / cam.zoom,
        y: cam.y + sy / cam.zoom,
      };
    },

    worldToScreen(wx: number, wy: number): { x: number; y: number } {
      return {
        x: (wx - cam.x) * cam.zoom,
        y: (wy - cam.y) * cam.zoom,
      };
    },

    isVisible(wx: number, wy: number, ww: number, wh: number): boolean {
      const vpW = cam.viewportWidth / cam.zoom;
      const vpH = cam.viewportHeight / cam.zoom;
      return (
        wx + ww > cam.x &&
        wx < cam.x + vpW &&
        wy + wh > cam.y &&
        wy < cam.y + vpH
      );
    },

    shakeOnImpact(intensity: number): void {
      cam.shakeIntensity = Math.min(10, intensity);
      cam.shakeTimer = 0.3;
    },

    update(dt: number): void {
      // Process screen shake
      if (cam.shakeTimer > 0) {
        cam.shakeTimer -= dt;
        cam.shakeOffsetX = (Math.random() - 0.5) * cam.shakeIntensity * 2;
        cam.shakeOffsetY = (Math.random() - 0.5) * cam.shakeIntensity * 2;
        cam.shakeIntensity *= 0.9;
      } else {
        cam.shakeOffsetX = 0;
        cam.shakeOffsetY = 0;
      }
    },

    clampToBounds(): void {
      const vpW = cam.viewportWidth / cam.zoom;
      const vpH = cam.viewportHeight / cam.zoom;
      if (cam.x < cam.bounds.left) cam.x = cam.bounds.left;
      if (cam.y < cam.bounds.top) cam.y = cam.bounds.top;
      if (cam.x + vpW > cam.bounds.right) cam.x = cam.bounds.right - vpW;
      if (cam.y + vpH > cam.bounds.bottom) cam.y = cam.bounds.bottom - vpH;
    },

    getVisibleTileRange(tileW: number, tileH: number, mapCols: number, mapRows: number) {
      const vpW = cam.viewportWidth / cam.zoom;
      const vpH = cam.viewportHeight / cam.zoom;
      return {
        startCol: Math.max(0, Math.floor(cam.x / tileW)),
        startRow: Math.max(0, Math.floor(cam.y / tileH)),
        endCol: Math.min(mapCols - 1, Math.floor((cam.x + vpW) / tileW)),
        endRow: Math.min(mapRows - 1, Math.floor((cam.y + vpH) / tileH)),
      };
    },
  };

  return cam as unknown as BattlefieldCamera;
}

// ── Event log helper ────────────────────────────────────────────────────────

function addEventLog(message: string, type: 'info' | 'warning' | 'success' = 'info'): void {
  eventLog.push({ message, type, timestamp: Date.now() });
  if (eventLog.length > 50) eventLog.shift();
  ui?.addEventLog(message, type);
}

// ============================================================================
// Initialization
// ============================================================================

async function init(): Promise<void> {
  // 1. Canvas setup
  canvas = document.getElementById('game') as HTMLCanvasElement;
  canvas.width = CANVAS_W;
  canvas.height = CANVAS_H;
  ctx2d = canvas.getContext('2d')!;
  ctx2d.imageSmoothingEnabled = false;

  // 2. Load mote project (sprite sheets, entity defs, etc.)
  const loaded = await loadProject('/project.mote.json');
  projectRuntime = loaded.runtime;
  assets = loaded.assets;

  // 3. Core engine systems
  sceneManager = new SceneManager(projectRuntime);
  scriptRuntime = new ScriptRuntime();

  // 4. Camera
  camera = createBattlefieldCamera();

  // 5. Renderer
  renderer = new SiegeRenderer(ctx2d, camera, assets, projectRuntime.spriteSheets);

  // 6. Input system with battle ActionMap
  input = new InputManager(canvas, { preventDefault: true });
  actionMap = new ActionMap(
    'battle',
    {
      // Mouse
      select:          { type: ActionType.Button, bindings: ['Mouse0'] },
      contextMenu:     { type: ActionType.Button, bindings: ['Mouse2'] },
      panCamera:       { type: ActionType.Button, bindings: ['Mouse1'] },

      // Wall segment hotkeys
      wallSeg1:        { type: ActionType.Button, bindings: ['Digit1'] },
      wallSeg2:        { type: ActionType.Button, bindings: ['Digit2'] },
      wallSeg3:        { type: ActionType.Button, bindings: ['Digit3'] },
      wallSeg4:        { type: ActionType.Button, bindings: ['Digit4'] },
      wallSeg5:        { type: ActionType.Button, bindings: ['Digit5'] },
      wallSeg6:        { type: ActionType.Button, bindings: ['Digit6'] },
      wallSeg7:        { type: ActionType.Button, bindings: ['Digit7'] },

      // Global commands
      gong:            { type: ActionType.Button, bindings: ['KeyG'] },
      drum:            { type: ActionType.Button, bindings: ['KeyD'] },
      pause:           { type: ActionType.Button, bindings: ['Space'] },
      speedUp:         { type: ActionType.Button, bindings: ['Period'] },
      speedDown:       { type: ActionType.Button, bindings: ['Comma'] },

      // View modes
      viewGround:      { type: ActionType.Button, bindings: ['F1'] },
      viewUnderground: { type: ActionType.Button, bindings: ['F2'] },
      viewOverlay:     { type: ActionType.Button, bindings: ['F3'] },

      // Camera movement (WASD)
      cameraUp:        { type: ActionType.Button, bindings: ['KeyW'] },
      cameraDown:      { type: ActionType.Button, bindings: ['KeyS'] },
      cameraLeft:      { type: ActionType.Button, bindings: ['KeyA'] },
      cameraRight:     { type: ActionType.Button, bindings: ['KeyD'] },

      // Zoom
      zoomIn:          { type: ActionType.Button, bindings: ['Equal'] },
      zoomOut:         { type: ActionType.Button, bindings: ['Minus'] },

      // Cancel
      cancel:          { type: ActionType.Button, bindings: ['Escape'] },
    },
    input,
  );
  actionMap.enable();

  // 7. HTML overlay UI
  let overlayEl = document.getElementById('ui-overlay');
  if (!overlayEl) {
    overlayEl = document.createElement('div');
    overlayEl.id = 'ui-overlay';
    canvas.parentElement!.appendChild(overlayEl);
  }
  ui = new UIManager(overlayEl);

  // 8. Create all game sub-systems
  const spawner = createEntitySpawner();
  const commandSystem = createCommandSystem();
  const aiSystem = createAISystem();
  const projectileSystem = createProjectileSystem();
  const tunnelSystem = createTunnelSystem();
  const listeningPotSystem = createListeningPotSystem();
  const phaseManager = createPhaseManager();
  const moraleSystem = createMoraleSystem();
  const resourceManager = createResourceManager();
  const effectSystem = createEffectSystem();
  const pathfinding = createPathfinding();

  // 9. Create game context
  context = new SiegeWarContext(
    sceneManager,
    scriptRuntime,
    camera,
    assets,
    spawner,
    commandSystem,
    aiSystem,
    projectileSystem,
    tunnelSystem,
    listeningPotSystem,
    phaseManager,
    moraleSystem,
    resourceManager,
    effectSystem,
    pathfinding,
  );

  // Expose input on context for scripts
  (context as Record<string, unknown>).input = input;

  // 10. Wire UI callbacks
  wireUICallbacks();

  // 11. Wire mouse events for camera dragging and selection
  wireMouseEvents();

  // 12. Wire scroll for zoom
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -CAMERA_ZOOM_SPEED : CAMERA_ZOOM_SPEED;
    (camera as unknown as Record<string, Function>).zoomBy(delta);
  }, { passive: false });

  // 13. Create initial battle state
  battleState = {
    started: false,
    finished: false,
    won: false,
    paused: false,
    gameSpeed: 1.0,
    gameTime: 0,
    round: 1,
    maxRounds: 3,
    phase: BattlePhase.Probing,
    defenderMorale: 100,
    attackerMorale: 100,
    side: 'defender',
    commanderPos: { x: 640, y: 400 },
  };

  // 14. Load first level
  addEventLog('Siege War v0.1.0 initialized', 'success');
  await loadLevel('level-01');
}

// ============================================================================
// Level loading
// ============================================================================

async function loadLevel(levelId: string): Promise<void> {
  currentLevelId = levelId;

  // Get level config from levels data
  const levels = (levelsData as Record<string, unknown>).levels as Record<string, unknown>;
  const levelData = levels[levelId] as Record<string, unknown> | undefined;

  if (!levelData) {
    console.error(`[Siege War] Level not found: ${levelId}`);
    return;
  }

  const levelConfig: LevelConfig = {
    id: levelId,
    name: (levelData.name as string) ?? levelId,
    scene: (levelData.scene as string) ?? levelId,
    side: (levelData.side as 'attacker' | 'defender') ?? 'defender',
    budget: (levelData.budget as number) ?? 2000,
    rounds: (levelData.rounds as number) ?? 3,
    enemyWaves: (levelData.enemyWaves as LevelConfig['enemyWaves']) ?? [],
    winCondition: (levelData.winCondition as LevelConfig['winCondition']) ?? { type: 'survive_rounds', rounds: 3 },
    loseConditions: (levelData.loseConditions as LevelConfig['loseConditions']) ?? [],
    stars: (levelData.stars as LevelConfig['stars']) ?? [],
    availableUnits: (levelData.availableUnits as string[]) ?? [],
    availableEquipment: (levelData.availableEquipment as string[]) ?? [],
  };

  // Initialize context with level config
  context.init(levelConfig, levelConfig.side, assets);

  // Update battle state
  battleState.side = levelConfig.side;
  battleState.maxRounds = levelConfig.rounds;
  battleState.round = 1;
  battleState.defenderMorale = 100;
  battleState.attackerMorale = 100;
  battleState.gameTime = 0;
  battleState.started = false;
  battleState.finished = false;
  battleState.won = false;
  battleState.paused = false;
  battleState.gameSpeed = 1.0;
  battleState.phase = BattlePhase.Probing;

  // Clear scripts from previous level
  scriptRuntime.destroyAll();

  // Load the scene
  sceneManager.loadScene(levelConfig.scene);
  const scene = sceneManager.getCurrentScene();

  // Extract wall segments from scene entity layers
  if (scene) {
    for (const layer of scene.layers) {
      if (layer.type === 'entity' && (layer as EntityLayerRuntime).name === 'structures') {
        const entityLayer = layer as EntityLayerRuntime;
        for (const inst of entityLayer.entities) {
          if (inst.template === 'wall-segment') {
            const fields = inst.fields as Record<string, unknown>;
            const segState: WallSegmentState = {
              id: (fields.segmentId as string) ?? inst.id,
              entityId: inst.id,
              segmentType: (fields.segmentType as string) ?? 'normal',
              hp: (fields.hp as number) ?? 100,
              maxHp: (fields.maxHp as number) ?? 100,
              breached: false,
              onFire: false,
              ladderCount: 0,
              garrisonIds: [],
              repairActive: false,
              x: inst.x,
              y: inst.y,
              width: inst.width ?? 32,
              height: inst.height ?? 128,
            };
            context.wallSegments.push(segState);

            // Spawn the wall entity
            context.spawner.spawn('wall-segment', inst.x, inst.y, {
              segmentId: segState.id,
              segmentType: segState.segmentType,
              hp: segState.hp,
              maxHp: segState.maxHp,
            });
          }
        }
      }
    }
  }

  // Set camera bounds based on scene size
  if (scene && scene.data) {
    const worldW = scene.data.width;
    const worldH = scene.data.height;
    (camera as unknown as Record<string, unknown>).bounds = {
      left: 0, right: worldW, top: 0, bottom: worldH,
    };
    // Center camera on the wall area
    const wallCenter = context.wallSegments.length > 0
      ? context.wallSegments.reduce((sum, s) => sum + s.x, 0) / context.wallSegments.length
      : worldW / 2;
    (camera as unknown as Record<string, Function>).panTo(wallCenter, worldH / 2);
  }

  addEventLog(`Loading: ${levelConfig.name}`, 'info');

  // Show deployment UI
  const segStatuses: WallSegmentStatus[] = context.wallSegments.map((s) => ({
    id: s.id,
    segmentType: s.segmentType,
    hp: s.hp,
    maxHp: s.maxHp,
    onFire: false,
    ladderCount: 0,
    garrisonCount: 0,
    breached: false,
  }));

  const deployUnits = levelConfig.availableUnits.map((uid) => ({
    templateId: uid,
    name: uid.replace(/_/g, ' '),
    cost: 500,
    count: 1,
    type: uid.includes('archer') ? 'archer' : uid.includes('sword') ? 'melee' : 'support',
  }));

  ui.showDeploymentUI(levelConfig.budget, deployUnits, segStatuses);
  ui.onDeployConfirm = (assignments: Map<string, string[]>) => {
    handleDeploymentConfirm(assignments);
    startGameLoop();
  };
}

// ── Deployment confirmation ─────────────────────────────────────────────────

function handleDeploymentConfirm(assignments: Map<string, string[]>): void {
  for (const [segmentId, unitTemplates] of assignments) {
    const seg = context.getWallSegmentById(segmentId);
    if (!seg) continue;

    for (const templateId of unitTemplates) {
      // Create a unit state entry
      const unitId = `${templateId}-${segmentId}-${Math.random().toString(36).slice(2, 6)}`;
      const unitState: UnitState = {
        id: unitId,
        name: templateId.replace(/_/g, ' '),
        templateId,
        side: battleState.side,
        type: templateId.includes('archer') ? 'archer' : templateId.includes('sword') ? 'melee' : 'support',
        strength: 100,
        maxStrength: 100,
        morale: 100,
        state: 'idle',
        position: segmentId,
        entities: [],
      };
      context.registerUnit(unitState);

      // Spawn soldier entities for this unit (simplified: one entity per unit)
      const entity = context.spawner.spawn('soldier', seg.x, seg.y - 40, {
        unitId,
        side: battleState.side,
        unitType: unitState.type,
        state: 'idle',
      });
      unitState.entities.push(entity.id);
      seg.garrisonIds.push(unitId);
    }
  }

  battleState.started = true;
  addEventLog('Deployment complete. Battle begins!', 'success');
}

// ============================================================================
// Game loop
// ============================================================================

function startGameLoop(): void {
  if (gameLoop) return;

  gameLoop = new GameLoop();
  gameLoop.onUpdate = update;
  gameLoop.onRender = render;
  gameLoop.start();
}

// ============================================================================
// Update (called at fixed timestep)
// ============================================================================

function update(dt: number): void {
  input.update();

  // Handle input (camera, selection, hotkeys)
  handleInput(dt);

  // If paused, skip game logic
  if (battleState.paused || !battleState.started || battleState.finished) {
    input.endFrame();
    return;
  }

  // Scale dt by game speed
  const scaledDt = dt * battleState.gameSpeed;
  battleState.gameTime += scaledDt;

  // Update all game systems
  context.commandSystem.processQueue(scaledDt);
  context.aiSystem.update(scaledDt, battleState);
  context.projectileSystem.update(scaledDt);
  context.tunnelSystem.update(scaledDt);
  context.listeningPotSystem.update();
  context.phaseManager.update(scaledDt, battleState);
  context.moraleSystem.update(scaledDt);
  context.effectSystem.update(scaledDt);

  // Update battle phase
  battleState.phase = context.phaseManager.getCurrentPhase();

  // Update all entity scripts
  scriptRuntime.updateAll(scaledDt);

  // Camera update (shake, etc.)
  (camera as unknown as Record<string, Function>).update(scaledDt);

  // Check victory/defeat
  checkVictory();

  // Update UI
  updateUIDisplays();

  input.endFrame();
}

// ============================================================================
// Input handling
// ============================================================================

function handleInput(dt: number): void {
  // Pause toggle
  const pauseAction = input.action('pause');
  if (pauseAction && pauseAction.pressed) {
    battleState.paused = !battleState.paused;
    addEventLog(battleState.paused ? 'Game paused' : 'Game resumed', 'info');
  }

  // Speed control
  const speedUpAction = input.action('speedUp');
  if (speedUpAction && speedUpAction.pressed) {
    const idx = GAME_SPEEDS.indexOf(battleState.gameSpeed);
    if (idx < GAME_SPEEDS.length - 1) {
      battleState.gameSpeed = GAME_SPEEDS[idx + 1];
      addEventLog(`Speed: x${battleState.gameSpeed}`, 'info');
    }
  }
  const speedDownAction = input.action('speedDown');
  if (speedDownAction && speedDownAction.pressed) {
    const idx = GAME_SPEEDS.indexOf(battleState.gameSpeed);
    if (idx > 0) {
      battleState.gameSpeed = GAME_SPEEDS[idx - 1];
      addEventLog(`Speed: x${battleState.gameSpeed}`, 'info');
    }
  }

  // View mode switching
  const vGround = input.action('viewGround');
  if (vGround && vGround.pressed) context.switchViewMode('ground');
  const vUnder = input.action('viewUnderground');
  if (vUnder && vUnder.pressed) context.switchViewMode('underground');
  const vOverlay = input.action('viewOverlay');
  if (vOverlay && vOverlay.pressed) context.switchViewMode('overlay');

  // Camera pan (WASD/Arrow keys)
  const panSpeed = CAMERA_PAN_SPEED * dt;
  const camUp = input.action('cameraUp');
  if (camUp && camUp.down) (camera as unknown as Record<string, number>).y -= panSpeed;
  const camDown = input.action('cameraDown');
  if (camDown && camDown.down) (camera as unknown as Record<string, number>).y += panSpeed;
  const camLeft = input.action('cameraLeft');
  if (camLeft && camLeft.down) (camera as unknown as Record<string, number>).x -= panSpeed;
  const camRight = input.action('cameraRight');
  if (camRight && camRight.down) (camera as unknown as Record<string, number>).x += panSpeed;

  // Keyboard zoom
  const zIn = input.action('zoomIn');
  if (zIn && zIn.pressed) (camera as unknown as Record<string, Function>).zoomBy(CAMERA_ZOOM_SPEED);
  const zOut = input.action('zoomOut');
  if (zOut && zOut.pressed) (camera as unknown as Record<string, Function>).zoomBy(-CAMERA_ZOOM_SPEED);

  // Clamp camera after panning
  (camera as unknown as Record<string, Function>).clampToBounds();

  // Cancel (Escape)
  const cancelAction = input.action('cancel');
  if (cancelAction && cancelAction.pressed) {
    context.selectedEntity = null;
    context.selectedSegment = null;
    context.selectionMode = 'normal';
  }

  // Wall segment hotkeys (1-7)
  for (let i = 0; i < 7; i++) {
    const wallAction = input.action(`wallSeg${i + 1}`);
    if (wallAction && wallAction.pressed && i < context.wallSegments.length) {
      const seg = context.wallSegments[i];
      context.selectedSegment = seg;
      context.selectedEntity = null;
      addEventLog(`Selected wall: ${seg.id}`, 'info');
      // Pan camera to segment
      (camera as unknown as Record<string, Function>).panTo(
        seg.x + seg.width / 2,
        seg.y + seg.height / 2,
      );
    }
  }

  // Global commands
  const gongAction = input.action('gong');
  if (gongAction && gongAction.pressed) {
    executeCommand(CommandType.SoundGong);
    addEventLog('Gong sounded! Recall!', 'warning');
  }
  const drumAction = input.action('drum');
  if (drumAction && drumAction.pressed) {
    executeCommand(CommandType.BeatDrum);
    addEventLog('Drums beating! Rally!', 'success');
  }
}

// ── Mouse event wiring ──────────────────────────────────────────────────────

function wireMouseEvents(): void {
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 1) {
      // Middle mouse: start camera drag
      isDragging = true;
      dragLastX = e.clientX;
      dragLastY = e.clientY;
      e.preventDefault();
    }
  });

  canvas.addEventListener('mousemove', (e) => {
    if (isDragging) {
      const dx = e.clientX - dragLastX;
      const dy = e.clientY - dragLastY;
      (camera as unknown as Record<string, Function>).handleDrag(dx, dy);
      dragLastX = e.clientX;
      dragLastY = e.clientY;
    }
  });

  canvas.addEventListener('mouseup', (e) => {
    if (e.button === 1) {
      isDragging = false;
    }
  });

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;

    const world = (camera as unknown as Record<string, Function>).screenToWorld(screenX, screenY) as {
      x: number;
      y: number;
    };

    handleSelection(world.x, world.y);
  });

  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    // Right-click: context action on selected entity/segment
    if (context.selectedEntity || context.selectedSegment) {
      const rect = canvas.getBoundingClientRect();
      const screenX = e.clientX - rect.left;
      const screenY = e.clientY - rect.top;
      const world = (camera as unknown as Record<string, Function>).screenToWorld(screenX, screenY) as {
        x: number;
        y: number;
      };
      // Deploy selected unit to right-clicked position
      if (context.selectedEntity) {
        const cmdId = `cmd-${Date.now()}`;
        context.issueCommand({
          id: cmdId,
          type: CommandType.Deploy,
          issuedAt: battleState.gameTime,
          sourceUnit: context.selectedEntity.id,
          targetPosition: { x: world.x, y: world.y },
        });
        addEventLog('Deploy order issued', 'info');
      }
    }
  });
}

// ── Selection handling ──────────────────────────────────────────────────────

function handleSelection(worldX: number, worldY: number): void {
  // Check for unit hit
  const hitEntity = context.getUnitAtPosition(worldX, worldY);
  if (hitEntity) {
    context.selectedEntity = hitEntity;
    context.selectedSegment = null;
    const name = hitEntity.getField<string>('unitId') ?? hitEntity.id;
    addEventLog(`Selected unit: ${name}`, 'info');
    return;
  }

  // Check for wall segment hit
  const hitSeg = context.getWallSegmentAt(worldX, worldY);
  if (hitSeg) {
    context.selectedSegment = hitSeg;
    context.selectedEntity = null;
    addEventLog(`Selected wall: ${hitSeg.id}`, 'info');
    return;
  }

  // Click on empty ground: deselect
  context.selectedEntity = null;
  context.selectedSegment = null;
}

// ── Command execution ───────────────────────────────────────────────────────

function executeCommand(type: CommandType, target?: { x: number; y: number }): void {
  const cmdId = `cmd-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
  const cmd: Command = {
    id: cmdId,
    type,
    issuedAt: battleState.gameTime,
    targetPosition: target ?? battleState.commanderPos,
  };

  if (context.selectedEntity) {
    cmd.targetUnit = context.selectedEntity.id;
  }
  if (context.selectedSegment) {
    cmd.targetSegment = context.selectedSegment.id;
  }

  context.issueCommand(cmd);
}

// ── Victory / defeat check ──────────────────────────────────────────────────

function checkVictory(): void {
  if (battleState.finished) return;

  // Defender wins: survive all rounds OR attacker morale hits 0
  if (battleState.side === 'defender') {
    // Win: attacker morale reaches 0
    if (battleState.attackerMorale <= 0) {
      battleState.finished = true;
      battleState.won = true;
      showResults(true);
      return;
    }
    // Lose: defender morale reaches 0
    if (battleState.defenderMorale <= 0) {
      battleState.finished = true;
      battleState.won = false;
      showResults(false);
      return;
    }
    // Lose: too many enemies inside city
    const loseConditions = context.levelConfig?.loseConditions ?? [];
    for (const cond of loseConditions) {
      if (cond.type === 'gate_hp_zero') {
        const gateSeg = context.wallSegments.find((s) => s.segmentType === 'gate');
        if (gateSeg && gateSeg.hp <= 0) {
          battleState.finished = true;
          battleState.won = false;
          showResults(false);
          return;
        }
      }
    }
  } else {
    // Attacker wins: breach walls and enter city
    if (battleState.defenderMorale <= 0) {
      battleState.finished = true;
      battleState.won = true;
      showResults(true);
      return;
    }
    if (battleState.attackerMorale <= 0) {
      battleState.finished = true;
      battleState.won = false;
      showResults(false);
      return;
    }
  }
}

// ── Results screen ──────────────────────────────────────────────────────────

function showResults(won: boolean): void {
  const stars = won ? calculateStars() : 0;
  addEventLog(won ? 'VICTORY!' : 'DEFEAT...', won ? 'success' : 'warning');
  context.showResult(won, stars);

  // Save progress
  if (won) {
    context.campaignProgress.completedLevels.set(currentLevelId, {
      stars,
      bestTime: battleState.gameTime,
    });
  }
}

function calculateStars(): number {
  if (!context.levelConfig) return 0;
  let stars = 0;

  for (const starCond of context.levelConfig.stars) {
    switch (starCond.condition) {
      case 'win':
        stars++;
        break;
      case 'wall_intact': {
        const allIntact = context.wallSegments.every((s) => s.hp > 0 && !s.breached);
        if (allIntact) stars++;
        break;
      }
      case 'casualties_lt': {
        // Simplified: check unit strength
        let totalLoss = 0;
        for (const [, unit] of context.units) {
          totalLoss += unit.maxStrength - unit.strength;
        }
        if (totalLoss < (starCond.value ?? 10)) stars++;
        break;
      }
    }
  }

  return stars;
}

// ============================================================================
// Render
// ============================================================================

function render(_alpha: number): void {
  const scene = sceneManager.getCurrentScene();

  // Build tile layer references
  const tileLayers: RenderState['tileLayers'] = {};
  let mapCols = 120;
  let mapRows = 25;
  let tileW = TILE_SIZE;
  let tileH = TILE_SIZE;

  if (scene && scene.data) {
    tileW = scene.data.tileWidth ?? TILE_SIZE;
    tileH = scene.data.tileHeight ?? TILE_SIZE;
    mapCols = scene.data.width / tileW;
    mapRows = scene.data.height / tileH;

    for (const layer of scene.layers) {
      if (layer.type === 'tile') {
        const tl = layer as TileLayerRuntime;
        if (tl.name === 'underground') tileLayers.underground = tl;
        else if (tl.name === 'ground') tileLayers.ground = tl;
        else if (tl.name === 'wall') tileLayers.wall = tl;
      }
    }
  }

  // Build wall segment render data
  const wallSegRender: WallSegmentRender[] = context.wallSegments.map((s) => ({
    id: s.id,
    x: s.x,
    y: s.y,
    width: s.width,
    height: s.height,
    hp: s.hp,
    maxHp: s.maxHp,
    segmentType: s.segmentType,
    onFire: s.onFire,
  }));

  // Build messenger queue for HUD
  const messengerQueue = context.commandSystem.getMessengerQueue().map((m) => ({
    id: m.id,
    progress: m.progress,
    totalDelay: m.totalDelay,
    commandType: m.command.type ?? 'Unknown',
  }));

  // Filter entities by layer type
  const allActive = context.spawner.getActive();
  const groundEntities = allActive.filter((e) => {
    const et = e.getField<string>('entityType');
    return et !== 'tunnel_entity';
  });
  const tunnelEntities = allActive.filter((e) => {
    const et = e.getField<string>('entityType');
    return et === 'tunnel_entity';
  });

  // Build RenderState
  const renderState: RenderState = {
    viewMode: context.viewMode,
    entities: groundEntities,
    projectiles: context.projectileSystem.getActive() as ProjectileState[],
    effects: context.effectSystem.getActive() as EffectState[],
    tunnelEntities,
    potSignals: context.listeningPotSystem.getSignals(),
    suspiciousAreas: context.listeningPotSystem.getSuspiciousAreas(),
    wallSegments: wallSegRender,
    uiState: {
      resources: context.resourceManager.getResources(),
      morale: {
        defender: battleState.defenderMorale,
        attacker: battleState.attackerMorale,
      },
      round: battleState.round,
      maxRounds: battleState.maxRounds,
      phase: battleState.phase,
      gameSpeed: battleState.gameSpeed,
      paused: battleState.paused,
      side: battleState.side,
    },
    gameState: {
      messengerQueue,
      eventLog: eventLog.slice(-5),
    },
    tileLayers,
    mapCols,
    mapRows,
    tileW,
    tileH,
  };

  // Render the frame
  renderer.renderFrame(renderState);
}

// ============================================================================
// UI display updates (called each frame from update)
// ============================================================================

function updateUIDisplays(): void {
  // Resource bar
  const res = context.resourceManager.getResources();
  const myMorale = battleState.side === 'defender'
    ? battleState.defenderMorale
    : battleState.attackerMorale;
  ui.updateResourceBar(res, myMorale, battleState.round, battleState.maxRounds);

  // Troop roster
  const rosterEntries: UnitRosterEntry[] = [];
  for (const [id, unit] of context.units) {
    rosterEntries.push({
      id: unit.id,
      name: unit.name,
      type: unit.type,
      strength: unit.strength,
      maxStrength: unit.maxStrength,
      morale: unit.morale,
      state: unit.state,
      position: unit.position,
      isSelected: context.selectedEntity !== null &&
        unit.entities.includes(context.selectedEntity.id),
    });
  }
  ui.updateTroopRoster(rosterEntries);

  // Wall status
  const wallStatuses: WallSegmentStatus[] = context.wallSegments.map((s) => ({
    id: s.id,
    segmentType: s.segmentType,
    hp: s.hp,
    maxHp: s.maxHp,
    onFire: s.onFire,
    ladderCount: s.ladderCount,
    garrisonCount: s.garrisonIds.length,
    breached: s.breached,
  }));
  ui.updateWallStatus(wallStatuses);

  // Command panel
  const selectedEntity = context.selectedEntity
    ? {
        id: context.selectedEntity.id,
        type: context.selectedEntity.getField<string>('unitType') ?? 'unknown',
        name: context.selectedEntity.getField<string>('unitId') ?? context.selectedEntity.id,
      }
    : null;
  const selectedSegment = context.selectedSegment
    ? { id: context.selectedSegment.id, segmentType: context.selectedSegment.segmentType }
    : null;

  ui.updateCommandPanel(selectedEntity, selectedSegment, battleState.side);
}

// ── Wire UI callbacks ───────────────────────────────────────────────────────

function wireUICallbacks(): void {
  ui.onUnitClick = (unitId: string) => {
    const unit = context.units.get(unitId);
    if (unit && unit.entities.length > 0) {
      const entity = context.findEntity(unit.entities[0]);
      if (entity) {
        context.selectedEntity = entity;
        context.selectedSegment = null;
        (camera as unknown as Record<string, Function>).panTo(
          entity.x + entity.width / 2,
          entity.y + entity.height / 2,
        );
      }
    }
  };

  ui.onSegmentClick = (segmentId: string) => {
    const seg = context.getWallSegmentById(segmentId);
    if (seg) {
      context.selectedSegment = seg;
      context.selectedEntity = null;
      (camera as unknown as Record<string, Function>).panTo(
        seg.x + seg.width / 2,
        seg.y + seg.height / 2,
      );
    }
  };

  ui.onCommandClick = (commandType: string) => {
    const typeVal = CommandType[commandType as keyof typeof CommandType];
    if (typeVal !== undefined) {
      executeCommand(typeVal);
      addEventLog(`Command: ${commandType}`, 'info');
    }
  };

  // Wire context callbacks
  context.onUpdateHUD(() => updateUIDisplays());
  context.onAlert((message: string) => ui.showAlert(message));
  context.onResult((won: boolean, stars: number) => {
    ui.showAlert(won ? `Victory! ${stars} stars` : 'Defeat...');
  });
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

init().catch((err) => {
  console.error('[Siege War] Init failed:', err);
});
