// src/main.ts - Temple Escape entry point
// Uses Canvas2D for rendering (simpler than full WebGPU pipeline for a game jam)
// Still loads mote project format (JSON files) for data

import { GameManager } from '../scripts/game-manager';
import { ChunkLoader } from '../scripts/chunk-loader';

// -- Types for loaded project data ------------------------------------------
interface FrameData { x: number; y: number; w: number; h: number; collider?: any[]; }
interface SpriteSheetData { id: string; name: string; image: HTMLImageElement; frames: Map<string, FrameData>; slicing: any; }
interface EntityDefData { id: string; name: string; sprite?: { sheetId: string; frameId: string }; shape: string; width: number; height: number; collider?: any; fields: any[]; scriptPath?: string; }
interface TileLayerData { id: string; type: 'tile'; visible: boolean; spriteSheet: string; data: string[]; }
interface EntityInstanceData { id: string; template: string; name: string; x: number; y: number; width: number; height: number; fields: Record<string, any>; }
interface EntityLayerData { id: string; type: 'entity'; visible: boolean; entities: EntityInstanceData[]; }
interface SceneData { id: string; width: number; height: number; tileWidth: number; tileHeight: number; layers: (TileLayerData | EntityLayerData)[]; }

// -- Canvas & DOM -----------------------------------------------------------
const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
ctx.imageSmoothingEnabled = false;

const scoreEl = document.getElementById('score-display')!;
const distanceEl = document.getElementById('distance-display')!;
const livesEl = document.getElementById('lives-display')!;
const gameOverEl = document.getElementById('game-over')!;
const finalScoreEl = document.getElementById('final-score')!;
const startScreen = document.getElementById('start-screen')!;
const startBtn = document.getElementById('start-btn')!;
const restartBtn = document.getElementById('restart-btn')!;

// -- Game State -------------------------------------------------------------
const gm = new GameManager();
let spriteSheets = new Map<string, SpriteSheetData>();
let entityDefs = new Map<string, EntityDefData>();
let scenes = new Map<string, SceneData>();

// Player state
let playerX = 40; // center lane (5 tiles x 16px = 80px wide, center = 40)
let playerLane = 1; // 0=left, 1=center, 2=right
let targetLane = 1;
const lanePositions = [24, 40, 56]; // x-center of each lane
const laneSpeed = 300;
let playerJumpVel = 0;
let playerJumpH = 0;
let isJumping = false;
let isSliding = false;
let slideTimer = 0;
let invincible = false;
let invTimer = 0;
let playerAnimTimer = 0;
let playerAnimFrame = 0;

// Chaser
let chaserY = 200; // offset behind player (in pixels, positive = behind)

// Camera
let cameraY = 0; // world Y of the camera center
const SCROLL_SPEED_BASE = 120;

// Chunks
interface ActiveChunk { sceneId: string; worldY: number; heightPx: number; entities: ActiveEntity[]; }
interface ActiveEntity { def: EntityDefData; inst: EntityInstanceData; worldX: number; worldY: number; w: number; h: number; visible: boolean; state: Record<string, any>; }
let activeChunks: ActiveChunk[] = [];
let nextChunkY = 0;
let totalScrolled = 0;

// Input
const keys: Record<string, boolean> = {};
const justPressed: Record<string, boolean> = {};

// -- Input Handling ---------------------------------------------------------
document.addEventListener('keydown', (e) => {
  if (!keys[e.code]) justPressed[e.code] = true;
  keys[e.code] = true;
  if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].includes(e.code)) e.preventDefault();
});
document.addEventListener('keyup', (e) => { keys[e.code] = false; });

