// ═════════════════════════════════════════════════════════════════════════════
// ProjectLoader — loads project.mote.json and builds all runtime resources
// ═════════════════════════════════════════════════════════════════════════════

import type { IGfxDevice, IGfxTexture, IGfxBindGroupLayout } from './gfx/IGfxDevice.js';
import { TextureAtlas } from './gfx/SpriteBatch.js';
import type { AtlasRegion } from './gfx/SpriteBatch.js';

// ── Runtime types ─────────────────────────────────────────────────────────────

export interface ColliderShapeRuntime {
  type: 'full' | 'rect' | 'circle' | 'polygon' | 'slope';
  [key: string]: unknown;
}

export interface FrameRuntime {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  collider?: ColliderShapeRuntime[];
  tags?: string[];
  properties?: Record<string, unknown>;
}

export interface SpriteSheetRuntime {
  id: string;
  name: string;
  /** GPU-backed TextureAtlas for rendering via SpriteBatch */
  atlas: TextureAtlas;
  /** Raw IGfxTexture handle */
  texture: IGfxTexture;
  frames: Map<string, FrameRuntime>;
  slicing: { mode: string; tileWidth?: number; tileHeight?: number; [k: string]: any };
}

export interface EntityDefRuntime {
  id: string;
  name: string;
  sprite?: { sheetId: string; frameId: string };
  shape: 'point' | 'rect';
  width: number;
  height: number;
  collider?: ColliderShapeRuntime[] | null;
  fields: Array<{ id: string; type: string; default: unknown }>;
  scriptPath?: string;
}

export interface SceneData {
  id: string;
  name: string;
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  spriteSheets: string[];
  layers: any[];
}

export interface ProjectRuntime {
  name: string;
  tileWidth: number;
  tileHeight: number;
  spriteSheets: Map<string, SpriteSheetRuntime>;
  entityDefs: Map<string, EntityDefRuntime>;
  scenes: Map<string, SceneData>;
  startScene: string;
}

// ── JSON shapes (on-disk format) ──────────────────────────────────────────────

interface ProjectJson {
  name: string;
  version: string;
  engine: string;
  tileWidth: number;
  tileHeight: number;
  spriteSheets: string[];
  entities: string[];
  scenes: string[];
  scripts: string;
  startScene: string;
}

interface SpriteSheetJson {
  id: string;
  name: string;
  image: string;
  frames: Record<string, {
    x: number; y: number; w: number; h: number;
    collider?: ColliderShapeRuntime[];
    tags?: string[];
    properties?: Record<string, unknown>;
  }>;
  slicing: { mode: string; tileWidth?: number; tileHeight?: number; [k: string]: any };
}

interface EntityDefJson {
  id: string;
  name: string;
  sprite?: string;           // "sheetId:frameId"
  shape?: 'point' | 'rect';
  width?: number;
  height?: number;
  collider?: ColliderShapeRuntime[] | null;
  fields?: Array<{ id: string; type: string; default: unknown }>;
  script?: string;
}

interface SceneJson {
  id: string;
  name: string;
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  spriteSheets?: string[];
  layers?: any[];
}

// ── ProjectLoader ─────────────────────────────────────────────────────────────

export class ProjectLoader {
  private basePath = '';
  private readonly device: IGfxDevice;
  private readonly atlasLayout: IGfxBindGroupLayout;

  constructor(device: IGfxDevice, atlasLayout: IGfxBindGroupLayout) {
    this.device = device;
    this.atlasLayout = atlasLayout;
  }

