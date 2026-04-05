/**
 * main.ts
 * Main entry point for Magic Tower (魔塔).
 *
 * This is a standalone Canvas2D game that reads mote JSON data files and
 * renders on a 416x416 canvas (13x13 grid, 32px tiles).
 * It does NOT use the mote engine runtime -- it directly reads JSON data files.
 */

// ─── Imports from gameplay scripts ──────────────────────────────────────────

import {
  GameState,
  createInitialState,
  removeEntity,
  isEntityRemoved,
  saveState,
  loadState,
} from '../scripts/game-state';
import {
  MonsterData,
  CombatResult,
  predictDamage,
  executeCombat,
} from '../scripts/combat';
import { handleNpcInteraction, DialogResult } from '../scripts/npc-dialog';
import { getShopOptions, purchaseShopItem, ShopOption } from '../scripts/shop';
import { handleLavaDamage } from '../scripts/lava';
import { handleTeleport, TeleportResult } from '../scripts/teleporter';
import { handleTriggerWall } from '../scripts/trigger-wall';
import {
  firedEvents,
  fireEvent,
  isEventFired,
  handleEventTrigger,
} from '../scripts/event-trigger';
import {
  MonsterBookEntry,
  MONSTER_NAMES,
  getMonsterBookEntries,
} from '../scripts/monster-book';
import { getVisitedFloors, teleportToFloor } from '../scripts/floor-teleport';

// ─── Type Definitions ──────────────────────────────────────────────────────

interface SpriteSheetData {
  id: string;
  image: string;
  imageWidth: number;
  imageHeight: number;
  mode: string; // "grid" | "packed"
  tileWidth?: number;
  tileHeight?: number;
  columns?: number;
  rows?: number;
  frames: Record<string, any>;
}

interface SceneData {
  id: string;
  name: string;
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  layers: SceneLayer[];
}

interface SceneLayer {
  name: string;
  type: string; // "tile" | "entity"
  data?: number[] | string[];  // tile layer: array of tile indices or names
  encoding?: string;           // "index" | "names"
  tilesetId?: string;          // tile layer: which sprite sheet
  spriteSheet?: string;        // alternative to tilesetId
  entities?: SceneEntity[];
}

interface SceneEntity {
  id: string;
  templateId?: string;
  template?: string;  // Alternative field name used in scene files
  x: number; // pixel X (will be converted to grid)
  y: number; // pixel Y (will be converted to grid)
  fields: Record<string, any>;
}

interface ProjectData {
  name: string;
  spriteSheets: string[];
  entities: string[];
  scenes: string[];
  startScene: string;
  tileWidth: number;
  tileHeight: number;
}

interface EntityDef {
  id: string;
  name: string;
  sprite?: string;
  collider?: any;
  fields?: any[];
}

type Direction = 'up' | 'down' | 'left' | 'right';

type MoveResultType =
  | 'move'
  | 'wall'
  | 'door'
  | 'monster'
  | 'item'
  | 'stair'
  | 'npc'
  | 'shop'
  | 'blocked';

interface MoveResult {
  type: MoveResultType;
  entity?: SceneEntity;
}

// ─── Constants ────────────────────────────────────────────────────────────

const GRID_W = 13;
const GRID_H = 13;
const TILE_SIZE = 32; // canvas pixels per tile
const CANVAS_W = GRID_W * TILE_SIZE; // 416
const CANVAS_H = GRID_H * TILE_SIZE; // 416
const MOVE_SPEED = 6; // tiles per second (smooth movement speed)

// ─── Global Game Variables ──────────────────────────────────────────────────

let state: GameState;
let canvas: HTMLCanvasElement;
let ctx: CanvasRenderingContext2D;

// Sprite sheets: id -> data + loaded image
const sheetImages = new Map<string, HTMLImageElement>();
const sheetData = new Map<string, SpriteSheetData>();

// Entity definitions: templateId -> EntityDef
const entityDefs = new Map<string, EntityDef>();

// Current scene
let currentScene: SceneData | null = null;
let tileLayer: SceneLayer | null = null;
let entityLayer: SceneLayer | null = null;

// Project data
let project: ProjectData;

// Player smooth movement
let isMoving = false;
let moveStartX = 0;
let moveStartY = 0;
let moveTargetX = 0;
let moveTargetY = 0;
let moveProgress = 0; // 0..1
let playerPixelX = 0;
let playerPixelY = 0;

// Input and UI state
let inputLocked = false; // lock during dialogs/menus
let pendingDirection: Direction | null = null;

// Dialog state
let dialogOpen = false;

// ─── Image Loading ──────────────────────────────────────────────────────────

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error(`Failed to load image: ${src}`));
    img.src = src;
  });
}

// ─── Sprite Rendering ───────────────────────────────────────────────────────

