// ═══════════════════════════════════════════════════════════════
// io-v2.ts — SpriteSheet JSON read/write for Mote project files
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

// ═══════════════════════════════════════════════════════════════
// JSON Types
// ═══════════════════════════════════════════════════════════════

export interface SpriteSheetJson {
  type: 'mote-sprite';
  version: string;
  id: string;
  name: string;
  image: string;
  slicing: {
    mode: 'grid' | 'packed' | 'xml' | 'manual';
    tileWidth?: number;
    tileHeight?: number;
    margin?: number;
    spacing?: number;
    source?: string;
  };
  frames: Array<{
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    collider?: ColliderShape[];
    tags?: string[];
    properties?: Record<string, unknown>;
    trimmed?: boolean;
    sourceWidth?: number;
    sourceHeight?: number;
    offsetX?: number;
    offsetY?: number;
    rotated?: boolean;
  }>;
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
 */
export function detectJsonTypeV2(
  json: any,
): 'sprite' | 'unknown' {
  if (!json || typeof json !== 'object') return 'unknown';

  // SpriteSheet: has "slicing" and "frames" as a Record
  if (json.slicing && json.frames && typeof json.frames === 'object' && !Array.isArray(json.frames)) {
    return 'sprite';
  }

  return 'unknown';
}
