// ═════════════════════════════════════════════════════════════════════════════
// Math Utils — Color, Vec2, Mat4, Rect
// ═════════════════════════════════════════════════════════════════════════════

// ── Color ────────────────────────────────────────────────────────────────────

export class Color {
  constructor(
    public r: number = 1,
    public g: number = 1,
    public b: number = 1,
    public a: number = 1,
  ) {}

  static white(): Color  { return new Color(1, 1, 1, 1); }
  static black(): Color  { return new Color(0, 0, 0, 1); }
  static red(): Color    { return new Color(1, 0, 0, 1); }
  static green(): Color  { return new Color(0, 1, 0, 1); }
  static blue(): Color   { return new Color(0, 0, 1, 1); }
  static clear(): Color  { return new Color(0, 0, 0, 0); }

  static fromHex(hex: string): Color {
    const h = hex.replace('#', '');
    const r = parseInt(h.slice(0, 2), 16) / 255;
    const g = parseInt(h.slice(2, 4), 16) / 255;
    const b = parseInt(h.slice(4, 6), 16) / 255;
    const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
    return new Color(r, g, b, a);
  }

  lerp(other: Color, t: number): Color {
    return new Color(
      this.r + (other.r - this.r) * t,
      this.g + (other.g - this.g) * t,
      this.b + (other.b - this.b) * t,
      this.a + (other.a - this.a) * t,
    );
  }

  withAlpha(a: number): Color { return new Color(this.r, this.g, this.b, a); }
  clone(): Color { return new Color(this.r, this.g, this.b, this.a); }
}

// ── Vec2 ─────────────────────────────────────────────────────────────────────

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

// ── Mat4 ─────────────────────────────────────────────────────────────────────

// Column-major 4x4 matrix (matches WebGPU/WGSL convention)
export class Mat4 {
  readonly data: Float32Array;

  constructor(data?: Float32Array) {
    this.data = data ?? new Float32Array(16);
  }

  static identity(): Mat4 {
    const m = new Mat4();
    m.data[0] = 1; m.data[5] = 1; m.data[10] = 1; m.data[15] = 1;
    return m;
  }

  // Orthographic projection: maps [left,right] x [bottom,top] x [near,far] → NDC
  static ortho(left: number, right: number, bottom: number, top: number, near: number, far: number): Mat4 {
    const m = new Mat4();
    const d = m.data;
    d[0]  =  2 / (right - left);
    d[5]  =  2 / (top - bottom);
    d[10] = -2 / (far - near);
    d[12] = -(right + left) / (right - left);
    d[13] = -(top + bottom) / (top - bottom);
    d[14] = -(far + near)   / (far - near);
    d[15] = 1;
    return m;
  }

  static multiply(a: Mat4, b: Mat4): Mat4 {
    const out = new Mat4();
    const A = a.data, B = b.data, C = out.data;
    for (let col = 0; col < 4; col++) {
      for (let row = 0; row < 4; row++) {
        let sum = 0;
        for (let k = 0; k < 4; k++) sum += A[k * 4 + row] * B[col * 4 + k];
        C[col * 4 + row] = sum;
      }
    }
    return out;
  }

  static translation(x: number, y: number): Mat4 {
    const m = Mat4.identity();
    m.data[12] = x;
    m.data[13] = y;
    return m;
  }

  static scaling(sx: number, sy: number): Mat4 {
    const m = Mat4.identity();
    m.data[0] = sx;
    m.data[5] = sy;
    return m;
  }

  static rotationZ(angle: number): Mat4 {
    const m = Mat4.identity();
    const c = Math.cos(angle), s = Math.sin(angle);
    m.data[0] =  c; m.data[4] = -s;
    m.data[1] =  s; m.data[5] =  c;
    return m;
  }
}

// ── Rect ─────────────────────────────────────────────────────────────────────

export class Rect {
  constructor(
    public x: number = 0,
    public y: number = 0,
    public width: number = 0,
    public height: number = 0,
  ) {}

  get left(): number   { return this.x; }
  get right(): number  { return this.x + this.width; }
  get top(): number    { return this.y; }
  get bottom(): number { return this.y + this.height; }

  contains(px: number, py: number): boolean {
    return px >= this.x && px <= this.right && py >= this.y && py <= this.bottom;
  }

  intersects(other: Rect): boolean {
    return this.left < other.right  &&
           this.right > other.left  &&
           this.top < other.bottom  &&
           this.bottom > other.top;
  }

  clone(): Rect { return new Rect(this.x, this.y, this.width, this.height); }
}
