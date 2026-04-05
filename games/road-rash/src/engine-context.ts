/**
 * engine-context.ts — The engine reference passed to all entity scripts.
 *
 * RoadRashContext is the "engine" object that script constructors receive.
 * It provides access to scene management, camera, spawner, game state,
 * track data, lane utilities, and UI callback hooks.
 *
 * Supports index-signature access so main.ts can monkey-patch methods
 * via `(context as Record<string, unknown>).foo = bar`.
 */

import type { Entity, SceneManager, ScriptRuntime } from '@mote/engine';
import type { ScrollingCamera } from './scrolling-camera';
import type { EntitySpawner } from './entity-spawner';
import type { GameState, RaceState } from './game-state';
import type { TrackConfig } from './track-data';
import { getRoadCenterForRow } from './track-data';

// ── Callback function types ─────────────────────────────────────────────────

type HUDCallback = () => void;
type ResultCallback = (title: string, details: string) => void;
type DamageFlashCallback = () => void;
type CountdownCallback = (n: number) => void;

// ── RoadRashContext ─────────────────────────────────────────────────────────

export class RoadRashContext {
  // Index signature so main.ts can do `(context as Record<string,unknown>).x = y`
  [key: string]: unknown;

  // ── Core engine systems ───────────────────────────────────────────────
  readonly sceneManager: SceneManager;
  readonly scriptRuntime: ScriptRuntime;
  readonly camera: ScrollingCamera;
  /** Mutable so main.ts can reassign after construction. */
  spawner: EntitySpawner;

  // ── Game / race state ─────────────────────────────────────────────────
  state: GameState;
  raceState: RaceState;

  // ── Live entity references ────────────────────────────────────────────
  /** All live entities (player + opponents + traffic + pickups + hazards). */
  entities: Entity[];
  /** The player bike entity, or null before spawning. */
  player: Entity | null;
  /** Opponent bike entities. */
  opponents: Entity[];
  /** Traffic vehicle entities. */
  traffic: Entity[];

  // ── Track configuration ───────────────────────────────────────────────
  trackConfig: TrackConfig | null;

  // ── UI callback registrations ─────────────────────────────────────────
  private _onUpdateHUD: HUDCallback | null = null;
  private _onShowResult: ResultCallback | null = null;
  private _onDamageFlash: DamageFlashCallback | null = null;
  private _onCountdown: CountdownCallback | null = null;

  constructor(
    sceneManager: SceneManager,
    scriptRuntime: ScriptRuntime,
    camera: ScrollingCamera,
    spawner: EntitySpawner,
    state: GameState,
  ) {
    this.sceneManager = sceneManager;
    this.scriptRuntime = scriptRuntime;
    this.camera = camera;
    this.spawner = spawner;

    this.state = state;
    this.raceState = state.raceState ?? {
      trackId: state.currentTrack,
      started: false,
      finished: false,
      countdown: 4,
      raceTime: 0,
      playerPosition: 6,
      playerDistance: 0,
      playerSpeed: 0,
      playerHealth: 100,
      playerNitro: 0,
      playerWeapon: 'fist',
      opponentDistances: [],
    };

    this.entities = [];
    this.player = null;
    this.opponents = [];
    this.traffic = [];
    this.trackConfig = null;
  }

  // ── Lane / road utilities ─────────────────────────────────────────────

  /** Tile size constant. */
  static readonly TILE_SIZE = 32;
  /** Lane width in pixels (3 tiles). */
  static readonly LANE_WIDTH = 96;
  /** Number of lanes. */
  static readonly NUM_LANES = 5;

  /**
   * Convert a lane number (0-4) to a world X pixel coordinate.
   * Returns the center-X of the lane in pixels.
   *
   * @param lane - Lane index (0-4)
   * @param roadCenterCol - The road center tile column for the relevant row
   */
  laneToWorldX(lane: number, roadCenterCol: number): number {
    const totalLanes = RoadRashContext.NUM_LANES;
    const laneWidthTiles = 3;
    const roadWidthTiles = totalLanes * laneWidthTiles; // 15
    const halfRoad = Math.floor(roadWidthTiles / 2);    // 7
    const roadLeftCol = roadCenterCol - halfRoad;

    const laneStartCol = roadLeftCol + lane * laneWidthTiles;
    const laneCenterCol = laneStartCol + Math.floor(laneWidthTiles / 2);
    return laneCenterCol * RoadRashContext.TILE_SIZE;
  }

