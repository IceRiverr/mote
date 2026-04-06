/**
 * engine-context.ts — SiegeWarContext, the game context hub.
 *
 * Passed as the `engine` parameter to every ScriptLifecycle constructor.
 * Holds references to all game sub-systems, entity management, UI state,
 * level data, and provides convenience methods for common operations.
 *
 * Mirrors the RoadRashContext pattern from road-rash but adapted for
 * the siege warfare domain with command-based interaction, multi-layer
 * scenes, and extensive sub-system coordination.
 */

import type { Entity, SceneManager, ScriptRuntime } from '@mote/engine';
import type { Canvas2DAssets } from './canvas-loader';
import type { BattlefieldCamera } from './battlefield-camera';
import type { Command, CommandType } from './command-system';
import type { TunnelRoute } from './tunnel-system';
import type { PotSignal, SuspiciousArea } from './listening-pot-system';
import type { BattlePhase } from './phase-manager';
import type { ViewMode } from './canvas-renderer';

// ── Supporting types ────────────────────────────────────────────────────────

export interface UnitState {
  id: string;
  name: string;
  templateId: string;
  side: 'attacker' | 'defender';
  type: string;         // 'archer' | 'melee' | 'support' | 'elite' | 'specialist' | 'engineer'
  strength: number;     // current headcount
  maxStrength: number;
  morale: number;
  state: string;        // 'idle' | 'moving' | 'firing' | 'melee' | 'routing' | 'dead'
  position: string;     // wall segment ID or 'reserve' or 'field'
  entities: string[];   // entity IDs belonging to this unit
}

export interface WallSegmentState {
  id: string;
  entityId: string;
  segmentType: string;  // 'normal' | 'bastion' | 'gate'
  hp: number;
  maxHp: number;
  breached: boolean;
  onFire: boolean;
  ladderCount: number;
  garrisonIds: string[];
  repairActive: boolean;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LevelConfig {
  id: string;
  name: string;
  scene: string;
  side: 'attacker' | 'defender';
  budget: number;
  rounds: number;
  enemyWaves: Array<{
    round: number;
    type: string;
    count: number;
    ladders?: number;
    rams?: number;
  }>;
  winCondition: { type: string; rounds?: number };
  loseConditions: Array<{ type: string; threshold?: number }>;
  stars: Array<{ condition: string; label: string; value?: number }>;
  availableUnits: string[];
  availableEquipment: string[];
}

export interface CampaignProgress {
  currentChapter: string;
  currentLevel: string;
  completedLevels: Map<string, { stars: number; bestTime: number }>;
  skillPoints: number;
  unlockedSkills: string[];
}

export interface ResourceState {
  gold: number;
  wood: number;
  stone: number;
  oil: number;
}

export interface GameEvents {
  listeners: Map<string, Array<(data: unknown) => void>>;
  emit(event: string, data?: unknown): void;
  on(event: string, fn: (data: unknown) => void): void;
  off(event: string, fn: (data: unknown) => void): void;
}

// ── Stub interfaces for systems that may be defined elsewhere ────────────

export interface CommandSystemLike {
  issueCommand(cmd: Command, gameState: unknown): void;
  processQueue(dt: number): void;
  getMessengerQueue(): Array<{ id: string; progress: number; totalDelay: number; command: Command }>;
}

export interface AISystemLike {
  update(dt: number, battleState: unknown): void;
}

export interface ProjectileSystemLike {
  update(dt: number): void;
  getActive(): Array<{
    id: string; x: number; y: number; width: number; height: number;
    rotation: number; sheetId: string; frameId: string; type: string;
    trail?: Array<{ x: number; y: number; alpha: number }>;
  }>;
}

export interface TunnelSystemLike {
  update(dt: number): void;
  getActiveDigging(): Array<{ x: number; y: number; soilType: string }>;
  getRoutes(): TunnelRoute[];
}

export interface ListeningPotSystemLike {
  update(): void;
  getSignals(): PotSignal[];
  getSuspiciousAreas(): SuspiciousArea[];
}

export interface PhaseManagerLike {
  update(dt: number, battleState: unknown): void;
  getCurrentPhase(): BattlePhase;
}

export interface MoraleSystemLike {
  update(dt: number): void;
  getDefenderMorale(): number;
  getAttackerMorale(): number;
}

export interface ResourceManagerLike {
  getResources(): ResourceState;
  spend(type: keyof ResourceState, amount: number): boolean;
  add(type: keyof ResourceState, amount: number): void;
}

export interface EffectSystemLike {
  update(dt: number): void;
  spawnEffect(type: string, x: number, y: number, params?: Record<string, unknown>): void;
  spawnFire(x: number, y: number): void;
  getActive(): Array<{
    id: string; x: number; y: number; width: number; height: number;
    sheetId: string; frameId: string; alpha: number; scale: number;
    elapsed: number; duration: number;
  }>;
}

export interface PathfindingLike {
  findPath(startX: number, startY: number, endX: number, endY: number): Array<{ x: number; y: number }> | null;
}

export interface EntitySpawnerLike {
  spawn(templateId: string, x: number, y: number, fields?: Record<string, unknown>): Entity;
  recycle(entity: Entity): void;
  getActive(): Entity[];
  getByTemplate(templateId: string): Entity[];
  clear(): void;
}

// ── Callback types ──────────────────────────────────────────────────────────

type HUDCallback = () => void;
type AlertCallback = (message: string) => void;
type ResultCallback = (won: boolean, stars: number) => void;

// ── SiegeWarContext ─────────────────────────────────────────────────────────

export class SiegeWarContext {
  // Index signature so main.ts can monkey-patch methods
  [key: string]: unknown;

