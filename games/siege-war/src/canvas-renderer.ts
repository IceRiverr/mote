/**
 * canvas-renderer.ts — Multi-layer Canvas2D renderer with camera-aware
 * viewport culling and view-mode switching for Siege War.
 *
 * Supports three view modes:
 *   - 'ground':      standard battlefield view (ground + wall + entities)
 *   - 'underground': tunnel view (underground tiles + translucent ground overlay)
 *   - 'overlay':     combined translucent view of all layers
 *
 * Rendering pipeline per frame:
 *   1. Clear canvas
 *   2. Apply camera transform (translate + scale)
 *   3. Draw tile layers + entities based on viewMode
 *   4. Always: projectiles + effects
 *   5. Reset transform -> render HUD (screen-space)
 */

import type { SpriteSheetRuntime, FrameRuntime, TileLayerRuntime } from '@mote/engine';
import type { Entity } from '@mote/engine';
import type { Canvas2DAssets } from './canvas-loader';
import type { BattlefieldCamera } from './battlefield-camera';
import type { PotSignal, SuspiciousArea } from './listening-pot-system';

// ── Public types ────────────────────────────────────────────────────────────

export type ViewMode = 'ground' | 'underground' | 'overlay';

export interface ProjectileState {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  sheetId: string;
  frameId: string;
  type: string;              // 'arrow' | 'fire_arrow' | 'stone' | 'bolt'
  trail?: Array<{ x: number; y: number; alpha: number }>;
}

export interface EffectState {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  sheetId: string;
  frameId: string;
  alpha: number;
  scale: number;
  elapsed: number;
  duration: number;
}

export interface WallSegmentRender {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  hp: number;
  maxHp: number;
  segmentType: string;
  onFire: boolean;
}

export interface UIState {
  resources: { gold: number; wood: number; stone: number; oil: number };
  morale: { defender: number; attacker: number };
  round: number;
  maxRounds: number;
  phase: string;
  gameSpeed: number;
  paused: boolean;
  side: 'attacker' | 'defender';
}

export interface GameRenderState {
  messengerQueue: Array<{ id: string; progress: number; totalDelay: number; commandType: string }>;
  eventLog: Array<{ message: string; type: 'info' | 'warning' | 'success'; timestamp: number }>;
}

export interface RenderState {
  viewMode: ViewMode;
  entities: Entity[];
  projectiles: ProjectileState[];
  effects: EffectState[];
  tunnelEntities: Entity[];
  potSignals: PotSignal[];
  suspiciousAreas: SuspiciousArea[];
  wallSegments: WallSegmentRender[];
  uiState: UIState;
  gameState: GameRenderState;
  /** Tile layer data arrays keyed by layer name */
  tileLayers: {
    underground?: TileLayerRuntime;
    ground?: TileLayerRuntime;
    wall?: TileLayerRuntime;
  };
  mapCols: number;
  mapRows: number;
  tileW: number;
  tileH: number;
}

// ── SiegeRenderer ───────────────────────────────────────────────────────────

export class SiegeRenderer {
  private ctx: CanvasRenderingContext2D;
  private camera: BattlefieldCamera;
  private assets: Canvas2DAssets;
  private spriteSheets: Map<string, SpriteSheetRuntime>;
  private canvasW: number;
  private canvasH: number;

  constructor(
    ctx: CanvasRenderingContext2D,
    camera: BattlefieldCamera,
    assets: Canvas2DAssets,
    sheets: Map<string, SpriteSheetRuntime>,
  ) {
    this.ctx = ctx;
    this.camera = camera;
    this.assets = assets;
    this.spriteSheets = sheets;
    this.canvasW = ctx.canvas.width;
    this.canvasH = ctx.canvas.height;
  }

  // ── Main entry ──────────────────────────────────────────────────────────

