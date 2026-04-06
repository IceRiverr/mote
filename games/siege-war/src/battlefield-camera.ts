/**
 * battlefield-camera.ts — Free pan + zoom camera for siege warfare.
 *
 * Unlike road-rash's ScrollingCamera which follows the player vertically,
 * BattlefieldCamera supports free panning (mouse drag), zoom in/out,
 * screen-to-world coordinate transforms, camera shake effects, and
 * tile-range culling for efficient multi-layer rendering.
 *
 * World coordinate system: X increases rightward, Y increases downward.
 * The battlefield is viewed from a side perspective (2D horizontal).
 * Viewport default: 1280x720 at 1.0x zoom.
 */

export class BattlefieldCamera {
  // ── Core state ──────────────────────────────────────────────────────────

  /** World-space position of the camera center. */
  private _x: number;
  private _y: number;

  /** Target position for smooth lerp movement. */
  private _targetX: number;
  private _targetY: number;

  /** Lerp factor for smooth panning (0 = instant, lower = slower). */
  private _lerpFactor: number;

  /** Current zoom level. */
  private _zoom: number;

  /** Viewport dimensions in screen pixels. */
  readonly viewportWidth: number;
  readonly viewportHeight: number;

  // ── Zoom constraints ────────────────────────────────────────────────────

  /** Minimum zoom level (zoomed out). */
  readonly minZoom: number;

  /** Maximum zoom level (zoomed in). */
  readonly maxZoom: number;

  // ── Shake state ─────────────────────────────────────────────────────────

  /** Current shake offset applied on top of position. */
  private _shakeOffsetX: number;
  private _shakeOffsetY: number;

  /** Remaining shake duration in seconds. */
  private _shakeDuration: number;

  /** Current shake intensity in pixels. */
  private _shakeIntensity: number;

  /** Initial shake intensity for decay calculation. */
  private _shakeStartIntensity: number;

  /** Total shake duration for decay calculation. */
  private _shakeTotalDuration: number;

  // ── Options ─────────────────────────────────────────────────────────────

  /** When true, camera position is rounded to nearest pixel to avoid sub-pixel blurring. */
  pixelSnap: boolean;

  constructor(
    viewportWidth: number = 1280,
    viewportHeight: number = 720,
    options?: {
      minZoom?: number;
      maxZoom?: number;
      pixelSnap?: boolean;
    },
  ) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;

    this.minZoom = options?.minZoom ?? 0.5;
    this.maxZoom = options?.maxZoom ?? 2.0;
    this.pixelSnap = options?.pixelSnap ?? true;

    this._x = 0;
    this._y = 0;
    this._targetX = 0;
    this._targetY = 0;
    this._lerpFactor = 0;
    this._zoom = 1.0;

