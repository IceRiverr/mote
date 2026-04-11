// games/tiny-dungeon/src/prefabs.ts
// Prefab 定义

import { definePrefab } from '@mote/engine';
import { PlayerTag, EnemyAI, Weapon, Health, Pickup } from './components.js';

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
    Velocity: {},
    // Sprite 由 world-init.ts 在 spawn 时设置具体位置
    BoxCollider: { width: 12, height: 12 },
    RigidBody: { useGravity: false },
    Health: { current: 100, max: 100 },
    PlayerTag: {},
  },
});

/** 武器预制体（斧头） */
export const AxePrefab = definePrefab({
  id: 'axe',
  components: {
    Transform: {},
    Sprite: { atlas: 'tiles', region: 'frame_118' },
    Weapon: {
      state: 'idle',
      startX: 0,
      startY: 0,
      targetX: 0,
      targetY: 0,
      flySpeed: 300,
      maxDistance: 60,
      damage: 50,
    },
  },
});

/** 骷髅敌人预制体 */
export const SkeletonPrefab = definePrefab({
  id: 'skeleton',
  components: {
    Transform: {},
    BoxCollider: { width: 12, height: 12 },
    RigidBody: { isStatic: true },
    Health: { current: 30, max: 30 },
    EnemyAI: {},
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
  AxePrefab,
  SkeletonPrefab,
  PotionRedPrefab,
  PotionBluePrefab,
];
