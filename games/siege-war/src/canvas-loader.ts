/**
 * canvas-loader.ts — Custom project loader for Canvas2D rendering.
 * Reads mote JSON files and creates ProjectRuntime-compatible data
 * with dummy GPU objects so SceneManager/Entity work, plus actual
 * HTMLImageElement references for Canvas2D rendering.
 *
 * Siege War extension: also loads level config JSON files from data/ directory
 * for campaign and per-level configuration.
 */

import type {
  ProjectRuntime,
  SpriteSheetRuntime,
  EntityDefRuntime,
  SceneData,
  FrameRuntime,
  ColliderShapeRuntime,
} from '@mote/engine';

// ── Public types ──────────────────────────────────────────────────────────────

/** HTMLImageElement storage for Canvas2D drawing. */
export interface Canvas2DAssets {
  images: Map<string, HTMLImageElement>; // sheetId -> loaded HTMLImageElement
}

/** On-disk level configuration for a single battle level. */
export interface LevelConfigJson {
  name: string;
  scene: string;
  side: 'attacker' | 'defender';
  budget: number;
  rounds: number;
  tutorialFlags?: string[];
  enemyWaves: Array<{
    round: number;
    type: string;
    count: number;
    ladders?: number;
    rams?: number;
    towers?: number;
    tunnels?: number;
  }>;
  winCondition: { type: string; rounds?: number; [k: string]: unknown };
  loseConditions: Array<{ type: string; threshold?: number; [k: string]: unknown }>;
  stars: Array<{ condition: string; label: string; value?: number }>;
  availableUnits: string[];
  availableEquipment: string[];
}

/** Campaign chapter definition. */
export interface ChapterJson {
  id: string;
  name: string;
  subtitle?: string;
  levels: string[];
}

/** Top-level levels.json structure. */
export interface LevelsDataJson {
  campaign: {
    chapters: ChapterJson[];
  };
  levels: Record<string, LevelConfigJson>;
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
  imageWidth: number;
  imageHeight: number;
  slicing: { mode: string; tileWidth?: number; tileHeight?: number; [k: string]: unknown };
  frames: Record<
    string,
    {
      x: number;
      y: number;
      w: number;
      h: number;
      collider?: ColliderShapeRuntime[];
      tags?: string[];
      properties?: Record<string, unknown>;
    }
  >;
}

interface EntityDefJson {
  id: string;
  name: string;
  sprite?: string | null; // "sheetId:frameId" or null
  shape?: 'point' | 'rect';
  width?: number;
  height?: number;
  collider?: ColliderShapeRuntime[] | null;
  fields?: Array<{ id: string; type: string; default: unknown }>;
  script?: string;
}

// ── Main loader ───────────────────────────────────────────────────────────────

/**
 * Load a mote project and return both:
 *  1. A ProjectRuntime (with dummy GPU objects) for SceneManager/Entity compatibility
 *  2. Canvas2DAssets with actual HTMLImageElements for rendering
 */
