/**
 * game-state.ts — Shared game state infrastructure.
 * Holds all player stats, inventory, progress, and provides save/load.
 */

export interface GameState {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  gold: number;
  exp: number;
  level: number;
  yellowKeys: number;
  blueKeys: number;
  redKeys: number;
  floor: number;
  playerX: number;
  playerY: number;
  direction: 'up' | 'down' | 'left' | 'right';
  specialItems: Set<string>;
  equippedItems: Set<string>;
  visitedFloors: Set<number>;
  currentScene: string;
  removedEntities: Map<string, Set<string>>;
}

export function createInitialState(): GameState {
  return {
    hp: 1000,
    maxHp: 1000,
    atk: 10,
    def: 10,
    gold: 0,
    exp: 0,
    level: 1,
    yellowKeys: 0,
    blueKeys: 0,
    redKeys: 0,
    floor: 1,
    playerX: 6,
    playerY: 11,
    direction: 'up',
    specialItems: new Set<string>(),
    equippedItems: new Set<string>(),
    visitedFloors: new Set<number>([1]),
    currentScene: 'floor-1',
    removedEntities: new Map<string, Set<string>>(),
  };
}

const SAVE_KEY = 'magic-tower-save';

export function saveState(state: GameState): void {
  const serializable = {
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
    specialItems: Array.from(state.specialItems),
    equippedItems: Array.from(state.equippedItems),
    visitedFloors: Array.from(state.visitedFloors),
    currentScene: state.currentScene,
    removedEntities: Object.fromEntries(
      Array.from(state.removedEntities.entries()).map(([k, v]) => [k, Array.from(v)])
    ),
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(serializable));
  } catch {
    console.warn('Failed to save game state to localStorage');
  }
}

export function loadState(): GameState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);

    return {
      hp: data.hp,
      maxHp: data.maxHp,
      atk: data.atk,
      def: data.def,
      gold: data.gold,
      exp: data.exp,
      level: data.level,
      yellowKeys: data.yellowKeys,
      blueKeys: data.blueKeys,
      redKeys: data.redKeys,
      floor: data.floor,
      playerX: data.playerX,
      playerY: data.playerY,
      direction: data.direction ?? 'up',
      specialItems: new Set<string>(data.specialItems ?? []),
      equippedItems: new Set<string>(data.equippedItems ?? []),
      visitedFloors: new Set<number>(data.visitedFloors ?? [1]),
      currentScene: data.currentScene ?? 'floor-1',
      removedEntities: new Map<string, Set<string>>(
        Object.entries(data.removedEntities ?? {}).map(
          ([k, v]) => [k, new Set<string>(v as string[])]
        )
      ),
    };
  } catch {
    console.warn('Failed to load game state from localStorage');
    return null;
  }
}
