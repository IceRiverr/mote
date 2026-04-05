export default class SpikeTrapScript {
  private entity: any;
  private engine: any;
  private timer = 0;
  private isUp = false;
  private interval: number;
  private upDuration = 1.0;

  constructor(entity: any, engine: any) {
    this.entity = entity;
    this.engine = engine;
    this.interval = entity.getField('interval') || 2;
    // Randomize initial timer so spikes aren't synchronized
    this.timer = Math.random() * this.interval;
  }

  update(dt: number) {
    if (this.engine.gameManager.gameOver) return;

    this.timer += dt;

    if (!this.isUp && this.timer >= this.interval) {
      // Spikes go up
      this.isUp = true;
      this.timer = 0;
      this.entity.setFrame('spike_up', 'traps');
    } else if (this.isUp && this.timer >= this.upDuration) {
      // Spikes retract
      this.isUp = false;
      this.timer = 0;
      this.entity.setFrame('spike_down', 'traps');
    }
  }

  onCollisionEnter(other: any) {
    if (!this.isUp) return; // Only damage when spikes are up
    if (other.templateId === 'player') {
      // Damage handled by player's onCollisionEnter
    }
  }

  onDestroy() {}
}
