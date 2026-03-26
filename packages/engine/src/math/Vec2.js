export class Vec2 {
    x;
    y;
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }
    static zero() { return new Vec2(0, 0); }
    static one() { return new Vec2(1, 1); }
    static from(x, y) { return new Vec2(x, y); }
    add(v) { return new Vec2(this.x + v.x, this.y + v.y); }
    sub(v) { return new Vec2(this.x - v.x, this.y - v.y); }
    scale(s) { return new Vec2(this.x * s, this.y * s); }
    mul(v) { return new Vec2(this.x * v.x, this.y * v.y); }
    dot(v) { return this.x * v.x + this.y * v.y; }
    length() { return Math.sqrt(this.x * this.x + this.y * this.y); }
    lengthSq() { return this.x * this.x + this.y * this.y; }
    normalize() {
        const len = this.length();
        return len > 0 ? this.scale(1 / len) : Vec2.zero();
    }
    lerp(v, t) {
        return new Vec2(this.x + (v.x - this.x) * t, this.y + (v.y - this.y) * t);
    }
    clone() { return new Vec2(this.x, this.y); }
    addSelf(v) { this.x += v.x; this.y += v.y; return this; }
    scaleSelf(s) { this.x *= s; this.y *= s; return this; }
}
//# sourceMappingURL=Vec2.js.map