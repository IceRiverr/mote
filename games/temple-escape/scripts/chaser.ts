export default class ChaserScript {
  private entity: any;
  private engine: any;
  private animTimer = 0;
  private animFrame = 0;
  private runFrames = ['chaser_run_1', 'chaser_run_2', 'chaser_run_3', 'chaser_run_2'];

  constructor(entity: any, engine: any) {
    this.entity = entity;
    this.engine = engine;
  }

  update(dt: number) {
    const gm = this.engine.gameManager;
    if (gm.gameOver || gm.paused) return;

    // Chaser follows behind player
    const playerEntity = this.engine.playerEntity;
    if (!playerEntity) return;

    // Position chaser behind player (higher Y = further back since player runs toward lower Y)
    this.entity.x = playerEntity.x; // Same lane as player (with slight delay)
    this.entity.y = playerEntity.y + gm.chaserDistance;

    // Chaser slowly catches up over time
    gm.chaserDistance = Math.max(
      gm.chaserMinDistance,
      gm.chaserDistance - 2 * dt  // slowly closing in
    );

    // If chaser catches player → game over
    if (gm.chaserDistance <= gm.chaserMinDistance + 4) {
      gm.gameOver = true;
      this.engine.camera.shake(5, 0.5);
    }

    // Animation
    this.animTimer += dt;
    if (this.animTimer > 0.12) {
      this.animTimer = 0;
      this.animFrame = (this.animFrame + 1) % this.runFrames.length;
    }
    this.entity.setFrame(this.runFrames[this.animFrame], 'characters');
  }

  onDestroy() {}
}
