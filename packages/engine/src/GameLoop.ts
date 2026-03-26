// Semi-fixed timestep game loop
// - update() runs at a fixed step (default 60Hz)
// - render() receives alpha for interpolation

export class GameLoop {
  private readonly fixedTimestep: number;
  private accumulator = 0;
  private lastTime = 0;
  private rafId = 0;
  private running = false;

  onUpdate: (dt: number) => void = () => {};
  onRender: (alpha: number) => void = () => {};

  constructor(fixedHz = 60) {
    this.fixedTimestep = 1000 / fixedHz;
  }

  start(): void {
    if (this.running) return;
    this.running  = true;
    this.lastTime = performance.now();
    this.rafId    = requestAnimationFrame(this._tick);
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
  }

  private _tick = (now: number): void => {
    if (!this.running) return;

    let dt = now - this.lastTime;
    this.lastTime = now;

    // Clamp to avoid spiral of death after tab switch
    if (dt > 200) dt = 200;

    this.accumulator += dt;

    while (this.accumulator >= this.fixedTimestep) {
      this.onUpdate(this.fixedTimestep / 1000); // seconds
      this.accumulator -= this.fixedTimestep;
    }

    const alpha = this.accumulator / this.fixedTimestep;
    this.onRender(alpha);

    this.rafId = requestAnimationFrame(this._tick);
  };
}
