/**
 * barbican-trap — ScriptLifecycle 脚本
 * 详细设计见 TECH-SPEC.md
 */

interface ScriptLifecycle {
  update?(dt: number): void;
  onCollisionEnter?(other: unknown): void;
  onCollisionExit?(other: unknown): void;
  onDestroy?(): void;
}

export default class BarbicanTrapScript implements ScriptLifecycle {
  private entity: unknown;
  private engine: unknown;

  constructor(entity: unknown, engine: unknown) {
    this.entity = entity;
    this.engine = engine;
  }

  update(dt: number): void {
    // TODO: implement
  }
}