/**
 * Draw a single frame from a sprite sheet onto the canvas.
 */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  sheetImg: HTMLImageElement,
  sheet: SpriteSheetData,
  frameName: string,
  destX: number,
  destY: number,
  destW: number,
  destH: number
): void {
  const frame = sheet.frames[frameName];
  if (!frame) {
    // Frame not found — draw a magenta placeholder
    ctx.fillStyle = '#FF00FF';
    ctx.fillRect(destX, destY, destW, destH);
    return;
  }

  let srcX: number, srcY: number, srcW: number, srcH: number;

  if (sheet.mode === 'grid') {
    // Grid mode: frame has col, row. Source size is sheet tileWidth/tileHeight.
    const tw = sheet.tileWidth || 16;
    const th = sheet.tileHeight || 16;
    srcX = frame.col * tw;
    srcY = frame.row * th;
    srcW = tw;
    srcH = th;
  } else {
    // Packed mode: frame has x, y, w, h directly.
    srcX = frame.x;
    srcY = frame.y;
    srcW = frame.w;
    srcH = frame.h;
  }

  ctx.drawImage(sheetImg, srcX, srcY, srcW, srcH, destX, destY, destW, destH);
}

/**
 * Draw a frame by looking up the correct sprite sheet by its id.
 */
function drawSpriteFrame(
  ctx: CanvasRenderingContext2D,
  sheetId: string,
  frameName: string,
  destX: number,
  destY: number,
  destW: number = TILE_SIZE,
  destH: number = TILE_SIZE
): void {
  const img = sheetImages.get(sheetId);
  const sheet = sheetData.get(sheetId);
  if (!img || !sheet) return;
  drawFrame(ctx, img, sheet, frameName, destX, destY, destW, destH);
}

// ─── Tile Layer Rendering ───────────────────────────────────────────────────

/**
 * Get the frame name for a tile index from the tower-tiles sprite sheet.
 * The tile data stores indices that map to frame names in order.
 */
function getTileFrameName(tileIndex: number): string | null {
  if (tileIndex < 0) return null;
  const sheet = sheetData.get('tower-tiles');
  if (!sheet) return null;
  const frameNames = Object.keys(sheet.frames);
  if (tileIndex < frameNames.length) {
    return frameNames[tileIndex];
  }
  return null;
}

function renderTileLayer(): void {
  if (!tileLayer || !tileLayer.data) return;
  const sheetId = tileLayer.tilesetId || tileLayer.spriteSheet || 'tower-tiles';
  const encoding = tileLayer.encoding || 'index';

  for (let row = 0; row < GRID_H; row++) {
    for (let col = 0; col < GRID_W; col++) {
      const idx = row * GRID_W + col;
      const tileData = tileLayer.data[idx];
      if (tileData === undefined || tileData === null) continue;

      let frameName: string | null = null;

      if (encoding === 'names') {
        // Data is already frame names (strings)
        frameName = tileData as string;
      } else {
        // Data is numeric indices
        const tileIndex = tileData as number;
        if (tileIndex < 0) continue;
        frameName = getTileFrameName(tileIndex);
      }

      if (!frameName) continue;

      drawSpriteFrame(ctx, sheetId, frameName, col * TILE_SIZE, row * TILE_SIZE);
    }
  }
}

// ─── Entity Rendering ───────────────────────────────────────────────────────

/**
 * Determine which sprite sheet and frame to use for an entity instance.
 */
function getEntitySprite(entity: SceneEntity): { sheetId: string; frameName: string } | null {
  const t = entity.templateId || entity.template || '';
  const f = entity.fields;

  switch (t) {
    case 'monster':
      return { sheetId: 'characters', frameName: f.monsterType || 'slime_green' };
    case 'door':
      return { sheetId: 'tower-tiles', frameName: `door_${f.color || 'yellow'}` };
    case 'key':
      return { sheetId: 'items', frameName: `key_${f.color || 'yellow'}` };
    case 'potion': {
      const amount = f.amount ?? 200;
      return { sheetId: 'items', frameName: amount >= 400 ? 'potion_blue' : 'potion_red' };
    }
    case 'gem': {
      const stat = f.stat || 'atk';
      let gemFrame = 'gem_red';
      if (stat === 'def') gemFrame = 'gem_blue';
      else if (stat === 'hp') gemFrame = 'gem_green';
      return { sheetId: 'items', frameName: gemFrame };
    }
    case 'equipment':
      return { sheetId: 'items', frameName: f.equipId || 'sword_iron' };
    case 'special_item':
      return { sheetId: 'items', frameName: f.specialId || 'monster_book' };
    case 'stair':
      return { sheetId: 'tower-tiles', frameName: `stair_${f.direction || 'up'}` };
    case 'npc':
      return { sheetId: 'characters', frameName: `npc_${f.npcType || 'oldman'}` };
    case 'shop':
      return { sheetId: 'characters', frameName: 'npc_merchant' };
    case 'teleporter':
      return { sheetId: 'tower-tiles', frameName: 'teleport_pad' };
    case 'trigger_wall':
      return { sheetId: 'tower-tiles', frameName: 'wall_gray' };
    case 'lava':
      // Lava is rendered as tile, skip entity rendering
      return null;
    case 'event_trigger':
      // Invisible, no render
      return null;
    case 'player':
      // Player is rendered separately
      return null;
    default:
      return null;
  }
}

