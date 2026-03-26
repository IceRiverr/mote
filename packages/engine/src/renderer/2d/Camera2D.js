import { Mat4 } from '../../math/Mat4.js';
import { Vec2 } from '../../math/Vec2.js';
export class Camera2D {
    position;
    zoom;
    rotation;
    viewport;
    _shakeIntensity = 0;
    _shakeDuration = 0;
    _shakeOffset = Vec2.zero();
    constructor(viewportWidth, viewportHeight) {
        this.position = Vec2.zero();
        this.zoom = 1;
        this.rotation = 0;
        this.viewport = { width: viewportWidth, height: viewportHeight };
    }
    getViewProjectionMatrix() {
        const hw = this.viewport.width * 0.5 / this.zoom;
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
    screenToWorld(sx, sy) {
        const hw = this.viewport.width * 0.5;
        const hh = this.viewport.height * 0.5;
        return new Vec2(this.position.x + (sx - hw) / this.zoom, this.position.y + (sy - hh) / this.zoom);
    }
    worldToScreen(wx, wy) {
        const hw = this.viewport.width * 0.5;
        const hh = this.viewport.height * 0.5;
        return new Vec2((wx - this.position.x) * this.zoom + hw, (wy - this.position.y) * this.zoom + hh);
    }
    follow(target, lerpFactor = 1) {
        this.position = this.position.lerp(target, lerpFactor);
    }
    shake(intensity, duration) {
        this._shakeIntensity = intensity;
        this._shakeDuration = duration;
    }
    update(dt) {
        if (this._shakeDuration > 0) {
            this._shakeDuration -= dt;
            const t = this._shakeIntensity * (this._shakeDuration > 0 ? 1 : 0);
            this._shakeOffset = new Vec2((Math.random() * 2 - 1) * t, (Math.random() * 2 - 1) * t);
        }
        else {
            this._shakeOffset = Vec2.zero();
        }
    }
}
//# sourceMappingURL=Camera2D.js.map