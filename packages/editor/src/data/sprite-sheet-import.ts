// ═══════════════════════════════════════════════════════════════
// sprite-sheet-import.ts — SpriteSheet import for new architecture
// ═══════════════════════════════════════════════════════════════

import type { SpriteSheet, FrameData, FrameDataWithId, Slicing } from "./SpriteSheet";
import { createGridSpriteSheet } from "./SpriteSheet";

/**
 * SpriteSheet JSON format (from .mote-sprite.json files)
 */
export interface SpriteSheetJson {
  type: "mote-sprite";
  version: string;
  id: string;
  name: string;
  image: string;
  slicing: {
    mode: "grid" | "packed" | "xml" | "manual";
    tileWidth?: number;
    tileHeight?: number;
    margin?: number;
    spacing?: number;
    source?: string;
  };
  frames: FrameDataWithId[];
}

/**
 * Load image from File object
 */
export function loadImageFromFile(
  file: File
): Promise<{ url: string; img: HTMLImageElement }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ url, img });
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Load image from data URL
 */
export function loadImageFromDataUrl(
  dataUrl: string
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = dataUrl;
  });
}

/**
 * Read file as JSON
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
// Import functions for different formats (used by ImportDialog)
// ═══════════════════════════════════════════════════════════════

import { spriteSheetFromJson } from "./io";

/**
 * Import grid-based sprite sheet from image file
 */
