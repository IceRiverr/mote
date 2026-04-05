// ═════════════════════════════════════════════════════════════════════════════
// SceneManager — builds runtime scene from SceneData, resolves resources
// ═════════════════════════════════════════════════════════════════════════════

import type {
  ProjectRuntime,
  SceneData,
  SpriteSheetRuntime,
  EntityDefRuntime,
  FrameRuntime,
} from './ProjectLoader.js';

// ── Layer types ───────────────────────────────────────────────────────────────

export interface TileLayerRuntime {
  id: string;
  name: string;
  type: 'tile';
  visible: boolean;
  opacity: number;
  spriteSheet: string;
  /** Resolved frame IDs (always 'names' encoding after load) */
  data: string[];
  encoding: 'names';
  frameIndex?: string[];
}

export interface EntityInstanceRuntime {
  id: string;
  template: string;
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fields: Record<string, unknown>;
  scriptInstance?: unknown;
}

export interface EntityLayerRuntime {
  id: string;
  name: string;
  type: 'entity';
  visible: boolean;
  opacity: number;
  entities: EntityInstanceRuntime[];
}

export type LayerRuntime = TileLayerRuntime | EntityLayerRuntime;

export interface SceneRuntime {
  data: SceneData;
  layers: LayerRuntime[];
}

// ── SceneManager ──────────────────────────────────────────────────────────────

export class SceneManager {
  private project: ProjectRuntime;
  private currentScene: SceneRuntime | null = null;

  constructor(project: ProjectRuntime) {
    this.project = project;
  }

  /** Load and activate a scene by its ID. */
  loadScene(sceneId: string): SceneRuntime {
    const data = this.project.scenes.get(sceneId);
    if (!data) {
      throw new Error(`SceneManager: scene not found: ${sceneId}`);
    }

    const layers: LayerRuntime[] = data.layers.map((layerJson: any) => {
      if (layerJson.type === 'tile') {
        return this.buildTileLayer(layerJson);
      }
      return this.buildEntityLayer(layerJson);
    });

    this.currentScene = { data, layers };
    return this.currentScene;
  }

  /** Return the currently active scene, or null. */
  getCurrentScene(): SceneRuntime | null {
    return this.currentScene;
  }

  /** Resolve a frame ID to its runtime data. */
  resolveFrame(sheetId: string, frameId: string): FrameRuntime | undefined {
    const sheet = this.project.spriteSheets.get(sheetId);
    return sheet?.frames.get(frameId);
  }

  /** Get a loaded sprite sheet by ID. */
  getSpriteSheet(id: string): SpriteSheetRuntime | undefined {
    return this.project.spriteSheets.get(id);
  }

  /** Get an entity definition by ID. */
  getEntityDef(id: string): EntityDefRuntime | undefined {
    return this.project.entityDefs.get(id);
  }

  /** Get the underlying project runtime. */
  getProject(): ProjectRuntime {
    return this.project;
  }

  // ── Private builders ────────────────────────────────────────────────────

  private buildTileLayer(json: any): TileLayerRuntime {
    let data: string[] = json.data;

    // If the layer uses indexed encoding, resolve indices to frame names
    if (json.encoding === 'indexed' && json.frameIndex) {
      const index = json.frameIndex as string[];
      data = (json.data as number[]).map(idx =>
        idx >= 0 && idx < index.length ? index[idx] : '',
      );
    }

    return {
      id: json.id,
      name: json.name,
      type: 'tile',
      visible: json.visible ?? true,
      opacity: json.opacity ?? 1,
      spriteSheet: json.spriteSheet,
      data,
      encoding: 'names',
      frameIndex: json.frameIndex,
    };
  }

  private buildEntityLayer(json: any): EntityLayerRuntime {
    const entities: EntityInstanceRuntime[] = (json.entities ?? []).map(
      (e: any) => ({
        id: e.id,
        template: e.template,
        name: e.name ?? '',
        x: e.x,
        y: e.y,
        width: e.width ?? 16,
        height: e.height ?? 16,
        fields: e.fields ?? {},
      }),
    );

    return {
      id: json.id,
      name: json.name,
      type: 'entity',
      visible: json.visible ?? true,
      opacity: json.opacity ?? 1,
      entities,
    };
  }
}
