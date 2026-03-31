// Tile IDs for Dungeon game
export enum T {
  VOID = 0,
  FLOOR = 1,
  WALL = 2,
  WALL_CORNER = 3,
  WALL_EDGE = 4,
  DOOR_CLOSED = 5,
  DOOR_OPEN = 6,
  CHEST = 7,
  BARREL = 8,
  STAIRS_DOWN = 9,
  WATER = 10,
  PLANKS = 11,
  TRAP = 12,
  CAMPFIRE = 13,
}

export const BLOCKED_TILES = new Set<T>([
  T.VOID,
  T.WALL,
  T.WALL_CORNER,
  T.WALL_EDGE,
  T.DOOR_CLOSED,
  T.WATER,
]);

export const SPRITE_FILES: Record<number, string | undefined> = {
  [T.VOID]: undefined,
  [T.FLOOR]: 'tile.png',
  [T.WALL]: 'wall.png',
  [T.WALL_CORNER]: 'wall_corner.png',
  [T.WALL_EDGE]: 'wall_edge.png',
  [T.DOOR_CLOSED]: 'door_closed.png',
  [T.DOOR_OPEN]: 'door_open.png',
  [T.CHEST]: 'floor_chest.png',
  [T.BARREL]: 'floor_barrel.png',
  [T.STAIRS_DOWN]: 'stairs_down.png',
  [T.WATER]: 'water.png',
  [T.PLANKS]: 'planks.png',
  [T.TRAP]: 'floor_trap.png',
  [T.CAMPFIRE]: 'floor_campfire.png',
};
