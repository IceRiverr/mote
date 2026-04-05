// ═════════════════════════════════════════════════════════════════════════════
// Entity — runtime entity instance with fields, frame, and collider access
// ═════════════════════════════════════════════════════════════════════════════

import type {
  EntityDefRuntime,
  FrameRuntime,
  SpriteSheetRuntime,
  ColliderShapeRuntime,
} from './ProjectLoader.js';
import type { SceneManager, EntityInstanceRuntime } from './SceneManager.js';

export class Entity {
  public x: number;
  public y: number;
  public width: number;
  public height: number;
  public visible = true;

  private readonly _fields: Record<string, unknown>;
  private readonly _def: EntityDefRuntime;
  private readonly _instance: EntityInstanceRuntime;
  private readonly _sceneManager: SceneManager;

  private _currentFrameId: string | undefined;
  private _currentSheetId: string | undefined;

  constructor(
    instance: EntityInstanceRuntime,
    def: EntityDefRuntime,
    sceneManager: SceneManager,
  ) {
    this._instance = instance;
    this._def = def;
    this._sceneManager = sceneManager;

    this.x = instance.x;
    this.y = instance.y;
    this.width = instance.width;
    this.height = instance.height;

    // Merge instance field overrides with defaults
    this._fields = { ...instance.fields };

    if (def.sprite) {
      this._currentSheetId = def.sprite.sheetId;
      this._currentFrameId = def.sprite.frameId;
    }
  }

  // ── Identity ──────────────────────────────────────────────────────────────

  get id(): string {
    return this._instance.id;
  }

  get name(): string {
    return this._instance.name || this._def.name;
  }

  get templateId(): string {
    return this._def.id;
  }

  get position(): { x: number; y: number } {
    return { x: this.x, y: this.y };
  }

  // ── Fields ────────────────────────────────────────────────────────────────

  /** Get a field value, falling back to the default from the entity definition. */
  getField<T = unknown>(fieldId: string): T {
    if (fieldId in this._fields) {
      return this._fields[fieldId] as T;
    }
    const fieldDef = this._def.fields.find(f => f.id === fieldId);
    return (fieldDef?.default ?? undefined) as T;
  }

  /** Set a field value at runtime. */
  setField(fieldId: string, value: unknown): void {
    this._fields[fieldId] = value;
  }

  /** Check if a field has been explicitly set on this instance. */
  hasField(fieldId: string): boolean {
    return fieldId in this._fields;
  }

  // ── Sprite / Frame ────────────────────────────────────────────────────────

  /** Change the current display frame. */
  setFrame(frameId: string, sheetId?: string): void {
    this._currentFrameId = frameId;
    if (sheetId !== undefined) {
      this._currentSheetId = sheetId;
    }
  }

  /** Get the current sheet + frame for rendering. Returns null if none set. */
  getCurrentFrame(): { sheet: SpriteSheetRuntime; frame: FrameRuntime } | null {
    if (!this._currentSheetId || !this._currentFrameId) return null;

    const sheet = this._sceneManager.getSpriteSheet(this._currentSheetId);
    if (!sheet) return null;

    const frame = sheet.frames.get(this._currentFrameId);
    if (!frame) return null;

    return { sheet, frame };
  }

  get currentSheetId(): string | undefined {
    return this._currentSheetId;
  }

  get currentFrameId(): string | undefined {
    return this._currentFrameId;
  }

  // ── Collider ──────────────────────────────────────────────────────────────

  /**
   * Get the effective collider shapes for this entity.
   * Priority: entity def collider > current frame collider.
   */
  getCollider(): ColliderShapeRuntime[] | null {
    // Entity-definition-level collider takes priority
    if (this._def.collider !== undefined && this._def.collider !== null) {
      return this._def.collider;
    }

    // Fall back to the current frame's collider
    const currentFrame = this.getCurrentFrame();
    return currentFrame?.frame.collider ?? null;
  }

  // ── Bounds ────────────────────────────────────────────────────────────────

  /** Get the axis-aligned bounding box in world space. */
  getBounds(): { x: number; y: number; w: number; h: number } {
    return { x: this.x, y: this.y, w: this.width, h: this.height };
  }

  /** Check if a world-space point is inside this entity's bounds. */
  containsPoint(px: number, py: number): boolean {
    return px >= this.x && px <= this.x + this.width &&
           py >= this.y && py <= this.y + this.height;
  }

  // ── Convenience ───────────────────────────────────────────────────────────

  /** Centre X in world space. */
  get cx(): number { return this.x + this.width * 0.5; }

  /** Centre Y in world space. */
  get cy(): number { return this.y + this.height * 0.5; }

  /** Get the underlying entity definition. */
  getDef(): EntityDefRuntime { return this._def; }
}