function renderEntities(): void {
  if (!entityLayer || !entityLayer.entities) return;
  const sceneId = currentScene?.id || '';

  for (const entity of entityLayer.entities) {
    // Skip removed entities
    if (isEntityRemoved(state, sceneId, entity.id)) continue;

    // Skip player entity (rendered separately)
    if ((entity.templateId || entity.template) === 'player') continue;

    // Check trigger walls: if their event has fired, they may be gone
    if ((entity.templateId || entity.template) === 'trigger_wall') {
      const triggerEvent = entity.fields.triggerEvent || '';
      const disappearOnTrigger = entity.fields.disappearOnTrigger !== false;
      if (triggerEvent && isEventFired(triggerEvent) && disappearOnTrigger) {
        // Mark as removed and skip
        removeEntity(state, sceneId, entity.id);
        continue;
      }
    }

    const sprite = getEntitySprite(entity);
    if (!sprite) continue;

    // Entity coordinates are in pixels, convert to grid for rendering
    const gridX = Math.floor(entity.x / TILE_SIZE);
    const gridY = Math.floor(entity.y / TILE_SIZE);
    const px = gridX * TILE_SIZE;
    const py = gridY * TILE_SIZE;
    drawSpriteFrame(ctx, sprite.sheetId, sprite.frameName, px, py);
  }
}

function renderPlayer(): void {
  const frameName = `player_${state.direction}`;
  drawSpriteFrame(ctx, 'characters', frameName, playerPixelX, playerPixelY);
}

// ─── HUD Update ────────────────────────────────────────────────────────────

function updateHUD(): void {
  const el = (id: string) => document.getElementById(id);
  el('hp')!.textContent = state.hp.toString();
  el('atk')!.textContent = state.atk.toString();
  el('def')!.textContent = state.def.toString();
  el('gold')!.textContent = state.gold.toString();
  el('keys-y')!.textContent = state.yellowKeys.toString();
  el('keys-b')!.textContent = state.blueKeys.toString();
  el('keys-r')!.textContent = state.redKeys.toString();
  el('level')!.textContent = state.level.toString();
  el('floor-label')!.textContent = `${state.floor}F ${currentScene?.name || ''}`;
}

// ─── Dialog System ─────────────────────────────────────────────────────────

function showDialog(
  title: string,
  content: string,
  buttons?: { label: string; action: () => any }[]
): void {
  const overlay = document.getElementById('dialog-overlay')!;
  const box = document.getElementById('dialog-box')!;

  dialogOpen = true;
  inputLocked = true;

  let html = `<h3>${title}</h3><p>${content}</p><div style="margin-top:12px;">`;

  if (buttons && buttons.length > 0) {
    buttons.forEach((btn, i) => {
      html += `<button class="dialog-btn" data-idx="${i}" style="margin:4px 6px;">${btn.label}</button>`;
    });
  } else {
    // Default OK button
    buttons = [{ label: '确定', action: () => {} }];
    html += `<button class="dialog-btn" data-idx="0">确定</button>`;
  }

  html += '</div>';
  box.innerHTML = html;
  overlay.style.display = 'flex';

  // Attach click handlers
  const btnEls = box.querySelectorAll('.dialog-btn');
  btnEls.forEach((btnEl) => {
    btnEl.addEventListener('click', (e) => {
      const idx = parseInt((e.target as HTMLElement).getAttribute('data-idx') || '0');
      closeDialog();
      if (buttons![idx]) {
        buttons![idx].action();
      }
    });
  });
}

function closeDialog(): void {
  const overlay = document.getElementById('dialog-overlay')!;
  overlay.style.display = 'none';
  dialogOpen = false;
  inputLocked = false;
}

// ─── Scene Loading ─────────────────────────────────────────────────────────

async function loadScene(sceneId: string): Promise<void> {
  const url = `/scenes/${sceneId}.map.json`;
  const resp = await fetch(url);
  if (!resp.ok) {
    console.error(`Failed to load scene: ${url} (${resp.status})`);
    return;
  }

  currentScene = await resp.json() as SceneData;
  tileLayer = null;
  entityLayer = null;

  for (const layer of currentScene.layers) {
    if (layer.type === 'tile') {
      tileLayer = layer;
    } else if (layer.type === 'entity') {
      entityLayer = layer;
    }
  }

  // Update state floor number from scene id
  const floorMatch = sceneId.match(/floor-(\d+)/);
  if (floorMatch) {
    state.floor = parseInt(floorMatch[1]);
    state.visitedFloors.add(state.floor);
  }
  state.currentScene = sceneId;

  updateHUD();
}

