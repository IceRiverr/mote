/**
 * Mote Editor - Core Types
 * 编辑器核心类型定义
 */

// ============================================================================
// 实体与组件
// ============================================================================

export interface EntityInfo {
  id: number;
  name: string;
  parentId: number | null;
  children: number[];
  components: string[]; // 组件类型名列表
}

export interface ComponentData {
  [field: string]: unknown;
}

export interface SceneData {
  name: string;
  entities: EntityInfo[];
  tilemap?: string; // tilemap 文件路径
}

// ============================================================================
// 资源
// ============================================================================

export type AssetType = 'image' | 'audio' | 'json' | 'tileset' | 'atlas' | 'unknown';

export interface AssetInfo {
  path: string;
  name: string;
  type: AssetType;
  size: number;
}

// ============================================================================
// Tilemap
// ============================================================================

export interface TilesetRef {
  image: string;
  columns: number;
  tilecount: number;
}

export interface TilemapLayer {
  name: string;
  data: number[]; // GID 数组
}

export interface TilemapData {
  tileSize: number;
  width: number; // tile 列数
  height: number; // tile 行数
  tilesets: TilesetRef[];
  layers: TilemapLayer[];
}

// ============================================================================
// 项目
// ============================================================================

export interface ProjectConfig {
  name: string;
  entry: string; // 启动场景路径
  resolution: { width: number; height: number };
  pixelPerfect: boolean;
  sceneBindings?: Record<string, string>; // 场景名 -> 代码类名
}

export interface FileEntry {
  name: string;
  kind: 'file' | 'directory';
  path: string;
}

// ============================================================================
// 编辑器事件
// ============================================================================

export type EditorEvent =
  | 'entity-created'
  | 'entity-deleted'
  | 'entity-changed'
  | 'selection-changed'
  | 'scene-loaded'
  | 'play-state-changed';

export type PlayState = 'stopped' | 'playing' | 'paused';

// ============================================================================
// 命令模式
// ============================================================================

export interface Command {
  /** 用于显示在 UI 中的描述 */
  readonly description: string;
  /** 执行操作 */
  execute(): void;
  /** 撤销操作 */
  undo(): void;
}

// ============================================================================
// 视图状态
// ============================================================================

export type EditorTool = 'select' | 'tile-paint' | 'tile-erase' | 'entity-place';

export type BottomTab = 'assets' | 'console' | 'tilemap';

export interface ViewState {
  tool: EditorTool;
  bottomTab: BottomTab;
  isBottomPanelOpen: boolean;
  showGrid: boolean;
  zoom: number;
}

// ============================================================================
// Gizmo
// ============================================================================

export type GizmoMode = 'translate' | 'scale' | 'rotate';

export interface Vec2 {
  x: number;
  y: number;
}