// -- Load project -----------------------------------------------------------
async function loadProject() {
  const base = '/';
  const projJson = await fetch(base + 'project.mote.json').then(r => r.json());

  // Load sprite sheets
  for (const path of projJson.spriteSheets) {
    const json = await fetch(base + path).then(r => r.json());
    const img = await loadImage(base + resolvePath(path, json.image));
    const frames = new Map<string, FrameData>();
    for (const [id, f] of Object.entries(json.frames)) frames.set(id, f as FrameData);
    spriteSheets.set(json.id, { id: json.id, name: json.name, image: img, frames, slicing: json.slicing });
  }

  // Load entity defs
  for (const path of projJson.entities) {
    const json = await fetch(base + path).then(r => r.json());
    let sprite: { sheetId: string; frameId: string } | undefined;
    if (json.sprite) {
      const [s, f] = json.sprite.split(':');
      sprite = { sheetId: s, frameId: f };
    }
    entityDefs.set(json.id, { id: json.id, name: json.name, sprite, shape: json.shape, width: json.width, height: json.height, collider: json.collider, fields: json.fields || [], scriptPath: json.script });
  }

  // Load scenes
  for (const path of projJson.scenes) {
    const json = await fetch(base + path).then(r => r.json());
    scenes.set(json.id, json);
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

function resolvePath(fromPath: string, relativePath: string): string {
  const clean = relativePath.replace(/^\.\//, '');
  const dir = fromPath.substring(0, fromPath.lastIndexOf('/') + 1);
  return dir + clean;
}

// -- Chunk Management -------------------------------------------------------
function spawnChunk(sceneId: string) {
  const scene = scenes.get(sceneId);
  if (!scene) return;
  const heightPx = scene.height * scene.tileHeight;
  const worldY = nextChunkY - heightPx;

  // Build active entities from entity layers
  const entities: ActiveEntity[] = [];
  for (const layer of scene.layers) {
    if (layer.type === 'entity') {
      for (const inst of (layer as EntityLayerData).entities) {
        const def = entityDefs.get(inst.template);
        if (!def) continue;
        entities.push({
          def, inst,
          worldX: inst.x + 0, // chunks are always at x=0
          worldY: inst.y + worldY,
          w: inst.width || def.width,
          h: inst.height || def.height,
          visible: true,
          state: {},
        });
      }
    }
  }

  activeChunks.push({ sceneId, worldY, heightPx, entities });
  nextChunkY = worldY;
}

function pickNextChunk(): string {
  const pool = ['chunk-straight-easy', 'chunk-medium', 'chunk-turn-left', 'chunk-turn-right'];
  if (gm.difficultyLevel >= 3) pool.push('chunk-hard', 'chunk-hard');
  if (gm.difficultyLevel >= 2) pool.push('chunk-medium');
  return pool[Math.floor(Math.random() * pool.length)];
}

// -- Update -----------------------------------------------------------------
function update(dt: number) {
  if (gm.gameOver || gm.paused) return;

  gm.update(dt);

  // Scroll camera
  cameraY -= gm.speed * dt;
  totalScrolled += gm.speed * dt;

  // Spawn chunks ahead of camera
  while (nextChunkY > cameraY - canvas.height) {
    spawnChunk(pickNextChunk());
  }

  // Unload chunks behind
  activeChunks = activeChunks.filter(c => c.worldY + c.heightPx > cameraY - canvas.height * 0.5);

  // Player lane switching
  if (justPressed['ArrowLeft'] || justPressed['KeyA']) {
    if (targetLane > 0) targetLane--;
  }
  if (justPressed['ArrowRight'] || justPressed['KeyD']) {
    if (targetLane < 2) targetLane++;
  }

  // Smooth lane movement
  const tx = lanePositions[targetLane];
  const dx = tx - playerX;
  if (Math.abs(dx) > 1) {
    playerX += Math.sign(dx) * laneSpeed * dt;
    if (Math.abs(playerX - tx) < 2) { playerX = tx; playerLane = targetLane; }
  } else {
    playerX = tx; playerLane = targetLane;
  }

  // Jump
  if ((justPressed['Space'] || justPressed['ArrowUp'] || justPressed['KeyW']) && !isJumping && !isSliding) {
    isJumping = true;
    playerJumpVel = -280;
  }
  if (isJumping) {
    playerJumpH += playerJumpVel * dt;
    playerJumpVel += 800 * dt;
    if (playerJumpH >= 0) { playerJumpH = 0; playerJumpVel = 0; isJumping = false; }
  }

  // Slide
  if ((justPressed['KeyS'] || justPressed['ArrowDown']) && !isJumping && !isSliding) {
    isSliding = true;
    slideTimer = 0.5;
  }
  if (isSliding) {
    slideTimer -= dt;
    if (slideTimer <= 0) isSliding = false;
  }

  // Invincibility
  if (invincible) {
    invTimer -= dt;
    if (invTimer <= 0) invincible = false;
  }

  // Player world Y = camera Y + offset (player is always at fixed screen position)
  const playerWorldY = cameraY + 80; // 80px below camera center

  // Collision detection with entities
  const playerBounds = { x: playerX - 6, y: playerWorldY + playerJumpH - 12, w: 12, h: 24 };

  for (const chunk of activeChunks) {
    for (const ent of chunk.entities) {
      if (!ent.visible) continue;

      const entBounds = { x: ent.worldX - ent.w/2, y: ent.worldY - ent.h/2, w: ent.w, h: ent.h };

      // Simple AABB test
      if (aabbOverlap(playerBounds, entBounds)) {
        handleCollision(ent, chunk);
      }
    }
  }

  // Chaser distance management
  chaserY = Math.max(16, chaserY - 2 * dt); // slowly catches up
  if (chaserY <= 20) {
    gm.gameOver = true;
  }

  // Animation
  playerAnimTimer += dt;
  if (playerAnimTimer > 0.1) {
    playerAnimTimer = 0;
    playerAnimFrame = (playerAnimFrame + 1) % 4;
  }

  // Clear just-pressed
  for (const k in justPressed) justPressed[k] = false;
}

function aabbOverlap(a: {x:number,y:number,w:number,h:number}, b: {x:number,y:number,w:number,h:number}): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function handleCollision(ent: ActiveEntity, _chunk: ActiveChunk) {
  if (invincible && ent.def.id !== 'gem' && ent.def.id !== 'speed_boost') return;

  switch (ent.def.id) {
    case 'gem':
      if (!ent.state.collected) {
        ent.state.collected = true;
        ent.visible = false;
        const val = (ent.inst.fields.value as number) || 10;
        gm.addScore(val);
      }
      break;
    case 'speed_boost':
      if (!ent.state.collected) {
        ent.state.collected = true;
        ent.visible = false;
        gm.speed *= 1.5;
        setTimeout(() => { gm.speed /= 1.5; }, 3000);
      }
      break;
    case 'spike_trap':
    case 'fire_trap':
      if (!invincible) {
        hitPlayer();
      }
      break;
    case 'stone_pillar':
      if (!invincible && !isJumping) {
        hitPlayer();
      }
      break;
    case 'collapse_floor':
      if (ent.state.state !== 'collapsed') {
        ent.state.state = 'crumbling';
        ent.state.timer = 0;
      }
      break;
  }
}

function hitPlayer() {
  invincible = true;
  invTimer = 1.5;
  gm.hitObstacle();
  chaserY = Math.max(16, chaserY - 40); // chaser gains ground
  gm.loseLife();
  // Screen shake effect
  shakeTimer = 0.3;
  shakeIntensity = 4;
}

let shakeTimer = 0;
let shakeIntensity = 0;

// -- Render -----------------------------------------------------------------
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Background
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Calculate camera offset with shake
  let shakeDx = 0, shakeDy = 0;
  if (shakeTimer > 0) {
    shakeDx = (Math.random() * 2 - 1) * shakeIntensity;
    shakeDy = (Math.random() * 2 - 1) * shakeIntensity;
    shakeTimer -= 1/60;
  }

  // Scale: game runs at 80px wide (5 tiles x 16px), canvas is 320px -> scale 4x
  const scale = canvas.width / 80;
  ctx.save();
  ctx.translate(shakeDx, shakeDy);
  ctx.scale(scale, scale);

  // Camera transform: game world Y scrolls, translate so cameraY is at top
  const camTop = cameraY - canvas.height / scale / 2;
  ctx.translate(0, -camTop);

  // Render chunks
  for (const chunk of activeChunks) {
    renderChunk(chunk, camTop, camTop + canvas.height / scale);
  }

  // Render player
  const playerWorldY = cameraY + 80 / scale;
  renderPlayer(playerWorldY);

  // Render chaser
  renderChaser(playerWorldY + chaserY / scale);

  ctx.restore();

  // UI updates
  scoreEl.textContent = 'Score: ' + gm.score;
  distanceEl.textContent = Math.floor(totalScrolled / 16) + 'm';
  livesEl.textContent = '\u2665'.repeat(Math.max(0, gm.lives));

  if (gm.gameOver) {
    gameOverEl.style.display = 'block';
    finalScoreEl.textContent = 'Score: ' + gm.score + ' | Distance: ' + Math.floor(totalScrolled/16) + 'm';
  }
}

function renderChunk(chunk: ActiveChunk, viewTop: number, viewBottom: number) {
  const scene = scenes.get(chunk.sceneId);
  if (!scene) return;

  const tw = scene.tileWidth;
  const th = scene.tileHeight;

  for (const layer of scene.layers) {
    if (layer.type === 'tile') {
      const tl = layer as TileLayerData;
      if (!tl.visible) continue;
      const sheet = spriteSheets.get(tl.spriteSheet);
      if (!sheet) continue;

      for (let y = 0; y < scene.height; y++) {
        const worldY = chunk.worldY + y * th;
        if (worldY + th < viewTop || worldY > viewBottom) continue; // cull

        for (let x = 0; x < scene.width; x++) {
          const frameId = tl.data[y * scene.width + x];
          if (!frameId) continue;
          const frame = sheet.frames.get(frameId);
          if (!frame) continue;

          ctx.drawImage(
            sheet.image,
            frame.x, frame.y, frame.w, frame.h,
            x * tw, worldY, tw, th
          );
        }
      }
    }
  }

  // Render entities
  for (const ent of chunk.entities) {
    if (!ent.visible) continue;

    // Check if in view
    if (ent.worldY + ent.h < viewTop || ent.worldY - ent.h > viewBottom) continue;

    if (ent.def.sprite) {
      const sheet = spriteSheets.get(ent.def.sprite.sheetId);
      const frame = sheet?.frames.get(ent.def.sprite.frameId);
      if (sheet && frame) {
        ctx.drawImage(
          sheet.image,
          frame.x, frame.y, frame.w, frame.h,
          ent.worldX - ent.w/2, ent.worldY - ent.h/2, ent.w, ent.h
        );
      }
    } else {
      // Fallback: draw colored rect for entities without sprites
      ctx.fillStyle = '#FF00FF44';
      ctx.fillRect(ent.worldX - ent.w/2, ent.worldY - ent.h/2, ent.w, ent.h);
    }
  }
}

function renderPlayer(worldY: number) {
  // Flash when invincible
  if (invincible && Math.floor(invTimer * 10) % 2 === 0) return;

  const sheet = spriteSheets.get('characters');
  if (!sheet) {
    // Fallback
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(playerX - 8, worldY + playerJumpH / 4 - 12, 16, 24);
    return;
  }

  // Pick frame based on state
  let frameId = 'player_idle';
  if (isJumping) frameId = 'player_jump';
  else if (isSliding) frameId = 'player_slide';
  else {
    const runFrames = ['player_run_1', 'player_run_2', 'player_run_3', 'player_run_2'];
    frameId = runFrames[playerAnimFrame % runFrames.length];
  }

  const frame = sheet.frames.get(frameId);
  if (frame) {
    const drawH = isSliding ? 12 : 24;
    const drawY = isSliding ? worldY + playerJumpH / 4 : worldY + playerJumpH / 4 - 12;
    ctx.drawImage(sheet.image, frame.x, frame.y, frame.w, frame.h, playerX - 8, drawY, 16, drawH);
  } else {
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(playerX - 8, worldY + playerJumpH / 4 - 12, 16, 24);
  }
}

function renderChaser(worldY: number) {
  const sheet = spriteSheets.get('characters');
  if (!sheet) {
    ctx.fillStyle = '#e94560';
    ctx.fillRect(playerX - 10, worldY - 12, 20, 24);
    return;
  }

  const runFrames = ['chaser_run_1', 'chaser_run_2', 'chaser_run_3', 'chaser_run_2'];
  const frameId = runFrames[playerAnimFrame % runFrames.length];
  const frame = sheet.frames.get(frameId);
  if (frame) {
    ctx.drawImage(sheet.image, frame.x, frame.y, frame.w, frame.h, playerX - 10, worldY - 12, 20, 24);
  } else {
    ctx.fillStyle = '#e94560';
    ctx.fillRect(playerX - 10, worldY - 12, 20, 24);
  }
}

// -- Game Loop --------------------------------------------------------------
let lastTime = 0;
let running = false;

function gameLoop(now: number) {
  if (!running) return;

  let dt = (now - lastTime) / 1000;
  lastTime = now;
  if (dt > 0.2) dt = 0.2;

  update(dt);
  render();

  requestAnimationFrame(gameLoop);
}

function startGame() {
  startScreen.style.display = 'none';
  gameOverEl.style.display = 'none';
  gm.reset();
  playerX = 40; playerLane = 1; targetLane = 1;
  playerJumpH = 0; playerJumpVel = 0; isJumping = false;
  isSliding = false; slideTimer = 0;
  invincible = false; invTimer = 0;
  chaserY = 200; cameraY = 0; totalScrolled = 0;
  activeChunks = []; nextChunkY = 0;

  // Spawn initial chunks
  spawnChunk('chunk-straight-easy');
  spawnChunk('chunk-straight-easy');
  spawnChunk('chunk-medium');

  running = true;
  lastTime = performance.now();
  requestAnimationFrame(gameLoop);
}

// -- Init -------------------------------------------------------------------
startBtn.addEventListener('click', async () => {
  startBtn.textContent = 'Loading...';
  (startBtn as HTMLButtonElement).disabled = true;
  await loadProject();
  startGame();
});

restartBtn.addEventListener('click', () => {
  gm.reset();
  startGame();
});