// ─── Entity Queries ─────────────────────────────────────────────────────────

/**
 * Get all non-removed entities at a specific grid position.
 */
function getEntitiesAt(gx: number, gy: number): SceneEntity[] {
  if (!entityLayer || !entityLayer.entities) return [];
  const sceneId = currentScene?.id || '';

  return entityLayer.entities.filter((e) => {
    // Entity coordinates are in pixels, convert to grid for comparison
    const eGridX = Math.floor(e.x / TILE_SIZE);
    const eGridY = Math.floor(e.y / TILE_SIZE);
    if (eGridX !== gx || eGridY !== gy) return false;
    if (isEntityRemoved(state, sceneId, e.id)) return false;
    // Check trigger walls dynamically
    if ((e.templateId || e.template) === 'trigger_wall') {
      const triggerEvent = e.fields.triggerEvent || '';
      const disappearOnTrigger = e.fields.disappearOnTrigger !== false;
      if (triggerEvent && isEventFired(triggerEvent) && disappearOnTrigger) {
        removeEntity(state, sceneId, e.id);
        return false;
      }
    }
    return true;
  });
}

/**
 * Check if a tile at (gx, gy) is a wall tile (has collision).
 */
function isTileWall(gx: number, gy: number): boolean {
  if (gx < 0 || gx >= GRID_W || gy < 0 || gy >= GRID_H) return true;
  if (!tileLayer || !tileLayer.data) return false;

  const idx = gy * GRID_W + gx;
  const tileData = tileLayer.data[idx];
  if (tileData === undefined || tileData === null) return false;

  let frameName: string | null = null;
  const encoding = tileLayer.encoding || 'index';

  if (encoding === 'names') {
    // Data is already frame names (strings)
    frameName = tileData as string;
  } else {
    // Data is numeric indices
    const tileIndex = tileData as number;
    if (tileIndex < 0) return false;
    frameName = getTileFrameName(tileIndex);
  }

  if (!frameName) return false;

  const sheetId = tileLayer.tilesetId || tileLayer.spriteSheet || 'tower-tiles';
  const sheet = sheetData.get(sheetId);
  if (!sheet) return false;

  const frame = sheet.frames[frameName];
  if (!frame) return false;

  // Check if the frame has a collider defined
  return !!(frame.collider && frame.collider.length > 0);
}

// ─── Move Logic ────────────────────────────────────────────────────────────

/**
 * Try to move the player in a direction. Returns what type of interaction
 * would happen.
 */
function checkMove(dx: number, dy: number): MoveResult {
  const targetX = state.playerX + dx;
  const targetY = state.playerY + dy;

  // Out of bounds
  if (targetX < 0 || targetX >= GRID_W || targetY < 0 || targetY >= GRID_H) {
    return { type: 'wall' };
  }

  // Wall tile check
  if (isTileWall(targetX, targetY)) {
    return { type: 'wall' };
  }

  // Entity check
  const entities = getEntitiesAt(targetX, targetY);

  for (const entity of entities) {
    const template = entity.templateId || entity.template || '';
    switch (template) {
      case 'door':
        return { type: 'door', entity };
      case 'monster':
        return { type: 'monster', entity };
      case 'key':
      case 'potion':
      case 'gem':
      case 'equipment':
      case 'special_item':
        return { type: 'item', entity };
      case 'stair':
        return { type: 'stair', entity };
      case 'npc':
        return { type: 'npc', entity };
      case 'shop':
        return { type: 'shop', entity };
      case 'trigger_wall':
        // Solid wall if still present
        return { type: 'wall', entity };
      // lava, teleporter, event_trigger: passable, handled after move
      case 'lava':
      case 'teleporter':
      case 'event_trigger':
        continue;
      default:
        continue;
    }
  }

  return { type: 'move' };
}

// ─── Interaction Handlers ──────────────────────────────────────────────────

function handleDoorInteraction(entity: SceneEntity): boolean {
  const color = entity.fields.color || 'yellow';
  let hasKey = false;

  switch (color) {
    case 'yellow':
      hasKey = state.yellowKeys > 0;
      if (hasKey) state.yellowKeys--;
      break;
    case 'blue':
      hasKey = state.blueKeys > 0;
      if (hasKey) state.blueKeys--;
      break;
    case 'red':
      hasKey = state.redKeys > 0;
      if (hasKey) state.redKeys--;
      break;
    default:
      return false;
  }

  if (!hasKey) {
    showDialog('提示', `你需要一把${color === 'yellow' ? '黄' : color === 'blue' ? '蓝' : '红'}色钥匙才能打开这扇门。`);
    return false;
  }

  // Remove door entity
  removeEntity(state, currentScene?.id || '', entity.id);
  updateHUD();
  return true;
}

