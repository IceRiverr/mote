export class Rect {
    x;
    y;
    width;
    height;
    constructor(x = 0, y = 0, width = 0, height = 0) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }
    get left() { return this.x; }
    get right() { return this.x + this.width; }
    get top() { return this.y; }
    get bottom() { return this.y + this.height; }
    contains(px, py) {
        return px >= this.x && px <= this.right && py >= this.y && py <= this.bottom;
    }
    intersects(other) {
        return this.left < other.right &&
            this.right > other.left &&
            this.top < other.bottom &&
            this.bottom > other.top;
    }
    clone() { return new Rect(this.x, this.y, this.width, this.height); }
}
//# sourceMappingURL=Rect.js.map