/**
 * game-state.ts — Game state interfaces and factory functions for Siege War.
 *
 * Defines the complete state tree for:
 *  - BattleState: per-battle transient state (resources, units, walls, commands, tunnels)
 *  - CampaignProgress: persistent progression across battles
 *  - UIState: transient UI selection and view mode state
 *
 * All state is plain serializable data (no class instances, no methods on state).
 * Factory functions create well-typed initial states from level configuration.
 */

import type { LevelConfigJson } from './canvas-loader';

// ── Enums & Literal Types ─────────────────────────────────────────────────────

/** Which side the player is controlling in a battle. */
export type Side = 'attacker' | 'defender';

/** Battle phase progression. */
export type BattlePhase =
  | 'deploy'       // Pre-battle deployment / formation
  | 'battle'       // Active combat
  | 'intermission' // Between rounds (repair, resupply)
  | 'victory'      // Player won
  | 'defeat';      // Player lost

/** View mode for multi-layer rendering toggle. */
export type ViewMode = 'ground' | 'underground' | 'overlay';

/** Unit behavioral state (matches soldier-ai.ts state machine). */
export type UnitBehaviorState =
  | 'idle'
  | 'moving'
  | 'attacking'
  | 'defending'
  | 'firing'
  | 'reloading'
  | 'repairing'
  | 'climbing'
  | 'retreating'
  | 'routing'       // morale broken, fleeing
  | 'dead';

/** Wall segment structural type. */
export type WallSegmentType = 'normal' | 'bastion' | 'gate' | 'tower' | 'barbican';

/** Tunnel purpose. */
export type TunnelPurpose = 'assault' | 'sap' | 'counter' | 'escape';

/** Selection mode for the UI pointer. */
export type SelectionMode = 'normal' | 'target';

/** Detail expand level for the UI sidebar. */
export type ExpandLevel = 'collapsed' | 'summary' | 'detail';

// ── Command Types ─────────────────────────────────────────────────────────────

/** All command types available in the game. */
export enum CommandType {
  // Defender commands
  Deploy            = 'deploy',
  FocusedFire       = 'focused_fire',
  FreeFire          = 'free_fire',
  Pour              = 'pour',
  PushLadder        = 'push_ladder',
  CloseGate         = 'close_gate',
  Repair            = 'repair',
  Sortie            = 'sortie',
  CounterTunnel     = 'counter_tunnel',
  Reinforce         = 'reinforce',
  ScatterCaltrops   = 'scatter_caltrops',
  // Attacker commands
  Advance           = 'advance',
  Charge            = 'charge',
  SetLadder         = 'set_ladder',
  RamGate           = 'ram_gate',
  Volley            = 'volley',
  Bombard           = 'bombard',
  FillMoat          = 'fill_moat',
  DigTunnel         = 'dig_tunnel',
  Feint             = 'feint',
  Retreat           = 'retreat',
  BuildBridge       = 'build_bridge',
  // Global commands (no messenger delay)
  SoundGong         = 'sound_gong',
  BeatDrum          = 'beat_drum',
}

// ── Command ───────────────────────────────────────────────────────────────────

/** A command issued by the player to a unit or structure. */
export interface Command {
  /** Unique command ID. */
  id: string;
  /** Command type. */
  type: CommandType;
  /** Game time when the command was issued. */
  issuedAt: number;
  /** Source unit ID that issued the command (commander). */
  sourceUnit?: string;
  /** Target unit ID to receive the command. */
  targetUnit?: string;
  /** Target wall segment ID. */
  targetSegment?: string;
  /** Target world position (x, y). */
  targetPosition?: { x: number; y: number };
  /** Additional parameters specific to the command type. */
  params?: Record<string, unknown>;
}

/** A command currently being delivered by a messenger. */
export interface CommandInTransit {
  /** The command being delivered. */
  command: Command;
  /** Game time when the command will arrive. */
  deliveryTime: number;
  /** Current delivery progress (0..1). */
  progress: number;
  /** Total messenger travel delay in seconds. */
  totalDelay: number;
}

