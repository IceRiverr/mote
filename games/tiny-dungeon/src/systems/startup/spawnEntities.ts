// games/tiny-dungeon/src/systems/startup/spawnEntities.ts
// Startup: 在 Floor 格子上生成游戏实体

import type { World } from '@mote/engine';
import { GameConfig } from '../../resources.js';

/** 精灵索引 */
const SPRITES = {
  player: 98,
  skeleton: 121,
  potion_red: 115,
  potion_blue: 116,
};

export function spawnEntitiesSystem(world: World): void {
  const config = world.getResource<GameConfig>('GameConfig');
  const { mapWidth, mapHeight, tileSize } = config;

  const centerX = (mapWidth * tileSize) / 2;
  const centerY = (mapHeight * tileSize) / 2;

  // 玩家在中心，自带自动武器
  world.spawn('player', {
    Transform: { x: centerX, y: centerY, scaleX: 2, scaleY: 2 },
    Sprite: { atlas: 'tiles', region: `frame_${SPRITES.player}` },
    Weapon: { cooldown: 0.6, timer: 0.3, projectileCount: 1, damage: 20, speed: 240, pierce: 0, range: 350 },
    PlayerLevel: { level: 1, xp: 0, xpToNext: 30 },
  });

  // 敌人在周围随机
  for (let i = 0; i < 5; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 100 + Math.random() * 200;
    world.spawn('skeleton', {
      Transform: {
        x: centerX + Math.cos(angle) * dist,
        y: centerY + Math.sin(angle) * dist,
        scaleX: 2, scaleY: 2,
      },
      Sprite: { atlas: 'tiles', region: `frame_${SPRITES.skeleton}` },
    });
  }

  // 药水
  for (let i = 0; i < 4; i++) {
    const angle = Math.random() * Math.PI * 2;
    const dist = 50 + Math.random() * 150;
    const isRed = i % 2 === 0;
    const sprite = isRed ? SPRITES.potion_red : SPRITES.potion_blue;
    const prefab = isRed ? 'potion_red' : 'potion_blue';
    world.spawn(prefab, {
      Transform: {
        x: centerX + Math.cos(angle) * dist,
        y: centerY + Math.sin(angle) * dist,
        scaleX: 2, scaleY: 2,
      },
      Sprite: { atlas: 'tiles', region: `frame_${sprite}` },
    });
  }
}
