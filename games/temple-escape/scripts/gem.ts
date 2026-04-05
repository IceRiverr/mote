export default class GemScript {
  private entity: any;
  private engine: any;
  private collected = false;
  private bobTimer = 0;
  private baseY: number;

  constructor(entity: any, engine: any) {
    this.entity = entity;
    this.engine = engine;
    this.baseY = entity.y;
  }

  update(dt: number) {
    if (this.collected) return;

    // Gentle bobbing animation
    this.bobTimer += dt * 3;
    this.entity.y = this.baseY + Math.sin(this.bobTimer) * 2;
  }

  onCollisionEnter(other: any) {
    if (this.collected) return;
    if (other.templateId === 'player') {
      this.collected = true;
      const value = this.entity.getField('value') || 10;
      this.engine.gameManager.addScore(value);
      this.entity.visible = false;
      // Could play sound effect here
    }
  }

  onDestroy() {}
}
