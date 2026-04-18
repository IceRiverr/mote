// ═══════════════════════════════════════════════════════════════
// contentBrowser.ts - Content Browser 状态管理
// ═══════════════════════════════════════════════════════════════

import { signal, computed } from '@preact/signals';
import { getFileSystem, getPrefabFS } from '../fs';
import { setPrefab } from './prefabs';
import type { Scene } from '../data/Scene';

// ═══════════════════════════════════════════════════════════════
// 类型定义
// ═══════════════════════════════════════════════════════════════

export type AssetType =
  | 'folder'
  | 'image'
  | 'sprite'
  | 'prefab'
  | 'scene'
  | 'tilemap'
  | 'script'
  | 'audio'
  | 'unknown';

export interface AssetNode {
  id: string;           // 唯一标识,使用文件路径
  name: string;         // 显示名称(文件名或文件夹名)
  path: string;         // 相对于项目根的路径
  type: AssetType;
  children?: AssetNode[];
  lastModified?: number;
}

// ═══════════════════════════════════════════════════════════════
// 状态
// ═══════════════════════════════════════════════════════════════

/** 完整资产树 */
export const assetTree = signal<AssetNode[]>([]);

/** 当前选中的文件夹路径 */
export const selectedFolderPath = signal<string>('assets');

/** 搜索关键词 */
export const searchQuery = signal('');

/** 类型过滤器 */
export const typeFilter = signal<AssetType | 'all'>('all');

/** 视图模式:grid 或 list */
export const viewMode = signal<'grid' | 'list'>('grid');

/** List 排序字段 */
export const listSortBy = signal<'name' | 'type'>('name');
export const listSortAsc = signal<boolean>(true);

/** 当前选中的资源路径 */
export const selectedAssetPaths = signal<string[]>([]);

/** 等待在 Sprite Editor 中打开的文件路径 */
export const pendingSpriteEditorOpen = signal<string | null>(null);

/** 当前在 Prefab Preview 面板中预览的 Prefab 路径 */
export const previewedPrefabPath = signal<string | null>(null);

// ═══════════════════════════════════════════════════════════════
// 计算属性
// ═══════════════════════════════════════════════════════════════

/** 是否全局搜索 */
export const isGlobalSearch = computed(() =>
  searchQuery.value.startsWith('/')
);

/** 当前文件夹下的可见节点(应用搜索和类型过滤) */
export const visibleAssets = computed(() => {
  const query = searchQuery.value;

  let nodes: AssetNode[];

  if (query.startsWith('/')) {
    // 全局搜索
    const q = query.slice(1).toLowerCase().trim();
    nodes = q ? flattenAndSearch(assetTree.value, q) : [];
  } else {
    // 当前文件夹搜索
    const folder = findNode(assetTree.value, selectedFolderPath.value);
    if (!folder || !folder.children) return [];
    nodes = [...folder.children];

    if (query) {
      const q = query.toLowerCase();
      nodes = nodes.filter(n => n.name.toLowerCase().includes(q));
    }
  }

  if (typeFilter.value !== 'all') {
    nodes = nodes.filter(
      n => n.type === typeFilter.value || n.type === 'folder'
    );
  }

  return nodes;
});

// ═══════════════════════════════════════════════════════════════
// 工具函数
// ═══════════════════════════════════════════════════════════════

/**
 * 根据文件名检测资源类型
 */
export function detectAssetType(fileName: string): AssetType {
  if (fileName.endsWith('.mote-prefab.json')) return 'prefab';
  if (fileName.endsWith('.mote-scene.json')) return 'scene';
  if (fileName.endsWith('.mote-sprite.json')) return 'sprite';
  if (fileName.endsWith('.mote-tilemap.json')) return 'tilemap';
  if (/\.(png|jpg|jpeg|webp)$/i.test(fileName)) return 'image';
  if (/\.(ts|js)$/i.test(fileName)) return 'script';
  if (/\.(mp3|ogg|wav)$/i.test(fileName)) return 'audio';
  return 'unknown';
}

/**
 * 在树中查找节点
 */
export function findNode(
  nodes: AssetNode[],
  path: string
): AssetNode | null {
  for (const node of nodes) {
    if (node.path === path) return node;
    if (node.children) {
      const found = findNode(node.children, path);
      if (found) return found;
    }
  }
  return null;
}

/**
 * 递归扫描目录
 */
