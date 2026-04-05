export default class CollapseFloorScript {
  private entity: any;
  private engine: any;
  private state = 'solid'; // solid, crumbling, collapsed, respawning
  private timer = 0;
  private delay: number;
  private respawnTime: number;
  private crumbleFrames = ['collapse_1', 'collapse_2', 'collapse_3'];

  constructor(entity: any, engine: any) {
    this.entity = entity;
    this.engine = engine;
    this.delay = entity.getField('delay') || 0.5;
    this.respawnTime = entity.getField('respawn') || 3;
  }

  update(dt: number) {
    if (this.engine.gameManager.gameOver) return;

    switch (this.state) {
      case 'crumbling':
        this.timer += dt;
        // Show crumble animation
        const frameIdx = Math.min(
          Math.floor(this.timer / this.delay * this.crumbleFrames.length),
          this.crumbleFrames.length - 1
        );
        this.entity.setFrame(this.crumbleFrames[frameIdx], 'traps');

        if (this.timer >= this.delay) {
          this.state = 'collapsed';
          this.timer = 0;
          this.entity.visible = false; // disappear
        }
        break;

      case 'collapsed':
        this.timer += dt;
        if (this.timer >= this.respawnTime) {
          this.state = 'solid';
          this.timer = 0;
          this.entity.visible = true;
          this.entity.setFrame('collapse_1', 'traps');
        }
        break;
    }
  }

  onCollisionEnter(other: any) {
    if (other.templateId === 'player' && this.state === 'solid') {
      this.state = 'crumbling';
      this.timer = 0;
      this.engine.camera.shake(1, 0.2);
    }
  }

  onDestroy() {}
}
