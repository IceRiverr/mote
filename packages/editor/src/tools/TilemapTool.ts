/**
 * TilemapTool - Tilemap 编辑工具基类
 * 
 * 新架构下的工具基类，使用 EditorBridge 和 CommandHistory
 */

import type { EditorBridge } from '../core/EditorBridge.js';
import type { CommandHistory } from '../core/CommandHistory.js';

export interface TilemapTool {
  readonly name: string;
  readonly icon: string;
  readonly cursor: string;

  /**
   * 设置当前编辑的图层
   */
  setLayer(layerName: string): void;

  /**
   * 设置当前选中的 tile ID
   */
  setTileId(tileId: number): void;

  /**
   * 鼠标按下事件
   */
  onPointerDown(x: number, y: number): void;

  /**
   * 鼠标移动事件
   */
  onPointerMove(x: number, y: number): void;

  /**
   * 鼠标释放事件
   */
  onPointerUp(x: number, y: number): void;

  /**
   * 获取预览信息（用于渲染预览）
   */
  getPreview?(): TilePreview | null;
}

/**
 * Tile 预览信息
 */
export interface TilePreview {
  type: 'single' | 'rect' | 'fill';
  x: number;
  y: number;
  w?: number;
  h?: number;
  tiles?: Array<{ x: number; y: number; tileId: number }>;
}

/**
 * 工具基类
 */
export abstract class BaseTilemapTool implements TilemapTool {
  abstract readonly name: string;
  abstract readonly icon: string;
  abstract readonly cursor: string;

  protected bridge: EditorBridge;
  protected history: CommandHistory;
  protected layerName: string = '';
  protected tileId: number = 0;
  protected isDragging = false;
  protected lastX = -1;
  protected lastY = -1;

  constructor(bridge: EditorBridge, history: CommandHistory) {
    this.bridge = bridge;
    this.history = history;
  }

  setLayer(layerName: string): void {
    this.layerName = layerName;
  }

  setTileId(tileId: number): void {
    this.tileId = tileId;
  }

  abstract onPointerDown(x: number, y: number): void;
  abstract onPointerMove(x: number, y: number): void;
  abstract onPointerUp(x: number, y: number): void;

  getPreview?(): TilePreview | null;
}
