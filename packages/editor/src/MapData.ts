// Map Data Types for Mote Map Editor

export interface TileDef {
  id: number;
  name: string;
  color: string;      // 编辑器中显示的颜色（无图片时的回退色）
  solid: boolean;     // 是否阻挡移动
  category?: string;  // 分类（地面、墙壁、物体等）
  // Tileset 图片支持
  tilesetImage?: string;  // spritesheet 图片路径（相对于 HTML 文件）
  srcX?: number;          // 在 spritesheet 中的 X 偏移（像素）
  srcY?: number;          // 在 spritesheet 中的 Y 偏移（像素）
  srcW?: number;          // 源宽度（像素，默认等于 tileSize）
  srcH?: number;          // 源高度（像素，默认等于 tileSize）
}

export interface GameConfig {
  id: string;
  name: string;
  tileSize: number;
  defaultWidth: number;
  defaultHeight: number;
  tiles: TileDef[];
  /** 导出模式：
   *  'enum'  — 用 T.NAME 枚举（dungeon 等手写配置）
   *  'index' — 直接输出图集 index 数字（从图集导入的 tileset）
   */
  exportMode?: 'enum' | 'index';
  /** tileset JSON 文件路径（相对于网站根目录）
   *  如：/games/tiny-town/assets/kenney_tiny-town_tilesets.json
   */
  tileset?: string;
}

export interface MapData {
  version: 1;
  name: string;
  width: number;
  height: number;
  tileSize: number;
  tiles: number[];  // 一维数组，值为 Tile ID
  spawnPoint: { x: number; y: number };
}

// 导出格式
export interface ExportOptions {
  format: 'ts' | 'json' | 'png';
  includeComments?: boolean;
  optimize?: boolean;
}
