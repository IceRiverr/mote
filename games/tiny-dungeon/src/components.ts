// games/tiny-dungeon/src/components.ts
// 游戏特有组件

/** 玩家标记 */
export class PlayerTag {}

/** 敌人 AI */
export class EnemyAI {
  speed = 60;
  damage = 10;
  attackCooldown = 0;
  attackInterval = 1.0;
}

/** 玩家受伤无敌 */
export class HurtCooldown {
  timer = 0;
}

/** 武器配置 —— 挂载在玩家身上 */
export class Weapon {
  cooldown = 1.0;       // 发射间隔（秒）
  timer = 0;            // 当前冷却计时
  projectileCount = 1;  // 每次发射投射物数量
  damage = 10;
  speed = 200;
  pierce = 0;           // 可穿透敌人数（0=不穿透）
  range = 300;          // 最大飞行距离
}

/** 飞行中的投射物 */
export class Projectile {
  vx = 0;
  vy = 0;
  damage = 10;
  speed = 200;
  pierce = 0;           // 剩余可穿透次数
  hitTargets = new Set<number>();
  distanceFlown = 0;
  maxDistance = 300;
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

/** 经验宝石 */
export class XPOrb {
  amount = 10;
}

/** 玩家等级 */
export class PlayerLevel {
  level = 1;
  xp = 0;
  xpToNext = 30;
}

// 声明组件类型扩展
declare module '@mote/engine' {
  interface ComponentMap {
    PlayerTag: PlayerTag;
    EnemyAI: EnemyAI;
    Weapon: Weapon;
    Health: Health;
    Pickup: Pickup;
    HurtCooldown: HurtCooldown;
    Projectile: Projectile;
    XPOrb: XPOrb;
    PlayerLevel: PlayerLevel;
  }
}
