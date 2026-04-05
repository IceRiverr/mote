/**
 * player-controller.ts — Grid-Based Movement Controller
 *
 * Manages the hero's position on the 13x13 tile grid, checks collisions
 * with walls and entities, and provides smooth pixel interpolation for
 * the movement animation between cells.
 */

import { GameState } from './game-state';
import { MonsterData } from './combat';

// ─── Constants ────────────────────────────────────────────────────────

/** Number of cells along each axis of the playfield. */
const GRID_SIZE = 13;

/** Tile names that count as impassable walls. */
const WALL_TILES: ReadonlySet<string> = new Set([
  'wall_gray',
  'wall_dark',
  'wall_crack',
  'wall_vine',
]);

/** Pixel size of one tile (used for pixel-level interpolation). */
const TILE_PX = 32;

// ─── Public Types ─────────────────────────────────────────────────────

/** Outcome of a movement attempt, describing what occupies the target cell. */
export type MoveResult =
  | { type: 'move' }                                                    // Free tile — player moves
  | { type: 'wall' }                                                    // Blocked by wall or bounds
  | { type: 'door'; entityId: string; color: string }                   // Door entity
  | { type: 'monster'; entityId: string; data: MonsterData }            // Monster entity
  | { type: 'item'; entityId: string; itemType: string; fields: Record<string, any> } // Item entity
  | { type: 'stair'; entityId: string; fields: Record<string, any> }    // Staircase entity
  | { type: 'npc'; entityId: string; npcType: string; dialog: string }  // NPC entity
  | { type: 'shop'; entityId: string; fields: Record<string, any> }     // Shop entity
  | { type: 'blocked' };                                                // Any other solid entity

/** A single entity present on the current floor. */
export interface EntityData {
  id: string;
  template: string;
  x: number;         // grid x
  y: number;         // grid y
  width: number;     // width in tiles (usually 1)
  height: number;    // height in tiles (usually 1)
  fields: Record<string, any>;
}

/** Everything the player controller needs to know about the current floor. */
export interface GameContext {
  /** Flat array of 13*13 = 169 tile names, row-major (index = y * 13 + x). */
  tileData: string[];
  /** Entities on the current floor that have NOT yet been removed. */
  entities: EntityData[];
  /** Reference to the global game state. */
  state: GameState;
}

/** Cardinal direction the player is facing. */
export type Direction = 'up' | 'down' | 'left' | 'right';

// ─── Player Controller ───────────────────────────────────────────────

export class PlayerController {
  /** Current authoritative grid position. */
  gridX: number;
  gridY: number;

  /** Target grid cell during an active move animation. */
  targetGridX: number;
  targetGridY: number;

  /** Smoothly interpolated pixel coordinates for rendering. */
  pixelX: number;
  pixelY: number;

  /** Whether a movement animation is in progress. */
  moving: boolean = false;

  /** 0-1 progress of the current movement animation. */
  moveProgress: number = 0;

  /**
   * Animation speed expressed as "full moves per second".
   * 1/0.12 ≈ 8.33 — meaning one tile transition completes in ~0.12 s.
   */
  moveSpeed: number = 1 / 0.12;

  /** Current facing direction (for sprite frame selection). */
  direction: Direction = 'down';

  constructor(gridX: number, gridY: number) {
    this.gridX = gridX;
    this.gridY = gridY;
    this.targetGridX = gridX;
    this.targetGridY = gridY;
    this.pixelX = gridX * TILE_PX;
    this.pixelY = gridY * TILE_PX;
  }

  // ─── Movement ─────────────────────────────────────────────────────

  /**
   * Attempt to move one cell in the given direction.
   *
   * @param dx  Horizontal step: -1 (left), 0, or +1 (right).
   * @param dy  Vertical step:   -1 (up),   0, or +1 (down).
   * @param ctx Current game context containing tile map and entities.
   * @returns   What occupies the target cell. 'move' means free passage.
   */
  tryMove(dx: number, dy: number, ctx: GameContext): MoveResult {
    // Ignore input while an animation is already playing
    if (this.moving) {
      return { type: 'blocked' };
    }

    // Always update facing direction, even if the move itself is blocked
    if (dy < 0)      this.direction = 'up';
    else if (dy > 0) this.direction = 'down';
    else if (dx < 0) this.direction = 'left';
    else if (dx > 0) this.direction = 'right';

    const nx = this.gridX + dx;
    const ny = this.gridY + dy;

    // ── Bounds check ────────────────────────────────────────────────
    if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) {
      return { type: 'wall' };
    }

    // ── Wall check (tile layer) ─────────────────────────────────────
    const tileIndex = ny * GRID_SIZE + nx;
    const tileName = ctx.tileData[tileIndex] ?? '';
    if (WALL_TILES.has(tileName)) {
      return { type: 'wall' };
    }

    // ── Entity check ────────────────────────────────────────────────
    const entity = this.findEntityAt(nx, ny, ctx);
    if (entity) {
      return this.classifyEntity(entity);
    }