  // ── Core engine systems ─────────────────────────────────────────────
  readonly sceneManager: SceneManager;
  readonly scriptRuntime: ScriptRuntime;
  readonly camera: BattlefieldCamera;
  assets: Canvas2DAssets;

  // ── Game sub-systems ────────────────────────────────────────────────
  commandSystem: CommandSystemLike;
  aiSystem: AISystemLike;
  projectileSystem: ProjectileSystemLike;
  tunnelSystem: TunnelSystemLike;
  listeningPotSystem: ListeningPotSystemLike;
  phaseManager: PhaseManagerLike;
  moraleSystem: MoraleSystemLike;
  resourceManager: ResourceManagerLike;
  effectSystem: EffectSystemLike;
  pathfinding: PathfindingLike;

  // ── Entity management ───────────────────────────────────────────────
  spawner: EntitySpawnerLike;
  units: Map<string, UnitState>;
  wallSegments: WallSegmentState[];

  // ── UI state ────────────────────────────────────────────────────────
  viewMode: ViewMode;
  selectedEntity: Entity | null;
  selectedSegment: WallSegmentState | null;
  selectionMode: 'normal' | 'target';

  // ── Level / campaign ────────────────────────────────────────────────
  levelConfig: LevelConfig | null;
  side: 'attacker' | 'defender';
  campaignProgress: CampaignProgress;

  // ── Event bus ───────────────────────────────────────────────────────
  events: GameEvents;

  // ── UI callbacks ────────────────────────────────────────────────────
  private _onUpdateHUD: HUDCallback | null = null;
  private _onAlert: AlertCallback | null = null;
  private _onResult: ResultCallback | null = null;