function handleMonsterInteraction(entity: SceneEntity): void {
  const fields = entity.fields;
  const monsterType: string = fields.monsterType || 'slime_green';
  const monsterName = MONSTER_NAMES[monsterType] || monsterType;

  const monster: MonsterData = {
    monsterType,
    hp: fields.hp ?? 50,
    atk: fields.atk ?? 20,
    def: fields.def ?? 1,
    gold: fields.gold ?? 1,
    exp: fields.exp ?? 1,
    boss: fields.boss ?? false,
    tags: fields.tags || '',
  };

  // Predict first
  const predicted = predictDamage(state.atk, state.def, monster);
  if (predicted < 0) {
    showDialog('战斗', `${monsterName}的防御太高了，你无法造成伤害！`);
    return;
  }

  // Execute combat
  const result = executeCombat(state, monster, monsterName);

  if (result.won) {
    removeEntity(state, currentScene?.id || '', entity.id);
    updateHUD();

    const msg = `击败了${monsterName}！<br>` +
      `受到伤害: ${result.damage}<br>` +
      `获得金币: ${result.goldReward}`;
    showDialog('战斗胜利', msg);

    // Start movement to monster's position after dialog
    startSmoothMove(entity.x, entity.y);
  } else {
    updateHUD();
    if (state.hp <= 0) {
      showGameOver();
    } else {
      showDialog('战斗', `你无法击败${monsterName}！预计受到${predicted}点伤害。`);
    }
  }
}

function handleItemPickup(entity: SceneEntity): void {
  const fields = entity.fields;
  const t = entity.templateId || entity.template || '';
  let message = '';

  switch (t) {
    case 'key': {
      const color = fields.color || 'yellow';
      if (color === 'yellow') { state.yellowKeys++; message = '获得黄色钥匙！'; }
      else if (color === 'blue') { state.blueKeys++; message = '获得蓝色钥匙！'; }
      else if (color === 'red') { state.redKeys++; message = '获得红色钥匙！'; }
      break;
    }
    case 'potion': {
      const amount = fields.amount ?? 200;
      state.hp += amount;
      message = `获得药水，HP+${amount}！`;
      break;
    }
    case 'gem': {
      const stat = fields.stat || 'atk';
      const amount = fields.amount ?? 3;
      if (stat === 'atk') { state.atk += amount; message = `获得红宝石，攻击+${amount}！`; }
      else if (stat === 'def') { state.def += amount; message = `获得蓝宝石，防御+${amount}！`; }
      else { state.hp += amount; message = `获得绿宝石，HP+${amount}！`; }
      break;
    }
    case 'equipment': {
      const equipId = fields.equipId || 'sword_iron';
      const stat = fields.stat || 'atk';
      const amount = fields.amount ?? 10;
      if (stat === 'atk') { state.atk += amount; }
      else if (stat === 'def') { state.def += amount; }
      state.equippedItems.add(equipId);
      const equipNames: Record<string, string> = {
        sword_iron: '铁剑', shield_iron: '铁盾',
        sword_holy: '圣剑', shield_holy: '圣盾',
      };
      message = `获得${equipNames[equipId] || equipId}！${stat === 'atk' ? '攻击' : '防御'}+${amount}`;
      break;
    }
    case 'special_item': {
      const specialId = fields.specialId || 'monster_book';
      state.specialItems.add(specialId);
      const itemNames: Record<string, string> = {
        monster_book: '怪物图鉴', teleporter_item: '传送器',
        cross: '十字架', star: '星之碎片',
      };
      message = `获得${itemNames[specialId] || specialId}！`;

      // Check for victory item
      if (specialId === 'star') {
        removeEntity(state, currentScene?.id || '', entity.id);
        updateHUD();
        showVictory();
        return;
      }
      break;
    }
    default:
      message = '拾取了物品。';
  }

  removeEntity(state, currentScene?.id || '', entity.id);
  updateHUD();

  // Show brief pickup message
  showDialog('物品', message);

  // Start movement to the item's position
  startSmoothMove(entity.x, entity.y);
}

async function handleStairInteraction(entity: SceneEntity): Promise<void> {
  const fields = entity.fields;
  const targetFloor = fields.targetFloor || 'floor-1';
  // Target coordinates are in pixels, convert to grid
  const targetX = typeof fields.targetX === 'number' ? Math.floor(fields.targetX / TILE_SIZE) : 6;
  const targetY = typeof fields.targetY === 'number' ? Math.floor(fields.targetY / TILE_SIZE) : 11;

  await loadScene(targetFloor);

  state.playerX = targetX;
  state.playerY = targetY;
  playerPixelX = targetX * TILE_SIZE;
  playerPixelY = targetY * TILE_SIZE;

  updateHUD();
}

