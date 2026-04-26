import { Mat4, Vec2, Color } from '../../math/index.js';

export class Camera2D {
  position: Vec2;
  zoom: number;
  rotation: number;
  backgroundColor: Color;
  viewport: { width: number; height: number; };
  
  /** 视口宽度 */
  get viewportWidth(): number { return this.viewport.width; }
  set viewportWidth(value: number) { this.viewport.width = value; }
  
  /** 视口高度 */
  get viewportHeight(): number { return this.viewport.height; }
  set viewportHeight(value: number) { this.viewport.height = value; }

  /** 像素对齐：消除 tilemap 接缝。默认开启。 */
  pixelSnap = true;

  private _shakeIntensity = 0;
  private _shakeDuration  = 0;
  private _shakeOffset    = Vec2.zero();

  constructor(viewportWidth: number = 800, viewportHeight: number = 600) {
    this.position = Vec2.zero();
    this.zoom     = 1;
    this.rotation = 0;
    this.backgroundColor = Color.fromHex('87CEEB');
    this.viewport = { width: viewportWidth, height: viewportHeight };
  }

  getViewProjectionMatrix(): Mat4 {
    const hw = this.viewport.width  * 0.5 / this.zoom;
    const hh = this.viewport.height * 0.5 / this.zoom;
    let cx = this.position.x + this._shakeOffset.x;
    let cy = this.position.y + this._shakeOffset.y;

    // Pixel snap: 将相机对齐到屏幕像素网格，消除 tile 接缝
    // 原理：世界坐标 × zoom = 屏幕像素，对齐到整数像素后再除回来
    if (this.pixelSnap) {
      cx = Math.round(cx * this.zoom) / this.zoom;
      cy = Math.round(cy * this.zoom) / this.zoom;
    }

    // Y-down ortho projection (matches Canvas: origin top-left, Y down)
    const proj = Mat4.ortho(cx - hw, cx + hw, cy + hh, cy - hh, -1, 1);

    if (this.rotation !== 0) {
      const rot = Mat4.rotationZ(-this.rotation);
      return Mat4.multiply(proj, rot);
    }
    return proj;
  }

  screenToWorld(sx: number, sy: number): Vec2 {
    const hw = this.viewport.width  * 0.5;
    const hh = this.viewport.height * 0.5;
    return new Vec2(
      this.position.x + (sx - hw) / this.zoom,
      this.position.y + (sy - hh) / this.zoom,
    );
  }

  worldToScreen(wx: number, wy: number): Vec2 {
    const hw = this.viewport.width  * 0.5;
    const hh = this.viewport.height * 0.5;
    return new Vec2(
      (wx - this.position.x) * this.zoom + hw,
      (wy - this.position.y) * this.zoom + hh,
    );
  }

  follow(target: Vec2, lerpFactor = 1): void {
    this.position = this.position.lerp(target, lerpFactor);
  }

  shake(intensity: number, duration: number): void {
    this._shakeIntensity = intensity;
    this._shakeDuration  = duration;
  }

  update(dt: number): void {
    if (this._shakeDuration > 0) {
      this._shakeDuration -= dt;
      const t = this._shakeIntensity * (this._shakeDuration > 0 ? 1 : 0);
      this._shakeOffset = new Vec2(
        (Math.random() * 2 - 1) * t,
        (Math.random() * 2 - 1) * t,
      );
    } else {
      this._shakeOffset = Vec2.zero();
    }
  }
}
