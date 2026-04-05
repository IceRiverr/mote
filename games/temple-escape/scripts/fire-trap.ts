export default class FireTrapScript {
  private entity: any;
  private engine: any;
  private timer = 0;
  private phase = 0; // 0=off, 1=warning, 2=active
  private interval: number;
  private warningDuration = 0.5;
  private activeDuration = 1.0;
  private fireFrames = ['fire_1', 'fire_2', 'fire_3'];
  private fireAnimTimer = 0;
  private fireAnimFrame = 0;
  private isActive = false;

  constructor(entity: any, engine: any) {
    this.entity = entity;
    this.engine = engine;
    this.interval = entity.getField('interval') || 1.5;
    this.timer = Math.random() * this.interval;
  }

  update(dt: number) {
    if (this.engine.gameManager.gameOver) return;

    this.timer += dt;

    switch (this.phase) {
      case 0: // Off
        if (this.timer >= this.interval) {
          this.phase = 1;
          this.timer = 0;
          this.entity.setFrame('fire_1', 'traps'); // warning flicker
        }
        break;
      case 1: // Warning
        if (this.timer >= this.warningDuration) {
          this.phase = 2;
          this.timer = 0;
          this.isActive = true;
        }
        // Flicker animation during warning
        this.fireAnimTimer += dt;
        if (this.fireAnimTimer > 0.05) {
          this.fireAnimTimer = 0;
          this.entity.setFrame(
            this.timer % 0.1 < 0.05 ? 'fire_1' : 'fire_2',
            'traps'
          );
        }
        break;
      case 2: // Active
        if (this.timer >= this.activeDuration) {
          this.phase = 0;
          this.timer = 0;
          this.isActive = false;
          this.entity.setFrame('fire_1', 'traps');
        }
        // Full fire animation
        this.fireAnimTimer += dt;
        if (this.fireAnimTimer > 0.08) {
          this.fireAnimTimer = 0;
          this.fireAnimFrame = (this.fireAnimFrame + 1) % this.fireFrames.length;
          this.entity.setFrame(this.fireFrames[this.fireAnimFrame], 'traps');
        }
        break;
    }
  }

  onCollisionEnter(other: any) {
    if (!this.isActive) return;
    // Damage handled by player script
  }

  onDestroy() {}
}