    this._shakeOffsetX = 0;
    this._shakeOffsetY = 0;
    this._shakeDuration = 0;
    this._shakeIntensity = 0;
    this._shakeStartIntensity = 0;
    this._shakeTotalDuration = 0;
  }

  // ── Getters / Setters ───────────────────────────────────────────────────

  /** World X of camera center (includes shake offset when reading). */
  get x(): number {
    return this._x + this._shakeOffsetX;
  }

  /** World Y of camera center (includes shake offset when reading). */
  get y(): number {
    return this._y + this._shakeOffsetY;
  }

  /** Raw world X without shake offset. */
  get baseX(): number {
    return this._x;
  }

  /** Raw world Y without shake offset. */
  get baseY(): number {
    return this._y;
  }

  /** Current zoom level. */
  get zoom(): number {
    return this._zoom;
  }

  set zoom(value: number) {
    this._zoom = Math.max(this.minZoom, Math.min(this.maxZoom, value));
  }

  /** Current position as a plain object. */
  get position(): { x: number; y: number } {
    return { x: this._x, y: this._y };
  }

  // ── Movement ────────────────────────────────────────────────────────────

  /**
   * Smoothly pan the camera toward a world position.
   * The camera will lerp toward the target each frame via update().
   *
   * @param worldX - Target world X coordinate
   * @param worldY - Target world Y coordinate
   * @param lerp - Lerp factor per frame (0..1). Higher = faster. 0 = instant snap.
   */
  panTo(worldX: number, worldY: number, lerp: number = 0.1): void {
    if (lerp <= 0) {
      // Instant snap
      this._x = worldX;
      this._y = worldY;
      this._targetX = worldX;
      this._targetY = worldY;
      this._lerpFactor = 0;
    } else {
      this._targetX = worldX;
      this._targetY = worldY;
      this._lerpFactor = lerp;
    }
  }

  /**
   * Instantly set camera center to a world position (no smoothing).
   * Useful for initial positioning or scene transitions.
   */
  snapTo(worldX: number, worldY: number): void {
    this._x = worldX;
    this._y = worldY;
    this._targetX = worldX;
    this._targetY = worldY;
    this._lerpFactor = 0;
  }

  /**
   * Adjust zoom by a delta amount (positive = zoom in, negative = zoom out).
   * Clamped to [minZoom, maxZoom].
   *
   * @param delta - Zoom change (e.g. +0.1 or -0.1 per scroll step)
   */
  zoomBy(delta: number): void {
    this._zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this._zoom + delta));
  }

  /**
   * Zoom toward a specific screen point (e.g. mouse cursor position).
   * This keeps the world point under the cursor stationary during zoom.
   *
   * @param delta - Zoom change
   * @param screenX - Screen X of the zoom focus point
   * @param screenY - Screen Y of the zoom focus point
   */
  zoomToward(delta: number, screenX: number, screenY: number): void {
    // Convert screen point to world before zoom
    const worldBefore = this.screenToWorld(screenX, screenY);

    // Apply zoom
    const oldZoom = this._zoom;
    this._zoom = Math.max(this.minZoom, Math.min(this.maxZoom, this._zoom + delta));

    if (this._zoom === oldZoom) return; // No change (clamped)

    // Convert same screen point to world after zoom
    const worldAfter = this.screenToWorld(screenX, screenY);

    // Adjust camera position so the world point stays under the cursor
    this._x += worldBefore.x - worldAfter.x;
    this._y += worldBefore.y - worldAfter.y;
    this._targetX = this._x;
    this._targetY = this._y;
  }

  /**
   * Handle mouse drag for panning. Moves the camera in world space
   * by the inverse of the screen delta, scaled by current zoom.
   *
   * @param dx - Screen-space drag delta X (positive = mouse moved right)
   * @param dy - Screen-space drag delta Y (positive = mouse moved down)
   */
  handleDrag(dx: number, dy: number): void {
    const scale = 1 / this._zoom;
    this._x -= dx * scale;
    this._y -= dy * scale;
    // Sync target to prevent lerp from pulling back
    this._targetX = this._x;
    this._targetY = this._y;
  }

  // ── Coordinate transforms ───────────────────────────────────────────────

  /**
   * Convert screen (canvas) coordinates to world coordinates.
   * Accounts for camera position, zoom, and viewport offset.
   *
   * @param sx - Screen X coordinate
   * @param sy - Screen Y coordinate
   * @returns World coordinates { x, y }
   */
  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    const cx = this.x; // includes shake
    const cy = this.y;
    return {
      x: cx + (sx - this.viewportWidth * 0.5) / this._zoom,
      y: cy + (sy - this.viewportHeight * 0.5) / this._zoom,
    };
  }

  /**
   * Convert world coordinates to screen (canvas) coordinates.
   * Accounts for camera position, zoom, and viewport offset.
   *
   * @param wx - World X coordinate
   * @param wy - World Y coordinate
   * @returns Screen coordinates { x, y }
   */
  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    const cx = this.x; // includes shake
    const cy = this.y;
    return {
      x: (wx - cx) * this._zoom + this.viewportWidth * 0.5,
      y: (wy - cy) * this._zoom + this.viewportHeight * 0.5,
    };
  }

  // ── Culling / Visibility ────────────────────────────────────────────────

  /**
   * Get the range of tile rows/cols that are visible in the viewport.
   * Returns inclusive start and end indices, clamped to map bounds.
   * Accounts for zoom level.
   *
   * @param tileW - Tile width in pixels (e.g. 32)
   * @param tileH - Tile height in pixels (e.g. 32)
   * @param mapCols - Total map columns
   * @param mapRows - Total map rows
   * @returns Clamped tile index ranges
   */
  getVisibleTileRange(
    tileW: number,
    tileH: number,
    mapCols: number,
    mapRows: number,
  ): { startCol: number; endCol: number; startRow: number; endRow: number } {
    // World-space bounds of what the viewport can see
    const halfW = (this.viewportWidth * 0.5) / this._zoom;
    const halfH = (this.viewportHeight * 0.5) / this._zoom;

    const worldLeft = this.x - halfW;
    const worldTop = this.y - halfH;
    const worldRight = this.x + halfW;
    const worldBottom = this.y + halfH;

    // Convert to tile indices with 1-tile margin for partial tiles at edges
    const startCol = Math.max(0, Math.floor(worldLeft / tileW));
    const startRow = Math.max(0, Math.floor(worldTop / tileH));
    const endCol = Math.min(mapCols - 1, Math.floor(worldRight / tileW));
    const endRow = Math.min(mapRows - 1, Math.floor(worldBottom / tileH));

    return { startCol, endCol, startRow, endRow };
  }

  /**
   * Check if a world-space AABB is visible in the current viewport.
   * Uses AABB overlap test. Accounts for zoom.
   *
   * @param x - World X of the rectangle's top-left corner
   * @param y - World Y of the rectangle's top-left corner
   * @param w - Width in world pixels
   * @param h - Height in world pixels
   * @returns true if any part of the rect is visible
   */
  isVisible(x: number, y: number, w: number, h: number): boolean {
    const halfW = (this.viewportWidth * 0.5) / this._zoom;
    const halfH = (this.viewportHeight * 0.5) / this._zoom;

    const camLeft = this.x - halfW;
    const camTop = this.y - halfH;
    const camRight = this.x + halfW;
    const camBottom = this.y + halfH;

    return x + w > camLeft && x < camRight && y + h > camTop && y < camBottom;
  }

  /**
   * Get the world-space AABB of the current viewport.
   */
  getWorldBounds(): { x: number; y: number; w: number; h: number } {
    const halfW = (this.viewportWidth * 0.5) / this._zoom;
    const halfH = (this.viewportHeight * 0.5) / this._zoom;
    return {
      x: this.x - halfW,
      y: this.y - halfH,
      w: halfW * 2,
      h: halfH * 2,
    };
  }

  // ── Bounds clamping ─────────────────────────────────────────────────────

  /**
   * Clamp camera position so the viewport doesn't extend outside the map.
   * Should be called after any position change (drag, panTo, etc.).
   *
   * @param mapWidth - Total map width in world pixels (mapCols * tileWidth)
   * @param mapHeight - Total map height in world pixels (mapRows * tileHeight)
   */
  clampToBounds(mapWidth: number, mapHeight: number): void {
    const halfW = (this.viewportWidth * 0.5) / this._zoom;
    const halfH = (this.viewportHeight * 0.5) / this._zoom;

    // If the visible area is larger than the map (zoomed way out),
    // center the camera on the map instead.
    if (halfW * 2 >= mapWidth) {
      this._x = mapWidth * 0.5;
    } else {
      if (this._x - halfW < 0) this._x = halfW;
      if (this._x + halfW > mapWidth) this._x = mapWidth - halfW;
    }

    if (halfH * 2 >= mapHeight) {
      this._y = mapHeight * 0.5;
    } else {
      if (this._y - halfH < 0) this._y = halfH;
      if (this._y + halfH > mapHeight) this._y = mapHeight - halfH;
    }

    // Sync target to prevent lerp from pulling back out of bounds
    this._targetX = this._x;
    this._targetY = this._y;
  }

  // ── Shake effect ────────────────────────────────────────────────────────

  /**
   * Trigger a camera shake effect.
   * Multiple shakes stack: if a stronger shake is requested while one is active,
   * the stronger intensity is used and duration is reset.
   *
   * @param intensity - Maximum shake offset in world pixels (e.g. 4 for small, 12 for big)
   * @param duration - Duration in seconds (e.g. 0.3)
   */
  shake(intensity: number, duration: number): void {
    // Use the stronger of current vs new shake
    if (intensity > this._shakeIntensity || this._shakeDuration <= 0) {
      this._shakeStartIntensity = intensity;
      this._shakeIntensity = intensity;
      this._shakeTotalDuration = duration;
      this._shakeDuration = duration;
    }
  }

  // ── Per-frame update ────────────────────────────────────────────────────

  /**
   * Update camera state. Call once per game tick.
   * Processes smooth panning lerp and shake decay.
   *
   * @param dt - Delta time in seconds
   */
  update(dt: number): void {
    // ── Smooth pan lerp ───────────────────────────────────────────────
    if (this._lerpFactor > 0) {
      const t = 1 - Math.pow(1 - this._lerpFactor, dt * 60); // frame-rate independent lerp
      this._x += (this._targetX - this._x) * t;
      this._y += (this._targetY - this._y) * t;

      // Snap when close enough to prevent endless drift
      const dx = this._targetX - this._x;
      const dy = this._targetY - this._y;
      if (dx * dx + dy * dy < 0.01) {
        this._x = this._targetX;
        this._y = this._targetY;
        this._lerpFactor = 0;
      }
    }

    // ── Shake decay ───────────────────────────────────────────────────
    if (this._shakeDuration > 0) {
      this._shakeDuration -= dt;

      if (this._shakeDuration <= 0) {
        // Shake finished
        this._shakeDuration = 0;
        this._shakeIntensity = 0;
        this._shakeOffsetX = 0;
        this._shakeOffsetY = 0;
      } else {
        // Decay intensity linearly over duration
        const progress = this._shakeDuration / this._shakeTotalDuration;
        this._shakeIntensity = this._shakeStartIntensity * progress;

        // Random offset within current intensity
        this._shakeOffsetX = (Math.random() * 2 - 1) * this._shakeIntensity;
        this._shakeOffsetY = (Math.random() * 2 - 1) * this._shakeIntensity;

        // Pixel snap the shake offset if enabled
        if (this.pixelSnap) {
          this._shakeOffsetX = Math.round(this._shakeOffsetX);
          this._shakeOffsetY = Math.round(this._shakeOffsetY);
        }
      }
    }

    // ── Pixel snap final position ─────────────────────────────────────
    // Note: pixel snap is applied at read time via getters if needed,
    // but we keep internal state at sub-pixel precision for smooth lerp.
  }

  /**
   * Apply camera transform to a Canvas2D context.
   * Call this before rendering world-space content.
   *
   * @param ctx - The 2D rendering context
   */
  applyTransform(ctx: CanvasRenderingContext2D): void {
    const cx = this.pixelSnap ? Math.round(this.x) : this.x;
    const cy = this.pixelSnap ? Math.round(this.y) : this.y;

    const halfW = this.viewportWidth * 0.5;
    const halfH = this.viewportHeight * 0.5;

    ctx.setTransform(
      this._zoom, 0,
      0, this._zoom,
      halfW - cx * this._zoom,
      halfH - cy * this._zoom,
    );
  }

  /**
   * Reset a Canvas2D context back to identity (screen space).
   * Call this before rendering HUD/UI elements.
   *
   * @param ctx - The 2D rendering context
   */
  resetTransform(ctx: CanvasRenderingContext2D): void {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }
}