async function scanDirectoryRecursive(dirPath: string): Promise<AssetNode[]> {
  const fs = getFileSystem();
  const prefabFS = getPrefabFS();
  const nodes: AssetNode[] = [];

  try {
    for await (const entry of fs.listDirectory(dirPath)) {
      const path = `${dirPath}/${entry.name}`;

      if (entry.kind === 'directory') {
        const children = await scanDirectoryRecursive(path);
        nodes.push({
          id: path,
          name: entry.name,
          path,
          type: 'folder',
          children,
        });
      } else {
        nodes.push({
          id: path,
          name: entry.name,
          path,
          type: detectAssetType(entry.name),
        });

        // 自动加载 Prefab 到 store（使用完整路径作为 key，保持全系统一致）
        if (
          entry.name.endsWith('.mote-prefab.json') &&
          dirPath.startsWith('assets')
        ) {
          const relativePath = path.startsWith('assets/')
            ? path.slice('assets/'.length)
            : path;
          const prefab = await prefabFS.loadFromPath(relativePath);
          if (prefab) {
            setPrefab(path, prefab);
          }
        }
      }
    }
  } catch (err) {
    if ((err as Error).message?.includes('not found') || (err as any)?.name === 'NotFoundError') {
      console.log(`[ContentBrowser] Directory not found: ${dirPath}`);
    } else {
      console.error(`[ContentBrowser] Scan failed for ${dirPath}:`, err);
    }
  }

  // 排序:文件夹在前,按名称排序
  return nodes.sort((a, b) => {
    if (a.type === 'folder' && b.type !== 'folder') return -1;
    if (a.type !== 'folder' && b.type === 'folder') return 1;
    return a.name.localeCompare(b.name);
  });
}

/**
 * 扫描整个项目的 assets/ 和 src/ 目录
 */
export async function scanAssets(): Promise<void> {
  const roots = ['assets', 'src'];
  const result: AssetNode[] = [];

  for (const root of roots) {
    const children = await scanDirectoryRecursive(root);
    result.push({
      id: root,
      name: root,
      path: root,
      type: 'folder',
      children,
    });
  }

  assetTree.value = result;
}

/**
 * 全局搜索:递归遍历所有节点,按名称匹配
 */
function flattenAndSearch(nodes: AssetNode[], query: string): AssetNode[] {
  const results: AssetNode[] = [];
  for (const node of nodes) {
    if (node.name.toLowerCase().includes(query)) {
      results.push(node);
    }
    if (node.children) {
      results.push(...flattenAndSearch(node.children, query));
    }
  }
  return results;
}

// ═══════════════════════════════════════════════════════════════
// 文件操作
// ═══════════════════════════════════════════════════════════════

/**
 * 重命名文件/文件夹
 */
export async function renameAsset(oldPath: string, newName: string): Promise<boolean> {
  const fs = getFileSystem();
  const lastSlash = oldPath.lastIndexOf('/');
  const dir = lastSlash >= 0 ? oldPath.slice(0, lastSlash) : '';
  const newPath = dir ? `${dir}/${newName}` : newName;

  if (oldPath === newPath) return true;

  const content = await fs.readFile(oldPath);
  if (content === null) return false;

  const ok = await fs.writeFile(newPath, content);
  if (!ok) return false;

  await fs.remove(oldPath);
  await scanAssets();
  return true;
}

/**
 * 删除文件/文件夹
 */
export async function deleteAsset(path: string): Promise<boolean> {
  const fs = getFileSystem();
  const ok = await fs.remove(path, true);
  if (ok) await scanAssets();
  return ok;
}

/**
 * 创建新文件夹
 */
export async function createFolder(parentPath: string, name: string): Promise<boolean> {
  const fs = getFileSystem();
  const path = `${parentPath}/${name}`;
  const ok = await fs.createDirectory(path);
  if (ok) await scanAssets();
  return ok;
}

/**
 * 从路径加载场景文件到当前场景
 */
export async function loadSceneFromPath(assetPath: string): Promise<boolean> {
  const fs = getFileSystem();
  console.log('[ContentBrowser] Loading scene:', assetPath);

  try {
    const json = await fs.readJson(assetPath);
    if (!json) {
      console.error('[ContentBrowser] Cannot read scene JSON:', assetPath);
      return false;
    }

    // 基础验证
    const raw = json as any;
    if (!raw.id || !raw.name || typeof raw.width !== 'number' || typeof raw.height !== 'number') {
      console.error('[ContentBrowser] Invalid scene format:', assetPath);
      return false;
    }

    const scene = json as Scene;
    scene.path = assetPath;

    const { loadScene } = await import('./scene');
    loadScene(scene);
    console.log('[ContentBrowser] Scene loaded:', scene.name);
    return true;
  } catch (err) {
    console.error('[ContentBrowser] Failed to load scene:', err);
    return false;
  }
}

