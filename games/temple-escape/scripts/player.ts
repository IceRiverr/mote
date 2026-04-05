/**
 * PlayerScript — ScriptLifecycle script attached to the player entity.
 *
 * Handles:
 *   - 3-lane movement with smooth interpolation
 *   - Jump (parabolic, visual offset only)
 *   - Slide (duck under overhead obstacles)
 *   - Invincibility frames after taking damage
 *   - Sprite animation cycling
 *   - Camera follow
 *   - Collision response (gems, boosts, traps, chaser)
 *
 * Lane layout (chunk is 5 tiles = 80 px wide, tiles 16 px each):
 *   col 0 = 0   col 1 = 16   col 2 = 32   col 3 = 48   col 4 = 64
 *   Lane centres -> left = 24,  center = 40,  right = 56
 */

// -- Types (inlined so the file is self-contained) -------------------------
interface Entity {
  x: number;
  y: number;
  width: number;
  height: number;
  id: string;
  name: string;
  templateId: string;
  visible: boolean;
  getField<T>(fieldId: string): T | undefined;
  setField(fieldId: string, value: unknown): void;
  setFrame(frameId: string, sheetId?: string): void;
  getCurrentFrame(): string;
  getCollider(): unknown;
  getBounds(): { x: number; y: number; w: number; h: number };
  cx: number;
  cy: number;
}

interface EngineContext {
  input: {
    action(name: string): {
      pressed: boolean;
      held: boolean;
      vec2(): { x: number; y: number };
    };
  };
  camera: {
    follow(target: { x: number; y: number }, lerpFactor: number): void;
    shake(intensity: number, duration: number): void;
    position: { x: number; y: number };
    zoom: number;
    rotation: number;
    update(dt: number): void;
  };
  gameManager: {
    gameOver: boolean;
    paused: boolean;
    speed: number;
    addScore(points: number): void;
    hitObstacle(): void;
  };
  dt: number;
}

// -- Player States ---------------------------------------------------------
type PlayerState = 'running' | 'jumping' | 'sliding' | 'damaged';

// -- Script ----------------------------------------------------------------
export default class PlayerScript {
  private entity: Entity;
  private engine: EngineContext;

  /* -- Lane system -------------------------------------------------------- */
  private lane = 1; // 0 = left, 1 = center, 2 = right
  private targetLane = 1;
  private readonly laneX = [24, 40, 56]; // pixel centres per lane
  private readonly laneSpeed = 200; // px / sec for lane switching

  /* -- Jump --------------------------------------------------------------- */
  private jumpVelocity = 0;
  private jumpHeight = 0; // visual-only Y offset (negative = up)
  private isJumping = false;
  private readonly gravity = 800; // px / sec^2

  /* -- Slide -------------------------------------------------------------- */
  private isSliding = false;
  private slideTimer = 0;
  private readonly slideDuration = 0.6;

  /* -- Invincibility ------------------------------------------------------ */
  private invincible = false;
  private invincibleTimer = 0;
  private readonly invincibleDuration = 1.5;

  /* -- Animation ---------------------------------------------------------- */
  private animTimer = 0;
  private animFrame = 0;
  private readonly runFrames = [
    'player_run_1',
    'player_run_2',
    'player_run_3',
    'player_run_2',
  ];

  /* -- Boost bookkeeping -------------------------------------------------- */
  private activeBoostTimers: number[] = [];

  // ------------------------------------------------------------------------
  constructor(entity: Entity, engine: EngineContext) {
    this.entity = entity;
    this.engine = engine;

    // Start in centre lane
    this.entity.x = this.laneX[this.lane];
  }

  // -- Main update (called every frame) ------------------------------------
  update(dt: number): void {
    const gm = this.engine.gameManager;
    if (gm.gameOver || gm.paused) return;

    this.handleLaneInput();
    this.updateLanePosition(dt);
    this.handleJump(dt);
    this.handleSlide(dt);
    this.updateInvincibility(dt);
    this.updateAnimation(dt);
    this.updateCamera();
  }

  /* -- Input: lane switching (press-only, not hold) ----------------------- */
  private handleLaneInput(): void {
    const input = this.engine.input;

    if (input.action('MoveLeft').pressed && this.lane > 0) {
      this.targetLane = this.lane - 1;
    }
    if (input.action('MoveRight').pressed && this.lane < 2) {
      this.targetLane = this.lane + 1;
    }
  }

  /* -- Smooth lane interpolation ------------------------------------------ */
  private updateLanePosition(dt: number): void {
    const targetX = this.laneX[this.targetLane];
    const dx = targetX - this.entity.x;

    if (Math.abs(dx) > 1) {
      this.entity.x += Math.sign(dx) * this.laneSpeed * dt;
      // Snap when close enough
      if (Math.abs(this.entity.x - targetX) < 2) {
        this.entity.x = targetX;
        this.lane = this.targetLane;
      }
    } else {
      this.entity.x = targetX;
      this.lane = this.targetLane;
    }
  }