  /**
   * Convert a world X pixel position to the nearest lane number (0-4).
   *
   * @param worldX - World X position in pixels
   * @param roadCenterCol - The road center tile column for the relevant row
   */
  worldXToLane(worldX: number, roadCenterCol: number): number {
    const laneWidthTiles = 3;
    const roadWidthTiles = RoadRashContext.NUM_LANES * laneWidthTiles;
    const halfRoad = Math.floor(roadWidthTiles / 2);
    const roadLeftCol = roadCenterCol - halfRoad;
    const roadLeftX = roadLeftCol * RoadRashContext.TILE_SIZE;

    const laneWidthPx = laneWidthTiles * RoadRashContext.TILE_SIZE;
    const relativeX = worldX - roadLeftX;
    const lane = Math.floor(relativeX / laneWidthPx);

    // Clamp to valid lane range
    return Math.max(0, Math.min(RoadRashContext.NUM_LANES - 1, lane));
  }

  /**
   * Get the road center column for a given row.
   * Delegates to the track-data module using the current trackConfig.
   *
   * @param row - Tile row number
   * @returns The center column index (e.g. 10)
   */
  getRoadCenterForRow(row: number): number {
    if (!this.trackConfig) {
      return 10; // fallback default
    }
    return getRoadCenterForRow(row, this.trackConfig);
  }

  // ── UI callback registration and invocation ───────────────────────────

  /**
   * Register a callback to be invoked whenever the HUD should be refreshed.
   */
  onUpdateHUD(fn: HUDCallback): void {
    this._onUpdateHUD = fn;
  }

  /**
   * Trigger a HUD refresh.
   */
  updateHUD(): void {
    if (this._onUpdateHUD) {
      this._onUpdateHUD();
    }
  }

  /**
   * Register a callback to show the race result screen.
   */
  onShowResult(fn: ResultCallback): void {
    this._onShowResult = fn;
  }

  /**
   * Show the race result with a title and details text.
   */
  showResult(title: string, details: string): void {
    if (this._onShowResult) {
      this._onShowResult(title, details);
    }
  }

  /**
   * Register a callback for the damage flash effect.
   */
  onDamageFlash(fn: DamageFlashCallback): void {
    this._onDamageFlash = fn;
  }

  /**
   * Trigger the damage flash visual effect.
   */
  damageFlash(): void {
    if (this._onDamageFlash) {
      this._onDamageFlash();
    }
  }

  /**
   * Register a callback for the countdown display.
   */
  onCountdown(fn: CountdownCallback): void {
    this._onCountdown = fn;
  }

  /**
   * Show a countdown number (3, 2, 1, or 0 for "GO").
   */
  showCountdown(n: number): void {
    if (this._onCountdown) {
      this._onCountdown(n);
    }
  }

  // ── Convenience helpers ───────────────────────────────────────────────

  /**
   * Convert a world Y position to a tile row number.
   */
  worldYToRow(worldY: number): number {
    return Math.floor(worldY / RoadRashContext.TILE_SIZE);
  }

  /**
   * Convert a tile row number to a world Y position.
   */
  rowToWorldY(row: number): number {
    return row * RoadRashContext.TILE_SIZE;
  }

  /**
   * Find an entity by ID from the entities list.
   */
  findEntity(id: string): Entity | undefined {
    return this.entities.find((e) => e.id === id);
  }

  /**
   * Remove an entity from all tracking lists.
   */
  removeEntity(entity: Entity): void {
    this.entities = this.entities.filter((e) => e.id !== entity.id);
    this.opponents = this.opponents.filter((e) => e.id !== entity.id);
    this.traffic = this.traffic.filter((e) => e.id !== entity.id);
    if (this.player?.id === entity.id) {
      this.player = null;
    }
  }

  /**
   * Reset all entity tracking lists (for scene reload).
   */
  resetEntities(): void {
    this.entities = [];
    this.player = null;
    this.opponents = [];
    this.traffic = [];
  }
}
