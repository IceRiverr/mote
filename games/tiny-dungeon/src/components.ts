// games/tiny-dungeon/src/components.ts
// 游戏特有组件

/** 玩家标记 */
export class PlayerTag {}

/** 敌人 AI */
export class EnemyAI {
  state: 'idle' | 'chase' = 'idle';
}

/** 武器组件 */
export class Weapon {
  attacking = false;
  angle = 0;
  spinTotal = 0;
  hitThisSwing = new Set<number>();
  orbitRadius = 20;
  spinSpeed = Math.PI * 4;
  damage = 50;
}

/** 健康值 */
export class Health {
  current = 100;
  max = 100;
}

/** 拾取物 */
export class Pickup {
  kind: 'heal' | 'mana' = 'heal';
  amount = 20;
}

/** 墙壁标记 - 用于碰撞检测 */
export class WallTag {}

/** 地面标记 */
export class FloorTag {}

// 声明组件类型扩展
declare module '@mote/engine' {
  interface ComponentMap {
    PlayerTag: PlayerTag;
    EnemyAI: EnemyAI;
    Weapon: Weapon;
    Health: Health;
    Pickup: Pickup;
    WallTag: WallTag;
    FloorTag: FloorTag;
  }
}
