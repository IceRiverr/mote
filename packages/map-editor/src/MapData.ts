// Map Data Types for Mote Map Editor

export interface TileDef {
  id: number;
  name: string;
  color: string;      // 编辑器中显示的颜色
  solid: boolean;     // 是否阻挡移动
  category?: string;  // 分类（地面、墙壁、物体等）
}

export interface MapConfig {
  id: string;
  name: string;
  tileSize: number;
  defaultWidth: number;
  defaultHeight: number;
  tiles: TileDef[];
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