  renderFrame(state: RenderState): void {
    const { ctx } = this;

    // 1. Clear
    ctx.fillStyle = '#0d0d1a';
    ctx.fillRect(0, 0, this.canvasW, this.canvasH);

    // 2. Apply camera transform
    ctx.save();
    const zoom = this.camera.zoom;
    const camX = this.camera.x;
    const camY = this.camera.y;
    ctx.scale(zoom, zoom);
    ctx.translate(-camX, -camY);

    // 3. Render layers based on viewMode
    switch (state.viewMode) {
      case 'ground':
        this.renderTileLayer(state.tileLayers.ground, state, 1.0);
        this.renderTileLayer(state.tileLayers.wall, state, 1.0);
        this.renderEntities(state.entities, 1.0);
        this.renderWallHP(state.wallSegments);
        break;

      case 'underground':
        this.renderTileLayer(state.tileLayers.underground, state, 1.0);
        this.renderTileLayer(state.tileLayers.ground, state, 0.3);
        this.renderEntities(state.tunnelEntities, 1.0);
        this.renderPotSignals(state.potSignals);
        this.renderSuspiciousAreas(state.suspiciousAreas);
        break;

      case 'overlay':
        this.renderTileLayer(state.tileLayers.underground, state, 0.5);
        this.renderTileLayer(state.tileLayers.ground, state, 0.7);
        this.renderTileLayer(state.tileLayers.wall, state, 0.7);
        this.renderEntities(state.entities, 0.7);
        this.renderEntities(state.tunnelEntities, 0.8);
        this.renderWallHP(state.wallSegments);
        this.renderPotSignals(state.potSignals);
        this.renderSuspiciousAreas(state.suspiciousAreas);
        break;
    }

    // 4. Always render projectiles + effects (in world-space)
    this.renderProjectiles(state.projectiles);
    this.renderEffects(state.effects);

    // 5. Restore transform for HUD (screen-space)
    ctx.restore();

    // 6. Render HUD overlay
    this.renderHUD(state.uiState, state.gameState);
  }

  // ── Tile layer rendering (with camera culling) ──────────────────────────

