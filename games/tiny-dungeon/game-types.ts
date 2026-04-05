// ═══════════════════════════════════════════════════════════════════════════════
// Tiny Dungeon — Game Data Structures & Core Logic
// ═══════════════════════════════════════════════════════════════════════════════
//
// 设计原则：
//   1. 最小化 — 不用 ECS，用朴素的结构体 + 数组
//   2. 数据驱动 — 实体定义和实例分离
//   3. 可序列化 — 对接编辑器导出的 JSON
//
// Sprite Index 约定 (Kenney Tiny Dungeon, 12 columns):
//   Player:       98
//   Axe:          98  (TODO: 确认是否需要单独的武器 sprite index)
//   Potion Red:  115
//   Potion Blue: 116
//   Skeleton:    121
// ═══════════════════════════════════════════════════════════════════════════════

import type { AtlasRegion } from '@mote/engine';
import { Vec2, Rect } from '@mote/engine';

// ── Layer 2: Sprite Reference ────────────────────────────────────────────────
// 从 atlas 中引用一个 sprite，就是一个 tile index → AtlasRegion 的映射

/** 预切好的 atlas regions 数组，index 对应 tile ID */
export type SpriteSheet = AtlasRegion[];

// ── Layer 3: Entity Definitions (模板/蓝图) ──────────────────────────────────

/** 实体类别 — 决定游戏逻辑怎么处理它 */
export type EntityCategory = 'player' | 'enemy' | 'pickup' | 'weapon';

/** 拾取物类型 */
export type PickupKind = 'heal' | 'mana';

/** 实体定义 — 描述"这类东西是什么" */
export interface EntityDef {
  id:           string;         // 唯一标识: "player", "skeleton", "potion_red"
  category:     EntityCategory;
  spriteIndex:  number;         // atlas 中的 tile index
  width:        number;         // 碰撞体宽 (px)
  height:       number;         // 碰撞体高 (px)

  // ── 可选属性，按 category 使用 ──
  health?:      number;         // player / enemy 最大血量
  speed?:       number;         // 移动速度 (px/s)
  damage?:      number;         // weapon / enemy 伤害值
  pickupKind?:  PickupKind;     // pickup 类型
  pickupAmount?:number;         // pickup 数值
}

/** 
 * 全部实体定义注册表 
 * 
 * 将来这些数据从编辑器的 EntityDef 导出
 * 现在先硬编码
 */
export const ENTITY_DEFS: Record<string, EntityDef> = {
  player: {
    id:          'player',
    category:    'player',
    spriteIndex: 98,
    width:       12,       // 碰撞体略小于 16px tile，手感更好
    height:      12,
    health:      100,
    speed:       120,      // px/s
  },

  axe: {
    id:          'axe',
    category:    'weapon',
    spriteIndex: 118,
    width:       14,
    height:      14,
    damage:      50,
  },

  skeleton: {
    id:          'skeleton',
    category:    'enemy',
    spriteIndex: 121,
    width:       12,
    height:      12,
    health:      30,
    speed:       0,        // 暂时不移动
    damage:      10,
  },

  potion_red: {
    id:          'potion_red',
    category:    'pickup',
    spriteIndex: 115,
    width:       10,
    height:      10,
    pickupKind:  'heal',
    pickupAmount: 20,
  },

  potion_blue: {
    id:          'potion_blue',
    category:    'pickup',
    spriteIndex: 116,
    width:       10,
    height:      10,
    pickupKind:  'mana',
    pickupAmount: 15,
  },
};

// ── Editor defId → Game defId 映射 ───────────────────────────────────────────
// 编辑器里的 EntityDef.id 和游戏里的 ENTITY_DEFS key 命名风格不同
// 这张表让游戏侧能自动识别编辑器放置的实体

export const EDITOR_TO_GAME_DEF: Record<string, string> = {
  // 编辑器 defId         → 游戏 defId
  'player_start':          'player',
  'player':                'player',
  'enemy_skeleton':        'skeleton',
  'pickup_potion_red':     'potion_red',
  'pickup_potion_blue':    'potion_blue',
  'weapon_axe':            'axe',
  // 直接同名的也兜底
  'skeleton':              'skeleton',
  'potion_red':            'potion_red',
  'potion_blue':           'potion_blue',
  'axe':                   'axe',
};


// ── Layer 4: Entity Instance (运行时实体) ────────────────────────────────────

/** 运行时实体 — 地图中实际存在的一个物体 */
export interface Entity {
  id:           number;         // 运行时唯一 ID (自增)
  defId:        string;         // 引用 EntityDef.id
  active:       boolean;        // false = 已死亡/已拾取，不更新不渲染

  // ── 空间 ──
  pos:          Vec2;           // 中心位置 (world px)
  width:        number;         // 碰撞体尺寸 (从 def 初始化)
  height:       number;

  // ── 状态 ──
  health:       number;         // 当前血量 (player/enemy)
  maxHealth:    number;
}

/** 武器实体 — 附着在 player 上，攻击时旋转 */
export interface Weapon {
  defId:        string;         // 引用 EntityDef.id ('axe')
  owner:        number;         // 持有者 Entity.id

