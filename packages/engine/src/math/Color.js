export class Color {
    r;
    g;
    b;
    a;
    constructor(r = 1, g = 1, b = 1, a = 1) {
        this.r = r;
        this.g = g;
        this.b = b;
        this.a = a;
    }
    static white() { return new Color(1, 1, 1, 1); }
    static black() { return new Color(0, 0, 0, 1); }
    static red() { return new Color(1, 0, 0, 1); }
    static green() { return new Color(0, 1, 0, 1); }
    static blue() { return new Color(0, 0, 1, 1); }
    static clear() { return new Color(0, 0, 0, 0); }
    static fromHex(hex) {
        const h = hex.replace('#', '');
        const r = parseInt(h.slice(0, 2), 16) / 255;
        const g = parseInt(h.slice(2, 4), 16) / 255;
        const b = parseInt(h.slice(4, 6), 16) / 255;
        const a = h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1;
        return new Color(r, g, b, a);
    }
    lerp(other, t) {
        return new Color(this.r + (other.r - this.r) * t, this.g + (other.g - this.g) * t, this.b + (other.b - this.b) * t, this.a + (other.a - this.a) * t);
    }
    withAlpha(a) { return new Color(this.r, this.g, this.b, a); }
    clone() { return new Color(this.r, this.g, this.b, this.a); }
}
//# sourceMappingURL=Color.js.map