  private renderTileLayer(
    layer: TileLayerRuntime | undefined,
    state: RenderState,
    alpha: number,
  ): void {
    if (!layer) return;
    const { ctx } = this;
    const { mapCols, mapRows, tileW, tileH } = state;

    const sheet = this.spriteSheets.get(layer.spriteSheet);
    if (!sheet) return;
    const img = this.assets.images.get(layer.spriteSheet);
    if (!img) return;

    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha;

    // Visible tile range from camera
    const camX = this.camera.x;
    const camY = this.camera.y;
    const vpW = this.canvasW / this.camera.zoom;
    const vpH = this.canvasH / this.camera.zoom;

    const startCol = Math.max(0, Math.floor(camX / tileW));
    const startRow = Math.max(0, Math.floor(camY / tileH));
    const endCol = Math.min(mapCols - 1, Math.floor((camX + vpW) / tileW));
    const endRow = Math.min(mapRows - 1, Math.floor((camY + vpH) / tileH));

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        const idx = row * mapCols + col;
        const frameId = layer.data[idx];
        if (!frameId || frameId === '') continue;

        const frame = sheet.frames.get(frameId);
        if (!frame) continue;

        ctx.drawImage(
          img,
          frame.x, frame.y, frame.w, frame.h,
          col * tileW, row * tileH, tileW, tileH,
        );
      }
    }

    ctx.globalAlpha = prevAlpha;
  }

  // ── Entity rendering (Y-sorted) ────────────────────────────────────────

  private renderEntities(entities: Entity[], alpha: number): void {
    if (!entities || entities.length === 0) return;
    const { ctx } = this;

    // Visibility culling bounds
    const camX = this.camera.x;
    const camY = this.camera.y;
    const vpW = this.canvasW / this.camera.zoom;
    const vpH = this.canvasH / this.camera.zoom;

    // Filter visible and Y-sort
    const visible = entities.filter((e) => {
      if (!e.visible) return false;
      return (
        e.x + e.width > camX &&
        e.x < camX + vpW &&
        e.y + e.height > camY &&
        e.y < camY + vpH
      );
    });

    visible.sort((a, b) => (a.y + a.height) - (b.y + b.height));

    const prevAlpha = ctx.globalAlpha;
    ctx.globalAlpha = alpha;

    for (const entity of visible) {
      const frameData = entity.getCurrentFrame();
      if (!frameData) continue;

      const img = this.assets.images.get(frameData.sheet.id);
      if (!img) continue;

      const frame = frameData.frame;
      ctx.drawImage(
        img,
        frame.x, frame.y, frame.w, frame.h,
        Math.round(entity.x), Math.round(entity.y),
        entity.width, entity.height,
      );
    }

    ctx.globalAlpha = prevAlpha;
  }

  // ── Projectile rendering (with rotation + trail) ────────────────────────

  private renderProjectiles(projectiles: ProjectileState[]): void {
    if (!projectiles || projectiles.length === 0) return;
    const { ctx } = this;

    for (const p of projectiles) {
      // Trail for fire arrows
      if (p.type === 'fire_arrow' && p.trail && p.trail.length > 0) {
        for (const pt of p.trail) {
          ctx.save();
          ctx.globalAlpha = pt.alpha * 0.6;
          ctx.fillStyle = '#ff6600';
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 2, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      }

      // Rotated sprite
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);

      const drawn = this.drawSprite(
        p.sheetId, p.frameId,
        -p.width / 2, -p.height / 2,
        p.width, p.height,
      );

      // Fallback if sprite not found: draw a simple shape
      if (!drawn) {
        ctx.fillStyle = p.type === 'fire_arrow' ? '#ff4400' :
                        p.type === 'stone' ? '#888' : '#c0a060';
        ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
      }

      ctx.restore();
    }
  }

  // ── Effect rendering (animated, alpha + scale) ──────────────────────────

  private renderEffects(effects: EffectState[]): void {
    if (!effects || effects.length === 0) return;
    const { ctx } = this;

    for (const eff of effects) {
      const lifeRatio = eff.duration > 0 ? eff.elapsed / eff.duration : 0;
      const alpha = eff.alpha * (1 - lifeRatio * 0.5); // fade over lifetime
      const scale = eff.scale + lifeRatio * 0.3;       // grow slightly

      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
      ctx.translate(eff.x + eff.width / 2, eff.y + eff.height / 2);
      ctx.scale(scale, scale);

      const drawn = this.drawSprite(
        eff.sheetId, eff.frameId,
        -eff.width / 2, -eff.height / 2,
        eff.width, eff.height,
      );

      if (!drawn) {
        // Fallback: orange glow circle
        ctx.fillStyle = 'rgba(255, 120, 0, 0.5)';
        ctx.beginPath();
        ctx.arc(0, 0, eff.width / 2, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.restore();
    }
  }

  // ── Wall HP bars ────────────────────────────────────────────────────────

  private renderWallHP(segments: WallSegmentRender[]): void {
    if (!segments || segments.length === 0) return;
    const { ctx } = this;

    for (const seg of segments) {
      const ratio = seg.maxHp > 0 ? seg.hp / seg.maxHp : 0;
      const barWidth = seg.width;
      const barHeight = 4;
      const barX = seg.x;
      const barY = seg.y - 10;

      // Background
      ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
      ctx.fillRect(barX, barY, barWidth, barHeight);

      // HP fill (color-coded)
      if (ratio > 0.6) {
        ctx.fillStyle = '#4CAF50'; // green
      } else if (ratio > 0.3) {
        ctx.fillStyle = '#FF9800'; // orange
      } else {
        ctx.fillStyle = '#F44336'; // red
      }
      ctx.fillRect(barX, barY, barWidth * Math.max(0, ratio), barHeight);

      // Border
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, barY, barWidth, barHeight);

      // Fire indicator
      if (seg.onFire) {
        ctx.fillStyle = 'rgba(255, 80, 0, 0.4)';
        ctx.fillRect(seg.x, seg.y, seg.width, seg.height);
      }

      // Segment label
      ctx.fillStyle = '#ffffff';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(seg.id, seg.x + seg.width / 2, barY - 1);
    }
  }

  // ── Listening pot signals (fan shapes) ──────────────────────────────────

  private renderPotSignals(signals: PotSignal[]): void {
    if (!signals || signals.length === 0) return;
    const { ctx } = this;

    for (const sig of signals) {
      if (!sig.active || sig.intensity === 0) continue;

      const radius = sig.intensity * 60; // intensity level -> radius
      const halfArc = Math.PI / 8;       // 22.5 degrees = 45 degree sector

      ctx.save();
      ctx.globalAlpha = 0.25;
      ctx.fillStyle = '#4FC3F7';
      ctx.beginPath();
      ctx.moveTo(sig.potX, sig.potY);
      ctx.arc(
        sig.potX, sig.potY, radius,
        sig.direction - halfArc,
        sig.direction + halfArc,
      );
      ctx.closePath();
      ctx.fill();

      // Signal center dot
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = '#81D4FA';
      ctx.beginPath();
      ctx.arc(sig.potX, sig.potY, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();
    }
  }

  // ── Suspicious areas ────────────────────────────────────────────────────

  private renderSuspiciousAreas(areas: SuspiciousArea[]): void {
    if (!areas || areas.length === 0) return;
    const { ctx } = this;

    for (const area of areas) {
      // Color by confidence level
      let color: string;
      if (area.confidence >= 80) {
        color = 'rgba(244, 67, 54, 0.35)';   // high: red
      } else if (area.confidence >= 50) {
        color = 'rgba(255, 152, 0, 0.3)';    // medium: orange
      } else if (area.confidence >= 20) {
        color = 'rgba(255, 235, 59, 0.25)';  // low: yellow
      } else {
        color = 'rgba(156, 204, 101, 0.2)';  // very low: light green
      }

      ctx.fillStyle = color;
      ctx.fillRect(area.bounds.x, area.bounds.y, area.bounds.w, area.bounds.h);

      // Dashed border
      ctx.save();
      ctx.strokeStyle = color.replace(/[\d.]+\)$/, '0.7)');
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(area.bounds.x, area.bounds.y, area.bounds.w, area.bounds.h);
      ctx.setLineDash([]);
      ctx.restore();

      // Confidence label
      ctx.fillStyle = '#ffffff';
      ctx.font = '8px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillText(
        `${Math.round(area.confidence)}%`,
        area.bounds.x + area.bounds.w / 2,
        area.bounds.y + 2,
      );
    }
  }

  // ── HUD rendering (screen-space, not camera-affected) ──────────────────

  private renderHUD(uiState: UIState, gameState: GameRenderState): void {
    const { ctx } = this;
    const W = this.canvasW;

    // ── Top resource bar ────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(26, 26, 46, 0.85)';
    ctx.fillRect(0, 0, W, 32);

    ctx.font = '12px monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';

    const res = uiState.resources;
    const items = [
      { label: 'Au', val: res.gold, color: '#c4a35a' },
      { label: 'Wd', val: res.wood, color: '#8B6914' },
      { label: 'St', val: res.stone, color: '#9E9E9E' },
      { label: 'Oil', val: res.oil, color: '#4a2800' },
    ];

    let xOff = 8;
    for (const item of items) {
      ctx.fillStyle = item.color;
      ctx.fillRect(xOff, 8, 10, 16);
      ctx.fillStyle = '#e0e0e0';
      ctx.fillText(`${item.label}:${item.val}`, xOff + 14, 16);
      xOff += 100;
    }

    // Morale bars
    const moraleBarW = 80;
    const myMorale = uiState.side === 'defender'
      ? uiState.morale.defender
      : uiState.morale.attacker;
    const enemyMorale = uiState.side === 'defender'
      ? uiState.morale.attacker
      : uiState.morale.defender;

    xOff = W - 320;
    // My morale
    ctx.fillStyle = '#e0e0e0';
    ctx.fillText('Morale:', xOff, 16);
    xOff += 55;

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(xOff, 8, moraleBarW, 16);
    ctx.fillStyle = myMorale > 60 ? '#4CAF50' : myMorale > 30 ? '#FF9800' : '#F44336';
    ctx.fillRect(xOff, 8, moraleBarW * (myMorale / 100), 16);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.lineWidth = 1;
    ctx.strokeRect(xOff, 8, moraleBarW, 16);

    // Enemy morale
    xOff += moraleBarW + 10;
    ctx.fillStyle = '#e0e0e0';
    ctx.fillText('Enemy:', xOff, 16);
    xOff += 50;
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(xOff, 8, moraleBarW, 16);
    ctx.fillStyle = '#B71C1C';
    ctx.fillRect(xOff, 8, moraleBarW * (enemyMorale / 100), 16);
    ctx.strokeStyle = 'rgba(255,255,255,0.3)';
    ctx.strokeRect(xOff, 8, moraleBarW, 16);

    // Round + phase info (right)
    ctx.fillStyle = '#c4a35a';
    ctx.textAlign = 'right';
    ctx.fillText(
      `R${uiState.round}/${uiState.maxRounds}  ${uiState.phase}`,
      W - 8, 16,
    );

    // Speed / pause indicator
    ctx.textAlign = 'right';
    ctx.fillStyle = uiState.paused ? '#F44336' : '#e0e0e0';
    const speedLabel = uiState.paused ? 'PAUSED' : `x${uiState.gameSpeed.toFixed(1)}`;
    ctx.fillText(speedLabel, W - 8, 28);

    // ── Messenger queue ─────────────────────────────────────────────────
    this.renderMessengerQueue(gameState.messengerQueue);

    // ── Event log ───────────────────────────────────────────────────────
    this.renderEventLog(gameState.eventLog);
  }

  // ── Messenger queue (small icons with progress bars) ────────────────────

  private renderMessengerQueue(
    queue: Array<{ id: string; progress: number; totalDelay: number; commandType: string }>,
  ): void {
    if (!queue || queue.length === 0) return;
    const { ctx } = this;

    const startX = 8;
    const startY = 38;
    const itemH = 18;
    const barW = 60;

    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const maxShow = Math.min(queue.length, 5);
    for (let i = 0; i < maxShow; i++) {
      const item = queue[i];
      const y = startY + i * itemH;

      // Messenger icon (small running figure placeholder)
      ctx.fillStyle = '#c4a35a';
      ctx.fillRect(startX, y, 8, 12);

      // Command type label
      ctx.fillStyle = '#b0b0b0';
      ctx.fillText(item.commandType.substring(0, 8), startX + 12, y + 6);

      // Progress bar
      const barX = startX + 80;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(barX, y + 2, barW, 8);
      const progress = Math.max(0, Math.min(1, item.progress));
      ctx.fillStyle = '#4FC3F7';
      ctx.fillRect(barX, y + 2, barW * progress, 8);
      ctx.strokeStyle = 'rgba(255,255,255,0.2)';
      ctx.lineWidth = 1;
      ctx.strokeRect(barX, y + 2, barW, 8);
    }
  }

  // ── Event log (bottom of screen) ────────────────────────────────────────

  private renderEventLog(
    events: Array<{ message: string; type: 'info' | 'warning' | 'success'; timestamp: number }>,
  ): void {
    if (!events || events.length === 0) return;
    const { ctx } = this;
    const H = this.canvasH;

    const maxShow = Math.min(events.length, 5);
    const lineH = 16;
    const startY = H - maxShow * lineH - 4;

    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    // Semi-transparent background
    ctx.fillStyle = 'rgba(13, 13, 26, 0.7)';
    ctx.fillRect(0, startY - 2, 400, maxShow * lineH + 6);

    for (let i = 0; i < maxShow; i++) {
      // Show most recent at the bottom
      const evt = events[events.length - maxShow + i];
      const y = startY + i * lineH;

      // Fade older entries
      const fadeAlpha = 0.5 + 0.5 * (i / maxShow);
      ctx.globalAlpha = fadeAlpha;

      switch (evt.type) {
        case 'warning': ctx.fillStyle = '#FF9800'; break;
        case 'success': ctx.fillStyle = '#4CAF50'; break;
        default:        ctx.fillStyle = '#b0b0b0'; break;
      }

      ctx.fillText(evt.message, 8, y);
    }

    ctx.globalAlpha = 1.0;
  }

  // ── Sprite drawing helper ───────────────────────────────────────────────

  /**
   * Draw a sprite frame at the given local coordinates.
   * Returns true if drawn successfully, false if sheet/frame/image not found.
   */
  private drawSprite(
    sheetId: string,
    frameId: string,
    x: number,
    y: number,
    w?: number,
    h?: number,
    flipX = false,
  ): boolean {
    const sheet = this.spriteSheets.get(sheetId);
    if (!sheet) return false;
    const img = this.assets.images.get(sheetId);
    if (!img) return false;
    const frame = sheet.frames.get(frameId);
    if (!frame) return false;

    const dw = w ?? frame.w;
    const dh = h ?? frame.h;

    if (flipX) {
      this.ctx.save();
      this.ctx.translate(x + dw, y);
      this.ctx.scale(-1, 1);
      this.ctx.drawImage(
        img,
        frame.x, frame.y, frame.w, frame.h,
        0, 0, dw, dh,
      );
      this.ctx.restore();
    } else {
      this.ctx.drawImage(
        img,
        frame.x, frame.y, frame.w, frame.h,
        x, y, dw, dh,
      );
    }

    return true;
  }

  // ── Access helpers ──────────────────────────────────────────────────────

  getContext(): CanvasRenderingContext2D {
    return this.ctx;
  }

  getImage(sheetId: string): HTMLImageElement | undefined {
    return this.assets.images.get(sheetId);
  }

  getSheet(sheetId: string): SpriteSheetRuntime | undefined {
    return this.spriteSheets.get(sheetId);
  }

  getFrame(sheetId: string, frameId: string): FrameRuntime | undefined {
    return this.spriteSheets.get(sheetId)?.frames.get(frameId);
  }
}
