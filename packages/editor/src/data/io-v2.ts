// ═══════════════════════════════════════════════════════════════
// io-v2.ts — New-format JSON read/write for Mote project files
// Converts between runtime types (SpriteSheet, EntityDef, Scene)
// and their on-disk JSON representations (formats.ts).
// ═══════════════════════════════════════════════════════════════

import type { ColliderShape } from './Collider';
import type {
  SpriteSheet,
  FrameData,
  Slicing,
  GridSlicing,
  PackedSlicing,
  XmlSlicing,
  ManualSlicing,
} from './SpriteSheet';
import type { EntityDef, EntityFieldDef, EntityInstance } from './EntityDef';
import type { Scene, TileLayerData, EntityLayerData, SceneLayer } from './Scene';
import { isTileLayer, isEntityLayer } from './Scene';
import type {
  ProjectJson,
  SpriteSheetJson,
  EntityDefJson,
  SceneJson,
  TileLayerJson,
  EntityLayerJson,
} from './formats';

// ── ProjectManifest (runtime type) ────────────────────────────

/** Runtime representation of the project manifest */
export interface ProjectManifest {
  name: string;
  version: string;
  engine: string;
  tileWidth: number;
  tileHeight: number;
  spriteSheetPaths: string[];
  entityPaths: string[];
  scenePaths: string[];
  scriptsDir: string;
  startScene: string;
}

// ═══════════════════════════════════════════════════════════════
// SpriteSheet <-> JSON
// ═══════════════════════════════════════════════════════════════

/** Convert a runtime SpriteSheet to its JSON representation */
export function spriteSheetToJson(sheet: SpriteSheet): SpriteSheetJson {
  // Use sourcePath (relative path) if available, otherwise fallback to image URL
  const imagePath = sheet.sourcePath ?? sheet.image;
  
  const slicing: SpriteSheetJson['slicing'] = { mode: sheet.slicing.mode };

  if (sheet.slicing.mode === 'grid') {
    const g = sheet.slicing as GridSlicing;
    slicing.tileWidth = g.tileWidth;
    slicing.tileHeight = g.tileHeight;
    if (g.margin !== undefined && g.margin !== 0) slicing.margin = g.margin;
    if (g.spacing !== undefined && g.spacing !== 0) slicing.spacing = g.spacing;
  } else if (sheet.slicing.mode === 'packed') {
    const p = sheet.slicing as PackedSlicing;
    if (p.source) slicing.source = p.source;
  } else if (sheet.slicing.mode === 'xml') {
    const x = sheet.slicing as XmlSlicing;
    if (x.source) slicing.source = x.source;
  }
  // 'manual' has no extra fields

  // Convert frames from Record to Array format (one frame per line in JSON)
  const frames: SpriteSheetJson['frames'] = [];
  for (const [frameId, frame] of Object.entries(sheet.frames)) {
    const entry: SpriteSheetJson['frames'][number] = {
      id: frameId,
      x: frame.x,
      y: frame.y,
      w: frame.w,
      h: frame.h,
    };
    if (frame.collider && frame.collider.length > 0) {
      entry.collider = frame.collider.map((c) => ({ ...c }));
    }
    if (frame.tags && frame.tags.length > 0) entry.tags = [...frame.tags];
    if (frame.properties && Object.keys(frame.properties).length > 0) {
      entry.properties = { ...frame.properties };
    }
    if (frame.trimmed !== undefined) entry.trimmed = frame.trimmed;
    if (frame.sourceWidth !== undefined) entry.sourceWidth = frame.sourceWidth;
    if (frame.sourceHeight !== undefined) entry.sourceHeight = frame.sourceHeight;
    if (frame.offsetX !== undefined) entry.offsetX = frame.offsetX;
    if (frame.offsetY !== undefined) entry.offsetY = frame.offsetY;
    if (frame.rotated !== undefined) entry.rotated = frame.rotated;
    frames.push(entry);
  }

  return {
    type: 'mote-sprite',
    version: '1.0.0',
    id: sheet.id,
    name: sheet.name,
    image: imagePath,
    slicing,
    frames,
  };
}

