// ═══════════════════════════════════════════════════════════════════════════════
// Tiny Dungeon — Game Update & Render Logic  (Y-up world coordinates)
// ═══════════════════════════════════════════════════════════════════════════════

import type { SpriteBatch, Camera2D, InputManager } from '@mote/engine';
import { Vec2, Color, Rect } from '@mote/engine';
import type { SpriteSheet, World, Entity, Weapon } from './game-types';
import {
  ENTITY_DEFS,
  entityBounds,
  weaponBounds,
  moveWithCollision,
} from './game-types';
import type { TextureAtlas } from '@mote/engine';

// ── Solid Tiles ──────────────────────────────────────────────────────────────
// 暂时硬编码：将来从编辑器的 tileData.collision 导出
// 这些 GID 对应墙壁/障碍物 tile（需要根据你的地图实际调整）

export const SOLID_TILES = new Set<number>([
  // 填入墙壁 tile 的 GID
]);

// ── Game Update ──────────────────────────────────────────────────────────────

export function gameUpdate(
  world: World,
  input: InputManager,
  dt: number,
): void {
  const player = world.entities.find(e => e.id === world.playerId);
  if (!player || !player.active) return;

  // ── 1. Player Movement ──
  // Input vec2: up=+Y, down=-Y, right=+X, left=-X (Y-up convention)
  const pan = input.action('Move').vec2();
  const def = ENTITY_DEFS[player.defId];
  const speed = def.speed ?? 120;

  if (pan.x !== 0 || pan.y !== 0) {
    const delta = new Vec2(pan.x * speed * dt, pan.y * speed * dt);
    player.pos = moveWithCollision(
      player.pos, delta,
      player.width / 2, player.height / 2,
      world.map, world.scale, SOLID_TILES,
    );
  }

  // ── 2. Attack Input ──
  const weapon = world.weapon;
  if (input.action('Attack').pressed && !weapon.attacking) {
    weapon.attacking = true;
    weapon.angle = 0;
    weapon.spinTotal = 0;
    weapon.hitThisSwing.clear();
  }

  // ── 3. Weapon Spin ──
  if (weapon.attacking) {
    weapon.angle += weapon.spinSpeed * dt;
    weapon.spinTotal += weapon.spinSpeed * dt;

    // 转完一整圈 → 攻击结束
    if (weapon.spinTotal >= Math.PI * 2) {
      weapon.attacking = false;
      weapon.angle = 0;
      weapon.spinTotal = 0;
    }

    // ── 4. Weapon vs Enemy Collision ──
    const wBounds = weaponBounds(weapon, player);
    for (const entity of world.entities) {
      if (!entity.active) continue;
      if (entity.id === player.id) continue;

      const eDef = ENTITY_DEFS[entity.defId];
      if (eDef.category !== 'enemy') continue;
      if (weapon.hitThisSwing.has(entity.id)) continue;

      const eBounds = entityBounds(entity);
      if (wBounds.intersects(eBounds)) {
        const dmg = ENTITY_DEFS[weapon.defId].damage ?? 10;
        entity.health -= dmg;
        weapon.hitThisSwing.add(entity.id);

        if (entity.health <= 0) {
          entity.active = false;
        }
      }
    }
  }

  // ── 5. Player vs Pickup Collision ──
  const playerBounds = entityBounds(player);
  for (const entity of world.entities) {
    if (!entity.active) continue;

    const eDef = ENTITY_DEFS[entity.defId];
    if (eDef.category !== 'pickup') continue;

    const eBounds = entityBounds(entity);
    if (playerBounds.intersects(eBounds)) {
      if (eDef.pickupKind === 'heal') {
        player.health = Math.min(player.maxHealth, player.health + (eDef.pickupAmount ?? 0));
      }
      entity.active = false;
    }
  }
}


// ── Game Render ──────────────────────────────────────────────────────────────