  constructor(
    sceneManager: SceneManager,
    scriptRuntime: ScriptRuntime,
    camera: BattlefieldCamera,
    assets: Canvas2DAssets,
    spawner: EntitySpawnerLike,
    commandSystem: CommandSystemLike,
    aiSystem: AISystemLike,
    projectileSystem: ProjectileSystemLike,
    tunnelSystem: TunnelSystemLike,
    listeningPotSystem: ListeningPotSystemLike,
    phaseManager: PhaseManagerLike,
    moraleSystem: MoraleSystemLike,
    resourceManager: ResourceManagerLike,
    effectSystem: EffectSystemLike,
    pathfinding: PathfindingLike,
  ) {
    this.sceneManager = sceneManager;
    this.scriptRuntime = scriptRuntime;
    this.camera = camera;
    this.assets = assets;
    this.spawner = spawner;

    this.commandSystem = commandSystem;
    this.aiSystem = aiSystem;
    this.projectileSystem = projectileSystem;
    this.tunnelSystem = tunnelSystem;
    this.listeningPotSystem = listeningPotSystem;
    this.phaseManager = phaseManager;
    this.moraleSystem = moraleSystem;
    this.resourceManager = resourceManager;
    this.effectSystem = effectSystem;
    this.pathfinding = pathfinding;

    this.units = new Map();
    this.wallSegments = [];
    this.viewMode = 'ground';
    this.selectedEntity = null;
    this.selectedSegment = null;
    this.selectionMode = 'normal';
    this.levelConfig = null;
    this.side = 'defender';

    this.campaignProgress = {
      currentChapter: 'ch1',
      currentLevel: 'level-01',
      completedLevels: new Map(),
      skillPoints: 0,
      unlockedSkills: [],
    };

    // Simple event emitter
    const listeners = new Map<string, Array<(data: unknown) => void>>();
    this.events = {
      listeners,
      emit(event: string, data?: unknown): void {
        const fns = listeners.get(event);
        if (fns) {
          for (const fn of fns) fn(data);
        }
      },
      on(event: string, fn: (data: unknown) => void): void {
        if (!listeners.has(event)) listeners.set(event, []);
        listeners.get(event)!.push(fn);
      },
      off(event: string, fn: (data: unknown) => void): void {
        const fns = listeners.get(event);
        if (fns) {
          const idx = fns.indexOf(fn);
          if (idx >= 0) fns.splice(idx, 1);
        }
      },
    };
  }

  // ── Initialization ──────────────────────────────────────────────────

  init(levelConfig: LevelConfig, side: 'attacker' | 'defender', canvas2dAssets: Canvas2DAssets): void {
    this.levelConfig = levelConfig;
    this.side = side;
    this.assets = canvas2dAssets;

    this.units.clear();
    this.wallSegments = [];
    this.selectedEntity = null;
    this.selectedSegment = null;
    this.selectionMode = 'normal';
    this.viewMode = 'ground';

    this.events.emit('context:init', { levelConfig, side });
  }

  // ── Hit testing ─────────────────────────────────────────────────────

  /**
   * Find the entity (soldier/unit) at a given world position.
   * Checks active entities from the spawner, returning the topmost match.
   */
  getUnitAtPosition(worldX: number, worldY: number): Entity | null {
    const active = this.spawner.getActive();
    // Check in reverse order (last spawned = drawn on top)
    for (let i = active.length - 1; i >= 0; i--) {
      const e = active[i];
      if (!e.visible) continue;
      const entityType = e.getField<string>('entityType');
      if (entityType !== 'soldier' && entityType !== 'officer') continue;

      if (
        worldX >= e.x && worldX <= e.x + e.width &&
        worldY >= e.y && worldY <= e.y + e.height
      ) {
        return e;
      }
    }
    return null;
  }

  /**
   * Find the wall segment at a given world position.
   */
  getWallSegmentAt(worldX: number, worldY: number): WallSegmentState | null {
    for (const seg of this.wallSegments) {
      if (
        worldX >= seg.x && worldX <= seg.x + seg.width &&
        worldY >= seg.y && worldY <= seg.y + seg.height
      ) {
        return seg;
      }
    }
    return null;
  }

  // ── Command issuing ─────────────────────────────────────────────────

  /**
   * Issue a command through the command system with proper delay calculation.
   */
  issueCommand(command: Command): void {
    this.commandSystem.issueCommand(command, this);
    this.events.emit('command:issued', command);
  }

  // ── View mode ───────────────────────────────────────────────────────

  switchViewMode(mode: ViewMode): void {
    if (this.viewMode === mode) return;
    const prev = this.viewMode;
    this.viewMode = mode;
    this.events.emit('viewMode:changed', { from: prev, to: mode });
  }

  // ── Damage calculation ──────────────────────────────────────────────

