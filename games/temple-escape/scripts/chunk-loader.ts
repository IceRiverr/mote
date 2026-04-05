/**
 * ChunkLoader — standalone class for infinite-runner chunk management.
 *
 * Not a ScriptLifecycle script.  Instantiate once from the main game loop
 * and call `update(cameraY)` every frame.
 *
 * Responsibilities:
 *   - Maintain a sliding window of active chunks with world-space offsets.
 *   - Pre-load chunks ahead of the camera so the player never sees blank space.
 *   - Unload (despawn) chunks that have scrolled off behind the camera.
 *   - Pick the next chunk from the pool, respecting difficulty & exit markers.
 *   - Track the current running direction for future turn-chunk support.
 */

// -- Types -----------------------------------------------------------------
interface SceneData {
  height: number; // height in tiles
  tileHeight: number; // pixel height of a single tile
}

interface SceneManager {
  loadScene?(sceneId: string): void;
  unloadScene?(sceneId: string): void;
}

interface Project {
  scenes: Map<string, SceneData>;
}

interface ActiveChunk {
  sceneId: string;
  worldOffsetY: number; // top-edge Y position in world space
  heightPx: number; // total height in pixels
  entities: unknown[]; // runtime entity references spawned from this chunk
}

type Direction = 'north' | 'south' | 'east' | 'west';

// -- Chunk Loader ----------------------------------------------------------
export class ChunkLoader {
  private sceneManager: SceneManager;
  private project: Project;

  /* -- Active chunk window ------------------------------------------------ */
  private activeChunks: ActiveChunk[] = [];

  /**
   * World-Y where the *top* of the next spawned chunk will sit.
   * Because the player runs northward (decreasing Y), new chunks are
   * placed at ever-lower Y values.
   */
  private nextSpawnY = 0;

  /* -- Chunk pool (scene IDs) --------------------------------------------- */
  private readonly chunkPool: string[] = [
    'chunk-straight-easy',
    'chunk-turn-left',
    'chunk-turn-right',
    'chunk-medium',
    'chunk-hard',
  ];

  /**
   * Difficulty-filtered sub-pools.
   * Value = minimum difficulty level required to include the chunk.
   */
  private readonly chunkMinDifficulty: Record<string, number> = {
    'chunk-straight-easy': 1,
    'chunk-turn-left': 1,
    'chunk-turn-right': 1,
    'chunk-medium': 2,
    'chunk-hard': 4,
  };

  /* -- Direction tracking (for turns) ------------------------------------- */
  private direction: Direction = 'north';

  /* -- Buffer distances (pixels) ------------------------------------------ */
  /** How far ahead of the camera to keep chunks loaded. */
  private readonly loadAheadDistance = 640; // ~2 full screens
  /** How far behind the camera before a chunk is eligible for unloading. */
  private readonly unloadBehindDistance = 320;

  // ------------------------------------------------------------------------
  constructor(sceneManager: SceneManager, project: Project) {
    this.sceneManager = sceneManager;
    this.project = project;
  }

  /* -----------------------------------------------------------------------
   * init — spawn the first few chunks so the player has ground to
   *        land on right from the start.
   * ----------------------------------------------------------------------- */
  init(): void {
    this.spawnChunk('chunk-straight-easy');
    this.spawnChunk('chunk-straight-easy');
    this.spawnChunk('chunk-medium');
  }

  /* -----------------------------------------------------------------------
   * update — call every frame with the current camera Y.
   *
   *  1. Spawns new chunks ahead until the buffer is satisfied.
   *  2. Removes chunks that have scrolled behind the camera.
   * ----------------------------------------------------------------------- */
  update(cameraY: number, difficultyLevel: number = 1): void {
    // -- Pre-load chunks ahead --------------------------------------------
    while (this.nextSpawnY > cameraY - this.loadAheadDistance) {
      const nextId = this.pickNextChunk(difficultyLevel);
      this.spawnChunk(nextId);
    }

    // -- Unload chunks behind ---------------------------------------------
    this.activeChunks = this.activeChunks.filter((chunk) => {
      const chunkBottomY = chunk.worldOffsetY + chunk.heightPx;
      if (chunkBottomY < cameraY - this.unloadBehindDistance) {
        // Already scrolled past -- safe to unload
        return false;
      }
      return true;
    });
  }

  /* -----------------------------------------------------------------------
   * spawnChunk — place a chunk at `nextSpawnY` and advance the
   *              spawn cursor upward.
   * ----------------------------------------------------------------------- */
  private spawnChunk(sceneId: string): void {
    const sceneData = this.project.scenes.get(sceneId);
    if (!sceneData) {
      console.warn(`[ChunkLoader] Scene "${sceneId}" not found -- skipping.`);
      return;
    }

    const heightPx = sceneData.height * sceneData.tileHeight;
    const worldOffsetY = this.nextSpawnY - heightPx;

    this.activeChunks.push({
      sceneId,
      worldOffsetY,
      heightPx,
      entities: [],
    });

    // Advance spawn cursor upward (negative Y)
    this.nextSpawnY = worldOffsetY;
  }

  /* -----------------------------------------------------------------------
   * pickNextChunk — select the next chunk from the pool.
   *
   * Selection criteria:
   *   - Only include chunks whose min-difficulty <= current level.
   *   - Weighted random (harder chunks slightly more likely at higher
   *     difficulty so the game stays challenging).
   *   - Avoids repeating the same chunk twice in a row when possible.
   * ----------------------------------------------------------------------- */
  private pickNextChunk(difficultyLevel: number): string {
    const eligible = this.chunkPool.filter(
      (id) => (this.chunkMinDifficulty[id] ?? 1) <= difficultyLevel,
    );

    if (eligible.length === 0) {
      // Fallback -- should never happen if pool is set up correctly
      return 'chunk-straight-easy';
    }

    // Avoid immediate repeat when possible
    const lastChunk =
      this.activeChunks.length > 0
        ? this.activeChunks[this.activeChunks.length - 1].sceneId
        : null;

    const candidates =
      eligible.length > 1
        ? eligible.filter((id) => id !== lastChunk)
        : eligible;

    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  // -- Public accessors ----------------------------------------------------
  getActiveChunks(): ReadonlyArray<ActiveChunk> {
    return this.activeChunks;
  }

  getDirection(): Direction {
    return this.direction;
  }

  setDirection(dir: Direction): void {
    this.direction = dir;
  }

  getNextSpawnY(): number {
    return this.nextSpawnY;
  }
}
