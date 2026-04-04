/**
 * Atlas import helpers for all three modes:
 *   1. Tile Sheet (grid)
 *   2. Packed Atlas (TexturePacker JSON)
 *   3. Loose Files (directory of PNGs)
 */
import {
  createAtlasFromGrid,
  createAtlasFromPackedJson,
  createAtlasFromLooseFrames,
  packLooseImages,
} from "./SpriteAtlas";
import type { SpriteAtlas, TexturePackerJson } from "./SpriteAtlas";
import { addAtlas } from "../store/atlas";

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

// ============================================================
// Mode 1: Tile Sheet (grid)
// ============================================================
export async function importTileSheetAtlas(
  imageFile: File,
  tileWidth: number,
  tileHeight: number,
  margin = 0,
  spacing = 0,
  name?: string,
): Promise<SpriteAtlas> {
  const { url, img } = await loadImageFromFile(imageFile);
  const atlasName = name ?? imageFile.name.replace(/\.[^.]+$/, "");
  const id = `atlas_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const atlas = createAtlasFromGrid(
    id, atlasName, url,
    img.naturalWidth, img.naturalHeight,
    tileWidth, tileHeight, margin, spacing,
    atlasName,
  );

  addAtlas(atlas, img);
  return atlas;
}

// ============================================================
// Mode 2: Packed Atlas (TexturePacker JSON hash)
// ============================================================
export async function importPackedAtlas(
  jsonFile: File,
  imageFile: File,
  name?: string,
): Promise<SpriteAtlas> {
  const jsonData = await readJsonFile(jsonFile) as TexturePackerJson;

  // Validate basic structure
  if (!jsonData.frames || !jsonData.meta) {
    throw new Error("Invalid TexturePacker JSON: missing frames or meta");
  }

  const { url, img } = await loadImageFromFile(imageFile);
  const atlasName = name ?? jsonFile.name.replace(/\.[^.]+$/, "");
  const id = `atlas_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const atlas = createAtlasFromPackedJson(id, atlasName, url, jsonData);
  addAtlas(atlas, img);
  return atlas;
}

// ============================================================
// Mode 3: Loose Files (Kenney-style directory of PNGs)
// ============================================================
export async function importLooseFiles(
  imageFiles: File[],
  name?: string,
  padding = 1,
): Promise<SpriteAtlas> {
  // Load all images
  const loaded: Array<{ name: string; img: HTMLImageElement }> = [];
  for (const file of imageFiles) {
    const { img } = await loadImageFromFile(file);
    loaded.push({ name: file.name, img });
  }

  // Sort alphabetically for consistent ordering
  loaded.sort((a, b) => a.name.localeCompare(b.name));

  // Pack into single atlas
  const { canvas, frames } = packLooseImages(loaded, padding);

  // Convert canvas to data URL and create image
  const dataUrl = canvas.toDataURL("image/png");
  const atlasImg = await loadImageFromDataUrl(dataUrl);

  const atlasName = name ?? "loose_atlas";
  const id = `atlas_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const atlas = createAtlasFromLooseFrames(
    id, atlasName, dataUrl,
    canvas.width, canvas.height,
    frames,
  );

  addAtlas(atlas, atlasImg);
  return atlas;
}

// ============================================================
// Auto-detect import mode
// ============================================================
export function detectAtlasImportMode(
  files: File[],
): "packed" | "loose" | "unknown" {
  const hasJson = files.some((f) => f.name.endsWith(".json"));
  const imageCount = files.filter((f) =>
    /\.(png|jpg|jpeg|webp|gif)$/i.test(f.name)
  ).length;

  if (hasJson && imageCount === 1) return "packed";
  if (!hasJson && imageCount > 1) return "loose";
  return "unknown";
}
