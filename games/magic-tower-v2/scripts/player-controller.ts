import { Entity } from '@mote/engine';
import type { ScriptLifecycle } from '@mote/engine';
import type { EngineContext } from '../src/engine-context';

export default class PlayerController implements ScriptLifecycle {
  private moveQueue: { dx: number; dy: number }[] = [];
  private isMoving = false;
  private moveProgress = 0;
  private moveSpeed = 6.5; // tiles per second
  private startX = 0;
  private startY = 0;
  private targetX = 0;
  private targetY = 0;

  constructor(private entity: Entity, private engine: EngineContext) {}

  /** Queue a directional move from keyboard input */
  queueMove(dx: number, dy: number): void {
    if (this.isMoving) return;
    this.tryMove(dx, dy);
  }

  update(dt: number): void {
    if (!this.isMoving) return;

    this.moveProgress += this.moveSpeed * dt;
    if (this.moveProgress >= 1) {
      // Movement complete
      this.entity.x = this.targetX;
      this.entity.y = this.targetY;
      this.isMoving = false;
      this.moveProgress = 0;

      // Update state
      const state = this.engine.state;
      state.playerX = this.targetX / 32;
      state.playerY = this.targetY / 32;

      // Post-move checks
      this.checkPostMove();
    } else {
      // Interpolate position
      this.entity.x =
        this.startX + (this.targetX - this.startX) * this.moveProgress;
      this.entity.y =
        this.startY + (this.targetY - this.startY) * this.moveProgress;
    }
  }

  private tryMove(dx: number, dy: number): void {
    const state = this.engine.state;
    const targetGX = state.playerX + dx;
    const targetGY = state.playerY + dy;

    // Update facing direction
    if (dx === 1) state.direction = 'right';
    else if (dx === -1) state.direction = 'left';
    else if (dy === -1) state.direction = 'up';
    else if (dy === 1) state.direction = 'down';

    // Update player sprite frame
    this.entity.setFrame(`player_${state.direction}`, 'characters');

    // Bounds check
    if (targetGX < 0 || targetGX >= 13 || targetGY < 0 || targetGY >= 13)
      return;

    // Check tile colliders (walls)
    const scene = this.engine.sceneManager.getCurrentScene();
    if (scene) {
      for (const layer of scene.layers) {
        if (layer.type === 'tile') {
          const tileLayer = layer as any;
          const frameId = tileLayer.data[targetGY * 13 + targetGX];
          const sheet = this.engine.sceneManager.getSpriteSheet(
            tileLayer.spriteSheet
          );
          if (sheet && frameId) {
            const frame = sheet.frames.get(frameId);
            if (frame?.collider && frame.collider.length > 0) {
              return; // Wall, can't move
            }
          }
        }
      }
    }

    // Check entity interactions at target tile
    const entitiesAtTarget = this.engine.getEntitiesAt(targetGX, targetGY);
    for (const e of entitiesAtTarget) {
      if (e === this.entity) continue;
      if (!e.visible) continue;

      // Check if entity has a collider (blocking entity like monster, door, NPC)
      const collider = e.getCollider();
      if (collider && collider.length > 0) {
        // This is a blocking entity — trigger interaction instead of moving
        this.engine.scriptRuntime.notifyInteract(e.id, this.entity);
        return;
      }
    }

    // Start smooth movement
    this.startX = this.entity.x;
    this.startY = this.entity.y;
    this.targetX = targetGX * 32;
    this.targetY = targetGY * 32;
    this.isMoving = true;
    this.moveProgress = 0;
  }

  private checkPostMove(): void {
    // Check for non-blocking entities at new position (items, lava, teleporter, triggers)
    const entities = this.engine.getEntitiesAt(
      this.engine.state.playerX,
      this.engine.state.playerY
    );
    for (const e of entities) {
      if (e === this.entity || !e.visible) continue;
      const collider = e.getCollider();
      if (!collider || collider.length === 0) {
        // Non-blocking entity: trigger interaction (pickup, lava damage, teleport, etc.)
        this.engine.scriptRuntime.notifyInteract(e.id, this.entity);
      }
    }
    this.engine.updateHUD();
  }

  get moving(): boolean {
    return this.isMoving;
  }
}