  /**
   * Apply damage to a target entity, accounting for defense.
   * Emits damage events for UI feedback (camera shake, alerts, etc.).
   */
  dealDamage(target: Entity, amount: number): void {
    const defense = target.getField<number>('defense') ?? 0;
    const effectiveDamage = Math.max(1, amount - defense * 0.5);

    const currentHp = target.getField<number>('hpCurrent') ?? target.getField<number>('hp') ?? 0;
    const newHp = Math.max(0, currentHp - effectiveDamage);

    // Update HP field (try both common field names)
    if (target.getField<number>('hpCurrent') !== undefined) {
      target.setField('hpCurrent', newHp);
    } else {
      target.setField('hp', newHp);
    }

    this.events.emit('damage:dealt', {
      targetId: target.id,
      amount: effectiveDamage,
      remainingHp: newHp,
    });

    // Check for entity death
    if (newHp <= 0) {
      target.setField('state', 'dead');
      target.visible = false;
      this.events.emit('entity:killed', { id: target.id });
    }
  }

  // ── Terrain queries ─────────────────────────────────────────────────

  /**
   * Get the ground Y coordinate at a given world X position.
   * Used for projectile impact detection and entity placement.
   * Returns the Y position of the ground surface.
   */
  getGroundY(worldX: number): number {
    // Default ground level based on scene layout (side-view, wall at center)
    // The ground is typically at a fixed Y for the flat battlefield
    // Actual implementation would read from tile data
    const scene = this.sceneManager.getCurrentScene();
    if (!scene || !scene.data) {
      return 600; // fallback ground Y for 720p canvas
    }

    const tileH = scene.data.tileHeight ?? 32;
    const mapRows = scene.data.height / tileH;

    // Ground level is typically around 80% of map height for side-view
    // Wall sits at roughly 60% from left
    return (mapRows - 5) * tileH;
  }

  // ── UI callback registration ────────────────────────────────────────

  onUpdateHUD(fn: HUDCallback): void { this._onUpdateHUD = fn; }
  updateHUD(): void { this._onUpdateHUD?.(); }

  onAlert(fn: AlertCallback): void { this._onAlert = fn; }
  showAlert(message: string): void { this._onAlert?.(message); }

  onResult(fn: ResultCallback): void { this._onResult = fn; }
  showResult(won: boolean, stars: number): void { this._onResult?.(won, stars); }

  // ── Convenience helpers ─────────────────────────────────────────────

  /** Find an active entity by ID. */
  findEntity(id: string): Entity | undefined {
    return this.spawner.getActive().find((e) => e.id === id);
  }

  /** Get all active entities of a given template type. */
  getEntitiesByTemplate(templateId: string): Entity[] {
    return this.spawner.getByTemplate(templateId);
  }

  /** Get all entities within a radius of a world point. */
  getEntitiesInRadius(worldX: number, worldY: number, radius: number): Entity[] {
    const r2 = radius * radius;
    return this.spawner.getActive().filter((e) => {
      if (!e.visible) return false;
      const cx = e.x + e.width / 2;
      const cy = e.y + e.height / 2;
      const dx = cx - worldX;
      const dy = cy - worldY;
      return dx * dx + dy * dy <= r2;
    });
  }

  /** Register a unit in the roster. */
  registerUnit(unit: UnitState): void {
    this.units.set(unit.id, unit);
  }

  /** Unregister a unit from the roster. */
  unregisterUnit(unitId: string): void {
    this.units.delete(unitId);
  }

  /** Get a wall segment state by ID. */
  getWallSegmentById(segmentId: string): WallSegmentState | undefined {
    return this.wallSegments.find((s) => s.id === segmentId);
  }

  // ── Cleanup ─────────────────────────────────────────────────────────

  dispose(): void {
    this.spawner.clear();
    this.units.clear();
    this.wallSegments = [];
    this.selectedEntity = null;
    this.selectedSegment = null;
    this.events.listeners.clear();
    this._onUpdateHUD = null;
    this._onAlert = null;
    this._onResult = null;
  }
}
