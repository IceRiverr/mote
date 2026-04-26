/**
 * SpriteAtlas — a collection of named sprite frames from one or more source images.
 *
 * Three import modes:
 *   1. Tile Sheet (grid)   — uniform grid, like existing TileSet but produces named frames
 *   2. Packed Atlas         — TexturePacker / ShoeBox JSON hash format
 *   3. Loose Files          — directory of individual PNG files (Kenney-style)
 */

/** A single sprite frame within an atlas */
export interface SpriteFrame {
  /** Unique frame ID within this atlas (e.g. "player_idle_0") */
  id: string;
  /** Human-readable name (often same as id, or filename without ext) */
  name: string;
  /** Source rectangle in the atlas image */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Optional: trimmed sprite data (from TexturePacker trim) */
  trimmed?: boolean;
  sourceWidth?: number;   // original untrimmed size
  sourceHeight?: number;
  offsetX?: number;       // trim offset from top-left
  offsetY?: number;
  /** Whether the frame is rotated 90° CW in the atlas (TexturePacker) */
  rotated?: boolean;
  /** Tags for grouping (e.g. "idle", "walk", "attack") */
  tags?: string[];
}

/** Import source mode — how was this atlas created */
export type AtlasSourceType = "tilesheet" | "packed" | "loose";

/** The SpriteAtlas — references one image and contains named frames */
export interface SpriteAtlas {
  id: string;
  name: string;
  /** How this atlas was imported */
  sourceType: AtlasSourceType;
  /** Image URL (ObjectURL or data URL) */
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  /** All frames in this atlas */
  frames: SpriteFrame[];
  /** Frame lookup by ID (built at import time) */
  frameMap: Map<string, SpriteFrame>;
}

// ============================================================
// Factory helpers
// ============================================================

/** Create a SpriteAtlas from a grid tile sheet */
export function createAtlasFromGrid(
  id: string,
  name: string,
  imageUrl: string,
  imageWidth: number,
  imageHeight: number,
  tileWidth: number,
  tileHeight: number,
  margin = 0,
  spacing = 0,
  prefix = "",
): SpriteAtlas {
  const columns = Math.floor(
    (imageWidth - margin * 2 + spacing) / (tileWidth + spacing)
  );
  const rows = Math.floor(
    (imageHeight - margin * 2 + spacing) / (tileHeight + spacing)
  );

  const frames: SpriteFrame[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const idx = row * columns + col;
      const frameId = prefix ? `${prefix}_${idx}` : `frame_${idx}`;
      frames.push({
        id: frameId,
        name: frameId,
        x: margin + col * (tileWidth + spacing),
        y: margin + row * (tileHeight + spacing),
        width: tileWidth,
        height: tileHeight,
      });
    }
  }

  return buildAtlas(id, name, "tilesheet", imageUrl, imageWidth, imageHeight, frames);
}

/** Create a SpriteAtlas from TexturePacker JSON hash format */
export function createAtlasFromPackedJson(
  id: string,
  name: string,
  imageUrl: string,
  jsonData: TexturePackerJson,
): SpriteAtlas {
  const meta = jsonData.meta;
  const frames: SpriteFrame[] = [];

  for (const [key, val] of Object.entries(jsonData.frames)) {
    const frameName = key.replace(/\.[^.]+$/, ""); // strip extension
    frames.push({
      id: frameName,
      name: frameName,
      x: val.frame.x,
      y: val.frame.y,
      width: val.rotated ? val.frame.h : val.frame.w,
      height: val.rotated ? val.frame.w : val.frame.h,
      trimmed: val.trimmed,
      sourceWidth: val.sourceSize.w,
      sourceHeight: val.sourceSize.h,
      offsetX: val.spriteSourceSize?.x ?? 0,
      offsetY: val.spriteSourceSize?.y ?? 0,
      rotated: val.rotated,
    });
  }

  return buildAtlas(id, name, "packed", imageUrl, meta.size.w, meta.size.h, frames);
}

/** Create a SpriteAtlas from loose individual images packed into a runtime canvas */
export function createAtlasFromLooseFrames(
  id: string,
  name: string,
  imageUrl: string,
  imageWidth: number,
  imageHeight: number,
  frames: SpriteFrame[],
): SpriteAtlas {
  return buildAtlas(id, name, "loose", imageUrl, imageWidth, imageHeight, frames);
}

/** Internal: build atlas with frameMap */
function buildAtlas(
  id: string,
  name: string,
  sourceType: AtlasSourceType,
  imageUrl: string,
  imageWidth: number,
  imageHeight: number,
  frames: SpriteFrame[],
): SpriteAtlas {
  const frameMap = new Map<string, SpriteFrame>();
  for (const f of frames) {
    frameMap.set(f.id, f);
  }
  return { id, name, sourceType, imageUrl, imageWidth, imageHeight, frames, frameMap };
}

// ============================================================
// TexturePacker JSON format types
// ============================================================

