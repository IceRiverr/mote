// ═══════════════════════════════════════════════════════════════
// SpriteSheetFS.ts — SpriteSheet 文件系统操作
// 扫描 .mote-sprite.json 文件并加载对应图片
// ═══════════════════════════════════════════════════════════════

import type { SpriteSheet, FrameData } from '../data/SpriteSheet';
import { addSpriteSheet } from '../store/spriteSheet';
import { getFileSystem } from './FileSystem';

const SPRITE_SHEET_EXTENSION = '.mote-sprite.json';

export class SpriteSheetFS {
  private fs = getFileSystem();
  private assetsDir = 'assets';
  private initialized = false;

  setAssetsDir(dir: string): void {
    this.assetsDir = dir || 'assets';
  }

  async initialize(): Promise<boolean> {
    if (this.initialized) return true;
    await this.scanSpriteSheets();
    this.initialized = true;
    return true;
  }

  async rescan(): Promise<void> {
    this.initialized = false;
    await this.scanSpriteSheets();
    this.initialized = true;
  }

  private async scanSpriteSheets(): Promise<void> {
    try {
      for await (const entry of this.scanDirectory(this.assetsDir)) {
        if (entry.kind === 'file' && entry.name.endsWith(SPRITE_SHEET_EXTENSION)) {
          const relativePath = entry.path.slice(this.assetsDir.length + 1);
          await this.loadSpriteSheet(relativePath);
        }
      }
    } catch (err) {
      console.log(`[SpriteSheetFS] Scan directory ${this.assetsDir} not found or empty`);
    }
  }

  private async *scanDirectory(dirPath: string): AsyncGenerator<{
    name: string;
    kind: 'file' | 'directory';
    path: string;
  }> {
    try {
      for await (const entry of this.fs.listDirectory(dirPath)) {
        const fullPath = `${dirPath}/${entry.name}`;
        yield { name: entry.name, kind: entry.kind, path: fullPath };
        if (entry.kind === 'directory') {
          yield* this.scanDirectory(fullPath);
        }
      }
    } catch {
      // ignore
    }
  }

  private async loadSpriteSheet(relativePath: string): Promise<void> {
    const assetPath = `${this.assetsDir}/${relativePath}`;

    // 1. 读取 JSON
    const json = await this.fs.readJson(assetPath);
    if (!json) {
      console.warn(`[SpriteSheetFS] Failed to read: ${relativePath}`);
      return;
    }

    // 2. 转换为 SpriteSheet 格式
    const sheet = this.parseSpriteSheetJson(json, relativePath);
    if (!sheet) {
      console.warn(`[SpriteSheetFS] Invalid format: ${relativePath}`);
      return;
    }

    // 3. 加载图片
    const imagePath = `${this.assetsDir}/${sheet.image}`;
    const img = await this.loadImage(imagePath);
    if (!img) {
      console.warn(`[SpriteSheetFS] Failed to load image: ${sheet.image} for ${relativePath}`);
      return;
    }

    // 4. 注册到 store
    addSpriteSheet(sheet, img);
    console.log(`[SpriteSheetFS] Loaded: ${sheet.name} (${sheet.id}) — ${Object.keys(sheet.frames).length} frames`);
  }

  private normalizeFrame(f: any): FrameData {
    const frame: FrameData = { ...f };

    // 规范化 collider 格式：JSON 中可能是 { shapes: [...] } (ColliderData)
    // 但 FrameData.collider 期望 ColliderShape[]
    const collider = f.collider;
    if (collider && typeof collider === 'object' && !Array.isArray(collider)) {
      if (Array.isArray(collider.shapes)) {
        frame.collider = collider.shapes;
      }
    }

    return frame;
  }

  private parseSpriteSheetJson(json: any, sourcePath: string): SpriteSheet | null {
    if (!json || typeof json !== 'object') return null;

    // 兼容旧格式：frames 可能是数组
    const rawFrames = json.frames;
    let frames: Record<string, FrameData>;

    if (Array.isArray(rawFrames)) {
      frames = {};
      for (const f of rawFrames) {
        if (f.name) {
          frames[f.name] = this.normalizeFrame(f);
        }
      }
    } else if (typeof rawFrames === 'object') {
      frames = {};
      for (const [key, f] of Object.entries(rawFrames)) {
        frames[key] = this.normalizeFrame(f);
      }
    } else {
      return null;
    }

    // 生成稳定 ID：如果没有 id，用文件名（去掉扩展名）
    const id = json.id || sourcePath.replace(/\.mote-sprite\.json$/, '').replace(/^.*[\\/]/, '');

    return {
      id,
      name: json.name || id,
      image: json.image || '',
      sourcePath,
      jsonPath: sourcePath,
      imageWidth: json.imageWidth || 0,
      imageHeight: json.imageHeight || 0,
      slicing: json.slicing || { mode: 'grid', tileWidth: 16, tileHeight: 16 },
      frames,
    };
  }

  private async loadImage(path: string): Promise<HTMLImageElement | null> {
    const dataUrl = await this.fs.readFileAsDataUrl(path);
    if (!dataUrl) return null;

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => {
        console.warn(`[SpriteSheetFS] Image load failed: ${path}`);
        resolve(null);
      };
      img.src = dataUrl;
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// 单例导出
// ═══════════════════════════════════════════════════════════════

let spriteSheetFSInstance: SpriteSheetFS | null = null;

export function getSpriteSheetFS(): SpriteSheetFS {
  if (!spriteSheetFSInstance) {
    spriteSheetFSInstance = new SpriteSheetFS();
  }
  return spriteSheetFSInstance;
}

export function resetSpriteSheetFS(): void {
  spriteSheetFSInstance = null;
}
