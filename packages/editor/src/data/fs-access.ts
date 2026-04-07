// ═══════════════════════════════════════════════════════════════
// fs-access.ts — File System Access API wrapper for Mote Editor
// Provides modern file picker dialog for import/export with
// specific directory selection support.
// ═══════════════════════════════════════════════════════════════

import type { SpriteSheet } from './SpriteSheet';
import { spriteSheetToJson, spriteSheetFromJson } from './io-v2';

// ═══════════════════════════════════════════════════════════════
// Type Declarations (File System Access API)
// ═══════════════════════════════════════════════════════════════

declare global {
  interface Window {
    showOpenFilePicker(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>;
    showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
    showDirectoryPicker(options?: DirectoryPickerOptions): Promise<FileSystemDirectoryHandle>;
  }

  interface OpenFilePickerOptions {
    types?: FilePickerAcceptType[];
    excludeAcceptAllOption?: boolean;
    multiple?: boolean;
    startIn?: FileSystemHandle | string;
  }

  interface SaveFilePickerOptions {
    suggestedName?: string;
    types?: FilePickerAcceptType[];
    excludeAcceptAllOption?: boolean;
    startIn?: FileSystemHandle | string;
  }

  interface DirectoryPickerOptions {
    startIn?: FileSystemHandle | string;
  }

  interface FilePickerAcceptType {
    description?: string;
    accept: Record<string, string[]>;
  }

  interface FileSystemFileHandle extends FileSystemHandle {
    getFile(): Promise<File>;
    createWritable(): Promise<FileSystemWritableFileStream>;
    queryPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
    requestPermission(descriptor?: { mode?: 'read' | 'readwrite' }): Promise<PermissionState>;
  }

  interface FileSystemDirectoryHandle extends FileSystemHandle {
    getFileHandle(name: string, options?: { create?: boolean }): Promise<FileSystemFileHandle>;
    getDirectoryHandle(name: string, options?: { create?: boolean }): Promise<FileSystemDirectoryHandle>;
    entries(): AsyncIterableIterator<[string, FileSystemHandle]>;
  }

  // Note: FileSystemHandle is defined in lib.dom.d.ts, we extend it via the interfaces above

  interface FileSystemWritableFileStream extends WritableStream {
    write(data: BufferSource | Blob | string): Promise<void>;
    close(): Promise<void>;
  }
}

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

/** Result of importing a sprite sheet */
export interface ImportResult {
  sheet: SpriteSheet;
  img: HTMLImageElement;
  /** File handles for potential re-save */
  jsonHandle?: FileSystemFileHandle;
  imageHandle?: FileSystemFileHandle;
}

/** Options for file picker dialogs */
export interface PickerOptions {
  /** Suggested file name for save dialogs */
  suggestedName?: string;
  /** Start directory (if previously granted) */
  startIn?: FileSystemDirectoryHandle;
  /** Multiple file selection (for open dialogs) */
  multiple?: boolean;
}

// ═══════════════════════════════════════════════════════════════
// Feature Detection
// ═══════════════════════════════════════════════════════════════

/** Check if File System Access API is supported */
export function isFileSystemAccessSupported(): boolean {
  return 'showOpenFilePicker' in window && 'showSaveFilePicker' in window;
}

/** Check if we have permission to access a handle */
async function verifyPermission(
  fileHandle: FileSystemFileHandle,
  readWrite: boolean = false,
): Promise<boolean> {
  const options = readWrite ? { mode: 'readwrite' as const } : undefined;
  
  // Check if permission was already granted
  if ((await fileHandle.queryPermission(options)) === 'granted') {
    return true;
  }
  
  // Request permission
  if ((await fileHandle.requestPermission(options)) === 'granted') {
    return true;
  }
  
  return false;
}

// ═══════════════════════════════════════════════════════════════
// File Type Accepts
// ═══════════════════════════════════════════════════════════════

const IMAGE_TYPES = {
  'image/png': ['.png'],
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/webp': ['.webp'],
  'image/gif': ['.gif'],
};

const JSON_TYPES = {
  'application/json': ['.json'],
};

const MOTE_SPRITE_TYPES = {
  'application/json': ['.json'],
};

const XML_TYPES = {
  'application/xml': ['.xml'],
  'text/xml': ['.xml'],
};

// ═══════════════════════════════════════════════════════════════
// Import Functions
// ═══════════════════════════════════════════════════════════════

/**
 * Import Mote sprite sheet using file picker.
 * User selects both JSON and image files.
 */
export async function importMoteSpriteSheetWithPicker(
  options?: PickerOptions,
): Promise<ImportResult> {
  // First, pick the JSON file
  const [jsonHandle] = await window.showOpenFilePicker({
    types: [
      { description: 'Mote Sprite Files', accept: MOTE_SPRITE_TYPES },
      { description: 'JSON Files', accept: JSON_TYPES },
    ],
    multiple: false,
    startIn: options?.startIn,
  });

  const jsonFile = await jsonHandle.getFile();
  const jsonData = JSON.parse(await jsonFile.text()) as {
    id: string;
    name: string;
    image: string;
    slicing?: unknown;
    frames: unknown[];
  };

  // Extract image filename from JSON
  const imageName = jsonData.image.split('/').pop() || jsonData.image;
  const imageExt = imageName.split('.').pop()?.toLowerCase() || 'png';

  // Then pick the image file - suggest the filename from JSON
  const [imageHandle] = await window.showOpenFilePicker({
    types: [
      { description: 'Image Files', accept: IMAGE_TYPES },
    ],
    multiple: false,
    startIn: options?.startIn,
  });

  const imageFile = await imageHandle.getFile();

  // Load image
  const url = URL.createObjectURL(imageFile);
  const img = await loadImage(url);

  // Convert to SpriteSheet
  const sheet = spriteSheetFromJson({
    type: 'mote-sprite',
    version: '1.0.0',
    id: jsonData.id,
    name: jsonData.name,
    image: imageFile.name,
    slicing: (jsonData.slicing as any) || { mode: 'packed' },
    frames: jsonData.frames as any,
  }, url);

  return {
    sheet,
    img,
    jsonHandle,
    imageHandle,
  };
}

/**
 * Import grid-based tile sheet using file picker.
 * User picks an image file, then provides grid parameters.
 */
export async function importGridSpriteSheetWithPicker(
  tileWidth: number,
  tileHeight: number,
  margin: number = 0,
  spacing: number = 0,
  options?: PickerOptions,
): Promise<ImportResult> {
  const [imageHandle] = await window.showOpenFilePicker({
    types: [{ description: 'Image Files', accept: IMAGE_TYPES }],
    multiple: false,
    startIn: options?.startIn,
  });

  const imageFile = await imageHandle.getFile();
  const url = URL.createObjectURL(imageFile);
  const img = await loadImage(url);

  const imageWidth = img.naturalWidth;
  const imageHeight = img.naturalHeight;

  // Calculate grid
  const columns = Math.floor(
    (imageWidth - margin * 2 + spacing) / (tileWidth + spacing)
  );
  const rows = Math.floor(
    (imageHeight - margin * 2 + spacing) / (tileHeight + spacing)
  );

  // Generate frames
  const frames: Record<string, { x: number; y: number; w: number; h: number }> = {};
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const idx = row * columns + col;
      frames[`frame_${idx}`] = {
        x: margin + col * (tileWidth + spacing),
        y: margin + row * (tileHeight + spacing),
        w: tileWidth,
        h: tileHeight,
      };
    }
  }

  const sheet: SpriteSheet = {
    id: `sheet_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: imageFile.name.replace(/\.[^.]+$/, ''),
    image: url,
    sourcePath: imageFile.name,
    imageWidth,
    imageHeight,
    slicing: {
      mode: 'grid',
      tileWidth,
      tileHeight,
      margin: margin || undefined,
      spacing: spacing || undefined,
    },
    frames,
  };

  return {
    sheet,
    img,
    imageHandle,
  };
}

/**
 * Import TexturePacker JSON format.
 * User selects JSON file and corresponding image.
 */
export async function importPackedSpriteSheetWithPicker(
  options?: PickerOptions,
): Promise<ImportResult> {
  // Pick JSON first
  const [jsonHandle] = await window.showOpenFilePicker({
    types: [{ description: 'JSON Files', accept: JSON_TYPES }],
    multiple: false,
    startIn: options?.startIn,
  });

  const jsonFile = await jsonHandle.getFile();
  const jsonData = JSON.parse(await jsonFile.text()) as {
    frames: Record<string, {
      frame: { x: number; y: number; w: number; h: number };
      rotated?: boolean;
      trimmed?: boolean;
      sourceSize?: { w: number; h: number };
      spriteSourceSize?: { x: number; y: number; w: number; h: number };
    }>;
    meta: { size: { w: number; h: number } };
  };

  // Pick image
  const [imageHandle] = await window.showOpenFilePicker({
    types: [{ description: 'Image Files', accept: IMAGE_TYPES }],
    multiple: false,
    startIn: options?.startIn,
  });

  const imageFile = await imageHandle.getFile();
  const url = URL.createObjectURL(imageFile);
  const img = await loadImage(url);

  // Convert frames
  const frames: Record<string, SpriteSheet['frames'][string]> = {};
  for (const [key, val] of Object.entries(jsonData.frames)) {
    const frameName = key.replace(/\.[^.]+$/, '');
    frames[frameName] = {
      x: val.frame.x,
      y: val.frame.y,
      w: val.rotated ? val.frame.h : val.frame.w,
      h: val.rotated ? val.frame.w : val.frame.h,
      rotated: val.rotated,
      trimmed: val.trimmed,
      sourceWidth: val.sourceSize?.w,
      sourceHeight: val.sourceSize?.h,
      offsetX: val.spriteSourceSize?.x,
      offsetY: val.spriteSourceSize?.y,
    };
  }

  const sheet: SpriteSheet = {
    id: `sheet_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: jsonFile.name.replace(/\.[^.]+$/, ''),
    image: url,
    sourcePath: imageFile.name,
    imageWidth: jsonData.meta.size.w,
    imageHeight: jsonData.meta.size.h,
    slicing: { mode: 'packed', source: jsonFile.name },
    frames,
  };

  return {
    sheet,
    img,
    jsonHandle,
    imageHandle,
  };
}