export interface TexturePackerJson {
  frames: Record<string, TexturePackerFrame>;
  meta: {
    app: string;
    version: string;
    image: string;
    format: string;
    size: { w: number; h: number };
    scale: string;
  };
}

export interface TexturePackerFrame {
  frame: { x: number; y: number; w: number; h: number };
  rotated: boolean;
  trimmed: boolean;
  spriteSourceSize: { x: number; y: number; w: number; h: number };
  sourceSize: { w: number; h: number };
}


// ============================================================
// XML Sparrow / Starling format types & parser
// ============================================================

export interface SparrowXmlData {
  imagePath: string;
  subtextures: Array<{
    name: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
}

/** Parse a TextureAtlas XML string (Sparrow / Starling format) */
export function parseSparrowXml(xmlText: string): SparrowXmlData {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  const root = doc.documentElement;

  if (root.tagName !== "TextureAtlas") {
    throw new Error("Invalid Sparrow XML: root element must be <TextureAtlas>");
  }

  const imagePath = root.getAttribute("imagePath") ?? "";
  const subtextures: SparrowXmlData["subtextures"] = [];

  const nodes = root.querySelectorAll("SubTexture");
  for (const node of Array.from(nodes)) {
    const name = node.getAttribute("name") ?? "";
    const x = parseInt(node.getAttribute("x") ?? "0");
    const y = parseInt(node.getAttribute("y") ?? "0");
    const width = parseInt(node.getAttribute("width") ?? "0");
    const height = parseInt(node.getAttribute("height") ?? "0");
    if (name && width > 0 && height > 0) {
      subtextures.push({ name, x, y, width, height });
    }
  }

  return { imagePath, subtextures };
}

/** Create a SpriteAtlas from parsed Sparrow XML data */
export function createAtlasFromSparrowXml(
  id: string,
  name: string,
  imageUrl: string,
  imageWidth: number,
  imageHeight: number,
  xmlData: SparrowXmlData,
): SpriteAtlas {
  const frames: SpriteFrame[] = xmlData.subtextures.map((st) => ({
    id: st.name.replace(/\.[^.]+$/, ""),
    name: st.name.replace(/\.[^.]+$/, ""),
    x: st.x,
    y: st.y,
    width: st.width,
    height: st.height,
  }));

  return buildAtlas(id, name, "packed", imageUrl, imageWidth, imageHeight, frames);
}

// ============================================================
// Loose files packing — pack individual images into a single atlas texture
// ============================================================

interface PackRect {
  id: string;
  name: string;
  width: number;
  height: number;
  img: HTMLImageElement;
}

interface PackedRect extends PackRect {
  x: number;
  y: number;
}

/**
 * Pack loose image files into a single atlas canvas.
 * Uses a simple shelf-packing algorithm.
 * Returns: { canvas, frames } where canvas is the packed atlas and frames are the sprite rects.
 */
export function packLooseImages(
  images: Array<{ name: string; img: HTMLImageElement }>,
  padding = 1,
): { canvas: HTMLCanvasElement; frames: SpriteFrame[] } {
  // Sort by height descending for better packing
  const rects: PackRect[] = images.map((im) => ({
    id: im.name.replace(/\.[^.]+$/, ""),
    name: im.name.replace(/\.[^.]+$/, ""),
    width: im.img.naturalWidth,
    height: im.img.naturalHeight,
    img: im.img,
  }));
  rects.sort((a, b) => b.height - a.height);

  // Calculate atlas size (power of 2)
  const totalArea = rects.reduce(
    (sum, r) => sum + (r.width + padding) * (r.height + padding),
    0
  );
  let atlasSize = 256;
  while (atlasSize * atlasSize < totalArea * 1.2) {
    atlasSize *= 2;
    if (atlasSize > 4096) break;
  }

  // Shelf packing
  const packed: PackedRect[] = [];
  let shelfY = 0;
  let shelfX = 0;
  let shelfHeight = 0;

  for (const rect of rects) {
    if (shelfX + rect.width + padding > atlasSize) {
      // New shelf
      shelfY += shelfHeight + padding;
      shelfX = 0;
      shelfHeight = 0;
    }
    // Check if we need to grow vertically
    if (shelfY + rect.height + padding > atlasSize) {
      atlasSize *= 2;
      if (atlasSize > 8192) atlasSize = 8192;
    }
    packed.push({ ...rect, x: shelfX, y: shelfY });
    shelfX += rect.width + padding;
    shelfHeight = Math.max(shelfHeight, rect.height);
  }

  const finalHeight = shelfY + shelfHeight + padding;

  // Draw onto canvas
  const canvas = document.createElement("canvas");
  canvas.width = atlasSize;
  canvas.height = Math.min(finalHeight, atlasSize);
  const ctx = canvas.getContext("2d")!;

  const frames: SpriteFrame[] = [];
  for (const p of packed) {
    ctx.drawImage(p.img, p.x, p.y);
    frames.push({
      id: p.id,
      name: p.name,
      x: p.x,
      y: p.y,
      width: p.width,
      height: p.height,
    });
  }

  return { canvas, frames };
}