/**
 * Convert a SpriteSheetJson back to a runtime SpriteSheet.
 * @param json - The parsed JSON data
 * @param imageUrl - Runtime image URL (ObjectURL or data URL) for rendering
 */
export function spriteSheetFromJson(
  json: SpriteSheetJson,
  imageUrl: string,
): SpriteSheet {
  let slicing: Slicing;
  switch (json.slicing.mode) {
    case 'grid':
      slicing = {
        mode: 'grid',
        tileWidth: json.slicing.tileWidth ?? 16,
        tileHeight: json.slicing.tileHeight ?? 16,
        margin: json.slicing.margin,
        spacing: json.slicing.spacing,
      };
      break;
    case 'packed':
      slicing = {
        mode: 'packed',
        source: json.slicing.source,
      };
      break;
    case 'xml':
      slicing = {
        mode: 'xml',
        source: json.slicing.source,
      };
      break;
    case 'manual':
    default:
      slicing = { mode: 'manual' };
      break;
  }

  // Handle both array format (new) and object format (legacy)
  const frames: Record<string, FrameData> = {};
  const frameArray = Array.isArray(json.frames) 
    ? json.frames 
    : Object.entries(json.frames as Record<string, FrameData>).map(([id, f]) => ({ id, ...f }));
  
  for (const f of frameArray) {
    const frame: FrameData = {
      x: f.x,
      y: f.y,
      w: f.w,
      h: f.h,
    };
    if (f.collider && f.collider.length > 0) {
      frame.collider = f.collider as ColliderShape[];
    }
    if (f.tags && f.tags.length > 0) frame.tags = [...f.tags];
    if (f.properties && Object.keys(f.properties).length > 0) {
      frame.properties = { ...f.properties };
    }
    if (f.trimmed !== undefined) frame.trimmed = f.trimmed;
    if (f.sourceWidth !== undefined) frame.sourceWidth = f.sourceWidth;
    if (f.sourceHeight !== undefined) frame.sourceHeight = f.sourceHeight;
    if (f.offsetX !== undefined) frame.offsetX = f.offsetX;
    if (f.offsetY !== undefined) frame.offsetY = f.offsetY;
    if (f.rotated !== undefined) frame.rotated = f.rotated;
    frames[f.id] = frame;
  }

  // Compute imageWidth/imageHeight from frames if grid mode
  let imageWidth = 0;
  let imageHeight = 0;
  for (const f of Object.values(frames)) {
    imageWidth = Math.max(imageWidth, f.x + f.w);
    imageHeight = Math.max(imageHeight, f.y + f.h);
  }

  return {
    id: json.id,
    name: json.name,
    image: imageUrl,
    sourcePath: json.image, // Store original image path for export
    imageWidth,
    imageHeight,
    slicing,
    frames,
  };
}

// ═══════════════════════════════════════════════════════════════
// EntityDef <-> JSON
// ═══════════════════════════════════════════════════════════════

/** Convert a runtime EntityDef to its JSON representation */
export function entityDefToJson(def: EntityDef): EntityDefJson {
  const json: EntityDefJson = {
    id: def.id,
    name: def.name,
    shape: def.shape,
    width: def.width,
    height: def.height,
    resizable: def.resizable,
    color: def.color,
    icon: def.icon,
    fields: def.fields.map((f) => ({
      id: f.id,
      label: f.label,
      type: f.type,
      default: f.default,
    })),
  };
  if (def.sprite !== undefined) json.sprite = def.sprite;
  if (def.script !== undefined) json.script = def.script;
  if (def.collider !== undefined) {
    if (def.collider === null) {
      json.collider = null;
    } else {
      json.collider = def.collider.map((c) => ({ ...c }));
    }
  }
  return json;
}

/** Convert an EntityDefJson back to a runtime EntityDef */
export function entityDefFromJson(json: EntityDefJson): EntityDef {
  const def: EntityDef = {
    id: json.id,
    name: json.name,
    shape: json.shape,
    width: json.width,
    height: json.height,
    resizable: json.resizable,
    color: json.color,
    icon: json.icon,
    fields: json.fields.map((f) => ({
      id: f.id,
      label: f.label,
      type: f.type,
      default: f.default,
    })),
  };
  if (json.sprite !== undefined) def.sprite = json.sprite;
  if (json.script !== undefined) def.script = json.script;
  if (json.collider !== undefined) {
    if (json.collider === null) {
      def.collider = null;
    } else {
      def.collider = json.collider as ColliderShape[];
    }
  }
  return def;
}

