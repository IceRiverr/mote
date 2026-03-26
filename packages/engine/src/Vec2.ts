export class Vec2 {
  constructor(public x: number = 0, public y: number = 0) {}

  static zero(): Vec2 { return new Vec2(0, 0); }
  static one(): Vec2  { return new Vec2(1, 1); }
  static from(x: number, y: number): Vec2 { return new Vec2(x, y); }

  add(v: Vec2): Vec2    { return new Vec2(this.x + v.x, this.y + v.y); }
  sub(v: Vec2): Vec2    { return new Vec2(this.x - v.x, this.y - v.y); }
  scale(s: number): Vec2 { return new Vec2(this.x * s, this.y * s); }
  mul(v: Vec2): Vec2    { return new Vec2(this.x * v.x, this.y * v.y); }

  dot(v: Vec2): number  { return this.x * v.x + this.y * v.y; }
  length(): number      { return Math.sqrt(this.x * this.x + this.y * this.y); }
  lengthSq(): number    { return this.x * this.x + this.y * this.y; }

  normalize(): Vec2 {
    const len = this.length();
    return len > 0 ? this.scale(1 / len) : Vec2.zero();
  }

  lerp(v: Vec2, t: number): Vec2 {
    return new Vec2(this.x + (v.x - this.x) * t, this.y + (v.y - this.y) * t);
  }

  clone(): Vec2 { return new Vec2(this.x, this.y); }

  addSelf(v: Vec2): this { this.x += v.x; this.y += v.y; return this; }
  scaleSelf(s: number): this { this.x *= s; this.y *= s; return this; }
}
