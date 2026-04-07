/**
 * SpriteSheet import helpers — replaces atlas-import.ts
 * Creates new-format SpriteSheet directly for all import modes:
 *   1. Grid (Tile Sheet) — uniform grid slicing
 *   2. Packed (TexturePacker JSON)
 *   3. XML (Sparrow/Starling)
 *   4. Loose Files — individual PNGs packed into atlas
 */

import type { SpriteSheet, FrameData, Slicing } from "./SpriteSheet";
import type { TexturePackerJson } from "./SpriteAtlas";
import {
  parseSparrowXml,
  packLooseImages,
} from "./SpriteAtlas";
import { spriteSheetFromJson } from "./io-v2";

/** Load an image from a File object */
function loadImageFromFile(file: File): Promise<{ url: string; img: HTMLImageElement }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ url, img });
    img.onerror = reject;
    img.src = url;
  });
}

/** Load image from data URL */
function loadImageFromDataUrl(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/** Read a file as JSON */
function readJsonFile(file: File): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try { resolve(JSON.parse(reader.result as string)); }
      catch (e) { reject(e); }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

/** Read a file as text */
function readTextFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// ============================================================
// Mode 1: Grid (Tile Sheet)
// ============================================================
export async function importGridSpriteSheet(
  imageFile: File,
  tileWidth: number,
  tileHeight: number,
  margin = 0,
  spacing = 0,
  name?: string,
  sourcePath?: string,
): Promise<{ sheet: SpriteSheet; img: HTMLImageElement }> {
  const { url, img } = await loadImageFromFile(imageFile);
  const sheetName = name ?? imageFile.name.replace(/\.[^.]+$/, "");
  const id = `sheet_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const imageWidth = img.naturalWidth;
  const imageHeight = img.naturalHeight;

  const columns = Math.floor(
    (imageWidth - margin * 2 + spacing) / (tileWidth + spacing)
  );
  const rows = Math.floor(
    (imageHeight - margin * 2 + spacing) / (tileHeight + spacing)
  );

  const frames: Record<string, FrameData> = {};
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const idx = row * columns + col;
      const frameId = `frame_${idx}`;
      frames[frameId] = {
        x: margin + col * (tileWidth + spacing),
        y: margin + row * (tileHeight + spacing),
        w: tileWidth,
        h: tileHeight,
      };
    }
  }

  const sheet: SpriteSheet = {
    id,
    name: sheetName,
    image: url,
    sourcePath: sourcePath ?? imageFile.name, // Store source path for export
    imageWidth,
    imageHeight,
    slicing: {
      mode: "grid",
      tileWidth,
      tileHeight,
      margin: margin || undefined,
      spacing: spacing || undefined,
    },
    frames,
  };

  return { sheet, img };
}

// ============================================================
// Mode 2: Packed Atlas (TexturePacker JSON hash)
// ============================================================
export async function importPackedSpriteSheet(
  jsonFile: File,
  imageFile: File,
  name?: string,
  imageSourcePath?: string,
): Promise<{ sheet: SpriteSheet; img: HTMLImageElement }> {
  const jsonData = await readJsonFile(jsonFile) as TexturePackerJson;

  // Validate basic structure
  if (!jsonData.frames || !jsonData.meta) {
    throw new Error("Invalid TexturePacker JSON: missing frames or meta");
  }

  const { url, img } = await loadImageFromFile(imageFile);
  const sheetName = name ?? jsonFile.name.replace(/\.[^.]+$/, "");
  const id = `sheet_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const frames: Record<string, FrameData> = {};

  for (const [key, val] of Object.entries(jsonData.frames)) {
    const frameName = key.replace(/\.[^.]+$/, ""); // strip extension
    frames[frameName] = {
      x: val.frame.x,
      y: val.frame.y,
      w: val.rotated ? val.frame.h : val.frame.w,
      h: val.rotated ? val.frame.w : val.frame.h,
      trimmed: val.trimmed,
      sourceWidth: val.sourceSize.w,
      sourceHeight: val.sourceSize.h,
      offsetX: val.spriteSourceSize?.x ?? 0,
      offsetY: val.spriteSourceSize?.y ?? 0,
      rotated: val.rotated,
    };
  }

  const sheet: SpriteSheet = {
    id,
    name: sheetName,
    image: url,
    sourcePath: imageSourcePath ?? imageFile.name,
    imageWidth: jsonData.meta.size.w,
    imageHeight: jsonData.meta.size.h,
    slicing: {
      mode: "packed",
      source: jsonFile.name,
    },
    frames,
  };

  return { sheet, img };
}

// ============================================================
// Mode 3: Loose Files (Kenney-style directory of PNGs)
// ============================================================
export async function importLooseSpriteSheet(
  imageFiles: File[],
  name?: string,
  padding = 1,
  sourcePath?: string,
): Promise<{ sheet: SpriteSheet; img: HTMLImageElement }> {
  // Load all images
  const loaded: Array<{ name: string; img: HTMLImageElement }> = [];
  for (const file of imageFiles) {
    const { img } = await loadImageFromFile(file);
    loaded.push({ name: file.name, img });
  }

  // Sort alphabetically for consistent ordering
  loaded.sort((a, b) => a.name.localeCompare(b.name));

  // Pack into single atlas
  const { canvas, frames: packedFrames } = packLooseImages(loaded, padding);

  // Convert canvas to data URL and create image
  const dataUrl = canvas.toDataURL("image/png");
  const img = await loadImageFromDataUrl(dataUrl);

  const sheetName = name ?? "loose_atlas";
  const id = `sheet_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const frames: Record<string, FrameData> = {};
  for (const f of packedFrames) {
    frames[f.id] = {
      x: f.x,
      y: f.y,
      w: f.width,
      h: f.height,
    };
  }

  const sheet: SpriteSheet = {
    id,
    name: sheetName,
    image: dataUrl,
    sourcePath: sourcePath ?? `${sheetName}.png`, // Generated atlas image name
    imageWidth: canvas.width,
    imageHeight: canvas.height,
    slicing: {
      mode: "manual",
    },
    frames,
  };

  return { sheet, img };
}

// ============================================================
// Mode 4: XML Atlas (Sparrow / Starling format)
// ============================================================
export async function importXmlSpriteSheet(
  xmlFile: File,
  imageFile: File,
  name?: string,
  imageSourcePath?: string,
): Promise<{ sheet: SpriteSheet; img: HTMLImageElement }> {
  const xmlText = await readTextFile(xmlFile);
  const xmlData = parseSparrowXml(xmlText);

  const { url, img } = await loadImageFromFile(imageFile);
  const sheetName = name ?? xmlFile.name.replace(/\.[^.]+$/, "");
  const id = `sheet_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const frames: Record<string, FrameData> = {};
  for (const st of xmlData.subtextures) {
    const frameId = st.name.replace(/\.[^.]+$/, "");
    frames[frameId] = {
      x: st.x,
      y: st.y,
      w: st.width,
      h: st.height,
    };
  }

  const sheet: SpriteSheet = {
    id,
    name: sheetName,
    image: url,
    sourcePath: imageSourcePath ?? imageFile.name,
    imageWidth: img.naturalWidth,
    imageHeight: img.naturalHeight,
    slicing: {
      mode: "xml",
      source: xmlFile.name,
    },
    frames,
  };

  return { sheet, img };
}

// ============================================================
// Mode 5: Mote Native Format (.mote-sprite.json)
// ============================================================

/** Mote sprite sheet JSON format (exported by this editor) */
export interface MoteSpriteJson {
  id: string;
  name: string;
  image: string;
  slicing?: {
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
    collider?: FrameData["collider"];
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

export async function importMoteSpriteSheet(
  jsonFile: File,
  imageFile: File,
  name?: string,
  imageSourcePath?: string,
): Promise<{ sheet: SpriteSheet; img: HTMLImageElement }> {
  const jsonData = await readJsonFile(jsonFile) as MoteSpriteJson;

  // Validate basic structure
  if (!jsonData.frames || !Array.isArray(jsonData.frames)) {
    throw new Error("Invalid Mote sprite JSON: missing frames array");
  }

  const { url, img } = await loadImageFromFile(imageFile);
  
  // Build the JSON format expected by spriteSheetFromJson
  const spriteSheetJson = {
    type: 'mote-sprite' as const,
    version: '1.0.0' as const,
    id: jsonData.id ?? `sheet_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: name ?? jsonData.name ?? jsonFile.name.replace(/\.[^.]+$/, ""),
    image: imageSourcePath ?? imageFile.name,
    slicing: jsonData.slicing ?? { mode: "packed" as const },
    frames: jsonData.frames,
  };
  
  // Use io-v2's conversion function for consistency
  const sheet = spriteSheetFromJson(spriteSheetJson, url);

  return { sheet, img };
}

/** Check if a JSON file is in Mote format (vs TexturePacker) */
function isMoteSpriteJson(json: unknown): json is MoteSpriteJson {
  if (typeof json !== "object" || json === null) return false;
  const obj = json as Record<string, unknown>;
  // Mote format has "frames" as an array, TexturePacker has it as an object
  if (!Array.isArray(obj.frames)) return false;
  // Mote format has slicing info
  if (obj.slicing && typeof obj.slicing === "object") return true;
  // Or check for id/name at root level
  if (typeof obj.id === "string" && typeof obj.name === "string") return true;
  return false;
}

// ============================================================
// Auto-detect import mode
// ============================================================
export function detectImportMode(
  files: File[],
): "grid" | "packed" | "xml" | "loose" | "mote" | "unknown" {
  const jsonFile = files.find((f) => f.name.endsWith(".json"));
  const hasXml = files.some((f) => /\.(xml|txt)$/i.test(f.name));
  const imageCount = files.filter((f) =>
    /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name)
  ).length;

  // Check for Mote format first (by filename pattern or content)
  if (jsonFile && imageCount === 1) {
    // If filename contains .mote-sprite, it's likely our format
    if (jsonFile.name.includes(".mote-sprite")) return "mote";
  }

  if (jsonFile && imageCount === 1) return "packed";
  if (hasXml && imageCount === 1) return "xml";
  if (!jsonFile && !hasXml && imageCount > 1) return "loose";
  if (!jsonFile && !hasXml && imageCount === 1) return "grid";
  return "unknown";
}
