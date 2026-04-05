/**
 * canvas-loader.ts — Custom project loader for Canvas2D rendering.
 * Reads mote JSON files and creates ProjectRuntime-compatible data
 * with dummy GPU objects so SceneManager/Entity work, plus actual
 * HTMLImageElement references for Canvas2D rendering.
 *
 * Key difference from magic-tower: the scenes array in project.mote.json
 * is empty — scenes are generated at runtime from track data files.
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

  // Resolve image URLs relative to each sheet JSON path, then load in parallel
  const imgUrls: string[] = sheetJsons.map((json, i) => {
    const sheetPath = project.spriteSheets[i];
    return new URL(json.image, basePath + sheetPath).href;
  });

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

  // ── Scenes — empty for road-rash (generated at runtime from tracks) ───

  const scenes = new Map<string, SceneData>();
  // project.scenes is [] for road-rash; we leave the map empty.
  // Tracks are loaded separately via track-data.ts and injected into the runtime.

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
