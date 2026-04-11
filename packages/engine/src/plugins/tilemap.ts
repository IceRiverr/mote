// engine/src/plugins/tilemap.ts
// 瓦片地图插件 —— 2D 网格地图渲染和碰撞

import type { World } from '../core/world';
import { Transform } from './physics';

// ═════════════════════════════════════════════════════════════════════════════
// 组件定义
// ═════════════════════════════════════════════════════════════════════════════

/** 瓦片地图组件 —— 存储地图数据 */
export class Tilemap {
  /** 地图宽度（格数） */
  width = 0;
  /** 地图高度（格数） */
  height = 0;
  /** 瓦片宽度（像素） */
  tileWidth = 16;
  /** 瓦片高度（像素） */
  tileHeight = 16;
  /** 瓦片数据：layerIndex -> tileId */
  layers: TileLayer[] = [];
  /** 图集引用 */
  atlasKey: string = '';
}

export interface TileLayer {
  /** 层名称 */
  name: string;
  /** 是否可见 */
  visible: boolean;
  /** 不透明度 */
  opacity: number;
  /** 瓦片数据：y * width + x -> tileId */
  data: (number | null)[];
}

/** 瓦片地图碰撞体 —— 用于物理系统 */
export class TilemapCollider {
  /** 是否启用碰撞 */
  enabled = true;
  /** 碰撞层索引 */
  collisionLayer = 0;
  /** 哪些 tileId 被视为碰撞（null = 所有非空瓦片） */
  solidTileIds: number[] | null = null;
}

/** 瓦片动画组件 */
export class TileAnimation {
  /** 动画帧：tileId -> 帧列表 */
  animations = new Map<number, TileAnimFrame[]>();
  /** 当前状态：tileKey -> 当前帧索引 */
  currentFrames = new Map<string, number>();
  /** 累积时间 */
  accumulatedTime = 0;
}

export interface TileAnimFrame {
  tileId: number;
  duration: number; // 毫秒
}

// ═════════════════════════════════════════════════════════════════════════════
// 系统
// ═════════════════════════════════════════════════════════════════════════════

/** 瓦片动画系统 —— 更新动画帧 */
function tileAnimationSystem(world: World, dt: number): void {
  for (const eid of world.query(Tilemap, TileAnimation)) {
    const tilemap = world.get(eid, Tilemap);
    const anim = world.get(eid, TileAnimation);

    anim.accumulatedTime += dt * 1000;

    for (const layer of tilemap.layers) {
      if (!layer.visible) continue;

      for (let i = 0; i < layer.data.length; i++) {
        const tileId = layer.data[i];
        if (tileId === null) continue;

        const frames = anim.animations.get(tileId);
        if (!frames || frames.length <= 1) continue;

        const key = `${layer.name}:${i}`;
        let frameIdx = anim.currentFrames.get(key) ?? 0;

        // 检查是否需要切换帧
        const currentFrame = frames[frameIdx];
        if (anim.accumulatedTime >= currentFrame.duration) {
          anim.accumulatedTime = 0;
          frameIdx = (frameIdx + 1) % frames.length;
          anim.currentFrames.set(key, frameIdx);
          layer.data[i] = frames[frameIdx].tileId;
        }
      }
    }
  }
}

/** 瓦片地图碰撞解析 —— 用于处理 TilemapCollider 与 RigidBody 的交互
 * 注意：这是辅助函数，实际碰撞检测在 PhysicsPlugin 中 */
export function resolveTilemapCollision(
  world: World,
  tilemapEid: number,
  entityEid: number,
  entityX: number,
  entityY: number,
  entityWidth: number,
  entityHeight: number,
): { x: number; y: number; hit: boolean } {
  const tilemap = world.get(tilemapEid, Tilemap);
  const collider = world.get(tilemapEid, TilemapCollider);

  if (!collider.enabled) return { x: entityX, y: entityY, hit: false };

  // 计算实体覆盖的瓦片范围
  const halfW = entityWidth / 2;
  const halfH = entityHeight / 2;

  const minTileX = Math.floor((entityX - halfW) / tilemap.tileWidth);
  const maxTileX = Math.floor((entityX + halfW - 1) / tilemap.tileWidth);
  const minTileY = Math.floor((entityY - halfH) / tilemap.tileHeight);
  const maxTileY = Math.floor((entityY + halfH - 1) / tilemap.tileHeight);

  let hit = false;
  let resolveX = entityX;
  let resolveY = entityY;

  const layer = tilemap.layers[collider.collisionLayer];
  if (!layer) return { x: entityX, y: entityY, hit: false };

  // 收集所有碰撞的瓦片
  for (let ty = minTileY; ty <= maxTileY; ty++) {
    for (let tx = minTileX; tx <= maxTileX; tx++) {
      if (tx < 0 || tx >= tilemap.width || ty < 0 || ty >= tilemap.height) {
        // 超出边界视为碰撞
        hit = true;
        continue;
      }

      const tileId = layer.data[ty * tilemap.width + tx];
      if (tileId === null) continue;

      // 检查是否固体
      const isSolid = collider.solidTileIds === null
        ? tileId !== 0
        : collider.solidTileIds.includes(tileId);

      if (isSolid) {
        hit = true;

        // 计算瓦片矩形
        const tileL = tx * tilemap.tileWidth;
        const tileR = tileL + tilemap.tileWidth;
        const tileT = ty * tilemap.tileHeight;
        const tileB = tileT + tilemap.tileHeight;

        // 计算穿透深度
        const overlapLeft = (entityX + halfW) - tileL;
        const overlapRight = tileR - (entityX - halfW);
        const overlapTop = (entityY + halfH) - tileT;
        const overlapBottom = tileB - (entityY - halfH);

        const minOverlapX = Math.min(overlapLeft, overlapRight);
        const minOverlapY = Math.min(overlapTop, overlapBottom);

        // 选择最小穿透方向
        if (minOverlapX < minOverlapY) {
          resolveX += overlapLeft < overlapRight ? -minOverlapX : minOverlapX;
        } else {
          resolveY += overlapTop < overlapBottom ? -minOverlapY : minOverlapY;
        }
      }
    }
  }

  return { x: resolveX, y: resolveY, hit };
}