// ── Resource State ────────────────────────────────────────────────────────────

/** Resource pool for one side of the battle. */
export interface ResourceState {
  /** Gold — primary currency for recruitment and equipment. */
  gold: number;
  /** Wood — construction material for siege engines, repairs. */
  wood: number;
  /** Stone — ammunition for trebuchets, wall repairs. */
  stone: number;
  /** Oil — fire attacks (boiling oil, fire arrows). */
  oil: number;
  /** Food — sustains troops over prolonged sieges. Depletion causes morale loss. */
  food: number;
  /** Global morale modifier (0-100). Affects all units on this side. */
  morale: number;
  /** Whether the supply line is intact. Severed supply line halts resource income. */
  supplyLine: boolean;
}

// ── Unit State ────────────────────────────────────────────────────────────────

/** Officer attached to a unit (military officer / 军官). */
export interface OfficerState {
  /** Whether the officer is still alive. Officer death reduces unit morale. */
  alive: boolean;
  /** Officer display name. */
  name: string;
}

/** State of a single military unit (e.g. one archer company). */
export interface UnitState {
  /** Unique unit instance ID. */
  id: string;
  /** Entity definition template ID (e.g. "archer_basic"). */
  templateId: string;
  /** Display name (e.g. "弓弩营·甲队"). */
  name: string;
  /** Current troop count in this unit. */
  count: number;
  /** Maximum troop count (full strength). */
  maxCount: number;
  /** Current world position (center of the unit formation). */
  position: { x: number; y: number };
  /** Wall segment ID this unit is assigned to (null if in the field). */
  segmentId: string | null;
  /** Current behavioral state. */
  state: UnitBehaviorState;
  /** Unit-level morale (0-100). Below 20 causes routing. */
  morale: number;
  /** Attached officer. */
  officer: OfficerState;
  /** Accumulated kill count this battle. */
  kills: number;
  /** Accumulated losses this battle. */
  losses: number;
}

// ── Wall Segment State ────────────────────────────────────────────────────────

/** State of a single wall segment. */
export interface WallSegmentState {
  /** Unique segment ID (e.g. "seg-a", "seg-gate-main"). */
  id: string;
  /** Structural type of this wall segment. */
  type: WallSegmentType;
  /** Current hit points. */
  hp: number;
  /** Maximum hit points. */
  maxHp: number;
  /** Whether the segment has been breached (hp reached 0 at some point). */
  breached: boolean;
  /** IDs of units garrisoned on this segment. */
  garrisonIds: string[];
  /** Number of ladders currently placed against this segment. */
  ladderCount: number;
  /** Whether this segment is currently on fire. */
  onFire: boolean;
  /** Whether active repair is in progress on this segment. */
  repairActive: boolean;
}

// ── Tunnel State ──────────────────────────────────────────────────────────────

/** A single tile in a tunnel path. */
export interface TunnelTile {
  /** Tile column in the underground grid. */
  col: number;
  /** Tile row in the underground grid. */
  row: number;
  /** Whether this tile has structural support (prevents collapse). */
  supported: boolean;
}

/** State of a tunnel being dug. */
export interface TunnelState {
  /** Unique tunnel ID. */
  id: string;
  /** Which side owns this tunnel. */
  side: Side;
  /** Purpose of the tunnel (determines behavior on completion). */
  purpose: TunnelPurpose;
  /** Ordered list of tiles comprising the tunnel path so far. */
  tiles: TunnelTile[];
  /** Digging progress toward the next tile (0..1). */
  progress: number;
  /** Whether this tunnel has been detected by the opposing side. */
  detected: boolean;
}

// ── Battle Events ─────────────────────────────────────────────────────────────

/** A recorded battle event for the event log. */
export interface BattleEvent {
  /** Game time when the event occurred. */
  time: number;
  /** Event category for filtering. */
  category: 'combat' | 'command' | 'morale' | 'structure' | 'tunnel' | 'resource' | 'phase';
  /** Human-readable event description. */
  message: string;
  /** Optional related entity/segment IDs for click-to-focus. */
  relatedIds?: string[];
}