/**
 * 在 Sprite Editor 中打开资产文件
 *
 * 支持两种路径格式：
 * - image 字段相对 assets/（规范格式）
 * - image 字段相对 JSON 文件所在目录（兼容旧格式）
 */
export async function openAssetInSpriteEditor(assetPath: string): Promise<boolean> {
  const fs = getFileSystem();
  console.log('[ContentBrowser] Opening sprite:', assetPath);

  try {
    // ── Step 1: 读取 JSON ──
    const json = await fs.readJson(assetPath);
    if (!json) {
      console.error('[ContentBrowser] Step 1 FAILED: cannot read JSON:', assetPath);
      return false;
    }
    console.log('[ContentBrowser] Step 1 OK: JSON loaded, keys:', Object.keys(json as any).join(', '));

    // ── Step 2: 验证类型（兼容无 type 字段的旧文件）─
    const raw = json as any;
    if (raw.type && raw.type !== 'mote-sprite') {
      console.error('[ContentBrowser] Step 2 FAILED: type is', raw.type, '(expected mote-sprite)');
      return false;
    }
    // 如果无 type 字段但包含 id/name/image/frames，也视为有效
    if (!raw.type && !(raw.image && raw.frames)) {
      console.error('[ContentBrowser] Step 2 FAILED: missing type and required fields');
      return false;
    }
    console.log('[ContentBrowser] Step 2 OK: valid sprite format');

    const spriteJson = json as import('../data/io').SpriteSheetJson;

    // ── Step 3: 解析图片路径 ──
    const imagePath = spriteJson.image;
    if (!imagePath) {
      console.error('[ContentBrowser] Step 3 FAILED: no image field in JSON');
      return false;
    }
    console.log('[ContentBrowser] Step 3 OK: image path in JSON =', imagePath);

    // ── Step 4: 尝试读取图片 ──
    // 策略 A: image 相对 assets/
    let fullImagePath = imagePath.startsWith('assets/') ? imagePath : `assets/${imagePath}`;
    let imageDataUrl = await fs.readFileAsDataUrl(fullImagePath);

    // 策略 B: image 相对 JSON 文件所在目录
    if (!imageDataUrl && assetPath.includes('/')) {
      const jsonDir = assetPath.slice(0, assetPath.lastIndexOf('/'));
      fullImagePath = `${jsonDir}/${imagePath}`;
      console.log('[ContentBrowser] Step 4 RETRY: relative to JSON dir:', fullImagePath);
      imageDataUrl = await fs.readFileAsDataUrl(fullImagePath);
    }

    // 策略 C: 直接按 imagePath 读取（已是完整相对路径）
    if (!imageDataUrl && !imagePath.startsWith('assets/')) {
      console.log('[ContentBrowser] Step 4 RETRY: direct path:', imagePath);
      imageDataUrl = await fs.readFileAsDataUrl(imagePath);
    }

    if (!imageDataUrl) {
      console.error('[ContentBrowser] Step 4 FAILED: cannot read image. Tried:');
      console.error('  - assets/${imagePath}');
      if (assetPath.includes('/')) console.error('  - ${jsonDir}/${imagePath}');
      console.error('  - ${imagePath} (direct)');
      return false;
    }
    console.log('[ContentBrowser] Step 4 OK: image loaded, data URL length =', imageDataUrl.length);

    // ── Step 5: 加载 HTMLImageElement ──
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (e) => {
        console.error('[ContentBrowser] Step 5 FAILED: image.onerror', e);
        reject(new Error('Image load failed'));
      };
      img.src = imageDataUrl;
    });
    console.log('[ContentBrowser] Step 5 OK: image size', img.naturalWidth, 'x', img.naturalHeight);

    // ── Step 6: 创建 SpriteSheet ──
    const { spriteSheetFromJson } = await import('../data/io');
    const sheet = spriteSheetFromJson(spriteJson, imageDataUrl);
    console.log('[ContentBrowser] Step 6 OK: SpriteSheet created,', Object.keys(sheet.frames).length, 'frames');

    // ── Step 7: 添加到 store ──
    const { addSpriteSheet, isTemporarySpriteSheet } = await import('./spriteSheet');
    addSpriteSheet(sheet, img);
    isTemporarySpriteSheet.value = false;
    console.log('[ContentBrowser] Step 7 OK: added to store');

    return true;
  } catch (err) {
    console.error('[ContentBrowser] UNEXPECTED ERROR:', err);
    return false;
  }
}

