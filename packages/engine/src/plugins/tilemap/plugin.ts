// engine/src/plugins/tilemap/plugin.ts
// 瓦片地图插件 —— 2D 网格地图渲染和碰撞

import type { Plugin } from '../../core/plugin.js';
import type { App } from '../../core/app.js';
import type { World } from '../../core/world.js';
import { ScheduleLabel } from '../../core/schedule.js';
import { Tilemap, TilemapCollider, TileAnimation } from './components.js';
import { tileAnimationSystem } from './systems.js';

export {
  Tilemap, TilemapCollider, TileAnimation,
  type TileLayer, type TileAnimFrame,
} from './components.js';

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

/** 瓦片地图碰撞解析 —— 用于处理 TilemapCollider 与 RigidBody 的交互 */
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

  for (let ty = minTileY; ty <= maxTileY; ty++) {
    for (let tx = minTileX; tx <= maxTileX; tx++) {
      if (tx < 0 || tx >= tilemap.width || ty < 0 || ty >= tilemap.height) {
        hit = true;
        continue;
      }

      const tileId = layer.data[ty * tilemap.width + tx];
      if (tileId === null) continue;

      const isSolid = collider.solidTileIds === null
        ? tileId !== 0
        : collider.solidTileIds.includes(tileId);

      if (isSolid) {
        hit = true;

        const tileL = tx * tilemap.tileWidth;
        const tileR = tileL + tilemap.tileWidth;
        const tileT = ty * tilemap.tileHeight;
        const tileB = tileT + tilemap.tileHeight;

        const overlapLeft = (entityX + halfW) - tileL;
        const overlapRight = tileR - (entityX - halfW);
        const overlapTop = (entityY + halfH) - tileT;
        const overlapBottom = tileB - (entityY - halfH);

        const minOverlapX = Math.min(overlapLeft, overlapRight);
        const minOverlapY = Math.min(overlapTop, overlapBottom);

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
// TilemapPlugin
// ═════════════════════════════════════════════════════════════════════════════

/**
 * 瓦片地图插件
 *
 * ```ts
 * app.addPlugin(TilemapPlugin);
 *
 * // 创建地图实体
 * const map = world.spawn({
 *   Transform: {},
 *   Tilemap: createTilemap(20, 15, 16, 16, 'terrain'),
 *   TilemapCollider: { collisionLayer: 0 },
 * });
 * ```
 */
export const TilemapPlugin: Plugin = {
  name: 'tilemap',

  build(app: App) {
    app.registerComponent(Tilemap);
    app.registerComponent(TilemapCollider);
    app.registerComponent(TileAnimation);

    app.addSystems(ScheduleLabel.Update, [{ name: 'tileAnimation', update: tileAnimationSystem }]);
  },
};
