/**
 * canvas-loader.ts — Custom project loader for Canvas2D rendering.
 * Reads mote JSON files and creates ProjectRuntime-compatible data
 * with dummy GPU objects so SceneManager/Entity work, plus actual
 * HTMLImageElement references for Canvas2D rendering.
 */

import type {
  ProjectRuntime,
  SpriteSheetRuntime,
  EntityDefRuntime,
  SceneData,
  FrameRuntime,
  ColliderShapeRuntime,
} from '@mote/engine';

// We store HTMLImageElement separately for Canvas2D rendering
export interface Canvas2DAssets {
  images: Map<string, HTMLImageElement>; // sheetId -> loaded image
}

/**
 * Load a mote project and return both:
 * 1. A ProjectRuntime (with dummy GPU objects) for SceneManager/Entity compatibility
 * 2. Canvas2DAssets with actual HTMLImageElements for rendering
 */
export async function loadProject(
  projectUrl: string
): Promise<{ runtime: ProjectRuntime; assets: Canvas2DAssets }> {
  const basePath = projectUrl.substring(0, projectUrl.lastIndexOf('/') + 1);
  const project = await fetchJson(projectUrl);

  const images = new Map<string, HTMLImageElement>();
  const spriteSheets = new Map<string, SpriteSheetRuntime>();

  // Load sprite sheets
  for (const path of project.spriteSheets) {
    const json = await fetchJson(basePath + path);
    // Resolve the image URL relative to the sprite sheet JSON location
    const imgUrl = new URL(json.image, basePath + path).href;

    const img = await loadImage(imgUrl);
    images.set(json.id, img);

    // Create dummy GPU objects for engine compatibility
    const dummyTexture = {
      width: img.width,
      height: img.height,
      destroy() {},
    } as any;
    const dummyBindGroup = {} as any;
    const dummyAtlas = {
      texture: dummyTexture,
      bindGroup: dummyBindGroup,
      regions: new Map(),
      getRegion() {
        throw new Error('use canvas2d');
      },
      get fullRegion() {
        throw new Error('use canvas2d');
      },
    } as any;

    const frames = new Map<string, FrameRuntime>();
    for (const [id, data] of Object.entries(
      json.frames as Record<string, any>
    )) {
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
      slicing: json.slicing || { mode: 'none' },
    });
  }

  // Load entity defs
  const entityDefs = new Map<string, EntityDefRuntime>();
  for (const path of project.entities) {
    const json = await fetchJson(basePath + path);
    let sprite: { sheetId: string; frameId: string } | undefined;
    if (json.sprite) {
      const idx = json.sprite.indexOf(':');
      if (idx >= 0) {
        sprite = {
          sheetId: json.sprite.substring(0, idx),
          frameId: json.sprite.substring(idx + 1),
        };
      }
    }
    entityDefs.set(json.id, {
      id: json.id,
      name: json.name,
      sprite,
      shape: json.shape || 'point',
      width: json.width || 16,
      height: json.height || 16,
      collider: json.collider ?? null,
      fields: json.fields || [],
      scriptPath: json.script,
    });
  }

  // Load scenes
  const scenes = new Map<string, SceneData>();
  for (const path of project.scenes) {
    const json = await fetchJson(basePath + path);
    scenes.set(json.id, {
      id: json.id,
      name: json.name,
      width: json.width,
      height: json.height,
      tileWidth: json.tileWidth,
      tileHeight: json.tileHeight,
      spriteSheets: json.spriteSheets || [],
      layers: json.layers || [],
    });
  }

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

async function fetchJson(url: string): Promise<any> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.status}`);
  return res.json();
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    img.src = url;
  });
}
