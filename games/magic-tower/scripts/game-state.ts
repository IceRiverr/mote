/**
 * game-state.ts — Game State (Plain Object + Helper Functions)
 *
 * Central state management for the Magic Tower game.
 * GameState is a plain interface — no class, no singleton.
 * Helper functions operate on the state object directly.
 */

// ─── Interface ──────────────────────────────────────────────────────────

export interface GameState {
  // Player Stats
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  gold: number;
  exp: number;
  level: number;

  // Keys
  yellowKeys: number;
  blueKeys: number;
  redKeys: number;

  // Current Position / Floor
  floor: number;
  playerX: number;
  playerY: number;
  direction: 'up' | 'down' | 'left' | 'right';

  // Special & Equipped Items
  specialItems: Set<string>;
  equippedItems: Set<string>;

  // Floor Tracking
  visitedFloors: Set<number>;

  // Current Scene
  currentScene: string;

  // Removed Entities — tracks doors opened, monsters killed, items collected per scene
  removedEntities: Map<string, Set<string>>;
}

// ─── Factory ────────────────────────────────────────────────────────────

/**
 * Create a fresh initial game state with default values.
 */
export function createInitialState(): GameState {
  return {
    hp: 1000,
    maxHp: 1000,
    atk: 10,
    def: 10,
    gold: 0,
    exp: 0,
    level: 1,

    yellowKeys: 1,
    blueKeys: 0,
    redKeys: 0,

    floor: 1,
    playerX: 6,
    playerY: 11,
    direction: 'down',

    specialItems: new Set(),
    equippedItems: new Set(),
    visitedFloors: new Set([1]),
    currentScene: 'floor-1',
    removedEntities: new Map(),
  };
}

// ─── Entity Removal ─────────────────────────────────────────────────────

/**
 * Mark an entity as removed on a given scene (door opened, monster killed, item collected).
 */
export function removeEntity(state: GameState, sceneId: string, entityId: string): void {
  if (!state.removedEntities.has(sceneId)) {
    state.removedEntities.set(sceneId, new Set());
  }
  state.removedEntities.get(sceneId)!.add(entityId);
}

/**
 * Check whether a specific entity has been removed on a given scene.
 */
export function isEntityRemoved(state: GameState, sceneId: string, entityId: string): boolean {
  return state.removedEntities.get(sceneId)?.has(entityId) ?? false;
}

// ─── Persistence ────────────────────────────────────────────────────────

const SAVE_KEY = 'magic-tower-save';

/**
 * Serialize the game state and persist it to localStorage.
 */
export function saveState(state: GameState): void {
  const data = {
    hp: state.hp,
    maxHp: state.maxHp,
    atk: state.atk,
    def: state.def,
    gold: state.gold,
    exp: state.exp,
    level: state.level,

    yellowKeys: state.yellowKeys,
    blueKeys: state.blueKeys,
    redKeys: state.redKeys,

    floor: state.floor,
    playerX: state.playerX,
    playerY: state.playerY,
    direction: state.direction,

    currentScene: state.currentScene,

    specialItems: [...state.specialItems],
    equippedItems: [...state.equippedItems],
    visitedFloors: [...state.visitedFloors],
    removedEntities: Object.fromEntries(
      [...state.removedEntities.entries()].map(([k, v]) => [k, [...v]])
    ),
  };
  localStorage.setItem(SAVE_KEY, JSON.stringify(data));
}

/**
 * Load a previously saved game state from localStorage.
 * Returns null if no save exists or the data is corrupted.
 */
export function loadState(): GameState | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const data = JSON.parse(raw);
    return {
      hp: data.hp ?? 1000,
      maxHp: data.maxHp ?? 1000,
      atk: data.atk ?? 10,
      def: data.def ?? 10,
      gold: data.gold ?? 0,
      exp: data.exp ?? 0,
      level: data.level ?? 1,

      yellowKeys: data.yellowKeys ?? 1,
      blueKeys: data.blueKeys ?? 0,
      redKeys: data.redKeys ?? 0,

      floor: data.floor ?? 1,
      playerX: data.playerX ?? 6,
      playerY: data.playerY ?? 11,
      direction: data.direction ?? 'down',

      currentScene: data.currentScene ?? 'floor-1',

      specialItems: new Set(data.specialItems ?? []),
      equippedItems: new Set(data.equippedItems ?? []),
      visitedFloors: new Set(data.visitedFloors ?? [1]),
      removedEntities: new Map(
        Object.entries(data.removedEntities ?? {}).map(
          ([k, v]) => [k, new Set(v as string[])]
        )
      ),
    };
  } catch {
    return null;
  }
}