// ═══════════════════════════════════════════════════════════════
// Scene <-> JSON
// ═══════════════════════════════════════════════════════════════

/** Convert a runtime Scene to its JSON representation */
export function sceneToJson(scene: Scene): SceneJson {
  const layers: SceneJson['layers'] = scene.layers.map((layer) => {
    if (isTileLayer(layer)) {
      const tileJson: TileLayerJson = {
        id: layer.id,
        name: layer.name,
        type: 'tile',
        visible: layer.visible,
        opacity: layer.opacity,
        locked: layer.locked,
        spriteSheet: layer.spriteSheet,
        encoding: layer.encoding,
        data: [...layer.data],
      };
      if (layer.encoding === 'indexed' && layer.frameIndex) {
        tileJson.frameIndex = [...layer.frameIndex];
      }
      return tileJson;
    } else {
      const entityJson: EntityLayerJson = {
        id: layer.id,
        name: layer.name,
        type: 'entity',
        visible: layer.visible,
        opacity: layer.opacity,
        locked: layer.locked,
        entities: (layer as EntityLayerData).entities.map((e) => {
          const entry: EntityLayerJson['entities'][number] = {
            id: e.id,
            template: e.template,
            name: e.name,
            x: e.x,
            y: e.y,
            width: e.width,
            height: e.height,
            fields: { ...e.fields },
          };
          if (e.colliderOverride !== undefined) {
            if (e.colliderOverride === null) {
              entry.colliderOverride = null;
            } else {
              entry.colliderOverride = e.colliderOverride.map((c) => ({ ...c }));
            }
          }
          return entry;
        }),
      };
      return entityJson;
    }
  });

  return {
    id: scene.id,
    name: scene.name,
    width: scene.width,
    height: scene.height,
    tileWidth: scene.tileWidth,
    tileHeight: scene.tileHeight,
    spriteSheets: [...scene.spriteSheets],
    layers,
  };
}

/** Convert a SceneJson back to a runtime Scene */
export function sceneFromJson(json: SceneJson): Scene {
  const layers: SceneLayer[] = json.layers.map((layerJson) => {
    if (layerJson.type === 'tile') {
      const tl = layerJson as TileLayerJson;
      const layer: TileLayerData = {
        type: 'tile',
        id: tl.id,
        name: tl.name,
        visible: tl.visible,
        opacity: tl.opacity,
        locked: tl.locked,
        spriteSheet: tl.spriteSheet,
        encoding: tl.encoding,
        data: tl.data.map((v) => String(v)),
      };
      if (tl.encoding === 'indexed' && tl.frameIndex) {
        layer.frameIndex = [...tl.frameIndex];
      }
      return layer;
    } else {
      const el = layerJson as EntityLayerJson;
      const layer: EntityLayerData = {
        type: 'entity',
        id: el.id,
        name: el.name,
        visible: el.visible,
        opacity: el.opacity,
        locked: el.locked,
        entities: el.entities.map((e) => {
          const instance: EntityInstance = {
            id: e.id,
            template: e.template,
            name: e.name,
            x: e.x,
            y: e.y,
            width: e.width,
            height: e.height,
            fields: { ...e.fields },
          };
          if (e.colliderOverride !== undefined) {
            if (e.colliderOverride === null) {
              instance.colliderOverride = null;
            } else {
              instance.colliderOverride = e.colliderOverride as ColliderShape[];
            }
          }
          return instance;
        }),
      };
      return layer;
    }
  });

  return {
    id: json.id,
    name: json.name,
    width: json.width,
    height: json.height,
    tileWidth: json.tileWidth,
    tileHeight: json.tileHeight,
    spriteSheets: [...json.spriteSheets],
    layers,
  };
}

// ═══════════════════════════════════════════════════════════════
// Project manifest <-> JSON
// ═══════════════════════════════════════════════════════════════