  /**
   * Load and build a full ProjectRuntime from a project.mote.json URL.
   */
  async load(projectUrl: string): Promise<ProjectRuntime> {
    // Derive base path for resolving relative URLs
    this.basePath = projectUrl.substring(0, projectUrl.lastIndexOf('/') + 1);
    const projectJson = await this.fetchJson<ProjectJson>(projectUrl);

    // Load sprite sheets (parallelise for speed)
    const sheetEntries = await Promise.all(
      projectJson.spriteSheets.map(path => this.loadSpriteSheet(path)),
    );
    const spriteSheets = new Map<string, SpriteSheetRuntime>();
    for (const sheet of sheetEntries) {
      spriteSheets.set(sheet.id, sheet);
    }

    // Load entity definitions (parallelise)
    const entityEntries = await Promise.all(
      projectJson.entities.map(path => this.loadEntityDef(path)),
    );
    const entityDefs = new Map<string, EntityDefRuntime>();
    for (const def of entityEntries) {
      entityDefs.set(def.id, def);
    }

    // Load scenes (parallelise)
    const sceneEntries = await Promise.all(
      projectJson.scenes.map(path => this.loadScene(path)),
    );
    const scenes = new Map<string, SceneData>();
    for (const scene of sceneEntries) {
      scenes.set(scene.id, scene);
    }

    return {
      name: projectJson.name,
      tileWidth: projectJson.tileWidth,
      tileHeight: projectJson.tileHeight,
      spriteSheets,
      entityDefs,
      scenes,
      startScene: projectJson.startScene,
    };
  }

  // ── Sprite sheet loading ──────────────────────────────────────────────────

  private async loadSpriteSheet(path: string): Promise<SpriteSheetRuntime> {
    const json = await this.fetchJson<SpriteSheetJson>(this.basePath + path);

    // Resolve the image path relative to the sheet JSON file
    const imagePath = this.resolvePath(path, json.image);

    // Load GPU texture via the graphics device
    const texture = await this.device.loadTexture(imagePath);

    // Build bind group for SpriteBatch rendering
    const bindGroup = this.device.createBindGroup({
      layout: this.atlasLayout,
      entries: [
        { binding: 0, sampler: true },
        { binding: 1, texture },
      ],
    });

    const atlas = new TextureAtlas(texture, bindGroup);

    // Build frame map and register AtlasRegions on the atlas
    const frames = new Map<string, FrameRuntime>();
    const tw = texture.width;
    const th = texture.height;

    for (const [id, data] of Object.entries(json.frames)) {
      frames.set(id, {
        id,
        x: data.x,
        y: data.y,
        w: data.w,
        h: data.h,
        collider: data.collider,
        tags: data.tags,
        properties: data.properties,
      });
    }

    return {
      id: json.id,
      name: json.name,
      atlas,
      texture,
      frames,
      slicing: json.slicing ?? { mode: 'none' },
    };
  }

  // ── Entity def loading ────────────────────────────────────────────────────

  private async loadEntityDef(path: string): Promise<EntityDefRuntime> {
    const json = await this.fetchJson<EntityDefJson>(this.basePath + path);

    let sprite: { sheetId: string; frameId: string } | undefined;
    if (json.sprite) {
      const colonIdx = json.sprite.indexOf(':');
      if (colonIdx >= 0) {
        sprite = {
          sheetId: json.sprite.substring(0, colonIdx),
          frameId: json.sprite.substring(colonIdx + 1),
        };
      }
    }

    return {
      id: json.id,
      name: json.name,
      sprite,
      shape: json.shape ?? 'point',
      width: json.width ?? 16,
      height: json.height ?? 16,
      collider: json.collider ?? null,
      fields: json.fields ?? [],
      scriptPath: json.script,
    };
  }

  // ── Scene loading ─────────────────────────────────────────────────────────

  private async loadScene(path: string): Promise<SceneData> {
    const json = await this.fetchJson<SceneJson>(this.basePath + path);
    return {
      id: json.id,
      name: json.name,
      width: json.width,
      height: json.height,
      tileWidth: json.tileWidth,
      tileHeight: json.tileHeight,
      spriteSheets: json.spriteSheets ?? [],
      layers: json.layers ?? [],
    };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  private async fetchJson<T>(url: string): Promise<T> {
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`ProjectLoader: failed to fetch ${url} (HTTP ${res.status})`);
    }
    return res.json() as Promise<T>;
  }

  /**
   * Resolve a path relative to `fromPath`.
   * Example: resolvePath('sheets/player.json', './player.png')
   *       => basePath + 'sheets/player.png'
   */
  private resolvePath(fromPath: string, relativePath: string): string {
    // Strip leading './'
    const cleaned = relativePath.replace(/^\.\//, '');
    const dir = fromPath.substring(0, fromPath.lastIndexOf('/') + 1);
    return this.basePath + dir + cleaned;
  }
}
