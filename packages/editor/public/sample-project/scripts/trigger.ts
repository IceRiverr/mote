// Example script for trigger zone entities
export default class TriggerScript {
  private entity: any;
  private engine: any;
  private triggered = false;

  constructor(entity: any, engine: any) {
    this.entity = entity;
    this.engine = engine;
  }

  update(dt: number): void {
    // Trigger zones don't need per-frame updates typically
  }

  onCollisionEnter(other: any): void {
    if (this.triggered && this.entity.getField('once')) return;
    const event = this.entity.getField<string>('event');
    if (event) {
      console.log(`[Trigger] Event fired: ${event}`);
      this.triggered = true;
    }
  }

  onDestroy(): void {
    this.triggered = false;
  }
}