// ═════════════════════════════════════════════════════════════════════════════
// 辅助函数
// ═════════════════════════════════════════════════════════════════════════════

/** 从二维坐标获取瓦片ID */
export function getTile(tilemap: Tilemap, x: number, y: number, layer = 0): number | null {
  if (x < 0 || x >= tilemap.width || y < 0 || y >= tilemap.height) return null;
  const l = tilemap.layers[layer];
  if (!l) return null;
  return l.data[y * tilemap.width + x];
}

/** 设置瓦片ID */
export function setTile(tilemap: Tilemap, x: number, y: number, tileId: number | null, layer = 0): void {
  if (x < 0 || x >= tilemap.width || y < 0 || y >= tilemap.height) return;
  const l = tilemap.layers[layer];
  if (!l) return;
  l.data[y * tilemap.width + x] = tileId;
}

/** 世界坐标转瓦片坐标 */
export function worldToTile(tilemap: Tilemap, worldX: number, worldY: number): { x: number; y: number } {
  return {
    x: Math.floor(worldX / tilemap.tileWidth),
    y: Math.floor(worldY / tilemap.tileHeight),
  };
}

/** 瓦片坐标转世界坐标（中心点） */
export function tileToWorld(tilemap: Tilemap, tileX: number, tileY: number): { x: number; y: number } {
  return {
    x: tileX * tilemap.tileWidth + tilemap.tileWidth / 2,
    y: tileY * tilemap.tileHeight + tilemap.tileHeight / 2,
  };
}

/** 创建空瓦片地图 */
export function createTilemap(
  width: number,
  height: number,
  tileWidth = 16,
  tileHeight = 16,
  atlasKey = '',
): Tilemap {
  const tilemap = new Tilemap();
  tilemap.width = width;
  tilemap.height = height;
  tilemap.tileWidth = tileWidth;
  tilemap.tileHeight = tileHeight;
  tilemap.atlasKey = atlasKey;

  // 创建一个默认层
  tilemap.layers.push({
    name: 'main',
    visible: true,
    opacity: 1,
    data: new Array(width * height).fill(null),
  });

  return tilemap;
}

/** 从Tiled JSON加载瓦片地图 */
export function loadFromTiled(json: any, atlasKey: string): Tilemap {
  const tilemap = new Tilemap();
  tilemap.width = json.width;
  tilemap.height = json.height;
  tilemap.tileWidth = json.tilewidth;
  tilemap.tileHeight = json.tileheight;
  tilemap.atlasKey = atlasKey;

  for (const layer of json.layers) {
    if (layer.type === 'tilelayer') {
      tilemap.layers.push({
        name: layer.name,
        visible: layer.visible,
        opacity: layer.opacity,
        data: layer.data.map((id: number) => id === 0 ? null : id - 1),
      });
    }
  }

  return tilemap;
}

// ═════════════════════════════════════════════════════════════════════════════
// 插件导出
// ═════════════════════════════════════════════════════════════════════════════

/**
 * 瓦片地图插件
 * 
 * ```ts
 * world.use(TilemapPlugin);
 * 
 * // 创建地图实体
 * const map = world.spawn({
 *   Transform: {},
 *   Tilemap: createTilemap(20, 15, 16, 16, 'terrain'),
 *   TilemapCollider: { collisionLayer: 0 },
 * });
 * 
 * // 设置瓦片
 * const tm = map.get(Tilemap);
 * setTile(tm, 5, 5, 1);
 * 
 * // 解析碰撞
 * const resolved = resolveTilemapCollision(world, map.id, player.id, px, py, 16, 16);
 * ```
 */
export function TilemapPlugin(world: World): void {
  world.addSystem(tileAnimationSystem);
}

// 声明组件类型
declare module '../core/component' {
  interface ComponentMap {
    Tilemap: Tilemap;
    TilemapCollider: TilemapCollider;
    TileAnimation: TileAnimation;
  }
}