// ── Battle State (per-battle, transient) ──────────────────────────────────────

/** Complete state for a single battle instance. */
export interface BattleState {
  /** Which side the player controls. */
  side: Side;
  /** Current battle phase. */
  phase: BattlePhase;
  /** Current round number (1-based). */
  round: number;
  /** Maximum number of rounds for this level. */
  maxRounds: number;
  /** Elapsed game time in seconds (affected by speed multiplier). */
  gameTime: number;
  /** Game speed multiplier (1 = normal, 2 = double, 0.5 = half). */
  speed: number;
  /** Whether the game is paused. */
  paused: boolean;
  /** Resource state for the player's side. */
  resources: ResourceState;
  /** All unit states for the player's side. */
  units: UnitState[];
  /** All wall segment states. */
  wallSegments: WallSegmentState[];
  /** Commands currently being delivered by messengers. */
  commandQueue: CommandInTransit[];
  /** Active tunnels (both sides, if visible). */
  tunnels: TunnelState[];
  /** Battle event log for the scrolling event panel. */
  events: BattleEvent[];
}

// ── Campaign Progress (persistent) ────────────────────────────────────────────

/** A skill unlocked through campaign progression. */
export interface UnlockedSkill {
  /** Skill identifier. */
  id: string;
  /** Skill display name. */
  name: string;
  /** Current skill level (1-based). */
  level: number;
}

/** Completion record for a single level. */
export interface LevelCompletion {
  /** Level ID. */
  levelId: string;
  /** Number of stars earned (0-3). */
  stars: number;
  /** Best completion time in seconds. */
  bestTime: number;
  /** Side the player completed it as. */
  side: Side;
}

/** Persistent campaign progression state (saved between sessions). */
export interface CampaignProgress {
  /** Current chapter ID (e.g. "ch1"). */
  currentChapter: string;
  /** Current level ID within the chapter. */
  currentLevel: string;
  /** Map of completed levels: levelId -> completion record. */
  completedLevels: Map<string, LevelCompletion>;
  /** Total stars earned across all levels. */
  stars: number;
  /** Total experience points earned. */
  xp: number;
  /** Unlocked skills from campaign progression. */
  skills: UnlockedSkill[];
}

// ── UI State (transient) ──────────────────────────────────────────────────────

/** Transient UI state for selection, view mode, and panel visibility. */
export interface UIState {
  /** Currently selected entity ID (null if nothing selected). */
  selectedEntity: string | null;
  /** Currently selected wall segment ID (null if nothing selected). */
  selectedSegment: string | null;
  /** Current selection mode (normal click vs target selection for commands). */
  selectionMode: SelectionMode;
  /** Current rendering view mode. */
  viewMode: ViewMode;
  /** Detail panel expansion level. */
  expandLevel: ExpandLevel;
  /** Whether the scrolling event log is visible. */
  showEventLog: boolean;
}

// ── Level Config (runtime representation) ─────────────────────────────────────

/** Runtime level configuration derived from LevelConfigJson. */
export interface LevelConfig {
  /** Level identifier. */
  id: string;
  /** Display name. */
  name: string;
  /** Scene ID to load. */
  scene: string;
  /** Which side the player controls. */
  side: Side;
  /** Starting resource budget. */
  budget: number;
  /** Number of rounds. */
  rounds: number;
  /** Tutorial flags for this level. */
  tutorialFlags: string[];
  /** Enemy wave definitions per round. */
  enemyWaves: Array<{
    round: number;
    type: string;
    count: number;
    ladders?: number;
    rams?: number;
    towers?: number;
    tunnels?: number;
  }>;
  /** Win condition definition. */
  winCondition: { type: string; rounds?: number; [k: string]: unknown };
  /** Lose condition definitions. */
  loseConditions: Array<{ type: string; threshold?: number; [k: string]: unknown }>;
  /** Star achievement conditions. */
  stars: Array<{ condition: string; label: string; value?: number }>;
  /** Unit template IDs available for recruitment. */
  availableUnits: string[];
  /** Equipment/tool IDs available for this level. */
  availableEquipment: string[];
}