    // ── Free tile — begin movement animation ────────────────────────
    this.beginMove(nx, ny);
    return { type: 'move' };
  }

  // ─── Animation Update ─────────────────────────────────────────────

  /**
   * Advance smooth movement interpolation. Call every frame.
   *
   * @param dt  Delta time in seconds since last frame.
   * @returns   true when the move animation completes this frame.
   */
  update(dt: number): boolean {
    if (!this.moving) return false;

    this.moveProgress += this.moveSpeed * dt;

    if (this.moveProgress >= 1) {
      // Snap to target cell
      this.moveProgress = 0;
      this.moving = false;
      this.gridX = this.targetGridX;
      this.gridY = this.targetGridY;
      this.pixelX = this.gridX * TILE_PX;
      this.pixelY = this.gridY * TILE_PX;
      return true; // movement completed this frame
    }

    // Linear interpolation between start and target
    const startX = this.gridX * TILE_PX;
    const startY = this.gridY * TILE_PX;
    const endX = this.targetGridX * TILE_PX;
    const endY = this.targetGridY * TILE_PX;
    this.pixelX = startX + (endX - startX) * this.moveProgress;
    this.pixelY = startY + (endY - startY) * this.moveProgress;

    return false;
  }

  // ─── Render Helpers ───────────────────────────────────────────────

  /** Current pixel X for rendering (interpolated while moving). */
  getRenderX(): number {
    return this.pixelX;
  }

  /** Current pixel Y for rendering (interpolated while moving). */
  getRenderY(): number {
    return this.pixelY;
  }

  // ─── Teleport ─────────────────────────────────────────────────────

  /**
   * Instantly place the player at a new grid position (no animation).
   * Used by stair transitions and the teleporter item.
   */
  teleport(gx: number, gy: number): void {
    this.gridX = gx;
    this.gridY = gy;
    this.targetGridX = gx;
    this.targetGridY = gy;
    this.pixelX = gx * TILE_PX;
    this.pixelY = gy * TILE_PX;
    this.moving = false;
    this.moveProgress = 0;
  }

  // ─── Internal Helpers ─────────────────────────────────────────────

  /** Begin a smooth movement animation toward (nx, ny). */
  private beginMove(nx: number, ny: number): void {
    this.targetGridX = nx;
    this.targetGridY = ny;
    this.moving = true;
    this.moveProgress = 0;
  }

  /**
   * Find the first entity whose bounding area covers the grid cell (gx, gy).
   * Entities may span more than one tile (width/height > 1).
   */
  private findEntityAt(gx: number, gy: number, ctx: GameContext): EntityData | null {
    for (const e of ctx.entities) {
      const w = e.width > 0 ? e.width : 1;
      const h = e.height > 0 ? e.height : 1;
      if (gx >= e.x && gx < e.x + w && gy >= e.y && gy < e.y + h) {
        return e;
      }
    }
    return null;
  }

  /**
   * Determine the interaction type of an entity based on its template name
   * and field values.
   */
  private classifyEntity(entity: EntityData): MoveResult {
    const tpl = (entity.template ?? '').toLowerCase();
    const f = entity.fields ?? {};

    // ── Doors ───────────────────────────────────────────────────────
    if (tpl.startsWith('door_') || tpl.includes('door')) {
      const color = f.color ?? this.inferDoorColor(tpl);
      return { type: 'door', entityId: entity.id, color };
    }

    // ── Monsters ────────────────────────────────────────────────────
    // Match entities that look like monsters (have combat stats or explicit monsterType).
    if (f.monsterType || (f.hp !== undefined && f.atk !== undefined && f.def !== undefined)) {
      const monsterData: MonsterData = {
        monsterType: f.monsterType ?? tpl,
        hp:   f.hp   ?? 0,
        atk:  f.atk  ?? 0,
        def:  f.def  ?? 0,
        gold: f.gold ?? 0,
        exp:  f.exp  ?? 0,
        tags: f.tags ?? '',
        boss: f.boss ?? false,
      };
      return { type: 'monster', entityId: entity.id, data: monsterData };
    }

    // ── Items ───────────────────────────────────────────────────────
    if (f.itemType || tpl.startsWith('item_') || tpl.startsWith('key_') ||
        tpl.startsWith('potion_') || tpl.startsWith('gem_') ||
        tpl.startsWith('equip_') || tpl.startsWith('sword_') ||
        tpl.startsWith('shield_') || tpl.startsWith('special_')) {
      const itemType = f.itemType ?? tpl;
      return { type: 'item', entityId: entity.id, itemType, fields: f };
    }

    // ── Stairs ──────────────────────────────────────────────────────
    if (tpl.startsWith('stair') || tpl.includes('stair') || f.targetFloor !== undefined) {
      return { type: 'stair', entityId: entity.id, fields: f };
    }

    // ── NPCs ────────────────────────────────────────────────────────
    if (tpl.startsWith('npc_') || f.npcType) {
      return {
        type: 'npc',
        entityId: entity.id,
        npcType: f.npcType ?? tpl,
        dialog: f.dialog ?? '',
      };
    }

    // ── Shops ───────────────────────────────────────────────────────
    if (tpl.startsWith('shop') || f.shopType) {
      return { type: 'shop', entityId: entity.id, fields: f };
    }

    // ── Anything else that is presumably solid ──────────────────────
    return { type: 'blocked' };
  }

  /**
   * Infer a door's colour from its template name.
   * Examples: "door_yellow" → "yellow", "door_blue" → "blue".
   */
  private inferDoorColor(template: string): string {
    if (template.includes('yellow')) return 'yellow';
    if (template.includes('blue'))   return 'blue';
    if (template.includes('red'))    return 'red';
    if (template.includes('iron'))   return 'iron';
    return 'yellow'; // fallback
  }
}
