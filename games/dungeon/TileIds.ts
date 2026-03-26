// Tile IDs for Dungeon game
// 与编辑器共享的瓦片类型定义

export const enum T {
  VOID = 0,
  FLOOR,
  WALL,
  WALL_CORNER,
  WALL_EDGE,
  DOOR_CLOSED,
  DOOR_OPEN,
  CHEST,
  BARREL,
  STAIRS_DOWN,
  WATER,
  PLANKS,
  TRAP,
  CAMPFIRE,
}

// 阻挡移动的瓦片类型
export const BLOCKED_TILES = new Set<T>([
  T.VOID,
  T.WALL,
  T.WALL_CORNER,
  T.WALL_EDGE,
  T.DOOR_CLOSED,
  T.WATER,
]);

// 瓦片到精灵文件的映射
export const SPRITE_FILES: Record<T, string | null> = {
  [T.VOID]:        null,
  [T.FLOOR]:       'tile.png',
  [T.WALL]:        'wall.png',
  [T.WALL_CORNER]: 'wall_corner.png',
  [T.WALL_EDGE]:   'wall_edge.png',
  [T.DOOR_CLOSED]: 'door_closed.png',
  [T.DOOR_OPEN]:   'door_open.png',
  [T.CHEST]:       'floor_chest.png',
  [T.BARREL]:      'floor_barrel.png',
  [T.STAIRS_DOWN]: 'stairs_down.png',
  [T.WATER]:       'water.png',
  [T.PLANKS]:      'planks.png',
  [T.TRAP]:        'floor_trap.png',
  [T.CAMPFIRE]:    'floor_campfire.png',
};

// 编辑器中显示的颜色（与编辑器配置保持一致）
export const TILE_COLORS: Record<T, string> = {
  [T.VOID]:        '#000000',
  [T.FLOOR]:       '#8B7355',
  [T.WALL]:        '#4A4A4A',
  [T.WALL_CORNER]: '#3A3A3A',
  [T.WALL_EDGE]:   '#5A5A5A',
  [T.DOOR_CLOSED]: '#6B4E3D',
  [T.DOOR_OPEN]:   '#5A3D2D',
  [T.CHEST]:       '#D4A84B',
  [T.BARREL]:      '#8B4513',
  [T.STAIRS_DOWN]: '#666666',
  [T.WATER]:       '#4A90D9',
  [T.PLANKS]:      '#A0826D',
  [T.TRAP]:        '#8B0000',
  [T.CAMPFIRE]:    '#FF6B35',
};