// ── Factory Functions ─────────────────────────────────────────────────────────

/**
 * Create the initial BattleState from a level configuration and chosen side.
 *
 * Sets up:
 *  - Resources based on budget and side-specific defaults
 *  - Empty unit/wall/tunnel/command arrays (populated during deploy phase)
 *  - Phase set to 'deploy' for pre-battle setup
 *
 * @param levelConfig - The level configuration (from LevelConfigJson or LevelConfig)
 * @param side - Which side the player is controlling
 * @returns A fully initialized BattleState ready for the deploy phase
 */
export function createInitialBattleState(
  levelConfig: LevelConfig,
  side: Side,
): BattleState {
  return {
    side,
    phase: 'deploy',
    round: 1,
    maxRounds: levelConfig.rounds,
    gameTime: 0,
    speed: 1,
    paused: false,
    resources: createInitialResources(levelConfig.budget, side),
    units: [],
    wallSegments: [],
    commandQueue: [],
    tunnels: [],
    events: [
      {
        time: 0,
        category: 'phase',
        message: side === 'defender'
          ? '守方部署阶段开始。请布置城防。'
          : '攻方部署阶段开始。请编排攻城序列。',
        relatedIds: [],
      },
    ],
  };
}

/**
 * Create initial resource state based on budget and side.
 * Defender starts with more stone/oil (wall defense materials).
 * Attacker starts with more wood (siege engine construction).
 *
 * @param budget - Total starting budget from level config
 * @param side - Which side these resources belong to
 * @returns Initialized ResourceState
 */
function createInitialResources(budget: number, side: Side): ResourceState {
  if (side === 'defender') {
    return {
      gold: budget,
      wood: Math.floor(budget * 0.3),
      stone: Math.floor(budget * 0.5),
      oil: Math.floor(budget * 0.4),
      food: Math.floor(budget * 0.6),
      morale: 80,
      supplyLine: true,
    };
  }
  // Attacker
  return {
    gold: budget,
    wood: Math.floor(budget * 0.6),
    stone: Math.floor(budget * 0.3),
    oil: Math.floor(budget * 0.2),
    food: Math.floor(budget * 0.5),
    morale: 75,
    supplyLine: true,
  };
}

/**
 * Create a new CampaignProgress with default starting values.
 * Player begins at chapter 1, level 1, with no completions or skills.
 *
 * @returns Fresh CampaignProgress for a new game
 */
export function createCampaignProgress(): CampaignProgress {
  return {
    currentChapter: 'ch1',
    currentLevel: 'level-01',
    completedLevels: new Map(),
    stars: 0,
    xp: 0,
    skills: [],
  };
}

/**
 * Create the initial UIState for a battle.
 *
 * @returns Default UIState with nothing selected, ground view, event log visible
 */
export function createInitialUIState(): UIState {
  return {
    selectedEntity: null,
    selectedSegment: null,
    selectionMode: 'normal',
    viewMode: 'ground',
    expandLevel: 'summary',
    showEventLog: true,
  };
}

/**
 * Convert a LevelConfigJson (from disk) to a runtime LevelConfig.
 * Ensures all optional fields have defaults.
 *
 * @param id - Level identifier (e.g. "level-01")
 * @param json - Raw JSON config from data/levels.json
 * @returns Normalized LevelConfig
 */
export function toLevelConfig(id: string, json: LevelConfigJson): LevelConfig {
  return {
    id,
    name: json.name,
    scene: json.scene,
    side: json.side,
    budget: json.budget,
    rounds: json.rounds,
    tutorialFlags: json.tutorialFlags ?? [],
    enemyWaves: json.enemyWaves,
    winCondition: json.winCondition,
    loseConditions: json.loseConditions,
    stars: json.stars,
    availableUnits: json.availableUnits,
    availableEquipment: json.availableEquipment,
  };
}

// ── Utility Functions ─────────────────────────────────────────────────────────

