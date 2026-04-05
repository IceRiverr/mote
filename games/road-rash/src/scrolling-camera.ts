/**
 * scrolling-camera.ts — Viewport camera for vertical scrolling.
 *
 * World coordinate system: Y increases downward (row 0 at top, row 1499 at bottom).
 * Player starts near row 1450 and races toward row 50 (upward = decreasing Y).
 *
 * The camera follows the player such that the player appears at approximately
 * 70% from the top of the viewport, giving more view of the road ahead
 * (which is above the player in world space, i.e. lower Y values).
 */

export class ScrollingCamera {
  /** World X of viewport top-left corner. */
  x: number;
  /** World Y of viewport top-left corner. */
  y: number;
  /** Viewport width in pixels (416). */
  viewportWidth: number;
  /** Viewport height in pixels (640). */
  viewportHeight: number;

  /** How far down the viewport (0..1) the player should be positioned.
   *  0.7 = player at 70% from top, showing 70% road ahead. */
  private followOffsetY: number;

  /** Smoothing factor for camera movement (0 = instant, 1 = no movement). */
  private smoothing: number;

  constructor(
    viewportWidth: number,
    viewportHeight: number,
    smoothing = 0.1,
    followOffsetY = 0.7,
  ) {
    this.viewportWidth = viewportWidth;
    this.viewportHeight = viewportHeight;
    this.smoothing = smoothing;
    this.followOffsetY = followOffsetY;
    this.x = 0;
    this.y = 0;
  }

  /**
   * Update camera position to follow a target in world space.
   *
   * Camera centers horizontally on the target (typically the road center).
   * Vertically, the target is positioned at `followOffsetY` fraction from top,
   * so more of the road ahead (lower Y) is visible above the player.
   *
   * @param targetWorldX - World X to center horizontally on (road center pixel X)
   * @param targetWorldY - World Y of the player
   */
  follow(targetWorldX: number, targetWorldY: number): void {
    // Desired camera position:
    // Horizontal: center target in viewport
    const desiredX = targetWorldX - this.viewportWidth * 0.5;
    // Vertical: target at followOffsetY from top of viewport
    const desiredY = targetWorldY - this.viewportHeight * this.followOffsetY;

    // Smooth lerp toward desired position
    const t = 1 - this.smoothing;
    this.x += (desiredX - this.x) * t;
    this.y += (desiredY - this.y) * t;
  }

  /**
   * Instantly set camera to follow a target (no smoothing).
   * Useful for initial positioning.
   */
  snapTo(targetWorldX: number, targetWorldY: number): void {
    this.x = targetWorldX - this.viewportWidth * 0.5;
    this.y = targetWorldY - this.viewportHeight * this.followOffsetY;
  }

  /**
   * Convert world coordinates to screen (canvas) coordinates.
   * Screen = World - Camera.
   */
  worldToScreen(wx: number, wy: number): { x: number; y: number } {
    return {
      x: wx - this.x,
      y: wy - this.y,
    };
  }

  /**
   * Convert screen (canvas) coordinates to world coordinates.
   */
  screenToWorld(sx: number, sy: number): { x: number; y: number } {
    return {
      x: sx + this.x,
      y: sy + this.y,
    };
  }

  /**
   * Check if a world-space rectangle is visible in the viewport.
   * Uses AABB overlap test with a small margin for partially-visible objects.
   */
  isVisible(wx: number, wy: number, ww: number, wh: number): boolean {
    // Object is visible if its AABB overlaps the camera viewport AABB
    return (
      wx + ww > this.x &&
      wx < this.x + this.viewportWidth &&
      wy + wh > this.y &&
      wy < this.y + this.viewportHeight
    );
  }

  /**
   * Get the range of tile rows/cols that are visible in the viewport.
   * Returns inclusive start and end indices, clamped to map bounds.
   *
   * @param tileW - Tile width in pixels (32)
   * @param tileH - Tile height in pixels (32)
   * @param mapCols - Total map columns (21)
   * @param mapRows - Total map rows (1500)
   */
  getVisibleTileRange(
    tileW: number,
    tileH: number,
    mapCols: number,
    mapRows: number,
  ): { startCol: number; endCol: number; startRow: number; endRow: number } {
    // Start col/row: floor of camera position divided by tile size
    const startCol = Math.max(0, Math.floor(this.x / tileW));
    const startRow = Math.max(0, Math.floor(this.y / tileH));

    // End col/row: ceil of (camera position + viewport size) divided by tile size
    // Add 1 extra tile as buffer for partial tiles at edges
    const endCol = Math.min(mapCols - 1, Math.floor((this.x + this.viewportWidth) / tileW));
    const endRow = Math.min(mapRows - 1, Math.floor((this.y + this.viewportHeight) / tileH));

    return { startCol, endCol, startRow, endRow };
  }

  /**
   * Clamp camera position so it does not go outside the world bounds.
   *
   * @param worldWidth - Total world width in pixels (mapCols * tileSize)
   * @param worldHeight - Total world height in pixels (mapRows * tileSize)
   */
  clampToWorld(worldWidth: number, worldHeight: number): void {
    if (this.x < 0) this.x = 0;
    if (this.y < 0) this.y = 0;
    if (this.x + this.viewportWidth > worldWidth) {
      this.x = worldWidth - this.viewportWidth;
    }
    if (this.y + this.viewportHeight > worldHeight) {
      this.y = worldHeight - this.viewportHeight;
    }
  }

  /**
   * Get the world-space AABB of the viewport.
   */
  getWorldBounds(): { x: number; y: number; w: number; h: number } {
    return {
      x: this.x,
      y: this.y,
      w: this.viewportWidth,
      h: this.viewportHeight,
    };
  }
}