function showShopDialog(entity: SceneEntity): void {
  const options = getShopOptions(state, entity.fields);

  const buttons = options.map((opt) => ({
    label: opt.canAfford ? opt.label : `${opt.label} (不足)`,
    action: () => {
      if (opt.canAfford) {
        purchaseShopItem(state, opt);
        updateHUD();
        showDialog('商店', `购买成功！`, [
          { label: '继续购买', action: () => showShopDialog(entity) },
          { label: '离开', action: () => {} },
        ]);
      } else {
        showDialog('商店', '金币不足！', [
          { label: '返回', action: () => showShopDialog(entity) },
        ]);
      }
    },
  }));

  buttons.push({ label: '离开', action: () => {} });

  showDialog('商店', '欢迎光临！请选择购买的物品：', buttons);
}

// ─── Post-Move Checks ──────────────────────────────────────────────────────

async function checkPostMoveEffects(): Promise<void> {
  const entities = getEntitiesAt(state.playerX, state.playerY);
  const sceneId = currentScene?.id || '';

  for (const entity of entities) {
    const template = entity.templateId || entity.template || '';
    switch (template) {
      case 'lava': {
        const damage = entity.fields.damage ?? 100;
        const msg = handleLavaDamage(state, damage);
        updateHUD();
        if (state.hp <= 0) {
          showGameOver();
          return;
        }
        showDialog('岩浆', msg);
        break;
      }
      case 'teleporter': {
        const result = handleTeleport(entity.fields);
        if (result.targetFloor && result.targetFloor !== state.currentScene) {
          await loadScene(result.targetFloor);
          state.playerX = result.targetX;
          state.playerY = result.targetY;
          playerPixelX = result.targetX * TILE_SIZE;
          playerPixelY = result.targetY * TILE_SIZE;
          updateHUD();
        }
        break;
      }
      case 'event_trigger': {
        const msg = handleEventTrigger(state, entity.id, sceneId, entity.fields);
        if (msg) {
          // After firing event, recheck trigger walls on this floor
          // (they may now disappear)
          showDialog('事件', msg);
        }
        break;
      }
    }
  }
}

// ─── Smooth Movement ───────────────────────────────────────────────────────

function startSmoothMove(targetGX: number, targetGY: number): void {
  moveStartX = state.playerX * TILE_SIZE;
  moveStartY = state.playerY * TILE_SIZE;
  moveTargetX = targetGX * TILE_SIZE;
  moveTargetY = targetGY * TILE_SIZE;
  moveProgress = 0;
  isMoving = true;

  state.playerX = targetGX;
  state.playerY = targetGY;
}

// ─── Player Input ──────────────────────────────────────────────────────────

function tryMove(dx: number, dy: number): void {
  if (isMoving || inputLocked || dialogOpen) return;

  // Update facing direction
  if (dx === 0 && dy === -1) state.direction = 'up';
  else if (dx === 0 && dy === 1) state.direction = 'down';
  else if (dx === -1 && dy === 0) state.direction = 'left';
  else if (dx === 1 && dy === 0) state.direction = 'right';

  const result = checkMove(dx, dy);
  const targetX = state.playerX + dx;
  const targetY = state.playerY + dy;

  switch (result.type) {
    case 'move':
      startSmoothMove(targetX, targetY);
      break;

    case 'wall':
      // Do nothing, player stays in place
      break;

    case 'door':
      if (result.entity && handleDoorInteraction(result.entity)) {
        startSmoothMove(targetX, targetY);
      }
      break;

    case 'monster':
      if (result.entity) {
        handleMonsterInteraction(result.entity);
      }
      break;

    case 'item':
      if (result.entity) {
        handleItemPickup(result.entity);
      }
      break;

    case 'stair':
      if (result.entity) {
        handleStairInteraction(result.entity);
      }
      break;

    case 'npc':
      if (result.entity) {
        const npcResult = handleNpcInteraction(
          result.entity.fields.npcType || 'oldman',
          result.entity.fields.dialog || ''
        );
        showDialog(npcResult.npcName, npcResult.message);
      }
      break;

    case 'shop':
      if (result.entity) {
        showShopDialog(result.entity);
      }
      break;
  }
}

// ─── Game Over / Victory ────────────────────────────────────────────────────

function showGameOver(): void {
  showDialog('游戏结束', '你的生命值归零了...', [
    {
      label: '重新开始',
      action: () => {
        restartGame();
      },
    },
  ]);
}

function showVictory(): void {
  showDialog('恭喜通关!', '你成功通关了魔塔！勇者的传说将永远流传！', [
    {
      label: '重新开始',
      action: () => {
        restartGame();
      },
    },
  ]);
}