/** Convert a runtime ProjectManifest to its JSON representation */
export function projectToJson(project: ProjectManifest): ProjectJson {
  return {
    name: project.name,
    version: project.version,
    engine: project.engine,
    tileWidth: project.tileWidth,
    tileHeight: project.tileHeight,
    spriteSheets: [...project.spriteSheetPaths],
    entities: [...project.entityPaths],
    scenes: [...project.scenePaths],
    scripts: project.scriptsDir,
    startScene: project.startScene,
  };
}

/** Convert a ProjectJson back to a runtime ProjectManifest */
export function projectFromJson(json: ProjectJson): ProjectManifest {
  return {
    name: json.name,
    version: json.version,
    engine: json.engine,
    tileWidth: json.tileWidth,
    tileHeight: json.tileHeight,
    spriteSheetPaths: [...json.spriteSheets],
    entityPaths: [...json.entities],
    scenePaths: [...json.scenes],
    scriptsDir: json.scripts,
    startScene: json.startScene,
  };
}

// ═══════════════════════════════════════════════════════════════
// File utilities
// ═══════════════════════════════════════════════════════════════

/**
 * Download a JSON object as a file via browser download.
 * Creates a temporary <a> element and clicks it.
 */
export function downloadJson(data: unknown, filename: string): void {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Read a File object as parsed JSON.
 * Returns a Promise that resolves to the parsed object.
 */
export function readJsonFile(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(JSON.parse(reader.result as string));
      } catch (e) {
        reject(e);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// ═══════════════════════════════════════════════════════════════
// JSON type detection
// ═══════════════════════════════════════════════════════════════

/**
 * Detect the type of a JSON object based on its structure.
 * Handles both new v2 formats and legacy formats.
 */
export function detectJsonTypeV2(
  json: any,
): 'sprite' | 'entity' | 'scene' | 'project' | 'legacy-tileset' | 'legacy-tilemap' | 'unknown' {
  if (!json || typeof json !== 'object') return 'unknown';

  // ── New v2 formats ──────────────────────────────────────

  // SpriteSheet: has "slicing" and "frames" as a Record
  if (json.slicing && json.frames && typeof json.frames === 'object' && !Array.isArray(json.frames)) {
    return 'sprite';
  }

  // EntityDef: has "shape" ('point'|'rect') and "fields" array and no "layers"
  if (
    (json.shape === 'point' || json.shape === 'rect') &&
    Array.isArray(json.fields) &&
    !json.layers
  ) {
    return 'entity';
  }

  // Scene: has "layers" array and "tileWidth"/"tileHeight" and "spriteSheets"
  if (
    Array.isArray(json.layers) &&
    typeof json.tileWidth === 'number' &&
    typeof json.tileHeight === 'number' &&
    Array.isArray(json.spriteSheets)
  ) {
    return 'scene';
  }

  // Project: has "spriteSheets" (paths), "entities", "scenes" arrays and "engine"
  if (
    Array.isArray(json.spriteSheets) &&
    Array.isArray(json.entities) &&
    Array.isArray(json.scenes) &&
    typeof json.engine === 'string'
  ) {
    return 'project';
  }

  // ── Legacy formats ──────────────────────────────────────

  // Legacy TileSet: has "type": "mote-tileset" or has tileWidth/columns/rows/tileCount
  if (
    json.type === 'mote-tileset' ||
    (typeof json.tileWidth === 'number' &&
     typeof json.columns === 'number' &&
     typeof json.rows === 'number' &&
     typeof json.tileCount === 'number')
  ) {
    return 'legacy-tileset';
  }

  // Legacy TileMap: has "type": "mote-tilemap" or "mote-tilemap-bundle",
  // or has "tilesets" array with firstGid and "layers"
  if (
    json.type === 'mote-tilemap' ||
    json.type === 'mote-tilemap-bundle' ||
    (Array.isArray(json.tilesets) &&
     Array.isArray(json.layers) &&
     json.tilesets.length > 0 &&
     json.tilesets[0].firstGid !== undefined)
  ) {
    return 'legacy-tilemap';
  }

  return 'unknown';
}