/**
 * Import multiple loose images and pack them into an atlas.
 */
export async function importLooseSpriteSheetWithPicker(
  options?: PickerOptions,
): Promise<ImportResult> {
  const handles = await window.showOpenFilePicker({
    types: [{ description: 'Image Files', accept: IMAGE_TYPES }],
    multiple: true,
    startIn: options?.startIn,
  });

  if (handles.length < 2) {
    throw new Error('Please select at least 2 images to pack');
  }

  // Load all images
  const images: Array<{ name: string; img: HTMLImageElement; url: string }> = [];
  for (const handle of handles) {
    const file = await handle.getFile();
    const url = URL.createObjectURL(file);
    const img = await loadImage(url);
    images.push({ name: file.name, img, url });
  }

  // Simple packing (single row for now)
  images.sort((a, b) => a.name.localeCompare(b.name));
  
  let totalWidth = 0;
  let maxHeight = 0;
  const padding = 1;
  
  for (const { img } of images) {
    totalWidth += img.naturalWidth + padding;
    maxHeight = Math.max(maxHeight, img.naturalHeight);
  }
  totalWidth -= padding;

  // Create atlas canvas
  const canvas = document.createElement('canvas');
  canvas.width = totalWidth;
  canvas.height = maxHeight;
  const ctx = canvas.getContext('2d')!;

  // Pack images
  const frames: Record<string, { x: number; y: number; w: number; h: number }> = {};
  let x = 0;
  
  for (const { name, img } of images) {
    const id = name.replace(/\.[^.]+$/, '');
    frames[id] = { x, y: 0, w: img.naturalWidth, h: img.naturalHeight };
    ctx.drawImage(img, x, 0);
    x += img.naturalWidth + padding;
  }

  // Convert to data URL
  const dataUrl = canvas.toDataURL('image/png');
  const atlasImg = await loadImage(dataUrl);

  const sheet: SpriteSheet = {
    id: `sheet_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: 'loose_atlas',
    image: dataUrl,
    sourcePath: 'atlas.png',
    imageWidth: canvas.width,
    imageHeight: canvas.height,
    slicing: { mode: 'manual' },
    frames,
  };

  return {
    sheet,
    img: atlasImg,
  };
}

// ═══════════════════════════════════════════════════════════════
// Export Functions
// ═══════════════════════════════════════════════════════════════

/**
 * Export SpriteSheet to user-selected directory.
 * Saves both the .mote-sprite.json file and optionally the image.
 */
export async function exportSpriteSheetWithPicker(
  sheet: SpriteSheet,
  options?: PickerOptions & { saveImage?: boolean },
): Promise<{ jsonHandle: FileSystemFileHandle; imageHandle?: FileSystemFileHandle }> {
  const json = spriteSheetToJson(sheet);
  const safeName = sheet.name.replace(/[^a-zA-Z0-9_\-]/g, '_');
  const jsonFileName = `${safeName}.mote-sprite.json`;

  // Show save picker for JSON
  const jsonHandle = await window.showSaveFilePicker({
    suggestedName: jsonFileName,
    types: [
      { description: 'Mote Sprite Files', accept: MOTE_SPRITE_TYPES },
      { description: 'JSON Files', accept: JSON_TYPES },
    ],
    startIn: options?.startIn,
  });

  // Format JSON with compact frames array
  const header = JSON.stringify({
    type: json.type,
    version: json.version,
    id: json.id,
    name: json.name,
    image: json.image,
    slicing: json.slicing,
  }, null, 2);
  const headerWithoutBrace = header.slice(0, -1).trimEnd();
  
  const framesLines = json.frames.map((frame: any) => {
    const fields: Record<string, unknown> = {
      id: frame.id,
      x: frame.x,
      y: frame.y,
      w: frame.w,
      h: frame.h,
    };
    if (frame.collider) fields.collider = frame.collider;
    if (frame.tags) fields.tags = frame.tags;
    if (frame.properties) fields.properties = frame.properties;
    if (frame.trimmed !== undefined) fields.trimmed = frame.trimmed;
    if (frame.sourceWidth !== undefined) fields.sourceWidth = frame.sourceWidth;
    if (frame.sourceHeight !== undefined) fields.sourceHeight = frame.sourceHeight;
    if (frame.offsetX !== undefined) fields.offsetX = frame.offsetX;
    if (frame.offsetY !== undefined) fields.offsetY = frame.offsetY;
    if (frame.rotated !== undefined) fields.rotated = frame.rotated;
    return '  ' + JSON.stringify(fields);
  });
  
  const output = `${headerWithoutBrace},\n  "frames": [\n${framesLines.map((l: string) => `    ${l}`).join(',\n')}\n  ]\n}`;

  // Write JSON file
  const writable = await jsonHandle.createWritable();
  await writable.write(output);
  await writable.close();

  // Optionally save image
  let imageHandle: FileSystemFileHandle | undefined;
  if (options?.saveImage && (sheet.image.startsWith('blob:') || sheet.image.startsWith('data:'))) {
    const imageFileName = sheet.sourcePath || `${safeName}.png`;
    imageHandle = await window.showSaveFilePicker({
      suggestedName: imageFileName.split('/').pop() || imageFileName,
      types: [{ description: 'PNG Image', accept: { 'image/png': ['.png'] } }],
      startIn: options?.startIn,
    });

    // Fetch and write image
    const response = await fetch(sheet.image);
    const blob = await response.blob();
    const imageWritable = await imageHandle.createWritable();
    await imageWritable.write(blob);
    await imageWritable.close();
  }

  return { jsonHandle, imageHandle };
}

/**
 * Quick export to a previously granted directory handle.
 * Useful for "Save" (not "Save As") functionality.
 */
export async function exportSpriteSheetToHandle(
  sheet: SpriteSheet,
  directoryHandle: FileSystemDirectoryHandle,
  fileName?: string,
): Promise<void> {
  const json = spriteSheetToJson(sheet);
  const safeName = fileName || sheet.name.replace(/[^a-zA-Z0-9_\-]/g, '_');
  const jsonFileName = `${safeName}.mote-sprite.json`;

  // Get or create file
  const fileHandle = await directoryHandle.getFileHandle(jsonFileName, { create: true });
  
  if (!(await verifyPermission(fileHandle, true))) {
    throw new Error('Permission denied to write file');
  }

  // Format and write JSON
  const header = JSON.stringify({
    type: json.type,
    version: json.version,
    id: json.id,
    name: json.name,
    image: json.image,
    slicing: json.slicing,
  }, null, 2);
  const headerWithoutBrace = header.slice(0, -1).trimEnd();
  
  const framesLines = json.frames.map((frame: any) => {
    const fields: Record<string, unknown> = {
      id: frame.id,
      x: frame.x,
      y: frame.y,
      w: frame.w,
      h: frame.h,
    };
    if (frame.collider) fields.collider = frame.collider;
    if (frame.tags) fields.tags = frame.tags;
    if (frame.properties) fields.properties = frame.properties;
    if (frame.trimmed !== undefined) fields.trimmed = frame.trimmed;
    if (frame.sourceWidth !== undefined) fields.sourceWidth = frame.sourceWidth;
    if (frame.sourceHeight !== undefined) fields.sourceHeight = frame.sourceHeight;
    if (frame.offsetX !== undefined) fields.offsetX = frame.offsetX;
    if (frame.offsetY !== undefined) fields.offsetY = frame.offsetY;
    if (frame.rotated !== undefined) fields.rotated = frame.rotated;
    return '  ' + JSON.stringify(fields);
  });
  
  const output = `${headerWithoutBrace},\n  "frames": [\n${framesLines.map((l: string) => `    ${l}`).join(',\n')}\n  ]\n}`;

  const writable = await fileHandle.createWritable();
  await writable.write(output);
  await writable.close();
}

// ═══════════════════════════════════════════════════════════════
// Utility Functions
// ═══════════════════════════════════════════════════════════════

/** Load an image from URL */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

/**
 * Pick a directory for batch operations.
 * Returns a handle that can be stored and reused.
 */
export async function pickDirectory(): Promise<FileSystemDirectoryHandle> {
  return await window.showDirectoryPicker();
}

/**
 * Read all files in a directory matching a pattern.
 */
export async function readDirectoryFiles(
  directoryHandle: FileSystemDirectoryHandle,
  pattern?: RegExp,
): Promise<Array<{ name: string; handle: FileSystemFileHandle; file: File }>> {
  const results: Array<{ name: string; handle: FileSystemFileHandle; file: File }> = [];
  
  for await (const [name, handle] of (directoryHandle as any).entries()) {
    if (handle.kind === 'file') {
      if (!pattern || pattern.test(name)) {
        results.push({
          name,
          handle: handle as FileSystemFileHandle,
          file: await (handle as FileSystemFileHandle).getFile(),
        });
      }
    }
  }
  
  return results;
}

// ═══════════════════════════════════════════════════════════════
// Fallback for browsers without File System Access API
// ═══════════════════════════════════════════════════════════════

/** Download fallback for unsupported browsers */
export function downloadAsFallback(
  content: string | Blob,
  fileName: string,
): void {
  const blob = content instanceof Blob ? content : new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

/** Import fallback using input element */
export function importWithInputFallback(
  accept: string,
  multiple: boolean = false,
): Promise<File[]> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.multiple = multiple;
    
    input.onchange = () => {
      const files = Array.from(input.files || []);
      if (files.length > 0) {
        resolve(files);
      } else {
        reject(new Error('No files selected'));
      }
    };
    
    input.oncancel = () => reject(new Error('User cancelled'));
    input.click();
  });
}
