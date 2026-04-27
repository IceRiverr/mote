// Update: 敌人持续生成（地图范围内，不在玩家脸上）

import type { World } from '@mote/engine';
import { Transform } from '@mote/engine';
import { PlayerTag } from '../components.js';
import { GameConfig, GameState } from '../resources.js';

const MIN_SPAWN_DIST = 180;   // 至少离玩家这么远
const MAX_SPAWN_DIST = 500;   // 最远这么远
const MAX_ATTEMPTS = 8;       // 随机选点最大尝试次数

export function enemySpawnSystem(world: World, dt: number): void {
  const state = world.getResource<GameState>('GameState');
  const config = world.getResource<GameConfig>('GameConfig');
  if (!state || !config || state.paused) return;

  state.elapsedTime += dt;
  state.spawnTimer += dt;

  // 难度随时间增长：每分钟难度系数 +1
  const difficulty = 1 + state.elapsedTime / 60;
  const currentInterval = Math.max(0.3, state.spawnInterval / difficulty);
  const batchSize = Math.floor(1 + difficulty * 0.8);

  if (state.spawnTimer < currentInterval) return;
  state.spawnTimer = 0;

  // 获取玩家位置
  let playerX = 0, playerY = 0;
  for (const eid of world.query(PlayerTag, Transform)) {
    const t = world.get(eid, Transform);
    playerX = t.x;
    playerY = t.y;
    break;
  }

  const mapW = config.mapWidth * config.tileSize;
  const mapH = config.mapHeight * config.tileSize;

  for (let i = 0; i < batchSize; i++) {
    const pos = findSpawnPos(playerX, playerY, mapW, mapH);
    if (!pos) continue;

    world.spawn('skeleton', {
      Transform: { x: pos.x, y: pos.y },
    });
  }
}

/** 在地图范围内找一个距离玩家合适的点 */
function findSpawnPos(
  playerX: number,
  playerY: number,
  mapW: number,
  mapH: number,
): { x: number; y: number } | null {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = MIN_SPAWN_DIST + Math.random() * (MAX_SPAWN_DIST - MIN_SPAWN_DIST);
    let x = playerX + Math.cos(angle) * dist;
    let y = playerY + Math.sin(angle) * dist;

    // 限制在地图边界内
    const halfTile = 8;
    x = Math.max(halfTile, Math.min(mapW - halfTile, x));
    y = Math.max(halfTile, Math.min(mapH - halfTile, y));

    // 检查是否距离玩家足够远
    const dx = x - playerX;
    const dy = y - playerY;
    const d = Math.sqrt(dx * dx + dy * dy);
    if (d >= MIN_SPAWN_DIST) {
      return { x, y };
    }
  }
  return null;
}
