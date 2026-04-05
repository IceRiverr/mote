import type { GameState } from '../src/game-state';

export function getVisitedFloors(state: GameState): number[] {
  return [...state.visitedFloors].sort((a, b) => a - b);
}