export async function loadProject(
  projectUrl: string,
): Promise<{ runtime: ProjectRuntime; assets: Canvas2DAssets }> {
  const basePath = projectUrl.substring(0, projectUrl.lastIndexOf('/') + 1);
  const project = await fetchJson<ProjectJson>(projectUrl);

  const images = new Map<string, HTMLImageElement>();
  const spriteSheets = new Map<string, SpriteSheetRuntime>();

  // ── Load sprite sheets (parallel) ─────────────────────────────────────

  const sheetJsons = await Promise.all(
    project.spriteSheets.map((path) => fetchJson<SpriteSheetJson>(basePath + path)),
  );

  // Resolve image URLs (image path is relative to project root)
  const imgUrls: string[] = sheetJsons.map((json) => basePath + json.image);

  const loadedImgs = await Promise.all(imgUrls.map(loadImage));

  for (let i = 0; i < sheetJsons.length; i++) {
    const json = sheetJsons[i];
    const img = loadedImgs[i];

    images.set(json.id, img);

    // Create dummy GPU objects so engine types are satisfied
    const dummyTexture = {
      width: img.width,
      height: img.height,
      destroy(): void {
        /* noop */
      },
    } as any;

    const dummyBindGroup = {} as any;

    const dummyAtlas = {
      texture: dummyTexture,
      bindGroup: dummyBindGroup,
      regions: new Map(),
      getRegion(): never {
        throw new Error('Canvas2D mode — use drawImage instead');
      },
      get fullRegion(): never {
        throw new Error('Canvas2D mode — use drawImage instead');
      },
    } as any;

    // Build frame map
    const frames = new Map<string, FrameRuntime>();
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

    spriteSheets.set(json.id, {
      id: json.id,
      name: json.name || json.id,
      atlas: dummyAtlas,
      texture: dummyTexture,
      frames,
      slicing: json.slicing ?? { mode: 'none' },
    });
  }

  // ── Load entity definitions (parallel) ────────────────────────────────

  const defJsons = await Promise.all(
    project.entities.map((path) => fetchJson<EntityDefJson>(basePath + path)),
  );

  const entityDefs = new Map<string, EntityDefRuntime>();
  for (const json of defJsons) {
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

    entityDefs.set(json.id, {
      id: json.id,
      name: json.name,
      sprite,
      shape: json.shape ?? 'point',
      width: json.width ?? 16,
      height: json.height ?? 16,
      collider: json.collider ?? null,
      fields: json.fields ?? [],
      scriptPath: json.script,
    });
  }

  // ── Scenes — loaded from project if present, or empty for runtime gen ─

  const scenes = new Map<string, SceneData>();
  for (const scenePath of project.scenes) {
    try {
      const sceneData = await fetchJson<SceneData>(basePath + scenePath);
      if (sceneData && typeof sceneData === 'object' && 'id' in sceneData) {
        scenes.set((sceneData as any).id ?? scenePath, sceneData);
      }
    } catch {
      // Scene files are optional for siege-war; levels may be generated at runtime
    }
  }

  // ── Assemble ProjectRuntime ───────────────────────────────────────────

  const runtime: ProjectRuntime = {
    name: project.name,
    tileWidth: project.tileWidth,
    tileHeight: project.tileHeight,
    spriteSheets,
    entityDefs,
    scenes,
    startScene: project.startScene,
  };

  return { runtime, assets: { images } };
}

// ── Level config loader ───────────────────────────────────────────────────────

/**
 * Load the campaign and level configuration data from data/levels.json.
 * This file contains the full campaign chapter structure and per-level definitions.
 *
 * @param basePath - Base URL to the project directory (should end with '/')
 * @returns Parsed LevelsDataJson with campaign chapters and level configs
 */
export async function loadLevelsData(basePath: string): Promise<LevelsDataJson> {
  const normalizedBase = basePath.endsWith('/') ? basePath : basePath + '/';
  return fetchJson<LevelsDataJson>(normalizedBase + 'data/levels.json');
}

/**
 * Load a single level's configuration by its level ID.
 * First loads the full levels data, then extracts the requested level.
 *
 * @param basePath - Base URL to the project directory
 * @param levelId - Level identifier (e.g. "level-01")
 * @returns The LevelConfigJson for the requested level
 * @throws Error if the level ID is not found
 */
export async function loadLevelConfig(
  basePath: string,
  levelId: string,
): Promise<LevelConfigJson> {
  const levelsData = await loadLevelsData(basePath);
  const config = levelsData.levels[levelId];
  if (!config) {
    throw new Error(`Level config not found for level "${levelId}"`);
  }
  return config;
}

/**
 * Load an arbitrary JSON data file from the data/ directory.
 * Useful for loading unit templates, equipment configs, and other data files.
 *
 * @param basePath - Base URL to the project directory
 * @param fileName - File name relative to data/ (e.g. "unit-templates.json")
 * @returns Parsed JSON content
 */
export async function loadDataFile<T>(basePath: string, fileName: string): Promise<T> {
  const normalizedBase = basePath.endsWith('/') ? basePath : basePath + '/';
  return fetchJson<T>(normalizedBase + 'data/' + fileName);
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}