export async function importGridSpriteSheetFromImage(
  imgFile: File,
  tileWidth: number,
  tileHeight: number,
  margin: number,
  spacing: number,
  id?: string,
  name?: string
): Promise<{ sheet: SpriteSheet; img: HTMLImageElement }> {
  const { url, img } = await loadImageFromFile(imgFile);

  // Calculate grid dimensions
  const imageWidth = img.naturalWidth;
  const imageHeight = img.naturalHeight;
  const cols = Math.floor((imageWidth - margin * 2 + spacing) / (tileWidth + spacing));
  const rows = Math.floor((imageHeight - margin * 2 + spacing) / (tileHeight + spacing));

  // Generate frames
  const frames: Record<string, FrameData> = {};
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const idx = row * cols + col;
      frames[`frame_${idx}`] = {
        x: margin + col * (tileWidth + spacing),
        y: margin + row * (tileHeight + spacing),
        w: tileWidth,
        h: tileHeight,
      };
    }
  }

  const sheet: SpriteSheet = {
    id: id || `sheet_${Date.now()}`,
    name: name || imgFile.name.replace(/\.[^.]+$/, ""),
    image: url,
    sourcePath: imgFile.name,
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

/**
 * Import Mote format sprite sheet from JSON + image files
 */
export async function importMoteSpriteSheet(
  jsonFile: File,
  imgFile: File,
  id?: string,
  name?: string
): Promise<{ sheet: SpriteSheet; img: HTMLImageElement }> {
  const json = await readJsonFile(jsonFile) as SpriteSheetJson;
  const { url, img } = await loadImageFromFile(imgFile);

  const sheet = spriteSheetFromJson(json, url);
  return { sheet, img };
}

/**
 * Import packed JSON format (TexturePacker)
 */
export async function importPackedSpriteSheet(
  jsonFile: File,
  imgFile: File,
  id?: string,
  name?: string
): Promise<{ sheet: SpriteSheet; img: HTMLImageElement }> {
  const json = await readJsonFile(jsonFile) as any;
  const { url, img } = await loadImageFromFile(imgFile);

  // Parse TexturePacker JSON format
  const frames: Record<string, FrameData> = {};
  const jsonFrames = json.frames || {};

  for (const [key, value] of Object.entries(jsonFrames)) {
    const frameData = value as any;
    const frame: FrameData = {
      x: frameData.frame?.x ?? frameData.x ?? 0,
      y: frameData.frame?.y ?? frameData.y ?? 0,
      w: frameData.frame?.w ?? frameData.w ?? frameData.width ?? 0,
      h: frameData.frame?.h ?? frameData.h ?? frameData.height ?? 0,
      trimmed: frameData.trimmed,
      sourceWidth: frameData.sourceSize?.w ?? frameData.sourceWidth,
      sourceHeight: frameData.sourceSize?.h ?? frameData.sourceHeight,
      offsetX: frameData.spriteSourceSize?.x ?? frameData.offsetX,
      offsetY: frameData.spriteSourceSize?.y ?? frameData.offsetY,
      rotated: frameData.rotated,
    };

    // Use filename without extension as frame ID
    const frameId = key.replace(/\.[^.]+$/, "");
    frames[frameId] = frame;
  }

  const meta = json.meta || {};
  const size = meta.size || json.size || {};

  const sheet: SpriteSheet = {
    id: id || `sheet_${Date.now()}`,
    name: name || imgFile.name.replace(/\.[^.]+$/, ""),
    image: url,
    sourcePath: imgFile.name,
    imageWidth: size.w || img.naturalWidth,
    imageHeight: size.h || img.naturalHeight,
    slicing: {
      mode: "packed",
      source: jsonFile.name,
    } as Slicing,
    frames,
  };

  return { sheet, img };
}

/**
 * Import XML format (Sparrow/Starling)
 */
export async function importXmlSpriteSheet(
  xmlFile: File,
  imgFile: File,
  id?: string,
  name?: string
): Promise<{ sheet: SpriteSheet; img: HTMLImageElement }> {
  const xmlText = await xmlFile.text();
  const { url, img } = await loadImageFromFile(imgFile);

  // Simple XML parsing for Sparrow format
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");
  const subTextures = doc.querySelectorAll("SubTexture");

  const frames: Record<string, FrameData> = {};

  subTextures.forEach((node) => {
    const name = node.getAttribute("name") || "";
    const x = parseInt(node.getAttribute("x") || "0");
    const y = parseInt(node.getAttribute("y") || "0");
    const width = parseInt(node.getAttribute("width") || "0");
    const height = parseInt(node.getAttribute("height") || "0");
    const frameX = parseInt(node.getAttribute("frameX") || "0");
    const frameY = parseInt(node.getAttribute("frameY") || "0");
    const frameWidth = parseInt(node.getAttribute("frameWidth") || "0");
    const frameHeight = parseInt(node.getAttribute("frameHeight") || "0");

    const frameId = name.replace(/\.[^.]+$/, "");
    frames[frameId] = {
      x,
      y,
      w: width,
      h: height,
      trimmed: frameWidth > 0 || frameHeight > 0,
      sourceWidth: frameWidth || width,
      sourceHeight: frameHeight || height,
      offsetX: -frameX,
      offsetY: -frameY,
    };
  });

  const sheet: SpriteSheet = {
    id: id || `sheet_${Date.now()}`,
    name: name || imgFile.name.replace(/\.[^.]+$/, ""),
    image: url,
    sourcePath: imgFile.name,
    imageWidth: img.naturalWidth,
    imageHeight: img.naturalHeight,
    slicing: {
      mode: "xml",
      source: xmlFile.name,
    } as Slicing,
    frames,
  };

  return { sheet, img };
}

/**
 * Import loose images (auto-pack into atlas)
 */
export async function importLooseSpriteSheet(
  imgFiles: File[],
  id?: string,
  spacing: number = 1,
  name?: string
): Promise<{ sheet: SpriteSheet; img: HTMLImageElement }> {
  if (imgFiles.length < 2) {
    throw new Error("At least 2 images required for loose import");
  }

  // Load all images
  const images = await Promise.all(
    imgFiles.map(async (file) => {
      const { url, img } = await loadImageFromFile(file);
      return {
        name: file.name.replace(/\.[^.]+$/, ""),
        url,
        img,
        width: img.naturalWidth,
        height: img.naturalHeight,
      };
    })
  );

  // Simple packing algorithm (shelf pack)
  const maxWidth = 2048;
  let currentX = spacing;
  let currentY = spacing;
  let shelfHeight = 0;
  const atlasWidth = maxWidth;
  let atlasHeight = 0;

  const frames: Record<string, FrameData> = {};
  const positions: { name: string; x: number; y: number; w: number; h: number }[] = [];

  for (const image of images) {
    // Check if fits in current shelf
    if (currentX + image.width + spacing > maxWidth) {
      // New shelf
      currentX = spacing;
      currentY += shelfHeight + spacing;
      shelfHeight = 0;
    }

    // Place image
    positions.push({
      name: image.name,
      x: currentX,
      y: currentY,
      w: image.width,
      h: image.height,
    });

    frames[image.name] = {
      x: currentX,
      y: currentY,
      w: image.width,
      h: image.height,
    };

    currentX += image.width + spacing;
    shelfHeight = Math.max(shelfHeight, image.height);
    atlasHeight = Math.max(atlasHeight, currentY + image.height + spacing);
  }

  // Create atlas canvas
  const canvas = document.createElement("canvas");
  canvas.width = atlasWidth;
  canvas.height = atlasHeight;
  const ctx = canvas.getContext("2d")!;

  // Draw images to atlas
  for (let i = 0; i < images.length; i++) {
    const pos = positions[i];
    ctx.drawImage(images[i].img, pos.x, pos.y);
  }

  // Get atlas image
  const atlasUrl = canvas.toDataURL("image/png");
  const atlasImg = new Image();
  await new Promise<void>((resolve, reject) => {
    atlasImg.onload = () => resolve();
    atlasImg.onerror = reject;
    atlasImg.src = atlasUrl;
  });

  const sheet: SpriteSheet = {
    id: id || `sheet_${Date.now()}`,
    name: name || "packed_atlas",
    image: atlasUrl,
    sourcePath: "atlas.png",
    imageWidth: atlasWidth,
    imageHeight: atlasHeight,
    slicing: {
      mode: "manual",
    },
    frames,
  };

  return { sheet, img: atlasImg };
}