export function gameRender(
  world: World,
  batch: SpriteBatch,
  camera: Camera2D,
  atlas: TextureAtlas,
  regions: SpriteSheet,
): void {
  batch.begin(camera);

  const { map, scale } = world;
  const TW = map.tileWidth * scale;
  const TH = map.tileHeight * scale;

  // ── Tilemap Layers (Y-up) ──
  // 视口裁剪：只渲染相机可见范围内的 tile
  const halfVW = camera.viewport.width / 2;
  const halfVH = camera.viewport.height / 2;
  const camL = camera.position.x - halfVW / camera.zoom;
  const camR = camera.position.x + halfVW / camera.zoom;
  // Y-up: camera top = larger Y, camera bottom = smaller Y
  const camT = camera.position.y + halfVH / camera.zoom;
  const camB = camera.position.y - halfVH / camera.zoom;

  // Column range (X axis unchanged)
  const colMin = Math.max(0, Math.floor(camL / TW) - 1);
  const colMax = Math.min(map.width - 1, Math.ceil(camR / TW) + 1);

  // Row range (Y-up → row conversion)
  // tile at row r → worldY = (mapH - 1 - r) * TH + TH/2
  // invert: r = mapH - 1 - floor(worldY / TH)
  // camT is largest visible worldY → smallest visible row
  // camB is smallest visible worldY → largest visible row
  const mapH = map.height;
  const rowMin = Math.max(0, Math.floor((mapH * TH - camT) / TH) - 1);
  const rowMax = Math.min(mapH - 1, Math.ceil((mapH * TH - camB) / TH));

  for (const layer of map.layers) {
    if (!layer.visible) continue;
    for (let row = rowMin; row <= rowMax; row++) {
      for (let col = colMin; col <= colMax; col++) {
        const gid = layer.data[row * map.width + col];
        if (gid === 0) continue;
        const tileIdx = gid - 1;
        if (tileIdx < 0 || tileIdx >= regions.length) continue;

        const wx = col * TW + TW / 2;
        // Y-up: row 0 (map top) → largest worldY, row N-1 (map bottom) → smallest worldY
        const wy = (mapH - 1 - row) * TH + TH / 2;
        batch.drawQuad(wx, wy, TW, TH, 0, regions[tileIdx], atlas, Color.white());
      }
    }
  }

  // ── Entities ──
  for (const entity of world.entities) {
    if (!entity.active) continue;
    const eDef = ENTITY_DEFS[entity.defId];
    const region = regions[eDef.spriteIndex];
    if (!region) continue;

    batch.drawQuad(
      entity.pos.x, entity.pos.y,
      map.tileWidth * scale, map.tileHeight * scale,
      0, region, atlas, Color.white(),
    );
  }

  // ── Weapon (only when attacking) ──
  if (world.weapon.attacking) {
    const player = world.entities.find(e => e.id === world.playerId);
    if (player?.active) {
      const w = world.weapon;
      const wDef = ENTITY_DEFS[w.defId];
      const region = regions[wDef.spriteIndex];
      if (region) {
        const wx = player.pos.x + Math.cos(w.angle) * w.orbitRadius * scale;
        const wy = player.pos.y + Math.sin(w.angle) * w.orbitRadius * scale;
        batch.drawQuad(
          wx, wy,
          map.tileWidth * scale, map.tileHeight * scale,
          w.angle,
          region, atlas, Color.white(),
        );
      }
    }
  }

  // ── HUD: Health Bar ──
  // Y-up: 血条在玩家头顶 = +Y 方向
  const player = world.entities.find(e => e.id === world.playerId);
  if (player?.active) {
    const barW = 20 * scale;
    const barH = 3 * scale;
    const barX = player.pos.x;
    const barY = player.pos.y + 14 * scale;  // Y-up: 头顶 = +Y
    const hpRatio = player.health / player.maxHealth;

    const fullRegion = regions[0];
    if (fullRegion) {
      batch.drawQuad(barX, barY, barW, barH, 0, fullRegion, atlas, new Color(0.3, 0, 0, 0.8));
      batch.drawQuad(
        barX - barW * (1 - hpRatio) / 2, barY,
        barW * hpRatio, barH,
        0, fullRegion, atlas, new Color(0, 0.8, 0, 0.9),
      );
    }
  }

  batch.end();
}