/**
 * Create a new UnitState with default values.
 * Used when deploying a unit during the deploy phase.
 *
 * @param id - Unique unit instance ID
 * @param templateId - Entity definition template ID
 * @param name - Display name
 * @param count - Starting troop count
 * @param position - Starting world position
 * @param officerName - Name of the unit's officer
 * @returns Initialized UnitState
 */
export function createUnitState(
  id: string,
  templateId: string,
  name: string,
  count: number,
  position: { x: number; y: number },
  officerName: string,
): UnitState {
  return {
    id,
    templateId,
    name,
    count,
    maxCount: count,
    position: { x: position.x, y: position.y },
    segmentId: null,
    state: 'idle',
    morale: 80,
    officer: { alive: true, name: officerName },
    kills: 0,
    losses: 0,
  };
}

/**
 * Create a new WallSegmentState with full HP.
 *
 * @param id - Unique segment ID
 * @param type - Structural type
 * @param maxHp - Maximum hit points
 * @returns Initialized WallSegmentState at full health
 */
export function createWallSegmentState(
  id: string,
  type: WallSegmentType,
  maxHp: number,
): WallSegmentState {
  return {
    id,
    type,
    hp: maxHp,
    maxHp,
    breached: false,
    garrisonIds: [],
    ladderCount: 0,
    onFire: false,
    repairActive: false,
  };
}

/**
 * Create a new TunnelState at the start of digging.
 *
 * @param id - Unique tunnel ID
 * @param side - Which side owns the tunnel
 * @param purpose - Tunnel purpose
 * @param startCol - Starting tile column
 * @param startRow - Starting tile row
 * @returns Initialized TunnelState with a single starting tile
 */
export function createTunnelState(
  id: string,
  side: Side,
  purpose: TunnelPurpose,
  startCol: number,
  startRow: number,
): TunnelState {
  return {
    id,
    side,
    purpose,
    tiles: [{ col: startCol, row: startRow, supported: true }],
    progress: 0,
    detected: false,
  };
}

/**
 * Create a Command with a unique ID.
 *
 * @param type - Command type
 * @param gameTime - Current game time (for issuedAt)
 * @param options - Additional command fields
 * @returns A new Command object
 */
export function createCommand(
  type: CommandType,
  gameTime: number,
  options?: {
    sourceUnit?: string;
    targetUnit?: string;
    targetSegment?: string;
    targetPosition?: { x: number; y: number };
    params?: Record<string, unknown>;
  },
): Command {
  return {
    id: `cmd_${type}_${gameTime.toFixed(3)}_${Math.random().toString(36).substring(2, 8)}`,
    type,
    issuedAt: gameTime,
    sourceUnit: options?.sourceUnit,
    targetUnit: options?.targetUnit,
    targetSegment: options?.targetSegment,
    targetPosition: options?.targetPosition,
    params: options?.params,
  };
}

/**
 * Push a battle event onto the event log.
 * Keeps the log bounded to the most recent 200 events to prevent memory growth.
 *
 * @param state - The BattleState to modify
 * @param category - Event category
 * @param message - Human-readable message
 * @param relatedIds - Optional related entity/segment IDs
 */
export function pushBattleEvent(
  state: BattleState,
  category: BattleEvent['category'],
  message: string,
  relatedIds?: string[],
): void {
  state.events.push({
    time: state.gameTime,
    category,
    message,
    relatedIds,
  });

  // Cap event log at 200 entries
  if (state.events.length > 200) {
    state.events.splice(0, state.events.length - 200);
  }
}

/**
 * Calculate total stars earned from all completed levels.
 *
 * @param completedLevels - Map of level completions
 * @returns Total star count
 */
export function calculateTotalStars(completedLevels: Map<string, LevelCompletion>): number {
  let total = 0;
  for (const completion of completedLevels.values()) {
    total += completion.stars;
  }
  return total;
}

/**
 * Check if a unit is combat-effective (has troops, not dead/routing, morale OK).
 *
 * @param unit - Unit state to check
 * @returns true if the unit can still fight
 */
export function isUnitCombatEffective(unit: UnitState): boolean {
  return unit.count > 0 && unit.state !== 'dead' && unit.state !== 'routing';
}

