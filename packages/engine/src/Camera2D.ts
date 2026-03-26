import { Mat4 } from './Mat4.js';
import { Vec2 } from './Vec2.js';
import { Rect } from './Rect.js';

export class Camera2D {
  position: Vec2;
  zoom: number;
  rotation: number;
  readonly viewport: { width: number; height: number };

  // 地图边界限制（可选）
  private _mapBounds: Rect | null = null;

  // 死区（Dead Zone）- 玩家在这个区域内移动时摄像机不跟随
  // 值为视口尺寸的百分比 (0-1)，0.3 表示死区占视口 30%
  private _deadZoneSize = 0.0;  // 默认 0，表示始终跟随

  private _shakeIntensity = 0;
  private _shakeDuration  = 0;
  private _shakeOffset    = Vec2.zero();

  constructor(viewportWidth: number, viewportHeight: number) {
    this.position = Vec2.zero();
    this.zoom     = 1;
    this.rotation = 0;
    this.viewport = { width: viewportWidth, height: viewportHeight };
  }

  /** 设置地图边界，摄像机会被限制在这个范围内 */
  setMapBounds(x: number, y: number, width: number, height: number): void {
    this._mapBounds = new Rect(x, y, width, height);
  }

  /** 清除地图边界限制 */
  clearMapBounds(): void {
    this._mapBounds = null;
  }

  /**
   * 设置死区大小（0-1之间）
   * @param size 死区占视口的比例，0.3 表示玩家在屏幕中央 30% 区域内移动时摄像机不跟随
   */
  setDeadZone(size: number): void {
    this._deadZoneSize = Math.max(0, Math.min(1, size));
  }

  /** 获取当前视口在世界坐标系中的边界 */
  getViewBounds(): Rect {
    const halfW = (this.viewport.width  * 0.5) / this.zoom;
    const halfH = (this.viewport.height * 0.5) / this.zoom;
    return new Rect(
      this.position.x - halfW,
      this.position.y - halfH,
      halfW * 2,
      halfH * 2,
    );
  }

  /**
   * 更新摄像机位置，带死区跟随逻辑
   * @param target 目标位置（通常是玩家位置）
   * @param lerpFactor 插值系数（0-1），1 表示直接设置
   */
  followWithDeadZone(target: Vec2, lerpFactor = 1): void {
    if (this._deadZoneSize <= 0) {
      // 无死区，直接跟随
      this.position = lerpFactor >= 1 
        ? target.clone()
        : this.position.lerp(target, lerpFactor);
      this._clampToMapBounds();
      return;
    }

    // 计算死区边界（以摄像机当前位置为中心）
    const halfW = (this.viewport.width  * 0.5) / this.zoom;
    const halfH = (this.viewport.height * 0.5) / this.zoom;
    const deadHalfW = halfW * this._deadZoneSize;
    const deadHalfH = halfH * this._deadZoneSize;

    const deadLeft   = this.position.x - deadHalfW;
    const deadRight  = this.position.x + deadHalfW;
    const deadTop    = this.position.y - deadHalfH;
    const deadBottom = this.position.y + deadHalfH;

    // 计算目标位置需要移动多少才能让玩家回到死区内
    let deltaX = 0;
    let deltaY = 0;

    if (target.x < deadLeft)   deltaX = target.x - deadLeft;
    if (target.x > deadRight)  deltaX = target.x - deadRight;
    if (target.y < deadTop)    deltaY = target.y - deadTop;
    if (target.y > deadBottom) deltaY = target.y - deadBottom;

    // 只在需要时移动摄像机
    if (deltaX !== 0 || deltaY !== 0) {
      const newPos = new Vec2(this.position.x + deltaX, this.position.y + deltaY);
      this.position = lerpFactor >= 1
        ? newPos
        : this.position.lerp(newPos, lerpFactor);
    }

    this._clampToMapBounds();
  }

  getViewProjectionMatrix(): Mat4 {
    const hw = this.viewport.width  * 0.5 / this.zoom;
    const hh = this.viewport.height * 0.5 / this.zoom;
    const cx = this.position.x + this._shakeOffset.x;
    const cy = this.position.y + this._shakeOffset.y;

    // Ortho centered on camera position
    const proj = Mat4.ortho(cx - hw, cx + hw, cy + hh, cy - hh, -1, 1);

    if (this.rotation !== 0) {
      const rot = Mat4.rotationZ(-this.rotation);
      return Mat4.multiply(proj, rot);
    }
    return proj;
  }

  /** 将摄像机位置限制在地图边界内 */
  private _clampToMapBounds(): void {
    if (!this._mapBounds) return;

    const halfW = (this.viewport.width  * 0.5) / this.zoom;
    const halfH = (this.viewport.height * 0.5) / this.zoom;

    // 计算摄像机可视区域的最小/最大位置
    const minX = this._mapBounds.left   + halfW;
    const maxX = this._mapBounds.right  - halfW;
    const minY = this._mapBounds.top    + halfH;
    const maxY = this._mapBounds.bottom - halfH;

    // 如果地图比视口小，居中显示
    if (this._mapBounds.width  <= halfW * 2) {
      this.position.x = this._mapBounds.x + this._mapBounds.width * 0.5;
    } else {
      this.position.x = Math.max(minX, Math.min(maxX, this.position.x));
    }

    if (this._mapBounds.height <= halfH * 2) {
      this.position.y = this._mapBounds.y + this._mapBounds.height * 0.5;
    } else {
      this.position.y = Math.max(minY, Math.min(maxY, this.position.y));
    }
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
