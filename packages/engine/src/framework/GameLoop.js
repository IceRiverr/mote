// Semi-fixed timestep game loop
// - update() runs at a fixed step (default 60Hz)
// - render() receives alpha for interpolation
export class GameLoop {
    fixedTimestep;
    accumulator = 0;
    lastTime = 0;
    rafId = 0;
    running = false;
    onUpdate = () => { };
    onRender = () => { };
    constructor(fixedHz = 60) {
        this.fixedTimestep = 1000 / fixedHz;
    }
    start() {
        if (this.running)
            return;
        this.running = true;
        this.lastTime = performance.now();
        this.rafId = requestAnimationFrame(this._tick);
    }
    stop() {
        this.running = false;
        cancelAnimationFrame(this.rafId);
    }
    _tick = (now) => {
        if (!this.running)
            return;
        let dt = now - this.lastTime;
        this.lastTime = now;
        // Clamp to avoid spiral of death after tab switch
        if (dt > 200)
            dt = 200;
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
//# sourceMappingURL=GameLoop.js.map