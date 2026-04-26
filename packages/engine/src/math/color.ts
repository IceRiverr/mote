// engine/src/math/color.ts

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
