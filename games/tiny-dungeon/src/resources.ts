// games/tiny-dungeon/src/resources.ts
// 游戏资源 —— 配置

/** 游戏配置 */
export interface GameConfig {
  mapWidth: number;
  mapHeight: number;
  tileSize: number;
}

export const DEFAULT_CONFIG: GameConfig = {
  mapWidth: 80,
  mapHeight: 80,
  tileSize: 32,
};

/** 运行时游戏状态 */
export class GameState {
  elapsedTime = 0;
  spawnTimer = 0;
  spawnInterval = 1.5;
  enemiesKilled = 0;
  paused = false;
}