/**
 * Get all combat-effective units from a unit list.
 *
 * @param units - Array of unit states
 * @returns Filtered array of units that can still fight
 */
export function getCombatEffectiveUnits(units: UnitState[]): UnitState[] {
  return units.filter(isUnitCombatEffective);
}

/**
 * Get units assigned to a specific wall segment.
 *
 * @param units - Array of unit states
 * @param segmentId - Wall segment ID
 * @returns Units garrisoned on the given segment
 */
export function getUnitsOnSegment(units: UnitState[], segmentId: string): UnitState[] {
  return units.filter((u) => u.segmentId === segmentId);
}

/**
 * Calculate the overall battle score for end-of-battle summary.
 * Takes into account remaining resources, units, wall integrity, and time.
 *
 * @param state - Final battle state
 * @returns Numeric score (higher is better)
 */
export function calculateBattleScore(state: BattleState): number {
  let score = 0;

  // Unit survival bonus (up to 3000 points)
  const totalTroops = state.units.reduce((sum, u) => sum + u.maxCount, 0);
  const survivingTroops = state.units.reduce((sum, u) => sum + u.count, 0);
  if (totalTroops > 0) {
    score += Math.floor((survivingTroops / totalTroops) * 3000);
  }

  // Wall integrity bonus (up to 2000 points, defender only)
  if (state.side === 'defender' && state.wallSegments.length > 0) {
    const totalHp = state.wallSegments.reduce((sum, w) => sum + w.maxHp, 0);
    const currentHp = state.wallSegments.reduce((sum, w) => sum + w.hp, 0);
    score += Math.floor((currentHp / totalHp) * 2000);
  }

  // Resource efficiency bonus (up to 1000 points)
  const resTotal = state.resources.gold + state.resources.wood +
    state.resources.stone + state.resources.oil + state.resources.food;
  score += Math.min(1000, Math.floor(resTotal * 0.1));

  // Morale bonus (up to 500 points)
  score += Math.floor(state.resources.morale * 5);

  // Kill efficiency bonus (up to 1500 points)
  const totalKills = state.units.reduce((sum, u) => sum + u.kills, 0);
  score += Math.min(1500, totalKills * 10);

  // Speed bonus — fewer rounds used = higher bonus (up to 1000 points)
  if (state.maxRounds > 0) {
    const roundEfficiency = 1 - ((state.round - 1) / state.maxRounds);
    score += Math.floor(roundEfficiency * 1000);
  }

  return score;
}

/**
 * Determine how many stars the player earned based on star conditions.
 * Each star condition is evaluated against the final battle state.
 *
 * @param state - Final battle state
 * @param levelConfig - Level configuration with star conditions
 * @returns Number of stars earned (0-3)
 */
export function evaluateStars(state: BattleState, levelConfig: LevelConfig): number {
  let earned = 0;

  for (const star of levelConfig.stars) {
    switch (star.condition) {
      case 'win':
        if (state.phase === 'victory') earned++;
        break;

      case 'wall_intact': {
        const allIntact = state.wallSegments.every((w) => !w.breached);
        if (allIntact) earned++;
        break;
      }

      case 'casualties_lt': {
        const totalLosses = state.units.reduce((sum, u) => sum + u.losses, 0);
        if (star.value !== undefined && totalLosses < star.value) earned++;
        break;
      }

      case 'time_lt': {
        if (star.value !== undefined && state.gameTime < star.value) earned++;
        break;
      }

      case 'morale_above': {
        if (star.value !== undefined && state.resources.morale >= star.value) earned++;
        break;
      }

      case 'no_breach': {
        const noBreaches = state.wallSegments.every((w) => !w.breached);
        if (noBreaches) earned++;
        break;
      }

      case 'kills_gt': {
        const totalKills = state.units.reduce((sum, u) => sum + u.kills, 0);
        if (star.value !== undefined && totalKills > star.value) earned++;
        break;
      }

      default:
        // Unknown condition — skip (future-proofing for new star types)
        break;
    }
  }

  return Math.min(3, earned);
}