/**
 * 直接在 Sprite Editor 中打开图片文件（无需 .mote-sprite.json）
 * 使用默认 grid 参数（16x16）创建临时 SpriteSheet
 */
export async function openImageInSpriteEditor(imagePath: string): Promise<boolean> {
  const fs = getFileSystem();
  console.log('[ContentBrowser] Opening image in sprite editor:', imagePath);

  try {
    // ── Step 1: 读取图片为 data URL ──
    const imageDataUrl = await fs.readFileAsDataUrl(imagePath);
    if (!imageDataUrl) {
      console.error('[ContentBrowser] Failed to read image:', imagePath);
      return false;
    }
    console.log('[ContentBrowser] Image loaded, data URL length =', imageDataUrl.length);

    // ── Step 2: 加载 HTMLImageElement ──
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = (e) => {
        console.error('[ContentBrowser] Image.onerror', e);
        reject(new Error('Image load failed'));
      };
      img.src = imageDataUrl;
    });
    console.log('[ContentBrowser] Image size:', img.naturalWidth, 'x', img.naturalHeight);

    // ── Step 3: 用默认 grid 参数创建 SpriteSheet ──
    const { createGridSpriteSheet } = await import('../data/SpriteSheet');
    const name = imagePath.split('/').pop()?.replace(/\.[^.]+$/, '') || 'sheet';
    const sheet = createGridSpriteSheet(
      `sheet_${Date.now()}`,
      name,
      imageDataUrl,
      img.naturalWidth,
      img.naturalHeight,
      16,  // 默认 tileWidth
      16,  // 默认 tileHeight
      0,
      0
    );
    console.log('[ContentBrowser] SpriteSheet created,', Object.keys(sheet.frames).length, 'frames (16x16 grid)');

    // ── Step 4: 添加到 store ──
    const { addSpriteSheet, isTemporarySpriteSheet } = await import('./spriteSheet');
    addSpriteSheet(sheet, img);
    isTemporarySpriteSheet.value = true;
    console.log('[ContentBrowser] Added to store');

    return true;
  } catch (err) {
    console.error('[ContentBrowser] UNEXPECTED ERROR:', err);
    return false;
  }
}

/**
 * 创建空白 Prefab
 */
export async function createPrefabFile(
  folderPath: string,
  name: string
): Promise<boolean> {
  const fs = getFileSystem();
  const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'prefab';
  const fileName = `${id}.mote-prefab.json`;
  const path = `${folderPath}/${fileName}`;

  const prefab = {
    type: 'mote-prefab',
    version: '1.0.0',
    id,
    name,
    tags: [],
    components: {
      Transform: { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 },
    },
  };

  const ok = await fs.writeFile(path, JSON.stringify(prefab, null, 2));
  if (ok) await scanAssets();
  return ok;
}

// ═══════════════════════════════════════════════════════════════
// 排序
// ═══════════════════════════════════════════════════════════════

/**
 * 对节点列表排序(用于 List 视图)
 */
export function sortAssets(nodes: AssetNode[], sortBy: 'name' | 'type', asc: boolean): AssetNode[] {
  const sorted = [...nodes].sort((a, b) => {
    if (a.type === 'folder' && b.type !== 'folder') return -1;
    if (a.type !== 'folder' && b.type === 'folder') return 1;

    if (sortBy === 'name') {
      return a.name.localeCompare(b.name);
    } else {
      if (a.type !== b.type) return a.type.localeCompare(b.type);
      return a.name.localeCompare(b.name);
    }
  });

  return asc ? sorted : sorted.reverse();
}

/**
 * 获取类型对应的图标
 */
export function getAssetIcon(type: AssetType): string {
  switch (type) {
    case 'folder': return '📁';
    case 'image': return '🖼';
    case 'sprite': return '🎨';
    case 'prefab': return '📦';
    case 'scene': return '🗺';
    case 'tilemap': return '⬜';
    case 'script': return '📜';
    case 'audio': return '🔊';
    default: return '📄';
  }
}
