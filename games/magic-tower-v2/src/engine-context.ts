/**
 * engine-context.ts — The engine reference passed to all scripts.
 * Provides access to game state, scene management, entity queries, UI, etc.
 */

import type { SceneManager, Entity, ScriptRuntime, CollisionSystem } from '@mote/engine';
import type { GameState } from './game-state';

export interface DialogButton {
  label: string;
  action: () => void | Promise<void>;
}

export class EngineContext {
  readonly sceneManager: SceneManager;
  readonly scriptRuntime: ScriptRuntime;
  state: GameState;

  // All live Entity instances on the current floor
  private _entities: Entity[] = [];
  private _player: Entity | null = null;
  private _currentSceneId: string = '';

  // Callbacks set by main.ts
  private _showDialogFn: ((title: string, content: string, buttons?: DialogButton[]) => void) | null = null;
  private _updateHUDFn: (() => void) | null = null;
  private _loadSceneFn: ((sceneId: string) => Promise<void>) | null = null;
  private _startMoveFn: ((targetGridX: number, targetGridY: number) => void) | null = null;

  constructor(sceneManager: SceneManager, scriptRuntime: ScriptRuntime, state: GameState) {
    this.sceneManager = sceneManager;
    this.scriptRuntime = scriptRuntime;
    this.state = state;
  }

  // --- Entity Management ---

  get entities(): readonly Entity[] { return this._entities; }
  set entities(list: Entity[]) { this._entities = list; }

  get player(): Entity | null { return this._player; }
  set player(p: Entity | null) { this._player = p; }

  get currentSceneId(): string { return this._currentSceneId; }
  set currentSceneId(id: string) { this._currentSceneId = id; }

  /** Find all entities at a grid position (checking AABB overlap with the 32x32 tile) */
  getEntitiesAt(gridX: number, gridY: number): Entity[] {
    const px = gridX * 32;
    const py = gridY * 32;
    return this._entities.filter(e =>
      e.visible &&
      e.x < px + 32 && e.x + e.width > px &&
      e.y < py + 32 && e.y + e.height > py
    );
  }

  /** Find entity by ID */
  getEntityById(id: string): Entity | undefined {
    return this._entities.find(e => e.id === id);
  }

  /** Remove an entity from the scene (hide it and mark as removed in state) */
  removeEntity(entity: Entity): void {
    entity.visible = false;
    if (!this.state.removedEntities.has(this._currentSceneId)) {
      this.state.removedEntities.set(this._currentSceneId, new Set());
    }
    this.state.removedEntities.get(this._currentSceneId)!.add(entity.id);
  }

  /** Check if an entity has been removed */
  isEntityRemoved(sceneId: string, entityId: string): boolean {
    return this.state.removedEntities.get(sceneId)?.has(entityId) ?? false;
  }

  // --- UI Callbacks (set by main.ts) ---

  onShowDialog(fn: (title: string, content: string, buttons?: DialogButton[]) => void): void {
    this._showDialogFn = fn;
  }
  onUpdateHUD(fn: () => void): void { this._updateHUDFn = fn; }
  onLoadScene(fn: (sceneId: string) => Promise<void>): void { this._loadSceneFn = fn; }
  onStartMove(fn: (gx: number, gy: number) => void): void { this._startMoveFn = fn; }

  showDialog(title: string, content: string, buttons?: DialogButton[]): void {
    this._showDialogFn?.(title, content, buttons);
  }

  updateHUD(): void { this._updateHUDFn?.(); }

  async loadScene(sceneId: string): Promise<void> {
    if (this._loadSceneFn) await this._loadSceneFn(sceneId);
  }

  startPlayerMove(targetGridX: number, targetGridY: number): void {
    this._startMoveFn?.(targetGridX, targetGridY);
  }
}