async function restartGame(): Promise<void> {
  state = createInitialState();
  firedEvents.clear();
  await loadScene('floor-1');
  state.playerX = 6;
  state.playerY = 11;
  playerPixelX = state.playerX * TILE_SIZE;
  playerPixelY = state.playerY * TILE_SIZE;
  updateHUD();
}

// ─── Monster Book UI ────────────────────────────────────────────────────────

function showMonsterBook(): void {
  if (!state.specialItems.has('monster_book')) {
    showDialog('提示', '你还没有获得怪物图鉴。');
    return;
  }

  const entities: { id: string; templateId: string; fields: Record<string, any> }[] = [];
  if (entityLayer && entityLayer.entities) {
    const sceneId = currentScene?.id || '';
    for (const e of entityLayer.entities) {
      if (!isEntityRemoved(state, sceneId, e.id)) {
        entities.push({ id: e.id, templateId: e.templateId || e.template || '', fields: e.fields });
      }
    }
  }

  const entries = getMonsterBookEntries(state, entities);

  if (entries.length === 0) {
    showDialog('怪物图鉴', '本层没有怪物。');
    return;
  }

  let html = '<div style="text-align:left; max-height:280px; overflow-y:auto; font-size:12px;">';
  for (const entry of entries) {
    const dmgStr = entry.predictedDamage === -1
      ? '<span style="color:#F44;">无法击败</span>'
      : `<span style="color:#4F4;">损失HP: ${entry.predictedDamage}</span>`;
    html += `<div style="margin:4px 0; padding:4px; border-bottom:1px solid #444;">`;
    html += `<b style="color:#FFD700;">${entry.name}</b> `;
    html += `HP:${entry.hp} ATK:${entry.atk} DEF:${entry.def} Gold:${entry.gold}<br>`;
    html += dmgStr;
    html += `</div>`;
  }
  html += '</div>';

  showDialog('怪物图鉴', html);
}

// ─── Floor Teleport UI ─────────────────────────────────────────────────────

function showFloorTeleport(): void {
  if (!state.specialItems.has('teleporter_item')) {
    showDialog('提示', '你还没有获得传送器。');
    return;
  }

  const floors = getVisitedFloors(state);
  if (floors.length === 0) {
    showDialog('传送', '没有可传送的楼层。');
    return;
  }

  const buttons: { label: string; action: () => any }[] = floors.map((floorNum) => ({
    label: `${floorNum}F`,
    action: async () => {
      closeDialog();
      const result = teleportToFloor(state, floorNum);
      await loadScene(result.targetFloor);

      // Try to find stair_down position on the target floor
      let foundPos = false;
      if (entityLayer && entityLayer.entities) {
        for (const e of entityLayer.entities) {
          if ((e.templateId || e.template) === 'stair' && e.fields.direction === 'down') {
            // Entity coordinates are in pixels, convert to grid
            state.playerX = Math.floor(e.x / TILE_SIZE);
            state.playerY = Math.floor(e.y / TILE_SIZE);
            foundPos = true;
            break;
          }
        }
        // For floor 1, also try stair_up if no stair_down
        if (!foundPos && floorNum === 1) {
          state.playerX = 6;
          state.playerY = 11;
          foundPos = true;
        }
      }

      if (!foundPos) {
        state.playerX = result.targetX;
        state.playerY = result.targetY;
      }

      playerPixelX = state.playerX * TILE_SIZE;
      playerPixelY = state.playerY * TILE_SIZE;
      updateHUD();
    },
  }));

  buttons.push({ label: '取消', action: () => {} });

  showDialog('楼层传送', '选择要传送到的楼层：', buttons);
}

// ─── Update & Render ──────────────────────────────────────────────────────

function update(dt: number): void {
  if (isMoving) {
    moveProgress += MOVE_SPEED * dt;
    if (moveProgress >= 1) {
      moveProgress = 1;
      isMoving = false;
      playerPixelX = moveTargetX;
      playerPixelY = moveTargetY;

      // Check post-move effects
      checkPostMoveEffects();
    } else {
      // Interpolate position
      playerPixelX = moveStartX + (moveTargetX - moveStartX) * moveProgress;
      playerPixelY = moveStartY + (moveTargetY - moveStartY) * moveProgress;
    }
  }
}

function render(): void {
  // Clear
  ctx.fillStyle = '#111';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // 1. Tile layer
  renderTileLayer();

  // 2. Entities
  renderEntities();

  // 3. Player
  renderPlayer();
}

// ─── Game Loop ─────────────────────────────────────────────────────────────

let lastTime = 0;

function gameLoop(timestamp: number): void {
  const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
  lastTime = timestamp;

  update(dt);
  render();

  requestAnimationFrame(gameLoop);
}

// ─── Input Handling ────────────────────────────────────────────────────────