  /* -- Jump (parabolic, visual offset) ------------------------------------ */
  private handleJump(dt: number): void {
    const input = this.engine.input;

    // Initiate jump
    if (input.action('Jump').pressed && !this.isJumping && !this.isSliding) {
      this.isJumping = true;
      this.jumpVelocity =
        -(this.entity.getField<number>('jumpForce') ?? 280);
    }

    // Integrate while airborne
    if (this.isJumping) {
      this.jumpHeight += this.jumpVelocity * dt;
      this.jumpVelocity += this.gravity * dt;

      // Landed
      if (this.jumpHeight >= 0) {
        this.jumpHeight = 0;
        this.jumpVelocity = 0;
        this.isJumping = false;
      }
    }
  }

  /* -- Slide -------------------------------------------------------------- */
  private handleSlide(dt: number): void {
    const input = this.engine.input;

    if (input.action('Slide').pressed && !this.isJumping && !this.isSliding) {
      this.isSliding = true;
      this.slideTimer = this.slideDuration;
    }

    if (this.isSliding) {
      this.slideTimer -= dt;
      if (this.slideTimer <= 0) {
        this.isSliding = false;
      }
    }
  }

  /* -- Invincibility cooldown --------------------------------------------- */
  private updateInvincibility(dt: number): void {
    if (this.invincible) {
      this.invincibleTimer -= dt;
      if (this.invincibleTimer <= 0) {
        this.invincible = false;
      }
    }
  }

  /* -- Sprite animation --------------------------------------------------- */
  private updateAnimation(dt: number): void {
    if (this.isJumping) {
      this.entity.setFrame('player_jump', 'characters');
      return;
    }

    if (this.isSliding) {
      this.entity.setFrame('player_slide', 'characters');
      return;
    }

    // Running cycle
    this.animTimer += dt;
    if (this.animTimer > 0.1) {
      this.animTimer = 0;
      this.animFrame = (this.animFrame + 1) % this.runFrames.length;
    }
    this.entity.setFrame(this.runFrames[this.animFrame], 'characters');
  }

  /* -- Camera tracking ---------------------------------------------------- */
  private updateCamera(): void {
    this.engine.camera.follow(
      { x: 40, y: this.entity.y + this.jumpHeight - 80 },
      0.1,
    );
  }

  // -- Collision handling --------------------------------------------------
  onCollisionEnter(other: Entity): void {
    if (this.invincible) return;

    const templateId = other.templateId;

    // -- Collectibles -----------------------------------------------------
    if (templateId === 'gem') {
      const value = other.getField<number>('value') ?? 10;
      this.engine.gameManager.addScore(value);
      other.visible = false;
      return;
    }

    if (templateId === 'speed_boost') {
      this.applySpeedBoost(other);
      other.visible = false;
      return;
    }

    // -- Hazards ----------------------------------------------------------
    if (
      templateId === 'spike_trap' ||
      templateId === 'fire_trap' ||
      templateId === 'stone_pillar'
    ) {
      this.takeDamage();
      return;
    }

    // -- Chaser catch -> instant game over --------------------------------
    if (templateId === 'chaser') {
      this.engine.gameManager.gameOver = true;
    }
  }

  /* -- Speed boost pickup ------------------------------------------------- */
  private applySpeedBoost(pickup: Entity): void {
    const boost = pickup.getField<number>('boost') ?? 1.5;
    const duration = pickup.getField<number>('duration') ?? 3;
    const gm = this.engine.gameManager;

    gm.speed *= boost;

    const timer = window.setTimeout(() => {
      gm.speed /= boost;
      const idx = this.activeBoostTimers.indexOf(timer);
      if (idx !== -1) this.activeBoostTimers.splice(idx, 1);
    }, duration * 1000) as unknown as number;

    this.activeBoostTimers.push(timer);
  }

  /* -- Damage / hit logic ------------------------------------------------- */
  private takeDamage(): void {
    if (this.invincible) return;

    this.invincible = true;
    this.invincibleTimer = this.invincibleDuration;

    this.engine.gameManager.hitObstacle();
    this.engine.camera.shake(3, 0.3);
  }

  // -- Cleanup -------------------------------------------------------------
  onDestroy(): void {
    // Clear any lingering boost timers
    for (const t of this.activeBoostTimers) {
      clearTimeout(t);
    }
    this.activeBoostTimers = [];
  }

  // -- Public read-only accessors (for UI / other scripts) -----------------
  get currentJumpHeight(): number {
    return this.jumpHeight;
  }
  get currentLane(): number {
    return this.lane;
  }
  get isPlayerInvincible(): boolean {
    return this.invincible;
  }
  get state(): PlayerState {
    if (this.isJumping) return 'jumping';
    if (this.isSliding) return 'sliding';
    if (this.invincible) return 'damaged';
    return 'running';
  }
}
