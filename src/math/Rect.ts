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
