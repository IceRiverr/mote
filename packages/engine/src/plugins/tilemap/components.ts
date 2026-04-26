// engine/src/plugins/tilemap/components.ts
// 瓦片地图组件

/** 瓦片地图组件 —— 存储地图数据 */
export class Tilemap {
  /** 地图宽度（格数） */
  width = 0;
  /** 地图高度（格数） */
  height = 0;
  /** 瓦片宽度（像素） */
  tileWidth = 16;
  /** 瓦片高度（像素） */
  tileHeight = 16;
  /** 瓦片数据：layerIndex -> tileId */
  layers: TileLayer[] = [];
  /** 图集引用 */
  atlasKey = '';
}

export interface TileLayer {
  /** 层名称 */
  name: string;
  /** 是否可见 */
  visible: boolean;
  /** 不透明度 */
  opacity: number;
  /** 瓦片数据：y * width + x -> tileId */
  data: (number | null)[];
}

/** 瓦片地图碰撞体 —— 用于物理系统 */
export class TilemapCollider {
  /** 是否启用碰撞 */
  enabled = true;
  /** 碰撞层索引 */
  collisionLayer = 0;
  /** 哪些 tileId 被视为碰撞（null = 所有非空瓦片） */
  solidTileIds: number[] | null = null;
}

/** 瓦片动画组件 */
export class TileAnimation {
  /** 动画帧：tileId -> 帧列表 */
  animations = new Map<number, TileAnimFrame[]>();
  /** 当前状态：tileKey -> 当前帧索引 */
  currentFrames = new Map<string, number>();
  /** 累积时间 */
  accumulatedTime = 0;
}

export interface TileAnimFrame {
  tileId: number;
  duration: number; // 毫秒
}

// 声明组件类型
declare module '../../core/componentRegistry' {
  interface ComponentMap {
    Tilemap: Tilemap;
    TilemapCollider: TilemapCollider;
    TileAnimation: TileAnimation;
  }
}