function setupInput(): void {
  document.addEventListener('keydown', (e) => {
    if (dialogOpen || inputLocked) {
      // If dialog is open, Enter/Space can dismiss it
      if (e.key === 'Enter' || e.key === ' ') {
        const btns = document.querySelectorAll('#dialog-box .dialog-btn');
        if (btns.length === 1) {
          (btns[0] as HTMLElement).click();
        }
      }
      return;
    }

    switch (e.key) {
      case 'ArrowUp':
      case 'w':
      case 'W':
        e.preventDefault();
        tryMove(0, -1);
        break;
      case 'ArrowDown':
      case 's':
      case 'S':
        e.preventDefault();
        tryMove(0, 1);
        break;
      case 'ArrowLeft':
      case 'a':
      case 'A':
        e.preventDefault();
        tryMove(-1, 0);
        break;
      case 'ArrowRight':
      case 'd':
      case 'D':
        e.preventDefault();
        tryMove(1, 0);
        break;
    }
  });
}

// ─── Button Handlers ──────────────────────────────────────────────────────

function setupButtons(): void {
  // Monster Book
  document.getElementById('btn-book')!.addEventListener('click', () => {
    if (!dialogOpen) showMonsterBook();
  });

  // Save
  document.getElementById('btn-save')!.addEventListener('click', () => {
    if (!dialogOpen) {
      saveState(state);
      showDialog('存档', '游戏已保存！');
    }
  });

  // Load
  document.getElementById('btn-load')!.addEventListener('click', () => {
    if (!dialogOpen) {
      const loaded = loadState();
      if (loaded) {
        state = loaded;

        // Restore fired events from any event triggers that were removed
        // (Events persist through save/load via removed entities)
        loadScene(state.currentScene).then(() => {
          playerPixelX = state.playerX * TILE_SIZE;
          playerPixelY = state.playerY * TILE_SIZE;
          updateHUD();
          showDialog('读档', '游戏已加载！');
        });
      } else {
        showDialog('读档', '没有找到存档数据。');
      }
    }
  });

  // Floor Teleport
  document.getElementById('btn-teleport')!.addEventListener('click', () => {
    if (!dialogOpen) showFloorTeleport();
  });
}

// ─── Data Loading ──────────────────────────────────────────────────────────

async function loadProjectData(): Promise<ProjectData> {
  const resp = await fetch('/project.mote.json');
  if (!resp.ok) throw new Error('Failed to load project.mote.json');
  return await resp.json();
}

async function loadSpriteSheet(path: string): Promise<void> {
  const resp = await fetch(`/${path}`);
  if (!resp.ok) throw new Error(`Failed to load sprite sheet: ${path}`);
  const data: SpriteSheetData = await resp.json();

  sheetData.set(data.id, data);

  // Resolve image path relative to the sprite JSON location
  const dir = path.substring(0, path.lastIndexOf('/') + 1);
  const imagePath = data.image.startsWith('../')
    ? data.image.replace('../', '/')
    : `/${dir}${data.image}`;

  const img = await loadImage(imagePath);
  sheetImages.set(data.id, img);
}

async function loadEntityDef(path: string): Promise<void> {
  const resp = await fetch(`/${path}`);
  if (!resp.ok) {
    console.warn(`Failed to load entity def: ${path}`);
    return;
  }
  const def: EntityDef = await resp.json();
  entityDefs.set(def.id, def);
}

// ─── Initialization ────────────────────────────────────────────────────────

async function init(): Promise<void> {
  // Get canvas and context
  canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;

  // Load project data
  project = await loadProjectData();

  // Load all sprite sheets (and their images) in parallel
  await Promise.all(project.spriteSheets.map(loadSpriteSheet));

  // Load all entity definitions in parallel
  await Promise.all(project.entities.map(loadEntityDef));

  // Initialize game state
  state = createInitialState();

  // Load starting scene
  await loadScene(project.startScene);

  // Set player initial position
  // Try to find a player entity in the scene to get starting position
  if (entityLayer && entityLayer.entities) {
    for (const e of entityLayer.entities) {
      if ((e.templateId || e.template) === 'player') {
        // Entity coordinates are in pixels, convert to grid
        state.playerX = Math.floor(e.x / TILE_SIZE);
        state.playerY = Math.floor(e.y / TILE_SIZE);
        state.direction = (e.fields.direction as Direction) || 'down';
        break;
      }
    }
  }

  playerPixelX = state.playerX * TILE_SIZE;
  playerPixelY = state.playerY * TILE_SIZE;

  // Setup input and button handlers
  setupInput();
  setupButtons();

  // Initial HUD update
  updateHUD();

  // Start game loop
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);

  console.log('Magic Tower initialized!');
}

// Start the game
init().catch((err) => {
  console.error('Failed to initialize Magic Tower:', err);
});
