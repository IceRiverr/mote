// games/tiny-dungeon/src/prefabs.ts
// Prefab 定义

import { definePrefab } from '@mote/engine';
import { PlayerTag, EnemyAI, Weapon, Health, Pickup, HurtCooldown, Projectile } from './components.js';

// 精灵索引（来自 Kenney Tiny Dungeon）
const SPRITES = {
  player: 98,
  axe: 118,
  skeleton: 121,
  potion_red: 115,
  potion_blue: 116,
};

/** 玩家预制体 */
export const PlayerPrefab = definePrefab({
  id: 'player',
  components: {
    Transform: {},
    // Sprite 由 world-init.ts 在 spawn 时设置具体位置
    Health: { current: 100, max: 100 },
    PlayerTag: {},
  },
});

/** 骷髅敌人预制体 */
export const SkeletonPrefab = definePrefab({
  id: 'skeleton',
  components: {
    Transform: { scaleX: 2, scaleY: 2 },
    Health: { current: 30, max: 30 },
    EnemyAI: { speed: 60, damage: 10, attackCooldown: 0, attackInterval: 1.0 },
    Sprite: { atlas: 'tiles', region: 'frame_121' },
  },
});

/** 红药水预制体 */
export const PotionRedPrefab = definePrefab({
  id: 'potion_red',
  components: {
    Transform: {},
    Pickup: { kind: 'heal', amount: 20 },
  },
});

/** 蓝药水预制体 */
export const PotionBluePrefab = definePrefab({
  id: 'potion_blue',
  components: {
    Transform: {},
    Pickup: { kind: 'mana', amount: 15 },
  },
});

/** 所有预制体列表 */
export const ALL_PREFABS = [
  PlayerPrefab,
  SkeletonPrefab,
  PotionRedPrefab,
  PotionBluePrefab,
];
