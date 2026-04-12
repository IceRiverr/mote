// games/tiny-dungeon/src/components.ts
// 游戏特有组件

/** 玩家标记 */
export class PlayerTag {}

/** 敌人 AI */
export class EnemyAI {
  state: 'idle' | 'chase' = 'idle';
}

/** 武器组件 - 投掷斧头 */
export class Weapon {
  // 状态: idle=跟随玩家, flying=飞行中, returning=返回中
  state: 'idle' | 'flying' | 'returning' = 'idle';
  
  // 投掷参数
  startX = 0;
  startY = 0;
  targetX = 0;
  targetY = 0;
  
  // 飞行参数
  flySpeed = 300;
  maxDistance = 60;
  damage = 50;
  
  // 已击中目标记录（防止重复伤害）
  hitTargets = new Set<number>();
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