  // ── 攻击状态 ──
  attacking:    boolean;
  angle:        number;         // 当前旋转角度 (rad)
  orbitRadius:  number;         // 绕玩家旋转半径 (px)
  spinSpeed:    number;         // 旋转速度 (rad/s)
  spinTotal:    number;         // 已旋转角度（攻击完成 ≥ 2π 时停止）

  // ── 打击记录 (防止一次攻击重复伤害同一敌人) ──
  hitThisSwing: Set<number>;    // 本次攻击已命中的 Entity.id 集合
}


// ── World: 游戏世界容器 ──────────────────────────────────────────────────────

export interface TilemapData {
  width:       number;          // 列数
  height:      number;          // 行数
  tileWidth:   number;          // 16
  tileHeight:  number;          // 16
  layers:      TileLayerData[];
}

export interface TileLayerData {
  name:    string;
  data:    number[];            // row-major, 0 = empty, >0 = GID
  visible: boolean;
}

export interface World {
  map:          TilemapData;
  entities:     Entity[];
  playerId:     number;          // player 的 Entity.id
  weapon:       Weapon;
  nextEntityId: number;          // 自增 ID 计数器
  scale:        number;          // 渲染缩放 (2x)
  solidTiles:   Set<number>;     // P3: 从 tileData.collision 构建的 solid GID 集合
}


// ── Factory: 创建实体 ─────────────────────────────────────────────────────────

let _nextId = 1;

export function createEntity(defId: string, x: number, y: number): Entity {
  const def = ENTITY_DEFS[defId];
  if (!def) throw new Error(`Unknown entity def: ${defId}`);

  return {
    id:        _nextId++,
    defId,
    active:    true,
    pos:       new Vec2(x, y),
    width:     def.width,
    height:    def.height,
    health:    def.health ?? 0,
    maxHealth: def.health ?? 0,
  };
}

export function createWeapon(defId: string, ownerId: number): Weapon {
  return {
    defId,
    owner:       ownerId,
    attacking:   false,
    angle:       0,
    orbitRadius: 20,         // 斧头绕玩家的距离
    spinSpeed:   Math.PI * 4, // 2圈/秒 → 0.5秒一次攻击
    spinTotal:   0,
    hitThisSwing: new Set(),
  };
}


// ── Collision Helpers ─────────────────────────────────────────────────────────

/** 获取实体的 AABB 碰撞矩形 */
export function entityBounds(e: Entity): Rect {
  return new Rect(
    e.pos.x - e.width  / 2,
    e.pos.y - e.height / 2,
    e.width,
    e.height,
  );
}

/** 获取武器当前位置的 AABB */
export function weaponBounds(w: Weapon, owner: Entity): Rect {
  const def = ENTITY_DEFS[w.defId];
  const cx = owner.pos.x + Math.cos(w.angle) * w.orbitRadius;
  const cy = owner.pos.y + Math.sin(w.angle) * w.orbitRadius;
  return new Rect(
    cx - def.width  / 2,
    cy - def.height / 2,
    def.width,
    def.height,
  );
}

/** Tilemap collision: 检查世界坐标是否是 solid tile */
export function isSolidTile(
  map: TilemapData,
  worldX: number,
  worldY: number,
  scale: number,
  solidTiles: Set<number>,
): boolean {
  const col = Math.floor(worldX / (map.tileWidth * scale));
  // Y-up: worldY=0 is map bottom (row=height-1), worldY=max is map top (row=0)
  const TH  = map.tileHeight * scale;
  const row = Math.floor((map.height * TH - worldY) / TH);
  if (col < 0 || col >= map.width || row < 0 || row >= map.height) return true; // 地图外视为 solid

  // 检查所有图层（任一图层有 solid tile 就算碰撞）
  for (const layer of map.layers) {
    const gid = layer.data[row * map.width + col];
    if (solidTiles.has(gid)) return true;
  }
  return false;
}

/**
 * AABB vs Tilemap slide collision
 * 
 * 尝试将实体从 pos 移动 delta 距离，返回实际可到达的位置
 * 先尝试 X 方向，再尝试 Y 方向（分轴解算，避免卡角）
 */
export function moveWithCollision(
  pos: Vec2,
  delta: Vec2,
  halfW: number,
  halfH: number,
  map: TilemapData,
  scale: number,
  solidTiles: Set<number>,
): Vec2 {
  let nx = pos.x + delta.x;
  let ny = pos.y;

  // X axis
  if (delta.x !== 0) {
    const testX = delta.x > 0 ? nx + halfW : nx - halfW;
    if (
      isSolidTile(map, testX, pos.y - halfH + 1, scale, solidTiles) ||
      isSolidTile(map, testX, pos.y + halfH - 1, scale, solidTiles)
    ) {
      nx = pos.x; // 撞墙，X 不动
    }
  }

  // Y axis
  ny = pos.y + delta.y;
  if (delta.y !== 0) {
    const testY = delta.y > 0 ? ny + halfH : ny - halfH;
    if (
      isSolidTile(map, nx - halfW + 1, testY, scale, solidTiles) ||
      isSolidTile(map, nx + halfW - 1, testY, scale, solidTiles)
    ) {
      ny = pos.y; // 撞墙，Y 不动
    }
  }

  return new Vec2(nx, ny);
}
